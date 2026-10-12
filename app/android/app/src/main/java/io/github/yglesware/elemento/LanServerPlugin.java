package io.github.yglesware.elemento;

import android.content.Context;
import android.content.res.AssetManager;
import android.net.wifi.WifiManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.IHTTPSession;
import fi.iki.elonen.NanoHTTPD.Response;
import fi.iki.elonen.NanoHTTPD.Response.Status;
import fi.iki.elonen.NanoWSD;
import fi.iki.elonen.NanoWSD.WebSocket;
import fi.iki.elonen.NanoWSD.WebSocketFrame;
import fi.iki.elonen.NanoWSD.WebSocketFrame.CloseCode;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Serveur local de l'hôte (application Android uniquement) :
 * - sert les fichiers du jeu sur le Wi-Fi, pour qu'un invité le rejoigne depuis son navigateur avec un seul scan ;
 * - relaie les messages des joueurs par WebSocket (/ws) vers le jeu de l'hôte (événements open, message, close) ;
 * - découverte sur le Wi-Fi : l'hôte annonce sa partie chaque seconde (diffusion UDP), les invités de l'app l'écoutent (événement found).
 * Sécurité (n'importe quel appareil du Wi-Fi peut s'y connecter) : le serveur n'écoute que sur l'adresse Wi-Fi du téléphone,
 * 16 connexions au plus, 45 s sans rien recevoir et la connexion est coupée, 64 Ko au plus par message ; l'annonce s'arrête
 * quand l'appli passe en arrière-plan.
 */
@CapacitorPlugin(name = "LanServer")
public class LanServerPlugin extends Plugin {
    private static final int DISCO_PORT = 41234;
    private static final int MAX_CONNS = 16, READ_TIMEOUT = 45000, MAX_MESSAGE = 65536;
    private Server server;
    private volatile String beaconText;
    private volatile boolean paused;
    private Thread beacon, listener;
    private DatagramSocket listenSock;
    private WifiManager.MulticastLock mlock;

    @PluginMethod
    public void start(PluginCall call) {
        stopServer();
        int first = call.getInt("port", 8080);
        // Seulement sur le Wi-Fi (ou le partage de connexion) : pas sur les données mobiles ni sur un VPN
        String ip = lanIp();
        if (ip == null) {
            call.reject("Pas de Wi-Fi");
            return;
        }
        IOException last = null;
        for (int port = first; port < first + 10; port++) {
            try {
                Server s = new Server(ip, port);
                s.setAsyncRunner(new CapRunner());
                s.start(READ_TIMEOUT, false);
                server = s;
                JSObject ret = new JSObject();
                ret.put("ip", ip);
                ret.put("port", port);
                call.resolve(ret);
                return;
            } catch (IOException e) {
                last = e;
            }
        }
        call.reject("Impossible d'ouvrir le serveur local", last);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopServer();
        call.resolve();
    }

    @PluginMethod
    public void send(PluginCall call) {
        Client cl = server == null ? null : server.clients.get(call.getString("id", ""));
        if (cl != null) {
            try {
                cl.send(call.getString("data", ""));
            } catch (IOException e) {
                // le joueur vient de partir : l'événement close suivra
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void kick(PluginCall call) {
        Client cl = server == null ? null : server.clients.get(call.getString("id", ""));
        if (cl != null) {
            try {
                cl.close(CloseCode.NormalClosure, "bye", false);
            } catch (IOException e) {
                // déjà fermé
            }
        }
        call.resolve();
    }

    // Hôte : texte annoncé sur le Wi-Fi (adresse de la partie, nom de l'hôte, nombre de joueurs)
    @PluginMethod
    public void announce(PluginCall call) {
        beaconText = call.getString("text", "");
        if (beacon == null) {
            beacon = new Thread(() -> {
                try (DatagramSocket s = new DatagramSocket()) {
                    s.setBroadcast(true);
                    while (beacon == Thread.currentThread()) {
                        String txt = beaconText;
                        if (txt != null && !txt.isEmpty() && !paused) {
                            byte[] b = txt.getBytes(StandardCharsets.UTF_8);
                            for (InetAddress to : broadcastAddresses()) {
                                try {
                                    s.send(new DatagramPacket(b, b.length, to, DISCO_PORT));
                                } catch (IOException e) {
                                    // réseau indisponible : on réessaie à la prochaine annonce
                                }
                            }
                        }
                        Thread.sleep(1000);
                    }
                } catch (Exception e) {
                    // arrêt de l'annonce
                }
            }, "elemento-beacon");
            beacon.start();
        }
        call.resolve();
    }

    // Invité : écoute les annonces des parties sur le Wi-Fi
    @PluginMethod
    public void discover(PluginCall call) {
        stopDiscovery();
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                mlock = wm.createMulticastLock("elemento-discovery");
                mlock.setReferenceCounted(false);
                mlock.acquire();
            }
            DatagramSocket s = new DatagramSocket(null);
            s.setReuseAddress(true);
            s.setBroadcast(true);
            s.bind(new InetSocketAddress(DISCO_PORT));
            listenSock = s;
            listener = new Thread(() -> {
                byte[] buf = new byte[1024];
                while (listenSock == s) {
                    try {
                        DatagramPacket p = new DatagramPacket(buf, buf.length);
                        s.receive(p);
                        JSObject ev = new JSObject();
                        ev.put("text", new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8));
                        ev.put("from", p.getAddress().getHostAddress());
                        notifyListeners("found", ev);
                    } catch (IOException e) {
                        break;
                    }
                }
            }, "elemento-discovery");
            listener.start();
            call.resolve();
        } catch (IOException e) {
            stopDiscovery();
            call.reject("Découverte impossible", e);
        }
    }

    @PluginMethod
    public void stopDiscover(PluginCall call) {
        stopDiscovery();
        call.resolve();
    }

    // Appli en arrière-plan : la partie n'est plus annoncée sur le Wi-Fi (les joueurs déjà là restent connectés)
    @Override
    protected void handleOnPause() {
        paused = true;
    }

    @Override
    protected void handleOnResume() {
        paused = false;
    }

    @Override
    protected void handleOnDestroy() {
        stopServer();
        stopDiscovery();
    }

    private void stopServer() {
        beacon = null;
        beaconText = null;
        if (server != null) {
            server.stop();
            server = null;
        }
    }

    private void stopDiscovery() {
        DatagramSocket s = listenSock;
        listenSock = null;
        listener = null;
        if (s != null) s.close();
        if (mlock != null) {
            try {
                mlock.release();
            } catch (RuntimeException e) {
                // déjà relâché
            }
            mlock = null;
        }
    }

    /** Adresses de diffusion des réseaux locaux (Wi-Fi, partage de connexion), plus la diffusion générale. */
    private static java.util.List<InetAddress> broadcastAddresses() {
        java.util.List<InetAddress> out = new java.util.ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress b = ia.getBroadcast();
                    if (b != null && ia.getAddress() instanceof Inet4Address && ia.getAddress().isSiteLocalAddress() && !out.contains(b)) out.add(b);
                }
            }
            out.add(InetAddress.getByName("255.255.255.255"));
        } catch (Exception e) {
            // pas de réseau
        }
        return out;
    }

    /** Adresse IPv4 du téléphone sur le Wi-Fi (ou sur son partage de connexion), sinon null. */
    private static String lanIp() {
        String fallback = null;
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String name = ni.getName().toLowerCase();
                boolean wifi = name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("swlan") || name.startsWith("softap") || name.startsWith("eth");
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || !a.isSiteLocalAddress()) continue;
                    if (wifi) return a.getHostAddress();
                    if (fallback == null && !name.startsWith("rmnet") && !name.startsWith("ccmni")) fallback = a.getHostAddress();
                }
            }
        } catch (Exception e) {
            // pas de réseau
        }
        return fallback;
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html; charset=utf-8";
        if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (path.endsWith(".css")) return "text/css; charset=utf-8";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }

    private class Server extends NanoWSD {
        final Map<String, Client> clients = new ConcurrentHashMap<>();
        final AtomicInteger next = new AtomicInteger(1);

        Server(String host, int port) {
            super(host, port);
        }

        @Override
        protected WebSocket openWebSocket(IHTTPSession session) {
            Client c = new Client(session, "c" + next.getAndIncrement(), this);
            limitFrames(c);
            return c;
        }

        // Fichiers du jeu, tels qu'embarqués dans l'APK (assets/public)
        @Override
        protected Response serveHttp(IHTTPSession session) {
            String path = session.getUri();
            if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
            if (path.contains("..")) return NanoHTTPD.newFixedLengthResponse(Status.FORBIDDEN, "text/plain", "");
            AssetManager am = getContext().getAssets();
            try {
                InputStream in = am.open("public" + path);
                Response r = NanoHTTPD.newChunkedResponse(Status.OK, mime(path), in);
                r.addHeader("Cache-Control", "no-cache");
                return r;
            } catch (IOException e) {
                return NanoHTTPD.newFixedLengthResponse(Status.NOT_FOUND, "text/plain", "404");
            }
        }
    }

    private class Client extends WebSocket {
        final String id;
        final Server srv;
        final String query;

        Client(IHTTPSession session, String id, Server srv) {
            super(session);
            this.id = id;
            this.srv = srv;
            this.query = session.getQueryParameterString();
        }

        @Override
        protected void onOpen() {
            if (srv.clients.size() >= 8) {
                try {
                    close(CloseCode.PolicyViolation, "full", false);
                } catch (IOException e) {
                    // déjà fermé
                }
                return;
            }
            srv.clients.put(id, this);
            JSObject ev = new JSObject();
            ev.put("id", id);
            ev.put("query", query == null ? "" : query);
            notifyListeners("open", ev);
        }

        @Override
        protected void onClose(CloseCode code, String reason, boolean initiatedByRemote) {
            if (srv.clients.remove(id) == null) return;
            JSObject ev = new JSObject();
            ev.put("id", id);
            notifyListeners("close", ev);
        }

        @Override
        protected void onMessage(WebSocketFrame frame) {
            JSObject ev = new JSObject();
            ev.put("id", id);
            ev.put("data", frame.getTextPayload());
            notifyListeners("message", ev);
        }

        @Override
        protected void onPong(WebSocketFrame pong) {
        }

        @Override
        protected void onException(IOException e) {
            onClose(CloseCode.AbnormalClosure, "", true);
        }
    }

    /** Au plus MAX_CONNS connexions à la fois (fichiers du jeu et WebSocket) ; une erreur d'une connexion ne fait pas planter l'appli. */
    private static class CapRunner implements NanoHTTPD.AsyncRunner {
        private final List<NanoHTTPD.ClientHandler> running = Collections.synchronizedList(new ArrayList<>());
        private final AtomicInteger n = new AtomicInteger();

        @Override
        public void closeAll() {
            for (NanoHTTPD.ClientHandler c : new ArrayList<>(running)) c.close();
        }

        @Override
        public void closed(NanoHTTPD.ClientHandler c) {
            running.remove(c);
        }

        @Override
        public void exec(NanoHTTPD.ClientHandler c) {
            if (running.size() >= MAX_CONNS) {
                c.close();
                return;
            }
            running.add(c);
            Thread t = new Thread(c, "elemento-lan-" + n.incrementAndGet());
            t.setDaemon(true);
            t.setUncaughtExceptionHandler((th, e) -> {
                running.remove(c);
                c.close();
            });
            t.start();
        }
    }

    /**
     * Les messages WebSocket de plus de MAX_MESSAGE octets coupent la connexion, avant que la bibliothèque ne réserve leur
     * mémoire (elle croirait la taille annoncée, jusqu'à 2 Go). On lit les en-têtes de trame au passage dans le flux.
     */
    private static void limitFrames(WebSocket ws) {
        try {
            Field f = WebSocket.class.getDeclaredField("in");
            f.setAccessible(true);
            f.set(ws, new FrameLimit((InputStream) f.get(ws)));
        } catch (Exception e) {
            // bibliothèque différente : on garde le flux tel quel
        }
    }

    private static class FrameLimit extends FilterInputStream {
        // Étapes : 0 premier octet, 1 deuxième, 2 longueur étendue, 3 masque, 4 contenu
        private int step, extLeft, maskLeft;
        private long len, left, msgTotal;
        private boolean fin, control, masked;

        FrameLimit(InputStream in) {
            super(in);
        }

        @Override
        public int read() throws IOException {
            int b = super.read();
            if (b >= 0) feed(b);
            return b;
        }

        @Override
        public int read(byte[] buf, int off, int count) throws IOException {
            if (step == 4 && left > 0) count = (int) Math.min(count, left);
            int r = super.read(buf, off, count);
            for (int i = 0; i < r; i++) {
                if (step == 4) {
                    long skip = Math.min(left, r - i);
                    left -= skip;
                    i += (int) skip - 1;
                    if (left == 0) step = 0;
                } else feed(buf[off + i] & 0xff);
            }
            return r;
        }

        private void feed(int b) throws IOException {
            switch (step) {
                case 0:
                    fin = (b & 0x80) != 0;
                    control = (b & 0x08) != 0;
                    step = 1;
                    break;
                case 1:
                    masked = (b & 0x80) != 0;
                    len = b & 0x7f;
                    if (len == 126) { extLeft = 2; len = 0; step = 2; }
                    else if (len == 127) { extLeft = 8; len = 0; step = 2; }
                    else startMask();
                    break;
                case 2:
                    len = (len << 8) | b;
                    if (--extLeft == 0) startMask();
                    break;
                case 3:
                    if (--maskLeft == 0) startPayload();
                    break;
                default:
                    if (--left <= 0) step = 0;
            }
        }

        private void startMask() throws IOException {
            if (len < 0 || len > MAX_MESSAGE) throw new IOException("message trop gros");
            if (!control) {
                msgTotal += len;
                if (msgTotal > MAX_MESSAGE) throw new IOException("message trop gros");
                if (fin) msgTotal = 0;
            }
            maskLeft = masked ? 4 : 0;
            step = 3;
            if (maskLeft == 0) startPayload();
        }

        private void startPayload() {
            left = len;
            step = left > 0 ? 4 : 0;
        }
    }
}
