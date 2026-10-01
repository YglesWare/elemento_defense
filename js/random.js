// Élémento Defense : cartes aléatoires. Une carte est générée pour une partie ; la sauvegarde ne garde que sa graine
// (taille + nombre), ce qui suffit à la recréer à l'identique. Sans partie ni sauvegarde, elle disparaît.
'use strict';

const RSIZES = {
  petite: { name: 'Petite', w: 15, h: 9, np: [1, 2], len: [18, 40], hpMul: 0.95, shards: 1.1, short: '15 × 9 · 1-2 portails', desc: '15 × 9 cases, 1 ou 2 portails, parties rapides' },
  moyenne: { name: 'Moyenne', w: 21, h: 13, np: [1, 3], len: [30, 62], hpMul: 1.15, shards: 1.3, short: '21 × 13 · 1-3 portails', desc: '21 × 13 cases, 1 à 3 portails' },
  grande: { name: 'Grande', w: 24, h: 15, np: [2, 4], len: [42, 85], hpMul: 1.35, shards: 1.5, short: '24 × 15 · 2-4 portails', desc: '24 × 15 cases, 2 à 4 portails, petites cases' },
};
const RTHEMES = MAPS.filter(m => !m.season).map(m => m.id);
// Graines sur 5 caractères en base 36 (faciles à noter)
const newSeed = () => ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) % 60466175 + 1;

function genRandomMap(size, seed) {
  const S = RSIZES[size] || RSIZES.moyenne, W = S.w, H = S.h, rnd = mulberry(seed % 2147483647);
  const ri = n => Math.floor(rnd() * n), pickR = a => a[ri(a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const tid = RTHEMES[ri(RTHEMES.length)], theme = MAPS.find(m => m.id === tid);
  // Nœuds du labyrinthe tous les 3 cases : deux rangées constructibles entre deux chemins parallèles
  const xs = [], ys = [];
  for (let x = 1; x <= W - 2; x += 3) xs.push(x);
  for (let y = 1; y <= H - 2; y += 3) ys.push(y);
  const NX = xs.length, NY = ys.length, N = NX * NY, XY = n => [xs[n % NX], ys[(n / NX) | 0]];
  const nb = n => { const i = n % NX, j = (n / NX) | 0, o = []; if (i > 0) o.push(n - 1); if (i < NX - 1) o.push(n + 1); if (j > 0) o.push(n - NX); if (j < NY - 1) o.push(n + NX); return o; };
  const outs = n => { const i = n % NX, j = (n / NX) | 0, o = []; if (i === 0) o.push([-1, 0]); if (i === NX - 1) o.push([1, 0]); if (j === 0) o.push([0, -1]); if (j === NY - 1) o.push([0, 1]); return o; };
  const border = [...Array(N).keys()].filter(n => outs(n).length);
  const exitPt = (n, [dx, dy]) => { const [x, y] = XY(n); return [dx < 0 ? -1 : dx > 0 ? W : x, dy < 0 ? -1 : dy > 0 ? H : y]; };
  let best = null, bestScore = -Infinity;
  for (let attempt = 0; attempt < 200; attempt++) {
    // Arbre couvrant aléatoire (parcours en profondeur) : chaque portail rejoint la maison par l'unique chemin de l'arbre
    const adj = Array.from({ length: N }, () => []), seen = new Array(N).fill(false), st = [ri(N)]; seen[st[0]] = true;
    let guard = 0;
    while (st.length) {
      if (++guard > N * 8) throw new Error('dfs');
      const n = st[st.length - 1], free = nb(n).filter(k => !seen[k]);
      if (!free.length) { st.pop(); continue; }
      const k = pickR(free); seen[k] = true; adj[n].push(k); adj[k].push(n); st.push(k);
    }
    const pathTo = (a, b) => { const par = new Array(N).fill(-1), q = [b]; par[b] = b; while (q.length) { const n = q.shift(); for (const k of adj[n]) if (par[k] < 0) { par[k] = n; q.push(k); } } const out = [a]; let n = a, g = 0; while (n !== b) { n = par[n]; out.push(n); if (++g > N) throw new Error('pathTo ' + a + '>' + b); } return out; };
    const two = rnd() < 0.35, bases = [ri(N)];
    if (two) { let b = ri(N), g = 0; while (b === bases[0] && g++ < 20) b = ri(N); if (b === bases[0]) continue; bases.push(b); }
    const np = S.np[0] + ri(S.np[1] - S.np[0] + 1), portals = shuffle(border.filter(n => !bases.includes(n))).slice(0, np);
    if (portals.length < np) continue;
    const pairs = [];
    portals.forEach((p, k) => { if (two && np === 1) pairs.push([p, bases[0]], [p, bases[1]]); else pairs.push([p, bases[two ? k % 2 : 0]]); });
    const nodeRoutes = pairs.map(([a, b]) => pathTo(a, b));
    // Un chemin ne doit traverser ni une autre maison ni un autre portail en plein milieu de sa sortie
    if (nodeRoutes.some((r, i) => r.slice(0, -1).some(n => bases.includes(n) && n !== pairs[i][1]))) continue;
    const lens = nodeRoutes.map(r => (r.length - 1) * 3), mid = (S.len[0] + S.len[1]) / 2;
    const okLen = lens.every(l => l >= S.len[0] && l <= S.len[1]);
    const sides = new Set(portals.map(p => outs(p).map(d => d.join()).join('|'))).size;
    const used = new Set(nodeRoutes.flat()).size;
    const score = (okLen ? 1000 : 0) - lens.reduce((s, l) => s + Math.abs(l - mid), 0) / lens.length + sides * 6 - Math.max(0, used / N - 0.8) * 200;
    if (score > bestScore) { bestScore = score; best = { nodeRoutes, pairs, bases }; }
    if (okLen && attempt > 40) break;
  }
  // Conversion en points de passage : sortie du portail par le bord, virages, maison au centre d'un nœud ou sur le bord
  const baseExit = new Map(best.bases.map(b => [b, outs(b).length && rnd() < 0.5 ? pickR(outs(b)) : null]));
  const portalOut = new Map();
  const paths = best.nodeRoutes.map((r, i) => {
    const p = best.pairs[i][0]; if (!portalOut.has(p)) portalOut.set(p, pickR(outs(p)));
    const pts = [exitPt(p, portalOut.get(p)), ...r.map(XY)], ex = baseExit.get(best.pairs[i][1]);
    if (ex) pts.push(exitPt(r[r.length - 1], ex));
    return pts.filter((pt, k) => { if (k === 0 || k === pts.length - 1) return true; const a = pts[k - 1], b = pts[k + 1]; return !((a[0] === pt[0] && pt[0] === b[0]) || (a[1] === pt[1] && pt[1] === b[1])); });
  });
  const sz = RSIZES[size] ? size : 'moyenne';
  const m = {
    id: 'random', random: true, rnd: { size: sz, seed }, cols: W, rows: H, price: 0, hpMul: S.hpMul, shards: S.shards,
    name: 'Carte aléatoire · ' + S.name, blurb: 'Carte unique générée pour cette partie, sur le thème « ' + theme.name + ' ». Elle disparaît quand la partie se termine.',
    ground: theme.ground, ground2: theme.ground2, path: theme.path, pathEdge: theme.pathEdge, frame: theme.frame, dot: theme.dot,
    deco: theme.deco, obstacle: theme.obstacle, wid: theme.id, biome: BIOMES[theme.id], paths,
  };
  // Terrain : des taches des terrains du thème, posées au hasard hors du chemin
  const pal = []; for (const row of theme.terrain) for (const ch of row) if (ch !== '.' && TERRAINS[ch]) pal.push(ch);
  const rows = Array.from({ length: H }, () => new Array(W).fill('.'));
  withGrid(m, () => {
    const cells = buildPath(m).cells, free = (q, r) => q >= 0 && q < W && r >= 0 && r < H && !cells.has(q + ',' + r) && rows[r][q] === '.';
    const blobs = Math.round(W * H / 15);
    for (let b = 0; b < blobs && pal.length; b++) {
      const ch = pickR(pal), want = ch === 'X' ? 1 + ri(2) : 3 + ri(6), q0 = ri(W), r0 = ri(H);
      if (!free(q0, r0)) continue;
      const blob = [[q0, r0]]; rows[r0][q0] = ch;
      for (let g = 0; blob.length < want && g < 40; g++) {
        const [q, r] = pickR(blob), [dq, dr] = pickR([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        if (free(q + dq, r + dr)) { rows[r + dr][q + dq] = ch; blob.push([q + dq, r + dr]); }
      }
    }
    m.terrain = rows.map(r => r.join(''));
    normMap(m, seed % 100000, false);
  });
  return m;
}
// La carte aléatoire occupe toujours la dernière place de MAPS (jamais affichée dans la liste)
const RI = MAPS.push(genRandomMap('moyenne', 1)) - 1;
function makeRandom(size, seed) {
  MAPS[RI] = genRandomMap(size, seed);
  for (const k in terrCache) if (k.startsWith('r')) delete terrCache[k];
  return RI;
}
const loadRandom = rnd => makeRandom(rnd.size, rnd.seed);
// ui.js a déjà affiché l'écran titre : on le rafraîchit pour proposer de reprendre une partie sur carte aléatoire
if (typeof refreshTitle === 'function') refreshTitle();

// ---------- Graines lisibles : lettre de la taille + nombre en base 36 (ex. M-4F7K2) ----------
const SZ_LETTER = { petite: 'P', moyenne: 'M', grande: 'G' };
const seedCode = rnd => SZ_LETTER[rnd.size] + '-' + (rnd.seed >>> 0).toString(36).toUpperCase();
function parseSeed(txt) {
  const m = String(txt || '').trim().toUpperCase().replace(/\s+/g, '').match(/^([PMG])-?([0-9A-Z]{1,7})$/);
  if (!m) return null;
  const seed = parseInt(m[2], 36), size = Object.keys(SZ_LETTER).find(k => SZ_LETTER[k] === m[1]);
  return seed > 0 && seed <= 0xffffffff ? { size, seed } : null;
}

// ---------- Écran de génération ----------
screens.rand = $('#sRand');
const RS = { size: store.get('elemento.rsize') || 'moyenne', ready: false };
function renderRandSizes() {
  $('#rSizes').innerHTML = Object.entries(RSIZES).map(([k, S]) => '<button class="sbtn' + (RS.size === k ? ' on' : '') + '" type="button" data-size="' + k + '" aria-pressed="' + (RS.size === k) + '"><b>' + S.name + '</b><small>' + S.short + '</small></button>').join('');
}
function showRandPreview() {
  const m = MAPS[RI], P2 = withGrid(m, () => buildPath(m)), w = 300, h = Math.round(w * m.rows / m.cols);
  $('#rPrev').hidden = false;
  drawMapMini(prepMini($('#rCv'), w, h), RI, w, h, 'moyen');
  $('#rInfo').textContent = RSIZES[m.rnd.size].name + ' · ' + P2.portals.length + ' portail' + (P2.portals.length > 1 ? 's' : '') + ' · ' + P2.bases.length + ' maison' + (P2.bases.length > 1 ? 's' : '');
  $('#rTheme').textContent = 'Thème ' + MAPS.find(x => x.id === m.wid).name + ' · biome ' + m.biome.name.toLowerCase();
  $('#rSeed').textContent = seedCode(m.rnd);
  $('#rPlay').disabled = false; $('#rErr').hidden = true;
}
function openRand(keep) {
  show('rand'); screens.rand.scrollTop = 0; renderRandSizes();
  if (!keep) RS.ready = false;
  if (RS.ready) showRandPreview(); else { $('#rPrev').hidden = true; $('#rPlay').disabled = true; }
  $('#rErr').hidden = true;
}
function genRand(rnd) {
  makeRandom(rnd.size, rnd.seed); RS.size = rnd.size; RS.ready = true; store.set('elemento.rsize', rnd.size);
  renderRandSizes(); showRandPreview(); Snd.play('build');
}
$('#rSizes').addEventListener('click', ev => { const b = ev.target.closest('[data-size]'); if (!b) return; RS.size = b.dataset.size; store.set('elemento.rsize', RS.size); renderRandSizes(); if (RS.ready) genRand({ size: RS.size, seed: newSeed() }); });
$('#rGen').addEventListener('click', () => genRand({ size: RS.size, seed: newSeed() }));
$('#rLoad').addEventListener('click', () => {
  const r = parseSeed($('#rIn').value);
  if (!r) { $('#rErr').textContent = 'Graine invalide : une lettre (P, M ou G pour la taille), un tiret, puis des chiffres et des lettres. Exemple : M-4F7K2.'; $('#rErr').hidden = false; Snd.play('no'); return; }
  genRand(r); $('#rIn').blur();
});
$('#rIn').addEventListener('keydown', ev => { if (ev.key === 'Enter') $('#rLoad').click(); ev.stopPropagation(); });
$('#rCopy').addEventListener('click', () => {
  const t = $('#rSeed').textContent, b = $('#rCopy');
  const done = ok => { b.textContent = ok ? 'Copiée !' : 'Note-la'; setTimeout(() => { b.textContent = 'Copier'; }, 1500); };
  try { navigator.clipboard.writeText(t).then(() => done(true), () => done(false)); } catch (e) { done(false); }
});
$('#rPlay').addEventListener('click', () => { if (RS.ready) openDiff(RI); });
$('#rBack').addEventListener('click', () => { renderMaps(); show('maps'); });
