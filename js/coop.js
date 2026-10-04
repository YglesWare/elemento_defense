// Élémento Defense : coop multijoueur (2 à 4 joueurs sur la même carte).
// L'hôte simule la partie et fait foi ; les invités envoient leurs actions et affichent l'état reçu ~8 fois par seconde.
// Comme en duel, tout le monde repart de zéro (Atelier vierge, progression solo intacte) ; l'or des ennemis est partagé à parts égales.
// Chacun achète ses propres améliorations pendant la partie : les tours suivent l'Atelier (temporaire) de leur propriétaire.
'use strict';

const COOP = { on: false, ids: [], names: {}, lvs: {}, gold: {}, frac: {}, actor: null, gone: new Set(), snapT: 0, lastSnap: 0, towerSig: '', pingHold: null, pings: [] };
const COOP_COLORS = ['#ff4f81', '#3fa9ff', '#4fd36a', '#ffb03d'];
const coopMe = () => (Net.me && Net.me.id) || 'solo';
const coopActor = () => COOP.actor || coopMe();
const coopLv = id => (id === coopMe() ? meta.lv : COOP.lvs[id]) || {};
const coopName = id => COOP.names[id] || T('Joueur');
const coopColor = id => COOP_COLORS[Math.max(0, COOP.ids.indexOf(id)) % 4];
const coopActive = () => COOP.ids.filter(id => !COOP.gone.has(id));
const isHostCoop = () => G && G.coop && !G.coopGuest;

// ---------- Portefeuilles (l'hôte tient ceux de tout le monde ; le sien est G.gold) ----------
const wallet = id => (id === coopMe() ? G.gold : COOP.gold[id] || 0);
function setWallet(id, v) { if (id === coopMe()) G.gold = v; else COOP.gold[id] = v; }
function addGold(id, v) {
  const f = (COOP.frac[id] || 0) + v, whole = Math.floor(f);
  COOP.frac[id] = f - whole; setWallet(id, wallet(id) + whole);
}
// Butin d'un ennemi : la cagnotte de l'équipe grossit avec le nombre de joueurs, puis chacun reçoit sa part (avec son bonus « Butin »)
function coopLoot(base) {
  const ids = coopActive(), n = Math.max(1, ids.length), share = base * (1 + 0.5 * (G.coopN - 1)) / n;
  let mine = 0;
  for (const id of ids) { const v = share * (1 + 0.06 * lvOf(coopLv(id), 'loot')); addGold(id, v); if (id === coopMe()) mine = v; }
  return Math.max(1, Math.round(mine));
}
function coopGiveAll(v) { for (const id of coopActive()) addGold(id, v); }
// Exécute une action pour le compte d'un joueur : son or et ses améliorations le temps de l'action
function asPlayer(id, fn) {
  const g = G.gold, lv = meta.lv;
  G.gold = wallet(id); meta.lv = coopLv(id); COOP.actor = id;
  try { return fn(); } finally { const v = G.gold; meta.lv = lv; COOP.actor = null; G.gold = g; setWallet(id, v); }
}

// ---------- Lancement ----------
function coopHostStart() {
  if (Net.role !== 'host') return;
  if (Net.players.length < 2) { MP.err = T('Il faut au moins 2 joueurs pour lancer la partie.'); renderMP(); return; }
  const rm = MAPS[DUEL.lobbyMap] && MAPS[DUEL.lobbyMap].random ? { size: DUEL.lobbySize || 'moyenne', seed: newSeed() } : null;
  const msg = { k: 'cstart', map: DUEL.lobbyMap, rnd: rm, diff: DUEL.lobbyDiff || 'moyen', ids: Net.players.map(p => p.id), names: Object.fromEntries(Net.players.map(p => [p.id, p.name])) };
  Net.send('all', msg);
  beginCoop(msg);
}
function beginCoop(msg) {
  stopScan && stopScan();
  Object.assign(COOP, { on: true, ids: msg.ids, names: msg.names, gold: {}, frac: {}, gone: new Set(), snapT: 0, lastSnap: performance.now(), towerSig: '', pings: [] });
  if (msg.rnd) msg.map = makeRandom(msg.rnd.size, msg.rnd.seed);
  const host = Net.role === 'host';
  enterDuelMeta(); COOP.lvs = {}; COOP.lvSent = '{}';
  newGame(msg.map, null, msg.diff);
  Object.assign(G, { hpd: DIFFS[G.diff].coopHp || DIFFS[G.diff].hp, coop: true, coopGuest: !host, coopN: msg.ids.length, coopHp: 1 + 0.5 * (msg.ids.length - 1), speed: 1 });
  if (host) {
    for (const id of msg.ids) if (id !== coopMe()) COOP.gold[id] = DIFFS[G.diff].gold;
    prepNextWave();
  } else { G.towers = []; G.nextWave = null; G.spawnQ = []; }
  $('#bSpeed').hidden = !host; $('#bSpeed').textContent = 'x1';
  $('#stage').classList.add('duel'); resize();
  renderCoopBar();
  banner('COOP !', COOP.ids.length + T(' joueurs · ') + MAPS[G.map].name + ' · ' + DIFFS[G.diff].name);
  hint(T('Tout le monde repart de zéro. Vos tours ont un anneau de votre couleur et l’or des ennemis est partagé. Touche un coéquipier en haut pour lui donner 50 or. Appui long sur la carte : ping.'), 6500);
}
const hostOf = () => { const h = Net.players.find(p => p.host); return h ? h.id : 'host'; };

// ---------- Actions des invités (traitées par l'hôte) ----------
function coopAct(act) {
  if (!G || !G.coop || G.over) return;
  if (G.coopGuest) Net.send(hostOf(), Object.assign({ k: 'cact' }, act));
  else hostAction(coopMe(), act);
}
function hostAction(pid, a) {
  if (!isHostCoop() || G.over || COOP.gone.has(pid)) return;
  const tw = id => G.towers.find(t => t.id === id);
  const own = t => t && t.own === pid;
  if (a.a === 'wave') { startWave(); return; }
  if (a.a === 'give') {
    const to = a.to, v = Math.min(50, wallet(pid));
    if (!COOP.ids.includes(to) || to === pid || v <= 0 || COOP.gone.has(to)) return;
    setWallet(pid, wallet(pid) - v); setWallet(to, wallet(to) + v);
    coopNotice('give', { p: pid, v, to });
    return;
  }
  asPlayer(pid, () => {
    if (a.a === 'build') {
      const type = a.type, q = a.q | 0, r = a.r | 0;
      if (!TOWERS[type] || TOWERS[type].fusion || !unlocked(type) || !canBuild(q, r) || G.gold < costOf(type)) return;
      G.gold -= costOf(type);
      const t = addTower(type, q, r); t.recoil = 1;
      burst(t.x, t.y, 0.1, 12, ['#ffffff', '#f1eafa', TOWERS[type].color], 2.2, 0.09, 3, 0.5, 'star'); Snd.play('build');
    } else if (a.a === 'up') {
      const t = tw(a.id); if (!own(t)) return;
      const cost = upCost(t); if (!cost || G.gold < cost) return;
      const fus = TOWERS[t.type].fusion;
      if (t.lvl === 2 && !t.br && !fus && !BRANCH[a.br]) return;
      if (a.br && t.br && a.br !== t.br) return;
      G.gold -= cost; t.lvl++; if (t.lvl >= 3 && !t.br && !fus) t.br = a.br; t.inv += cost; t.s = towerStats(t); t.recoil = 1; if (!(t.ko > 0)) healTower(t, !hardMode());
      burst(t.x, t.y, 0.4, 16, ['#ffd23f', '#ffffff', TOWERS[t.type].color], 2.6, 0.1, 2, 0.7, 'star'); Snd.play('up');
    } else if (a.a === 'sell') {
      const t = tw(a.id); if (!own(t)) return;
      G.gold += sellValue(t); G.towers = G.towers.filter(x => x !== t);
      if (G.selTower === t) deselect();
      burst(t.x, t.y, 0.3, 12, ['#cdbfe0', '#ffffff', '#ffd23f'], 2, 0.09, 3, 0.5); Snd.play('sell');
    } else if (a.a === 'heal') {
      const t = tw(a.id); if (!own(t)) return;
      const cost = healCost(t); if (!cost || G.gold < cost || !hardMode()) return;
      G.gold -= cost; t.hp = t.maxHp; burst(t.x, t.y, 0.4, 12, ['#5cd86a', '#ffffff', '#b8f5c0'], 2.2, 0.08, 2, 0.6, 'star'); Snd.play('up');
    } else if (a.a === 'mode') {
      const t = tw(a.id); if (own(t) && MODES.includes(a.mode)) t.mode = a.mode;
    } else if (a.a === 'fuse') {
      const src = tw(a.src), dst = tw(a.dst); if (!own(src) || !own(dst) || src === dst) return;
      const r = fuseCheck(src, dst); if (!r.ok) return;
      const F = TOWERS[r.k]; G.gold -= F.fee;
      G.towers = G.towers.filter(x => x !== src && x !== dst);
      if (G.selTower === src || G.selTower === dst) deselect();
      const nt = addTower(r.k, dst.c, dst.r, 1, dst.mode, src.inv + dst.inv + F.fee); nt.recoil = 1;
      G.fx.push({ kind: 'ring', gx: dst.x, gy: dst.y, r0: 0.2, r1: 2.2, t: 0, dur: 0.6, color: '#ff6ad5' });
      ono('FUSION !', dst.x, dst.y, '#ff6ad5', 0.8, 0, 1.1); Snd.play('win');
    }
  });
}
// Annonces aux joueurs : un code et des nombres, jamais de texte (chaque téléphone écrit le message lui-même :
// en ligne, un jeu modifié ne peut pas faire afficher n'importe quoi chez les autres)
const NOTICE = {
  give: d => coopName(d.p) + T(' donne ') + d.v + T(' or à ') + coopName(d.to),
  left: d => coopName(d.p) + T(' a quitté la partie') + (d.v ? T(' : son or (') + d.v + T(') est partagé') : '') + T('. Ses tours continuent de tirer.'),
};
function coopNotice(kind, d) { const f = NOTICE[kind]; if (!f) return; hint(f(d), 2200); Net.send('all', { k: 'cmsg', kind, d: { p: d.p, v: Math.round(+d.v || 0), to: d.to } }); }

// ---------- État envoyé par l'hôte ----------
const towerSig = () => G.towers.map(t => [t.id, t.type, t.lvl, t.br || '', t.mode, t.own].join(':')).join('|') + '#' + (G.ruins || []).length;
function sendTowers() {
  Net.send('all', { k: 'ct', t: G.towers.map(t => ({ id: t.id, type: t.type, c: t.c, r: t.r, lvl: t.lvl, br: t.br, mode: t.mode, inv: t.inv, own: t.own, rg: +t.s.range.toFixed(2), rt: +t.s.rate.toFixed(3), air: !!t.s.air })), ru: G.ruins || [] });
}
function sendSnapshot() {
  const fl = e => (e.frozen > 0 ? 1 : 0) | (e.stun > 0 ? 2 : 0) | (e.burnT > 0 ? 4 : 0) | (e.wet > 0 ? 8 : 0) | (e.ghost > 0 ? 16 : 0);
  const g = {}; for (const id of COOP.ids) g[id] = Math.floor(wallet(id));
  Net.send('all', {
    k: 'cs', lv: G.lives, w: G.wave, wa: G.waveActive, sq: G.spawnQ.length, sc: G.score, bk: G.bossKills, wx: G.weather, sp: G.speed, pz: !!G.paused,
    ch: G.chronoT == null ? null : +G.chronoT.toFixed(1), at: +(G.autoT || 0).toFixed(1), g,
    e: G.enemies.filter(e => !e.dead).map(e => [e.id, e.type, e.pi || 0, Math.round(e.d * 100), Math.round(e.hp), Math.round(e.maxHp), fl(e), Math.round(e.speed * 100), Math.round(e.slowA * 100)]),
    t: G.towers.map(t => [t.id, Math.round(t.hp), Math.round(t.maxHp), t.ko > 0 ? 1 : 0, t.stun > 0 ? 1 : 0, t.evil > 0 ? 1 : 0, Math.round(t.shield || 0)]),
  });
}
function coopNextWave() {
  const nw = G.nextWave;
  Net.send('all', { k: 'cnw', nw: nw ? { n: nw.n, list: nw.list.map(it => ({ type: it.type })), label: nw.label, weather: nw.weather, portals: nw.portals } : null });
}
function coopWaveStart(early, label) { Net.send('all', { k: 'cws', n: G.wave, early, label, portals: G.curPortals }); }
// Fin de vague : chacun reçoit sa prime selon son Atelier ; les éclats sont calculés sur chaque téléphone
function coopWaveDone() {
  for (const id of coopActive()) if (id !== coopMe()) addGold(id, Math.round((10 + G.wave) * (1 + 0.2 * lvOf(coopLv(id), 'bonus'))));
  Net.send('all', { k: 'cwd', n: G.wave, sc: G.score + G.wave * 50, bk: G.bossKills });
}

// ---------- Réception côté invité ----------
function applyTowers(list) {
  const keep = new Map(G.towers.map(t => [t.id, t])), next = [];
  for (const d of list) {
    let t = keep.get(d.id);
    if (!t || t.type !== d.type) {
      COOP.actor = d.own; t = addTower(d.type, d.c, d.r, d.lvl, d.mode, d.inv, d.br); COOP.actor = null;
      G.towers.pop(); t.id = d.id; t.recoil = 1;
      burst(t.x, t.y, 0.1, 10, ['#ffffff', '#f1eafa', TOWERS[d.type].color], 2.2, 0.09, 3, 0.5, 'star');
      if (d.own === coopMe()) Snd.play('build');
    } else if (t.lvl !== d.lvl || t.br !== d.br) {
      t.lvl = d.lvl; t.br = d.br; t.recoil = 1; t.s = towerStats(t);
      if (d.own === coopMe()) Snd.play('up');
    }
    Object.assign(t, { mode: d.mode, inv: d.inv, own: d.own });
    t.s.range = d.rg; t.s.rate = d.rt; t.s.air = d.air;
    next.push(t);
  }
  for (const t of G.towers) if (!next.includes(t)) { burst(t.x, t.y, 0.3, 10, ['#cdbfe0', '#ffffff', '#ffd23f'], 2, 0.09, 3, 0.5); if (G.selTower === t) deselect(); }
  G.towers = next;
  if (G.selTower) { hudCache.info = null; refreshInfo(); }
}
function applySnapshot(s) {
  COOP.lastSnap = performance.now();
  if (s.wx && s.wx !== G.weather) setWeather(s.wx);
  if (!!s.pz !== !!G.hostPause) hint(s.pz ? T('⏸ L’hôte a mis la partie en pause') : T('▶ La partie reprend'), 2000);
  Object.assign(G, { lives: s.lv, wave: s.w, waveActive: s.wa, score: s.sc, bossKills: s.bk, speed: s.sp || 1, hostPause: s.pz, chronoT: s.ch, autoT: s.at });
  G.gold = s.g[coopMe()] != null ? s.g[coopMe()] : G.gold;
  COOP.gold = s.g;
  G.spawnQ.length = s.sq;
  const byId = new Map(G.enemies.map(e => [e.id, e])), seen = new Set();
  for (const [id, type, pi, d100, hp, mhp, fl, sp100, sl] of s.e) {
    if (!ETYPES[type]) continue;
    let e = byId.get(id);
    const d = d100 / 100;
    if (!e) { const n = G.enemies.length; spawn(type, pi); e = G.enemies[n]; if (!e) continue; e.id = id; e.d = d; }
    else if (Math.abs(e.d - d) > 1.2) e.d = d; else e.d += (d - e.d) * 0.5;
    Object.assign(e, { hp, maxHp: mhp, speed: sp100 / 100, slowA: sl / 100, slowT: sl ? 0.5 : 0 });
    e.frozen = fl & 1 ? Math.max(e.frozen, 0.25) : 0; e.stun = fl & 2 ? Math.max(e.stun, 0.25) : 0;
    e.burnT = fl & 4 ? Math.max(e.burnT, 0.25) : 0; e.wet = fl & 8 ? Math.max(e.wet, 0.25) : e.wet; e.ghost = fl & 16 ? Math.max(e.ghost || 0, 0.25) : 0;
    setPos(e); seen.add(id);
  }
  for (const e of G.enemies) if (!seen.has(e.id) && !e.dead) {
    e.dead = true;
    if (e.d < PP(e).goal - 0.4) { const D = ETYPES[e.type]; burst(e.x, e.y, (e.flying ? FLY : 0) + 0.25, D.boss ? 40 : 10, [D.color, D.light, '#ffffff'], D.boss ? 4 : 2.4, D.boss ? 0.14 : 0.09, 4, 0.6); Snd.play(D.boss ? 'boom' : 'pop'); }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
  const byT = new Map(G.towers.map(t => [t.id, t]));
  for (const [id, hp, mhp, ko, stun, evil, sh] of s.t) { const t = byT.get(id); if (!t) continue; Object.assign(t, { hp, maxHp: mhp, ko: ko ? Math.max(t.ko || 0, 0.3) : 0, stun: stun ? Math.max(t.stun || 0, 0.3) : 0, evil: evil ? Math.max(t.evil || 0, 0.3) : 0, shield: sh }); }
}

// ---------- Boucle ----------
function coopTick(dt) {
  if (!COOP.on || !G || !G.coop) return;
  const now = performance.now();
  if (!G.coopGuest) {
    const sig = towerSig(); if (sig !== COOP.towerSig) { COOP.towerSig = sig; sendTowers(); }
    COOP.snapT -= dt; if (COOP.snapT <= 0 && !G.over) { COOP.snapT = 0.125; sendSnapshot(); }
  } else {
    // En ligne, la reconnexion a 25 s (js/net.js) : la fin de partie viendra de Net si elle échoue
    if (!G.over && !Net.reconnecting && now - COOP.lastSnap > (Net.online ? 30000 : 8000)) coopFinish(false, T('La connexion avec l’hôte est perdue. La partie s’arrête.'));
    // Achats dans l'Atelier pendant la partie : l'hôte en a besoin pour calculer nos tours
    const lv = JSON.stringify(meta.lv); if (lv !== COOP.lvSent) { COOP.lvSent = lv; Net.send(hostOf(), { k: 'clv', lv: meta.lv }); }
  }
  COOP.pings = COOP.pings.filter(p => (p.t += dt) < 2.4);
  COOP.uiT = (COOP.uiT || 0) - dt; if (COOP.uiT <= 0) { COOP.uiT = 0.3; renderCoopBar(); }
}

// ---------- Bandeau des joueurs (toucher un coéquipier : lui donner 50 or) ----------
function renderCoopBar() {
  const bar = $('#duelBar'); if (!COOP.on || !G || !G.coop) return;
  bar.hidden = false;
  const html = COOP.ids.map(id => {
    const me = id === coopMe(), gone = COOP.gone.has(id), g = me ? G.gold : (G.coopGuest ? (COOP.gold || {})[id] : wallet(id));
    return '<button type="button" class="dp coopp' + (gone ? ' dead' : '') + '" data-id="' + id + '"' + (me ? ' disabled' : '') + '><i style="background:' + coopColor(id) + '"></i>' + esc(coopName(id)) + (me ? ' (toi)' : '') + ' <span>' + COIN + fmtK(Math.floor(g || 0)) + '</span>' + (me || gone ? '' : ' <span class="dinc">+50</span>') + '</button>';
  }).join('');
  if (bar._h !== html) { bar._h = html; bar.innerHTML = html; }
}
$('#duelBar').addEventListener('click', ev => {
  if (!COOP.on) return;
  const b = ev.target.closest('.coopp'); if (!b || b.disabled || COOP.gone.has(b.dataset.id)) return;
  if (G.gold < 1) { hint(T('Tu n’as pas d’or à donner')); Snd.play('no'); return; }
  coopAct({ a: 'give', to: b.dataset.id }); Snd.play('sell');
  hint(T('Tu donnes ') + Math.min(50, G.gold) + T(' or à ') + coopName(b.dataset.id), 1600);
}, true);

// ---------- Pings : appui long sur la carte ----------
cv.addEventListener('pointerdown', ev => {
  if (!G || !G.coop || G.over) return;
  const [px, py] = cvPos(ev);
  clearTimeout(COOP.pingHold);
  COOP.pingHold = setTimeout(() => { const [gx, gy] = toGridF(px, py); Net.send('all', { k: 'cping', x: gx, y: gy }); addPing(coopMe(), gx, gy); }, 550);
});
for (const t of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(t, () => clearTimeout(COOP.pingHold));
cv.addEventListener('pointermove', ev => { if (COOP.pingHold && Math.abs(ev.movementX) + Math.abs(ev.movementY) > 6) clearTimeout(COOP.pingHold); });
function addPing(id, x, y) { COOP.pings.push({ id, x, y, t: 0 }); Snd.play('build'); try { navigator.vibrate && navigator.vibrate(20); } catch (e) {} }
function drawPings(c) {
  for (const p of COOP.pings) {
    const [x, y] = toScreen(p.x, p.y), k = (p.t % 0.8) / 0.8, col = coopColor(p.id);
    c.save(); c.globalAlpha = Math.min(1, (2.4 - p.t) / 0.4);
    c.beginPath(); c.arc(x, y, L.cs * (0.3 + k * 0.9), 0, TAU); c.lineWidth = 3; c.strokeStyle = col; c.globalAlpha *= 1 - k; c.stroke();
    c.globalAlpha = Math.min(1, (2.4 - p.t) / 0.4);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - L.cs * 0.25, y - L.cs * 0.6); c.lineTo(x + L.cs * 0.25, y - L.cs * 0.6); c.closePath(); fs(c, col, 2);
    pill(c, coopName(p.id), x, y - L.cs * 0.7, false, col, '#ffffff');
    c.restore();
  }
}

// ---------- Fin de partie ----------
// Victoire : tout l'or ; K.O. (ou partie interrompue) : la moitié ; abandon de son plein gré : rien
function coopEnd(win) {
  if (!isHostCoop() || G.over) return;
  Net.send('all', { k: 'cend', win });
  coopFinish(win);
}
function coopFinish(win, text, quit) {
  if (!G || !G.coop || G.coopDone) return;
  G.coopDone = true; G.over = true; G.won = !!win; G.paused = true;
  if (win && typeof trophy === 'function') trophy('coop_win');
  Snd.play(win ? 'win' : quit ? 'clear' : 'ko');
  setTimeout(() => {
    if (!G || !G.coop) return;
    // Partie coop : comme en duel, rien n'est versé à la progression solo
    showOver(!!win, { wave: G.wave }, null, { gain: 0, total: soloMeta ? soloMeta.bank || 0 : meta.bank || 0 }, !!quit, 0);
    $('#oRetry').hidden = true; $('#oEndless').hidden = true;
    $('#oWord').textContent = quit ? 'ABANDON' : win ? T('VICTOIRE !!') : 'K.O. !';
    $('#oText').textContent = text || (win ? T('Toute l’équipe a tenu : bravo !') : quit ? T('Tu as quitté la partie coop.') : T('La maison est tombée. Retentez votre chance ensemble !'));
    $('#oBank').textContent = '—'; $('#oShards').textContent = '—';
    $('#oBankDetail').textContent = T('Partie coop : tout le monde repart de zéro, ta cagnotte et ton Atelier solo ne changent pas.');
    $('#oGainDetail').textContent = T('Les éclats gagnés pendant la partie ne servaient qu’à cette partie.');
    $('#oMenu').textContent = T('Retour au salon');
  }, win ? 300 : 1100);
}
function coopQuit() {
  if (!G || !G.coop || G.over) return;
  if (G.coopGuest) { Net.send(hostOf(), { k: 'cquit' }); coopFinish(false, null, true); return; }
  // L'hôte quitte : la partie s'arrête pour tout le monde (les invités gardent les règles du K.O.)
  Net.send('all', { k: 'cend', win: false, why: 'hostquit', p: coopMe() });
  coopFinish(false, null, true);
}
function playerGone(id) {
  if (!isHostCoop() || COOP.gone.has(id) || !COOP.ids.includes(id)) return;
  COOP.gone.add(id);
  const left = coopActive(), v = wallet(id); setWallet(id, 0);
  for (const o of left) addGold(o, v / left.length);
  coopNotice('left', { p: id, v });
}
function leaveCoop() {
  COOP.on = false; clearTimeout(COOP.pingHold); exitDuelMeta(); $('#stage').classList.remove('duel');
  $('#bSpeed').hidden = false; $('#duelBar').hidden = true; $('#duelBar')._h = '';
  $('#oRetry').hidden = false; $('#oMenu').textContent = 'Menu';
  G = null;
}
// « Retour au salon » à la place de « Menu » après une partie coop
document.addEventListener('click', ev => {
  if (!COOP.on || !ev.target.closest('#oMenu')) return;
  ev.stopPropagation(); ev.preventDefault();
  leaveCoop(); if (Net.role) openMulti(); else show('title');
}, true);
// Menu pause : en coop, « Abandonner » quitte la partie (et l'arrête pour tous si c'est l'hôte)
document.addEventListener('click', ev => {
  if (!COOP.on || !G || !G.coop || !ev.target.closest('#pCash')) return;
  ev.stopPropagation(); ev.preventDefault();
  const b = $('#pCash');
  if (!COOP.quitArm) { COOP.quitArm = true; b.textContent = G.coopGuest ? T('Sûr ? Touche encore pour quitter') : T('Sûr ? La partie s’arrête pour tous'); return; }
  COOP.quitArm = false; coopQuit();
}, true);
function coopPauseUI() {
  if (!G || !G.coop) return;
  COOP.quitArm = false;
  $('#pQuit').hidden = true; $('#pAuto').hidden = G.coopGuest; $('#pCash').hidden = false;
  $('#pCash').textContent = G.coopGuest ? T('Quitter la partie coop') : T('Arrêter la partie (pour tous)');
  $('#pCash').classList.add('pink'); $('#pCash').classList.remove('alt');
  $('#pSave').textContent = T('Partie coop · ') + COOP.ids.length + T(' joueurs · ') + MAPS[G.map].name + ' · ' + DIFFS[G.diff].name
    + (MAPS[G.map].random ? ' · graine ' + seedCode(MAPS[G.map].rnd) : '') + '. ' + (G.coopGuest ? T('Le jeu continue pendant ce menu : seul l’hôte peut mettre tout le monde en pause.') : T('Ta pause met tout le monde en pause.'));
}

// ---------- Messages ----------
Net.on('msg', ({ from, data }) => {
  if (!data || !data.k || data.k[0] !== 'c') return;
  switch (data.k) {
    case 'clv': if (Net.role === 'host') {
      const old = coopLv(from); COOP.lvs[from] = data.lv || {};
      if (isHostCoop()) {
        for (const t of G.towers) if (t.own === from) { t.s = towerStats(t); healTower(t); }
        // Comme en solo, « Trésor de départ » acheté en cours de partie donne tout de suite son or
        const dg = ((data.lv || {}).gold || 0) - (old.gold || 0); if (dg > 0) COOP.gold[from] = (COOP.gold[from] || 0) + dg * 25;
      }
    } break;
    case 'cstart': if (Net.role !== 'host') beginCoop(data); break;
    case 'cact': if (Net.role === 'host') hostAction(from, data); break;
    case 'cquit': if (Net.role === 'host') playerGone(from); break;
    case 'ct': if (G && G.coopGuest) { applyTowers(data.t); G.ruins = data.ru || []; } break;
    case 'cs': if (G && G.coopGuest && !G.over) applySnapshot(data); break;
    case 'cnw': if (G && G.coopGuest) { G.nextWave = data.nw; hudCache.nw = null; } break;
    case 'cws': if (G && G.coopGuest) { G.curPortals = data.portals; banner(T('VAGUE ') + data.n, data.early ? T('Bonus d’audace +') + data.early : data.label || '', false); Snd.play('wave'); } break;
    case 'cwd': if (G && G.coopGuest) { G.partyUntil = G.time + 2.4; G.wave = data.n; G.score = data.sc; G.bossKills = data.bk; const aw = awardShards(); hint(T('Vague ') + data.n + T(' terminée') + (aw.gain ? ' : +' + aw.gain + T(' éclats') : ''), 2600); Snd.play('clear'); } break;
    case 'cend': if (G && G.coopGuest) coopFinish(data.win, data.why === 'hostquit' ? coopName(data.p) + T(' (l’hôte) a arrêté la partie.') : null); break;
    case 'cmsg': if (G && G.coop && NOTICE[data.kind]) hint(NOTICE[data.kind](data.d || {}), 2400); break;
    case 'cping': if (G && G.coop) addPing(from, data.x, data.y); break;
  }
});
Net.on('leave', id => { if (COOP.on) playerGone(id); });
Net.on('closed', () => { if (COOP.on && G && G.coopGuest && !G.over) coopFinish(false, T('La connexion avec l’hôte est perdue. La partie s’arrête (règles du K.O.).')); });
// Un invité envoie ses améliorations à l'hôte dès qu'il voit le mode coop dans le salon
Net.on('msg', ({ data }) => { if (data && data.k === 'lobby' && data.mode === 'coop' && Net.role !== 'host') Net.send(hostOf(), { k: 'clv', lv: meta.lv }); });
