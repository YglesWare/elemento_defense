// Élémento Defense : Moteur : plateau, état de la partie, vagues, ennemis, tirs, effets et rendu.
'use strict';
// Garantit, sur chaque carte, une zone bonus pour chacune des 6 tours primaires
const BEST_TILE = { feu: 'V', eau: 'L', terre: 'R', vent: 'W', foudre: 'K', glace: 'N' };
function normMap(m, mi, thin) {
  // Les terrains sont dessinés sur l'ancienne grille 14 × 9 : on les agrandit à la grille actuelle
  const old = m.terrain, oh = old.length, ow = old[0].length;
  if (oh !== ROWS || ow !== COLS) m.terrain = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, q) => old[Math.floor(r * oh / ROWS)][Math.floor(q * ow / COLS)]).join(''));
  const cells = buildPath(m).cells, rows = m.terrain.map(r => r.split('')), rnd = mulberry(mi * 97 + 3), cand = [];
  // Allège les cartes : 60 % des petites zones spéciales (6 cases ou moins) redeviennent de l'herbe, et les grandes zones
  // (mer, champs de lave…) perdent une partie de leurs cases collées au chemin. Les obstacles et les collines restent.
  const seen = new Set(), rndT = mulberry(mi * 53 + 11);
  if (thin) for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const ch = rows[r][q], key = q + ',' + r;
    if (ch === '.' || ch === 'X' || ch === 'C' || seen.has(key) || cells.has(key)) continue;
    const comp = [], stack = [[q, r]]; seen.add(key);
    while (stack.length) {
      const [a, b] = stack.pop(); comp.push([a, b]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a2 = a + dx, b2 = b + dy, k2 = a2 + ',' + b2; if (a2 >= 0 && a2 < COLS && b2 >= 0 && b2 < ROWS && !seen.has(k2) && !cells.has(k2) && rows[b2][a2] === ch) { seen.add(k2); stack.push([a2, b2]); } }
    }
    if (comp.length <= 14) { if (rndT() < 0.6) for (const [a, b] of comp) rows[b][a] = '.'; continue; }
    // Grande zone : on garde son cœur, mais 60 % des cases collées au chemin et 25 % des autres redeviennent de l'herbe
    for (const [a, b] of comp) {
      let near = false; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (cells.has((a + dx) + ',' + (b + dy))) near = true;
      if (rndT() < (near ? 0.6 : 0.25)) rows[b][a] = '.';
    }
  }
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    if (cells.has(q + ',' + r) || rows[r][q] !== '.') continue;
    let near = false; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (cells.has((q + a) + ',' + (r + b))) near = true;
    if (near) cand.push([q, r]);
  }
  for (const el of ['feu', 'eau', 'terre', 'vent', 'foudre', 'glace']) {
    const ch = (m.best || BEST_TILE)[el]; if (rows.some(r => r.includes(ch))) continue;
    while (cand.length) {
      const k = Math.floor(rnd() * cand.length), [q, r] = cand.splice(k, 1)[0];
      if (rows[r][q] !== '.') continue;
      rows[r][q] = ch;
      for (const [a, b] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const q2 = q + a, r2 = r + b; if (q2 >= 0 && q2 < COLS && r2 >= 0 && r2 < ROWS && !cells.has(q2 + ',' + r2) && rows[r2][q2] === '.') { rows[r2][q2] = ch; break; } }
      break;
    }
  }
  m.terrain = rows.map(r => r.join(''));
}
MAPS.forEach((m, mi) => normMap(m, mi, true));

// ================= Layout / canvas =================
const stage = $('#stage'), cv = $('#cv'), ctx = cv.getContext('2d'), bgCv = document.createElement('canvas');
const L = { w: 1, h: 1, dpr: 1, cs: 40, cw: CW, ox: 0, oy: 0, portrait: false };
// Deux repères : la grille (cases q, r) et le « monde » (positions des ennemis, portées, vitesses).
// Une case mesure L.cw unités du monde (2/3 en jeu : la grille est plus fine que les distances).
function toScreen(gx, gy) { const k = L.cs / L.cw; return L.portrait ? [L.ox + gy * k, L.oy + gx * k] : [L.ox + gx * k, L.oy + gy * k]; }
const cellXY = (q, r) => toScreen(q * L.cw, r * L.cw);
const cellW = (q, r) => [(q + 0.5) * L.cw, (r + 0.5) * L.cw];
function toGridF(px, py) { const k = L.cs / L.cw; let gx = (px - L.ox) / k, gy = (py - L.oy) / k; if (L.portrait) [gx, gy] = [gy, gx]; return [gx, gy]; }
// Cible d'un glisser-déposer : visée depuis la tour flottante (au-dessus du doigt), avec un effet aimant
function dragTarget(d) {
  const [gx, gy] = toGridF(d.px, d.py - (d.mouse ? 0 : L.cs * 0.75));
  let best = null, bd = Infinity, weak = null, wd = Infinity;
  for (const o of G.towers) {
    if (o === d.t) continue;
    const dist = Math.hypot(o.x - gx, o.y - gy);
    const compat = !TOWERS[d.t.type].fusion && !TOWERS[o.type].fusion && fusionKey(d.t.type, o.type);
    if (compat && dist < (d.mouse ? 0.75 : 1.25) && dist < bd) { bd = dist; best = o; }
    else if (!compat && dist < 0.55 && dist < wd) { wd = dist; weak = o; }
  }
  return best || weak;
}
function toGrid(px, py) { let gx = (px - L.ox) / L.cs, gy = (py - L.oy) / L.cs; if (L.portrait) [gx, gy] = [gy, gx]; return [Math.floor(gx), Math.floor(gy)]; }
function resize() {
  const b = stage.getBoundingClientRect();
  L.w = Math.max(1, b.width); L.h = Math.max(1, b.height); L.dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(L.w * L.dpr); cv.height = Math.round(L.h * L.dpr);
  L.portrait = L.h > L.w * 1.08;
  // Écran de jeu en paysage (css/style.css) : infos à gauche, tours à droite, aperçu de la vague dans la colonne de gauche
  L.land = LAND.matches; landPlace();
  const vc = L.portrait ? ROWS : COLS, vr = L.portrait ? COLS : ROWS;
  const NW = L.land ? 0 : 36; // place réservée sous la carte pour l'aperçu de la prochaine vague
  const TB = G && (G.duel || G.coop) ? 34 : 0; // et au-dessus pour le bandeau des joueurs (duel, coop)
  // Marges serrées (6 px de chaque côté) : le plateau prend presque toute la largeur ou la hauteur, cases plus grandes
  L.cs = Math.max(8, Math.min((L.w - 12) / vc, (L.h - 12 - NW - TB) / vr));
  L.ox = (L.w - vc * L.cs) / 2; L.oy = TB + Math.max(6, (L.h - NW - TB - vr * L.cs) / 2);
  if (G) { buildBg(); for (const e of G.enemies) setPos(e); }
}
const LAND = matchMedia('(orientation:landscape) and (min-aspect-ratio:23/20)');
function landPlace() {
  const nw = $('#nextWave'), inHud = nw.parentNode === $('#hud');
  if (L.land && !inHud) $('#hud').insertBefore(nw, $('#bWave'));
  else if (!L.land && inHud) stage.insertBefore(nw, $('#bBonus'));
}
function dotPattern(c, col, step) {
  const p = document.createElement('canvas'); p.width = p.height = step; const pc = p.getContext('2d');
  pc.fillStyle = col; pc.beginPath(); pc.arc(step / 2, step / 2, step * 0.16, 0, TAU); pc.fill();
  return c.createPattern(p, 'repeat');
}
function buildBg(target = (G && G.bg) || bgCv) {
  target.width = Math.round(L.w * L.dpr); target.height = Math.round(L.h * L.dpr);
  const c = target.getContext('2d'); c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  const m = MAPS[G.map], cs = L.cs;
  c.fillStyle = m.frame; c.fillRect(0, 0, L.w, L.h);
  c.fillStyle = dotPattern(c, m.dot, 10); c.fillRect(0, 0, L.w, L.h);
  const vw = (L.portrait ? ROWS : COLS) * cs, vh = (L.portrait ? COLS : ROWS) * cs, rad = cs * 0.35;
  // En paysage, le fond de la carte se prolonge sous les colonnes (#app, css/style.css)
  if (L.land) { const d = document.documentElement.style; d.setProperty('--frame', m.frame); d.setProperty('--fdot', m.dot); }
  c.save(); rr(c, L.ox, L.oy, vw, vh, rad); c.clip();
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const [x, y] = cellXY(q, r); c.fillStyle = (q + r) % 2 ? m.ground : m.ground2; c.fillRect(x, y, cs + 0.6, cs + 0.6);
  }
  c.fillStyle = dotPattern(c, 'rgba(42,27,61,.06)', 8); c.fillRect(L.ox, L.oy, vw, vh);
  const tch = (q, r) => { if (!G.terrain || !inside(q, r) || P.cells.has(q + ',' + r)) return null; const ch = G.terrain[r][q]; return ch === '.' ? null : ch; };
  drawTerrain(c, cs, tch);
  const sps = P.paths.map(pa => pa.pts.map(([x, y]) => toScreen(x, y)));
  const line = (w, col, dash) => { c.beginPath(); for (const sp of sps) sp.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineWidth = w; c.strokeStyle = col; c.setLineDash(dash || []); c.stroke(); };
  c.lineJoin = 'round'; c.lineCap = 'butt';
  // Toutes les bordures d'abord, puis tous les intérieurs : les embranchements se fondent proprement
  line(cs * 0.9, INK); line(cs * 0.8, m.pathEdge); line(cs * 0.66, m.path);
  line(cs * 0.07, 'rgba(255,255,255,.55)', [cs * 0.15, cs * 0.3]);
  c.setLineDash([]);
  for (const d of G.deco) drawDeco(c, d, cs);
  const obs = [];
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) if (tch(q, r) === 'X') obs.push(cellXY(q + 0.5, r + 0.5));
  obs.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => drawObstacle(c, MAPS[G.map].obstacle, x, y, cs));
  c.restore();
  rr(c, L.ox, L.oy, vw, vh, rad); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
}

// ================= État du jeu =================
let G = null, P = null;
// Une carte a un ou plusieurs itinéraires (portail → maison). Ils peuvent partager des portions (embranchements),
// partir de portails différents et finir dans des maisons différentes. Un point hors de la grille = entrée/sortie par le bord.
function buildPath(m, cw = CW) {
  const cells = new Set(), paths = [], ins = ([q, r]) => q >= 0 && q < COLS && r >= 0 && r < ROWS;
  for (const route of m.paths || [m.pts]) {
    const pts = route.map(([q, r]) => [(q + 0.5) * cw, (r + 0.5) * cw]), segs = [], order = []; let tot = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
      segs.push({ x0, y0, dx: (x1 - x0) / len, dy: (y1 - y0) / len, len, start: tot }); tot += len;
      const [c0, r0] = route[i], [c1, r1] = route[i + 1], n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
      for (let k = i ? 1 : 0; k <= n; k++) { const q = c0 + Math.sign(c1 - c0) * k, r = r0 + Math.sign(r1 - r0) * k; if (ins([q, r])) { cells.add(q + ',' + r); order.push([q, r]); } }
    }
    const pa = { pts, segs, total: tot, d0: ins(route[0]) ? 0 : cw, goal: ins(route[route.length - 1]) ? tot : tot - cw, order };
    pa.portal = pathOn(pa, pa.d0).slice(0, 2); pa.base = pathOn(pa, pa.goal).slice(0, 2);
    paths.push(pa);
  }
  const uniq = (list, tag) => { const keys = []; const out = []; list.forEach((p, i) => { const k = p.map(v => v.toFixed(2)).join(','); let j = keys.indexOf(k); if (j < 0) { j = keys.length; keys.push(k); out.push(p); } if (tag) paths[i][tag] = j; }); return out; };
  return { paths, cells, portals: uniq(paths.map(p => p.portal), 'pk'), bases: uniq(paths.map(p => p.base), 'bk') };
}
function pathOn(pa, d) {
  for (const s of pa.segs) if (d <= s.start + s.len) { const k = d - s.start; return [s.x0 + s.dx * k, s.y0 + s.dy * k, s.dx, s.dy]; }
  const s = pa.segs[pa.segs.length - 1]; return [s.x0 + s.dx * s.len, s.y0 + s.dy * s.len, s.dx, s.dy];
}
const PP = e => P.paths[e.pi || 0] || P.paths[0];
const pathAt = (d, pi = 0) => pathOn(P.paths[pi] || P.paths[0], d);
function genDeco(mi) {
  const m = MAPS[mi], rnd = mulberry((m.rnd ? m.rnd.seed % 100000 : mi) * 977 + 13), list = [];
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const a = rnd(), b = rnd(), ox = rnd(), oy = rnd(), sz = rnd();
    if (P.cells.has(q + ',' + r) || a > 0.13 || (G && G.terrain && G.terrain[r][q] !== '.')) continue;
    list.push({ c: q, r, type: m.deco[Math.floor(b * m.deco.length)], ox: (ox - 0.5) * 0.4, oy: (oy - 0.5) * 0.4, s: 0.75 + sz * 0.4 });
  }
  return list;
}
function baseState(mi, save, diff) {
  const m = MAPS[mi]; diff = (save && save.diff) || diff || 'moyen'; const Df = DIFFS[diff];
  return { map: mi, diff, startLives: Df.lives + Math.round(M('lives') * 2), maxw: Df.waves, hpd: Df.hp, spd: Df.speed, bm: Df.bonus, mm: Df.malus, banked: save ? save.banked || 0 : 0,
    terrain: m.terrain ? diffTerrain(mi, diff) : null, gold: save ? save.gold : Df.gold + Math.round(M('gold') * 25), lives: save ? save.lives : Df.lives + Math.round(M('lives') * 2), wave: save ? save.wave : 0, score: save ? save.score : 0,
    weather: (save && save.weather) || 'clear', bossKills: save ? save.bossKills || 0 : 0, shardsPaid: save ? save.shardsPaid || 0 : 0, shardsWon: save ? save.shardsWon || 0 : 0, won: save ? !!save.won : false, reviveUsed: save ? !!save.reviveUsed : false, adRevived: save ? !!save.adRevived : false,
    endless: save ? !!save.endless : diff === 'infini', ruins: save ? (save.ruins || []).slice() : [], bonusUsed: save ? save.bonusUsed || 0 : 0, bonusAim: null, towers: [], enemies: [], projs: [], fx: [], parts: [], texts: [], zones: [], tors: [], eprojs: [], spawnQ: [], spawnT: 0,
    waveActive: false, speed: 1, paused: false, over: false, time: save ? save.time || 0 : 0, shake: 0, speedLines: 0, hurtT: 0, baseHit: 0, eid: 0, onoCd: {},
    selType: null, selTower: null, hover: null, ghost: null, bad: null, autoT: 0, checkpoint: null };
}
function newGame(mi, save, diff) {
  // Mode histoire (js/story.js) : un rêve, rien n'est compté. Seul storyBattle lance une partie de l'histoire ;
  // si le joueur en est sorti par un autre chemin, la nouvelle partie quitte le rêve et rend la vraie progression.
  const inStory = typeof storyRun !== 'undefined' && storyRun && storyRun.launch;
  if (typeof storyRun !== 'undefined' && storyRun && !storyRun.launch) storyLeave();
  const m = MAPS[mi]; useGrid(m);
  G = baseState(mi, save, diff);
  if (inStory) { G.story = storyRun; storyRun.launch = false; }
  // Défis (js/challenge.js) : le réglage de la carte en solo, ou celui de la sauvegarde ; le multijoueur pose le sien ensuite
  // Piment de la semaine (lancé par weekPlay) et piment imposé de la carte du jour, en plus du réglage de chaque carte
  G.chal = null;
  if (typeof chalStart === 'function' && !duelOn && !G.story && !G.demo) {
    if (chalWeekGo && !save) { G.week = chalWeekGo.id; chalStart(chalWeekGo.c, true); }
    else if (save && save.week) { G.week = save.week; chalStart(save.chal, false); }
    else if (m.daily) chalStart(save ? save.chal : chalDaily(m.daily), !save);
    else if (chalMapOk(mi)) chalStart(save ? save.chal : chalGet(m.id), !save);
  }
  if (typeof chalWeekGo !== 'undefined') chalWeekGo = null;
  P = buildPath(m); G.deco = genDeco(mi);
  if (!save && !G.story) { stats.games++; saveStats(); const h = new Date().getHours(); if (h < 5 && typeof trophy === 'function' && !G.duel) trophy('egg_night'); }
  if (save) for (const t of save.towers) { const nt = addTower(t.type, t.c, t.r, t.up || upFromLvl(t.lvl, t.br), t.mode, t.inv); if (hardMode() && t.hp > 0) nt.hp = Math.min(nt.maxHp, t.hp); }
  saveCheckpoint();
  hudCache = {}; const bp = $('#bonusPop'); if (bp) bp.hidden = true;
  resize(); refreshCosts(); showPanel('palette'); refreshPalette();
  $('#bSpeed').textContent = 'x1';
  show('game'); keepAwake();
  prepNextWave();
  if (save) banner('REPRISE', T('Vague ') + (G.wave + 1) + T(' prête'));
  else {
    banner(T('PRÊT ?'), MAPS[mi].name + ' · ' + DIFFS[G.diff].name + (G.endless ? T(' · vagues infinies') : ' · ' + G.maxw + T(' vagues')) + (G.chal ? ' · 🌶 ' + chalX(G.chal.mult) : ''));
  }
}
function saveCheckpoint() {
  if (G.duel || duelOn || G.coop || G.story) return;
  G.checkpoint = { grid: GRIDV, rnd: MAPS[G.map].rnd || null, map: G.map, mapId: MAPS[G.map].id, diff: G.diff, banked: G.banked, gold: G.gold, lives: G.lives, wave: G.wave, score: G.score, endless: G.endless,
    bossKills: G.bossKills, shardsPaid: G.shardsPaid, shardsWon: G.shardsWon, won: G.won, reviveUsed: G.reviveUsed, adRevived: G.adRevived,
    weather: G.weather, ruins: G.ruins, bonusUsed: G.bonusUsed || 0, time: Math.round(G.time), chal: G.chal ? { m: G.chal.m, sans: G.chal.sans, sur: G.chal.sur, used: G.chal.used } : null, week: G.week || null, towers: G.towers.map(t => ({ type: t.type, c: t.c, r: t.r, up: t.up, mode: t.mode, inv: t.inv, hp: Math.round(t.hp) })) };
  store.set(SAVE, G.checkpoint); store.flush(); // écrite tout de suite : un plantage juste après ne la perd pas
}
// Appli mise en arrière-plan entre deux vagues : on garde les tours posées pendant l'entracte
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && G && !G.over && !G.demo && !G.waveActive && G.wave > 0) saveCheckpoint(); });
function recordBest() {
  if (G.duel || duelOn || G.coop || G.story) return { wave: G.wave, score: G.score };
  // Carte du jour : records gardés jour par jour (les autres cartes aléatoires n'en ont pas)
  if (MAPS[G.map].daily) {
    const all = store.get(DAILY_KEY) || {}, day = (all[MAPS[G.map].daily] = all[MAPS[G.map].daily] || {}), cur = day[G.diff] || { wave: 0, score: 0, won: false };
    const sc = scoreFinal(); // piment du jour compris (le même pour tous)
    if (G.wave > cur.wave || (G.wave === cur.wave && sc > cur.score)) { cur.wave = G.wave; cur.score = sc; }
    if (G.won) cur.won = true;
    day[G.diff] = cur; store.set(DAILY_KEY, all);
    if (typeof dailyQueue === 'function') dailyQueue(MAPS[G.map].daily, G.diff, cur);
    if (typeof trophyDaily === 'function') trophyDaily();
    return cur;
  }
  if (MAPS[G.map].random) return { wave: G.wave, score: G.score };
  const b = store.get(BEST2) || {}, id = recId(MAPS[G.map]), rec = (b[id] = b[id] || {}), cur = rec[G.diff] || { wave: 0, score: 0, won: false }, sc = scoreFinal();
  if (G.wave > cur.wave || (G.wave === cur.wave && sc > cur.score)) { cur.wave = G.wave; cur.score = sc; }
  if (typeof chalRecord === 'function') chalRecord();
  if (G.won) cur.won = true;
  rec[G.diff] = cur; store.set(BEST2, b);
  return cur;
}
// Or envoyé dans la cagnotte en fin de partie : ECO.bankWin en cas de victoire, ECO.bankKo en cas de K.O., rien en cas d'abandon
function bankGold(rate = 1) {
  const left = Math.max(0, G.gold - (G.banked || 0)), gain = Math.floor(left * rate);
  G.banked = Math.max(G.banked || 0, G.gold);
  meta.bank = (meta.bank || 0) + gain; saveMeta();
  return { gain, lost: left - gain, rate, total: meta.bank };
}

// ---------- Tours ----------
const towerAt = (q, r) => G.towers.find(t => t.c === q && t.r === r);
const inside = (q, r) => q >= 0 && r >= 0 && q < COLS && r < ROWS;
const canBuild = (q, r) => inside(q, r) && !P.cells.has(q + ',' + r) && !towerAt(q, r) && !ruinAt(q, r) && !(terrainAt(q, r) || {}).block;
// Difficile : une tour à 0 PV est détruite (ruines qui bloquent la case), on la soigne en or, elle se régénère un peu pendant les vagues
const hardMode = () => !!G && G.diff === 'difficile' && !G.demo;
const ruinAt = (q, r) => !!(G && G.ruins && G.ruins.some(u => u.c === q && u.r === r));
const REGEN = 0.01; // part des PV max régénérée par seconde pendant une vague
const healCost = t => (t.dead || t.hp >= t.maxHp ? 0 : Math.max(5, Math.round((1 - t.hp / t.maxHp) * t.inv * 0.5)));
function healPaid(t) {
  const cost = healCost(t); if (!cost || !hardMode()) return;
  if (G.gold < cost) { hint(T('Pas assez d’or pour soigner')); Snd.play('no'); return; }
  if (G.coopGuest) { coopAct({ a: 'heal', id: t.id }); return; }
  G.gold -= cost; t.hp = t.maxHp;
  burst(t.x, t.y, 0.4, 12, ['#5cd86a', '#ffffff', '#b8f5c0'], 2.2, 0.08, 2, 0.6, 'star'); ono(T('SOIGNÉE !'), t.x, t.y, '#5cd86a', 0.45, 0, 0.9); Snd.play('up');
  if (typeof refreshInfo === 'function') { hudCache.info = null; refreshInfo(); }
}
function destroyTower(t) {
  t.hp = 0; t.dead = true; G.towers = G.towers.filter(x => x !== t); G.ruins.push({ c: t.c, r: t.r, type: t.type, up: Object.assign({}, t.up), mode: t.mode, inv: t.inv });
  if (G.selTower === t && typeof deselect === 'function') deselect();
  if (G.drag && G.drag.t === t) G.drag = null;
  ono(T('DÉTRUITE !'), t.x, t.y, '#ff4f6e', 0.55, 0, 1.1); Snd.play('hurt'); G.shake = Math.max(G.shake, 0.3);
  burst(t.x, t.y, 0.3, 18, ['#8e8aa0', '#cdbfe0', TOWERS[t.type].color], 2.6, 0.1, 3, 0.7);
  hint(TOWERS[t.type].name + T(' est détruite : ses ruines bloquent la case.'), 2600);
}
function terrainAt(q, r) {
  if (!G || !G.terrain || !inside(q, r) || P.cells.has(q + ',' + r)) return null;
  return TERRAINS[G.terrain[r][q]] || null;
}
// En coop, une tour utilise les améliorations de l'Atelier de son propriétaire
function towerStats(t) { return G && G.coop && t.own && t.own !== coopMe() ? withLv(coopLv(t.own), () => towerStats0(t)) : towerStats0(t); }
function towerStats0(t) {
  const st = statsOf(t.type, t.up), T = terrainAt(t.c, t.r), B = G && !G.demo ? MAPS[G.map].biome : null;
  let a = 0;
  if (T && !T.block) { st.terr = T; st.aff = affinity(t.type, T); a += st.aff; if (T.range) st.range += T.range; }
  if (B) { st.bio = affinity(t.type, B); a += st.bio; }
  const Wt = G && !G.demo && G.weather && G.weather !== 'clear' && !(G.weather === 'fog' && G.fogClear > 0) ? WEATHERS[G.weather] : null;
  if (Wt) { st.wea = affinity(t.type, Wt); a += st.wea; if (Wt.range) st.range = Math.max(1, st.range + Wt.range); }
  a = clamp(a, -0.6, 0.6); st.affTot = a;
  if (a) { const m = Math.max(0.1, 1 + a); st.dmg *= m; for (const k of ['burn', 'lava', 'poison']) if (st[k]) st[k] *= m; }
  // Tours réchauffées (frotter l'écran pendant un blizzard) : cadence +20 %
  if (G && G.warmT > 0) st.rate *= 1.2;
  if (G && G.chal && chalLv('longue')) st.range *= 1 + 0.05 * chalLv('longue');
  if (G && G.chal && chalLv('brume')) st.range *= 0.85;
  return st;
}
// up : les achats de la tour ({ dmg, rng, … }) ; un nombre (ancien niveau 1 à 4) est converti
function addTower(type, q, r, up, mode = 'premier', inv, br) {
  const [wx, wy] = cellW(q, r);
  const t = { id: (G.tid = (G.tid || 0) + 1), own: G.coop ? coopActor() : null, type, c: q, r, x: wx, y: wy, mode, inv: inv || costOf(type), cd: 0.3, recoil: 0, blink: rand(1, 4), lx: 0, ly: 0.3, pulses: 0 };
  setUp(t, typeof up === 'number' ? upFromLvl(up, br) : up);
  t.s = towerStats(t); healTower(t, true); refillShield(t); t.ko = 0; t.stun = 0; G.towers.push(t);
  const n = G.deco.length; G.deco = G.deco.filter(d => !(d.c === q && d.r === r)); if (n !== G.deco.length && L.w > 1) buildBg();
  return t;
}
// Achats d'une tour : t.lvl (allure, 1 à 4) et t.br (spécialité la plus achetée) en découlent, pour le dessin
function setUp(t, up) { t.up = upOf(up); t.lvl = upStage(t.up); t.br = upSpec(t.up); }
function build(type, q, r) {
  const D = TOWERS[type], cost = costOf(type); G.gold -= cost;
  const t = addTower(type, q, r); t.recoil = 1; t.builtAt = G.time;
  if (G.chal && chalLv('pouce') && !G.chal.used && !D.fusion) { G.chal.used = true; setUp(t, { dmg: 2, rng: 2, rate: 2 }); t.s = towerStats(t); healTower(t, true); ono(T('🎁 +2 PARTOUT !'), t.x, t.y - 0.4, '#ffd23f', 0.5, 0, 1.2); } if (!G.demo && !G.story) { stats.towers++; if (typeof questEvent === 'function') questEvent('tower'); }
  burst(t.x, t.y, 0.1, 12, ['#ffffff', '#f1eafa', D.color], 2.2, 0.09, 3, 0.5, 'star');
  ono('POP!', t.x, t.y, '#fff', 0.45, 0.1, 0.9);
  Snd.play('build'); G.ghost = null;
  if (G.gold < cost) { G.selType = null; refreshPalette(); }
}
// Achat d'un niveau (k : 'dmg', 'rng', 'rate', 'sol', 'air' ou 'boss')
const trackLocked = k => (k === 'sol' || k === 'air' || k === 'boss') && typeof storyLocked === 'function' && storyLocked('spec');
function upgrade(t, k) {
  if (!TRACK[k] || trackLocked(k)) return;
  if ((t.up[k] || 0) >= towerCap(t, k)) { hint(TRACK[k].name + T(' : maximum atteint. La Maîtrise, la Longue-vue et le Sablier de l’Atelier relèvent ce plafond.'), 2600); Snd.play('no'); return; }
  const cost = trackPrice(t.type, t.up, k);
  if (G.gold < cost) { hint(T('Pas assez d’or pour améliorer')); Snd.play('no'); return; }
  if (G.coopGuest) { coopAct({ a: 'up', id: t.id, k }); return; }
  G.gold -= cost; upApply(t, k, cost);
  ono(TRACK[k].ic + ' ' + TRACK[k].name.toUpperCase() + ' ' + t.up[k] + ' !', t.x, t.y, '#ffd23f', 0.6, 0, 1.2);
  Snd.play('up'); refreshInfo(); if (typeof renderUpSheet === 'function') renderUpSheet();
}
// Plafond d'un achat pour cette tour (en coop : l'Atelier de son propriétaire)
function towerCap(t, k) { return G && G.coop && t.own && t.own !== coopMe() ? withLv(coopLv(t.own), () => upCap(t.type, k)) : upCap(t.type, k); }
// Le niveau en plus, ses effets et sa petite fête (aussi utilisé par l'hôte en coop)
function upApply(t, k, cost) {
  const st0 = t.lvl; t.up[k] = (t.up[k] || 0) + 1; setUp(t, t.up); t.inv += cost; t.s = towerStats(t); t.recoil = 1; if (!(t.ko > 0)) healTower(t, !hardMode());
  const col = t.br ? BRANCH[t.br].color : TOWERS[t.type].color;
  burst(t.x, t.y, 0.4, 12, ['#ffd23f', '#ffffff', col], 2.4, 0.1, 2, 0.6, 'star');
  G.fx.push({ kind: 'ring', gx: t.x, gy: t.y, r0: 0.2, r1: 1.2, t: 0, dur: 0.45, color: '#ffd23f' });
  // Nouvelle allure (6, 15 puis 30 achats) : la grande fête, rayon de lumière et tour qui gonfle
  if (t.lvl > st0) { G.fx.push({ kind: 'beam', gx: t.x, gy: t.y, t: 0, dur: 0.9, color: col }); t.upT = G.time; }
}
function evolve(t) { if (typeof openUpSheet === 'function') openUpSheet(t); }
function sell(t) {
  if (typeof chalNoSell === 'function' && chalNoSell()) { Snd.play('no'); hint(T('Pas de remboursement 🔒 : le piment interdit de vendre'), 2200); return; }
  if (G.coopGuest) { coopAct({ a: 'sell', id: t.id }); deselect(); return; }
  if (t.builtAt != null && G.time - t.builtAt < 3 && typeof trophy === 'function') trophy('egg_regret');
  const v = sellValue(t); G.gold += v;
  G.towers = G.towers.filter(x => x !== t);
  burst(t.x, t.y, 0.3, 12, ['#cdbfe0', '#ffffff', '#ffd23f'], 2, 0.09, 3, 0.5);
  G.texts.push({ txt: '+' + v, gx: t.x, gy: t.y, oy: -0.5, t: 0, dur: 0.9, color: '#ffd23f', size: 0.36, rot: 0 });
  Snd.play('sell'); deselect();
}

// ---------- Vagues ----------
const EVMOB = {
  halloween: { type: 'spectre', from: 5, label: T('Nuit des Spectres !') },
  noel: { type: 'cadeau', from: 6, label: T('Hotte renversée !') },
  paques: { type: 'lapin', from: 4, label: T('Course aux lapins !') },
  valentin: { type: 'calinou', from: 6, label: T('Câlins en série !') },
  nouvelan: { type: 'hongbao', from: 3, label: T('Pluie d’enveloppes rouges !') },
};
function makeWave(w) {
  if (G && G.story && typeof storyWave === 'function') return storyWave(w);
  const pool = ['gloop', 'gloop'];
  if (w >= 3) pool.push('zip'); if (w >= 4) pool.push('flappy'); if (w >= 6) pool.push('tonk'); if (w >= 8) pool.push('magma'); if (w >= 7) pool.push('gresil'); if (w >= 9) pool.push('crachou');
  // Monstre propre à chaque événement, et sa vague spéciale (15, 25, 35…)
  const ev = evt(), EV = ev && EVMOB[ev], fe = EV && G && G.chal ? chalLv('f_' + ev) : 0;
  if (EV && (w >= EV.from || fe)) pool.push(EV.type, EV.type);
  for (let i = 0; i < 2 * fe; i++) pool.push(EV.type); // piment de l'événement : son monstre dès la 1re vague, de plus en plus
  let theme = null, label = '';
  if (w % 10 === 0) label = BOSSAPP[ev] || (zoneSkin('boss') || {}).app || T('Un Kaiju approche...');
  else if (EV && w >= 5 && w % 10 === 5) { theme = EV.type; label = EV.label; }
  else if (w >= 4 && w % 5 === 4) { theme = 'flappy'; label = T('Nuée de Flappy !'); }
  else if (w >= 7 && w % 7 === 0) { theme = 'zip'; label = T('Ruée de Zippy !'); }
  else if (w >= 6 && w % 6 === 0) { theme = 'tonk'; label = T('Parade de Tonk !'); }
  else if (w >= 8 && w % 8 === 3) { theme = 'magma'; label = T('Pluie de Magmo !'); }
  let n = Math.round((6 + w * 1.5) * (G && G.coop ? 1 + 0.3 * (G.coopN - 1) : 1));
  if (theme === 'tonk') n = Math.round(n * 0.55); if (theme === 'zip') n = Math.round(n * 1.4);
  if (G && G.chal) n = Math.round(n * (1 + 0.05 * chalLv('horde')));
  const gap = Math.max(0.32, 0.95 - w * 0.017), list = [];
  for (let i = 0; i < n; i++) {
    const type = theme && Math.random() < 0.75 ? theme : pick(pool);
    list.push({ type, gap: gap * (type === 'zip' ? 0.55 : type === 'tonk' ? 1.5 : 1) });
  }
  if (w >= 12) { const k = 1 + Math.floor((w - 12) / 8); for (let i = 0; i < k; i++) list.splice(Math.floor(rand(list.length)), 0, { type: 'malefik', gap: 1.2 }); }
  if (w % 10 === 0) { list[list.length - 1].gap = 2.5; for (let i = 0; i < Math.floor(w / 10); i++) list.push({ type: 'boss', gap: 3 }); }
  // Portails actifs pour cette vague : un seul au début, de plus en plus ensuite, tous pour les boss.
  // En Facile, le tirage est fixe pour chaque carte (on peut l'apprendre) ; dès le Moyen, il change à chaque partie.
  const m0 = MAPS[G.map], prng = G.diff === 'facile' && !G.duel && !G.coop ? mulberry(hashStr((m0.rnd ? m0.rnd.seed : m0.id) + ':' + w)) : Math.random;
  const np = P ? P.portals.length : 1, ids = [...Array(np).keys()];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(prng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  // Portails fous (piment) : tous les portails à chaque vague, et chaque ennemi prend un itinéraire au hasard
  const wild = np > 1 && G && G.chal && chalLv('portail');
  const k = w % 10 === 0 || wild ? np : w <= 2 ? 1 : clamp(1 + Math.floor(prng() * (1 + w / 6)), 1, np), portals = ids.slice(0, k).sort();
  const routes = P ? P.paths.map((pa, i) => i).filter(i => portals.includes(P.paths[i].pk || 0)) : [0];
  const r0 = Math.floor(prng() * routes.length);
  list.forEach((it, i) => { it.pi = it.type === 'boss' || wild ? routes[Math.floor((wild ? Math.random() : prng()) * routes.length)] : routes[(r0 + i) % routes.length]; });
  return { list, label, portals };
}
// Délai avant la vague suivante (compté à partir de la sortie du dernier ennemi), selon la difficulté ; null = pas de chrono
function waveTimer() {
  const t = DIFFS[G.diff] && DIFFS[G.diff].timer;
  if (!t || G.duel || (!G.endless && G.wave >= G.maxw)) return null;
  const v = typeof t === 'function' ? t(G.wave) : t;
  if (!G.chal || v == null) return v;
  if (chalLv('calme')) return null;
  return Math.max(5, Math.round(v * (1 - 0.2 * chalLv('chrono'))));
}
// La prochaine vague est tirée à l'avance : l'aperçu montre exactement ce qui va arriver
function prepNextWave() {
  G.nextWave = (!G.endless && G.wave >= G.maxw) ? null : Object.assign({ n: G.wave + 1 }, makeWave(G.wave + 1));
  // Mode histoire : pas de météo au hasard, seulement celle écrite dans le chapitre (storyWave)
  const per = G.chal && chalLv('meteo') ? 3 : 5; // Ciel capricieux (piment) : toutes les 3 vagues
  if (G.nextWave && !G.story && !(G.chal && chalLv('soleil')) && G.nextWave.n > 1 && (G.nextWave.n - 1) % per === 0) {
    const pool = (WEATHER_POOL[MAPS[G.map].wid || MAPS[G.map].id] || ['clear']).filter(w => w !== G.weather);
    G.nextWave.weather = pool.length ? pick(pool) : 'clear';
  }
  if (typeof renderNextWave === 'function') renderNextWave();
  if (G.coop && !G.coopGuest) coopNextWave();
}
function takeWave(n) {
  const w = G.nextWave && G.nextWave.n === n ? G.nextWave : makeWave(n);
  G.wave = n; G.curPortals = w.portals; prepNextWave();
  if (w.weather && w.weather !== G.weather) setWeather(w.weather);
  return w;
}
function setWeather(k) {
  if (!WEATHERS[k] || G.demo) return;
  G.weather = k; G.wT = 0;
  for (const t of G.towers) t.s = towerStats(t);
  if (typeof refreshCosts === 'function') refreshCosts();
  const W = WEATHERS[k];
  setTimeout(() => { if (G && !G.over && G.weather === k) banner(W.icon + ' ' + W.name.toUpperCase(), W.desc); }, 2400);
}
// Effets de la météo pendant la partie, et particules à l'écran (en coordonnées relatives à l'écran)
function weatherTick(dt) {
  const k = G.weather; if (G.demo) return;
  G.wp = G.wp || [];
  const want = { rain: 90, thunder: 90, shower: 60, blizzard: 70, storm: 34, petals: 40 }[k] || 0;
  while (G.wp.length < want) G.wp.push({ x: Math.random(), y: Math.random(), s: rand(0.7, 1.3) });
  if (G.wp.length > want) G.wp.length = want;
  for (const p of G.wp) {
    if (k === 'rain' || k === 'thunder' || k === 'shower') { p.y += 1.1 * dt * p.s; p.x += 0.12 * dt; }
    else if (k === 'petals') { p.y += 0.1 * dt * p.s; p.x += 0.06 * dt + Math.sin(G.time * 2 + p.s * 7) * 0.04 * dt; }
    else if (k === 'blizzard') { p.y += 0.12 * dt * p.s; p.x += Math.sin(G.time * 1.5 + p.s * 9) * 0.03 * dt + 0.03 * dt; }
    else if (k === 'storm') { const w = G.windS; if (w && w.m > 0.05) { const v = (0.4 + 1.4 * w.m) * dt * p.s; p.x += w.x * v; p.y += w.y * v; } else { p.x += 1.4 * dt * p.s; p.y += 0.05 * dt; } }
    if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); } if (p.x > 1.05) { p.x = -0.05; p.y = Math.random(); }
    if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); } if (p.x < -0.05) { p.x = 1.05; p.y = Math.random(); }
  }
  if (G.flashT > 0) G.flashT -= dt;
  if (!k || k === 'clear') return;
  G.wT = (G.wT || 0) - dt;
  if ((k === 'rain' || k === 'shower') && G.wT <= 0) { G.wT = 1.5; for (const e of G.enemies) if (!e.dead) e.wet = Math.max(e.wet, 1.6); }
  if (k === 'fireworks' && G.wT <= 0) {
    G.wT = 2.6; const al = G.enemies.filter(e => !e.dead);
    if (al.length) {
      const e = pick(al), up = (e.flying ? FLY : 0) + 0.2;
      burst(e.x, e.y, up + 0.4, 18, ['#ffd23f', '#ff4f6e', '#7fd6ff', '#ffffff'], 3, 0.09, 1, 0.7, 'star');
      hurt(e, 16 + G.wave * 2.5, 'feu'); ono('BOUM!', e.x, e.y, '#ffd23f', 0.5, 0.5, up + 0.7); Snd.play('boom');
    }
  }
  if (k === 'thunder' && G.wT <= 0) {
    G.wT = 3.2; const al = G.enemies.filter(e => !e.dead);
    if (al.length) {
      const e = pick(al), up = (e.flying ? FLY : 0) + 0.2;
      G.fx.push({ kind: 'bolt', pts: [{ gx: e.x, gy: e.y, up: 5 }, { gx: e.x + 0.1, gy: e.y, up: 2.5 }, { gx: e.x, gy: e.y, up }], t: 0, dur: 0.3 });
      G.flashT = 0.18; hurt(e, 20 + G.wave * 3, 'foudre'); ono('CRAC!', e.x, e.y, '#ffe34d', 0.5, 0.5, up + 0.7); Snd.play('foudre');
    }
  }
}
function drawWeather(c) {
  const k = G.weather; if (!k || k === 'clear' || G.demo) return;
  c.save();
  if (k === 'heat') { c.fillStyle = 'rgba(255,150,50,.10)'; c.fillRect(0, 0, L.w, L.h); }
  if (k === 'thunder') { c.fillStyle = 'rgba(30,30,70,.14)'; c.fillRect(0, 0, L.w, L.h); }
  if (k === 'aurora') {
    c.save(); c.globalAlpha = 0.28;
    for (let i = 0; i < 3; i++) {
      const g = c.createLinearGradient(0, 0, L.w, 0); g.addColorStop(0, 'rgba(90,255,180,0)'); g.addColorStop(0.5, ['#5affb4', '#7fd6ff', '#c79bff'][i]); g.addColorStop(1, 'rgba(90,255,180,0)');
      c.beginPath(); for (let x = 0; x <= L.w; x += 12) { const y = 40 + i * 26 + Math.sin(x * 0.012 + G.time * 0.6 + i * 2) * 18; x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.lineWidth = 18 - i * 4; c.strokeStyle = g; c.stroke();
    }
    c.restore();
  }
  if (k === 'rainbow') {
    c.save(); c.globalAlpha = 0.3; const cx = L.w * 0.5, cy = L.h * 0.95, R = Math.max(L.w, L.h) * 0.75;
    ['#ff4f6e', '#ff9a3d', '#ffd23f', '#5cd86a', '#6cc6ff', '#b57bff'].forEach((col, i) => { c.beginPath(); c.arc(cx, cy, R - i * 9, Math.PI, TAU); c.lineWidth = 9; c.strokeStyle = col; c.stroke(); });
    c.restore();
  }
  if (k === 'fireworks') { c.fillStyle = 'rgba(30,10,40,.12)'; c.fillRect(0, 0, L.w, L.h); }
  if (k === 'moon') {
    c.fillStyle = 'rgba(20,10,50,.16)'; c.fillRect(0, 0, L.w, L.h);
    const mx = L.w - 34, my = 34, g = c.createRadialGradient(mx, my, 6, mx, my, 70); g.addColorStop(0, 'rgba(255,240,190,.5)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = g; c.fillRect(mx - 70, my - 70, 140, 140);
    c.beginPath(); c.arc(mx, my, 16, 0, TAU); c.fillStyle = '#fff3c4'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.fillStyle = 'rgba(200,180,120,.6)'; for (const [a, b, q] of [[-5, -4, 4], [5, 3, 3], [-2, 7, 2.2]]) { c.beginPath(); c.arc(mx + a, my + b, q, 0, TAU); c.fill(); }
    for (let i = 0; i < 2; i++) {
      const bx = ((G.time * (0.05 + i * 0.03) + i * 0.5) % 1.2 - 0.1) * L.w, by = 60 + i * 50 + Math.sin(G.time * 2 + i) * 14, f = Math.sin(G.time * 16 + i * 2) * 5;
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx - 7, by - 6 - f, bx - 14, by - f); c.quadraticCurveTo(bx - 7, by - 2, bx, by + 2);
      c.quadraticCurveTo(bx + 7, by - 2, bx + 14, by - f); c.quadraticCurveTo(bx + 7, by - 6 - f, bx, by); c.fillStyle = 'rgba(42,27,61,.75)'; c.fill();
    }
  }
  if (k === 'fog' && (G.fogA ?? 1) > 0.01) {
    c.globalAlpha = G.fogA ?? 1;
    const g = c.createLinearGradient(0, 0, 0, L.h); g.addColorStop(0, 'rgba(245,248,255,.42)'); g.addColorStop(0.5, 'rgba(245,248,255,.22)'); g.addColorStop(1, 'rgba(245,248,255,.4)');
    c.fillStyle = g; c.fillRect(0, 0, L.w, L.h); c.globalAlpha = 1;
  }
  c.lineCap = 'round';
  for (const p of G.wp || []) {
    const x = p.x * L.w, y = p.y * L.h;
    if (k === 'petals') { c.save(); c.translate(x, y); c.rotate(G.time * 2 + p.s * 5); c.beginPath(); c.ellipse(0, 0, 4 * p.s, 2.4 * p.s, 0, 0, TAU); c.fillStyle = 'rgba(255,170,205,.85)'; c.fill(); c.restore(); }
    else if (k === 'rain' || k === 'thunder' || k === 'shower') { c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y - 12 * p.s); c.lineWidth = 1.6; c.strokeStyle = 'rgba(200,230,255,.6)'; c.stroke(); }
    else if (k === 'blizzard') { c.beginPath(); c.arc(x, y, 1.6 + p.s, 0, TAU); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill(); }
    else if (k === 'storm') { const w = G.windS && G.windS.m > 0.05 ? G.windS : { x: 1, y: 0.05, m: 0 }, l = 40 * p.s * (0.7 + w.m); c.beginPath(); c.moveTo(x, y); c.lineTo(x - w.x * l, y - w.y * l); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,' + (0.4 + w.m * 0.3) + ')'; c.stroke(); }
  }
  if (G.flashT > 0) { c.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, G.flashT * 3) + ')'; c.fillRect(0, 0, L.w, L.h); }
  c.restore();
}
function startWave(forced) {
  if (!G || G.over || G.spawnQ.length || G.duel) return;
  // Dernière vague déjà lancée : on attend la fin de la partie (victoire, puis choix des vagues infinies)
  if (!G.endless && G.wave >= G.maxw) return;
  if (G.story && typeof storyMustPlace === 'function' && storyMustPlace()) return;
  if (G.coopGuest) { if (!forced) coopAct({ a: 'wave' }); return; }
  // Sauvegarde juste avant la vague, avec les tours posées et améliorées pendant l'entracte (reprise après un plantage)
  if (!G.waveActive && !G.demo) saveCheckpoint();
  let early = 0;
  if (!forced && G.waveActive && G.enemies.length) { early = 5 + Math.floor(G.wave / 2); if (G.coop) coopGiveAll(early); else G.gold += early; }
  G.wave++;
  const { list, label } = takeWave(G.wave);
  if (G.story && typeof storyWaveStart === 'function') storyWaveStart(G.wave);
  for (const t of G.towers) if (!(t.ko > 0)) t.shield = Math.max(t.shield || 0, Math.round(t.maxHp * 0.15 * M('bouclier')));
  G.spawnQ.push(...list); G.spawnT = 0.5; G.waveActive = true; G.autoT = 0;
  G.chronoT = null; G.chronoArmed = true;
  const last = G.wave === G.maxw && !G.endless;
  banner(T('VAGUE ') + G.wave, early ? T('Bonus d’audace +') + early : (last ? T('Dernière vague !') : label), false);
  Snd.play('wave');
  if (G.coop) coopWaveStart(early, last ? T('Dernière vague !') : label);
}
function waveDone() {
  if (G.duel) { G.waveActive = false; return; }
  G.waveActive = false;
  for (const t of G.towers) { healTower(t, !hardMode()); t.ko = 0; t.stun = 0; t.evil = 0; t.hitBy = null; refillShield(t); }
  const bonus = Math.round((10 + G.wave) * (1 + 0.2 * M('bonus'))); G.gold += bonus; G.score += G.wave * 50;
  if (G.coop) coopWaveDone();
  G.partyUntil = G.time + 2.4;
  const aw = awardShards();
  hint(T('Vague ') + G.wave + ' : +' + bonus + T(' or') + (aw.gain ? ', +' + aw.gain + T(' éclats') : '') + (canBuyAnything() ? T(' · achat possible dans l’Atelier') : ''), 3200);
  Snd.play('clear');
  saveCheckpoint(); recordBest(); if (!G.story) { stats.waves++; saveStats(); } if (typeof questEvent === 'function') questEvent('wave'); if (G.story && typeof storyWaveEnd === 'function') storyWaveEnd(G.wave);
  if (typeof trophy === 'function') { if (G.diff === 'infini' && G.wave >= 30) trophy('inf_30'); if (G.diff === 'infini' && G.wave >= 50) trophy('inf_50'); trophyScan(); }
  if (G.wave >= G.maxw && !G.endless) { setTimeout(() => victory(), 700); return; }
  if (opts.auto) G.autoT = 3;
}
function awardShards() {
  const mult = MAPS[G.map].shards * DIFFS[G.diff || 'moyen'].shards;
  const parts = { wave: G.wave * 2, score: Math.floor(G.score / 400), boss: G.bossKills * 5, win: G.won ? 30 : 0 };
  const total = Math.round((parts.wave + parts.score + parts.boss + parts.win) * mult * ECO.shards);
  const gain = Math.max(0, total - G.shardsPaid), before = G.shardsPaid;
  G.shardsPaid += gain; meta.shards += gain; meta.earned += gain; saveMeta();
  return { gain, parts, mult, before };
}
// Abandon : la partie ne rapporte rien, on reprend les éclats versés à chaque vague (sauf ceux acquis par une victoire)
function revokeShards() {
  const lost = Math.max(0, G.shardsPaid - (G.shardsWon || 0)), taken = Math.min(lost, meta.shards);
  meta.shards -= taken; meta.earned = Math.max(0, (meta.earned || 0) - lost); G.shardsPaid -= lost; saveMeta();
  return taken; // jamais plus que ce qu'il reste : le compteur d'éclats ne passe pas sous 0
}
function victory() {
  if (!G || G.over) return;
  if (G.coop) { coopEnd(true); return; }
  if (G.story) { storyWin(); return; }
  G.paused = true; G.won = true; G.endless = true; Snd.play('win');
  const best = recordBest(), award = awardShards(), bank = bankGold(ECO.bankWin); G.shardsWon = G.shardsPaid; saveCheckpoint(); stats.wins++; saveStats();
  if (typeof logGame === 'function') logGame('won', award);
  if (typeof questEvent === 'function') { const d = { diff: G.diff, daily: !!MAPS[G.map].daily, types: [...new Set(G.towers.map(t => t.type))], lostLife: !!G.lostLife }; questEvent('win', d); questEvent('end', d); }
  if (typeof trophyWin === 'function') trophyWin();
  showOver(true, best, award, bank);
}
function gameOver() {
  if (G.duel) { duelDead('ko'); return; }
  if (G.coop) { if (!G.coopGuest) coopEnd(false); return; }
  if (G.story) { storyLose(); return; }
  G.over = true; G.lives = 0; Snd.play('ko');
  const best = recordBest(), award = awardShards(), bank = bankGold(ECO.bankKo); store.del(SAVE); stats.ko++; saveStats();
  if (typeof logGame === 'function') logGame('ko', award);
  if (typeof questEvent === 'function') questEvent('end', { daily: !!MAPS[G.map].daily });
  setTimeout(() => { if (G && G.over) showOver(false, best, award, bank); }, 1300);
}

// ---------- Ennemis ----------
function spawn(type, pi) {
  const D = ETYPES[type], w = G.wave, m = hpMul(w) * mapHpFor(G.map, G.diff) * (G.hpd || 1) * (G.coopHp || 1) * (G.chal ? chalHp() : 1);
  const e = { id: ++G.eid, type, hp: D.hp * m, maxHp: D.hp * m, speed: D.speed * rand(0.95, 1.05) * (G.spd || 1) * (G.chal ? chalSpd() : 1),
    armor: (D.armor ? D.armor + Math.floor(w / 10) : 0) + (G.chal ? chalLv('armure') : 0), flying: !!D.flying, d: 0, x: 0, y: 0, sdx: 1, sdy: 0,
    slowA: 0, slowT: 0, wet: 0, burn: 0, burnT: 0, frozen: 0, stun: 0, flash: 0, phase: rand(TAU), dead: false, lifeCost: D.lifeCost ?? 1, abT: 1.2 };
  // Les ennemis se répartissent à tour de rôle entre les itinéraires (les boss au hasard)
  e.pi = pi != null && P.paths[pi] ? pi : D.boss ? Math.floor(rand(P.paths.length)) : (G.rr = ((G.rr || 0) + 1) % P.paths.length);
  e.d = PP(e).d0;
  if (type === 'spectre') { e.gcy = rand(1, 2.5); e.ghost = 0; }
  else if (G.chal && chalLv('fantome')) { e.gcy = rand(2, 6); e.ghost = 0; e.ghostAll = true; } // Fantômes (piment)
  if (type === 'lapin') e.jT = rand(1.5, 3);
  if (type === 'calinou') e.abT = rand(1, 2.5);
  setPos(e); G.enemies.push(e);
  if (typeof introMob === 'function' && !G.coopGuest) introMob(type);
  if (D.boss) {
    G.speedLines = 1.5; G.shake = Math.max(G.shake, 0.5);
    banner((BOSSNAME[evt()] || (zoneSkin('boss') || {}).up || 'KAIJU') + ' !!', T('Le boss débarque'), true); Snd.play('boss');
  }
}
function spawnAt(type, k, d, pi) {
  for (let i = 0; i < k; i++) { const n = G.enemies.length; spawn(type, pi); const p = G.enemies[n]; if (p) { p.d = Math.max(PP(p).d0, d - i * 0.35); setPos(p); } }
}
function setPos(e) {
  const [x, y, dx, dy] = pathOn(PP(e), e.d); e.x = x; e.y = y;
  if (L.portrait) { e.sdx = dy; e.sdy = dx; } else { e.sdx = dx; e.sdy = dy; }
}
const THP = { feu: 100, eau: 100, terre: 160, vent: 90, foudre: 110, glace: 120 };
const towerMaxHp = t => Math.round((THP[t.type] || 180) * (1 + 0.25 * (t.lvl - 1)) * (1 + 0.2 * Mo(t, 'remparts')));
function refillShield(t) { t.shield = Math.round(t.maxHp * 0.15 * Mo(t, 'bouclier')); }
function healTower(t, full) { t.maxHp = towerMaxHp(t); if (full || t.hp == null) t.hp = t.maxHp; else t.hp = Math.min(t.hp, t.maxHp); }
// src : ennemi à l'origine du coup (en Difficile, un même ennemi n'attaque une tour qu'une seule fois)
function damageTower(t, dmg, src) {
  if (t.ko > 0 || t.dead || G.demo || G.coopGuest) return;
  if (hardMode() && src != null) { const h = t.hitBy || (t.hitBy = new Set()); if (h.has(src)) return; h.add(src); }
  if (typeof introTower === 'function') introTower(t);
  if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a; }
  t.hp -= dmg; t.hitT = 0.25;
  if (t.hp <= 0) {
    if (hardMode()) { destroyTower(t); return; }
    t.hp = 0; t.ko = 8; t.stun = 0;
    ono('K.O. !', t.x, t.y, '#ff4f6e', 0.5, 0, 0.9); Snd.play('hurt');
    burst(t.x, t.y, 0.3, 10, ['#cdbfe0', '#ffffff', '#ff4f6e'], 2.2, 0.08, 3, 0.5);
  }
}
const nearTowers = (e, R) => G.towers.filter(t => !(t.ko > 0) && (t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= R * R);
function enemyAbility(e, dt) {
  const D = ETYPES[e.type];
  if (!(e.type === 'gresil' || e.type === 'crachou' || e.type === 'malefik' || D.boss) || e.frozen > 0 || e.stun > 0 || G.demo || G.coopGuest) return;
  e.abT -= dt; if (e.abT > 0) return;
  const pw = 1 + G.wave * 0.04;
  if (e.type === 'gresil') {
    const ts = nearTowers(e, 1.5); if (!ts.length) { e.abT = 0.3; return; }
    for (const t of ts) t.stun = Math.max(t.stun || 0, 1.8 * (1 - 0.25 * Mo(t, 'paratonnerre')));
    G.fx.push({ kind: 'ring', gx: e.x, gy: e.y, r0: 0.2, r1: 1.5, t: 0, dur: 0.4, color: '#e6ff5a' });
    ono('BZZT!', e.x, e.y, '#e6ff5a', 0.45, 0.4, 0.8); Snd.play('foudre');
    e.abT = 3.5;
  } else if (e.type === 'crachou') {
    const ts = nearTowers(e, 2.0).filter(t => !hardMode() || !(t.hitBy && t.hitBy.has(e.id))); if (!ts.length) { e.abT = 0.3; return; }
    let tg = ts[0], bd = Infinity; for (const t of ts) { const d2 = (t.x - e.x) ** 2 + (t.y - e.y) ** 2; if (d2 < bd) { bd = d2; tg = t; } }
    G.eprojs.push({ sx: e.x, sy: e.y, t: tg, p: 0, dur: 0.45, dmg: 12 * pw, src: e.id });
    e.abT = 1.8;
  } else if (e.type === 'malefik') {
    const ts = nearTowers(e, 2.2).filter(t => !(t.evil > 0)); if (!ts.length) { e.abT = 0.4; return; }
    let tg = ts[0]; for (const t of ts) { const a = upTot(t.up), b = upTot(tg.up); if (a > b || (a === b && t.s.dmg * t.s.rate > tg.s.dmg * tg.s.rate)) tg = t; }
    tg.evil = 6 * (1 - 0.25 * Mo(tg, 'talisman')); tg.evilBy = e.id; tg.beam = null; tg.cd = 0.5;
    G.fx.push({ kind: 'bolt', pts: [{ gx: e.x, gy: e.y, up: 0.5 }, { gx: tg.x, gy: tg.y, up: 0.45 }], t: 0, dur: 0.4, color: '#c77dff' });
    ono('MWAHAHA!', e.x, e.y, '#c77dff', 0.5, 0.5, 0.9); Snd.play('evil');
    e.abT = 7;
  } else {
    const ts = nearTowers(e, 1.6); if (!ts.length) { e.abT = 0.5; return; }
    for (const t of ts) { damageTower(t, 30 * pw, e.id); if (evt() === 'noel') t.stun = Math.max(t.stun || 0, 1.5); }
    G.fx.push({ kind: 'ring', gx: e.x, gy: e.y, r0: 0.3, r1: 1.6, t: 0, dur: 0.5, color: '#ff4f6e' });
    G.shake = Math.max(G.shake, 0.35); ono('STOMP!', e.x, e.y, '#ff4f6e', 0.6, 0.5, 1.0); Snd.play('terre');
    e.abT = 6;
  }
}
function updateEProjs(dt) {
  for (const p of G.eprojs) {
    p.p += dt / p.dur;
    if (p.p >= 1) {
      p.done = true;
      if (G.towers.includes(p.t)) { damageTower(p.t, p.dmg, p.src); burst(p.t.x, p.t.y, 0.35, 6, ['#b57bff', '#e2caff'], 2, 0.07, 3, 0.4); Snd.play('thit'); }
    }
  }
  G.eprojs = G.eprojs.filter(p => !p.done);
}
function updateEnemy(e, dt) {
  enemyAbility(e, dt);
  if (e.type === 'lapin' && !G.demo && !(e.frozen > 0 || e.stun > 0) && (e.jT -= dt) <= 0) {
    e.jT = 3; e.hopT = 0.35; e.d = Math.min(PP(e).goal - 0.3, e.d + 1.6);
    ono('BOING!', e.x, e.y, '#ffffff', 0.4, 0.4, 0.8);
  }
  if (e.hopT > 0) e.hopT -= dt;
  if (e.type === 'calinou' && !G.demo && !(e.frozen > 0 || e.stun > 0) && (e.abT -= dt) <= 0) {
    e.abT = 3; let n = 0;
    for (const o of G.enemies) if (!o.dead && o !== e && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 1.6 * 1.6 && o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.12); n++; }
    G.fx.push({ kind: 'ring', gx: e.x, gy: e.y, r0: 0.2, r1: 1.6, t: 0, dur: 0.45, color: '#ff9ac6' });
    if (n) ono(T('♥ CÂLIN !'), e.x, e.y, '#ff6fa8', 0.42, 0.4, 0.8);
  }
  if ((e.type === 'spectre' || e.ghostAll) && !G.demo) {
    if (e.ghost > 0) e.ghost -= dt;
    else if ((e.gcy -= dt) <= 0) {
      const sp = e.type === 'spectre'; e.ghost = sp ? (G.weather === 'moon' ? 0.8 : 1.4) : 1; e.gcy = sp ? 2.6 : rand(4, 7); e.burnT = 0;
      if (sp) ono('BOUH!', e.x, e.y, '#e6e0ff', 0.4, 0.4, 0.8);
    }
  }
  if (e.flash > 0) e.flash -= dt;
  if (e.wet > 0) e.wet -= dt;
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowA = 0; }
  if (e.frozen > 0) e.frozen -= dt;
  if (e.stun > 0) e.stun -= dt;
  if (e.burnT > 0) {
    e.burnT -= dt; if (!G.coopGuest) e.hp -= e.burn * dt;
    if (Math.random() < dt * 5) burst(e.x, e.y, (e.flying ? FLY : 0) + 0.45, 1, ['#ff9a3d', '#ffd23f'], 0.6, 0.06, -1.5, 0.5);
    if (e.burnT <= 0) e.burn = 0;
    if (e.hp <= 0) { kill(e); return; }
  }
  let v = e.speed * (1 - e.slowA) * (G.weather === 'storm' && e.flying ? 1.25 : G.weather === 'blizzard' ? 0.9 : 1);
  if (e.frozen > 0 || e.stun > 0) v = 0;
  e.d += v * dt; e.phase += v * dt * 6;
  if (e.d >= PP(e).goal) { reachBase(e); return; }
  setPos(e);
}
function reachBase(e) {
  if (G.demo || G.coopGuest) { e.dead = true; return; }
  const B = PP(e).base;
  if (!e.lifeCost) { e.dead = true; ono(T('FILÉE !'), B[0], B[1], '#ffd23f', 0.5, 0.2, 1.1); return; }
  e.dead = true; G.lives -= e.lifeCost; G.lostLife = true; G.shake = Math.max(G.shake, 0.45); G.hurtT = 0.5; G.baseHit = 0.4; G.hitBase = B;
  ono(e.lifeCost > 1 ? '-' + e.lifeCost + ' ♥' : T('AÏE!'), B[0], B[1], '#ff4f6e', 0.6, 0.2, 1.1);
  Snd.play('hurt');
  // Un ennemi qui atteint la maison n'abandonne pas, il repart du début du chemin avec les PV qui lui restent, et coûte
  // des vies à chaque passage jusqu'à ce qu'il soit abattu : tous les ennemis en Infini, les boss en Difficile
  if ((G.diff === 'infini' || (G.diff === 'difficile' && ETYPES[e.type].boss)) && G.lives > 0 && !G.story) {
    e.dead = false; e.d = 0; e.laps = (e.laps || 0) + 1; setPos(e);
    if (ETYPES[e.type].boss) ono(T('ENCORE UN TOUR !'), e.x, e.y, '#ff4f6e', 0.6, 0.2, 1.3); else ono('↺', e.x, e.y, '#ff4f6e', 0.4, 0.1, 0.8);
  }
  if (G.lives <= 0) {
    if (G.koAsk) return;
    if (M('revive') && !G.reviveUsed) { G.reviveUsed = true; reviveFx(B); }
    else if (typeof adCanRevive === 'function' && adCanRevive()) adKoAsk(B); // seconde chance contre une pub (js/ads.js)
    else gameOver();
  }
}
function reviveFx(B) {
  G.lives = 5;
  for (const o of G.enemies) if (!o.dead) knock(o, 2.5);
  G.fx.push({ kind: 'ring', gx: B[0], gy: B[1], r0: 0.2, r1: 4, t: 0, dur: 0.7, color: '#ffd23f' });
  burst(B[0], B[1], 0.5, 30, ['#ffd23f', '#ffffff', '#ff4f81'], 4, 0.12, 2, 0.8, 'star');
  banner('SECONDE CHANCE !', T('5 vies retrouvées'), false); Snd.play('win');
}
// Efficacité de la tour selon la cible : au sol ou en vol, et en plus contre les Kaiju
function vsMul(s, e) {
  if (!s || s.solMul == null) return 1;
  return (e.flying ? s.airMul : s.solMul) * (ETYPES[e.type].boss ? s.bossMul : 1);
}
const canHit = (s, e) => e.flying ? s.air : s.ground !== false;
function hurt(e, dmg, elem, s) {
  if (e.dead || e.ghost > 0) return 0;
  if (G.coopGuest) { e.flash = 0.12; return 0; } // invité coop : simple effet visuel, l'hôte calcule les dégâts
  const D = ETYPES[e.type], up = (e.flying ? FLY : 0) + 0.7;
  if (D.immune === elem) { ono(T('IMMUNISÉ'), e.x, e.y, '#ffffff', 0.34, 0.9, up); return 0; }
  let m = 1;
  if (elem === 'foudre' && e.wet > 0) { m = 2; ono('ZAP x2!', e.x, e.y, '#ffe34d', 0.6, 0.25, up); }
  if (elem === 'terre' && e.frozen > 0) {
    m = 2; e.frozen = 0; ono('CRACK x2!', e.x, e.y, '#bff3ff', 0.6, 0.25, up);
    burst(e.x, e.y, 0.3, 10, ['#ffffff', '#bff3ff', '#7fd6ff'], 2.8, 0.09, 4, 0.5, 'star');
  }
  m *= vsMul(s, e);
  const arm0 = Math.max(0, e.armor - (e.shred || 0)), arm = s && s.pierce ? Math.max(0, arm0 - s.pierce) : arm0;
  const d = Math.max(dmg * m - arm, dmg * m * 0.2);
  e.hp -= d; e.flash = 0.12;
  if (s && s.solLv >= 4 && !e.flying && !D.boss && Math.random() < 0.15) e.stun = Math.max(e.stun, 0.5);
  if (e.hp <= 0) kill(e);
  return d;
}
function kill(e) {
  if (e.dead || G.coopGuest) return;
  e.dead = true;
  const D = ETYPES[e.type]; if (!G.demo && !G.story) { stats.kills++; if (typeof questEvent === 'function') questEvent('kill'); if (D.boss) { stats.bosses++; if (typeof trophyBoss === 'function') trophyBoss(); if (typeof questEvent === 'function') questEvent('boss'); } }
  const up = (e.flying ? FLY : 0) + 0.25;
  const lf = G.chal ? chalLoot() : 1, rw = G.coop ? coopLoot(D.reward * (1 + G.wave * 0.01) * lf) : Math.round(D.reward * (1 + G.wave * 0.01) * (1 + 0.06 * M('loot')));
  if (!G.coop) G.gold += Math.round(rw * lf); G.score += rw * 10;
  burst(e.x, e.y, up, D.boss ? 40 : 10, [D.color, D.light, '#ffffff'], D.boss ? 4 : 2.4, D.boss ? 0.14 : 0.09, 4, 0.6);
  G.texts.push({ txt: '+' + rw, gx: e.x, gy: e.y, oy: -up - 0.3, t: 0, dur: 0.8, color: '#ffd23f', size: 0.32, rot: 0 });
  if (e.type === 'malefik') for (const t of G.towers) if (t.evil > 0 && t.evilBy === e.id) { t.evil = 0; ono(T('LIBÉRÉE !'), t.x, t.y, '#5cd86a', 0.42, 0, 0.9); }
  if (D.boss) {
    G.bossKills++; ono('K.O. !!', e.x, e.y, '#ff4f81', 1.1, 0, 0.9); G.shake = 0.7; Snd.play('boom');
    // Le Roi Citrouille libère trois Potirons en tombant
    if (spooky()) spawnAt('potiron', 3, e.d, e.pi);
  }
  if (e.type === 'cadeau') { spawnAt('zip', 2, e.d, e.pi); ono('SURPRISE !', e.x, e.y, '#ffd23f', 0.5, 0.3, 0.9); }
  else { if (Math.random() < 0.18) ono(pick(['POP!', 'PAF!', 'BLOP!', 'SPLOTCH!']), e.x, e.y, '#ffffff', 0.45, 0.35, up + 0.4); Snd.play('pop'); }
}
function slowE(e, a, t) { const f = ETYPES[e.type].boss ? 0.6 : 1; e.slowA = Math.max(e.slowA, a * f); e.slowT = Math.max(e.slowT, t); }
function ignite(e, dps, t) { if (e.dead || ETYPES[e.type].immune === 'feu') return; e.burn = Math.max(e.burn, dps); e.burnT = Math.max(e.burnT, t); }
function knock(e, k, s) {
  const D = ETYPES[e.type], f = D.boss ? (s && s.bossLv >= 2 ? 0.5 : 0.15) : e.type === 'tonk' ? 0.45 : 1;
  e.d = Math.max(PP(e).d0, e.d - k * f); setPos(e);
}

// ---------- Tir ----------
function updateTower(t, dt) {
  if (t.dead) return;
  if (hardMode() && G.waveActive && !G.coopGuest && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * REGEN * dt);
  if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 5);
  t.blink -= dt; if (t.blink < -0.13) t.blink = rand(2, 5);
  if (t.hitT > 0) t.hitT -= dt;
  if (t.ko > 0) { t.ko -= dt; t.beam = null; if (t.ko <= 0) { t.ko = 0; t.hp = Math.round(t.maxHp * 0.5); ono('DEBOUT !', t.x, t.y, '#5cd86a', 0.45, 0, 0.9); } return; }
  if (t.stun > 0) { t.stun -= dt; t.beam = null; return; }
  if (t.evil > 0) {
    t.evil -= dt; t.beam = null;
    if (t.evil <= 0) { t.evil = 0; ono(T('LIBÉRÉE !'), t.x, t.y, '#5cd86a', 0.42, 0, 0.9); return; }
    t.cd -= dt; if (t.cd > 0) return;
    const cx = t.x, cy = t.y, R2 = t.s.range * t.s.range; let tg = null, bd = Infinity;
    for (const o of G.towers) { if (o === t || o.ko > 0 || (hardMode() && o.hitBy && o.hitBy.has(t.evilBy))) continue; const d2 = (o.x - cx) ** 2 + (o.y - cy) ** 2; if (d2 <= R2 && d2 < bd) { bd = d2; tg = o; } }
    if (!tg) { t.cd = 0.2; return; }
    G.eprojs.push({ sx: cx, sy: cy, t: tg, p: 0, dur: 0.35, dmg: t.s.dmg * 0.6, evil: true, src: t.evilBy });
    t.cd = 1 / Math.max(0.4, t.s.rate); t.recoil = 1;
    const ddx = tg.x - cx, ddy = tg.y - cy, [a, b] = L.portrait ? [ddy, ddx] : [ddx, ddy], l = Math.hypot(a, b) || 1; t.lx = a / l; t.ly = b / l;
    return;
  }
  if (t.type === 'plasma') { beamTower(t, dt); return; }
  t.cd -= dt; if (t.cd > 0) return;
  const s = t.s, [cx, cy] = windCenter(t), R2 = s.range * s.range, list = [];
  for (const e of G.enemies) { if (e.dead || e.ghost > 0 || !canHit(s, e)) continue; const dx = e.x - cx, dy = e.y - cy; if (dx * dx + dy * dy <= R2) list.push(e); }
  if (!list.length) { t.cd = 0.08; return; }
  t.cd = 1 / s.rate; t.recoil = 1;
  if (t.type === 'glace' || t.type === 'blizzard') { pulse(t, s, list); return; }
  if (t.type === 'sable') { sandPulse(t, s, list); return; }
  if (t.type === 'orage') { storm(t, s, list); return; }
  let tg = list[0], bv = -Infinity;
  for (const e of list) { const v = aimScore(t, e, cx, cy); if (v > bv) { bv = v; tg = e; } }
  const ddx = tg.x - cx, ddy = tg.y - cy, [a, b] = L.portrait ? [ddy, ddx] : [ddx, ddy], l = Math.hypot(a, b) || 1;
  t.lx = a / l; t.ly = b / l;
  Snd.play(TOWERS[t.type].snd || t.type);
  if (t.type === 'foudre') { chain(t, s, tg); return; }
  if (t.type === 'tornade') { G.tors.push({ pi: tg.pi || 0, d: Math.min(PP(tg).goal - 0.2, tg.d + 0.8), t: 0, dur: 2.4, spd: 2.0, s, hit: new Set(), rot: 0 }); return; }
  if (t.type === 'geyser') { geyserBlast(s, tg); return; }
  const dist = Math.hypot(ddx, ddy), spd = t.type === 'feu' ? 8 : t.type === 'eau' ? 6 : 7;
  G.projs.push({ kind: t.type, sx: cx, sy: cy, x: cx, y: cy, tg, tx: tg.x, ty: tg.y, tup: tg.flying ? FLY : 0, p: 0,
    dur: LOB[t.type] ? 0.65 : Math.max(0.12, dist / spd), s, rot: 0, up: 0.4 });
}
const LOB = { terre: 1, volcan: 1, marais: 1 };
function sandPulse(t, s, list) {
  const cx = t.x, cy = t.y;
  for (const e of list) {
    if (e.armor > (e.shred || 0)) { e.shred = Math.min(e.armor, (e.shred || 0) + s.shred); ono('ARMURE −' + s.shred, e.x, e.y, '#e8c784', 0.36, 0.7, (e.flying ? FLY : 0) + 0.8); }
    hurt(e, s.dmg, 'vent', s); if (!e.dead) slowE(e, 0.2, 1.2);
  }
  G.fx.push({ kind: 'ring', gx: cx, gy: cy, r0: 0.2, r1: s.range, t: 0, dur: 0.5, color: '#e8c784' });
  burst(cx, cy, 0.3, 10, ['#e8c784', '#c9a15a', '#fff3d0'], 3, 0.06, 0, 0.6);
  Snd.play('vent'); t.lx = 0; t.ly = 0.6;
}
function storm(t, s, list) {
  const cx = t.x, cy = t.y;
  for (const e of list) e.wet = Math.max(e.wet, 2.5);
  for (let i = 0; i < 14 && G.parts.length < 380; i++) {
    const a = rand(TAU), d = Math.sqrt(Math.random()) * s.range;
    G.parts.push({ gx: cx + Math.cos(a) * d, gy: cy + Math.sin(a) * d, ox: 0, oy: -1.2, vx: 0, vy: 2.6, g: 0, life: 0.45, max: 0.45, size: 0.05, color: '#8fd0ff', shape: 'rain', rot: 0 });
  }
  chain(t, s, pick(list)); Snd.play('foudre');
}
function geyserBlast(s, tg) {
  const x = tg.x, y = tg.y;
  splashHit(x, y, s.splash, true, e => {
    hurt(e, s.dmg, 'eau', s);
    if (!e.dead) { e.wet = Math.max(e.wet, 2.5); if (!e.flying) e.stun = Math.max(e.stun, ETYPES[e.type].boss ? 0.25 : s.stun); }
  });
  G.fx.push({ kind: 'ring', gx: x, gy: y, r0: 0.1, r1: s.splash, t: 0, dur: 0.4, color: '#ffffff' });
  burst(x, y, 0.1, 16, ['#ffffff', '#dff6ff', '#9fe6ff'], 2.4, 0.1, -3, 0.7);
  if (Math.random() < 0.3) ono('PSHHH!', x, y, '#dff6ff', 0.5, 0.4, 1.0);
}
// Ciblage : plus le score est haut, plus l'ennemi est visé (premier = le plus avancé vers la maison)
function aimScore(t, e, cx, cy) {
  const ahead = e.d - PP(e).goal;
  switch (t.mode) {
    case 'dernier': return -ahead;
    case 'faible': return -e.hp;
    case 'fort': return e.hp;
    case 'proche': return -((e.x - cx) ** 2 + (e.y - cy) ** 2);
    case 'boss': return (ETYPES[e.type].boss ? 1e6 : 0) + ahead;
    default: return ahead;
  }
}
function beamTower(t, dt) {
  const s = t.s, [cx, cy] = windCenter(t), R2 = s.range * s.range;
  const ok = e => e && !e.dead && !(e.ghost > 0) && canHit(s, e) && (e.x - cx) ** 2 + (e.y - cy) ** 2 <= R2;
  if (!ok(t.beam)) {
    t.beam = null; t.beamT = 0; let bv = -Infinity;
    for (const e of G.enemies) { if (!ok(e)) continue; const v = aimScore(t, e, cx, cy); if (v > bv) { bv = v; t.beam = e; } }
  }
  if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 5);
  t.blink -= dt; if (t.blink < -0.13) t.blink = rand(2, 5);
  const e = t.beam; if (!e) return;
  t.beamT += dt; t.acc = (t.acc || 0) + dt;
  const ddx = e.x - cx, ddy = e.y - cy, [a, b] = L.portrait ? [ddy, ddx] : [ddx, ddy], l = Math.hypot(a, b) || 1; t.lx = a / l; t.ly = b / l;
  if (t.acc >= 0.2) {
    const ramp = Math.min(s.rampMax, t.beamT);
    hurt(e, s.dmg * (1 + ramp) * t.acc, 'plasma', s); t.acc = 0; t.recoil = 0.6;
    Snd.play('plasma');
    if (ramp >= s.rampMax && Math.random() < 0.15) ono('BZZZT!', e.x, e.y, '#ff6ad5', 0.45, 0.6, (e.flying ? FLY : 0) + 0.8);
  }
}
function updateZones(dt) {
  for (const z of G.zones) {
    z.t += dt;
    for (const e of G.enemies) {
      if (e.dead || e.flying || (e.x - z.gx) ** 2 + (e.y - z.gy) ** 2 > z.r * z.r) continue;
      if (G.coopGuest) { if (z.kind !== 'lava') slowE(e, z.slow, 0.3); continue; }
      if (z.kind === 'lava') { if (ETYPES[e.type].immune === 'feu') continue; e.hp -= z.dps * dt; }
      else { e.hp -= z.dps * dt; slowE(e, z.slow, 0.3); }
      if (e.hp <= 0) kill(e);
    }
  }
  G.zones = G.zones.filter(z => z.t < z.dur);
}
function updateTors(dt) {
  for (const o of G.tors) {
    o.t += dt; o.d -= o.spd * dt; o.rot += dt * 12;
    if (o.d < PP(o).d0) o.t = o.dur;
    const [ox, oy] = pathAt(o.d, o.pi);
    for (const e of G.enemies) {
      if (e.dead || o.hit.has(e.id) || (e.x - ox) ** 2 + (e.y - oy) ** 2 > 0.5 * 0.5) continue;
      o.hit.add(e.id);
      hurt(e, o.s.dmg, 'vent', o.s); ignite(e, o.s.burn * vsMul(o.s, e), 3);
      if (!e.dead) knock(e, o.s.knock, o.s);
      if (Math.random() < 0.2) ono('FWOOSH!', e.x, e.y, '#ff9a3d', 0.5, 0.35, (e.flying ? FLY : 0) + 0.8);
    }
    if (Math.random() < 0.5) { const [x, y] = pathAt(o.d, o.pi); burst(x, y, 0.3, 1, ['#ffd23f', '#ff8a3d'], 0.8, 0.06, -2, 0.4); }
  }
  G.tors = G.tors.filter(o => o.t < o.dur);
}
function pulse(t, s, list) {
  t.pulses++; const frz = t.pulses % s.every === 0, cx = t.x, cy = t.y;
  for (const e of list) {
    hurt(e, s.dmg * (e.flying && s.airBonus ? s.airBonus : 1), 'glace', s); if (e.dead) continue;
    slowE(e, s.slow, 1.6);
    if (frz) e.frozen = Math.max(e.frozen, s.freeze * (ETYPES[e.type].boss && !(s.bossLv >= 2) ? 0.35 : 1));
  }
  G.fx.push({ kind: 'ring', gx: cx, gy: cy, r0: 0.2, r1: s.range, t: 0, dur: 0.45, color: frz ? '#ffffff' : '#bff3ff' });
  if (t.type === 'blizzard') burst(cx, cy, 0.6, 10, ['#ffffff', '#dff6ff'], 2.6, 0.06, 0.4, 0.8, 'star');
  if (frz) { ono('KSHH!', cx, cy, '#bff3ff', 0.5, 0.5, 0.9); burst(cx, cy, 0.4, 8, ['#ffffff', '#bff3ff'], 2, 0.07, 0.5, 0.6, 'star'); }
  Snd.play('glace'); t.lx = 0; t.ly = 0.6;
}
function chain(t, s, tg) {
  const hit = [tg]; let cur = tg;
  for (let i = 1; i < s.chain; i++) {
    let best = null, bd = 3.2;
    for (const e of G.enemies) { if (e.dead || e.ghost > 0 || hit.includes(e)) continue; const d2 = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2; if (d2 < bd) { bd = d2; best = e; } }
    if (!best) break; hit.push(best); cur = best;
  }
  const pts = [{ gx: t.x, gy: t.y, up: 0.5 }];
  for (const e of hit) pts.push({ gx: e.x, gy: e.y, up: (e.flying ? FLY : 0) + 0.25 });
  G.fx.push({ kind: 'bolt', pts, t: 0, dur: 0.22 });
  hit.forEach((e, i) => { burst(e.x, e.y, (e.flying ? FLY : 0) + 0.25, 3, ['#fff7b0', '#ffd23f'], 2.5, 0.06, 0, 0.3, 'star'); hurt(e, s.dmg * Math.pow(0.85, i), 'foudre', s); });
  if (Math.random() < 0.18) ono('ZAP!', tg.x, tg.y, '#ffe34d', 0.5, 0.35, (tg.flying ? FLY : 0) + 0.8);
}
function splashHit(x, y, R, air, fn) {
  for (const e of G.enemies) { if (e.dead || (!air && e.flying)) continue; if ((e.x - x) ** 2 + (e.y - y) ** 2 <= R * R) fn(e); }
}
function impact(p) {
  const s = p.s, tg = p.tg && !p.tg.dead ? p.tg : null;
  switch (p.kind) {
    case 'feu':
      if (tg) { hurt(tg, s.dmg, 'feu', s); ignite(tg, s.burn * vsMul(s, tg), s.burnT); }
      burst(p.x, p.y, p.up, 7, ['#ffd23f', '#ff8a3d', '#ff4f4f'], 1.8, 0.08, -1, 0.4);
      if (Math.random() < 0.1) ono('FSHH!', p.x, p.y, '#ff9a3d', 0.42, 0.4, p.up + 0.4);
      break;
    case 'eau':
      splashHit(p.x, p.y, s.splash, true, e => { hurt(e, s.dmg, 'eau', s); if (!e.dead) { e.wet = 3.5; slowE(e, s.slow, 1.8); } });
      G.fx.push({ kind: 'ring', gx: p.x, gy: p.y, r0: 0.1, r1: s.splash, t: 0, dur: 0.35, color: '#6cc6ff' });
      burst(p.x, p.y, p.up, 9, ['#6cc6ff', '#bfeaff', '#ffffff'], 2.4, 0.08, 5, 0.45);
      if (Math.random() < 0.18) ono('SPLASH!', p.x, p.y, '#6cc6ff', 0.45, 0.4, p.up + 0.4);
      break;
    case 'terre':
      splashHit(p.x, p.y, s.splash, !!s.air, e => { hurt(e, s.dmg, 'terre', s); if (!e.dead && s.stun && Math.random() < s.stun && !ETYPES[e.type].boss) e.stun = 0.8; });
      G.fx.push({ kind: 'ring', gx: p.x, gy: p.y, r0: 0.2, r1: s.splash, t: 0, dur: 0.4, color: '#e0b27a' });
      burst(p.x, p.y, 0.1, 12, ['#c08a58', '#e0b27a', '#8a6040'], 2.6, 0.1, 6, 0.5);
      G.shake = Math.max(G.shake, 0.12);
      if (Math.random() < 0.22) ono('BOOM!', p.x, p.y, '#ffb03d', 0.55, 0.4, 0.7);
      break;
    case 'volcan':
      splashHit(p.x, p.y, s.splash, !!s.air, e => hurt(e, s.dmg, 'feu', s));
      G.zones.push({ gx: p.x, gy: p.y, r: 0.6, t: 0, dur: 3, kind: 'lava', dps: s.lava });
      G.fx.push({ kind: 'ring', gx: p.x, gy: p.y, r0: 0.2, r1: s.splash, t: 0, dur: 0.4, color: '#ff8a3d' });
      burst(p.x, p.y, 0.1, 14, ['#ff4f4f', '#ff8a3d', '#ffd23f'], 3, 0.1, 5, 0.6);
      G.shake = Math.max(G.shake, 0.15);
      if (Math.random() < 0.25) ono('KABOOM!', p.x, p.y, '#ff8a3d', 0.6, 0.4, 0.8);
      break;
    case 'marais':
      splashHit(p.x, p.y, 0.9, !!s.air, e => hurt(e, s.dmg, 'terre', s));
      G.zones.push({ gx: p.x, gy: p.y, r: 0.9, t: 0, dur: 4, kind: 'mud', dps: s.poison, slow: s.slow });
      burst(p.x, p.y, 0.1, 10, ['#7a6a34', '#9c8a4a', '#6fd35a'], 2.2, 0.09, 5, 0.5);
      if (Math.random() < 0.2) ono('SPLOTCH!', p.x, p.y, '#b3a45e', 0.5, 0.4, 0.7);
      break;
    case 'vent':
      if (tg) {
        hurt(tg, s.dmg * (tg.flying ? s.airBonus : 1), 'vent', s);
        if (!tg.dead) {
          knock(tg, s.knock, s);
          if (tg.burnT > 0) {
            let spread = 0;
            for (const e of G.enemies) { if (e === tg || e.dead) continue; if ((e.x - tg.x) ** 2 + (e.y - tg.y) ** 2 < 1.7) { ignite(e, tg.burn, 2.5); spread++; } }
            if (spread) { ono('FWOOSH!', tg.x, tg.y, '#ff9a3d', 0.65, 0.25, (tg.flying ? FLY : 0) + 0.8); burst(tg.x, tg.y, 0.4, 14, ['#ffd23f', '#ff8a3d', '#ff4f4f'], 3, 0.1, -1, 0.5); }
          }
        }
      }
      burst(p.x, p.y, p.up, 6, ['#ffffff', '#c9fff0'], 2.4, 0.07, 0, 0.35);
      if (Math.random() < 0.15) ono('WHOOSH!', p.x, p.y, '#c9fff0', 0.45, 0.4, p.up + 0.4);
      break;
  }
}
function updateProjs(dt) {
  for (const p of G.projs) {
    p.p += dt / p.dur;
    if (p.tg && !p.tg.dead) { p.tx = p.tg.x; p.ty = p.tg.y; p.tup = p.tg.flying ? FLY : 0; }
    const k = Math.min(1, p.p);
    p.x = lerp(p.sx, p.tx, k); p.y = lerp(p.sy, p.ty, k);
    p.up = lerp(0.4, p.tup + 0.2, k) + (LOB[p.kind] ? Math.sin(k * Math.PI) * 1.1 : 0);
    p.rot += dt * 9;
    if (p.kind === 'feu' && Math.random() < 0.6) burst(p.x, p.y, p.up, 1, ['#ffd23f', '#ff8a3d'], 0.3, 0.06, -0.5, 0.25);
    if (p.p >= 1) { impact(p); p.done = true; }
  }
  G.projs = G.projs.filter(p => !p.done);
}

// ---------- Effets ----------
function burst(gx, gy, up, n, colors, spd = 2, size = 0.08, g = 3, life = 0.5, shape = 'dot') {
  for (let i = 0; i < n; i++) {
    if (G.parts.length > 380) break;
    const a = rand(TAU), v = rand(0.3, 1) * spd, l = life * rand(0.6, 1.2);
    G.parts.push({ gx, gy, ox: 0, oy: -up, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.35, g, life: l, max: l, size: size * rand(0.6, 1.3), color: pick(colors), shape, rot: rand(TAU) });
  }
}
function ono(txt, gx, gy, color, size = 0.55, cd = 0.3, up = 0.6) {
  if (G.onoCd[txt] > 0) return;
  G.onoCd[txt] = cd;
  G.texts.push({ txt, gx, gy, oy: -up, t: 0, dur: 0.9, color, size, rot: rand(-0.22, 0.22) });
}
function updateFx(dt) {
  for (const p of G.parts) { p.ox += p.vx * dt; p.oy += p.vy * dt; p.vy += p.g * dt; p.vx *= 1 - dt * 1.5; p.life -= dt; p.rot += dt * 4; }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const t of G.texts) { t.t += dt; t.oy -= dt * 0.35; }
  G.texts = G.texts.filter(t => t.t < t.dur);
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < f.dur);
  for (const k in G.onoCd) G.onoCd[k] -= dt;
  G.shake = Math.max(0, G.shake - dt * 1.6); G.speedLines -= dt; G.hurtT -= dt; G.baseHit -= dt;
  if (G.bad) { G.bad.t -= dt; if (G.bad.t <= 0) G.bad = null; }
}
function update(dt) {
  G.time += dt;
  if (G.coopGuest) { /* l'hôte gère apparitions, chronos et fins de vague */ }
  else if (G.spawnQ.length) {
    G.spawnT -= dt;
    while (G.spawnQ.length && G.spawnT <= 0) { const s = G.spawnQ.shift(); spawn(s.type, s.pi); G.spawnT += s.gap; }
  } else if (!G.waveActive && G.autoT > 0) { G.autoT -= dt; if (G.autoT <= 0) startWave(); }
  if (G.chronoArmed && !G.spawnQ.length && !G.coopGuest) { G.chronoArmed = false; G.chronoT = waveTimer(); }
  if (G.chronoT != null && !G.over && !G.coopGuest) { G.chronoT -= dt; if (G.chronoT <= 0) { G.chronoT = null; startWave(true); } }
  for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt);
  if (G.over) { G.enemies = G.enemies.filter(e => !e.dead); updateFx(dt); return; }
  for (const t of G.towers) updateTower(t, dt);
  updateProjs(dt); updateZones(dt); updateTors(dt); updateEProjs(dt);
  G.enemies = G.enemies.filter(e => !e.dead);
  updateFx(dt); weatherTick(dt);
  if (G.waveActive && !G.spawnQ.length && !G.enemies.length && !G.coopGuest) waveDone();
}

// ================= Rendu =================
// Centre de la zone de tir d'une tour : décalé dans le sens du vent pendant une tempête (G.windW : vent en coordonnées du monde)
function windCenter(t) {
  const w = G && G.weather === 'storm' ? G.windW : null;
  if (!w || !(w.m > 0.05)) return [t.x, t.y];
  const k = Math.min(0.75, t.s.range * 0.3) * w.m; return [t.x + w.x * k, t.y + w.y * k];
}
function rangeCircle(c, gx, gy, R, ok, T) {
  const [x, y] = toScreen(gx, gy);
  c.beginPath(); c.arc(x, y, R * L.cs / L.cw, 0, TAU);
  c.fillStyle = ok ? 'rgba(255,255,255,.2)' : COL().badA + '.2)'; c.fill();
  c.setLineDash([L.cs * 0.2, L.cs * 0.12]); c.lineDashOffset = -T * 18;
  c.lineWidth = 2.5; c.strokeStyle = ok ? 'rgba(255,255,255,.95)' : '#ff4f6e'; c.stroke(); c.setLineDash([]);
}
function pill(c, txt, x, y, ok, bg, fg) {
  c.save(); c.font = '800 13px "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
  const w = c.measureText(txt).width + 20, h = 26, x0 = clamp(x - w / 2, 6, Math.max(6, L.w - w - 6)), y0 = Math.max(6, y - h);
  rr(c, x0, y0, w, h, 13); c.fillStyle = bg || (ok ? '#ff6ad5' : '#ffffff'); c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  c.fillStyle = fg || (ok ? '#ffffff' : INK); c.textBaseline = 'middle'; c.fillText(txt, x0 + 10, y0 + h / 2 + 1);
  c.restore();
}
// Rayon de lumière d'une tour améliorée : derrière la tour
function drawBeam(c, f, cs) {
  const k = f.t / f.dur;
      const [x, y] = toScreen(f.gx, f.gy), a = Math.sin(Math.min(1, k) * Math.PI), wb = cs * (0.7 + 0.35 * a), hb = cs * 3.6;
      c.save();
      // Halo de la couleur de la tour, puis colonne de lumière blanche et dorée, et éclat au pied
      c.globalAlpha = 0.55 * a; c.fillStyle = f.color; c.fillRect(x - wb * 0.8, y - hb, wb * 1.6, hb + cs * 0.3); c.globalAlpha = 1;
      const g = c.createLinearGradient(0, y - hb, 0, y + cs * 0.3); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,236,120,' + (0.9 * a) + ')'); g.addColorStop(1, 'rgba(255,255,255,' + a + ')');
      c.fillStyle = g; c.fillRect(x - wb / 2, y - hb, wb, hb + cs * 0.3);
      c.beginPath(); c.ellipse(x, y + cs * 0.25, wb * 0.9, cs * 0.22, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,' + (0.85 * a) + ')'; c.fill();
      for (let i = 0; i < 6; i++) { const py = y - ((k * 1.4 + i / 6) % 1) * hb, px = x + Math.sin(i * 2.1 + k * 6) * wb * 0.4; star(c, px, py, cs * 0.07 * a + 1, cs * 0.03 * a + 0.5, 4); c.fillStyle = 'rgba(255,255,255,' + a + ')'; c.fill(); }
      c.restore();
}
function render(c = ctx, bg = (G && G.bg) || bgCv) {
  const cs = L.cs, TM = G.time, lw = Math.max(1.4, cs * 0.045);
  c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  c.drawImage(bg, 0, 0, L.w, L.h);
  let sx = 0, sy = 0;
  if (G.shake > 0 && !RM && !COMFORT.calm) { sx = (Math.random() * 2 - 1) * G.shake * 9; sy = (Math.random() * 2 - 1) * G.shake * 9; }
  c.save(); c.translate(sx, sy);
  P.portals.forEach((pt, i) => {
    const [ppx, ppy] = toScreen(pt[0], pt[1]); drawPortal(c, ppx, ppy, cs, TM);
    if (i === P.portals.length - 1 && G.story && typeof storyStartFx === 'function') storyStartFx(c, cs, TM);
    // Flèche au-dessus des portails d'où sortira la prochaine vague
    // (pendant qu'une vague sort encore : ses propres portails)
    const act = G.spawnQ.length ? G.curPortals : G.nextWave && G.nextWave.portals;
    if (G.demo || P.portals.length < 2 || !act || !act.includes(i)) return;
    // Anneau qui pulse, et flèche posée côté intérieur de la carte, pointée vers le portail
    const vw = (L.portrait ? ROWS : COLS) * cs, vh = (L.portrait ? COLS : ROWS) * cs, cx0 = L.ox + vw / 2, cy0 = L.oy + vh / 2;
    let ux = cx0 - ppx, uy = cy0 - ppy; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    if (Math.abs(ux) > Math.abs(uy)) { ux = Math.sign(ux); uy = 0; } else { uy = Math.sign(uy); ux = 0; }
    const pul = Math.abs(Math.sin(TM * 4)), dd = cs * (0.95 + 0.15 * pul), ax = ppx + ux * dd, ay = ppy + uy * dd, w = cs * 0.26;
    c.save(); c.lineJoin = 'round';
    c.beginPath(); c.arc(ppx, ppy, cs * (0.55 + 0.08 * pul), 0, TAU); c.lineWidth = Math.max(2.5, cs * 0.1); c.strokeStyle = 'rgba(255,210,63,' + (0.55 + 0.4 * pul) + ')'; c.stroke();
    c.translate(ax, ay); c.rotate(Math.atan2(-uy, -ux));
    c.beginPath(); c.moveTo(w * 0.7, 0); c.lineTo(-w * 0.6, -w); c.lineTo(-w * 0.6, w); c.closePath();
    c.lineWidth = Math.max(2, cs * 0.08); c.strokeStyle = INK; c.stroke(); c.fillStyle = '#ffd23f'; c.fill(); c.restore();
  });
  for (const z of G.zones) {
    const [x, y] = toScreen(z.gx, z.gy), k = z.t / z.dur, lava = z.kind === 'lava', R = z.r * cs / L.cw * Math.min(1, z.t / 0.15);
    c.save(); c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    c.beginPath(); c.arc(x, y, R, 0, TAU); c.fillStyle = lava ? '#ff6a2b' : '#7a6a34'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(x - R * 0.2, y - R * 0.15, R * 0.45, 0, TAU); c.fillStyle = lava ? '#ffd23f' : '#9c8a4a'; c.fill();
    for (let i = 0; i < 3; i++) { const bt = (TM * 1.3 + i * 0.33) % 1; c.beginPath(); c.arc(x + Math.cos(i * 2.1) * R * 0.5, y + Math.sin(i * 2.1) * R * 0.4, cs * 0.06 * bt + 1, 0, TAU); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke(); }
    c.restore();
  }
  if (G.selTower && !G.drag) { const t = G.selTower, [wx, wy] = windCenter(t); rangeCircle(c, wx, wy, t.s.range, true, TM); }
  const ft = G.drag ? G.drag.t : G.selTower;
  if (ft) for (const o of fusionPartners(ft)) {
    const [x, y] = toScreen(o.o.x, o.o.y), hov = G.drag && G.drag.over === o.o;
    c.beginPath(); c.arc(x, y, cs * (hov ? 0.52 : 0.47), 0, TAU); c.setLineDash(hov ? [] : [cs * 0.12, cs * 0.1]); c.lineDashOffset = TM * 20;
    c.lineWidth = hov ? 5 : 3; c.strokeStyle = o.ok ? '#ff6ad5' : 'rgba(255,255,255,.85)'; c.stroke(); c.setLineDash([]);
  }
  if (G.selType && G.terrain) {
    for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
      const Tt = terrainAt(q, r); if (!Tt || Tt.block || towerAt(q, r)) continue;
      const a = affinity(G.selType, Tt); if (!a && !Tt.range) continue;
      const [x, y] = cellXY(q, r), good = a > 0 || (!a && Tt.range);
      const al = (0.14 + Math.min(0.45, Math.abs(a || 0.3)) * 0.9).toFixed(2);
      c.fillStyle = a < 0 ? 'rgba(255,79,110,' + al + ')' : a > 0 ? 'rgba(92,216,106,' + al + ')' : 'rgba(127,211,255,.42)';
      rr(c, x + 3, y + 3, cs - 6, cs - 6, cs * 0.16); c.fill();
      c.font = Math.round(cs * 0.34) + 'px DispNum, Bangers, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      const mk = a ? (a > 0 ? (a >= 0.3 ? '++' : '+') : (a <= -0.3 ? '−−' : '−')) : '↑'; c.lineWidth = 3; c.strokeStyle = INK; c.strokeText(mk, x + cs * 0.8, y + cs * 0.22); c.fillStyle = good ? '#ffffff' : '#ffd6de'; c.fillText(mk, x + cs * 0.8, y + cs * 0.22);
    }
  }
  const gc = G.selType ? (G.hover || G.ghost) : null;
  let ghostOk = false;
  if (gc && inside(gc.c, gc.r)) {
    ghostOk = canBuild(gc.c, gc.r) && G.gold >= costOf(G.selType);
    const [x, y] = cellXY(gc.c, gc.r);
    rr(c, x + 2, y + 2, cs - 4, cs - 4, cs * 0.18); c.fillStyle = ghostOk ? 'rgba(255,255,255,.35)' : COL().badA + '.35)'; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = ghostOk ? (COMFORT.cvd ? COL().good : '#ffffff') : COL().bad; c.stroke();
    // Couleurs pour daltoniens : un symbole en plus de la couleur (✓ on peut poser, ✕ interdit)
    if (COMFORT.cvd) { const mx = x + cs / 2, my = y + cs / 2, k = cs * 0.16; c.beginPath(); if (ghostOk) { c.moveTo(mx - k, my); c.lineTo(mx - k * 0.2, my + k * 0.8); c.lineTo(mx + k, my - k * 0.8); } else { c.moveTo(mx - k, my - k); c.lineTo(mx + k, my + k); c.moveTo(mx + k, my - k); c.lineTo(mx - k, my + k); } c.lineWidth = cs * 0.08; c.lineCap = 'round'; c.strokeStyle = ghostOk ? COL().good : COL().bad; c.stroke(); c.lineCap = 'butt'; }
    rangeCircle(c, ...cellW(gc.c, gc.r), TOWERS[G.selType].range, ghostOk, TM);
  }
  G.tpill = null;
  if (gc && inside(gc.c, gc.r)) {
    const Tt = terrainAt(gc.c, gc.r);
    if (Tt) {
      const a = affinity(G.selType, Tt), [x, y] = cellXY(gc.c + 0.5, gc.r + 0.5);
      const txt = Tt.block ? T('Obstacle : impossible de construire') : Tt.name + T(' : ') + (a ? fmtAff(a) + T(' de puissance') : Tt.range ? T('+0,4 de portée') : T('aucun effet')) + (a && Tt.range ? T(', +0,4 de portée') : '');
      G.tpill = [txt, x, y - cs * 0.55, Tt.block || a < 0 ? COL().noBg : a > 0 || Tt.range ? COL().okBg : '#ffffff'];
    }
  }
  if (G.bad) {
    const [x, y] = cellXY(G.bad.c + 0.5, G.bad.r + 0.5), k = cs * 0.22;
    c.beginPath(); c.moveTo(x - k, y - k); c.lineTo(x + k, y + k); c.moveTo(x + k, y - k); c.lineTo(x - k, y + k);
    c.lineCap = 'round'; c.lineWidth = cs * 0.16; c.strokeStyle = INK; c.stroke(); c.lineWidth = cs * 0.09; c.strokeStyle = '#ff4f6e'; c.stroke();
  }
  for (const u of G.ruins || []) { const [x, y] = toScreen(...cellW(u.c, u.r)); drawRuin(c, x, y, cs, u.type); }
  const dl = [];
  for (const f of G.fx) if (f.kind === 'beam') drawBeam(c, f, cs);
  for (const t of G.towers) { const [x, y] = toScreen(t.x, t.y); dl.push([y + cs * 0.3, 0, t, x, y]); }
  for (const e of G.enemies) { if (e.flying) continue; const [x, y] = toScreen(e.x, e.y); dl.push([y + cs * 0.2, 1, e, x, y + cs * 0.2]); }
  for (const b of P.bases) { const [bx, by] = toScreen(b[0], b[1]); dl.push([by + cs * 0.35, 2, b, bx, by]); }
  dl.sort((a, b) => a[0] - b[0]);
  for (const [, k, o, x, y] of dl) {
    if (k === 0) {
      const dg = G.drag && G.drag.t === o; if (dg) { c.save(); c.globalAlpha = 0.35; }
      const ko = o.ko > 0; if (ko) { c.save(); c.globalAlpha *= 0.45; }
      if (G.coop && o.own) { c.beginPath(); c.ellipse(x, y + cs * 0.33, cs * 0.4, cs * 0.12, 0, 0, TAU); c.lineWidth = Math.max(2, cs * 0.09); c.strokeStyle = coopColor(o.own); c.stroke(); }
      const up = o.upT != null && G.time - o.upT < 0.5 ? Math.sin((G.time - o.upT) / 0.5 * Math.PI) * 0.22 : 0;
      drawTower(c, o.type, x, y, cs * (1 + up), o.lvl, TM, o.lx, o.ly, o.recoil, o.blink < 0, o.br);
      if (ko) { c.restore(); for (let i = 0; i < 3; i++) { const a = TM * 4 + i * TAU / 3; star(c, x + Math.cos(a) * cs * 0.28, y - cs * 0.45 + Math.sin(a) * cs * 0.08, cs * 0.08, cs * 0.035); fs(c, '#ffd23f', 1.2); } }
      if (o.evil > 0 && !ko) {
        c.save(); c.globalAlpha *= 0.3 + 0.12 * Math.sin(TM * 7); c.beginPath(); c.arc(x, y - cs * 0.1, cs * 0.48, 0, TAU); c.fillStyle = '#6a2fb0'; c.fill(); c.restore();
        const hy = y - cs * 0.52; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(x + sg * cs * 0.1, hy + cs * 0.06); c.lineTo(x + sg * cs * 0.2, hy - cs * 0.14); c.lineTo(x + sg * cs * 0.24, hy + cs * 0.06); c.closePath(); fs(c, '#3b2458', 1.5); }
      }
      if (o.stun > 0 && !ko) {
        c.save(); c.strokeStyle = '#e6ff5a'; c.lineWidth = Math.max(1.5, cs * 0.04); c.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const a = rand(TAU), rx = x + Math.cos(a) * cs * 0.3, ry = y - cs * 0.15 + Math.sin(a) * cs * 0.3; c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + rand(-1, 1) * cs * 0.12, ry + rand(-1, 1) * cs * 0.12); c.stroke(); }
        c.font = Math.round(cs * 0.28) + 'px DispNum, Bangers, Impact, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = INK; c.strokeText('ZZZ', x + cs * 0.28, y - cs * 0.5); c.fillStyle = '#e6ff5a'; c.fillText('ZZZ', x + cs * 0.28, y - cs * 0.5);
        c.restore();
      }
      if (o.shield > 0 && !ko) { c.save(); c.globalAlpha *= 0.35 + 0.1 * Math.sin(TM * 4); c.beginPath(); c.arc(x, y - cs * 0.08, cs * 0.46, 0, TAU); c.fillStyle = '#9fdcff'; c.fill(); c.globalAlpha = 0.8; c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.stroke(); c.restore(); }
      if (o.hitT > 0) { c.save(); c.globalAlpha = Math.min(0.6, o.hitT * 3); c.beginPath(); c.arc(x, y - cs * 0.1, cs * 0.4, 0, TAU); c.fillStyle = '#ff4f6e'; c.fill(); c.restore(); }
      if ((o.hp < o.maxHp || ko) && !G.demo) {
        const bw = cs * 0.62, bh = Math.max(4, cs * 0.075), bx0 = x - bw / 2, by0 = y + cs * 0.37, k = clamp(o.hp / o.maxHp, 0, 1);
        rr(c, bx0, by0, bw, bh, bh / 2); c.fillStyle = INK; c.fill();
        if (k > 0) { rr(c, bx0 + 1.5, by0 + 1.5, Math.max(bh - 3, (bw - 3) * k), bh - 3, (bh - 3) / 2); c.fillStyle = k > 0.5 ? COL().good : k > 0.25 ? COL().mid : COL().bad; c.fill(); }
      }
      if (o.s.aff) { const up = o.s.aff > 0, mx = x - cs * 0.33, my = y + cs * 0.14, k2 = cs * 0.09; c.beginPath(); if (up) { c.moveTo(mx - k2, my + k2 * 0.6); c.lineTo(mx + k2, my + k2 * 0.6); c.lineTo(mx, my - k2); } else { c.moveTo(mx - k2, my - k2 * 0.6); c.lineTo(mx + k2, my - k2 * 0.6); c.lineTo(mx, my + k2); } c.closePath(); fs(c, up ? '#5cd86a' : '#ff4f6e', 1.5); }
      if (dg) c.restore();
    }
    else if (k === 1) drawEnemy(c, o.type, x, y, cs, TM, o);
    else drawBase(c, x, y, cs, TM, G.hitBase && Math.hypot(G.hitBase[0] - o[0], G.hitBase[1] - o[1]) < 0.1 ? G.baseHit : 0);
  }
  if (gc && inside(gc.c, gc.r) && !towerAt(gc.c, gc.r)) {
    const [x, y] = cellXY(gc.c + 0.5, gc.r + 0.5);
    c.save(); c.globalAlpha = 0.6; drawTower(c, G.selType, x, y, cs, 1, TM, 0, 0.3, 0, false); c.restore();
  }
  for (const o of G.tors) {
    const [gx, gy] = pathAt(o.d, o.pi), [x, y] = toScreen(gx, gy);
    c.save(); c.globalAlpha = Math.min(1, (o.dur - o.t) / 0.3, o.t / 0.15);
    for (let k = 0; k < 6; k++) {
      const yy = y + cs * 0.2 - k * cs * 0.13, rx = cs * (0.1 + k * 0.055), off = Math.sin(o.rot + k) * cs * 0.05;
      c.beginPath(); c.ellipse(x + off, yy, rx, rx * 0.35, 0, 0, TAU);
      c.lineWidth = cs * 0.09; c.strokeStyle = INK; c.stroke(); c.lineWidth = cs * 0.05; c.strokeStyle = k % 2 ? '#ffb03d' : '#ff5a3d'; c.stroke();
    }
    c.restore();
  }
  for (const e of G.enemies) { if (!e.flying) continue; const [x, y] = toScreen(e.x, e.y); drawEnemy(c, e.type, x, y + cs * 0.2, cs, TM, e); }
  for (const t of G.towers) {
    if (t.type !== 'plasma' || !t.beam || t.beam.dead) continue;
    const e = t.beam, [x0, y0] = toScreen(t.x, t.y), [x1, y1] = toScreen(e.x, e.y);
    const ya = y0 - cs * 0.42, yb = y1 + cs * 0.2 - ((e.flying ? FLY : 0) + 0.3) * cs, ramp = Math.min(t.s.rampMax, t.beamT || 0);
    const w = cs * (0.06 + 0.025 * ramp) * (0.85 + Math.random() * 0.3);
    c.save(); c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, ya); c.lineTo(x1, yb);
    c.lineWidth = w + 4; c.strokeStyle = INK; c.stroke(); c.lineWidth = w; c.strokeStyle = '#ff6ad5'; c.stroke(); c.lineWidth = w * 0.4; c.strokeStyle = '#ffffff'; c.stroke();
    c.beginPath(); c.arc(x1, yb, w * 1.1, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); c.restore();
  }
  // Projectiles
  for (const p of G.projs) {
    const [x0, y0] = toScreen(p.x, p.y), x = x0, y = y0 - p.up * cs;
    c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
    if (p.kind === 'feu') {
      c.beginPath(); c.arc(0, 0, cs * 0.12, 0, TAU); fs(c, '#ff9a3d', lw);
      c.beginPath(); c.arc(-cs * 0.03, -cs * 0.03, cs * 0.06, 0, TAU); c.fillStyle = '#fff1a0'; c.fill();
    } else if (p.kind === 'eau') {
      c.beginPath(); c.arc(0, 0, cs * 0.11, 0, TAU); fs(c, '#6cc6ff', lw);
      c.beginPath(); c.arc(-cs * 0.035, -cs * 0.035, cs * 0.03, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
    } else if (p.kind === 'terre') {
      c.rotate(p.rot); c.beginPath();
      [[-1, 0.4], [-0.6, -0.8], [0.4, -0.9], [1, 0], [0.5, 0.85], [-0.5, 0.8]].forEach(([a, b], i) => i ? c.lineTo(a * cs * 0.15, b * cs * 0.15) : c.moveTo(a * cs * 0.15, b * cs * 0.15));
      c.closePath(); fs(c, '#c08a58', lw);
    } else if (p.kind === 'volcan' || p.kind === 'marais') {
      c.beginPath(); c.arc(0, 0, cs * 0.15, 0, TAU); fs(c, p.kind === 'volcan' ? '#ff5a3d' : '#7a6a34', lw);
      c.beginPath(); c.arc(-cs * 0.04, -cs * 0.04, cs * 0.06, 0, TAU); c.fillStyle = p.kind === 'volcan' ? '#ffd23f' : '#9c8a4a'; c.fill();
    } else if (p.kind === 'vent') {
      const [dx, dy] = L.portrait ? [p.ty - p.sy, p.tx - p.sx] : [p.tx - p.sx, p.ty - p.sy];
      c.rotate(Math.atan2(dy, dx));
      for (const o of [0, -cs * 0.12]) { c.beginPath(); c.arc(o, 0, cs * 0.2, -1.1, 1.1); c.lineWidth = lw * 2.4; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 1.2; c.strokeStyle = '#e6fff8'; c.stroke(); }
    }
    c.restore();
  }
  for (const p of G.eprojs) {
    if (!G.towers.includes(p.t)) continue;
    const k = Math.min(1, p.p), gx = lerp(p.sx, p.t.x, k), gy = lerp(p.sy, p.t.y, k), [x, y] = toScreen(gx, gy), yy = y - cs * (0.25 + Math.sin(k * Math.PI) * 0.6);
    c.beginPath(); c.arc(x, yy, cs * 0.1, 0, TAU); fs(c, p.evil ? '#4a1f7a' : '#b57bff', Math.max(1.4, cs * 0.04));
    if (p.evil) { c.beginPath(); c.arc(x, yy, cs * 0.045, 0, TAU); c.fillStyle = '#ff6ad5'; c.fill(); }
  }
  // Anneaux et éclairs
  for (const f of G.fx) {
    const k = f.t / f.dur;
    if (f.kind === 'beam') continue; // dessiné avant les tours (drawBeam)
    if (f.kind === 'ring') {
      const [x, y] = toScreen(f.gx, f.gy), R = lerp(f.r0, f.r1, 1 - (1 - k) * (1 - k)) * cs / L.cw;
      c.save(); c.globalAlpha = 1 - k;
      c.beginPath(); c.arc(x, y, R, 0, TAU); c.lineWidth = cs * 0.12 * (1 - k) + 3; c.strokeStyle = INK; c.stroke();
      c.lineWidth = cs * 0.12 * (1 - k) + 1; c.strokeStyle = f.color; c.stroke(); c.restore();
    } else if (f.kind === 'bolt') {
      const sp = f.pts.map(q => { const [x, y] = toScreen(q.gx, q.gy); return [x, y - q.up * cs]; });
      c.save(); c.globalAlpha = 1 - k * 0.6; c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < sp.length - 1; i++) {
        const [x0, y0] = sp[i], [x1, y1] = sp[i + 1], n = 6, nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
        if (i === 0) c.moveTo(x0, y0);
        for (let j = 1; j <= n; j++) { const q = j / n, o = j === n ? 0 : (Math.random() - 0.5) * cs * 0.35; c.lineTo(lerp(x0, x1, q) + nx / nl * o, lerp(y0, y1, q) + ny / nl * o); }
      }
      c.lineWidth = cs * 0.16; c.strokeStyle = INK; c.stroke();
      c.lineWidth = cs * 0.09; c.strokeStyle = f.color || '#ffe34d'; c.stroke();
      c.lineWidth = cs * 0.03; c.strokeStyle = '#ffffff'; c.stroke();
      c.restore();
    }
  }
  // Particules
  for (const p of G.parts) {
    const [x0, y0] = toScreen(p.gx, p.gy), x = x0 + p.ox * cs, y = y0 + p.oy * cs, a = clamp(p.life / p.max, 0, 1), s = p.size * cs;
    c.globalAlpha = a;
    if (p.shape === 'rain') { c.beginPath(); c.moveTo(x, y); c.lineTo(x - s * 0.8, y - s * 4); c.lineWidth = 2; c.strokeStyle = p.color; c.stroke(); }
    else if (p.shape === 'star') { star(c, x, y, s * 1.3, s * 0.55, 4, p.rot); c.fillStyle = p.color; c.fill(); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke(); }
    else { c.beginPath(); c.arc(x, y, s, 0, TAU); c.fillStyle = p.color; c.fill(); if (s > 3) { c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke(); } }
  }
  c.globalAlpha = 1;
  // Onomatopées
  for (const t of G.texts) {
    const [x, y] = toScreen(t.gx, t.gy), k = t.t / t.dur;
    const pop = t.t < 0.12 ? 0.4 + (t.t / 0.12) * 0.9 : 1.3 - Math.min(0.3, (t.t - 0.12) * 1.5);
    c.save(); c.globalAlpha = k > 0.72 ? (1 - k) / 0.28 : 1;
    c.translate(x, y + t.oy * cs); c.rotate(t.rot); c.scale(pop, pop);
    const px = Math.max(12, Math.round(t.size * cs));
    c.font = px + 'px DispNum, Bangers, Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = Math.max(3, px * 0.24); c.strokeStyle = INK; c.strokeText(t.txt, 2, 2); c.strokeText(t.txt, 0, 0);
    c.fillStyle = t.color; c.fillText(t.txt, 0, 0);
    c.restore();
  }
  c.restore();
  if (G.drag) {
    const d = G.drag;
    let gx = d.px, gy = d.py - (d.mouse ? 0 : cs * 0.75), tx = 0, ty = 0;
    if (d.over) {
      [tx, ty] = toScreen(d.over.x, d.over.y); gx = tx; gy = ty - cs * 0.78 + Math.sin(TM * 8) * cs * 0.03;
      c.save(); c.setLineDash([cs * 0.1, cs * 0.08]); c.lineDashOffset = -TM * 30; c.lineCap = 'round';
      c.beginPath(); c.moveTo(d.px, d.py); c.lineTo(gx, gy + cs * 0.2); c.lineWidth = 5; c.strokeStyle = INK; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#ff6ad5'; c.stroke();
      c.restore();
    }
    c.save(); c.globalAlpha = d.over ? 0.85 : 0.9; drawTower(c, d.t.type, gx, gy, cs * (d.over ? 0.8 : 1.1), d.t.lvl, TM, 0, 0.3, 0.3, false, d.t.br); c.restore();
    if (d.over) {
      const r = fuseCheck(d.t, d.over), Tt = terrainAt(d.over.c, d.over.r), a = r.ok && Tt ? affinity(r.k, Tt) : 0;
      pill(c, r.ok ? '= ' + TOWERS[r.k].name + ' · ' + TOWERS[r.k].fee + T(' or') + (a ? ' · ' + Tt.name + ' ' + fmtAff(a) : '') : r.why, tx, ty - cs * 1.3, r.ok);
    }
  }
  if (G.tpill && !G.drag) { const [txt, x, y, bg] = G.tpill; pill(c, txt, x, y, false, bg, INK); }
  if (G.coop && typeof drawPings === 'function') drawPings(c);
  if (G.speedLines > 0 && !RM && !COMFORT.calm) {
    const a = Math.min(1, G.speedLines), cx = L.w / 2, cy = L.h / 2, R = Math.hypot(L.w, L.h) / 2;
    c.save(); c.globalAlpha = a * 0.75; c.fillStyle = INK;
    for (let i = 0; i < 52; i++) {
      const ang = (i / 52) * TAU + Math.random() * 0.06, w = 0.01 + Math.random() * 0.02, r0 = R * (0.5 + Math.random() * 0.25);
      c.beginPath(); c.moveTo(cx + Math.cos(ang - w) * R * 1.1, cy + Math.sin(ang - w) * R * 1.1); c.lineTo(cx + Math.cos(ang + w) * R * 1.1, cy + Math.sin(ang + w) * R * 1.1); c.lineTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); c.closePath(); c.fill();
    }
    c.restore();
  }
  drawWeather(c);
  if (G.hurtT > 0 && !COMFORT.calm) {
    const g = c.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.3, L.w / 2, L.h / 2, Math.hypot(L.w, L.h) / 2);
    g.addColorStop(0, 'rgba(255,60,90,0)'); g.addColorStop(1, 'rgba(255,60,90,' + (G.hurtT * 0.9) + ')');
    c.fillStyle = g; c.fillRect(0, 0, L.w, L.h);
  }
}

