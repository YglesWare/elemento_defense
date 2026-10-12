// Élémento Defense : duel multijoueur (mode infini, de 2 à 4 joueurs, dernier survivant).
// Chaque téléphone simule sa propre carte ; l'hôte donne le tempo des vagues et arbitre les éliminations.
'use strict';

// Ennemis que l'on peut envoyer : prix en or, revenu gagné à chaque vague, vague à partir de laquelle ils sont disponibles
const SENDS = [
  { type: 'gloop', price: 8, inc: 1, from: 1 },
  { type: 'zip', price: 10, inc: 1, from: 1 },
  { type: 'flappy', price: 14, inc: 1, from: 3 },
  { type: 'magma', price: 25, inc: 2, from: 5 },
  { type: 'tonk', price: 30, inc: 3, from: 5 },
  { type: 'gresil', price: 35, inc: 3, from: 7 },
  { type: 'crachou', price: 40, inc: 3, from: 9 },
  { type: 'malefik', price: 90, inc: 7, from: 12 },
  { type: 'boss', price: 450, inc: 30, from: 15 },
];
const DUEL = {
  cfg: { gap: 25000, prep: 15000, afk: 10000, hostAfk: 12000 },
  on: false, map: 0, lobbyMap: 0, ids: [], names: {}, alive: new Set(), elim: [], target: null,
  wave: 0, nextAt: 0, income: 0, sent: 0, dead: false, stats: {}, last: {}, hiddenAt: 0,
  timers: [], incoming: {}, inTimer: 0, uiT: 0, forfeitArm: false, result: null, all: false,
};
const ALL_DISCOUNT = 0.8;
const foes = () => [...DUEL.alive].filter(id => id !== meId());
// Prix et revenu d'un envoi, selon le mode : une cible, ou tous les adversaires encore en vie (20 % de réduction)
function sendCost(S) {
  const n = DUEL.all ? foes().length : 1, multi = DUEL.all && n > 1;
  return { n, price: multi ? Math.round(S.price * n * ALL_DISCOUNT) : S.price, inc: S.inc * n, multi };
}
screens.duel = $('#sDuel');
const dnow = () => performance.now();
const hostId = () => { const h = Net.players.find(p => p.host); return h ? h.id : null; };
const dname = id => DUEL.names[id] || (Net.players.find(p => p.id === id) || {}).name || T('Joueur');
const meId = () => Net.me && Net.me.id;

// ---------- Progression temporaire du multi : à zéro, ou « Avec nos progrès » (une copie de l'Atelier solo, sans ses éclats) ----------
let soloMeta = null;
function enterDuelMeta(prog) {
  if (!soloMeta) soloMeta = JSON.parse(JSON.stringify(meta));
  const lv = prog ? JSON.parse(JSON.stringify(soloMeta.lv || {})) : {};
  for (const k of Object.keys(meta)) delete meta[k];
  Object.assign(meta, { shards: 0, earned: 0, lv, bank: 0 });
  duelOn = true;
}
function exitDuelMeta() {
  if (!soloMeta) return;
  for (const k of Object.keys(meta)) delete meta[k];
  Object.assign(meta, soloMeta); soloMeta = null; duelOn = false;
  if (typeof trophyPay === 'function') trophyPay();
}

// ---------- Lancement ----------
function duelHostStart() {
  if (Net.role !== 'host') return;
  if (Net.players.length < 2) { MP.err = T('Il faut au moins 2 joueurs pour lancer la partie.'); renderMP(); return; }
  const rm = MAPS[DUEL.lobbyMap] && MAPS[DUEL.lobbyMap].random ? { size: DUEL.lobbySize || 'moyenne', seed: newSeed() } : null;
  const msg = { k: 'start', map: DUEL.lobbyMap, rnd: rm, ids: Net.players.map(p => p.id), names: Object.fromEntries(Net.players.map(p => [p.id, p.name])), prep: DUEL.cfg.prep, gap: DUEL.cfg.gap, chal: DUEL.lobbyChal || null, prog: DUEL.lobbyStart === 'prog' };
  // Mode 🏆 Tournoi (js/tournament.js) : 1 contre 1, À zéro, sans piment, sur la carte du mois ; un identifiant pour les deux rapports
  if (DUEL.lobbyMode === 'tour') {
    if (Net.players.length !== 2) { MP.err = T('Le tournoi se joue à 2.'); renderMP(); return; }
    Object.assign(msg, { rnd: tourRnd(), chal: null, prog: false });
    const other = Net.players.find(p => p.id !== meId()), ou = other && (DUEL.uids || {})[other.id];
    if (typeof tourUid === 'function' && tourUid() && ou)
      msg.tour = { mid: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10), mo: tourMo(), u: { [meId()]: tourUid(), [other.id]: ou } };
  }
  Net.send('all', msg);
  beginDuel(msg);
}
function clearDuelTimers() { for (const t of DUEL.timers) clearInterval(t); DUEL.timers = []; clearTimeout(DUEL.inTimer); }
function beginDuel(msg) {
  clearDuelTimers();
  stopScan && stopScan();
  enterDuelMeta(!!msg.prog);
  Object.assign(DUEL, { on: true, prog: !!msg.prog, map: msg.map, ids: msg.ids, names: msg.names, alive: new Set(msg.ids), elim: [], wave: 0, income: 0, sent: 0, dead: false,
    stats: {}, last: {}, incoming: {}, forfeitArm: false, result: null, all: false, tPlay: false, tWin: false, why: {}, tour: null });
  // Chaque téléphone vérifie que c'est bien un duel du tournoi : son mois, la carte du mois, sans progrès ni piment
  if (msg.tour && msg.tour.u && typeof tourUid === 'function' && tourUid() && msg.tour.u[meId()] === tourUid() && msg.tour.mo === tourMo()
    && msg.rnd && msg.rnd.seed === tourSeed() && !msg.prog && !(msg.chal && chalOn(chalClean(msg.chal)))) {
    const o = Object.keys(msg.tour.u).find(k => k !== meId());
    if (o && UUID_RE.test(msg.tour.u[o])) DUEL.tour = { mid: String(msg.tour.mid).slice(0, 40), opp: msg.tour.u[o], oppPeer: o, sent: false, res: null };
  }
  DUEL.cfg.gap = msg.gap || DUEL.cfg.gap;
  const t0 = dnow(); for (const id of msg.ids) DUEL.last[id] = t0;
  DUEL.target = msg.ids.find(id => id !== meId()) || null;
  duelTab = 'tours';
  if (msg.rnd) msg.map = makeRandom(msg.rnd.size, msg.rnd.seed); // même graine pour tous : même carte
  DUEL.map = msg.map;
  newGame(msg.map, null, 'infini');
  G.duel = true; G.sendQ = []; G.sendT = 0; G.speed = 1;
  if (typeof chalStart === 'function') chalStart(msg.chal, true);
  $('#bSpeed').hidden = true; $('#stage').classList.add('duel'); resize();
  DUEL.nextAt = dnow() + (msg.prep || DUEL.cfg.prep);
  buildSendPanel(); showPanel('palette'); renderDuelBar();
  banner('DUEL !', T('Prépare tes défenses : 1re vague dans ') + Math.round((msg.prep || DUEL.cfg.prep) / 1000) + ' s');
  Snd.play('wave');
  DUEL.timers.push(setInterval(sendStatus, 1000));
  if (Net.role === 'host') {
    DUEL.hostNext = DUEL.nextAt; DUEL.hostWave = 0;
    DUEL.timers.push(setInterval(hostTick, 250));
  } else DUEL.timers.push(setInterval(guestWatch, 1000));
}
function hostTick() {
  if (!DUEL.on) return;
  const t = dnow();
  if (t >= DUEL.hostNext) {
    DUEL.hostWave++; DUEL.hostNext += DUEL.cfg.gap;
    onWave(DUEL.hostWave, DUEL.cfg.gap);
    Net.send('all', { k: 'wave', n: DUEL.hostWave, gap: DUEL.cfg.gap, w: G ? G.weather : 'clear' });
  }
  // En ligne, un joueur peut perdre le réseau quelques secondes : il a le temps de se reconnecter (js/net.js)
  const afk = Net.online ? ONLINE_GRACE + 5000 : DUEL.cfg.afk;
  for (const id of DUEL.alive) if (id !== meId() && t - (DUEL.last[id] || 0) > afk) eliminate(id, 'absent');
}
function guestWatch() {
  if (!DUEL.on || DUEL.result) return;
  const h = hostId();
  if (!h || dnow() - (DUEL.last[h] || 0) > (Net.online ? ONLINE_GRACE + 7000 : DUEL.cfg.hostAfk)) duelAbort(T('L’hôte ne répond plus. La partie est interrompue.'));
}
function sendStatus() {
  if (!DUEL.on || !G) return;
  const st = { k: 'st', lives: Math.max(0, G.lives), wave: DUEL.wave, inc: DUEL.income };
  DUEL.stats[meId()] = st;
  Net.send('all', st);
}

// ---------- Vagues ----------
function onWave(n, gap, w) {
  if (!DUEL.on || !G) return;
  DUEL.wave = n; DUEL.nextAt = dnow() + gap;
  if (G.over) return;
  const pay = 10 + n + DUEL.income, shards = 2 + Math.floor(n / 5);
  G.gold += pay; meta.shards += shards;
  for (const t of G.towers) { healTower(t, true); t.ko = 0; t.stun = 0; t.evil = 0; refillShield(t); }
  const { list, label } = takeWave(n);
  if (w && w !== G.weather) setWeather(w);
  const wasEmpty = !G.spawnQ.length;
  G.wave = n; G.spawnQ.push(...list); G.waveActive = true;
  if (wasEmpty) G.spawnT = Math.max(G.spawnT, 0.4);
  banner(T('VAGUE ') + n, label || ('+' + pay + T(' or · +') + shards + T(' éclats')), n % 10 === 0);
  hint(T('Vague ') + n + ' : +' + pay + T(' or (dont ') + DUEL.income + T(' de revenu), +') + shards + T(' éclats'), 2600);
  Snd.play('wave');
}
function duelWaveLabel() {
  const s = Math.max(0, Math.ceil((DUEL.nextAt - dnow()) / 1000));
  return ['⏱', DUEL.wave ? T('Vague ') + (DUEL.wave + 1) : T('Départ'), s + ' s', 'idle', 0];
}
function duelTick(dt) {
  if (!DUEL.on || !G) return;
  if (!G.over && G.sendQ.length) { G.sendT -= dt; if (G.sendT <= 0) { spawn(G.sendQ.shift()); G.sendT = 0.4; } }
  DUEL.uiT -= dt; if (DUEL.uiT <= 0) { DUEL.uiT = 0.25; refreshSendPanel(); renderDuelBar(); }
}

// ---------- Envois d'ennemis ----------
function buildSendPanel() {
  const box = $('#sendPanel'); box.innerHTML = '<div class="sendrow" id="sendRow"></div>';
  const row = $('#sendRow');
  const mode = document.createElement('button'); mode.type = 'button'; mode.className = 'sbt mode'; mode.id = 'sendMode';
  mode.addEventListener('click', () => { if (foes().length < 2) return; DUEL.all = !DUEL.all; Snd.play('build'); refreshSendPanel(); hint(DUEL.all ? T('Mode « À tous » : chaque envoi part chez tous tes adversaires (−20 %)') : T('Mode cible : envoi à ') + dname(DUEL.target), 2000); });
  row.appendChild(mode);
  for (const S of SENDS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sbt'; b.dataset.mob = S.type;
    b.innerHTML = '<canvas></canvas><span class="sp">' + COIN + S.price + '</span><span class="si">+' + S.inc + '/v</span><span class="sl">V' + S.from + '</span>';
    row.appendChild(b);
    drawEnemy(prepMini(b.querySelector('canvas'), 40, 40), S.type, 20, 36, S.type === 'boss' ? 30 : 42, 0.6, null);
    b.addEventListener('click', () => duelSend(S));
  }
  refreshSendPanel();
}
function refreshSendPanel() {
  if (!G || !G.duel) return;
  const tgt = DUEL.target && DUEL.alive.has(DUEL.target), nf = foes().length;
  if (nf < 2) DUEL.all = false;
  const mode = $('#sendMode');
  if (mode) {
    const html = DUEL.all ? T('<span class="mi">👥</span><span class="mt">À tous</span><span class="ms">') + nf + T(' joueurs</span>')
      : '<span class="mi">🎯</span><span class="mt">' + esc(tgt ? dname(DUEL.target) : '—') + '</span><span class="ms">' + (nf > 1 ? T('toucher : à tous') : T('ta cible')) + '</span>';
    if (mode._h !== html) { mode._h = html; mode.innerHTML = html; }
    mode.classList.toggle('on', DUEL.all); mode.disabled = nf < 2;
  }
  document.querySelectorAll('#sendRow .sbt[data-mob]').forEach(b => {
    const S = SENDS.find(x => x.type === b.dataset.mob), locked = DUEL.wave < S.from, c = sendCost(S);
    const key = c.price + '|' + c.inc;
    if (b._k !== key) { b._k = key; b.querySelector('.sp').innerHTML = COIN + c.price; b.querySelector('.si').textContent = '+' + c.inc + '/v'; }
    b.classList.toggle('locked', locked); b.disabled = locked || G.gold < c.price || !(DUEL.all ? nf : tgt) || G.over;
  });
}
function duelSend(S) {
  if (!G || G.over || !DUEL.on) return;
  if (DUEL.wave < S.from) { hint(eName(S.type) + T(' : disponible dès la vague ') + S.from); return; }
  const c = sendCost(S), targets = c.multi ? foes() : [DUEL.target];
  if (!targets.length || !targets.every(id => id && DUEL.alive.has(id))) { hint(T('Aucun adversaire à viser')); return; }
  if (G.gold < c.price) { Snd.play('no'); hint(T('Pas assez d’or : il faut ') + c.price + T(' or')); return; }
  G.gold -= c.price; DUEL.income += c.inc; DUEL.sent += targets.length;
  if (typeof trophyMp === 'function') trophyMp('sent', targets.length);
  for (const id of targets) Net.send(id, { k: 'send', mob: S.type });
  Snd.play('pop');
  hint(eName(S.type) + T(' envoyé ') + (c.multi ? T('à tous (') + targets.length + ')' : T('à ') + dname(targets[0])) + ' · revenu +' + c.inc + ' (total ' + DUEL.income + T('/vague)'), 1800);
  refreshSendPanel();
}
function receiveSend(from, mob) {
  if (!G || G.over || !ETYPES[mob]) return;
  G.sendQ.push(mob);
  const inc = DUEL.incoming[from] = DUEL.incoming[from] || {};
  inc[mob] = (inc[mob] || 0) + 1;
  clearTimeout(DUEL.inTimer);
  DUEL.inTimer = setTimeout(() => {
    const parts = [];
    for (const f in DUEL.incoming) parts.push(dname(f) + T(' t’envoie ') + Object.entries(DUEL.incoming[f]).map(([m, c]) => c + ' ' + eName(m)).join(', '));
    DUEL.incoming = {};
    if (parts.length) { hint('⚠ ' + parts.join(' · ') + ' !', 2600); Snd.play('no'); }
  }, 600);
}

// ---------- Bandeau des adversaires ----------
function renderDuelBar() {
  const bar = $('#duelBar'); if (!DUEL.on) { bar.hidden = true; return; }
  bar.hidden = false;
  const others = DUEL.ids.filter(id => id !== meId());
  const html = others.map(id => {
    const st = DUEL.stats[id] || {}, dead = !DUEL.alive.has(id), tg = id === DUEL.target && !dead;
    return '<button type="button" class="dp' + (tg ? ' tg' : '') + (dead ? ' dead' : '') + '" data-id="' + id + '">' + (tg && others.length > 1 ? '🎯 ' : '') + esc(dname(id))
      + ' <span>❤ ' + (st.lives != null ? st.lives : '…') + '</span>' + (st.inc ? ' <span class="dinc">+' + st.inc + '</span>' : '') + '</button>';
  }).join('');
  if (bar._h !== html) { bar._h = html; bar.innerHTML = html; }
}
$('#duelBar').addEventListener('click', ev => {
  const b = ev.target.closest('.dp'); if (!b || !DUEL.alive.has(b.dataset.id)) return;
  DUEL.target = b.dataset.id; renderDuelBar(); refreshSendPanel();
  hint(T('Cible : ') + dname(DUEL.target), 1500);
});
$('#duelTabs').addEventListener('click', ev => {
  const b = ev.target.closest('[data-dt]'); if (!b) return;
  duelTab = b.dataset.dt;
  document.querySelectorAll('#duelTabs [data-dt]').forEach(x => x.classList.toggle('on', x.dataset.dt === duelTab));
  if (G && G.selTower) deselect(); else showPanel('palette');
  refreshSendPanel();
});

// ---------- Éliminations et fin ----------
function duelDead(why) {
  if (!DUEL.on || DUEL.dead) return;
  DUEL.dead = true;
  if (G) { G.over = true; G.lives = Math.max(0, G.lives); }
  Snd.play('ko');
  if (Net.role === 'host') eliminate(meId(), why);
  else Net.send(hostId(), { k: 'dead', why });
  showDuelScreen(false);
}
function eliminate(id, why) {
  if (Net.role !== 'host' || !DUEL.alive.has(id) || DUEL.result) return;
  DUEL.alive.delete(id); DUEL.elim.push(id);
  Net.send('all', { k: 'elim', id, why });
  onElim(id, why);
  if (DUEL.alive.size <= 1) {
    const rank = [...DUEL.alive, ...[...DUEL.elim].reverse()];
    Net.send('all', { k: 'end', rank });
    onEnd(rank);
  }
}
const WHY = { ko: T('n’a plus de vies'), absent: T('a quitté l’appli trop longtemps'), parti: T('s’est déconnecté'), abandon: T('a abandonné') };
function onElim(id, why) {
  if (DUEL.why) DUEL.why[id] = why;
  DUEL.alive.delete(id); if (!DUEL.elim.includes(id)) DUEL.elim.push(id);
  if (id === meId()) {
    if (!DUEL.dead) { DUEL.dead = true; if (G) G.over = true; }
    if (!DUEL.result) showDuelScreen(false, why);
  } else {
    hint(dname(id) + T(' est éliminé : il ') + (WHY[why] || T('est hors jeu')), 2600);
    if (DUEL.target === id) DUEL.target = [...DUEL.alive].find(x => x !== meId()) || null;
  }
  renderDuelBar(); refreshSendPanel();
}
function onEnd(rank) {
  if (DUEL.result) return;
  DUEL.result = rank;
  clearDuelTimers();
  if (G) G.over = true;
  const won = rank[0] === meId();
  Snd.play(won ? 'win' : 'ko');
  showDuelScreen(true);
}
function duelAbort(text) {
  if (!DUEL.on || DUEL.result) return;
  DUEL.result = [meId()]; clearDuelTimers();
  if (G) G.over = true;
  showDuelScreen(true, null, text);
}
function showDuelScreen(final, why, abortText) {
  const me = meId(), rank = DUEL.result || [...DUEL.alive, ...[...DUEL.elim].reverse()];
  const won = final && !abortText && rank[0] === me, place = rank.indexOf(me) + 1;
  // Tournoi : le résultat est connu (fin, interruption, ou mon élimination en 1 contre 1)
  if (DUEL.tour && !DUEL.tour.sent && (final || abortText || (DUEL.ids.length === 2 && DUEL.dead))) {
    const opp = DUEL.tour.oppPeer, cut = w => w === 'absent' || w === 'parti';
    tourDuelEnd(won, abortText || cut(why) || cut(DUEL.why[me]) || cut(DUEL.why[opp]) ? 'net' : 'ko');
  }
  if (typeof tourDuelPaint === 'function') tourDuelPaint();
  if (typeof trophy === 'function') {
    if (!DUEL.tPlay) { DUEL.tPlay = true; trophy('duel_play'); }
    if (won && !DUEL.tWin) { DUEL.tWin = true; trophy('duel_win'); trophyMp('wins'); if (DUEL.ids.length >= 3) trophy('duel_big'); }
  }
  $('#dWord').textContent = abortText ? 'FIN' : won ? T('VICTOIRE !!') : T('ÉLIMINÉ');
  $('#dWord').classList.toggle('win', won);
  $('#dText').textContent = abortText || (won ? T('Tu es le dernier survivant. Bravo !')
    : final ? T('Tu termines ') + (IS_EN ? place + (['', 'st', 'nd', 'rd'][place] || 'th') : place === 2 ? '2e' : place + 'e') + T(' sur ') + DUEL.ids.length + '.'
    : why === 'absent' ? T('Tu as quitté l’appli plus de 10 secondes : tu es éliminé. La partie continue sans toi.')
    : T('Ta maison est tombée. ') + (DUEL.alive.size > 1 ? T('La partie continue entre les survivants.') : ''));
  $('#dRank').innerHTML = final && !abortText ? rank.map((id, i) => '<li' + (id === me ? ' class="you"' : '') + '><b>' + (i + 1) + '</b> ' + esc(dname(id)) + (id === me ? ' (toi)' : '') + '</li>').join('') : '';
  $('#dRank').hidden = !final || !!abortText;
  $('#dWave').textContent = DUEL.wave; $('#dSent').textContent = DUEL.sent; $('#dInc').textContent = DUEL.income;
  if (typeof statFit === 'function') statFit('#dWave', '#dSent', '#dInc');
  const host = Net.role === 'host' && Net.players.length >= 2;
  $('#dRematch').hidden = !final || !host; $('#dWait').hidden = !final || host || !!abortText || !Net.role;
  $('#dWatch').hidden = final;
  show('duel');
}
function leaveDuel() {
  clearDuelTimers();
  DUEL.on = false; DUEL.dead = false; DUEL.result = null;
  exitDuelMeta();
  $('#bSpeed').hidden = false; $('#stage').classList.remove('duel'); $('#duelBar').hidden = true;
  if (G) G.duel = false;
  G = null;
}
$('#dRematch').addEventListener('click', () => { if (Net.role === 'host') duelHostStart(); });
$('#dLobby').addEventListener('click', () => { const wasOn = DUEL.on && !DUEL.result && !DUEL.dead; if (wasOn) duelForfeit(); leaveDuel(); openMulti(); });
$('#dWatch').addEventListener('click', () => show('game'));

// ---------- Abandon (menu pause du duel) ----------
function duelPauseUI(on) {
  $('#pQuit').hidden = on; $('#pCash').hidden = on; $('#pAuto').hidden = on; $('#pForfeit').hidden = !on;
  if (on) {
    DUEL.forfeitArm = false; refreshForfeit();
    $('#pSave').textContent = T('Duel en cours : le jeu ne s’arrête pas pendant ce menu. ') + MAPS[G.map].name + ' · biome ' + MAPS[G.map].biome.name.toLowerCase() + (MAPS[G.map].random ? ' · graine ' + seedCode(MAPS[G.map].rnd) : '') + '.';
  }
}
function refreshForfeit() {
  const b = $('#pForfeit');
  b.textContent = DUEL.forfeitArm ? T('Sûr ? Touche encore pour abandonner') : T('Abandonner le duel');
  b.classList.toggle('alt', DUEL.forfeitArm); b.classList.toggle('pink', !DUEL.forfeitArm);
}
function duelForfeit() {
  if (!DUEL.on || DUEL.dead) return;
  duelDead('abandon');
}
$('#pForfeit').addEventListener('click', () => { if (!DUEL.forfeitArm) { DUEL.forfeitArm = true; refreshForfeit(); return; } DUEL.forfeitArm = false; duelForfeit(); });

// ---------- Messages réseau ----------
Net.on('msg', ({ from, data }) => {
  if (!data || !data.k) return;
  DUEL.last[from] = dnow();
  switch (data.k) {
    case 'tuid': if (Net.role === 'host' && typeof data.uid === 'string' && /^[0-9a-f-]{36}$/i.test(data.uid)) { DUEL.uids = DUEL.uids || {}; DUEL.uids[from] = data.uid; } break;
    case 'lobby': {
      if (typeof tourUid === 'function' && tourUid() && dnow() - (DUEL.uidAt || 0) > 10000) { DUEL.uidAt = dnow(); Net.send(from, { k: 'tuid', uid: tourUid() }); }
      // L'hôte renvoie les réglages toutes les 2 s : on ne redessine le salon que s'ils changent (sinon les règles ouvertes se referment)
      const sig = JSON.stringify([DUEL.lobbyMap, DUEL.lobbySize, DUEL.lobbyMode, DUEL.lobbyDiff, DUEL.lobbyChal, DUEL.lobbyStart]);
      DUEL.lobbyMap = data.map; if (data.rsize) DUEL.lobbySize = data.rsize; DUEL.lobbyMode = data.mode || 'duel'; if (data.diff) DUEL.lobbyDiff = data.diff; DUEL.lobbyChal = data.chal || null; DUEL.lobbyStart = data.start === 'prog' ? 'prog' : 'zero';
      if (typeof MP !== 'undefined' && MP.state === 'lobby' && sig !== JSON.stringify([DUEL.lobbyMap, DUEL.lobbySize, DUEL.lobbyMode, DUEL.lobbyDiff, DUEL.lobbyChal, DUEL.lobbyStart])) renderMP();
    } break;
    case 'start': if (Net.role !== 'host') beginDuel(data); break;
    case 'wave': if (Net.role !== 'host') onWave(data.n, data.gap, data.w); break;
    case 'st': DUEL.stats[from] = data; break;
    case 'send': if (DUEL.on) receiveSend(from, data.mob); break;
    case 'dead': if (Net.role === 'host') eliminate(from, data.why || 'ko'); break;
    case 'elim': if (Net.role !== 'host') onElim(data.id, data.why); break;
    case 'end': if (Net.role !== 'host') onEnd(data.rank); break;
  }
});
Net.on('leave', id => { if (DUEL.on && Net.role === 'host') eliminate(id, 'parti'); });
Net.on('closed', () => { if (DUEL.on) duelAbort(T('La connexion avec l’hôte est perdue. La partie est interrompue.')); });
Net.on('roster', () => { if (Net.role === 'host' && !DUEL.on) sendLobby(); });

// Quitter l'appli plus de 10 s élimine
document.addEventListener('visibilitychange', () => {
  if (!DUEL.on) return;
  if (document.visibilityState === 'hidden') DUEL.hiddenAt = dnow();
  else if (DUEL.hiddenAt && dnow() - DUEL.hiddenAt > DUEL.cfg.afk && !DUEL.dead && !DUEL.result) duelDead('absent');
});
// Un joueur revient après avoir fermé l'appli : sa carte de duel est perdue, il compte comme parti et attend la suite au salon
Net.on('rejoin', id => { if (DUEL.on && Net.role === 'host' && DUEL.alive.has(id)) eliminate(id, 'parti'); });
