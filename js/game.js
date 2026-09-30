// Élémento Defense : Moteur : plateau, état de la partie, vagues, ennemis, tirs, effets et rendu.
'use strict';
// Garantit, sur chaque carte, une zone bonus pour chacune des 6 tours primaires
const BEST_TILE = { feu: 'V', eau: 'L', terre: 'R', vent: 'W', foudre: 'K', glace: 'N' };
MAPS.forEach((m, mi) => {
  const cells = buildPath(m).cells, rows = m.terrain.map(r => r.split('')), rnd = mulberry(mi * 97 + 3), cand = [];
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    if (cells.has(q + ',' + r) || rows[r][q] !== '.') continue;
    let near = false; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (cells.has((q + a) + ',' + (r + b))) near = true;
    if (near) cand.push([q, r]);
  }
  for (const el of ['feu', 'eau', 'terre', 'vent', 'foudre', 'glace']) {
    const ch = BEST_TILE[el]; if (rows.some(r => r.includes(ch))) continue;
    while (cand.length) {
      const k = Math.floor(rnd() * cand.length), [q, r] = cand.splice(k, 1)[0];
      if (rows[r][q] !== '.') continue;
      rows[r][q] = ch;
      for (const [a, b] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const q2 = q + a, r2 = r + b; if (q2 >= 0 && q2 < COLS && r2 >= 0 && r2 < ROWS && !cells.has(q2 + ',' + r2) && rows[r2][q2] === '.') { rows[r2][q2] = ch; break; } }
      break;
    }
  }
  m.terrain = rows.map(r => r.join(''));
});

// ================= Layout / canvas =================
const stage = $('#stage'), cv = $('#cv'), ctx = cv.getContext('2d'), bgCv = document.createElement('canvas');
const L = { w: 1, h: 1, dpr: 1, cs: 40, ox: 0, oy: 0, portrait: false };
function toScreen(gx, gy) { return L.portrait ? [L.ox + gy * L.cs, L.oy + gx * L.cs] : [L.ox + gx * L.cs, L.oy + gy * L.cs]; }
function toGridF(px, py) { let gx = (px - L.ox) / L.cs, gy = (py - L.oy) / L.cs; if (L.portrait) [gx, gy] = [gy, gx]; return [gx, gy]; }
// Cible d'un glisser-déposer : visée depuis la tour flottante (au-dessus du doigt), avec un effet aimant
function dragTarget(d) {
  const [gx, gy] = toGridF(d.px, d.py - (d.mouse ? 0 : L.cs * 0.75));
  let best = null, bd = Infinity, weak = null, wd = Infinity;
  for (const o of G.towers) {
    if (o === d.t) continue;
    const dist = Math.hypot(o.c + 0.5 - gx, o.r + 0.5 - gy);
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
  const vc = L.portrait ? ROWS : COLS, vr = L.portrait ? COLS : ROWS;
  L.cs = Math.max(8, Math.min((L.w - 32) / vc, (L.h - 24) / vr));
  L.ox = (L.w - vc * L.cs) / 2; L.oy = (L.h - vr * L.cs) / 2;
  if (G) { buildBg(); for (const e of G.enemies) setPos(e); }
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
  rr(c, L.ox + 5, L.oy + 6, vw, vh, rad); c.fillStyle = INK; c.fill();
  c.save(); rr(c, L.ox, L.oy, vw, vh, rad); c.clip();
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const [x, y] = toScreen(q, r); c.fillStyle = (q + r) % 2 ? m.ground : m.ground2; c.fillRect(x, y, cs + 0.6, cs + 0.6);
  }
  c.fillStyle = dotPattern(c, 'rgba(42,27,61,.06)', 8); c.fillRect(L.ox, L.oy, vw, vh);
  const tch = (q, r) => { if (!G.terrain || !inside(q, r) || P.cells.has(q + ',' + r)) return null; const ch = G.terrain[r][q]; return ch === '.' ? null : ch; };
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { const ch = tch(q, r); if (ch && ch !== 'X') { const [x, y] = toScreen(q, r); drawTile(c, ch, x, y, cs, q, r); } }
  c.strokeStyle = 'rgba(42,27,61,.3)'; c.lineWidth = 2; c.lineCap = 'round';
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const ch = tch(q, r); if (!ch || ch === 'X') continue;
    for (const [dq, dr, a, b, e, f] of [[1, 0, 1, 0, 1, 1], [-1, 0, 0, 0, 0, 1], [0, 1, 0, 1, 1, 1], [0, -1, 0, 0, 1, 0]]) {
      const n = tch(q + dq, r + dr); if (n === ch || !inside(q + dq, r + dr) || P.cells.has((q + dq) + ',' + (r + dr))) continue;
      const [x0, y0] = toScreen(q + a, r + b), [x1, y1] = toScreen(q + e, r + f); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
  }
  const sp = P.pts.map(([x, y]) => toScreen(x, y));
  const line = (w, col, dash) => { c.beginPath(); sp.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.lineWidth = w; c.strokeStyle = col; c.setLineDash(dash || []); c.stroke(); };
  c.lineJoin = 'round'; c.lineCap = 'butt';
  line(cs * 0.9, INK); line(cs * 0.8, m.pathEdge); line(cs * 0.66, m.path);
  line(cs * 0.07, 'rgba(255,255,255,.55)', [cs * 0.15, cs * 0.3]);
  c.setLineDash([]);
  for (const d of G.deco) drawDeco(c, d, cs);
  const obs = [];
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) if (tch(q, r) === 'X') obs.push(toScreen(q + 0.5, r + 0.5));
  obs.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => drawObstacle(c, MAPS[G.map].obstacle, x, y, cs));
  c.restore();
  rr(c, L.ox, L.oy, vw, vh, rad); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
}

// ================= État du jeu =================
let G = null, P = null;
function buildPath(m) {
  const pts = m.pts.map(([q, r]) => [q + 0.5, r + 0.5]), segs = []; let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
    segs.push({ x0, y0, dx: (x1 - x0) / len, dy: (y1 - y0) / len, len, start: tot }); tot += len;
  }
  const cells = new Set();
  for (let i = 0; i < m.pts.length - 1; i++) {
    const [c0, r0] = m.pts[i], [c1, r1] = m.pts[i + 1], n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let k = 0; k <= n; k++) { const q = c0 + Math.sign(c1 - c0) * k, r = r0 + Math.sign(r1 - r0) * k; if (q >= 0 && q < COLS && r >= 0 && r < ROWS) cells.add(q + ',' + r); }
  }
  const a = m.pts[0], z = m.pts[m.pts.length - 1];
  return { pts, segs, total: tot, goal: tot - 1, cells, portal: [a[0] + 1.5, a[1] + 0.5], base: [z[0] - 0.5, z[1] + 0.5] };
}
function pathAt(d) {
  for (const s of P.segs) if (d <= s.start + s.len) { const k = d - s.start; return [s.x0 + s.dx * k, s.y0 + s.dy * k, s.dx, s.dy]; }
  const s = P.segs[P.segs.length - 1]; return [s.x0 + s.dx * s.len, s.y0 + s.dy * s.len, s.dx, s.dy];
}
function genDeco(mi) {
  const m = MAPS[mi], rnd = mulberry(mi * 977 + 13), list = [];
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const a = rnd(), b = rnd(), ox = rnd(), oy = rnd(), sz = rnd();
    if (P.cells.has(q + ',' + r) || a > 0.22 || (G && G.terrain && G.terrain[r][q] !== '.')) continue;
    list.push({ c: q, r, type: m.deco[Math.floor(b * m.deco.length)], ox: (ox - 0.5) * 0.4, oy: (oy - 0.5) * 0.4, s: 0.75 + sz * 0.4 });
  }
  return list;
}
function baseState(mi, save, diff) {
  const m = MAPS[mi]; diff = (save && save.diff) || diff || 'moyen'; const Df = DIFFS[diff];
  return { map: mi, diff, maxw: Df.waves, hpd: Df.hp, spd: Df.speed, bm: Df.bonus, mm: Df.malus, banked: save ? save.banked || 0 : 0,
    terrain: m.terrain ? diffTerrain(mi, diff) : null, gold: save ? save.gold : Df.gold + M('gold') * 25, lives: save ? save.lives : Df.lives + M('lives') * 2, wave: save ? save.wave : 0, score: save ? save.score : 0,
    bossKills: save ? save.bossKills || 0 : 0, shardsPaid: save ? save.shardsPaid || 0 : 0, won: save ? !!save.won : false, reviveUsed: save ? !!save.reviveUsed : false,
    endless: save ? !!save.endless : diff === 'infini', towers: [], enemies: [], projs: [], fx: [], parts: [], texts: [], zones: [], tors: [], eprojs: [], spawnQ: [], spawnT: 0,
    waveActive: false, speed: 1, paused: false, over: false, time: 0, shake: 0, speedLines: 0, hurtT: 0, baseHit: 0, eid: 0, onoCd: {},
    selType: null, selTower: null, hover: null, ghost: null, bad: null, autoT: 0, checkpoint: null };
}
function newGame(mi, save, diff) {
  const m = MAPS[mi];
  G = baseState(mi, save, diff);
  P = buildPath(m); G.deco = genDeco(mi);
  if (save) for (const t of save.towers) addTower(t.type, t.c, t.r, t.lvl >= 3 && !t.br && !TOWERS[t.type].fusion ? 2 : t.lvl, t.mode, t.inv, t.br);
  saveCheckpoint();
  hudCache = {};
  resize(); refreshCosts(); showPanel('palette'); refreshPalette();
  $('#bSpeed').textContent = 'x1';
  show('game'); keepAwake();
  if (save) banner('REPRISE', 'Vague ' + (G.wave + 1) + ' prête');
  else {
    banner('PRÊT ?', MAPS[mi].name + ' · ' + DIFFS[G.diff].name + (G.endless ? ' · vagues infinies' : ' · ' + G.maxw + ' vagues'));
    const seen = store.get('elemento.bankhint') || 0;
    if (seen < 3) { store.set('elemento.bankhint', seen + 1); setTimeout(() => { if (G && G.map === mi && !G.over && !G.duel) bankHint(5000); }, 2400); }
  }
}
function saveCheckpoint() {
  if (G.duel || duelOn) return;
  G.checkpoint = { map: G.map, mapId: MAPS[G.map].id, diff: G.diff, banked: G.banked, gold: G.gold, lives: G.lives, wave: G.wave, score: G.score, endless: G.endless,
    bossKills: G.bossKills, shardsPaid: G.shardsPaid, won: G.won, reviveUsed: G.reviveUsed,
    towers: G.towers.map(t => ({ type: t.type, c: t.c, r: t.r, lvl: t.lvl, mode: t.mode, inv: t.inv, br: t.br })) };
  store.set(SAVE, G.checkpoint);
}
function recordBest() {
  if (G.duel || duelOn) return { wave: G.wave, score: G.score };
  const b = store.get(BEST2) || {}, id = MAPS[G.map].id, rec = (b[id] = b[id] || {}), cur = rec[G.diff] || { wave: 0, score: 0, won: false };
  if (G.wave > cur.wave || (G.wave === cur.wave && G.score > cur.score)) { cur.wave = G.wave; cur.score = G.score; }
  if (G.won) cur.won = true;
  rec[G.diff] = cur; store.set(BEST2, b);
  return cur;
}
function bankGold() {
  const gain = Math.max(0, G.gold - (G.banked || 0)); G.banked = Math.max(G.banked || 0, G.gold);
  meta.bank = (meta.bank || 0) + gain; saveMeta();
  return { gain, total: meta.bank };
}

// ---------- Tours ----------
const towerAt = (q, r) => G.towers.find(t => t.c === q && t.r === r);
const inside = (q, r) => q >= 0 && r >= 0 && q < COLS && r < ROWS;
const canBuild = (q, r) => inside(q, r) && !P.cells.has(q + ',' + r) && !towerAt(q, r) && !(terrainAt(q, r) || {}).block;
function terrainAt(q, r) {
  if (!G || !G.terrain || !inside(q, r) || P.cells.has(q + ',' + r)) return null;
  return TERRAINS[G.terrain[r][q]] || null;
}
function towerStats(t) {
  const st = statsOf(t.type, t.lvl, t.br), T = terrainAt(t.c, t.r), B = G && !G.demo ? MAPS[G.map].biome : null;
  let a = 0;
  if (T && !T.block) { st.terr = T; st.aff = affinity(t.type, T); a += st.aff; if (T.range) st.range += T.range; }
  if (B) { st.bio = affinity(t.type, B); a += st.bio; }
  if (a) { const m = Math.max(0.1, 1 + a); st.dmg *= m; for (const k of ['burn', 'lava', 'poison']) if (st[k]) st[k] *= m; }
  return st;
}
function addTower(type, q, r, lvl = 1, mode = 'premier', inv, br) {
  const t = { type, c: q, r, lvl, mode, br: br || null, inv: inv || costOf(type), cd: 0.3, recoil: 0, blink: rand(1, 4), lx: 0, ly: 0.3, pulses: 0 };
  t.s = towerStats(t); healTower(t, true); refillShield(t); t.ko = 0; t.stun = 0; G.towers.push(t);
  const n = G.deco.length; G.deco = G.deco.filter(d => !(d.c === q && d.r === r)); if (n !== G.deco.length && L.w > 1) buildBg();
  return t;
}
function build(type, q, r) {
  const D = TOWERS[type], cost = costOf(type); G.gold -= cost;
  const t = addTower(type, q, r); t.recoil = 1;
  burst(q + 0.5, r + 0.5, 0.1, 12, ['#ffffff', '#f1eafa', D.color], 2.2, 0.09, 3, 0.5, 'star');
  ono('POP!', q + 0.5, r + 0.5, '#fff', 0.45, 0.1, 0.9);
  Snd.play('build'); G.ghost = null;
  if (G.gold < cost) { G.selType = null; refreshPalette(); }
}
function upgrade(t, br) {
  const cost = upCost(t); if (!cost) return;
  if (t.lvl === 2 && !t.br && !br && !TOWERS[t.type].fusion) { openTree(t); return; }
  if (br && t.br && br !== t.br) return;
  if (G.gold < cost) { hint('Pas assez d’or pour améliorer'); Snd.play('no'); return; }
  G.gold -= cost; t.lvl++; if (t.lvl >= 3 && !t.br) t.br = br; t.inv += cost; t.s = towerStats(t); t.recoil = 1; if (!(t.ko > 0)) healTower(t, true);
  burst(t.c + 0.5, t.r + 0.5, 0.4, 16, ['#ffd23f', '#ffffff', t.br ? BRANCH[t.br].color : TOWERS[t.type].color], 2.6, 0.1, 2, 0.7, 'star');
  ono(t.br ? BRANCH[t.br].short.toUpperCase() + (t.lvl === 3 ? ' I !' : ' II !') : 'LEVEL UP!', t.c + 0.5, t.r + 0.5, '#ffd23f', 0.5, 0, 1.0);
  Snd.play('up'); refreshInfo();
}
function evolve(t) { if (TOWERS[t.type].fusion) upgrade(t); else if (t.lvl === 2 || t.lvl >= 4) openTree(t); else upgrade(t, t.br); }
function sell(t) {
  const v = sellValue(t); G.gold += v;
  G.towers = G.towers.filter(x => x !== t);
  burst(t.c + 0.5, t.r + 0.5, 0.3, 12, ['#cdbfe0', '#ffffff', '#ffd23f'], 2, 0.09, 3, 0.5);
  G.texts.push({ txt: '+' + v, gx: t.c + 0.5, gy: t.r + 0.5, oy: -0.5, t: 0, dur: 0.9, color: '#ffd23f', size: 0.36, rot: 0 });
  Snd.play('sell'); deselect();
}

// ---------- Vagues ----------
function makeWave(w) {
  const pool = ['gloop', 'gloop'];
  if (w >= 3) pool.push('zip'); if (w >= 4) pool.push('flappy'); if (w >= 6) pool.push('tonk'); if (w >= 8) pool.push('magma'); if (w >= 7) pool.push('gresil'); if (w >= 9) pool.push('crachou');
  let theme = null, label = '';
  if (w % 10 === 0) label = 'Un Kaiju approche...';
  else if (w >= 4 && w % 5 === 4) { theme = 'flappy'; label = 'Nuée de Flappy !'; }
  else if (w >= 7 && w % 7 === 0) { theme = 'zip'; label = 'Ruée de Zippy !'; }
  else if (w >= 6 && w % 6 === 0) { theme = 'tonk'; label = 'Parade de Tonk !'; }
  else if (w >= 8 && w % 8 === 3) { theme = 'magma'; label = 'Pluie de Magmo !'; }
  let n = Math.round(6 + w * 1.5);
  if (theme === 'tonk') n = Math.round(n * 0.55); if (theme === 'zip') n = Math.round(n * 1.4);
  const gap = Math.max(0.32, 0.95 - w * 0.017), list = [];
  for (let i = 0; i < n; i++) {
    const type = theme && Math.random() < 0.75 ? theme : pick(pool);
    list.push({ type, gap: gap * (type === 'zip' ? 0.55 : type === 'tonk' ? 1.5 : 1) });
  }
  if (w >= 12) { const k = 1 + Math.floor((w - 12) / 8); for (let i = 0; i < k; i++) list.splice(Math.floor(rand(list.length)), 0, { type: 'malefik', gap: 1.2 }); }
  if (w % 10 === 0) { list[list.length - 1].gap = 2.5; for (let i = 0; i < Math.floor(w / 10); i++) list.push({ type: 'boss', gap: 3 }); }
  return { list, label };
}
function startWave() {
  if (!G || G.over || G.spawnQ.length || G.duel) return;
  let early = 0;
  if (G.waveActive && G.enemies.length) { early = 5 + Math.floor(G.wave / 2); G.gold += early; }
  G.wave++;
  const { list, label } = makeWave(G.wave);
  for (const t of G.towers) if (!(t.ko > 0)) t.shield = Math.max(t.shield || 0, Math.round(t.maxHp * 0.15 * M('bouclier')));
  G.spawnQ.push(...list); G.spawnT = 0.5; G.waveActive = true; G.autoT = 0;
  const last = G.wave === G.maxw && !G.endless;
  banner('VAGUE ' + G.wave, early ? 'Bonus d’audace +' + early : (last ? 'Dernière vague !' : label), false);
  Snd.play('wave');
}
function waveDone() {
  if (G.duel) { G.waveActive = false; return; }
  G.waveActive = false;
  for (const t of G.towers) { healTower(t, true); t.ko = 0; t.stun = 0; t.evil = 0; refillShield(t); }
  const bonus = Math.round((10 + G.wave) * (1 + 0.2 * M('bonus'))); G.gold += bonus; G.score += G.wave * 50;
  const aw = awardShards();
  hint('Vague ' + G.wave + ' : +' + bonus + ' or' + (aw.gain ? ', +' + aw.gain + ' éclats' : '') + (canBuyAnything() ? ' · achat possible dans l’Atelier' : ''), 3200);
  Snd.play('clear');
  saveCheckpoint(); recordBest();
  if (G.wave >= G.maxw && !G.endless) { setTimeout(() => victory(), 700); return; }
  if (opts.auto) G.autoT = 3;
}
function awardShards() {
  const mult = MAPS[G.map].shards * DIFFS[G.diff || 'moyen'].shards;
  const parts = { wave: G.wave * 2, score: Math.floor(G.score / 400), boss: G.bossKills * 5, win: G.won ? 30 : 0 };
  const total = Math.round((parts.wave + parts.score + parts.boss + parts.win) * mult);
  const gain = Math.max(0, total - G.shardsPaid), before = G.shardsPaid;
  G.shardsPaid += gain; meta.shards += gain; meta.earned += gain; saveMeta();
  return { gain, parts, mult, before };
}
function victory() {
  if (!G || G.over) return;
  G.paused = true; G.won = true; G.endless = true; Snd.play('win');
  const best = recordBest(), award = awardShards(), bank = bankGold(); saveCheckpoint();
  showOver(true, best, award, bank);
}
function gameOver() {
  if (G.duel) { duelDead('ko'); return; }
  G.over = true; G.lives = 0; Snd.play('ko');
  const best = recordBest(), award = awardShards(), bank = bankGold(); store.del(SAVE);
  setTimeout(() => { if (G && G.over) showOver(false, best, award, bank); }, 1300);
}

// ---------- Ennemis ----------
function spawn(type) {
  const D = ETYPES[type], w = G.wave, m = hpMul(w) * MAPS[G.map].hpMul * (G.hpd || 1);
  const e = { id: ++G.eid, type, hp: D.hp * m, maxHp: D.hp * m, speed: D.speed * rand(0.95, 1.05) * (G.spd || 1),
    armor: D.armor ? D.armor + Math.floor(w / 10) : 0, flying: !!D.flying, d: 1, x: 0, y: 0, sdx: 1, sdy: 0,
    slowA: 0, slowT: 0, wet: 0, burn: 0, burnT: 0, frozen: 0, stun: 0, flash: 0, phase: rand(TAU), dead: false, lifeCost: D.lifeCost || 1, abT: 1.2 };
  setPos(e); G.enemies.push(e);
  if (D.boss) {
    G.speedLines = 1.5; G.shake = Math.max(G.shake, 0.5);
    banner('KAIJU !!', 'Le boss débarque', true); Snd.play('boss');
  }
}
function setPos(e) {
  const [x, y, dx, dy] = pathAt(e.d); e.x = x; e.y = y;
  if (L.portrait) { e.sdx = dy; e.sdy = dx; } else { e.sdx = dx; e.sdy = dy; }
}
const THP = { feu: 100, eau: 100, terre: 160, vent: 90, foudre: 110, glace: 120 };
const towerMaxHp = t => Math.round((THP[t.type] || 180) * (1 + 0.25 * (t.lvl - 1)) * (1 + 0.2 * M('remparts')));
function refillShield(t) { t.shield = Math.round(t.maxHp * 0.15 * M('bouclier')); }
function healTower(t, full) { t.maxHp = towerMaxHp(t); if (full || t.hp == null) t.hp = t.maxHp; else t.hp = Math.min(t.hp, t.maxHp); }
function damageTower(t, dmg) {
  if (t.ko > 0 || G.demo) return;
  if (t.shield > 0) { const a = Math.min(t.shield, dmg); t.shield -= a; dmg -= a; }
  t.hp -= dmg; t.hitT = 0.25;
  if (t.hp <= 0) {
    t.hp = 0; t.ko = 8; t.stun = 0;
    ono('K.O. !', t.c + 0.5, t.r + 0.5, '#ff4f6e', 0.5, 0, 0.9); Snd.play('hurt');
    burst(t.c + 0.5, t.r + 0.5, 0.3, 10, ['#cdbfe0', '#ffffff', '#ff4f6e'], 2.2, 0.08, 3, 0.5);
  }
}
const nearTowers = (e, R) => G.towers.filter(t => !(t.ko > 0) && (t.c + 0.5 - e.x) ** 2 + (t.r + 0.5 - e.y) ** 2 <= R * R);
function enemyAbility(e, dt) {
  const D = ETYPES[e.type];
  if (!(e.type === 'gresil' || e.type === 'crachou' || e.type === 'malefik' || D.boss) || e.frozen > 0 || e.stun > 0 || G.demo) return;
  e.abT -= dt; if (e.abT > 0) return;
  const pw = 1 + G.wave * 0.04;
  if (e.type === 'gresil') {
    const ts = nearTowers(e, 1.5); if (!ts.length) { e.abT = 0.3; return; }
    const dur = 1.8 * (1 - 0.25 * M('paratonnerre'));
    for (const t of ts) t.stun = Math.max(t.stun || 0, dur);
    G.fx.push({ kind: 'ring', gx: e.x, gy: e.y, r0: 0.2, r1: 1.5, t: 0, dur: 0.4, color: '#e6ff5a' });
    ono('BZZT!', e.x, e.y, '#e6ff5a', 0.45, 0.4, 0.8); Snd.play('foudre');
    e.abT = 3.5;
  } else if (e.type === 'crachou') {
    const ts = nearTowers(e, 2.0); if (!ts.length) { e.abT = 0.3; return; }
    let tg = ts[0], bd = Infinity; for (const t of ts) { const d2 = (t.c + 0.5 - e.x) ** 2 + (t.r + 0.5 - e.y) ** 2; if (d2 < bd) { bd = d2; tg = t; } }
    G.eprojs.push({ sx: e.x, sy: e.y, t: tg, p: 0, dur: 0.45, dmg: 12 * pw });
    e.abT = 1.8;
  } else if (e.type === 'malefik') {
    const ts = nearTowers(e, 2.2).filter(t => !(t.evil > 0)); if (!ts.length) { e.abT = 0.4; return; }
    let tg = ts[0]; for (const t of ts) if (t.lvl > tg.lvl || (t.lvl === tg.lvl && t.s.dmg * t.s.rate > tg.s.dmg * tg.s.rate)) tg = t;
    tg.evil = 6 * (1 - 0.25 * M('talisman')); tg.evilBy = e.id; tg.beam = null; tg.cd = 0.5;
    G.fx.push({ kind: 'bolt', pts: [{ gx: e.x, gy: e.y, up: 0.5 }, { gx: tg.c + 0.5, gy: tg.r + 0.5, up: 0.45 }], t: 0, dur: 0.4, color: '#c77dff' });
    ono('MWAHAHA!', e.x, e.y, '#c77dff', 0.5, 0.5, 0.9); Snd.play('evil');
    e.abT = 7;
  } else {
    const ts = nearTowers(e, 1.6); if (!ts.length) { e.abT = 0.5; return; }
    for (const t of ts) damageTower(t, 30 * pw);
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
      if (G.towers.includes(p.t)) { damageTower(p.t, p.dmg); burst(p.t.c + 0.5, p.t.r + 0.5, 0.35, 6, ['#b57bff', '#e2caff'], 2, 0.07, 3, 0.4); Snd.play('thit'); }
    }
  }
  G.eprojs = G.eprojs.filter(p => !p.done);
}
function updateEnemy(e, dt) {
  enemyAbility(e, dt);
  if (e.flash > 0) e.flash -= dt;
  if (e.wet > 0) e.wet -= dt;
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowA = 0; }
  if (e.frozen > 0) e.frozen -= dt;
  if (e.stun > 0) e.stun -= dt;
  if (e.burnT > 0) {
    e.burnT -= dt; e.hp -= e.burn * dt;
    if (Math.random() < dt * 5) burst(e.x, e.y, (e.flying ? FLY : 0) + 0.45, 1, ['#ff9a3d', '#ffd23f'], 0.6, 0.06, -1.5, 0.5);
    if (e.burnT <= 0) e.burn = 0;
    if (e.hp <= 0) { kill(e); return; }
  }
  let v = e.speed * (1 - e.slowA);
  if (e.frozen > 0 || e.stun > 0) v = 0;
  e.d += v * dt; e.phase += v * dt * 6;
  if (e.d >= P.goal) { reachBase(e); return; }
  setPos(e);
}
function reachBase(e) {
  if (G.demo) { e.dead = true; return; }
  e.dead = true; G.lives -= e.lifeCost; G.shake = Math.max(G.shake, 0.45); G.hurtT = 0.5; G.baseHit = 0.4;
  ono(e.lifeCost > 1 ? '-' + e.lifeCost + ' ♥' : 'AÏE!', P.base[0], P.base[1], '#ff4f6e', 0.6, 0.2, 1.1);
  Snd.play('hurt');
  if (G.lives <= 0) {
    if (M('revive') && !G.reviveUsed) {
      G.reviveUsed = true; G.lives = 5;
      for (const o of G.enemies) if (!o.dead) knock(o, 2.5);
      G.fx.push({ kind: 'ring', gx: P.base[0], gy: P.base[1], r0: 0.2, r1: 4, t: 0, dur: 0.7, color: '#ffd23f' });
      burst(P.base[0], P.base[1], 0.5, 30, ['#ffd23f', '#ffffff', '#ff4f81'], 4, 0.12, 2, 0.8, 'star');
      banner('SECONDE CHANCE !', '5 vies retrouvées', false); Snd.play('win');
    } else gameOver();
  }
}
function brMul(s, e) {
  if (!s || !s.brMul) return 1;
  const cat = ETYPES[e.type].boss ? 'boss' : e.flying ? 'air' : 'sol';
  return cat === s.br ? s.brMul : 1;
}
function hurt(e, dmg, elem, s) {
  if (e.dead) return 0;
  const D = ETYPES[e.type], up = (e.flying ? FLY : 0) + 0.7;
  if (D.immune === elem) { ono('IMMUNISÉ', e.x, e.y, '#ffffff', 0.34, 0.9, up); return 0; }
  let m = 1;
  if (elem === 'foudre' && e.wet > 0) { m = 2; ono('ZAP x2!', e.x, e.y, '#ffe34d', 0.6, 0.25, up); }
  if (elem === 'terre' && e.frozen > 0) {
    m = 2; e.frozen = 0; ono('CRACK x2!', e.x, e.y, '#bff3ff', 0.6, 0.25, up);
    burst(e.x, e.y, 0.3, 10, ['#ffffff', '#bff3ff', '#7fd6ff'], 2.8, 0.09, 4, 0.5, 'star');
  }
  m *= brMul(s, e);
  const arm0 = Math.max(0, e.armor - (e.shred || 0)), arm = s && s.pierce ? Math.max(0, arm0 - s.pierce) : arm0;
  const d = Math.max(dmg * m - arm, dmg * m * 0.2);
  e.hp -= d; e.flash = 0.12;
  if (s && s.br === 'sol' && s.rank >= 2 && !e.flying && !D.boss && Math.random() < 0.15) e.stun = Math.max(e.stun, 0.5);
  if (e.hp <= 0) kill(e);
  return d;
}
function kill(e) {
  if (e.dead) return;
  e.dead = true;
  const D = ETYPES[e.type], rw = Math.round(D.reward * (1 + G.wave * 0.01) * (1 + 0.06 * M('loot'))), up = (e.flying ? FLY : 0) + 0.25;
  G.gold += rw; G.score += rw * 10;
  burst(e.x, e.y, up, D.boss ? 40 : 10, [D.color, D.light, '#ffffff'], D.boss ? 4 : 2.4, D.boss ? 0.14 : 0.09, 4, 0.6);
  G.texts.push({ txt: '+' + rw, gx: e.x, gy: e.y, oy: -up - 0.3, t: 0, dur: 0.8, color: '#ffd23f', size: 0.32, rot: 0 });
  if (e.type === 'malefik') for (const t of G.towers) if (t.evil > 0 && t.evilBy === e.id) { t.evil = 0; ono('LIBÉRÉE !', t.c + 0.5, t.r + 0.5, '#5cd86a', 0.42, 0, 0.9); }
  if (D.boss) { G.bossKills++; ono('K.O. !!', e.x, e.y, '#ff4f81', 1.1, 0, 0.9); G.shake = 0.7; Snd.play('boom'); }
  else { if (Math.random() < 0.18) ono(pick(['POP!', 'PAF!', 'BLOP!', 'SPLOTCH!']), e.x, e.y, '#ffffff', 0.45, 0.35, up + 0.4); Snd.play('pop'); }
}
function slowE(e, a, t) { const f = ETYPES[e.type].boss ? 0.6 : 1; e.slowA = Math.max(e.slowA, a * f); e.slowT = Math.max(e.slowT, t); }
function ignite(e, dps, t) { if (e.dead || ETYPES[e.type].immune === 'feu') return; e.burn = Math.max(e.burn, dps); e.burnT = Math.max(e.burnT, t); }
function knock(e, k, s) {
  const D = ETYPES[e.type], f = D.boss ? (s && s.br === 'boss' && s.rank ? 0.5 : 0.15) : e.type === 'tonk' ? 0.45 : 1;
  e.d = Math.max(1, e.d - k * f); setPos(e);
}

// ---------- Tir ----------
function updateTower(t, dt) {
  if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 5);
  t.blink -= dt; if (t.blink < -0.13) t.blink = rand(2, 5);
  if (t.hitT > 0) t.hitT -= dt;
  if (t.ko > 0) { t.ko -= dt; t.beam = null; if (t.ko <= 0) { t.ko = 0; t.hp = Math.round(t.maxHp * 0.5); ono('DEBOUT !', t.c + 0.5, t.r + 0.5, '#5cd86a', 0.45, 0, 0.9); } return; }
  if (t.stun > 0) { t.stun -= dt; t.beam = null; return; }
  if (t.evil > 0) {
    t.evil -= dt; t.beam = null;
    if (t.evil <= 0) { t.evil = 0; ono('LIBÉRÉE !', t.c + 0.5, t.r + 0.5, '#5cd86a', 0.42, 0, 0.9); return; }
    t.cd -= dt; if (t.cd > 0) return;
    const cx = t.c + 0.5, cy = t.r + 0.5, R2 = t.s.range * t.s.range; let tg = null, bd = Infinity;
    for (const o of G.towers) { if (o === t || o.ko > 0) continue; const d2 = (o.c + 0.5 - cx) ** 2 + (o.r + 0.5 - cy) ** 2; if (d2 <= R2 && d2 < bd) { bd = d2; tg = o; } }
    if (!tg) { t.cd = 0.2; return; }
    G.eprojs.push({ sx: cx, sy: cy, t: tg, p: 0, dur: 0.35, dmg: t.s.dmg * 0.6, evil: true });
    t.cd = 1 / Math.max(0.4, t.s.rate); t.recoil = 1;
    const ddx = tg.c + 0.5 - cx, ddy = tg.r + 0.5 - cy, [a, b] = L.portrait ? [ddy, ddx] : [ddx, ddy], l = Math.hypot(a, b) || 1; t.lx = a / l; t.ly = b / l;
    return;
  }
  if (t.type === 'plasma') { beamTower(t, dt); return; }
  t.cd -= dt; if (t.cd > 0) return;
  const s = t.s, cx = t.c + 0.5, cy = t.r + 0.5, R2 = s.range * s.range, list = [];
  for (const e of G.enemies) { if (e.dead || (!s.air && e.flying)) continue; const dx = e.x - cx, dy = e.y - cy; if (dx * dx + dy * dy <= R2) list.push(e); }
  if (!list.length) { t.cd = 0.08; return; }
  t.cd = 1 / s.rate; t.recoil = 1;
  if (t.type === 'glace' || t.type === 'blizzard') { pulse(t, s, list); return; }
  if (t.type === 'sable') { sandPulse(t, s, list); return; }
  if (t.type === 'orage') { storm(t, s, list); return; }
  let tg = list[0], bv = -Infinity;
  for (const e of list) { const v = t.mode === 'fort' ? e.hp : t.mode === 'proche' ? -((e.x - cx) ** 2 + (e.y - cy) ** 2) : e.d; if (v > bv) { bv = v; tg = e; } }
  const ddx = tg.x - cx, ddy = tg.y - cy, [a, b] = L.portrait ? [ddy, ddx] : [ddx, ddy], l = Math.hypot(a, b) || 1;
  t.lx = a / l; t.ly = b / l;
  Snd.play(TOWERS[t.type].snd || t.type);
  if (t.type === 'foudre') { chain(t, s, tg); return; }
  if (t.type === 'tornade') { G.tors.push({ d: Math.min(P.goal - 0.2, tg.d + 0.8), t: 0, dur: 2.4, spd: 2.0, s, hit: new Set(), rot: 0 }); return; }
  if (t.type === 'geyser') { geyserBlast(s, tg); return; }
  const dist = Math.hypot(ddx, ddy), spd = t.type === 'feu' ? 8 : t.type === 'eau' ? 6 : 7;
  G.projs.push({ kind: t.type, sx: cx, sy: cy, x: cx, y: cy, tg, tx: tg.x, ty: tg.y, tup: tg.flying ? FLY : 0, p: 0,
    dur: LOB[t.type] ? 0.65 : Math.max(0.12, dist / spd), s, rot: 0, up: 0.4 });
}
const LOB = { terre: 1, volcan: 1, marais: 1 };
function sandPulse(t, s, list) {
  const cx = t.c + 0.5, cy = t.r + 0.5;
  for (const e of list) {
    if (e.armor > (e.shred || 0)) { e.shred = Math.min(e.armor, (e.shred || 0) + s.shred); ono('ARMURE −' + s.shred, e.x, e.y, '#e8c784', 0.36, 0.7, (e.flying ? FLY : 0) + 0.8); }
    hurt(e, s.dmg, 'vent', s); if (!e.dead) slowE(e, 0.2, 1.2);
  }
  G.fx.push({ kind: 'ring', gx: cx, gy: cy, r0: 0.2, r1: s.range, t: 0, dur: 0.5, color: '#e8c784' });
  burst(cx, cy, 0.3, 10, ['#e8c784', '#c9a15a', '#fff3d0'], 3, 0.06, 0, 0.6);
  Snd.play('vent'); t.lx = 0; t.ly = 0.6;
}
function storm(t, s, list) {
  const cx = t.c + 0.5, cy = t.r + 0.5;
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
function beamTower(t, dt) {
  const s = t.s, cx = t.c + 0.5, cy = t.r + 0.5, R2 = s.range * s.range;
  const ok = e => e && !e.dead && (s.air || !e.flying) && (e.x - cx) ** 2 + (e.y - cy) ** 2 <= R2;
  if (!ok(t.beam)) {
    t.beam = null; t.beamT = 0; let bv = -Infinity;
    for (const e of G.enemies) { if (!ok(e)) continue; const v = t.mode === 'fort' ? e.hp : t.mode === 'proche' ? -((e.x - cx) ** 2 + (e.y - cy) ** 2) : e.d; if (v > bv) { bv = v; t.beam = e; } }
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
    if (o.d < 1) o.t = o.dur;
    for (const e of G.enemies) {
      if (e.dead || o.hit.has(e.id) || Math.abs(e.d - o.d) > 0.45) continue;
      o.hit.add(e.id);
      hurt(e, o.s.dmg, 'vent', o.s); ignite(e, o.s.burn * brMul(o.s, e), 3);
      if (!e.dead) knock(e, o.s.knock, o.s);
      if (Math.random() < 0.2) ono('FWOOSH!', e.x, e.y, '#ff9a3d', 0.5, 0.35, (e.flying ? FLY : 0) + 0.8);
    }
    if (Math.random() < 0.5) { const [x, y] = pathAt(o.d); burst(x, y, 0.3, 1, ['#ffd23f', '#ff8a3d'], 0.8, 0.06, -2, 0.4); }
  }
  G.tors = G.tors.filter(o => o.t < o.dur);
}
function pulse(t, s, list) {
  t.pulses++; const frz = t.pulses % s.every === 0, cx = t.c + 0.5, cy = t.r + 0.5;
  for (const e of list) {
    hurt(e, s.dmg * (e.flying && s.airBonus ? s.airBonus : 1), 'glace', s); if (e.dead) continue;
    slowE(e, s.slow, 1.6);
    if (frz) e.frozen = Math.max(e.frozen, s.freeze * (ETYPES[e.type].boss && !(s.br === 'boss' && s.rank) ? 0.35 : 1));
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
    for (const e of G.enemies) { if (e.dead || hit.includes(e)) continue; const d2 = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2; if (d2 < bd) { bd = d2; best = e; } }
    if (!best) break; hit.push(best); cur = best;
  }
  const pts = [{ gx: t.c + 0.5, gy: t.r + 0.5, up: 0.5 }];
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
      if (tg) { hurt(tg, s.dmg, 'feu', s); ignite(tg, s.burn * brMul(s, tg), s.burnT); }
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
      splashHit(p.x, p.y, s.splash, false, e => hurt(e, s.dmg, 'feu', s));
      G.zones.push({ gx: p.x, gy: p.y, r: 0.6, t: 0, dur: 3, kind: 'lava', dps: s.lava });
      G.fx.push({ kind: 'ring', gx: p.x, gy: p.y, r0: 0.2, r1: s.splash, t: 0, dur: 0.4, color: '#ff8a3d' });
      burst(p.x, p.y, 0.1, 14, ['#ff4f4f', '#ff8a3d', '#ffd23f'], 3, 0.1, 5, 0.6);
      G.shake = Math.max(G.shake, 0.15);
      if (Math.random() < 0.25) ono('KABOOM!', p.x, p.y, '#ff8a3d', 0.6, 0.4, 0.8);
      break;
    case 'marais':
      splashHit(p.x, p.y, 0.9, false, e => hurt(e, s.dmg, 'terre', s));
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
  if (G.spawnQ.length) {
    G.spawnT -= dt;
    while (G.spawnQ.length && G.spawnT <= 0) { const s = G.spawnQ.shift(); spawn(s.type); G.spawnT += s.gap; }
  } else if (!G.waveActive && G.autoT > 0) { G.autoT -= dt; if (G.autoT <= 0) startWave(); }
  for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt);
  if (G.over) { G.enemies = G.enemies.filter(e => !e.dead); updateFx(dt); return; }
  for (const t of G.towers) updateTower(t, dt);
  updateProjs(dt); updateZones(dt); updateTors(dt); updateEProjs(dt);
  G.enemies = G.enemies.filter(e => !e.dead);
  updateFx(dt);
  if (G.waveActive && !G.spawnQ.length && !G.enemies.length) waveDone();
}

// ================= Rendu =================
function rangeCircle(c, gx, gy, R, ok, T) {
  const [x, y] = toScreen(gx, gy);
  c.beginPath(); c.arc(x, y, R * L.cs, 0, TAU);
  c.fillStyle = ok ? 'rgba(255,255,255,.2)' : 'rgba(255,79,110,.2)'; c.fill();
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
function render(c = ctx, bg = (G && G.bg) || bgCv) {
  const cs = L.cs, T = G.time, lw = Math.max(1.4, cs * 0.045);
  c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  c.drawImage(bg, 0, 0, L.w, L.h);
  let sx = 0, sy = 0;
  if (G.shake > 0 && !RM) { sx = (Math.random() * 2 - 1) * G.shake * 9; sy = (Math.random() * 2 - 1) * G.shake * 9; }
  c.save(); c.translate(sx, sy);
  const [ppx, ppy] = toScreen(P.portal[0], P.portal[1]); drawPortal(c, ppx, ppy, cs, T);
  for (const z of G.zones) {
    const [x, y] = toScreen(z.gx, z.gy), k = z.t / z.dur, lava = z.kind === 'lava', R = z.r * cs * Math.min(1, z.t / 0.15);
    c.save(); c.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    c.beginPath(); c.arc(x, y, R, 0, TAU); c.fillStyle = lava ? '#ff6a2b' : '#7a6a34'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(x - R * 0.2, y - R * 0.15, R * 0.45, 0, TAU); c.fillStyle = lava ? '#ffd23f' : '#9c8a4a'; c.fill();
    for (let i = 0; i < 3; i++) { const bt = (T * 1.3 + i * 0.33) % 1; c.beginPath(); c.arc(x + Math.cos(i * 2.1) * R * 0.5, y + Math.sin(i * 2.1) * R * 0.4, cs * 0.06 * bt + 1, 0, TAU); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke(); }
    c.restore();
  }
  if (G.selTower && !G.drag) { const t = G.selTower; rangeCircle(c, t.c + 0.5, t.r + 0.5, t.s.range, true, T); }
  const ft = G.drag ? G.drag.t : G.selTower;
  if (ft) for (const o of fusionPartners(ft)) {
    const [x, y] = toScreen(o.o.c + 0.5, o.o.r + 0.5), hov = G.drag && G.drag.over === o.o;
    c.beginPath(); c.arc(x, y, cs * (hov ? 0.52 : 0.47), 0, TAU); c.setLineDash(hov ? [] : [cs * 0.12, cs * 0.1]); c.lineDashOffset = T * 20;
    c.lineWidth = hov ? 5 : 3; c.strokeStyle = o.ok ? '#ff6ad5' : 'rgba(255,255,255,.85)'; c.stroke(); c.setLineDash([]);
  }
  if (G.selType && G.terrain) {
    for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
      const Tt = terrainAt(q, r); if (!Tt || Tt.block || towerAt(q, r)) continue;
      const a = affinity(G.selType, Tt); if (!a && !Tt.range) continue;
      const [x, y] = toScreen(q, r), good = a > 0 || (!a && Tt.range);
      const al = (0.14 + Math.min(0.45, Math.abs(a || 0.3)) * 0.9).toFixed(2);
      c.fillStyle = a < 0 ? 'rgba(255,79,110,' + al + ')' : a > 0 ? 'rgba(92,216,106,' + al + ')' : 'rgba(127,211,255,.42)';
      rr(c, x + 3, y + 3, cs - 6, cs - 6, cs * 0.16); c.fill();
      c.font = Math.round(cs * 0.34) + 'px Bangers, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      const mk = a ? (a > 0 ? (a >= 0.3 ? '++' : '+') : (a <= -0.3 ? '−−' : '−')) : '↑'; c.lineWidth = 3; c.strokeStyle = INK; c.strokeText(mk, x + cs * 0.8, y + cs * 0.22); c.fillStyle = good ? '#ffffff' : '#ffd6de'; c.fillText(mk, x + cs * 0.8, y + cs * 0.22);
    }
  }
  const gc = G.selType ? (G.hover || G.ghost) : null;
  let ghostOk = false;
  if (gc && inside(gc.c, gc.r)) {
    ghostOk = canBuild(gc.c, gc.r) && G.gold >= costOf(G.selType);
    const [x, y] = toScreen(gc.c, gc.r);
    rr(c, x + 2, y + 2, cs - 4, cs - 4, cs * 0.18); c.fillStyle = ghostOk ? 'rgba(255,255,255,.35)' : 'rgba(255,79,110,.35)'; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = ghostOk ? '#ffffff' : '#ff4f6e'; c.stroke();
    rangeCircle(c, gc.c + 0.5, gc.r + 0.5, TOWERS[G.selType].range, ghostOk, T);
  }
  G.tpill = null;
  if (gc && inside(gc.c, gc.r)) {
    const Tt = terrainAt(gc.c, gc.r);
    if (Tt) {
      const a = affinity(G.selType, Tt), [x, y] = toScreen(gc.c + 0.5, gc.r + 0.5);
      const txt = Tt.block ? 'Obstacle : impossible de construire' : Tt.name + ' : ' + (a ? fmtAff(a) + ' de puissance' : Tt.range ? '+0,6 de portée' : 'aucun effet') + (a && Tt.range ? ', +0,6 de portée' : '');
      G.tpill = [txt, x, y - cs * 0.55, Tt.block || a < 0 ? '#ffe0e6' : a > 0 || Tt.range ? '#dcf7d6' : '#ffffff'];
    }
  }
  if (G.bad) {
    const [x, y] = toScreen(G.bad.c + 0.5, G.bad.r + 0.5), k = cs * 0.22;
    c.beginPath(); c.moveTo(x - k, y - k); c.lineTo(x + k, y + k); c.moveTo(x + k, y - k); c.lineTo(x - k, y + k);
    c.lineCap = 'round'; c.lineWidth = cs * 0.16; c.strokeStyle = INK; c.stroke(); c.lineWidth = cs * 0.09; c.strokeStyle = '#ff4f6e'; c.stroke();
  }
  const dl = [];
  for (const t of G.towers) { const [x, y] = toScreen(t.c + 0.5, t.r + 0.5); dl.push([y + cs * 0.3, 0, t, x, y]); }
  for (const e of G.enemies) { if (e.flying) continue; const [x, y] = toScreen(e.x, e.y); dl.push([y + cs * 0.2, 1, e, x, y + cs * 0.2]); }
  const [bx, by] = toScreen(P.base[0], P.base[1]); dl.push([by + cs * 0.35, 2, null, bx, by]);
  dl.sort((a, b) => a[0] - b[0]);
  for (const [, k, o, x, y] of dl) {
    if (k === 0) {
      const dg = G.drag && G.drag.t === o; if (dg) { c.save(); c.globalAlpha = 0.35; }
      const ko = o.ko > 0; if (ko) { c.save(); c.globalAlpha *= 0.45; }
      drawTower(c, o.type, x, y, cs, o.lvl, T, o.lx, o.ly, o.recoil, o.blink < 0, o.br);
      if (ko) { c.restore(); for (let i = 0; i < 3; i++) { const a = T * 4 + i * TAU / 3; star(c, x + Math.cos(a) * cs * 0.28, y - cs * 0.45 + Math.sin(a) * cs * 0.08, cs * 0.08, cs * 0.035); fs(c, '#ffd23f', 1.2); } }
      if (o.evil > 0 && !ko) {
        c.save(); c.globalAlpha *= 0.3 + 0.12 * Math.sin(T * 7); c.beginPath(); c.arc(x, y - cs * 0.1, cs * 0.48, 0, TAU); c.fillStyle = '#6a2fb0'; c.fill(); c.restore();
        const hy = y - cs * 0.52; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(x + sg * cs * 0.1, hy + cs * 0.06); c.lineTo(x + sg * cs * 0.2, hy - cs * 0.14); c.lineTo(x + sg * cs * 0.24, hy + cs * 0.06); c.closePath(); fs(c, '#3b2458', 1.5); }
      }
      if (o.stun > 0 && !ko) {
        c.save(); c.strokeStyle = '#e6ff5a'; c.lineWidth = Math.max(1.5, cs * 0.04); c.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const a = rand(TAU), rx = x + Math.cos(a) * cs * 0.3, ry = y - cs * 0.15 + Math.sin(a) * cs * 0.3; c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + rand(-1, 1) * cs * 0.12, ry + rand(-1, 1) * cs * 0.12); c.stroke(); }
        c.font = Math.round(cs * 0.28) + 'px Bangers, Impact, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = INK; c.strokeText('ZZZ', x + cs * 0.28, y - cs * 0.5); c.fillStyle = '#e6ff5a'; c.fillText('ZZZ', x + cs * 0.28, y - cs * 0.5);
        c.restore();
      }
      if (o.shield > 0 && !ko) { c.save(); c.globalAlpha *= 0.35 + 0.1 * Math.sin(T * 4); c.beginPath(); c.arc(x, y - cs * 0.08, cs * 0.46, 0, TAU); c.fillStyle = '#9fdcff'; c.fill(); c.globalAlpha = 0.8; c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.stroke(); c.restore(); }
      if (o.hitT > 0) { c.save(); c.globalAlpha = Math.min(0.6, o.hitT * 3); c.beginPath(); c.arc(x, y - cs * 0.1, cs * 0.4, 0, TAU); c.fillStyle = '#ff4f6e'; c.fill(); c.restore(); }
      if ((o.hp < o.maxHp || ko) && !G.demo) {
        const bw = cs * 0.62, bh = Math.max(4, cs * 0.075), bx0 = x - bw / 2, by0 = y + cs * 0.37, k = clamp(o.hp / o.maxHp, 0, 1);
        rr(c, bx0, by0, bw, bh, bh / 2); c.fillStyle = INK; c.fill();
        if (k > 0) { rr(c, bx0 + 1.5, by0 + 1.5, Math.max(bh - 3, (bw - 3) * k), bh - 3, (bh - 3) / 2); c.fillStyle = k > 0.5 ? '#5cd86a' : k > 0.25 ? '#ffd23f' : '#ff4f6e'; c.fill(); }
      }
      if (o.s.aff) { const up = o.s.aff > 0, mx = x - cs * 0.33, my = y + cs * 0.14, k2 = cs * 0.09; c.beginPath(); if (up) { c.moveTo(mx - k2, my + k2 * 0.6); c.lineTo(mx + k2, my + k2 * 0.6); c.lineTo(mx, my - k2); } else { c.moveTo(mx - k2, my - k2 * 0.6); c.lineTo(mx + k2, my - k2 * 0.6); c.lineTo(mx, my + k2); } c.closePath(); fs(c, up ? '#5cd86a' : '#ff4f6e', 1.5); }
      if (dg) c.restore();
    }
    else if (k === 1) drawEnemy(c, o.type, x, y, cs, T, o);
    else drawBase(c, x, y, cs, T, G.baseHit);
  }
  if (gc && inside(gc.c, gc.r) && !towerAt(gc.c, gc.r)) {
    const [x, y] = toScreen(gc.c + 0.5, gc.r + 0.5);
    c.save(); c.globalAlpha = 0.6; drawTower(c, G.selType, x, y, cs, 1, T, 0, 0.3, 0, false); c.restore();
  }
  for (const o of G.tors) {
    const [gx, gy] = pathAt(o.d), [x, y] = toScreen(gx, gy);
    c.save(); c.globalAlpha = Math.min(1, (o.dur - o.t) / 0.3, o.t / 0.15);
    for (let k = 0; k < 6; k++) {
      const yy = y + cs * 0.2 - k * cs * 0.13, rx = cs * (0.1 + k * 0.055), off = Math.sin(o.rot + k) * cs * 0.05;
      c.beginPath(); c.ellipse(x + off, yy, rx, rx * 0.35, 0, 0, TAU);
      c.lineWidth = cs * 0.09; c.strokeStyle = INK; c.stroke(); c.lineWidth = cs * 0.05; c.strokeStyle = k % 2 ? '#ffb03d' : '#ff5a3d'; c.stroke();
    }
    c.restore();
  }
  for (const e of G.enemies) { if (!e.flying) continue; const [x, y] = toScreen(e.x, e.y); drawEnemy(c, e.type, x, y + cs * 0.2, cs, T, e); }
  for (const t of G.towers) {
    if (t.type !== 'plasma' || !t.beam || t.beam.dead) continue;
    const e = t.beam, [x0, y0] = toScreen(t.c + 0.5, t.r + 0.5), [x1, y1] = toScreen(e.x, e.y);
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
    const k = Math.min(1, p.p), gx = lerp(p.sx, p.t.c + 0.5, k), gy = lerp(p.sy, p.t.r + 0.5, k), [x, y] = toScreen(gx, gy), yy = y - cs * (0.25 + Math.sin(k * Math.PI) * 0.6);
    c.beginPath(); c.arc(x, yy, cs * 0.1, 0, TAU); fs(c, p.evil ? '#4a1f7a' : '#b57bff', Math.max(1.4, cs * 0.04));
    if (p.evil) { c.beginPath(); c.arc(x, yy, cs * 0.045, 0, TAU); c.fillStyle = '#ff6ad5'; c.fill(); }
  }
  // Anneaux et éclairs
  for (const f of G.fx) {
    const k = f.t / f.dur;
    if (f.kind === 'ring') {
      const [x, y] = toScreen(f.gx, f.gy), R = lerp(f.r0, f.r1, 1 - (1 - k) * (1 - k)) * cs;
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
    c.font = px + 'px Bangers, Impact, "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = Math.max(3, px * 0.24); c.strokeStyle = INK; c.strokeText(t.txt, 2, 2); c.strokeText(t.txt, 0, 0);
    c.fillStyle = t.color; c.fillText(t.txt, 0, 0);
    c.restore();
  }
  c.restore();
  if (G.drag) {
    const d = G.drag;
    let gx = d.px, gy = d.py - (d.mouse ? 0 : cs * 0.75), tx = 0, ty = 0;
    if (d.over) {
      [tx, ty] = toScreen(d.over.c + 0.5, d.over.r + 0.5); gx = tx; gy = ty - cs * 0.78 + Math.sin(T * 8) * cs * 0.03;
      c.save(); c.setLineDash([cs * 0.1, cs * 0.08]); c.lineDashOffset = -T * 30; c.lineCap = 'round';
      c.beginPath(); c.moveTo(d.px, d.py); c.lineTo(gx, gy + cs * 0.2); c.lineWidth = 5; c.strokeStyle = INK; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#ff6ad5'; c.stroke();
      c.restore();
    }
    c.save(); c.globalAlpha = d.over ? 0.85 : 0.9; drawTower(c, d.t.type, gx, gy, cs * (d.over ? 0.8 : 1.1), d.t.lvl, T, 0, 0.3, 0.3, false, d.t.br); c.restore();
    if (d.over) {
      const r = fuseCheck(d.t, d.over), Tt = terrainAt(d.over.c, d.over.r), a = r.ok && Tt ? affinity(r.k, Tt) : 0;
      pill(c, r.ok ? '= ' + TOWERS[r.k].name + ' · ' + TOWERS[r.k].fee + ' or' + (a ? ' · ' + Tt.name + ' ' + fmtAff(a) : '') : r.why, tx, ty - cs * 1.3, r.ok);
    }
  }
  if (G.tpill && !G.drag) { const [txt, x, y, bg] = G.tpill; pill(c, txt, x, y, false, bg, INK); }
  if (G.speedLines > 0 && !RM) {
    const a = Math.min(1, G.speedLines), cx = L.w / 2, cy = L.h / 2, R = Math.hypot(L.w, L.h) / 2;
    c.save(); c.globalAlpha = a * 0.75; c.fillStyle = INK;
    for (let i = 0; i < 52; i++) {
      const ang = (i / 52) * TAU + Math.random() * 0.06, w = 0.01 + Math.random() * 0.02, r0 = R * (0.5 + Math.random() * 0.25);
      c.beginPath(); c.moveTo(cx + Math.cos(ang - w) * R * 1.1, cy + Math.sin(ang - w) * R * 1.1); c.lineTo(cx + Math.cos(ang + w) * R * 1.1, cy + Math.sin(ang + w) * R * 1.1); c.lineTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); c.closePath(); c.fill();
    }
    c.restore();
  }
  if (G.hurtT > 0) {
    const g = c.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.3, L.w / 2, L.h / 2, Math.hypot(L.w, L.h) / 2);
    g.addColorStop(0, 'rgba(255,60,90,0)'); g.addColorStop(1, 'rgba(255,60,90,' + (G.hurtT * 0.9) + ')');
    c.fillStyle = g; c.fillRect(0, 0, L.w, L.h);
  }
}

