// Élémento Defense : réseau local sans internet.
// Liaison directe WebRTC entre téléphones, en étoile autour de l'hôte (jusqu'à 4 joueurs).
// La mise en relation se fait par QR codes : l'hôte montre une invitation, l'invité répond avec un autre QR.
'use strict';

const NET_VER = 4, NET_MAX = 4, QR_PREFIX = 'ELD' + NET_VER;

// ---------- Encodage des invitations (compression + base64url) ----------
const b64u = {
  enc(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; },
};
async function pipeBytes(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}
async function encodeSignal(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== 'undefined') {
    try { return QR_PREFIX + 'r' + b64u.enc(await pipeBytes(raw, new CompressionStream('deflate-raw'))); } catch (e) {}
  }
  return QR_PREFIX + 'n' + b64u.enc(raw);
}
async function decodeSignal(text) {
  if (typeof text !== 'string' || !text.startsWith(QR_PREFIX)) throw new Error('Ce QR code ne vient pas d’Élémento Defense.');
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

const Net = {
  role: null, me: null, peers: new Map(), pending: null, players: [], handlers: {}, timer: 0,
  supported() { return typeof RTCPeerConnection !== 'undefined' && typeof DecompressionStream !== 'undefined'; },
  on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
  emit(type, data) { for (const fn of this.handlers[type] || []) { try { fn(data); } catch (e) { console.error(e); } } },

  // Hôte : ouvre la partie
  host(name) {
    this.reset(); this.role = 'host'; this.me = { id: rid(), name, host: true };
    this.players = [{ ...this.me, ping: 0 }];
    this.timer = setInterval(() => this.hostTick(), 2000);
    this.emit('roster', this.players);
  },
  // Hôte : prépare une invitation pour un nouveau joueur (QR à faire scanner)
  async createInvite() {
    if (this.peers.size + 1 >= NET_MAX) throw new Error('La partie est complète (' + NET_MAX + ' joueurs maximum).');
    if (this.pending) { try { this.pending.pc.close(); } catch (e) {} }
    const pc = newPC(), dc = pc.createDataChannel('game', { ordered: true }), inv = rid();
    this.pending = { pc, dc, inv };
    this.wire(pc, dc, null);
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    return encodeSignal({ t: 'o', inv, v: NET_VER, host: this.me.name, sdp: pc.localDescription.sdp });
  },
  // Hôte : lit la réponse scannée sur le téléphone de l'invité
  async acceptAnswer(text) {
    const m = await decodeSignal(text);
    if (m.t !== 'a') throw new Error('Ce QR code est une invitation, pas une réponse.');
    if (!this.pending || m.inv !== this.pending.inv) throw new Error('Cette réponse correspond à une autre invitation. Recommence l’invitation.');
    await this.pending.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
    this.pending = null;
  },
  // Invité : lit l'invitation et prépare sa réponse (QR à montrer à l'hôte)
  async join(name, text) {
    const m = await decodeSignal(text);
    if (m.t !== 'o') throw new Error('Ce QR code est une réponse. Scanne l’invitation affichée par l’hôte.');
    if (m.v !== NET_VER) throw new Error('Versions du jeu différentes : recharge la page sur les deux téléphones.');
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
        this.peers.set(msg.id, { pc, dc, name: String(msg.name || 'Joueur').slice(0, 12), ping: 0 });
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
      if (msg.t === 'full') { this.emit('error', 'La partie est déjà complète.'); return; }
      if (msg.t === 'bye') { this.emit('closed', 'L’hôte a fermé la partie.'); this.reset(); return; }
      if (msg.t === 'relay') { this.emit('msg', { from: msg.from, data: msg.data }); return; }
      this.emit('msg', { from: 'host', data: msg });
    }
  },
  idOf(pc) { for (const [id, p] of this.peers) if (p.pc === pc) return id; return null; },
  dropPc(pc) {
    const id = this.idOf(pc); if (!id) return;
    this.peers.delete(id); try { pc.close(); } catch (e) {}
    if (this.role === 'host') { this.syncRoster(); this.emit('leave', id); }
    else { this.emit('closed', 'Connexion perdue avec l’hôte.'); this.reset(); }
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
    this.peers = new Map(); this.pending = null; this.hostPc = null; this.role = null; this.players = [];
  },
};
