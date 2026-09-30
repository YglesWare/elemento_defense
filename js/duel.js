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
const dname = id => DUEL.names[id] || (Net.players.find(p => p.id === id) || {}).name || 'Joueur';
const meId = () => Net.me && Net.me.id;

// ---------- Progression temporaire du duel (tout le monde repart de zéro) ----------
let soloMeta = null;
function enterDuelMeta() {
  if (!soloMeta) soloMeta = JSON.parse(JSON.stringify(meta));
  for (const k of Object.keys(meta)) delete meta[k];
  Object.assign(meta, { shards: 0, earned: 0, lv: {}, bank: 0 });
  duelOn = true;
}
function exitDuelMeta() {
  if (!soloMeta) return;
  for (const k of Object.keys(meta)) delete meta[k];
  Object.assign(meta, soloMeta); soloMeta = null; duelOn = false;
}

// ---------- Lancement ----------
function duelHostStart() {
  if (Net.role !== 'host') return;
  if (Net.players.length < 2) { MP.err = 'Il faut au moins 2 joueurs pour lancer la partie.'; renderMP(); return; }
  const msg = { k: 'start', map: DUEL.lobbyMap, ids: Net.players.map(p => p.id), names: Object.fromEntries(Net.players.map(p => [p.id, p.name])), prep: DUEL.cfg.prep, gap: DUEL.cfg.gap };
  Net.send('all', msg);
  beginDuel(msg);
}
function clearDuelTimers() { for (const t of DUEL.timers) clearInterval(t); DUEL.timers = []; clearTimeout(DUEL.inTimer); }
function beginDuel(msg) {
  clearDuelTimers();
  stopScan && stopScan();
  enterDuelMeta();
  Object.assign(DUEL, { on: true, map: msg.map, ids: msg.ids, names: msg.names, alive: new Set(msg.ids), elim: [], wave: 0, income: 0, sent: 0, dead: false,
    stats: {}, last: {}, incoming: {}, forfeitArm: false, result: null, all: false });
  DUEL.cfg.gap = msg.gap || DUEL.cfg.gap;
  const t0 = dnow(); for (const id of msg.ids) DUEL.last[id] = t0;
  DUEL.target = msg.ids.find(id => id !== meId()) || null;
  duelTab = 'tours';
  newGame(msg.map, null, 'infini');
  G.duel = true; G.sendQ = []; G.sendT = 0; G.speed = 1;
  $('#bSpeed').hidden = true; $('#stage').classList.add('duel');
  DUEL.nextAt = dnow() + (msg.prep || DUEL.cfg.prep);
  buildSendPanel(); showPanel('palette'); renderDuelBar();
  banner('DUEL !', 'Prépare tes défenses : 1re vague dans ' + Math.round((msg.prep || DUEL.cfg.prep) / 1000) + ' s');
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
    Net.send('all', { k: 'wave', n: DUEL.hostWave, gap: DUEL.cfg.gap });
    onWave(DUEL.hostWave, DUEL.cfg.gap);
  }
  for (const id of DUEL.alive) if (id !== meId() && t - (DUEL.last[id] || 0) > DUEL.cfg.afk) eliminate(id, 'absent');
}
function guestWatch() {
  if (!DUEL.on || DUEL.result) return;
  const h = hostId();
  if (!h || dnow() - (DUEL.last[h] || 0) > DUEL.cfg.hostAfk) duelAbort('L’hôte ne répond plus. La partie est interrompue.');
}
function sendStatus() {
  if (!DUEL.on || !G) return;
  const st = { k: 'st', lives: Math.max(0, G.lives), wave: DUEL.wave, inc: DUEL.income };
  DUEL.stats[meId()] = st;
  Net.send('all', st);
}

// ---------- Vagues ----------
function onWave(n, gap) {
  if (!DUEL.on || !G) return;
  DUEL.wave = n; DUEL.nextAt = dnow() + gap;
  if (G.over) return;
  const pay = 10 + n + DUEL.income, shards = 2 + Math.floor(n / 5);
  G.gold += pay; meta.shards += shards;
  for (const t of G.towers) { healTower(t, true); t.ko = 0; t.stun = 0; t.evil = 0; refillShield(t); }
  const { list, label } = makeWave(n);
  const wasEmpty = !G.spawnQ.length;
  G.wave = n; G.spawnQ.push(...list); G.waveActive = true;
  if (wasEmpty) G.spawnT = Math.max(G.spawnT, 0.4);
  banner('VAGUE ' + n, label || ('+' + pay + ' or · +' + shards + ' éclats'), n % 10 === 0);
  hint('Vague ' + n + ' : +' + pay + ' or (dont ' + DUEL.income + ' de revenu), +' + shards + ' éclats', 2600);
  Snd.play('wave');
}
function duelWaveLabel() {
  const s = Math.max(0, Math.ceil((DUEL.nextAt - dnow()) / 1000));
  return ['⏱', DUEL.wave ? 'Vague ' + (DUEL.wave + 1) : 'Départ', s + ' s', 'idle', 0];
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
  mode.addEventListener('click', () => { if (foes().length < 2) return; DUEL.all = !DUEL.all; Snd.play('build'); refreshSendPanel(); hint(DUEL.all ? 'Mode « À tous » : chaque envoi part chez tous tes adversaires (−20 %)' : 'Mode cible : envoi à ' + dname(DUEL.target), 2000); });
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
    const html = DUEL.all ? '<span class="mi">👥</span><span class="mt">À tous</span><span class="ms">' + nf + ' joueurs</span>'
      : '<span class="mi">🎯</span><span class="mt">' + esc(tgt ? dname(DUEL.target) : '—') + '</span><span class="ms">' + (nf > 1 ? 'toucher : à tous' : 'ta cible') + '</span>';
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
  if (DUEL.wave < S.from) { hint(ETYPES[S.type].name + ' : disponible dès la vague ' + S.from); return; }
  const c = sendCost(S), targets = c.multi ? foes() : [DUEL.target];
  if (!targets.length || !targets.every(id => id && DUEL.alive.has(id))) { hint('Aucun adversaire à viser'); return; }
  if (G.gold < c.price) { Snd.play('no'); hint('Pas assez d’or : il faut ' + c.price + ' or'); return; }
  G.gold -= c.price; DUEL.income += c.inc; DUEL.sent += targets.length;
  for (const id of targets) Net.send(id, { k: 'send', mob: S.type });
  Snd.play('pop');
  hint(ETYPES[S.type].name + ' envoyé ' + (c.multi ? 'à tous (' + targets.length + ')' : 'à ' + dname(targets[0])) + ' · revenu +' + c.inc + ' (total ' + DUEL.income + '/vague)', 1800);
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
    for (const f in DUEL.incoming) parts.push(dname(f) + ' t’envoie ' + Object.entries(DUEL.incoming[f]).map(([m, c]) => c + ' ' + ETYPES[m].name).join(', '));
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
  hint('Cible : ' + dname(DUEL.target), 1500);
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
const WHY = { ko: 'n’a plus de vies', absent: 'a quitté l’appli trop longtemps', parti: 's’est déconnecté', abandon: 'a abandonné' };
function onElim(id, why) {
  DUEL.alive.delete(id); if (!DUEL.elim.includes(id)) DUEL.elim.push(id);
  if (id === meId()) {
    if (!DUEL.dead) { DUEL.dead = true; if (G) G.over = true; }
    if (!DUEL.result) showDuelScreen(false, why);
  } else {
    hint(dname(id) + ' est éliminé : il ' + (WHY[why] || 'est hors jeu'), 2600);
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
  $('#dWord').textContent = abortText ? 'FIN' : won ? 'VICTOIRE !!' : 'ÉLIMINÉ';
  $('#dWord').classList.toggle('win', won);
  $('#dText').textContent = abortText || (won ? 'Tu es le dernier survivant. Bravo !'
    : final ? 'Tu termines ' + (place === 2 ? '2e' : place + 'e') + ' sur ' + DUEL.ids.length + '.'
    : why === 'absent' ? 'Tu as quitté l’appli plus de 10 secondes : tu es éliminé. La partie continue sans toi.'
    : 'Ta maison est tombée. ' + (DUEL.alive.size > 1 ? 'La partie continue entre les survivants.' : ''));
  $('#dRank').innerHTML = final && !abortText ? rank.map((id, i) => '<li' + (id === me ? ' class="you"' : '') + '><b>' + (i + 1) + '</b> ' + esc(dname(id)) + (id === me ? ' (toi)' : '') + '</li>').join('') : '';
  $('#dRank').hidden = !final || !!abortText;
  $('#dWave').textContent = DUEL.wave; $('#dSent').textContent = DUEL.sent; $('#dInc').textContent = DUEL.income;
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
    $('#pSave').textContent = 'Duel en cours : le jeu ne s’arrête pas pendant ce menu. ' + MAPS[G.map].name + ' · biome ' + MAPS[G.map].biome.name.toLowerCase() + '.';
  }
}
function refreshForfeit() {
  const b = $('#pForfeit');
  b.textContent = DUEL.forfeitArm ? 'Sûr ? Touche encore pour abandonner' : 'Abandonner le duel';
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
    case 'lobby': DUEL.lobbyMap = data.map; if (typeof MP !== 'undefined' && MP.state === 'lobby') renderMP(); break;
    case 'start': if (Net.role !== 'host') beginDuel(data); break;
    case 'wave': if (Net.role !== 'host') onWave(data.n, data.gap); break;
    case 'st': DUEL.stats[from] = data; break;
    case 'send': if (DUEL.on) receiveSend(from, data.mob); break;
    case 'dead': if (Net.role === 'host') eliminate(from, data.why || 'ko'); break;
    case 'elim': if (Net.role !== 'host') onElim(data.id, data.why); break;
    case 'end': if (Net.role !== 'host') onEnd(data.rank); break;
  }
});
Net.on('leave', id => { if (DUEL.on && Net.role === 'host') eliminate(id, 'parti'); });
Net.on('closed', () => { if (DUEL.on) duelAbort('La connexion avec l’hôte est perdue. La partie est interrompue.'); });
Net.on('roster', () => { if (Net.role === 'host' && !DUEL.on) Net.send('all', { k: 'lobby', map: DUEL.lobbyMap }); });

// Quitter l'appli plus de 10 s élimine
document.addEventListener('visibilitychange', () => {
  if (!DUEL.on) return;
  if (document.visibilityState === 'hidden') DUEL.hiddenAt = dnow();
  else if (DUEL.hiddenAt && dnow() - DUEL.hiddenAt > DUEL.cfg.afk && !DUEL.dead && !DUEL.result) duelDead('absent');
});
