// Élémento Defense : réseau local sans internet.
// Liaison directe WebRTC entre téléphones, en étoile autour de l'hôte (jusqu'à 4 joueurs).
// La mise en relation se fait par QR codes : l'hôte montre une invitation, l'invité répond avec un autre QR.
'use strict';

const NET_VER = 7, NET_MAX = 4, QR_PREFIX = 'ELD' + NET_VER;

// ---------- Encodage des invitations (compression + base64url) ----------
const b64u = {
  enc(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; },
};
async function pipeBytes(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}
// ---------- Codes compacts : on ne garde que l'utile de la description de connexion ----------
// (adresse IP et port, identifiants ICE, empreinte DTLS, rôle) ; l'autre téléphone reconstruit le reste.
// Écrits en base 32 de Crockford (chiffres et majuscules) : un petit QR code, et un code lisible à taper.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ', ICE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b32enc(bytes) { let bits = 0, v = 0, out = ''; for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(v << (5 - bits)) & 31]; return out; }
function b32dec(str) {
  const s = str.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1'), out = []; let bits = 0, v = 0;
  for (const ch of s) { const k = B32.indexOf(ch); if (k < 0) throw new Error('bad'); v = ((v << 5) | k) & 0xffff; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
const crc8 = bytes => { let c = 0; for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 255 : (c << 1) & 255; } return c; };
const packIce = str => { const out = [str.length]; let bits = 0, v = 0; for (const ch of str) { const k = ICE64.indexOf(ch); if (k < 0) return null; v = (v << 6) | k; bits += 6; while (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } v &= 255; } if (bits) out.push((v << (8 - bits)) & 255); return out; };
function unpackIce(b, at) { const n = b[at], nb = Math.ceil(n * 6 / 8); let out = '', bits = 0, v = 0, i = at + 1; while (out.length < n) { if (bits < 6) { v = (v << 8) | b[i++]; bits += 8; } out += ICE64[(v >>> (bits - 6)) & 63]; bits -= 6; v &= (1 << bits) - 1; } return [out, at + 1 + nb]; }
const SETUPS = ['actpass', 'active', 'passive'];
function sdpInfo(sdp) {
  const g = re => (sdp.match(re) || [])[1];
  const ufrag = g(/a=ice-ufrag:(\S+)/), pwd = g(/a=ice-pwd:(\S+)/), fp = g(/a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/), setup = g(/a=setup:(\w+)/);
  if (!ufrag || !pwd || !fp || SETUPS.indexOf(setup) < 0) return null;
  const cands = [], seen = new Set(), priv = ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? 0 : /^169\.254\./.test(ip) ? 2 : 1;
  for (const m of sdp.matchAll(/a=candidate:\S+ 1 udp \d+ (\d+\.\d+\.\d+\.\d+) (\d+) typ host/g)) if (!seen.has(m[1])) { seen.add(m[1]); cands.push([m[1], +m[2]]); }
  cands.sort((a, b) => priv(a[0]) - priv(b[0]));
  return { ufrag, pwd, fp: fp.split(':').map(h => parseInt(h, 16)), setup, cands: cands.slice(0, 2) };
}
function sdpBuild(i) {
  const L = ['v=0', 'o=- ' + (Date.now() % 1e9) + ' 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0'];
  i.cands.forEach(([ip, port], k) => L.push('a=candidate:' + (k + 1) + ' 1 udp ' + (2122260223 - k) + ' ' + ip + ' ' + port + ' typ host generation 0 network-id ' + (k + 1)));
  L.push('a=ice-ufrag:' + i.ufrag, 'a=ice-pwd:' + i.pwd, 'a=ice-options:trickle', 'a=fingerprint:sha-256 ' + i.fp.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':'), 'a=setup:' + i.setup, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144');
  return L.join('\r\n') + '\r\n';
}
function compactSignal(obj) {
  const i = sdpInfo(obj.sdp); if (!i || !i.cands.length || i.fp.length !== 32) return null;
  const u = packIce(i.ufrag), p = packIce(i.pwd); if (!u || !p) return null;
  const b = [obj.v & 255, obj.t === 'o' ? 1 : 2, (+obj.inv >> 8) & 255, +obj.inv & 255, ...u, ...p, ...i.fp, SETUPS.indexOf(i.setup), i.cands.length];
  for (const [ip, port] of i.cands) b.push(...ip.split('.').map(Number), port >> 8, port & 255);
  if (obj.t === 'o') { const nm = [...new TextEncoder().encode(obj.host || '')].slice(0, 16); b.push(nm.length, ...nm); }
  b.push(crc8(b));
  return 'E' + b32enc(new Uint8Array(b));
}
function expandSignal(text) {
  const b = b32dec(text.slice(1)), body = b.slice(0, -1);
  if (b.length < 45 || crc8(body) !== b[b.length - 1]) throw new Error(T('Code incomplet ou mal recopié : vérifie chaque groupe de 4 caractères.'));
  let at = 4, ufrag, pwd; [ufrag, at] = unpackIce(b, at); [pwd, at] = unpackIce(b, at);
  const fp = [...b.slice(at, at + 32)]; at += 32;
  const setup = SETUPS[b[at++]], n = b[at++], cands = [];
  for (let k = 0; k < n; k++) { cands.push([b.slice(at, at + 4).join('.'), (b[at + 4] << 8) | b[at + 5]]); at += 6; }
  const t = b[1] === 1 ? 'o' : 'a', out = { t, v: b[0], inv: String((b[2] << 8) | b[3]), sdp: sdpBuild({ ufrag, pwd, fp, setup, cands }) };
  if (t === 'o') { const ln = b[at++]; out.host = new TextDecoder().decode(b.slice(at, at + ln)); }
  return out;
}
// Un texte scanné ou tapé ressemble-t-il à une invitation / réponse du jeu ?
const isSignalText = t => typeof t === 'string' && (t.startsWith(QR_PREFIX) || /^E[0-9A-Z]{60,}$/.test(t.toUpperCase().replace(/[\s-]/g, '')));
async function encodeSignal(obj) {
  const c = compactSignal(obj); if (c) return c;
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== 'undefined') {
    try { return QR_PREFIX + 'r' + b64u.enc(await pipeBytes(raw, new CompressionStream('deflate-raw'))); } catch (e) {}
  }
  return QR_PREFIX + 'n' + b64u.enc(raw);
}
async function decodeSignal(text) {
  if (typeof text === 'string') text = text.trim();
  if (isSignalText(text) && !text.startsWith(QR_PREFIX)) return expandSignal(text.toUpperCase().replace(/[\s-]/g, ''));
  if (typeof text !== 'string' || !text.startsWith(QR_PREFIX)) throw new Error(T('Ce QR code ne vient pas d’Élémento Defense.'));
  const mode = text[QR_PREFIX.length], bytes = b64u.dec(text.slice(QR_PREFIX.length + 1));
  const raw = mode === 'r' ? await pipeBytes(bytes, new DecompressionStream('deflate-raw')) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}

// ---------- Connexion ----------
const rid = () => Math.random().toString(36).slice(2, 8);
function waitIce(pc, ms = 4000) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const done = () => { clearTimeout(tm); pc.removeEventListener('icegatheringstatechange', chk); res(); };
    const chk = () => { if (pc.iceGatheringState === 'complete') done(); };
    const tm = setTimeout(done, ms);
    pc.addEventListener('icegatheringstatechange', chk);
  });
}
const newPC = () => new RTCPeerConnection({ iceServers: [] });

// ---------- Réseau local de l'application Android ----------
// L'hôte sur l'APK ouvre un serveur sur le Wi-Fi : son QR est une simple adresse (http://IP:port/?j=jeton).
// L'invité l'ouvre dans son navigateur (le jeu est servi par le téléphone de l'hôte) ou la scanne depuis l'app :
// un seul scan. Les messages passent par WebSocket, avec les mêmes messages que WebRTC.
// Une connexion LAN imite le couple (pc, dc) de WebRTC pour que le reste de Net ne voie pas la différence.
const lanPlugin = () => (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.LanServer) || null;
function lanInfo(text) {
  const m = /^http:\/\/(\d{1,3}(?:\.\d{1,3}){3}:\d{2,5})\/\?j=([a-z0-9]{4,16})$/i.exec(String(text || '').trim());
  return m ? { url: m[0], ws: 'ws://' + m[1] + '/ws?t=' + m[2], token: m[2] } : null;
}

const Net = {
  role: null, me: null, peers: new Map(), lanConns: new Map(), lan: null, pending: null, players: [], handlers: {}, timer: 0,
  supported() { return typeof RTCPeerConnection !== 'undefined' && typeof DecompressionStream !== 'undefined'; },
  on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
  emit(type, data) { for (const fn of this.handlers[type] || []) { try { fn(data); } catch (e) { console.error(e); } } },

  // Hôte : ouvre la partie
  // opts.online : salon en ligne (js/online.js), sans serveur local
  host(name, opts = {}) {
    this.reset(); this.role = 'host'; this.online = !!opts.online; this.me = { id: rid(), name, host: true };
    this.players = [{ ...this.me, ping: 0 }];
    this.timer = setInterval(() => this.hostTick(), 2000);
    this.emit('roster', this.players);
    if (!this.online) this.lanStart();
  },
  // Hôte sur l'APK : serveur local ; sans Wi-Fi (ou hors de l'app), on reste sur les invitations WebRTC
  async lanStart() {
    const L = lanPlugin(); if (!L) return;
    if (!this.lanWired) {
      this.lanWired = true;
      const conn = id => { for (const p of this.peers.values()) if (p.pc.lan === id) return p; return this.lanConns.get(id); };
      L.addListener('open', ev => {
        if (this.role !== 'host' || !this.lan || !new URLSearchParams(ev.query).get('t') || new URLSearchParams(ev.query).get('t') !== this.lan.token) { L.kick({ id: ev.id }); return; }
        const pc = { lan: ev.id, close: () => L.kick({ id: ev.id }) }, dc = { readyState: 'open', send: s => L.send({ id: ev.id, data: s }) };
        this.lanConns.set(ev.id, { pc, dc });
      });
      L.addListener('message', ev => { const c = conn(ev.id); if (!c) return; let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; } this.receive(c.pc, c.dc, msg); });
      L.addListener('close', ev => { const c = conn(ev.id); this.lanConns.delete(ev.id); if (c) { c.dc.readyState = 'closed'; this.dropPc(c.pc); } });
    }
    const token = rid() + rid();
    try {
      const r = await L.start({ port: 8080 });
      if (this.role !== 'host') { L.stop(); return; }
      if (r.ip) { this.lan = { token, url: 'http://' + r.ip + ':' + r.port + '/?j=' + token }; this.lanAnnounce(); this.emit('lan', this.lan); }
    } catch (e) { this.lan = null; }
  },
  // Annonce de la partie sur le Wi-Fi, pour les invités qui ont l'app (mise à jour à chaque changement de joueurs)
  lanAnnounce() {
    const L = lanPlugin(); if (!L || !this.lan || this.role !== 'host') return;
    L.announce({ text: this.inGame() ? '' : JSON.stringify({ g: 'eld', v: NET_VER, url: this.lan.url, host: this.me.name, n: this.players.length, max: NET_MAX }) });
  },
  inGame() { return typeof G !== 'undefined' && !!G && !!(G.duel || G.coop) && !G.over; },
  // Invité dans l'app : écoute les parties annoncées sur le Wi-Fi ; onFound({ url, host, n, max })
  discover(onFound) {
    const L = lanPlugin(); if (!L) return false;
    this.stopDiscover();
    this.discoL = L.addListener('found', ev => { let m; try { m = JSON.parse(ev.text); } catch (e) { return; } if (m && m.g === 'eld' && lanInfo(m.url) && !(this.lan && this.lan.url === m.url)) onFound(m); });
    L.discover().catch(() => {});
    return true;
  },
  stopDiscover() {
    const L = lanPlugin(); if (!L || !this.discoL) return;
    Promise.resolve(this.discoL).then(h => h && h.remove && h.remove()); this.discoL = null; L.stopDiscover();
  },
  // Invité : rejoint un hôte de l'application par son adresse locale (QR scanné ou page servie par l'hôte)
  joinLan(name, text) {
    const info = lanInfo(text); if (!info) throw new Error(T('Ce QR code ne vient pas d’Élémento Defense.'));
    this.reset(); this.role = 'guest'; this.me = { id: rid(), name, host: false };
    const ws = new WebSocket(info.ws), pc = { close: () => { try { ws.close(); } catch (e) {} } };
    const dc = { get readyState() { return ws.readyState === 1 ? 'open' : 'closed'; }, send: s => ws.send(s) };
    this.hostPc = pc;
    ws.onopen = () => { this.peers.set('host', { pc, dc }); this.sendTo('host', { t: 'hello', id: this.me.id, name: this.me.name, v: NET_VER }); };
    ws.onmessage = ev => { let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; } this.receive(pc, dc, msg); };
    ws.onclose = () => { if (this.hostPc === pc && !this.peers.has('host')) { this.emit('error', T('Impossible de joindre la partie. Vérifiez que les téléphones sont sur le même Wi-Fi ou partage de connexion.')); this.reset(); } else this.dropPc(pc); };
  },
  // Hôte : prépare une invitation pour un nouveau joueur (QR à faire scanner)
  async createInvite() {
    if (this.peers.size + 1 >= NET_MAX) throw new Error(T('La partie est complète (') + NET_MAX + T(' joueurs maximum).'));
    if (this.pending) { try { this.pending.pc.close(); } catch (e) {} }
    const pc = newPC(), dc = pc.createDataChannel('game', { ordered: true }), inv = String(Math.floor(Math.random() * 65536));
    this.pending = { pc, dc, inv };
    this.wire(pc, dc, null);
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    return encodeSignal({ t: 'o', inv, v: NET_VER, host: this.me.name, sdp: pc.localDescription.sdp });
  },
  // Hôte : lit la réponse scannée sur le téléphone de l'invité
  async acceptAnswer(text) {
    const m = await decodeSignal(text);
    if (m.t !== 'a') throw new Error(T('Ce QR code est une invitation, pas une réponse.'));
    if (!this.pending || m.inv !== this.pending.inv) throw new Error(T('Cette réponse correspond à une autre invitation. Recommence l’invitation.'));
    await this.pending.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
    this.pending = null;
  },
  // Invité : lit l'invitation et prépare sa réponse (QR à montrer à l'hôte)
  async join(name, text) {
    const m = await decodeSignal(text);
    if (m.t !== 'o') throw new Error(T('Ce QR code est une réponse. Scanne l’invitation affichée par l’hôte.'));
    if (m.v !== NET_VER) throw new Error(T('Versions du jeu différentes : recharge la page sur les deux téléphones.'));
    this.reset(); this.role = 'guest'; this.me = { id: rid(), name, host: false };
    const pc = newPC();
    pc.ondatachannel = ev => this.wire(pc, ev.channel, 'host');
    await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc);
    this.hostPc = pc;
    return { hostName: m.host, code: await encodeSignal({ t: 'a', inv: m.inv, v: NET_VER, sdp: pc.localDescription.sdp }) };
  },

  wire(pc, dc, pid) {
    const self = this;
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') self.dropPc(pc);
    });
    dc.onopen = () => {
      if (self.role === 'guest') { self.peers.set('host', { pc, dc }); self.sendTo('host', { t: 'hello', id: self.me.id, name: self.me.name, v: NET_VER }); }
    };
    dc.onclose = () => self.dropPc(pc);
    dc.onmessage = ev => { let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; } self.receive(pc, dc, msg); };
  },
  receive(pc, dc, msg) {
    if (this.role === 'host') {
      if (msg.t === 'hello') {
        if (this.peers.size + 1 >= NET_MAX) { try { dc.send(JSON.stringify({ t: 'full' })); } catch (e) {} setTimeout(() => pc.close(), 300); return; }
        if (pc.lan && this.inGame()) { try { dc.send(JSON.stringify({ t: 'ingame' })); } catch (e) {} setTimeout(() => pc.close(), 300); return; }
        if (msg.v && msg.v !== NET_VER) { try { dc.send(JSON.stringify({ t: 'ver' })); } catch (e) {} setTimeout(() => pc.close(), 300); return; }
        // En ligne : le pseudo vient du serveur (celui de l'ami invité), pas de ce que l'invité envoie
        const nm = (pc.uid && typeof onlineName === 'function' && onlineName(pc.uid)) || String(msg.name || T('Joueur')).slice(0, 12);
        this.peers.set(msg.id, { pc, dc, name: nm, ping: 0, uid: pc.uid || null });
        this.syncRoster(); this.emit('join', msg.id); return;
      }
      const id = this.idOf(pc); if (!id) return;
      if (msg.t === 'pong') { const p = this.peers.get(id); if (p) p.ping = Math.round(performance.now() - msg.ts); return; }
      if (msg.t === 'bye') { this.dropPc(pc); return; }
      if (msg.t === 'relay') { this.route(id, msg.to, msg.data); return; }
      this.emit('msg', { from: id, data: msg });
    } else {
      if (msg.t === 'ping') { this.sendTo('host', { t: 'pong', ts: msg.ts }); return; }
      if (msg.t === 'roster') { this.players = msg.players; this.emit('roster', this.players); return; }
      if (msg.t === 'full') { this.emit('error', T('La partie est déjà complète.')); return; }
      if (msg.t === 'ingame') { this.emit('error', T('La partie a déjà commencé.')); this.reset(); return; }
      if (msg.t === 'ver') { this.emit('error', T('Versions du jeu différentes : mettez le jeu à jour sur les deux téléphones.')); this.reset(); return; }
      if (msg.t === 'bye') { this.emit('closed', T('L’hôte a fermé la partie.')); this.reset(); return; }
      if (msg.t === 'relay') { this.emit('msg', { from: msg.from, data: msg.data }); return; }
      this.emit('msg', { from: 'host', data: msg });
    }
  },
  idOf(pc) { for (const [id, p] of this.peers) if (p.pc === pc) return id; return null; },
  dropPc(pc) {
    const id = this.idOf(pc); if (!id) return;
    this.peers.delete(id); try { pc.close(); } catch (e) {}
    if (this.role === 'host') { this.syncRoster(); this.emit('leave', id); }
    else { this.emit('closed', T('Connexion perdue avec l’hôte.')); this.reset(); }
  },
  sendTo(id, msg) { const p = this.peers.get(id); if (p && p.dc.readyState === 'open') { try { p.dc.send(JSON.stringify(msg)); } catch (e) {} } },
  broadcast(msg) { for (const id of this.peers.keys()) this.sendTo(id, msg); },
  // Envoi d'un message de jeu : to = id d'un joueur, ou 'all'
  send(to, data) {
    if (this.role === 'host') this.route(this.me.id, to, data);
    else this.sendTo('host', { t: 'relay', to, data });
  },
  route(from, to, data) {
    for (const p of this.players) {
      if (p.id === from || (to !== 'all' && to !== p.id)) continue;
      if (p.id === this.me.id) this.emit('msg', { from, data });
      else this.sendTo(p.id, { t: 'relay', from, data });
    }
  },
  hostTick() {
    const ts = performance.now();
    this.broadcast({ t: 'ping', ts });
    this.syncRoster();
  },
  syncRoster() {
    this.players = [{ ...this.me, ping: 0 }, ...[...this.peers].map(([id, p]) => ({ id, name: p.name, host: false, ping: p.ping }))];
    this.broadcast({ t: 'roster', players: this.players });
    this.lanAnnounce();
    this.emit('roster', this.players);
  },
  leave() {
    if (this.role === 'host') this.broadcast({ t: 'bye' }); else if (this.role === 'guest') this.sendTo('host', { t: 'bye' });
    setTimeout(() => this.reset(), 150);
  },
  reset() {
    clearInterval(this.timer); this.timer = 0;
    for (const p of this.peers.values()) { try { p.pc.close(); } catch (e) {} }
    if (this.pending) { try { this.pending.pc.close(); } catch (e) {} }
    if (this.hostPc) { try { this.hostPc.close(); } catch (e) {} }
    if (this.lan) { const L = lanPlugin(); if (L) L.stop(); }
    if (typeof onlineClose === 'function') onlineClose();
    this.peers = new Map(); this.lanConns = new Map(); this.lan = null; this.pending = null; this.hostPc = null; this.role = null; this.players = []; this.online = false;
  },
};
