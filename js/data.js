// Élémento Defense : Constantes, outils, données du jeu (cartes, tours, ennemis, fusions, terrains, Atelier) et son.
'use strict';
// ================= Constantes & outils =================
const TAU = Math.PI * 2, INK = '#2a1b3d';
const COLS = 14, ROWS = 9, FLY = 0.42, MAXW = 30;
const SAVE = 'elemento.save', BEST = 'elemento.best', OPTS = 'elemento.opts';
const $ = s => document.querySelector(s);
const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const opts = Object.assign({ sound: true, auto: false }, store.get(OPTS) || {});
const META = 'elemento.meta';
const meta = Object.assign({ shards: 0, earned: 0, lv: {} }, store.get(META) || {});
if (!meta.lv) meta.lv = {};
const M = id => meta.lv[id] || 0;
const saveMeta = () => store.set(META, meta);
const fr = n => String(n).replace('.', ',');

// ================= Données =================
const MAPS = [
  { id: 'prairie', name: 'Prairie Mochi', price: 0, hpMul: 1, shards: 1, blurb: 'Lacs, marécages et collines : la carte idéale pour débuter.',
    ground: '#93dd6c', ground2: '#88d563', path: '#f6d99b', pathEdge: '#d9ad63', frame: '#5fb84a', dot: 'rgba(42,27,61,.16)',
    deco: ['fleur', 'buisson', 'herbe', 'herbe', 'champi', 'fleur'], obstacle: 'arbre',
    pts: [[-1, 1], [3, 1], [3, 6], [7, 6], [7, 2], [11, 2], [11, 7], [14, 7]],
    terrain: ['..CC....LLL...', '............X.', '..M..X........', 'LL......M.C...', 'LL..CC...XC...', '......LL......', '........LL..XX', '..MM..........', 'XX....CC..LL..'] },
  { id: 'plage', name: 'Plage Ramune', price: 200, hpMul: 1.1, shards: 1.1, blurb: 'Du sable partout (mauvais pour l’eau et la glace) et la mer tout en bas.',
    ground: '#cfe8a0', ground2: '#c5e194', path: '#cf9660', pathEdge: '#a06a3c', frame: '#4cc3f2', dot: 'rgba(255,255,255,.35)',
    deco: ['coquillage', 'herbe', 'etoile', 'coquillage'], obstacle: 'palmier',
    pts: [[-1, 4], [2, 4], [2, 1], [5, 1], [5, 7], [9, 7], [9, 1], [12, 1], [12, 5], [14, 5]],
    terrain: ['SSSS..CC..SSSS', 'SS......S....S', 'SS.X..SS.....S', 'S...SS....W...', '...S..S..S....', 'SS..C...SS.X..', 'LL...S.......S', 'LLLL...LL...LL', 'LLLLLLLLLLLLLL'] },
  { id: 'marais', name: 'Marais Matcha', price: 350, hpMul: 1.15, shards: 1.2, blurb: 'Boue et étangs : le royaume de l’eau et de la terre, le feu y est mal à l’aise.',
    ground: '#9ccf7e', ground2: '#92c574', path: '#c9b27a', pathEdge: '#8f7a48', frame: '#5f8f4a', dot: 'rgba(42,27,61,.16)',
    deco: ['herbe', 'champi', 'buisson'], obstacle: 'arbre',
    pts: [[-1, 2], [3, 2], [3, 6], [6, 6], [6, 2], [10, 2], [10, 6], [14, 6]],
    terrain: ['MMLL..MMLLM.MM', 'M..M.MM...M.LL', 'LL...M....M.LL', '..M.LL.MM.X.M.', 'MM..LL.LL..MM.', '.M.X..MLL.X..M', 'LLL....MM.....', 'MMLLM..X.MMLLM', 'LLLLMMLLLLMMLL'] },
  { id: 'foret', name: 'Forêt Dango', price: 500, hpMul: 1.2, shards: 1.3, blurb: 'Une forêt dense : peu de places pour construire, mais de belles collines.',
    ground: '#7fcf6a', ground2: '#76c661', path: '#e8c890', pathEdge: '#b8905a', frame: '#3f8a45', dot: 'rgba(42,27,61,.16)',
    deco: ['champi', 'fleur', 'buisson', 'herbe'], obstacle: 'arbre',
    pts: [[-1, 1], [12, 1], [12, 4], [1, 4], [1, 7], [14, 7]],
    terrain: ['XX.XX..XXX.XXX', '.............X', 'X.C..X..M..X.X', 'XX..MM.C..X..X', 'X............X', 'X.X..C..XX.M.X', 'X..XX..M..X..C', '..............', 'XXX..XXX..XXXX'] },
  { id: 'desert', name: 'Désert Dorayaki', price: 700, hpMul: 1.25, shards: 1.4, blurb: 'Dunes brûlantes : le feu, la terre et le vent adorent, l’eau souffre.',
    ground: '#dcb884', ground2: '#d4ae78', path: '#b98a5a', pathEdge: '#8a5f38', frame: '#e0a060', dot: 'rgba(255,255,255,.3)',
    deco: ['roche', 'herbe'], obstacle: 'cactus',
    pts: [[-1, 4], [5, 4], [5, 1], [9, 1], [9, 7], [14, 7]],
    terrain: ['SSSSRRSSSSSSSS', 'SS.SS.....SXSS', 'S.X.S.RR.S..SS', 'SS..SS.LL.S.RS', '......SLL.S..S', 'SRRSS.SSS.WS.S', 'SS.X.SS.S.S.XS', 'SSSS.SSS......', 'SSSSSSXSSSSSSS'] },
  { id: 'ile', name: 'Île Takoyaki', price: 950, hpMul: 1.3, shards: 1.5, blurb: 'Une île entourée d’eau : parfait pour Ondine, terrible pour Braise.',
    ground: '#bfe79a', ground2: '#b5de8e', path: '#d7a86e', pathEdge: '#a0703c', frame: '#3fb6ea', dot: 'rgba(255,255,255,.35)',
    deco: ['coquillage', 'etoile', 'herbe'], obstacle: 'palmier',
    pts: [[-1, 4], [3, 4], [3, 1], [7, 1], [7, 7], [11, 7], [11, 3], [14, 3]],
    terrain: ['LLLLLLLLLLLLLL', 'LLS.......SLLL', 'LS.X.CS..SS.LL', 'LSS..S.S.S....', '....SS..C.S..L', 'LSS.X..SS...SL', 'LLS..S..X.S.LL', 'LLLS.......SLL', 'LLLLLLLLLLLLLL'] },
  { id: 'canyon', name: 'Canyon Taiyaki', price: 1200, hpMul: 1.35, shards: 1.6, blurb: 'Roche et plateaux : la terre et l’éclair y brillent, le chemin serpente.',
    ground: '#d9a27a', ground2: '#cf986f', path: '#f0d3a0', pathEdge: '#b88a58', frame: '#a0583a', dot: 'rgba(255,255,255,.2)',
    deco: ['roche'], obstacle: 'rocher',
    pts: [[-1, 6], [2, 6], [2, 2], [6, 2], [6, 6], [9, 6], [9, 2], [12, 2], [12, 6], [14, 6]],
    terrain: ['RRWWRRXXRRCCRR', 'RX.RR.C.R..XRR', 'RR.........R.R', 'C.X.RC.RX.C..C', 'RR.CR..RR.RR.R', 'X.X.RX.C..RC.X', '...X......R...', 'RRCRRXRRCRRXRR', 'XXRRXXRRXXRRXX'] },
  { id: 'volcan', name: 'Volcan Wasabi', price: 1500, hpMul: 1.4, shards: 1.7, blurb: 'De la lave partout : le feu est roi, l’eau et la glace fondent.',
    ground: '#6e5673', ground2: '#665069', path: '#e3a36f', pathEdge: '#b8744a', frame: '#3b2944', dot: 'rgba(255,120,80,.22)',
    deco: ['roche', 'roche', 'cristal'], obstacle: 'basalte',
    pts: [[-1, 7], [5, 7], [5, 1], [10, 1], [10, 5], [14, 5]],
    terrain: ['VVXX..RR..XXVV', 'VV..R.....R..V', 'X..VV..KK...VV', '..V..R..V..X..', 'RR..X..VV..R..', '..VV...X..R...', 'V...RR..V..XVV', '......L.RR....', 'XXVV..LL..VVXX'] },
  { id: 'pic', name: 'Pic Kakigori', price: 1850, hpMul: 1.5, shards: 1.8, blurb: 'Neige et sapins : la glace domine, le feu grelotte, le chemin est long.',
    ground: '#d9efe3', ground2: '#cfe8da', path: '#cdb9a3', pathEdge: '#9a8470', frame: '#7fb6e6', dot: 'rgba(255,255,255,.35)',
    deco: ['flocon', 'herbe', 'sapinet'], obstacle: 'sapin',
    pts: [[-1, 1], [4, 1], [4, 4], [1, 4], [1, 7], [8, 7], [8, 2], [12, 2], [12, 6], [14, 6]],
    terrain: ['NNXXN..NNXXNNN', '.....N..XX..NN', 'NNCX..NN......', '.X...WW...LX.N', '......L..NN..N', 'N..X..LL..X..X', 'XN.NN..L..CN..', '..........NN.X', 'XXNNXXN..XXNNX'] },
  { id: 'toundra', name: 'Toundra Yuzu', price: 2200, hpMul: 1.6, shards: 1.9, blurb: 'Le chemin le plus court du jeu, au milieu du froid : chaque case compte.',
    ground: '#d4e6ec', ground2: '#cadde4', path: '#b8a58f', pathEdge: '#7f6c58', frame: '#5f8fb8', dot: 'rgba(255,255,255,.35)',
    deco: ['flocon', 'herbe'], obstacle: 'sapin',
    pts: [[-1, 3], [6, 3], [6, 6], [14, 6]],
    terrain: ['NNXXNNLLNNXXNN', 'N.RN..LL.KK.XN', 'XN.NLL..N.R.NN', '.......N.X.RNN', 'NRN.X.....N..X', 'N.LL.N.RXN.LLN', 'XN.NN.........', 'NNX.W.RLL.N.XN', 'XXNNXXNNNNXXNN'] },
];
const DORDER = ['facile', 'moyen', 'difficile', 'infini'];
const DIFFS = {
  facile: { name: 'Facile', waves: 20, hp: 0.8, speed: 1, lives: 30, gold: 260, shards: 0.75, bonus: 1.25, malus: 0.5,
    desc: '20 vagues · ennemis −20 % de PV · 30 vies · moins d’obstacles et plus de collines · bonus de terrain renforcés, malus adoucis' },
  moyen: { name: 'Moyen', waves: 30, hp: 1, speed: 1, lives: 20, gold: 200, shards: 1, bonus: 1, malus: 1,
    desc: '30 vagues · 20 vies · la carte telle quelle' },
  difficile: { name: 'Difficile', waves: 30, hp: 1.35, speed: 1.1, lives: 12, gold: 170, shards: 1.5, bonus: 0.75, malus: 1.5,
    desc: '30 vagues · ennemis +35 % de PV et plus rapides · 12 vies · plus d’obstacles, aucune colline · malus de terrain renforcés' },
  infini: { name: 'Infini', waves: Infinity, hp: 1, speed: 1, lives: 20, gold: 200, shards: 1.25, bonus: 1, malus: 1,
    desc: 'Vagues sans fin, de plus en plus dures · 20 vies · bats ton record' },
};
const BEST2 = 'elemento.best2';
const terrCache = {};
function diffTerrain(mi, diff) {
  const key = mi + '|' + diff; if (terrCache[key]) return terrCache[key];
  const m = MAPS[mi], cells = buildPath(m).cells, rows = m.terrain.map(r => r.split('')), rnd = mulberry(mi * 31 + 7);
  const near = (q, r) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (cells.has((q + a) + ',' + (r + b))) return true; return false; };
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const x = rnd(); if (cells.has(q + ',' + r)) continue;
    const ch = rows[r][q];
    if (diff === 'facile') { if (ch === 'X' && x < 0.6) rows[r][q] = '.'; else if (ch === '.' && near(q, r) && x > 0.88) rows[r][q] = 'C'; }
    else if (diff === 'difficile') { if (ch === 'C') rows[r][q] = '.'; else if (ch === '.' && near(q, r) && x < 0.25) rows[r][q] = 'X'; }
  }
  return (terrCache[key] = rows.map(r => r.join('')));
}
const BIOMES = {
  prairie: { name: 'Tempéré', mods: {} },
  plage: { name: 'Côtier', mods: { eau: 0.1, vent: 0.1, feu: -0.1 } },
  marais: { name: 'Humide', mods: { eau: 0.15, terre: 0.1, feu: -0.15 } },
  foret: { name: 'Forestier', mods: { terre: 0.15, feu: 0.1, vent: -0.15 } },
  desert: { name: 'Aride', mods: { feu: 0.15, vent: 0.1, eau: -0.15, glace: -0.15 } },
  ile: { name: 'Tropical', mods: { eau: 0.15, foudre: 0.1, feu: -0.1 } },
  canyon: { name: 'Rocheux', mods: { terre: 0.15, vent: 0.15, eau: -0.1 } },
  volcan: { name: 'Volcanique', mods: { feu: 0.15, terre: 0.1, eau: -0.1, glace: -0.2 } },
  pic: { name: 'Alpin', mods: { glace: 0.15, vent: 0.1, feu: -0.15 } },
  toundra: { name: 'Polaire', mods: { glace: 0.2, foudre: 0.1, feu: -0.2 } },
};
MAPS.forEach(m => { m.biome = BIOMES[m.id]; });
function biomeText(B) {
  const e = Object.entries(B.mods).sort((a, b) => b[1] - a[1]);
  return e.length ? e.map(([k, v]) => ELNAME[k] + ' ' + fmtAff(v)).join(', ') : 'aucun effet sur les tours';
}
const mapReqOk = i => {
  if (i === 0) return true;
  const rec = (store.get(BEST2) || {})[MAPS[i - 1].id] || {};
  return !!((rec.moyen && rec.moyen.won) || (rec.difficile && rec.difficile.won));
};
const mapOwned = i => !MAPS[i].price || M('map_' + MAPS[i].id) > 0;
function saveMapIndex(sv) {
  if (!sv) return -1;
  const id = sv.mapId || ['prairie', 'plage', 'volcan', 'pic'][sv.map];
  return MAPS.findIndex(m => m.id === id);
}
const TERRAINS = {
  L: { name: 'Eau', color: '#7fd0ff', color2: '#70c6f8', mods: { eau: 0.4, glace: 0.2, foudre: 0.2, feu: -0.4, terre: -0.2 } },
  M: { name: 'Marécage', color: '#a4ad62', color2: '#99a358', mods: { eau: 0.2, terre: 0.2, feu: -0.2, vent: -0.2 } },
  S: { name: 'Sable', color: '#f6dc9c', color2: '#efd18a', mods: { feu: 0.2, terre: 0.2, vent: 0.2, eau: -0.4, glace: -0.4, foudre: -0.4 } },
  R: { name: 'Roche', color: '#ab9db5', color2: '#a092aa', mods: { terre: 0.4, foudre: 0.2, vent: 0.1, eau: -0.2 } },
  V: { name: 'Lave', color: '#e36a3c', color2: '#d85f33', mods: { feu: 0.4, terre: 0.2, eau: -0.5, glace: -0.5 } },
  N: { name: 'Neige', color: '#f7fbff', color2: '#ebf3fb', mods: { glace: 0.4, eau: 0.2, vent: 0.2, feu: -0.4 } },
  W: { name: 'Crête venteuse', color: '#bfe6dc', color2: '#b3ddd2', mods: { vent: 0.4, feu: 0.2, terre: -0.4, eau: -0.2 } },
  K: { name: 'Cristaux', color: '#cdb8f2', color2: '#c2abec', mods: { foudre: 0.4, glace: 0.2, vent: -0.4, feu: -0.2 } },
  C: { name: 'Colline', color: '#b3ea88', color2: '#a8e27c', range: 0.6, mods: {} },
  X: { name: 'Obstacle', block: true },
};
const ELNAME = { feu: 'Feu', eau: 'Eau', terre: 'Terre', vent: 'Vent', foudre: 'Éclair', glace: 'Glace' };
const fmtAff = a => (a > 0 ? '+' : '−') + Math.round(Math.abs(a) * 100) + '\u00a0%';
function affinity(type, T) {
  if (!T || !T.mods) return 0;
  const els = TOWERS[type].parents || [type];
  const a = els.reduce((sum, e) => sum + (T.mods[e] || 0), 0) / els.length;
  return !G ? a : a > 0 ? a * (G.bm || 1) : a * (G.mm || 1);
}

const TORDER = ['feu', 'eau', 'terre', 'vent', 'foudre', 'glace'];
const TOWERS = {
  feu: { name: 'Braise', elem: 'Feu', cost: 60, range: 2.0, rate: 1.4, dmg: 10, air: true, kind: 'mono', color: '#ff7a3d',
    desc: 'Crache des boules de feu qui enflamment la cible.',
    lv: [{ burn: 5, burnT: 2.5 }, { burn: 9, burnT: 2.5 }, { burn: 16, burnT: 3 }] },
  eau: { name: 'Ondine', elem: 'Eau', cost: 50, range: 2.6, rate: 0.9, dmg: 6, air: true, kind: 'zone', color: '#3aa0ff',
    desc: 'Éclaboussure de zone qui ralentit et mouille.',
    lv: [{ slow: 0.3, splash: 0.9 }, { slow: 0.38, splash: 1.0 }, { slow: 0.46, splash: 1.15 }] },
  terre: { name: 'Rocaille', elem: 'Terre', cost: 80, range: 3.5, rate: 0.45, dmg: 34, air: false, kind: 'zone', color: '#c08a58',
    desc: 'Gros rochers de zone. Ne touche pas les volants.',
    lv: [{ splash: 1.0, stun: 0 }, { splash: 1.1, stun: 0.12 }, { splash: 1.25, stun: 0.25 }] },
  vent: { name: 'Zéphyr', elem: 'Vent', cost: 70, range: 3.2, rate: 0.7, dmg: 7, air: true, kind: 'mono', color: '#5fe0bd', airBonus: 2.5,
    desc: 'Rafales qui repoussent. Dégâts ×2,5 sur les volants.',
    lv: [{ knock: 0.6 }, { knock: 0.8 }, { knock: 1.1 }] },
  foudre: { name: 'Voltie', elem: 'Éclair', cost: 100, range: 2.5, rate: 0.8, dmg: 15, air: true, kind: 'chaine', color: '#ffd23f',
    desc: 'Un éclair qui rebondit d’ennemi en ennemi.',
    lv: [{ chain: 3 }, { chain: 4 }, { chain: 6 }] },
  glace: { name: 'Givrette', elem: 'Glace', cost: 90, range: 1.6, rate: 0.6, dmg: 6, air: true, kind: 'onde', color: '#8fdfff',
    desc: 'Onde glacée autour d’elle : ralentit, puis gèle.',
    lv: [{ slow: 0.4, every: 4, freeze: 0.8 }, { slow: 0.48, every: 3, freeze: 1.0 }, { slow: 0.55, every: 2, freeze: 1.2 }] },
};
const LVL = { dmg: [1, 1.7, 2.6, 3.6], range: [0, 0.3, 0.5, 0.7], rate: [1, 1.15, 1.3, 1.45] };
const BRANCHES = ['sol', 'air', 'boss'];
const BRANCH = {
  sol: { name: 'Écrase-sol', short: 'Sol', color: '#8fdc6a', target: 'Contre les ennemis au sol', vs: 'au sol', mul: [1.5, 2.0],
    ranks: ['Dégâts ×1,5 contre les ennemis au sol', 'Dégâts ×2 au sol, et 15 % de chances d’étourdir'] },
  air: { name: 'Chasse-ciel', short: 'Air', color: '#7fd3ff', target: 'Contre les volants', vs: 'en vol', mul: [1.8, 2.6],
    ranks: ['Dégâts ×1,8 contre les volants, +0,3 de portée', 'Dégâts ×2,6 contre les volants, +0,6 de portée'] },
  boss: { name: 'Tueur de Kaiju', short: 'Boss', color: '#ff4f6e', target: 'Contre les boss', vs: 'sur boss', mul: [1.7, 2.5],
    ranks: ['Dégâts ×1,7 contre les Kaiju, ignore 3 d’armure', 'Dégâts ×2,5 contre les Kaiju, ignore toute l’armure'] },
};
function rankText(key, r, type) {
  let x = BRANCH[key].ranks[r - 1];
  if (r === 1 && key === 'air' && !TOWERS[type].air) x += '. Rocaille peut enfin toucher les volants';
  if (r === 1 && key === 'boss' && type === 'glace') x += '. Gèle aussi les Kaiju longtemps';
  if (r === 1 && key === 'boss' && type === 'vent') x += '. Repousse mieux les Kaiju';
  return x;
}
const KIND = { mono: 'Cible unique', zone: 'Zone', chaine: 'Chaîne', onde: 'Onde autour d’elle', chemin: 'Remonte le chemin', flaque: 'Flaque au sol', rayon: 'Rayon continu' };
const rangeLabel = r => r < 1.9 ? 'portée très courte' : r < 2.4 ? 'portée courte' : r < 3 ? 'portée moyenne' : 'portée longue';
const kindLine = type => KIND[TOWERS[type].kind] + ' · ' + rangeLabel(TOWERS[type].range);
const FUSIONS = {
  tornade: { name: 'Tornade de feu', elem: 'Feu + Vent', parents: ['feu', 'vent'], unlock: 25, fee: 100, cost: 170, snd: 'vent',
    range: 3.0, rate: 0.5, dmg: 18, air: true, kind: 'chemin', color: '#ff7a3d', knock: 0.3,
    desc: 'Lâche des tornades enflammées qui remontent le chemin et brûlent tout sur leur passage.',
    lv: [{ burn: 10 }, { burn: 16 }, { burn: 26 }], fx: s => 'Brûlure ' + Math.round(s.burn) + '/s' },
  orage: { name: 'Orage', elem: 'Eau + Éclair', parents: ['eau', 'foudre'], unlock: 30, fee: 130, cost: 200, snd: 'foudre',
    range: 2.8, rate: 1.0, dmg: 14, air: true, kind: 'onde', color: '#8a8fd6',
    desc: 'Un nuage noir qui mouille tout dans son cercle et y fait tomber la foudre, deux fois plus forte sur les mouillés.',
    lv: [{ chain: 4 }, { chain: 5 }, { chain: 7 }], fx: s => s.chain + ' éclairs par seconde' },
  volcan: { name: 'Volcan', elem: 'Feu + Terre', parents: ['feu', 'terre'], unlock: 30, fee: 130, cost: 200, snd: 'terre',
    range: 3.4, rate: 0.4, dmg: 40, air: false, kind: 'zone', color: '#e0553a', splash: 1.1,
    desc: 'Crache des bombes de lave qui explosent en zone et laissent une flaque brûlante sur le chemin.',
    lv: [{ lava: 14 }, { lava: 22 }, { lava: 35 }], fx: s => 'Lave ' + Math.round(s.lava) + '/s' },
  geyser: { name: 'Geyser', elem: 'Eau + Feu', parents: ['eau', 'feu'], unlock: 25, fee: 110, cost: 180, snd: 'eau',
    range: 2.6, rate: 0.6, dmg: 22, air: true, kind: 'zone', color: '#9fe6ff', splash: 0.9,
    desc: 'Fait jaillir de la vapeur sous les ennemis : dégâts de zone, ennemis mouillés et projetés en l’air.',
    lv: [{ stun: 0.6 }, { stun: 0.8 }, { stun: 1.0 }], fx: s => 'Projette ' + fr(s.stun) + ' s' },
  marais: { name: 'Marais', elem: 'Eau + Terre', parents: ['eau', 'terre'], unlock: 25, fee: 100, cost: 170, snd: 'eau',
    range: 2.8, rate: 0.5, dmg: 10, air: false, kind: 'flaque', color: '#9aa35a',
    desc: 'Lance des boules de boue qui laissent une flaque collante : ralentit fort et empoisonne.',
    lv: [{ poison: 8, slow: 0.55 }, { poison: 13, slow: 0.62 }, { poison: 20, slow: 0.7 }], fx: s => 'Boue −' + Math.round(s.slow * 100) + ' %, poison ' + Math.round(s.poison) + '/s' },
  blizzard: { name: 'Blizzard', elem: 'Vent + Glace', parents: ['vent', 'glace'], unlock: 35, fee: 140, cost: 210, snd: 'glace',
    range: 2.6, rate: 0.8, dmg: 10, air: true, kind: 'onde', color: '#bfeeff', airBonus: 2,
    desc: 'Une grande onde de neige : ralentit tout, gèle souvent et frappe fort les volants.',
    lv: [{ slow: 0.5, every: 3, freeze: 1.0 }, { slow: 0.55, every: 2, freeze: 1.1 }, { slow: 0.6, every: 2, freeze: 1.4 }], fx: s => 'Gèle 1 onde / ' + s.every },
  sable: { name: 'Tempête de sable', elem: 'Terre + Vent', parents: ['terre', 'vent'], unlock: 30, fee: 120, cost: 190, snd: 'vent',
    range: 2.4, rate: 1.0, dmg: 8, air: true, kind: 'onde', color: '#e8c784',
    desc: 'Le sable use les armures : chaque onde retire de l’armure aux ennemis, jusqu’à la fin de la partie.',
    lv: [{ shred: 1 }, { shred: 2 }, { shred: 3 }], fx: s => 'Armure −' + s.shred + ' par onde' },
  plasma: { name: 'Plasma', elem: 'Feu + Éclair', parents: ['feu', 'foudre'], unlock: 40, fee: 150, cost: 220, snd: 'plasma',
    range: 2.6, rate: 1, dmg: 20, air: true, kind: 'rayon', color: '#ff6ad5',
    desc: 'Un rayon continu qui chauffe de plus en plus tant qu’il reste sur la même cible. Idéal contre les Kaiju.',
    lv: [{ rampMax: 2 }, { rampMax: 3 }, { rampMax: 4 }], fx: s => 'Jusqu’à ×' + (1 + s.rampMax) + ' en chauffant' },
};
for (const k in FUSIONS) TOWERS[k] = Object.assign({ fusion: true }, FUSIONS[k]);
const fusionUnlocked = k => M('f_' + k) > 0;
function fusionKey(a, b) {
  for (const k in FUSIONS) { const [x, y] = FUSIONS[k].parents; if ((x === a && y === b) || (x === b && y === a)) return k; }
  return null;
}
const MODES = ['premier', 'fort', 'proche'], MODE_LABEL = { premier: 'Cible : 1er', fort: 'Cible : costaud', proche: 'Cible : proche' };

const ETYPES = {
  gloop: { name: 'Gloop', hp: 30, speed: 1.0, reward: 3, size: 0.24, color: '#b57bff', light: '#e2caff', mood: 'happy', desc: 'Le slime de base.' },
  zip: { name: 'Zippy', hp: 16, speed: 2.0, reward: 2, size: 0.18, color: '#ff7eb6', light: '#ffd0e5', mood: 'open', desc: 'Minuscule et très rapide.' },
  flappy: { name: 'Flappy', hp: 24, speed: 1.3, reward: 3, size: 0.2, color: '#7a69e0', light: '#b9adff', mood: 'fang', flying: true, desc: 'Vole : Rocaille ne l’atteint pas.' },
  tonk: { name: 'Tonk', hp: 110, speed: 0.6, reward: 6, size: 0.31, color: '#7fa4c9', light: '#cfe0f2', mood: 'grr', angry: true, armor: 3, lifeCost: 2, desc: 'Casqué : encaisse chaque coup.' },
  magma: { name: 'Magmo', hp: 60, speed: 0.9, reward: 5, size: 0.26, color: '#ff6a3d', light: '#ffc08a', mood: 'grr', angry: true, immune: 'feu', desc: 'Immunisé au feu.' },
  gresil: { name: 'Grésillon', hp: 40, speed: 1.1, reward: 4, size: 0.22, color: '#c6e84a', light: '#eeffa8', mood: 'open', desc: 'Paralyse les tours proches quelques secondes.' },
  crachou: { name: 'Crachou', hp: 70, speed: 0.8, reward: 6, size: 0.27, color: '#ff8a5c', light: '#ffc6a8', mood: 'grr', angry: true, armor: 1, desc: 'Crache sur les tours et leur fait perdre des PV.' },
  malefik: { name: 'Maléfik', hp: 150, speed: 0.7, reward: 12, size: 0.28, color: '#7a4fb8', light: '#c9a8f0', mood: 'grr', angry: true, armor: 2, desc: 'Pervertit une tour : elle attaque les autres tours un moment.' },
  boss: { name: 'Kaiju', hp: 650, speed: 0.42, reward: 45, size: 0.42, color: '#ff4f6e', light: '#ffa3b3', mood: 'grr', angry: true, armor: 5, lifeCost: 10, boss: true, desc: 'Boss des vagues 10, 20, 30. Ses coups de patte abîment les tours.' },
};
const hpMul = w => 1 + (w - 1) * 0.16 + (w - 1) * (w - 1) * 0.011;

function statsOf(type, lvl, br) {
  const D = TOWERS[type], i = lvl - 1, ms = D.parents ? (M('m_' + D.parents[0]) + M('m_' + D.parents[1])) / 2 : M('m_' + type), rank = br ? Math.max(0, lvl - 2) : 0;
  const st = Object.assign({}, D, D.lv[Math.min(i, 2)], { dmg: D.dmg * LVL.dmg[i] * (1 + 0.1 * ms), range: D.range + LVL.range[i] + (ms >= 5 ? 0.3 : 0), rate: D.rate * LVL.rate[i], br: br || null, rank });
  if (br && rank > 0) {
    st.brMul = BRANCH[br].mul[rank - 1];
    if (br === 'air') { st.range += 0.3 * rank; st.air = true; }
    if (br === 'boss') st.pierce = rank >= 2 ? 99 : 3;
  }
  return st;
}
const costOf = type => Math.round(TOWERS[type].cost * (1 - 0.04 * M('cheap')));
function upCost(t) { if (t.lvl >= (TOWERS[t.type].fusion ? 3 : 4)) return 0; return Math.round(TOWERS[t.type].cost * [0.9, 1.6, 2.4][t.lvl - 1] * (1 - 0.04 * M('cheap')) / 5) * 5; }
const sellValue = t => Math.floor(t.inv * (0.7 + 0.05 * M('resell')));

// Améliorations permanentes (Atelier)
const MASTERY = { feu: 'du feu', eau: 'de l’eau', terre: 'de la terre', vent: 'du vent', foudre: 'de l’éclair', glace: 'de la glace' };
const UPGRADES = [
  { id: 'gold', name: 'Trésor de départ', max: 5, base: 8, fx: l => '+' + l * 25 + ' or au départ' },
  { id: 'lives', name: 'Cœur solide', max: 5, base: 10, fx: l => '+' + l * 2 + ' vies au départ' },
  { id: 'loot', name: 'Butin', max: 5, base: 12, fx: l => '+' + l * 6 + ' % d’or par ennemi' },
  { id: 'bonus', name: 'Prime de vague', max: 5, base: 8, fx: l => '+' + l * 20 + ' % de prime de fin de vague' },
  { id: 'cheap', name: 'Rabais', max: 5, base: 15, fx: l => 'Tours et améliorations ' + l * 4 + ' % moins chères' },
  { id: 'resell', name: 'Revente', max: 4, base: 8, fx: l => 'Tours revendues à ' + (70 + l * 5) + ' %' },
  { id: 'remparts', name: 'Remparts', max: 5, base: 10, fx: l => 'Tours +' + l * 20 + ' % de PV' },
  { id: 'bouclier', name: 'Bouclier', max: 3, base: 15, fx: l => 'Chaque tour commence la vague avec un bouclier de ' + l * 15 + ' % de ses PV' },
  { id: 'paratonnerre', name: 'Paratonnerre', max: 3, base: 12, fx: l => 'Paralysie des Grésillons −' + l * 25 + ' %' },
  { id: 'talisman', name: 'Talisman', max: 3, base: 14, fx: l => 'Perversion des Maléfik −' + l * 25 + ' % de durée' },
  { id: 'revive', name: 'Seconde chance', max: 1, base: 60, fx: () => 'Une fois par partie, la maison repart avec 5 vies' },
  ...TORDER.map(t => ({ id: 'm_' + t, tower: t, name: 'Maîtrise ' + MASTERY[t], max: 5, base: 10,
    fx: l => TOWERS[t].name + ' : +' + l * 10 + ' % de dégâts' + (l >= 5 ? ', +0,3 de portée' : '') })),
];
const upPrice = u => u.base * (M(u.id) + 1);
const UNLOCK = { terre: 15, vent: 20, glace: 30, foudre: 40 };
const unlocked = type => !UNLOCK[type] || M('u_' + type) > 0;
function canBuyAnything() {
  for (const t in UNLOCK) if (!unlocked(t) && meta.shards >= UNLOCK[t]) return true;
  for (const k in FUSIONS) if (!fusionUnlocked(k) && FUSIONS[k].parents.every(unlocked) && meta.shards >= FUSIONS[k].unlock) return true;
  return UPGRADES.some(u => M(u.id) < u.max && (!u.tower || unlocked(u.tower)) && meta.shards >= upPrice(u));
}

// ================= Son (synthétisé) =================
const Snd = {
  ac: null, master: null, noise: null, last: {},
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = 0.25; this.master.connect(this.ac.destination);
      const n = Math.floor(this.ac.sampleRate * 0.6), b = this.ac.createBuffer(1, n, this.ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    } catch (e) { this.ac = null; }
  },
  tone(type, f0, f1, dur, vol, delay = 0) {
    const ac = this.ac, t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  hiss(dur, f0, f1, q, vol) {
    const ac = this.ac, t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  },
  play(k) {
    if (!opts.sound || !this.ac || this.ac.state !== 'running') return;
    const now = this.ac.currentTime, gap = k === 'pop' ? 0.045 : 0.07;
    if (this.last[k] && now - this.last[k] < gap) return;
    this.last[k] = now;
    try {
      switch (k) {
        case 'feu': this.hiss(0.18, 1200, 300, 1, 0.5); this.tone('sawtooth', 240, 90, 0.12, 0.08); break;
        case 'eau': this.tone('sine', 780, 240, 0.16, 0.45); break;
        case 'terre': this.tone('sine', 150, 50, 0.28, 0.8); this.hiss(0.2, 400, 120, 0.8, 0.3); break;
        case 'vent': this.hiss(0.3, 400, 2200, 2.5, 0.4); break;
        case 'foudre': this.tone('square', 1400, 180, 0.1, 0.18); this.hiss(0.12, 4000, 2000, 1, 0.3); break;
        case 'glace': this.tone('triangle', 1600, 2600, 0.18, 0.18); this.tone('triangle', 2400, 3400, 0.14, 0.1, 0.05); break;
        case 'pop': this.tone('sine', 380, 950, 0.09, 0.28); break;
        case 'hurt': this.tone('square', 320, 70, 0.32, 0.22); break;
        case 'build': this.tone('triangle', 520, 520, 0.07, 0.3); this.tone('triangle', 780, 780, 0.09, 0.3, 0.07); break;
        case 'up': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.1, 0.25, i * 0.06)); break;
        case 'sell': this.tone('sine', 900, 500, 0.12, 0.3); this.tone('sine', 1200, 700, 0.1, 0.2, 0.06); break;
        case 'wave': [392, 523, 659].forEach((f, i) => this.tone('triangle', f, f * 1.01, 0.16, 0.28, i * 0.09)); break;
        case 'boss': this.tone('sawtooth', 110, 55, 0.9, 0.3); this.tone('sawtooth', 116, 58, 0.9, 0.2); break;
        case 'boom': this.tone('sine', 120, 35, 0.6, 0.9); this.hiss(0.5, 800, 100, 0.7, 0.5); break;
        case 'no': this.tone('square', 170, 120, 0.12, 0.15); break;
        case 'ko': [440, 370, 311, 220].forEach((f, i) => this.tone('square', f, f * 0.97, 0.22, 0.2, i * 0.18)); break;
        case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.2, 0.28, i * 0.1)); break;
        case 'plasma': this.tone('sawtooth', 240, 300, 0.12, 0.07); break;
        case 'evil': this.tone('sawtooth', 180, 80, 0.4, 0.14); this.tone('square', 260, 120, 0.3, 0.07, 0.05); break;
        case 'thit': this.tone('square', 220, 110, 0.09, 0.12); break;
        case 'clear': [659, 784, 988].forEach((f, i) => this.tone('sine', f, f, 0.14, 0.25, i * 0.08)); break;
      }
    } catch (e) {}
  },
};

