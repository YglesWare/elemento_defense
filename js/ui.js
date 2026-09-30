// Élémento Defense : Interface : HUD, panneaux, écrans (titre, cartes, Atelier, tutoriel…), entrées, boucle et démarrage.
'use strict';
// ================= Interface =================
const COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffd23f" stroke="#2a1b3d" stroke-width="3"/></svg>';
const GEM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 7-7 13L5 9z" fill="#c59bff" stroke="#2a1b3d" stroke-width="2.2" stroke-linejoin="round"/><path d="M5 9h14M12 2L9 9l3 13 3-13z" fill="none" stroke="#2a1b3d" stroke-width="1.3" stroke-linejoin="round"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="11" rx="3" fill="#ffd23f" stroke="#2a1b3d" stroke-width="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#2a1b3d" stroke-width="2.4"/><circle cx="12" cy="16" r="1.6" fill="#2a1b3d"/></svg>';
const screens = { title: $('#sTitle'), help: $('#sHelp'), pause: $('#sPause'), over: $('#sOver'), shop: $('#sShop'), tuto: $('#sTuto'), tree: $('#sTree'), maps: $('#sMaps'), diff: $('#sDiff') };
let curScreen = 'title', helpFrom = 'title', shopFrom = 'title', hudCache = {};
function show(name) { for (const k in screens) screens[k].hidden = k !== name; curScreen = name; if (name === 'title') refreshTitle(); }
function setText(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.textContent = v; } }
function setHTML(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.innerHTML = v; } }

let hintTimer = 0;
function hint(txt, ms = 2200) { const h = $('#hint'); h.textContent = txt; h.hidden = false; clearTimeout(hintTimer); hintTimer = setTimeout(() => { h.hidden = true; }, ms); }
let bannerTimer = 0;
function banner(big, small, boss) {
  const b = $('#banner'), sm = b.querySelector('.small');
  b.querySelector('.big').textContent = big; sm.textContent = small || ''; sm.hidden = !small;
  b.classList.toggle('boss', !!boss);
  b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, 2300);
}

// Palette
const palBtns = {};
TORDER.forEach((type, i) => {
  const D = TOWERS[type], b = document.createElement('button');
  b.type = 'button'; b.className = 'tbtn'; b.dataset.aria = D.name + ' (' + D.elem + ')';
  b.innerHTML = '<span class="lock">' + LOCK + '</span><span class="bio" hidden></span><canvas></canvas><span class="nm">' + D.name + '</span><span class="cost" data-cost="' + type + '">' + COIN + D.cost + '</span>';
  $('#palette').appendChild(b);
  const c = prepMini(b.querySelector('canvas'), 42, 42);
  drawTower(c, type, 21, 24, 35, 1, 0.4 + i, 0, 0.3, 0, false);
  b.addEventListener('click', () => selectType(type));
  palBtns[type] = b;
});
function selectType(type) {
  if (!G || G.over) return;
  if (!unlocked(type)) { Snd.play('no'); hint(TOWERS[type].name + ' se débloque dans l’Atelier (' + UNLOCK[type] + ' éclats)', 2600); return; }
  G.selTower = null; G.ghost = null; showPanel('palette');
  G.selType = G.selType === type ? null : type;
  if (G.selType) {
    const D = TOWERS[type];
    if (G.gold < costOf(type)) hint(D.name + ' coûte ' + costOf(type) + ' or');
    else hint(D.name + ' · ' + kindLine(type) + (G.terrain ? ' · vert = bonus, rouge = malus' : ''), 2800);
  }
  refreshPalette();
}
function refreshPalette() {
  if (!G) return;
  for (const type of TORDER) {
    const b = palBtns[type], sel = G.selType === type, poor = unlocked(type) && G.gold < costOf(type);
    if (b._sel !== sel) { b._sel = sel; b.classList.toggle('sel', sel); b.setAttribute('aria-pressed', sel); }
    if (b._poor !== poor) { b._poor = poor; b.classList.toggle('poor', poor); }
  }
}
function showPanel(which) { $('#palette').hidden = which !== 'palette'; $('#info').hidden = which !== 'info'; }

// Info tour
const iCtx = prepMini($('#iCv'), 44, 48);
function statChips(t) {
  const s = t.s, D = TOWERS[t.type];
  const extra = {
    feu: 'Brûlure ' + Math.round(s.burn) + '/s', eau: 'Ralentit ' + Math.round(s.slow * 100) + ' %', terre: s.stun ? 'Étourdit ' + Math.round(s.stun * 100) + ' %' : 'Zone',
    vent: 'Recul ' + fr(s.knock), foudre: s.chain + ' cibles', glace: 'Gèle 1 onde / ' + s.every,
  }[t.type] || D.fx(s);
  const ch = [['', '<i>Dégâts</i>' + Math.round(s.dmg)], ['', '<i>Portée</i>' + fr(s.range.toFixed(1))], ['', '<i>Cadence</i>' + fr(s.rate.toFixed(2)) + '/s'], ['', extra]];
  if (s.brMul) ch.push(['good', '×' + fr(s.brMul) + ' ' + BRANCH[s.br].vs]);
  if (s.terr && s.aff) ch.push([s.aff > 0 ? 'good' : 'bad', s.terr.name + ' ' + fmtAff(s.aff)]);
  if (s.terr && s.terr.range) ch.push(['good', s.terr.name + ' +0,6 portée']);
  if (s.bio) ch.push([s.bio > 0 ? 'good' : 'bad', 'Biome ' + fmtAff(s.bio)]);
  ch.unshift([t.ko > 0 ? 'bad' : t.hp < t.maxHp * 0.5 ? 'bad' : '', t.ko > 0 ? 'Assommée ' + Math.ceil(t.ko) + ' s' : '<i>PV</i>' + Math.ceil(t.hp) + '/' + t.maxHp + (t.shield > 0 ? ' +' + Math.ceil(t.shield) + ' 🛡' : '')]);
  if (t.stun > 0) ch.unshift(['bad', 'Paralysée']);
  if (t.evil > 0) ch.unshift(['bad', 'Pervertie ' + Math.ceil(t.evil) + ' s']);
  return ch.map(([c, v]) => '<span class="ichip ' + c + '">' + v + '</span>').join('');
}
function selectTower(t) {
  G.selTower = t; G.selType = null; G.ghost = null; refreshPalette();
  showPanel('info'); hudCache.info = null; refreshInfo();
  if (!G.drag && fusionPartners(t).some(o => o.ok)) hint('Fais glisser ' + TOWERS[t.type].name + ' sur une tour entourée de rose pour fusionner', 2800);
}
function refreshInfo() {
  const t = G && G.selTower; if (!t) return;
  const D = TOWERS[t.type], cost = upCost(t);
  const key = [t.type, t.lvl, t.br, t.mode, G.gold >= cost, Math.ceil(t.hp), Math.ceil(t.shield || 0), Math.ceil(t.ko || 0), t.stun > 0, Math.ceil(t.evil || 0)].join('|');
  if (hudCache.info === key) return;
  hudCache.info = key;
  $('#iName').textContent = D.name;
  $('#iStars').textContent = (D.fusion ? '★'.repeat(t.lvl) + '☆'.repeat(3 - t.lvl) + ' · Fusion' : '★'.repeat(t.lvl) + '☆'.repeat(4 - t.lvl) + (t.br ? ' · ' + BRANCH[t.br].short : '')) + ' · ' + KIND[D.kind];
  const ic = $('#iStats'); ic.innerHTML = statChips(t); ic.scrollLeft = 0; ic.classList.toggle('more', ic.scrollWidth > ic.clientWidth + 2);
  const up = $('#iUp');
  if (D.fusion) { if (cost) { up.textContent = 'Améliorer ' + cost; up.disabled = G.gold < cost; } else { up.textContent = 'Niveau max'; up.disabled = true; } }
  else if (t.lvl === 2 && !t.br) { up.textContent = 'Spécialiser ▸'; up.disabled = false; }
  else if (t.lvl >= 4) { up.textContent = 'Arbre ▸'; up.disabled = false; }
  else { up.textContent = (t.br ? BRANCH[t.br].short + ' II · ' : 'Améliorer ') + cost; up.disabled = G.gold < cost; }
  $('#iSell').textContent = 'Vendre ' + sellValue(t);
  $('#iMode').textContent = MODE_LABEL[t.mode];
  $('#iMode').hidden = D.kind === 'onde';
  iCtx.clearRect(0, 0, 44, 48); drawTower(iCtx, t.type, 22, 27, 37, t.lvl, 1, 0, 0.3, 0, false, t.br);
}
function deselect() { if (!G) return; G.selTower = null; G.selType = null; G.ghost = null; showPanel('palette'); refreshPalette(); }
$('#iClose').addEventListener('click', deselect);
$('#iUp').addEventListener('click', () => { if (G && G.selTower) evolve(G.selTower); });
$('#iSell').addEventListener('click', () => { if (G && G.selTower) sell(G.selTower); });
$('#iMode').addEventListener('click', () => {
  const t = G && G.selTower; if (!t) return;
  t.mode = MODES[(MODES.indexOf(t.mode) + 1) % MODES.length]; refreshInfo();
});

// HUD
const fmtK = n => n >= 100000 ? Math.round(n / 1000) + 'k' : n >= 10000 ? fr((n / 1000).toFixed(1)) + 'k' : String(n);
function bankHint(ms) { if (G) hint('Or de la partie : ' + G.gold + '. Ce qu’il en reste à la fin (victoire, K.O. ou abandon) rejoint la cagnotte 🐷 (' + (meta.bank || 0) + ' or), qui sert à acheter des cartes.', ms || 4200); }
$('#hGoldChip').addEventListener('click', () => bankHint());
const elLives = $('#hLives'), elGold = $('#hGold'), bWave = $('#bWave');
function refreshHUD() {
  setText(elLives, 'l', String(Math.max(0, G.lives)));
  setText(elGold, 'g', fmtK(G.gold));
  setText($('#hBank'), 'bk', '🐷 ' + fmtK(meta.bank || 0));
  let ic = '▶', sm = 'Vague', big, cls, bonus = 0;
  const cap = G.endless ? '' : '/' + G.maxw;
  if (G.over || G.spawnQ.length) { ic = ''; big = G.wave + cap; cls = 'idle'; }
  else if (!G.waveActive && G.autoT > 0) { ic = '⏱'; sm = 'Vague ' + (G.wave + 1); big = Math.ceil(G.autoT) + ' s'; cls = ''; }
  else if (!G.waveActive) { big = String(G.wave + 1); cls = 'go'; }
  else { big = String(G.wave + 1); cls = ''; bonus = 5 + Math.floor(G.wave / 2); }
  setHTML(bWave, 'wv', (ic ? '<span class="wi">' + ic + '</span>' : '') + '<span class="wt"><small>' + sm + '</small><b>' + big + '</b></span>' + (bonus ? '<span class="bonus">+' + bonus + '</span>' : ''));
  if (hudCache.wc !== cls) { hudCache.wc = cls; bWave.className = cls; bWave.disabled = cls === 'idle'; }
  const sk = String(meta.shards);
  if (hudCache.shop !== sk) {
    hudCache.shop = sk;
    $('#bShopN').textContent = meta.shards;
    $('#bShop').classList.toggle('ping', canBuyAnything());
  }
  refreshPalette(); refreshInfo();
}
bWave.addEventListener('click', () => { Snd.init(); if (G && !G.paused) startWave(); });
$('#bSpeed').addEventListener('click', () => { if (!G) return; G.speed = G.speed % 3 + 1; $('#bSpeed').textContent = 'x' + G.speed; });
$('#bPause').addEventListener('click', () => pause());

// Plateau
function tapCell(q, r, isMouse) {
  if (!G || G.over) return;
  if (!inside(q, r)) { deselect(); return; }
  const tw = towerAt(q, r);
  if (tw) { selectTower(tw); return; }
  if (G.selType) {
    const D = TOWERS[G.selType];
    if (!canBuild(q, r)) { G.bad = { c: q, r, t: 0.45 }; Snd.play('no'); hint((terrainAt(q, r) || {}).block ? 'Impossible de construire sur un obstacle' : 'Impossible de construire sur le chemin'); return; }
    if (G.gold < costOf(G.selType)) { Snd.play('no'); hint('Pas assez d’or : ' + D.name + ' coûte ' + costOf(G.selType)); return; }
    if (!isMouse && !(G.ghost && G.ghost.c === q && G.ghost.r === r)) { G.ghost = { c: q, r }; hint('Touche encore pour poser ' + D.name); return; }
    build(G.selType, q, r); return;
  }
  deselect();
}
let press = null;
const cvPos = ev => { const b = cv.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
cv.addEventListener('pointerdown', ev => {
  Snd.init();
  if (!G || curScreen !== 'game' || G.paused || G.over) return;
  const [px, py] = cvPos(ev), [q, r] = toGrid(px, py), tw = inside(q, r) ? towerAt(q, r) : null;
  if (tw) {
    press = { t: tw, px, py, id: ev.pointerId, mouse: ev.pointerType === 'mouse' };
    try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    return;
  }
  tapCell(q, r, ev.pointerType === 'mouse');
});
cv.addEventListener('pointermove', ev => {
  if (!G) return;
  const [px, py] = cvPos(ev);
  if (press && ev.pointerId === press.id) {
    if (!G.drag && Math.hypot(px - press.px, py - press.py) > 10) { selectTower(press.t); G.drag = { t: press.t, px, py, over: null, mouse: press.mouse }; }
    if (G.drag) {
      const d = G.drag; d.px = px; d.py = py;
      const prev = d.over; d.over = dragTarget(d);
      if (d.over && d.over !== prev) { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }
    }
    return;
  }
  if (ev.pointerType !== 'mouse') return;
  const [q, r] = toGrid(px, py);
  G.hover = inside(q, r) ? { c: q, r } : null;
});
cv.addEventListener('pointerup', ev => {
  if (!press || ev.pointerId !== press.id) return;
  const p = press; press = null;
  if (!G) return;
  if (G.drag) {
    const d = G.drag; G.drag = null;
    if (d.over) tryFuse(d.t, d.over);
    else hint('Pour fusionner, lâche la tour sur une tour compatible');
    return;
  }
  if (curScreen === 'game' && !G.paused && G.towers.includes(p.t)) tapCell(p.t.c, p.t.r, p.mouse);
});
cv.addEventListener('pointercancel', () => { press = null; if (G) G.drag = null; });
cv.addEventListener('pointerleave', () => { if (G) G.hover = null; });
cv.addEventListener('contextmenu', ev => { ev.preventDefault(); deselect(); });
document.addEventListener('pointerdown', () => Snd.init(), { passive: true });
document.addEventListener('keydown', ev => {
  if (curScreen === 'tree') { if (ev.key === 'Escape') closeTree(); return; }
  if (curScreen === 'tuto') { if (ev.key === 'ArrowRight') $('#uNext').click(); else if (ev.key === 'ArrowLeft') gotoTuto(tIdx - 1); else if (ev.key === 'Escape') closeTuto(); return; }
  if (curScreen === 'pause') { if (ev.key === 'Escape') resume(); else if (ev.key.toLowerCase() === 'q') $('#pQuit').click(); return; }
  if ((curScreen === 'help' || curScreen === 'shop') && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) { (curScreen === 'help' ? helpTabs : shopTabs).step(ev.key === 'ArrowRight' ? 1 : -1); return; }
  if (ev.key === 'Escape') {
    if (curScreen === 'help') { $('#hBack').click(); return; }
    if (curScreen === 'shop') { $('#sBack').click(); return; }
    if (curScreen === 'maps') { $('#mBack').click(); return; }
    if (curScreen === 'diff') { $('#dfBack').click(); return; }
    if (curScreen === 'over') { $('#oMenu').click(); return; }
  }
  if (!G || curScreen !== 'game') return;
  const k = ev.key.toLowerCase();
  if (k >= '1' && k <= '6') selectType(TORDER[+k - 1]);
  else if (k === ' ') { ev.preventDefault(); startWave(); }
  else if (k === 'p') pause();
  else if (k === 'escape') { press = null; G.drag = null; deselect(); pause(); }
  else if (k === 'u' && G.selTower) evolve(G.selTower);
  else if (k === 'f') $('#bSpeed').click();
  else if (k === 'a') $('#bShop').click();
});

// Écrans
function pause() {
  if (!G || G.over || curScreen !== 'game') return;
  G.paused = true; show('pause');
  $('#pSave').textContent = MAPS[G.map].name + ' · ' + DIFFS[G.diff].name + '. ' + (G.checkpoint && G.checkpoint.wave ? 'Partie sauvegardée à la fin de la vague ' + G.checkpoint.wave + '.' : 'La partie se sauvegarde à chaque fin de vague.')
    + ' Biome ' + MAPS[G.map].biome.name.toLowerCase() + ' : ' + biomeText(MAPS[G.map].biome) + '.'
    + ' Cagnotte : ' + (meta.bank || 0) + ' or. Elle ne reçoit l’or restant qu’en fin de partie (victoire, K.O. ou abandon).';
  cashArm = false; refreshCash();
  refreshOptBtns();
}
let cashArm = false;
function refreshCash() {
  if (!G) return;
  const v = Math.max(0, G.gold - (G.banked || 0)), b = $('#pCash');
  b.textContent = cashArm ? 'Sûr ? Touche encore : fin de la partie, +' + v + ' or dans la cagnotte' : 'Abandonner et encaisser ' + v + ' or';
  b.classList.toggle('alt', cashArm); b.classList.toggle('pink', !cashArm);
}
function cashOut() {
  if (!G || G.over) return;
  G.over = true; G.paused = true; Snd.play('clear');
  const best = recordBest(), award = awardShards(), bank = bankGold(); store.del(SAVE);
  showOver(false, best, award, bank, true);
}
$('#pCash').addEventListener('click', () => { if (!G || G.over) return; if (!cashArm) { cashArm = true; refreshCash(); return; } cashArm = false; cashOut(); });
function resume() { if (!G) return; G.paused = false; show('game'); keepAwake(); }
function refreshOptBtns() {
  $('#pSound').textContent = 'Son : ' + (opts.sound ? 'oui' : 'non');
  $('#tSound').textContent = 'Son : ' + (opts.sound ? 'oui' : 'non');
  $('#pAuto').textContent = 'Vagues auto : ' + (opts.auto ? 'oui' : 'non');
}
function toggleSound() { opts.sound = !opts.sound; store.set(OPTS, opts); Snd.init(); refreshOptBtns(); }
$('#pResume').addEventListener('click', resume);
$('#pSound').addEventListener('click', toggleSound);
$('#tSound').addEventListener('click', toggleSound);
$('#pAuto').addEventListener('click', () => { opts.auto = !opts.auto; store.set(OPTS, opts); refreshOptBtns(); if (G && opts.auto && !G.waveActive && !G.autoT) G.autoT = 3; if (G && !opts.auto) G.autoT = 0; });
$('#pHelp').addEventListener('click', () => { helpFrom = 'pause'; show('help'); screens.help.scrollTop = 0; });
$('#tHelp').addEventListener('click', () => { helpFrom = 'title'; show('help'); screens.help.scrollTop = 0; store.set('elemento.seen', true); });
$('#hBack').addEventListener('click', () => show(helpFrom));
$('#pQuit').addEventListener('click', () => { G = null; show('title'); });
$('#oMenu').addEventListener('click', () => { G = null; show('title'); });
$('#oRetry').addEventListener('click', () => { if (G) newGame(G.map, null, G.diff); else newGame(0, null, 'facile'); });
$('#oEndless').addEventListener('click', () => { G.endless = true; G.paused = false; saveCheckpoint(); show('game'); banner('MODE INFINI', 'Jusqu’où iras-tu ?'); if (opts.auto) G.autoT = 3; });
$('#tContinue').addEventListener('click', () => { const s = store.get(SAVE), i = saveMapIndex(s); if (i >= 0) newGame(i, s); });

function showOver(win, best, award, bank, quit) {
  const bk = bank || { gain: 0, total: meta.bank || 0 };
  $('#oBank').textContent = '+' + bk.gain;
  const nextMap = MAPS.findIndex((mm, i) => !mapOwned(i));
  $('#oBankDetail').textContent = 'L’or restant rejoint la cagnotte (' + bk.total + ' or), qui sert à acheter des cartes.' + (nextMap >= 0 ? ' Prochaine carte : ' + MAPS[nextMap].name + ', ' + MAPS[nextMap].price + ' or' + (mapReqOk(nextMap) ? (win && !quit && G.diff !== 'facile' && G.diff !== 'infini' && nextMap === G.map + 1 ? '. Elle est maintenant achetable !' : '.') : ', après avoir réussi ' + MAPS[nextMap - 1].name + ' en Moyen.') : '');
  $('#oWord').textContent = quit ? 'ABANDON' : win ? 'VICTOIRE !!' : 'K.O. !';
  $('#oWord').classList.toggle('win', win);
  $('#oText').textContent = quit ? 'Partie terminée. Ton or restant rejoint la cagnotte pour acheter des cartes.' : win ? 'Les ' + G.maxw + ' vagues sont repoussées. La petite maison est sauve !' : 'Les slimes ont envahi la petite maison. Retente ta chance !';
  $('#oWave').textContent = G.wave; $('#oScore').textContent = G.score;
  $('#oBest').textContent = best ? best.wave : G.wave;
  $('#oEndless').hidden = !win;
  const a = award || { gain: 0, parts: { wave: 0, score: 0, boss: 0, win: 0 }, mult: 1, before: 0 }, p = a.parts;
  $('#oShards').textContent = '+' + G.shardsPaid;
  const bits = ['Vagues +' + p.wave, 'Score +' + p.score];
  if (p.boss) bits.push('Kaiju +' + p.boss);
  if (p.win) bits.push('Victoire +' + p.win);
  if (a.mult > 1) bits.push('Terrain ×' + fr(a.mult));
  $('#oShop').classList.toggle('ping', canBuyAnything());
  $('#oGainDetail').textContent = bits.join(' · ') + '. Tu as maintenant ' + meta.shards + ' éclats.';
  show('over');
}

// Atelier
function refreshCosts() {
  document.querySelectorAll('[data-cost]').forEach(el => { const t = el.dataset.cost; el.innerHTML = unlocked(t) ? COIN + costOf(t) : GEM + UNLOCK[t]; });
  for (const type of TORDER) {
    const b = palBtns[type], lk = !unlocked(type);
    b.classList.toggle('locked', lk);
    b.setAttribute('aria-label', b.dataset.aria + (lk ? ', à débloquer dans l’Atelier' : ', ' + costOf(type) + ' or'));
    const bs = b.querySelector('.bio'), a = G && !G.demo ? affinity(type, MAPS[G.map].biome) : 0;
    bs.hidden = !a; if (a) { bs.textContent = (a > 0 ? '+' : '−') + Math.round(Math.abs(a) * 100); bs.className = 'bio ' + (a > 0 ? 'good' : 'bad'); bs.title = 'Biome ' + MAPS[G.map].biome.name + ' : ' + fmtAff(a); }
  }
}
function drawUpIcon(c, id, x, y, s) {
  const lw = Math.max(1.5, s * 0.06), r = s * 0.32;
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
  switch (id) {
    case 'gold':
      for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, r * 0.75 - i * r * 0.42, r * 0.95, r * 0.36, 0, 0, TAU); fs(c, '#ffd23f', lw); }
      c.beginPath(); c.ellipse(0, r * 0.75 - 2 * r * 0.42, r * 0.55, r * 0.18, 0, 0, TAU); c.lineWidth = lw * 0.8; c.strokeStyle = '#e0a800'; c.stroke();
      star(c, r * 0.95, -r * 0.75, r * 0.3, r * 0.1, 4); fs(c, '#ffffff', lw * 0.6); break;
    case 'lives':
      heart(c, 0, 0, r * 0.95); fs(c, '#ff4f6e', lw);
      c.beginPath(); c.ellipse(-r * 0.45, -r * 0.3, r * 0.16, r * 0.1, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill(); break;
    case 'loot':
      c.beginPath(); c.moveTo(-r * 0.35, -r * 0.55); c.lineTo(-r * 0.55, -r * 0.95); c.lineTo(r * 0.55, -r * 0.95); c.lineTo(r * 0.35, -r * 0.55);
      c.bezierCurveTo(r * 1.3, -r * 0.1, r * 1.1, r * 0.95, 0, r * 0.95); c.bezierCurveTo(-r * 1.1, r * 0.95, -r * 1.3, -r * 0.1, -r * 0.35, -r * 0.55); c.closePath(); fs(c, '#d39a62', lw);
      c.beginPath(); c.moveTo(-r * 0.4, -r * 0.55); c.lineTo(r * 0.4, -r * 0.55); c.lineWidth = lw * 1.3; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(0, r * 0.25, r * 0.36, 0, TAU); fs(c, '#ffd23f', lw * 0.8); break;
    case 'bonus':
      star(c, 0, r * 0.05, r * 1.1, r * 0.5); fs(c, '#ffd23f', lw);
      c.beginPath(); c.arc(-r * 0.2, -r * 0.1, r * 0.08, 0, TAU); c.arc(r * 0.2, -r * 0.1, r * 0.08, 0, TAU); c.fillStyle = INK; c.fill(); break;
    case 'cheap':
      c.rotate(-0.35); rr(c, -r * 0.95, -r * 0.6, r * 1.9, r * 1.2, r * 0.25); fs(c, '#ff4f81', lw);
      c.beginPath(); c.arc(-r * 0.62, 0, r * 0.13, 0, TAU); fs(c, '#ffffff', lw * 0.6);
      c.font = Math.round(r * 1.1) + 'px Bangers, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff';
      c.lineWidth = lw; c.strokeStyle = INK; c.strokeText('%', r * 0.2, r * 0.05); c.fillText('%', r * 0.2, r * 0.05); break;
    case 'resell':
      c.beginPath(); c.arc(0, 0, r * 0.6, 0, TAU); fs(c, '#ffd23f', lw);
      for (const a0 of [0, Math.PI]) {
        c.beginPath(); c.arc(0, 0, r * 1.05, a0 + 0.3, a0 + 2.4); c.lineWidth = lw * 1.4; c.strokeStyle = INK; c.stroke();
        const ax = Math.cos(a0 + 2.4) * r * 1.05, ay = Math.sin(a0 + 2.4) * r * 1.05, tx = -Math.sin(a0 + 2.4), ty = Math.cos(a0 + 2.4);
        c.beginPath(); c.moveTo(ax + tx * r * 0.3, ay + ty * r * 0.3); c.lineTo(ax - ty * r * 0.25, ay + tx * r * 0.25); c.lineTo(ax + ty * r * 0.25, ay - tx * r * 0.25); c.closePath(); c.fillStyle = INK; c.fill();
      } break;
    case 'remparts':
      rr(c, -r * 0.9, -r * 0.4, r * 1.8, r * 1.3, r * 0.15); fs(c, '#cdbfe0', lw);
      for (const k of [-0.9, -0.3, 0.3]) { c.beginPath(); c.rect(k * r, -r * 0.8, r * 0.6, r * 0.45); fs(c, '#cdbfe0', lw); }
      c.beginPath(); c.moveTo(-r * 0.2, r * 0.9); c.lineTo(-r * 0.2, r * 0.4); c.arc(0, r * 0.4, r * 0.2, Math.PI, TAU); c.lineTo(r * 0.2, r * 0.9); c.closePath(); fs(c, '#8a5a3c', lw * 0.8); break;
    case 'bouclier':
      c.beginPath(); c.moveTo(0, -r * 1.05); c.quadraticCurveTo(r * 0.95, -r * 0.8, r * 0.9, -r * 0.2); c.quadraticCurveTo(r * 0.75, r * 0.7, 0, r * 1.05); c.quadraticCurveTo(-r * 0.75, r * 0.7, -r * 0.9, -r * 0.2); c.quadraticCurveTo(-r * 0.95, -r * 0.8, 0, -r * 1.05); c.closePath(); fs(c, '#7fd3ff', lw);
      c.beginPath(); c.moveTo(0, -r * 0.7); c.lineTo(0, r * 0.7); c.moveTo(-r * 0.55, -r * 0.1); c.lineTo(r * 0.55, -r * 0.1); c.lineWidth = lw; c.strokeStyle = '#ffffff'; c.stroke(); break;
    case 'paratonnerre':
      c.beginPath(); c.moveTo(0, -r * 1.1); c.lineTo(0, r * 0.9); c.lineWidth = lw * 1.6; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.moveTo(r * 0.55, -r * 0.9); c.lineTo(r * 0.15, -r * 0.2); c.lineTo(r * 0.45, -r * 0.2); c.lineTo(r * 0.05, r * 0.5); c.lineTo(r * 0.75, -r * 0.35); c.lineTo(r * 0.45, -r * 0.35); c.closePath(); fs(c, '#ffd23f', lw * 0.8);
      c.beginPath(); c.arc(0, -r * 1.1, r * 0.14, 0, TAU); fs(c, '#ffd23f', lw * 0.7); break;
    case 'talisman':
      c.beginPath(); c.moveTo(-r * 0.5, -r * 1.1); c.lineTo(0, -r * 0.55); c.lineTo(r * 0.5, -r * 1.1); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(0, r * 0.1, r * 0.72, 0, TAU); fs(c, '#c9a8f0', lw);
      c.beginPath(); c.ellipse(0, r * 0.1, r * 0.42, r * 0.24, 0, 0, TAU); fs(c, '#ffffff', lw * 0.7);
      c.beginPath(); c.arc(0, r * 0.1, r * 0.14, 0, TAU); c.fillStyle = INK; c.fill(); break;
    case 'revive':
      for (const sg of [-1, 1]) {
        c.save(); c.scale(sg, 1); c.beginPath(); c.moveTo(r * 0.3, -r * 0.1);
        c.quadraticCurveTo(r * 1.2, -r * 1.0, r * 1.35, -r * 0.35); c.quadraticCurveTo(r * 1.1, -r * 0.3, r * 1.15, r * 0.05); c.quadraticCurveTo(r * 0.85, 0, r * 0.85, r * 0.35); c.quadraticCurveTo(r * 0.5, r * 0.2, r * 0.3, r * 0.3); c.closePath();
        fs(c, '#ffffff', lw); c.restore();
      }
      heart(c, 0, 0, r * 0.6); fs(c, '#ff4f6e', lw); break;
  }
  c.restore();
}
function setupTabs(bar, key) {
  const btns = [...bar.querySelectorAll('[data-tab]')], panes = [...bar.closest('.inner').querySelectorAll('[data-pane]')], ids = btns.map(b => b.dataset.tab);
  const set = id => {
    if (!ids.includes(id)) id = ids[0];
    btns.forEach(b => { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    panes.forEach(pn => { pn.hidden = pn.dataset.pane !== id; });
    store.set(key, id);
  };
  btns.forEach(b => b.addEventListener('click', () => { set(b.dataset.tab); bar.closest('.curScreen').scrollTop = 0; }));
  const cur = () => (btns.find(b => b.classList.contains('on')) || btns[0]).dataset.tab;
  const step = d => { set(ids[(ids.indexOf(cur()) + d + ids.length) % ids.length]); bar.closest('.curScreen').scrollTop = 0; };
  set(store.get(key));
  return { set, step };
}
const shopTabs = setupTabs($('#sTabs'), 'elemento.tab.shop'), helpTabs = setupTabs($('#hTabs'), 'elemento.tab.help');
function openShop() {
  shopFrom = curScreen;
  const inRun = curScreen === 'game' && G;
  if (inRun) G.paused = true;
  $('#sBubble').textContent = inRun ? 'Partie en pause. Tes achats comptent tout de suite, même l’or et les vies bonus.'
    : 'Chaque vague gagnée rapporte des éclats. Les terrains difficiles paient mieux !';
  $('#sBack').textContent = inRun ? 'Retour au jeu' : 'Retour';
  show('shop'); screens.shop.scrollTop = 0; renderShop();
}
function renderShop(boughtId) {
  $('#sShards').textContent = meta.shards;
  const fb = $('#sFus'); fb.innerHTML = '';
  for (const k in FUSIONS) {
    const F = TOWERS[k], own = fusionUnlocked(k), need = F.parents.filter(q => !unlocked(q)), d = document.createElement('div');
    d.className = 'up' + (own ? ' maxed' : need.length ? ' lockd' : '') + (boughtId === 'f_' + k ? ' bought' : '');
    d.innerHTML = '<canvas></canvas><span class="un">' + F.name + '</span><span class="tag" style="background:' + F.color + ';align-self:start">' + F.elem + '</span><p><b>' + kindLine(k) + '.</b> ' + F.desc + '</p>'
      + '<button class="sbtn buy" type="button"' + (own || need.length || meta.shards < F.unlock ? ' disabled' : '') + '>'
      + (own ? 'Débloquée' : need.length ? 'Débloque ' + need.map(q => TOWERS[q].name).join(' et ') + ' d’abord' : 'Débloquer ' + GEM + F.unlock) + '</button>';
    fb.appendChild(d);
    drawTower(prepMini(d.querySelector('canvas'), 44, 48), k, 22, 27, 37, 1, 0.5, 0, 0.3, 0, false);
    d.querySelector('button').addEventListener('click', () => buyFusion(k));
  }
  const can = {
    tow: TORDER.some(t => !unlocked(t) && meta.shards >= UNLOCK[t]),
    fus: Object.keys(FUSIONS).some(k => !fusionUnlocked(k) && FUSIONS[k].parents.every(unlocked) && meta.shards >= FUSIONS[k].unlock),
    camp: UPGRADES.some(u => !u.tower && M(u.id) < u.max && meta.shards >= upPrice(u)),
    mast: UPGRADES.some(u => u.tower && unlocked(u.tower) && M(u.id) < u.max && meta.shards >= upPrice(u)),
  };
  document.querySelectorAll('#sTabs [data-tab]').forEach(b => b.querySelector('.dot').classList.toggle('has', !!can[b.dataset.tab]));
  const tb = $('#sTow'); tb.innerHTML = '';
  for (const t of TORDER) {
    const D = TOWERS[t], price = UNLOCK[t], own = unlocked(t), d = document.createElement('div');
    d.className = 'up' + (own ? ' maxed' : ' lockd') + (boughtId === 'u_' + t ? ' bought' : '');
    d.innerHTML = '<canvas></canvas><span class="un">' + D.name + '</span><span class="tag" style="background:' + D.color + ';align-self:start">' + D.elem + '</span><p><b>' + kindLine(t) + '.</b> ' + D.desc + '</p>'
      + '<button class="sbtn buy" type="button"' + (own || meta.shards < price ? ' disabled' : '') + '>' + (own ? (price ? 'Débloqué' : 'Offert dès le départ') : 'Débloquer ' + GEM + price) + '</button>';
    tb.appendChild(d);
    drawTower(prepMini(d.querySelector('canvas'), 44, 48), t, 22, 27, 37, 1, 0.5, 0, 0.3, 0, false);
    d.querySelector('button').addEventListener('click', () => buyUnlock(t));
  }
  for (const [box, list] of [[$('#sBase'), UPGRADES.filter(u => !u.tower)], [$('#sMast'), UPGRADES.filter(u => u.tower)]]) {
    box.innerHTML = '';
    for (const u of list) {
      const l = M(u.id), maxed = l >= u.max, price = upPrice(u), d = document.createElement('div'), lockT = u.tower && !unlocked(u.tower);
      d.className = 'up' + (u.id === 'revive' ? ' wide' : '') + (maxed ? ' maxed' : '') + (lockT ? ' lockd' : '') + (boughtId === u.id ? ' bought' : '');
      let pips = ''; for (let i = 0; i < u.max; i++) pips += '<span class="pip' + (i < l ? ' on' : '') + '"></span>';
      d.innerHTML = '<canvas></canvas><span class="un">' + u.name + '</span><span class="pips" aria-label="Niveau ' + l + ' sur ' + u.max + '">' + pips + '</span>'
        + '<p>' + (l ? u.fx(l) : 'Pas encore acheté') + (maxed ? '' : '<br><span class="nx">Niveau ' + (l + 1) + ' : ' + u.fx(l + 1) + '</span>') + '</p>'
        + '<button class="sbtn buy" type="button"' + (maxed || lockT || meta.shards < price ? ' disabled' : '') + '>' + (lockT ? 'Débloque ' + TOWERS[u.tower].name + ' d’abord' : maxed ? 'Niveau max' : 'Acheter ' + GEM + price) + '</button>';
      box.appendChild(d);
      const c = prepMini(d.querySelector('canvas'), 44, 48);
      if (u.tower) drawTower(c, u.tower, 22, 27, 37, l ? Math.min(3, Math.ceil(l * 3 / 5)) : 1, 0.5, 0, 0.3, 0, false);
      else drawUpIcon(c, u.id, 22, 25, 40);
      d.querySelector('button').addEventListener('click', () => buyUp(u));
    }
  }
}
function buyUp(u) {
  const l = M(u.id), price = upPrice(u);
  if (l >= u.max || (u.tower && !unlocked(u.tower))) return;
  if (meta.shards < price) { Snd.play('no'); return; }
  meta.shards -= price; meta.lv[u.id] = l + 1; saveMeta();
  if (G && shopFrom === 'game') {
    if (u.id === 'gold') G.gold += 25;
    if (u.id === 'lives') G.lives += 2;
    for (const t of G.towers) { t.s = towerStats(t); const f = t.hp / (t.maxHp || 1); t.maxHp = towerMaxHp(t); t.hp = Math.round(t.maxHp * f); if (u.id === 'bouclier') refillShield(t); }
    if (!G.waveActive) saveCheckpoint();
    else if (G.checkpoint) { if (u.id === 'gold') G.checkpoint.gold += 25; if (u.id === 'lives') G.checkpoint.lives += 2; store.set(SAVE, G.checkpoint); }
  }
  Snd.init(); Snd.play('up');
  renderShop(u.id); refreshCosts();
}
function buyFusion(k) {
  const F = FUSIONS[k];
  if (fusionUnlocked(k) || !F.parents.every(unlocked)) return;
  if (meta.shards < F.unlock) { Snd.play('no'); return; }
  meta.shards -= F.unlock; meta.lv['f_' + k] = 1; saveMeta();
  Snd.init(); Snd.play('win');
  renderShop('f_' + k);
}
function buyUnlock(t) {
  if (unlocked(t)) return;
  const price = UNLOCK[t];
  if (meta.shards < price) { Snd.play('no'); return; }
  meta.shards -= price; meta.lv['u_' + t] = 1; saveMeta();
  Snd.init(); Snd.play('win');
  renderShop('u_' + t); refreshCosts();
}
$('#tShop').addEventListener('click', () => { Snd.init(); openShop(); });
$('#oShop').addEventListener('click', openShop);
$('#sBack').addEventListener('click', () => { if (shopFrom === 'game') resume(); else show(shopFrom); });
$('#bShop').addEventListener('click', () => { Snd.init(); if (G && !G.over && curScreen === 'game') openShop(); });

// Titre
const showCvs = [];
TORDER.forEach(type => { const c = document.createElement('canvas'); $('#tShow').appendChild(c); showCvs.push({ type, c: prepMini(c, 58, 62) }); });
function drawShowcase(t) {
  showCvs.forEach((o, i) => {
    o.c.clearRect(0, 0, 58, 62);
    const rc = Math.pow(Math.max(0, Math.sin(t * 2.2 + i * 1.3)), 10);
    drawTower(o.c, o.type, 29, 37, 50, 1, t + i * 0.7, Math.sin(t * 1.3 + i), 0.2, rc, ((t + i * 0.9) % 4) < 0.12);
  });
}
function drawMapMini(c, mi, w, h, diff) {
  const m = MAPS[mi], cs = Math.min(w / COLS, h / ROWS), ox = (w - COLS * cs) / 2, oy = (h - ROWS * cs) / 2;
  c.fillStyle = m.frame; c.fillRect(0, 0, w, h);
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { c.fillStyle = (q + r) % 2 ? m.ground : m.ground2; c.fillRect(ox + q * cs, oy + r * cs, cs + 0.5, cs + 0.5); }
  const terr = m.terrain ? (diff ? diffTerrain(mi, diff) : m.terrain) : null;
  if (terr) for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { const Tt = TERRAINS[terr[r][q]]; if (!Tt) continue; c.fillStyle = Tt.block ? '#2a1b3d' : Tt.color; c.globalAlpha = Tt.block ? 0.55 : 1; c.fillRect(ox + q * cs, oy + r * cs, cs + 0.5, cs + 0.5); c.globalAlpha = 1; }
  const pts = m.pts.map(([q, r]) => [ox + (q + 0.5) * cs, oy + (r + 0.5) * cs]);
  const line = (lw, col) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineWidth = lw; c.strokeStyle = col; c.lineJoin = 'round'; c.stroke(); };
  line(cs * 0.85, INK); line(cs * 0.62, m.path);
  const a = pts[1], z = pts[pts.length - 2];
  c.beginPath(); c.arc(ox + (m.pts[0][0] + 1.5) * cs, a[1], cs * 0.38, 0, TAU); fs(c, '#b57bff', 1.5);
  heart(c, ox + (m.pts[m.pts.length - 1][0] - 0.5) * cs, z[1], cs * 0.34); fs(c, '#ff4f6e', 1.5);
}
function renderMaps(boughtId) {
  $('#mBank').textContent = meta.bank || 0;
  const box = $('#tMaps'), best = store.get(BEST2) || {}; box.innerHTML = '';
  MAPS.forEach((m, i) => {
    const own = mapOwned(i), rec = best[m.id] || {}, d = document.createElement('div');
    d.className = 'mapc' + (own ? '' : ' locked') + (boughtId === m.id ? ' bought' : '');
    const med = DORDER.map(k => { const r = rec[k], on = k === 'infini' ? r && r.wave : r && r.won; return '<span class="medal' + (on ? ' on' : '') + '" title="' + DIFFS[k].name + '">' + (k === 'infini' ? '∞' + (r && r.wave ? ' ' + r.wave : '') : DIFFS[k].name[0]) + '</span>'; }).join('');
    d.innerHTML = '<canvas></canvas><span class="nm">' + (i + 1) + '. ' + m.name + '</span><span class="bio-l">Biome ' + m.biome.name.toLowerCase() + '</span><span class="medals">' + med + '</span>'
      + (own ? '' : mapReqOk(i) ? '<span class="req ok">✓ ' + MAPS[i - 1].name + ' réussie en Moyen</span>' : '<span class="req">Réussis d’abord ' + MAPS[i - 1].name + ' en Moyen</span>')
      + (own ? '<button class="sbtn" type="button">Jouer ▸</button>'
        : '<button class="sbtn" type="button"' + ((meta.bank || 0) < m.price || !mapReqOk(i) ? ' disabled' : '') + '>' + LOCK + 'Acheter · ' + m.price + ' or</button>');
    box.appendChild(d);
    const cv2 = d.querySelector('canvas'); drawMapMini(prepMini(cv2, 140, 90), i, 140, 90, 'moyen');
    d.querySelector('button').addEventListener('click', () => own ? openDiff(i) : buyMap(i));
    if (own) cv2.addEventListener('click', () => openDiff(i));
  });
}
function buyMap(i) {
  const m = MAPS[i];
  if (mapOwned(i) || !mapReqOk(i)) return;
  if ((meta.bank || 0) < m.price) { Snd.play('no'); return; }
  meta.bank -= m.price; meta.lv['map_' + m.id] = 1; saveMeta();
  Snd.init(); Snd.play('win'); renderMaps(m.id);
}
let diffMap = 0;
function openDiff(i) {
  diffMap = i; Snd.init(); show('diff'); screens.diff.scrollTop = 0;
  const m = MAPS[i], rec = (store.get(BEST2) || {})[m.id] || {};
  $('#dfName').textContent = (i + 1) + '. ' + m.name;
  $('#dfSub').textContent = m.blurb + ' Biome ' + m.biome.name.toLowerCase() + ' : ' + biomeText(m.biome) + ', sur toute la carte.';
  const box = $('#dfList'); box.innerHTML = '';
  for (const k of DORDER) {
    const Df = DIFFS[k], r = rec[k], d = document.createElement('div'); d.className = 'df';
    const rt = !r ? 'Jamais jouée' : k === 'infini' ? 'Record : vague ' + r.wave : r.won ? '✓ Réussie · record vague ' + r.wave : 'Record : vague ' + r.wave;
    d.innerHTML = '<canvas></canvas><div><b>' + Df.name + '</b><p>' + Df.desc + '</p><span class="st">' + rt + ' · éclats ×' + fr(+(m.shards * Df.shards).toFixed(2)) + '</span></div><button class="btn ' + k + '" type="button">Jouer</button>';
    box.appendChild(d);
    drawMapMini(prepMini(d.querySelector('canvas'), 112, 72), i, 112, 72, k);
    d.querySelector('button').addEventListener('click', () => newGame(i, null, k));
  }
}
$('#tPlay').addEventListener('click', () => { Snd.init(); renderMaps(); show('maps'); screens.maps.scrollTop = 0; });
$('#mBack').addEventListener('click', () => show('title'));
$('#dfBack').addEventListener('click', () => { renderMaps(); show('maps'); });
function refreshTitle() {
  const seen = !!store.get('elemento.tuto'); $('#tTuto').classList.toggle('green', !seen); $('#tTuto').classList.toggle('alt', seen);
  $('#tShop').innerHTML = 'L\u2019Atelier<span class="gemc">' + GEM + meta.shards + '</span>';
  $('#tShop').classList.toggle('ping', canBuyAnything());
  const s = store.get(SAVE), si = saveMapIndex(s), tc = $('#tContinue');
  if (si >= 0 && s.wave > 0) { tc.hidden = false; tc.textContent = 'Continuer · ' + MAPS[si].name + ' (' + DIFFS[s.diff || 'moyen'].name + '), vague ' + (s.wave + 1); }
  else tc.hidden = true;
  refreshOptBtns();
}

// Aide
TORDER.forEach(type => {
  const D = TOWERS[type], d = document.createElement('div'); d.className = 'el';
  d.innerHTML = '<canvas></canvas><div><b>' + D.name + '</b><span class="k">' + D.elem + '</span></div><div><span class="kinds">' + kindLine(type) + '</span><p>' + D.desc + '</p><span class="c" data-cost="' + type + '">' + COIN + D.cost + '</span></div>';
  $('#hEls').appendChild(d);
  drawTower(prepMini(d.querySelector('canvas'), 48, 52), type, 24, 29, 40, 1, 0.5, 0, 0.3, 0, false);
});
Object.keys(ETYPES).forEach(type => {
  const D = ETYPES[type], d = document.createElement('div'); d.className = 'foe';
  d.innerHTML = '<canvas></canvas><b>' + D.name + '</b><span>' + D.desc + '</span>';
  $('#hFoes').appendChild(d);
  const s = type === 'boss' ? 58 : 80;
  drawEnemy(prepMini(d.querySelector('canvas'), 56, 52), type, 28, 46 - (D.flying ? 0 : 0), s * (type === 'boss' ? 0.9 : 0.62), 0.8, null);
});

// Fusions
function fuseCheck(src, dst) {
  if (TOWERS[src.type].fusion || TOWERS[dst.type].fusion) return { k: null, why: 'Une tour fusionnée ne peut plus fusionner' };
  const k = fusionKey(src.type, dst.type);
  if (!k) return { k, why: TOWERS[src.type].name + ' et ' + TOWERS[dst.type].name + ' ne fusionnent pas' };
  const F = TOWERS[k];
  if (!fusionUnlocked(k)) return { k, why: F.name + ' : à débloquer dans l’Atelier (' + F.unlock + ' éclats)' };
  if (src.lvl < 2 || dst.lvl < 2) return { k, why: F.name + ' : les deux tours doivent être au niveau 2' };
  if (G.gold < F.fee) return { k, why: F.name + ' : il faut ' + F.fee + ' or' };
  return { k, ok: true };
}
function fusionPartners(t) {
  if (!G || TOWERS[t.type].fusion) return [];
  const out = [];
  for (const o of G.towers) {
    if (o === t || TOWERS[o.type].fusion || !fusionKey(t.type, o.type)) continue;
    out.push({ o, ok: !!fuseCheck(t, o).ok });
  }
  return out;
}
function tryFuse(src, dst) {
  const r = fuseCheck(src, dst);
  if (!r.ok) { Snd.play('no'); hint(r.why, 2800); return; }
  doFuse(src, dst, r.k);
}
function doFuse(src, dst, k) {
  const F = TOWERS[k];
  G.gold -= F.fee;
  G.towers = G.towers.filter(x => x !== src && x !== dst);
  const nt = addTower(k, dst.c, dst.r, 1, dst.mode, src.inv + dst.inv + F.fee); nt.recoil = 1;
  for (const o of [src, dst]) burst(o.c + 0.5, o.r + 0.5, 0.4, 18, [TOWERS[o.type].color, '#ffffff', '#ff6ad5'], 3, 0.1, 1, 0.8, 'star');
  G.fx.push({ kind: 'ring', gx: dst.c + 0.5, gy: dst.r + 0.5, r0: 0.2, r1: 2.2, t: 0, dur: 0.6, color: '#ff6ad5' });
  ono('FUSION !', dst.c + 0.5, dst.r + 0.5, '#ff6ad5', 0.8, 0, 1.1);
  Snd.play('win');
  selectTower(nt);
  banner(F.name.toUpperCase(), F.elem);
}

// Arbre de spécialisation
let treeT = null;
function openTree(t) {
  if (!G || G.over) return;
  treeT = t; G.paused = true; show('tree'); screens.tree.scrollTop = 0; renderTree();
}
function closeTree() { treeT = null; resume(); }
function renderTree() {
  const t = treeT, D = TOWERS[t.type], cost = upCost(t);
  const ic = prepMini($('#trIcon'), 64, 68); drawTower(ic, t.type, 32, 40, 54, t.lvl, 1, 0, 0.3, 0, false, t.br);
  $('#trName').textContent = D.name;
  $('#trSub').textContent = 'Niveau ' + t.lvl + ' · ' + KIND[D.kind] + ' · ' + D.elem;
  $('#trGold').textContent = G.gold;
  $('#trPath').innerHTML = '<span class="node done">Niv. 1 ✓</span><span class="arr">▶</span><span class="node' + (t.lvl >= 2 ? ' done' : '') + '">Niv. 2' + (t.lvl >= 2 ? ' ✓' : '') + '</span><span class="arr">▶</span><span class="node' + (t.br ? ' done' : '') + '">' + (t.br ? BRANCH[t.br].name + ' ✓' : 'Spécialisation') + '</span>';
  $('#trNote').textContent = t.br ? 'Branche ' + BRANCH[t.br].name + ' choisie. Les deux autres sont fermées pour cette tour.'
    : t.lvl < 2 ? 'Monte cette tour au niveau 2 pour choisir sa spécialisation.'
    : 'Choisis une branche pour cette tour. Ce choix est définitif : les deux autres se fermeront.';
  const box = $('#trBrs'); box.innerHTML = '';
  for (const key of BRANCHES) {
    const B = BRANCH[key], closed = !!t.br && t.br !== key, d = document.createElement('div');
    d.className = 'br' + (closed ? ' closed' : '') + (t.br === key ? ' chosen' : '');
    let html = '<div class="brh"><canvas></canvas><div><b>' + B.name + '</b><span>' + B.target + '</span></div></div><div class="rks">';
    for (let r = 1; r <= 2; r++) {
      const lvl = r + 2, done = t.br === key && t.lvl >= lvl;
      const next = !closed && t.lvl === lvl - 1 && (r === 1 ? !t.br : t.br === key);
      let foot;
      if (done) foot = '<span class="st">✓ Acquis</span>';
      else if (next) foot = '<button class="sbtn" type="button" data-br="' + key + '"' + (G.gold < cost ? ' disabled' : '') + '>' + (r === 1 ? 'Choisir' : 'Améliorer') + ' · ' + cost + '</button>';
      else if (closed) foot = '<span class="st">Branche fermée</span>';
      else foot = '<span class="st">' + (r === 1 ? 'Dès le niveau 2' : 'Après le rang I') + '</span>';
      html += '<div class="rk' + (done ? ' done' : '') + '"><span class="rn">Rang ' + (r === 1 ? 'I' : 'II') + '</span><p>' + rankText(key, r, t.type) + '</p>' + foot + '</div>';
    }
    d.innerHTML = html + '</div>';
    box.appendChild(d);
    drawEmblem(prepMini(d.querySelector('canvas'), 34, 34), key, 17, 17, 14);
  }
}
$('#trBrs').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-br]'); if (!b || !treeT) return;
  upgrade(treeT, b.dataset.br); renderTree();
});
$('#trClose').addEventListener('click', closeTree);

// Tutoriel
const TINFO = {
  feu: { what: 'Braise crache une boule de feu sur un seul ennemi. La cible prend feu et perd des PV chaque seconde pendant quelques instants, même quand elle sort du cercle de portée.',
    good: ['Tous les ennemis, au sol comme en vol', 'Les groupes, quand Zéphyr propage les flammes'],
    bad: ['Magmo est immunisé au feu', 'Portée courte, une seule cible à la fois'] },
  eau: { what: 'Ondine lance une bulle qui éclate en zone. Tous les ennemis éclaboussés sont ralentis et restent mouillés pendant 3,5 secondes.',
    good: ['Freiner les Zippy très rapides', 'Préparer le combo avec Voltie'],
    bad: ['Dégâts faibles', 'Le casque de Tonk absorbe ses petits coups'] },
  terre: { what: 'Rocaille lance un gros rocher en cloche qui écrase tout un petit groupe. Elle tire lentement mais frappe très fort. Aux niveaux 2 et 3, le choc peut étourdir.',
    good: ['Les groupes serrés', 'Tonk : un gros coup traverse son casque', 'La plus longue portée du jeu'],
    bad: ['Ne touche jamais les volants (Flappy)', 'Lente : les Zippy passent entre deux rochers'] },
  vent: { what: 'Zéphyr envoie une rafale qui fait reculer l’ennemi sur le chemin. Les volants prennent 2,5 fois plus de dégâts.',
    good: ['Les Flappy', 'Longue portée : elle couvre beaucoup de chemin', 'Gagner du temps pour les autres tours'],
    bad: ['Une seule cible à la fois', 'Tonk et le Kaiju reculent à peine', 'Dégâts faibles au sol'] },
  foudre: { what: 'Voltie frappe instantanément, puis l’éclair rebondit d’ennemi en ennemi : 3 cibles, puis 4 et 6 aux niveaux supérieurs. Chaque rebond est un peu plus faible.',
    good: ['Les files d’ennemis serrés', 'Les ennemis mouillés : dégâts ×2'],
    bad: ['La tour la plus chère', 'Moins utile contre un ennemi isolé'] },
  glace: { what: 'Givrette ne vise personne : elle envoie une onde glacée tout autour d’elle. L’onde touche et ralentit tout ce qui est dans le cercle. Toutes les 4 ondes (puis 3, puis 2), elle gèle les ennemis sur place.',
    good: ['Dans un virage, elle couvre deux bouts de chemin', 'Préparer le combo avec Rocaille'],
    bad: ['Toute petite portée et dégâts faibles', 'Le Kaiju dégèle très vite'] },
};
const DEMOS = {
  intro: { towers: [['eau', 5, 3], ['feu', 8, 5]], waves: ['gloop', 'gloop', 'zip', 'gloop'], gap: 1.0, lvl: 1 },
  feu: { towers: [['feu', 6, 3]], waves: ['gloop', 'gloop', 'zip', 'gloop', 'magma'], gap: 1.1, lvl: 1 },
  eau: { towers: [['eau', 6, 3]], waves: ['gloop', 'zip', 'zip', 'gloop', 'tonk'], gap: 0.9, lvl: 1 },
  terre: { towers: [['terre', 6, 3]], waves: ['gloop', 'gloop', 'gloop', 'flappy', 'tonk'], gap: 0.45, lvl: 1 },
  vent: { towers: [['vent', 6, 3]], waves: ['flappy', 'gloop', 'flappy', 'gloop'], gap: 1.2, lvl: 1 },
  foudre: { towers: [['foudre', 6, 3]], waves: ['gloop', 'gloop', 'gloop', 'gloop', 'zip'], gap: 0.4, lvl: 1 },
  glace: { towers: [['glace', 6, 3]], waves: ['gloop', 'gloop', 'zip', 'gloop'], gap: 0.7, lvl: 1 },
  c_zap: { towers: [['eau', 5, 3], ['foudre', 7, 5]], waves: ['gloop', 'gloop', 'gloop', 'gloop'], gap: 0.5, lvl: 1 },
  c_crack: { towers: [['glace', 6, 3], ['terre', 7, 5]], waves: ['gloop', 'gloop', 'gloop', 'tonk'], gap: 0.6, lvl: 2 },
  fus: { towers: [['tornade', 6, 3]], waves: ['gloop', 'gloop', 'gloop', 'zip', 'gloop'], gap: 0.5, lvl: 1 },
  c_fwoosh: { towers: [['feu', 5, 3], ['vent', 7, 5]], waves: ['gloop', 'gloop', 'gloop', 'gloop', 'gloop'], gap: 0.35, lvl: 1 },
};
const TUTO = [
  { kind: 'intro', demo: 'intro', title: 'Bienvenue !', tag: 'Les bases', html: '<ul>'
    + '<li>Les slimes sortent du portail violet et suivent le chemin jusqu’à la petite maison. Chaque slime qui entre te coûte une vie (2 pour Tonk, 10 pour un Kaiju).</li>'
    + '<li>Pose des tours sur l’herbe avec ton or. Chaque ennemi vaincu en rapporte, chaque vague terminée aussi.</li>'
    + '<li>Une tour attaque tout ce qui passe dans son cercle de portée. Touche une tour posée pour voir ce cercle, l’améliorer ou la vendre.</li>'
    + '<li>Tu commences avec Braise et Ondine. Les quatre autres gardiens se débloquent dans l’Atelier, avec les éclats gagnés à chaque vague. Les pages suivantes les présentent tous.</li></ul>' },
  ...TORDER.map(t => ({ kind: 'tower', tower: t, demo: t })),
  { kind: 'combo', demo: 'c_zap', title: 'ZAP x2!', tag: 'Eau puis Éclair', towers: ['eau', 'foudre'],
    what: 'Ondine mouille les ennemis pendant 3,5 secondes. Tant qu’ils sont mouillés, les éclairs de Voltie leur font deux fois plus de dégâts, rebonds compris.',
    tips: ['Place Ondine en amont de Voltie sur le chemin', 'Les deux cercles de portée doivent se recouvrir'] },
  { kind: 'combo', demo: 'c_crack', title: 'CRACK x2!', tag: 'Glace puis Terre', towers: ['glace', 'terre'],
    what: 'Quand Givrette gèle des ennemis, le prochain rocher de Rocaille les brise : dégâts ×2, et le gel s’arrête.',
    tips: ['Monte Givrette au niveau 2 ou 3 pour geler plus souvent', 'Rocaille doit viser la zone de Givrette'] },
  { kind: 'combo', demo: 'c_fwoosh', title: 'FWOOSH!', tag: 'Feu puis Vent', towers: ['feu', 'vent'],
    what: 'Quand une rafale de Zéphyr frappe un ennemi en feu, les flammes sautent sur tous ses voisins proches.',
    tips: ['Idéal contre les longues files de Gloop', 'Magmo, lui, ne brûle jamais'] },
  { kind: 'spec', title: 'Spécialisations', tag: 'Niveaux 3 et 4', html: '<p style="margin:0">Au niveau 2, chaque tour posée peut se spécialiser contre les ennemis au sol, les volants ou les Kaiju. Le choix vaut pour <b>cette tour uniquement</b>, et il est définitif : les deux autres branches se ferment. Deux Braise peuvent donc avoir des spécialisations différentes.</p>' },
  { kind: 'fusion', demo: 'fus', title: 'Fusions', tag: 'Deux éléments, une tour', html: '<p style="margin:0">Fais glisser une tour sur une autre tour d’élément compatible, toutes deux au niveau 2 ou plus : elles deviennent une seule tour, plus puissante, avec son propre effet, à la place de celle sur laquelle tu l’as lâchée. Chaque fusion se débloque une par une dans l’Atelier. Ici, une Tornade de feu.</p>' },
  { kind: 'terrain', title: 'Terrains', tag: 'Bonus et malus', html: '<p style="margin:0">Certaines cases changent la puissance des tours posées dessus. Une Ondine sur l’eau frappe 40 % plus fort, mais perd 40 % sur le sable. L’eau et la lave ont les effets les plus forts, le marécage des effets plus doux. Une fusion prend la moyenne de ses deux éléments : un Volcan sur l’eau a donc un malus. Quand tu choisis une tour, les cases s’affichent en vert (bonus) ou en rouge (malus). Chaque carte a aussi un biome qui renforce ou affaiblit certains éléments sur toute la carte. Le tableau complet est dans l’Aide.</p>' },
  { kind: 'end', title: 'À toi de jouer !', tag: 'Récap', html: '<ul>'
    + '<li>Commence avec Ondine et Braise près d’un virage : les ennemis y restent plus longtemps à portée.</li>'
    + '<li>Débloque vite Zéphyr (contre les Flappy volants, dès la vague 4) et Rocaille (contre les Tonk casqués, dès la vague 6).</li>'
    + '<li>Garde de l’or pour la vague 10 : le Kaiju encaisse énormément.</li>'
    + '<li>Au niveau 2, spécialise chaque tour selon la menace : Sol, Air ou Boss.</li>'
    + '<li>À tout moment, ouvre l’Atelier (bouton violet en haut) pour débloquer des tours et les renforcer.</li></ul>' },
];
const EFFECT = {
  feu: ['Brûlure', s => s.burn + '/s'], eau: ['Ralentit', s => Math.round(s.slow * 100) + ' %'],
  terre: ['Étourdit', s => s.stun ? Math.round(s.stun * 100) + ' %' : '—'], vent: ['Recul', s => fr(s.knock) + ' case'],
  foudre: ['Cibles', s => String(s.chain)], glace: ['Gel', s => '1 onde / ' + s.every],
};
function tutoTable(type) {
  const rows = [['Dégâts'], ['Portée'], ['Attaques/s'], [EFFECT[type][0]], ['Prix']];
  for (let l = 1; l <= 4; l++) {
    const st = statsOf(type, l);
    rows[0].push(Math.round(st.dmg)); rows[1].push(fr(st.range.toFixed(1))); rows[2].push(fr(st.rate.toFixed(2)));
    rows[3].push(EFFECT[type][1](st)); rows[4].push(l === 1 ? costOf(type) : '+' + upCost({ type, lvl: l - 1 }));
  }
  return '<table class="ttable"><thead><tr><th></th><th>Niv. 1</th><th>Niv. 2</th><th>Spé. I</th><th>Spé. II</th></tr></thead><tbody>'
    + rows.map(r => '<tr>' + r.map(v => '<td>' + v + '</td>').join('') + '</tr>').join('') + '</tbody></table>'
    + '<p class="fine" style="text-align:left;margin-top:6px">Spé. I et II : stats de base, sans le bonus de la branche choisie (Sol, Air ou Boss).</p>';
}
const gbox = (cls, title, items) => '<div class="' + cls + '"><b>' + title + '</b><ul>' + items.map(i => '<li>' + i + '</li>').join('') + '</ul></div>';

let tIdx = 0, tutoFrom = 'title', demo = null;
function withWorld(w, fn) {
  const sG = G, sP = P, sL = Object.assign({}, L);
  G = w.G; P = w.P; Object.assign(L, w.L);
  try { fn(); } finally { w.G = G; w.P = P; Object.assign(w.L, L); G = sG; P = sP; Object.assign(L, sL); }
}
function sizeDemo(d) {
  const b = d.el.getBoundingClientRect();
  L.w = Math.max(1, b.width); L.h = Math.max(1, b.height); L.dpr = Math.min(2, window.devicePixelRatio || 1); L.portrait = false;
  d.el.width = Math.round(L.w * L.dpr); d.el.height = Math.round(L.h * L.dpr);
  L.cs = Math.min(L.w / 8, L.h / 5); L.ox = (L.w - 8 * L.cs) / 2 - 3 * L.cs; L.oy = (L.h - 5 * L.cs) / 2 - 2 * L.cs;
  buildBg(d.bg);
}
function makeDemo(key, el) {
  const cfg = DEMOS[key], d = { key, cfg, el, ctx: el.getContext('2d'), bg: document.createElement('canvas'), L: { w: 1, h: 1, dpr: 1, cs: 40, ox: 0, oy: 0, portrait: false }, G: null, P: null, lvl: cfg.lvl };
  d.P = buildPath({ pts: [[-1, 4], [14, 4]] });
  withWorld(d, () => {
    G = baseState(0, null); G.bg = d.bg; G.demo = true; G.terrain = null; G.lives = 1e9; G.wave = 3; G.spawnT = -1.2;
    G.deco = genDeco(0);
    sizeDemo(d);
    for (const [t, q, r] of cfg.towers) addTower(t, q, r, cfg.lvl);
  });
  return d;
}
function setDemoLvl(n) {
  if (!demo) return;
  demo.lvl = n;
  for (const t of demo.G.towers) { t.lvl = n; t.s = statsOf(t.type, n); t.recoil = 1; }
  document.querySelectorAll('#uLvls button').forEach(b => b.classList.toggle('on', +b.dataset.l === n));
}
function stepDemo(dt) {
  const d = demo;
  withWorld(d, () => {
    if (!G.spawnQ.length) { for (const type of d.cfg.waves) G.spawnQ.push({ type, gap: d.cfg.gap }); G.spawnT += 1.4; }
    update(dt);
    for (const e of G.enemies) if (e.d < 3) { e.d = 3; setPos(e); }
    G.hurtT = 0; G.baseHit = 0;
    render(d.ctx, d.bg);
  });
}
function openTuto(i = 0) {
  tutoFrom = curScreen;
  if (curScreen === 'game' && G) G.paused = true;
  store.set('elemento.tuto', true);
  show('tuto');
  gotoTuto(i);
}
function closeTuto() { demo = null; if (tutoFrom === 'game') resume(); else show(tutoFrom); }
function gotoTuto(i) {
  tIdx = clamp(i, 0, TUTO.length - 1);
  const pg = TUTO[tIdx], last = tIdx === TUTO.length - 1, ic = prepMini($('#uIcon'), 64, 68);
  let name, tag, tagColor = '#ffd23f', what, gb = '', table = '';
  if (pg.kind === 'tower') {
    const D = TOWERS[pg.tower], I = TINFO[pg.tower];
    name = D.name; tag = D.elem + ' · ' + kindLine(pg.tower) + (D.air ? '' : ' · sol uniquement') + (unlocked(pg.tower) ? '' : ' · à débloquer'); tagColor = D.color; what = '<p style="margin:0">' + I.what + '</p>';
    gb = gbox('good', 'Efficace', I.good) + gbox('bad', 'Attention', I.bad); table = tutoTable(pg.tower);
    drawTower(ic, pg.tower, 32, 40, 54, 1, 0.5, 0, 0.3, 0, false);
  } else if (pg.kind === 'spec') {
    name = pg.title; tag = pg.tag; what = pg.html;
    gb = ['sol', 'boss', 'air'].map((k, i) => gbox(['good', 'bad', 'tip'][i], BRANCH[k].name + ' · ' + BRANCH[k].short, BRANCH[k].ranks.map((x, j) => 'Rang ' + (j ? 'II' : 'I') + ' : ' + x))).join('');
    drawEmblem(ic, 'sol', 16, 44, 13); drawEmblem(ic, 'air', 32, 24, 13); drawEmblem(ic, 'boss', 48, 44, 13);
  } else if (pg.kind === 'terrain') {
    name = pg.title; tag = pg.tag; what = pg.html;
    gb = gbox('good', 'Le terrain préféré de chaque tour', ['Braise : lave +40 %', 'Ondine : eau +40 %', 'Rocaille : roche +40 %', 'Zéphyr : crête venteuse +40 %', 'Voltie : cristaux +40 %', 'Givrette : neige +40 %', 'Colline : +0,6 de portée pour tous']) + gbox('bad', 'Leurs pires terrains', ['Braise : eau et neige −40 %', 'Ondine : sable −40 %, lave −50 %', 'Rocaille : crête venteuse −40 %', 'Zéphyr : cristaux −40 %', 'Voltie : sable −40 %', 'Givrette : sable −40 %, lave −50 %', 'Obstacles : impossible de construire']);
    [['L', 8, 8], ['W', 34, 8], ['V', 8, 34], ['K', 34, 34]].forEach(([k, x, y]) => { rr(ic, x, y, 22, 22, 5); fs(ic, TERRAINS[k].color, 2.5); });
  } else if (pg.kind === 'fusion') {
    name = pg.title; tag = pg.tag; what = pg.html;
    gb = gbox('tip', 'Les recettes', Object.keys(FUSIONS).map(k => '<b>' + FUSIONS[k].elem + '</b> → ' + FUSIONS[k].name + (fusionUnlocked(k) ? ' ✓' : '')));
    drawTower(ic, 'tornade', 32, 40, 54, 1, 0.5, 0, 0.3, 0, false);
  } else if (pg.kind === 'combo') {
    name = pg.title; tag = pg.tag; what = '<p style="margin:0">' + pg.what + '</p>'; gb = gbox('tip', 'Astuces', pg.tips);
    drawTower(ic, pg.towers[0], 19, 46, 36, 1, 0.5, 0.4, 0.3, 0, false); drawTower(ic, pg.towers[1], 45, 46, 36, 1, 1.5, -0.4, 0.3, 0, false);
  } else {
    name = pg.title; tag = pg.tag; what = pg.html;
    if (pg.kind === 'intro') drawBase(ic, 32, 40, 52, 0, 0);
    else { star(ic, 32, 36, 28, 13); fs(ic, '#ffd23f', 3); face(ic, 32, 38, 14, 0, 0, 'open', false, false); }
  }
  $('#uStep').textContent = (tIdx + 1) + ' / ' + TUTO.length;
  $('#uName').textContent = name;
  const tg = $('#uTag'); tg.textContent = tag; tg.style.background = tagColor;
  $('#uWhat').innerHTML = what;
  $('#uGB').innerHTML = gb; $('#uGB').hidden = !gb;
  $('#uTable').innerHTML = table; $('#uTable').hidden = !table;
  $('#uDemoBox').hidden = !pg.demo; $('#uLvls').hidden = pg.kind === 'intro';
  $('#uPrev').disabled = tIdx === 0;
  $('#uNext').textContent = last ? (tutoFrom === 'title' ? 'Jouer !' : 'Terminer') : 'Suivant ▶';
  $('#uDots').querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === tIdx));
  screens.tuto.scrollTop = 0;
  demo = pg.demo ? makeDemo(pg.demo, $('#uDemo')) : null;
  if (demo) setDemoLvl(demo.lvl);
}
TUTO.forEach((pg, i) => {
  const b = document.createElement('button'); b.type = 'button';
  b.setAttribute('aria-label', 'Page ' + (i + 1)); b.addEventListener('click', () => gotoTuto(i));
  $('#uDots').appendChild(b);
});
$('#uPrev').addEventListener('click', () => gotoTuto(tIdx - 1));
$('#uNext').addEventListener('click', () => {
  if (tIdx < TUTO.length - 1) { gotoTuto(tIdx + 1); return; }
  if (tutoFrom === 'title') { demo = null; newGame(0, null, 'facile'); } else closeTuto();
});
$('#uClose').addEventListener('click', closeTuto);
$('#uLvls').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) { Snd.init(); setDemoLvl(+b.dataset.l); } });
$('#tTuto').addEventListener('click', () => { Snd.init(); openTuto(0); });
$('#pTuto').addEventListener('click', () => openTuto(1));
$('#hTuto').addEventListener('click', () => openTuto(1));
$('#iWhat').addEventListener('click', () => { const t = G && G.selTower; if (!t) return; const i = TORDER.indexOf(t.type); openTuto(i >= 0 ? 1 + i : TUTO.findIndex(p => p.kind === 'fusion')); });
new ResizeObserver(() => { if (demo && curScreen === 'tuto') withWorld(demo, () => sizeDemo(demo)); }).observe($('#uDemo'));

// Tableau des terrains
(function () {
  const ks = ['L', 'M', 'S', 'R', 'V', 'N', 'W', 'K'];
  let h = '<table class="ttable"><thead><tr><th>Terrain</th>' + TORDER.map(e => '<th>' + ELNAME[e] + '</th>').join('') + '</tr></thead><tbody>';
  for (const k of ks) {
    const T = TERRAINS[k];
    h += '<tr><td><span class="sw" style="background:' + T.color + '"></span>' + T.name + '</td>' + TORDER.map(e => { const v = T.mods[e] || 0; return '<td class="' + (v > 0 ? 'pos' : v < 0 ? 'neg' : '') + '">' + (v ? fmtAff(v) : '·') + '</td>'; }).join('') + '</tr>';
  }
  $('#hTerr').innerHTML = h + '</tbody></table>';
})();

// Veille & visibilité
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('curScreen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
  catch (e) { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { if (curScreen === 'game') pause(); }
  else if (G) keepAwake();
});

// ================= Boucle =================
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  if (G) {
    if (curScreen === 'game' && !G.paused && !G.over) for (let i = 0; i < G.speed; i++) update(dt);
    else if (G.over) update(dt);
    render(); refreshHUD();
  }
  if (curScreen === 'title') drawShowcase(now / 1000);
  if (curScreen === 'tuto' && demo) stepDemo(dt);
  requestAnimationFrame(frame);
}
new ResizeObserver(() => resize()).observe(stage);

function boot(data) {
  refreshCosts();
  if (document.fonts && document.fonts.load) document.fonts.load('24px Bangers').catch(() => {});
  resize();
  const s = data && data.save;
  const si = saveMapIndex(s);
  if (si >= 0) { newGame(si, s); pause(); }
  else show('title');
  requestAnimationFrame(frame);
}
try { window.claude?.hot?.snapshot?.(() => ({ save: G && !G.over ? G.checkpoint : null })); } catch (e) {}
const hot = window.claude?.hot;
if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
