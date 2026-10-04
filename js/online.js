// Élémento Defense : multi en ligne entre amis (voir supabase/rooms.sql).
// L'hôte ouvre un salon et invite ses amis en ligne ; l'invité reçoit une fenêtre « X t'invite ! » (60 s).
// Les téléphones se trouvent par le canal Realtime privé du salon, puis se parlent directement (WebRTC, avec des
// serveurs STUN publics pour traverser les box). Si la liaison directe n'aboutit pas en 10 s, les messages du jeu
// passent par le canal Realtime (relais, un peu plus lent). Le reste du jeu (salon, duel, coop) ne voit pas la différence :
// chaque liaison imite le couple (pc, dc) de WebRTC, comme le serveur local de l'APK (js/net.js).
'use strict';

const ICE_ONLINE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
const ONL = { room: null, ch: null, host: false, pcs: new Map(), relays: new Map(), hostRelay: null, last: new Map(), invites: new Map(), joined: new Set(), seen: new Set(), pop: null, popT: 0, busy: false, lastPoll: 0, lastInv: 0 };
const myUid = () => CLOUD.user && CLOUD.user.id;
// Pseudo d'un ami, tel que le serveur le connaît (l'hôte ne croit pas le nom envoyé par l'invité)
function onlineName(uid) { const f = FR.list.find(x => x.id === uid && x.kind === 'friend'); return f ? f.pseudo : null; }

// ---------- Canal du salon ----------
function sig(payload) { if (ONL.ch) ONL.ch.send({ type: 'broadcast', event: 's', payload: Object.assign({ from: myUid() }, payload) }); }
// Deux essais : la toute première connexion au temps réel peut échouer pendant que la session se met en place
async function onlineChannel(room) {
  try { await onlineChannelOnce(room); }
  catch (e) { if (ONL.ch) { CLOUD.sb.removeChannel(ONL.ch).catch(() => {}); ONL.ch = null; } await new Promise(r => setTimeout(r, 1200)); await onlineChannelOnce(room); }
}
function onlineChannelOnce(room) {
  return new Promise((ok, ko) => {
    const ch = CLOUD.sb.channel('room:' + room, { config: { private: true, broadcast: { self: false } } });
    ONL.ch = ch;
    ch.on('broadcast', { event: 's' }, ({ payload }) => { if (ONL.ch === ch && payload) onSignal(payload).catch(() => {}); });
    let done = false;
    ch.subscribe((st, err) => {
      ONL.lastSt = st + (err ? ' ' + err.message : '');
      if (done) return;
      if (st === 'SUBSCRIBED') { done = true; ok(); }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { done = true; ko(new Error(T('Impossible de rejoindre le salon en ligne.'))); }
    });
  });
}
function onlineClose() {
  const ch = ONL.ch, room = ONL.room, host = ONL.host;
  ONL.ch = null; ONL.room = null; ONL.host = false; ONL.hostRelay = null;
  for (const pc of ONL.pcs.values()) { try { pc.close(); } catch (e) {} }
  ONL.pcs.clear(); ONL.relays.clear(); ONL.last.clear(); ONL.invites.clear(); ONL.joined.clear();
  if (ch) CLOUD.sb.removeChannel(ch).catch(() => {});
  if (host && room && frLive()) frRpc('room_close', { p_room: room }).catch(() => {});
}
// Une liaison par le relais Realtime, qui se fait passer pour un canal WebRTC
function relayLink(to) {
  const pc = { relay: to, close: () => { ONL.relays.delete(to); } };
  const dc = { readyState: 'open', send: s => sig({ t: 'r', to, d: s }) };
  return { pc, dc };
}

async function onSignal(m) {
  const me = myUid();
  if (m.to && m.to !== me && m.to !== 'host') return;
  if (m.from) ONL.last.set(m.from, Date.now());
  if (ONL.host) {
    if (m.t === 'hi' && m.from) {
      // Un ami qui revient (après une coupure) : on repart d'une liaison neuve
      const oldPc = ONL.pcs.get(m.from), oldL = ONL.relays.get(m.from);
      if (oldPc) { ONL.pcs.delete(m.from); if (Net.idOf(oldPc)) Net.dropPc(oldPc); else try { oldPc.close(); } catch (e) {} }
      if (oldL) Net.dropPc(oldL.pc);
      const returning = [...Net.peers.values()].some(p => p.away && p.uid === m.from);
      if (!returning && Net.peers.size + 1 >= NET_MAX) return;
      const pc = new RTCPeerConnection({ iceServers: ICE_ONLINE }), dc = pc.createDataChannel('game', { ordered: true });
      pc.uid = m.from; ONL.pcs.set(m.from, pc); ONL.joined.add(m.from);
      Net.wire(pc, dc, null);
      await pc.setLocalDescription(await pc.createOffer());
      await waitIce(pc, 3000);
      sig({ t: 'offer', to: m.from, sdp: pc.localDescription.sdp });
      // Pas de liaison directe au bout de 10 s : relais par le canal du salon
      setTimeout(() => {
        if (ONL.pcs.get(m.from) !== pc || dc.readyState === 'open') return;
        ONL.pcs.delete(m.from); try { pc.close(); } catch (e) {}
        const L = relayLink(m.from); L.pc.uid = m.from; ONL.relays.set(m.from, L);
        sig({ t: 'relay', to: m.from });
      }, 10000);
    } else if (m.t === 'answer' && ONL.pcs.has(m.from)) {
      try { await ONL.pcs.get(m.from).setRemoteDescription({ type: 'answer', sdp: m.sdp }); } catch (e) {}
    } else if (m.t === 'r' && m.to === 'host' && ONL.relays.has(m.from)) {
      const L = ONL.relays.get(m.from); let msg; try { msg = JSON.parse(m.d); } catch (e) { return; }
      Net.receive(L.pc, L.dc, msg);
    }
  } else {
    if (m.t === 'offer' && m.to === me && !Net.hostPc) {
      ONL.hostUid = m.from;
      const pc = new RTCPeerConnection({ iceServers: ICE_ONLINE });
      pc.ondatachannel = ev => Net.wire(pc, ev.channel, 'host');
      Net.hostPc = pc; ONL.pcs.set('host', pc);
      await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIce(pc, 3000);
      sig({ t: 'answer', to: m.from, sdp: pc.localDescription.sdp });
    } else if (m.t === 'relay' && m.to === me) {
      ONL.hostUid = m.from;
      const old = ONL.pcs.get('host'); ONL.pcs.delete('host');
      if (old) { old.onconnectionstatechange = null; try { old.close(); } catch (e) {} }
      const L = relayLink('host'); L.dc.send = s => sig({ t: 'r', to: 'host', d: s }); L.pc.relay = 'host';
      ONL.hostRelay = L; Net.hostPc = L.pc; Net.peers.set('host', L);
      Net.sendTo('host', { t: 'hello', id: Net.me.id, name: Net.me.name, v: NET_VER });
    } else if (m.t === 'r' && m.to === me && ONL.hostRelay) {
      let msg; try { msg = JSON.parse(m.d); } catch (e) { return; }
      Net.receive(ONL.hostRelay.pc, ONL.hostRelay.dc, msg);
    }
  }
}
// Relais : sans nouvelles depuis 15 s, la liaison est perdue (WebRTC le détecte tout seul)
setInterval(() => {
  if (!ONL.ch) return;
  const now = Date.now();
  if (ONL.host) for (const [uid, L] of ONL.relays) { if (now - (ONL.last.get(uid) || now) > 15e3) Net.dropPc(L.pc); }
  else if (ONL.hostRelay && now - (ONL.last.get(ONL.hostUid) || now) > 15e3) Net.dropPc(ONL.hostRelay.pc);
}, 3000);

// ---------- Reconnexion (coupure de réseau en pleine partie) ----------
// L'invité redemande une liaison à l'hôte par le canal du salon, toutes les 3 s, tant qu'il n'est pas revenu
// (Net lui laisse 25 s ; l'hôte lui garde sa place 20 s).
function onlineRejoin() {
  if (!ONL.ch || ONL.host) return;
  const old = ONL.pcs.get('host'); ONL.pcs.delete('host'); if (old) { try { old.close(); } catch (e) {} }
  ONL.hostRelay = null; Net.hostPc = null;
  clearInterval(ONL.rejoinT);
  const ask = () => { if (!Net.reconnecting || !ONL.ch) { clearInterval(ONL.rejoinT); return; } if (!Net.hostPc) sig({ t: 'hi', pid: Net.me.id }); };
  ask(); ONL.rejoinT = setInterval(ask, 3000);
}
// Coupure plus rapide à voir que par WebRTC : sans message depuis 8 s, la liaison est considérée comme perdue
setInterval(() => {
  if (!Net.online || !Net.role) return;
  const now = performance.now();
  if (Net.role === 'host') { for (const p of [...Net.peers.values()]) if (!p.away && p.last && now - p.last > 8000) Net.dropPc(p.pc); }
  else if (!Net.reconnecting && Net.peers.has('host') && Net.hostLast && now - Net.hostLast > 8000) Net.dropPc(Net.peers.get('host').pc);
}, 2000);
const nameOf = id => { const p = Net.players.find(x => x.id === id) || Net.peers.get(id); return (p && p.name) || T('Un joueur'); };
Net.on('away', id => hint(nameOf(id) + T(' a perdu la connexion… on l’attend 20 s'), 3000));
Net.on('back', id => { if (id === 'host') { $('#reconnBox').hidden = true; hint(T('Reconnecté !'), 1800); } else { hint(nameOf(id) + T(' est de retour !'), 2200); if (typeof COOP !== 'undefined' && COOP.on) COOP.towerSig = ''; } });
Net.on('reconnecting', () => { $('#reconnBox').hidden = false; });
Net.on('closed', () => { $('#reconnBox').hidden = true; });

// ---------- Hôte : salon et invitations ----------
async function onlineCreate() {
  if (!frLive()) { hint(T('Il faut internet pour jouer en ligne.'), 2000); return false; }
  if (typeof timeUp === 'function' && timeUp()) { showTimeUp(); return false; }
  Net.host(cleanPseudo(), { online: true }); keepAwake();
  try {
    const room = await frRpc('room_create');
    ONL.room = room; ONL.host = true;
    await onlineChannel(room);
    return true;
  } catch (e) { Net.reset(); mpGo('home', { tab: 'online', err: T('Impossible d’ouvrir un salon en ligne. Réessaie.') }); return false; }
}
const INV_ERR = { no_room: 'Le salon est fermé.', not_friend: 'Ce joueur n’est plus dans tes amis.', too_many: 'Trop d’invitations : attends une minute.' };
async function onlineInvite(uid) {
  if (!ONL.host || !ONL.room) return;
  try {
    const r = await frRpc('invite_send', { p_room: ONL.room, p_to: uid, p_mode: DUEL.lobbyMode || 'duel', p_map: DUEL.lobbyMap || 0, p_diff: DUEL.lobbyDiff || 'moyen' });
    if (r && r.err) { hint(T(INV_ERR[r.err] || 'Oups, ça n’a pas marché. Réessaie.'), 2200); return; }
    ONL.invites.set(uid, { status: 'pending', secs: 60, at: Date.now() });
  } catch (e) { hint(T('Oups, ça n’a pas marché. Réessaie.'), 1800); }
  paintOnlineFriends();
}
// Depuis la page Amis : ouvre un salon (si besoin) et invite cet ami
async function inviteFriend(uid) {
  if (!(Net.role === 'host' && Net.online)) {
    if (Net.role) { hint(T('Tu es déjà dans une partie à plusieurs.'), 2000); return; }
    show('multi'); screens.multi.scrollTop = 0;
    mpGo('busy', { busyText: T('Ouverture du salon…') });
    if (!(await onlineCreate())) return;
  } else show('multi');
  mpGo('host');
  onlineInvite(uid);
}
// Suivi des invitations envoyées (toutes les 3 s dans le salon)
async function pollRoomInvites() {
  if (!ONL.host || !ONL.room || !frLive() || MP.state !== 'host') return;
  try {
    const rows = await frRpc('room_invites', { p_room: ONL.room });
    for (const r of rows || []) ONL.invites.set(r.to_user, { status: r.status, secs: r.secs, at: Date.now() });
    paintOnlineFriends();
  } catch (e) {}
}
function onlineFriendsHTML() {
  const inRoom = new Set(Net.players.map(p => { const pe = Net.peers.get(p.id); return pe && pe.uid; }).filter(Boolean));
  const list = FR.list.filter(f => f.kind === 'friend').sort((a, b) => (b.online - a.online) || a.pseudo.localeCompare(b.pseudo));
  if (!list.length) return '<p class="fine">' + T('Pas encore d’amis : ajoute-en depuis la page Amis de l’accueil.') + '</p>';
  const full = Net.players.length >= NET_MAX;
  return list.map(f => {
    const inv = ONL.invites.get(f.id), left = inv ? Math.max(0, inv.secs - Math.round((Date.now() - inv.at) / 1000)) : 0;
    let sub, btn = '';
    if (inRoom.has(f.id)) sub = T('Dans le salon !');
    else if (inv && inv.status === 'pending' && left > 0) sub = T('Invitation envoyée… ') + left + ' s';
    else if (inv && inv.status === 'accepted') sub = T('Arrive…');
    else {
      sub = inv && inv.status === 'declined' ? T('Non merci') : inv && (inv.status === 'expired' || inv.status === 'pending') ? T('Pas de réponse') : frStatus(f);
      if (f.online && f.state !== 'game' && !full) btn = frBtn('oinv', T('Inviter'), 'inv');
    }
    return frRow(f, btn, sub);
  }).join('');
}
function paintOnlineFriends() {
  const box = $('#onlFriends'); if (!box) return;
  box.innerHTML = onlineFriendsHTML(); frAvatars(box);
  box.querySelectorAll('[data-act="oinv"]').forEach(b => b.addEventListener('click', () => onlineInvite(b.closest('.frrow').dataset.id)));
}

// Onglet « En ligne » de l'écran Multijoueur
function onlineHomeHTML() {
  const fr = FR.list.filter(f => f.kind === 'friend'), on = fr.filter(f => f.online).length, live = frLive();
  return '<p class="trnote">' + T('Joue avec tes amis, <b>où qu’ils soient</b>. Ouvre un salon, puis invite tes amis en ligne : ils reçoivent l’invitation sur leur téléphone.') + '</p>'
    + '<p class="fine">' + T('Ton pseudo : ') + '<b>' + esc(cleanPseudo()) + '</b>' + T(' (modifiable dans le Profil)') + '</p>'
    + (!live ? '<p class="mp-err">' + T('Il faut internet pour jouer en ligne.') + '</p>' : '')
    + '<p class="fine">' + (fr.length ? T('Amis en ligne : ') + on + ' / ' + fr.length : T('Pas encore d’amis : ajoute-en depuis la page Amis de l’accueil.')) + '</p>'
    + '<button class="btn" type="button" data-a="ocreate"' + (live && fr.length ? '' : ' disabled') + '>' + T('Créer un salon en ligne') + '</button>';
}

// ---------- Invité : fenêtre d'invitation, puis connexion ----------
async function pollInvites() {
  if (!frLive() || document.visibilityState !== 'visible' || Net.role || ONL.pop || ONL.busy) return;
  if ((G && curScreen === 'game' && !G.over) || curScreen === 'parents' || curScreen === 'tuto') return;
  try {
    const rows = await frRpc('invites_pending');
    const r = (rows || []).find(x => !ONL.seen.has(x.id));
    if (r) showInvite(r);
  } catch (e) {}
}
function showInvite(r) {
  ONL.pop = r; ONL.seen.add(r.id);
  const info = r.info || {}, m = MAPS[info.map] || MAPS[0], box = $('#invPop');
  $('#ipName').textContent = r.pseudo + T(' t’invite !');
  $('#ipPills').innerHTML = '<span class="pill">' + (info.mode === 'coop' ? T('🤝 Coop') : T('⚔️ Duel')) + '</span><span class="pill">🗺️ ' + esc(m.random ? T('Carte aléatoire') : m.name) + '</span>'
    + (info.mode === 'coop' && DIFFS[info.diff] ? '<span class="pill">' + esc(DIFFS[info.diff].name) + '</span>' : '');
  const cv = $('#ipAv'); cv.dataset.av = r.avatar || 'feu'; cv.dataset.size = 64; frAvatars(box);
  const end = Date.now() + r.secs * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    $('#ipSecs').textContent = left; $('#ipRing').style.setProperty('--p', Math.round(left / 60 * 100));
    if (!left) closeInvite();
  };
  clearInterval(ONL.popT); ONL.popT = setInterval(tick, 250); tick();
  box.hidden = false; Snd.play('clear'); try { navigator.vibrate && navigator.vibrate([80, 60, 80]); } catch (e) {}
}
function closeInvite() { clearInterval(ONL.popT); $('#invPop').hidden = true; ONL.pop = null; }
$('#ipNo').addEventListener('click', () => { const r = ONL.pop; closeInvite(); if (r) frRpc('invite_respond', { p_id: r.id, p_accept: false }).catch(() => {}); });
$('#ipYes').addEventListener('click', async () => {
  const r = ONL.pop; closeInvite(); if (!r) return;
  if (typeof timeUp === 'function' && timeUp()) { frRpc('invite_respond', { p_id: r.id, p_accept: false }).catch(() => {}); showTimeUp(); return; }
  Snd.init(); ONL.busy = true;
  show('multi'); screens.multi.scrollTop = 0;
  mpGo('busy', { busyText: T('Connexion à la partie de ') + r.pseudo + '…', lanJoin: true });
  try {
    const res = await frRpc('invite_respond', { p_id: r.id, p_accept: true });
    if (!res || !res.room) throw new Error(T('Trop tard : l’invitation n’est plus valable.'));
    await onlineJoin(res.room);
  } catch (e) { Net.reset(); mpGo('home', { tab: 'online', err: e.message || T('Impossible de rejoindre la partie.') }); }
  finally { ONL.busy = false; }
});
async function onlineJoin(room) {
  Net.reset(); Net.role = 'guest'; Net.online = true; Net.me = { id: rid(), name: cleanPseudo(), host: false };
  ONL.room = room; ONL.host = false; keepAwake();
  await onlineChannel(room);
  sig({ t: 'hi', pid: Net.me.id });
  mpTimer = setTimeout(() => { if (MP.state === 'busy' && Net.online && Net.role === 'guest') { Net.reset(); mpGo('home', { tab: 'online', err: T('La connexion n’a pas abouti. Réessaie avec une nouvelle invitation.') }); } }, 30000);
}
setInterval(() => { pollInvites(); }, 4000);
setInterval(() => { pollRoomInvites(); }, 3000);
