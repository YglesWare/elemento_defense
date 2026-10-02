// Élémento Defense : Constantes, outils, données du jeu (cartes, tours, ennemis, fusions, terrains, Atelier) et son.
'use strict';
// ================= Constantes & outils =================
const TAU = Math.PI * 2, INK = '#2a1b3d';
// Numéro de build affiché sur l'écran titre : à augmenter avec CACHE dans sw.js à chaque mise en ligne
const BUILD = 36;
// Taille de la grille : 21 × 13 pour les cartes fixes ; les cartes aléatoires ont leur propre taille (useGrid / withGrid)
let COLS = 21, ROWS = 13;
const FLY = 0.42, MAXW = 30, GRIDV = 21;
function useGrid(m) { COLS = (m && m.cols) || 21; ROWS = (m && m.rows) || 13; }
function withGrid(m, fn) { const c = COLS, r = ROWS; useGrid(m); try { return fn(); } finally { COLS = c; ROWS = r; } }
// Taille d'une case en unités du monde (portées, vitesses) : la grille est 1/3 plus fine que ces distances
const CW = 2 / 3;
const SAVE = 'elemento.save', BEST = 'elemento.best', OPTS = 'elemento.opts';
const $ = s => document.querySelector(s);
const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// store (lecture/écriture des données du joueur) : voir js/storage.js
const opts = Object.assign({ sound: true, music: true, auto: false }, store.get(OPTS) || {});
const META = 'elemento.meta';
const meta = Object.assign({ shards: 0, earned: 0, lv: {} }, store.get(META) || {});
if (!meta.lv) meta.lv = {};
const M = id => meta.lv[id] || 0;
// Améliorations d'un autre profil le temps d'un calcul (coop : chaque tour suit l'Atelier de son propriétaire)
function withLv(lv, fn) { const s = meta.lv; meta.lv = lv || {}; try { return fn(); } finally { meta.lv = s; } }
const Mo = (t, id) => (G && G.coop && t && t.own && t.own !== coopMe() ? (coopLv(t.own)[id] || 0) : M(id));
// Pendant un duel, la progression est temporaire : on n'écrit jamais dans la sauvegarde solo
let duelOn = false;
const saveMeta = () => { if (!duelOn) store.set(META, meta); };
// Stats du joueur (profil) : compteurs cumulés, enregistrés à chaque vague, fin de partie et quand on quitte l'appli
const STATS = 'elemento.stats';
const stats = Object.assign({ games: 0, wins: 0, ko: 0, quits: 0, waves: 0, kills: 0, bosses: 0, towers: 0, time: 0 }, store.get(STATS) || {});
const saveStats = () => store.set(STATS, stats);
addEventListener('pagehide', () => { saveStats(); store.flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { saveStats(); store.flush(); } });
const fr = n => (IS_EN ? String(n) : String(n).replace('.', ','));

// ================= Données =================
const MAPS = [
  { id: 'prairie', name: T('Prairie Mochi'), price: 0, hpMul: 1, shards: 1, blurb: T('Lacs, marécages et collines : la carte idéale pour débuter.'),
    ground: '#93dd6c', ground2: '#88d563', path: '#f6d99b', pathEdge: '#d9ad63', frame: '#5fb84a', dot: 'rgba(42,27,61,.16)',
    deco: ['fleur', 'buisson', 'herbe', 'herbe', 'champi', 'fleur'], obstacle: 'arbre',
    paths: [[[-1, 2], [5, 2], [5, 9], [11, 9], [11, 3], [16, 3], [16, 10], [21, 10]]],
    terrain: ['..CC....LLL...', '............X.', '..M..X........', 'LL......M.C...', 'LL..CC...XC...', '......LL......', '........LL..XX', '..MM..........', 'XX....CC..LL..'] },
  { id: 'plage', name: T('Plage Ramune'), price: 200, hpMul: 1.1, shards: 1.1, blurb: T('Du sable partout (mauvais pour l’eau et la glace) et la mer tout en bas.'),
    ground: '#cfe8a0', ground2: '#c5e194', path: '#cf9660', pathEdge: '#a06a3c', frame: '#4cc3f2', dot: 'rgba(255,255,255,.35)',
    deco: ['coquillage', 'herbe', 'etoile', 'coquillage'], obstacle: 'palmier',
    paths: [[[-1, 2], [7, 2], [7, 6], [13, 6], [13, 2], [18, 2], [18, 9], [21, 9]], [[-1, 10], [7, 10], [7, 6], [13, 6], [13, 2], [18, 2], [18, 9], [21, 9]]],
    terrain: ['SSSS..CC..SSSS', 'SS......S....S', 'SS.X..SS.....S', 'S...SS....W...', '...S..S..S....', 'SS..C...SS.X..', 'LL...S.......S', 'LLLL...LL...LL', 'LLLLLLLLLLLLLL'] },
  { id: 'marais', name: T('Marais Matcha'), price: 350, hpMul: 1.15, shards: 1.2, blurb: T('Boue et étangs : le royaume de l’eau et de la terre, le feu y est mal à l’aise.'),
    ground: '#9ccf7e', ground2: '#92c574', path: '#c9b27a', pathEdge: '#8f7a48', frame: '#5f8f4a', dot: 'rgba(42,27,61,.16)',
    deco: ['herbe', 'champi', 'buisson'], obstacle: 'arbre',
    paths: [[[-1, 6], [4, 6], [4, 3], [9, 3], [9, 6], [13, 6], [13, 3], [18, 3], [18, 6], [21, 6]], [[-1, 6], [4, 6], [4, 9], [9, 9], [9, 6], [13, 6], [13, 9], [18, 9], [18, 6], [21, 6]], [[-1, 6], [4, 6], [4, 3], [9, 3], [9, 6], [13, 6], [13, 9], [18, 9], [18, 6], [21, 6]], [[-1, 6], [4, 6], [4, 9], [9, 9], [9, 6], [13, 6], [13, 3], [18, 3], [18, 6], [21, 6]]],
    terrain: ['MMLL..MMLLM.MM', 'M..M.MM...M.LL', 'LL...M....M.LL', '..M.LL.MM.X.M.', 'MM..LL.LL..MM.', '.M.X..MLL.X..M', 'LLL....MM.....', 'MMLLM..X.MMLLM', 'LLLLMMLLLLMMLL'] },
  { id: 'foret', name: T('Forêt Dango'), price: 500, hpMul: 1.2, shards: 1.3, blurb: T('Une forêt dense : peu de places pour construire, mais de belles collines.'),
    ground: '#7fcf6a', ground2: '#76c661', path: '#e8c890', pathEdge: '#b8905a', frame: '#3f8a45', dot: 'rgba(42,27,61,.16)',
    deco: ['champi', 'fleur', 'buisson', 'herbe'], obstacle: 'arbre',
    paths: [[[-1, 6], [6, 6], [6, 2], [14, 2], [14, 4], [21, 4]], [[-1, 6], [6, 6], [6, 10], [14, 10], [14, 8], [21, 8]]],
    terrain: ['XX.XX..XXX.XXX', '.............X', 'X.C..X..M..X.X', 'XX..MM.C..X..X', 'X............X', 'X.X..C..XX.M.X', 'X..XX..M..X..C', '..............', 'XXX..XXX..XXXX'] },
  { id: 'desert', name: T('Désert Dorayaki'), price: 700, hpMul: 1.25, shards: 1.4, blurb: T('Dunes brûlantes : le feu, la terre et le vent adorent, l’eau souffre.'),
    ground: '#dcb884', ground2: '#d4ae78', path: '#b98a5a', pathEdge: '#8a5f38', frame: '#e0a060', dot: 'rgba(255,255,255,.3)',
    deco: ['roche', 'herbe'], obstacle: 'cactus',
    paths: [[[16, -1], [16, 4], [10, 4], [10, 6], [4, 6], [4, 10], [-1, 10]], [[16, 13], [16, 8], [10, 8], [10, 6], [4, 6], [4, 10], [-1, 10]]],
    terrain: ['SSSSRRSSSSSSSS', 'SS.SS.....SXSS', 'S.X.S.RR.S..SS', 'SS..SS.LL.S.RS', '......SLL.S..S', 'SRRSS.SSS.WS.S', 'SS.X.SS.S.S.XS', 'SSSS.SSS......', 'SSSSSSXSSSSSSS'] },
  { id: 'ile', name: T('Île Takoyaki'), price: 950, hpMul: 1.3, shards: 1.5, blurb: T('Une île entourée d’eau : parfait pour Ondine, terrible pour Braise.'),
    ground: '#bfe79a', ground2: '#b5de8e', path: '#d7a86e', pathEdge: '#a0703c', frame: '#3fb6ea', dot: 'rgba(255,255,255,.35)',
    deco: ['coquillage', 'etoile', 'herbe'], obstacle: 'palmier',
    paths: [[[-1, 1], [8, 1], [8, 3], [2, 3], [2, 6], [10, 6]], [[21, 1], [12, 1], [12, 3], [18, 3], [18, 6], [10, 6]], [[-1, 12], [8, 12], [8, 10], [4, 10], [4, 8], [10, 8], [10, 6]], [[21, 12], [12, 12], [12, 10], [16, 10], [16, 8], [10, 8], [10, 6]]],
    terrain: ['LLLLLLLLLLLLLL', 'LLS.......SLLL', 'LS.X.CS..SS.LL', 'LSS..S.S.S....', '....SS..C.S..L', 'LSS.X..SS...SL', 'LLS..S..X.S.LL', 'LLLS.......SLL', 'LLLLLLLLLLLLLL'] },
  { id: 'canyon', name: T('Canyon Taiyaki'), price: 1200, hpMul: 1.35, shards: 1.6, blurb: T('Roche et plateaux : la terre et l’éclair y brillent, le chemin serpente.'),
    ground: '#d9a27a', ground2: '#cf986f', path: '#f0d3a0', pathEdge: '#b88a58', frame: '#a0583a', dot: 'rgba(255,255,255,.2)',
    deco: ['roche'], obstacle: 'rocher',
    paths: [[[2, -1], [2, 10], [6, 10], [6, 2], [10, 2], [10, 10], [14, 10], [14, 2], [18, 2], [18, 13]]],
    terrain: ['RRWWRRXXRRCCRR', 'RX.RR.C.R..XRR', 'RR.........R.R', 'C.X.RC.RX.C..C', 'RR.CR..RR.RR.R', 'X.X.RX.C..RC.X', '...X......R...', 'RRCRRXRRCRRXRR', 'XXRRXXRRXXRRXX'] },
  { id: 'volcan', name: T('Volcan Wasabi'), price: 1500, hpMul: 1.4, shards: 1.7, blurb: T('De la lave partout : le feu est roi, l’eau et la glace fondent.'),
    ground: '#6e5673', ground2: '#665069', path: '#e3a36f', pathEdge: '#b8744a', frame: '#3b2944', dot: 'rgba(255,120,80,.22)',
    deco: ['roche', 'roche', 'cristal'], obstacle: 'basalte',
    paths: [[[-1, 1], [19, 1], [19, 11], [2, 11], [2, 4], [16, 4], [16, 8], [6, 8], [6, 6], [11, 6]]],
    terrain: ['VVXX..RR..XXVV', 'VV..R.....R..V', 'X..VV..KK...VV', '..V..R..V..X..', 'RR..X..VV..R..', '..VV...X..R...', 'V...RR..V..XVV', '......L.RR....', 'XXVV..LL..VVXX'] },
  { id: 'pic', name: T('Pic Kakigori'), price: 1850, hpMul: 1.5, shards: 1.8, blurb: T('Neige et sapins : la glace domine, le feu grelotte, le chemin est long.'),
    ground: '#d9efe3', ground2: '#cfe8da', path: '#cdb9a3', pathEdge: '#9a8470', frame: '#7fb6e6', dot: 'rgba(255,255,255,.35)',
    deco: ['flocon', 'herbe', 'sapinet'], obstacle: 'sapin',
    paths: [[[-1, 2], [16, 2], [16, 6], [12, 6], [12, 13]], [[4, -1], [4, 10], [21, 10]]],
    terrain: ['NNXXN..NNXXNNN', '.....N..XX..NN', 'NNCX..NN......', '.X...WW...LX.N', '......L..NN..N', 'N..X..LL..X..X', 'XN.NN..L..CN..', '..........NN.X', 'XXNNXXN..XXNNX'] },
  { id: 'toundra', name: T('Toundra Yuzu'), price: 2200, hpMul: 1.6, shards: 1.9, blurb: T('Le chemin le plus court du jeu, au milieu du froid : chaque case compte.'),
    ground: '#d4e6ec', ground2: '#cadde4', path: '#b8a58f', pathEdge: '#7f6c58', frame: '#5f8fb8', dot: 'rgba(255,255,255,.35)',
    deco: ['flocon', 'herbe'], obstacle: 'sapin',
    paths: [[[-1, 3], [8, 3], [8, 6], [21, 6]], [[12, -1], [12, 6], [21, 6]], [[4, 13], [4, 9], [16, 9], [16, 6], [21, 6]]],
    terrain: ['NNXXNNLLNNXXNN', 'N.RN..LL.KK.XN', 'XN.NLL..N.R.NN', '.......N.X.RNN', 'NRN.X.....N..X', 'N.LL.N.RXN.LLN', 'XN.NN.........', 'NNX.W.RLL.N.XN', 'XXNNXXNNNNXXNN'] },
  // Cartes d'événement : gratuites, jouables seulement pendant leur saison (toujours en fin de liste)
  { id: 'halloween', name: T('Manoir Citrouille'), price: 0, hpMul: 1.25, shards: 1.5, season: 'halloween', blurb: T('Événement Halloween : citrouilles, brume hantée et potions. Fantômes, chats noirs, spectres et le Roi Citrouille rôdent, et tes tours se déguisent !'),
    ground: '#6f5d91', ground2: '#68568a', path: '#d4b089', pathEdge: '#8f6a4c', frame: '#2b1f40', dot: 'rgba(255,170,60,.2)',
    deco: ['citrouille', 'bougie', 'champinuit', 'os', 'citrouille'], obstacle: 'tombe',
    best: { feu: 'P', terre: 'P', foudre: 'H', vent: 'H', eau: 'B', glace: 'B' },
    paths: [[[-1, 2], [14, 2], [14, 10], [21, 10]], [[-1, 10], [6, 10], [6, 6], [18, 6], [18, 10], [21, 10]]],
    terrain: ['XXPPP.HHH..XXX', 'XP.....P.HH..X', 'PP..BB.PP.....', '...BBB..X.HH.X', '....X..PP.HH..', 'HH.C..B......X', 'HHX..BB..CPP..', 'X.......X..PPX', 'XXBBXX.HHXXPPX'] },
  { id: 'noel', name: T('Village Sucre d’Orge'), price: 0, hpMul: 1.3, shards: 1.5, season: 'noel', blurb: T('Événement Noël : lac gelé, pain d’épices et guirlandes. Bonshommes de neige, lutins, cadeaux surprises et le Yéti débarquent, et tes tours mettent leur bonnet !'),
    ground: '#e4eef6', ground2: '#dae6f0', path: '#d9b98f', pathEdge: '#9a7652', frame: '#1f4a3a', dot: 'rgba(255,255,255,.4)',
    deco: ['sucredorge', 'boule', 'bonhomme', 'flocon', 'cadeaumini'], obstacle: 'sapinnoel',
    best: { feu: 'G', terre: 'G', glace: 'J', eau: 'J', foudre: 'E', vent: 'E' },
    paths: [[[10, -1], [10, 3], [3, 3], [3, 8], [7, 8], [7, 13]], [[10, -1], [10, 3], [17, 3], [17, 8], [13, 8], [13, 13]]],
    terrain: ['XXJJJ....GG.XX', 'X....EE..GG..X', 'JJ...EE.....JJ', 'J..GG..X.....J', '..GGG...C..EE.', 'EE..X.JJ...EE.', 'EE...JJJ.GG...', 'X..C......GGXX', 'XXEEXXJJXXGGXX'] },
  { id: 'paques', name: T('Jardin Chocolat'), price: 0, hpMul: 1.2, shards: 1.5, season: 'paques', blurb: T('Événement Pâques : fontaines de chocolat, ruisseaux pastel et prés fleuris. Poussins, abeilles, lapins sauteurs et le Lapin en chocolat géant envahissent le jardin !'),
    ground: '#a6e27f', ground2: '#9dda76', path: '#f7e3b5', pathEdge: '#d4b077', frame: '#f2a7cf', dot: 'rgba(255,255,255,.4)',
    deco: ['tulipe', 'oeufmini', 'carotte', 'fleur', 'tulipe'], obstacle: 'oeufgeant',
    best: { feu: 'O', terre: 'O', eau: 'Y', glace: 'Y', vent: 'Z', foudre: 'Z' },
    paths: [[[-1, 2], [17, 2], [17, 10], [-1, 10]], [[8, -1], [8, 6], [13, 6], [13, 10], [-1, 10]]],
    terrain: ['ZZOO..YYY..XXZ', 'Z..OO.YY.....X', 'YY.......ZZ..Z', 'YY..ZZ.....OO.', '...ZZZ..X..OO.', 'X..C....OO...Y', '....YY.......Y', 'ZZ..YY..XC..ZZ', 'XXOOXXZZXXYYXX'] },
  { id: 'valentin', name: T('Vallée Guimauve'), price: 0, hpMul: 1.2, shards: 1.5, season: 'valentin', blurb: T('Événement Saint-Valentin : roseraies, fontaines des vœux et nuages de barbe à papa. Guimauves, Cupidons, Câlinous et la Reine des Cœurs arrivent, et tes tours sont amoureuses !'),
    ground: '#f7cfe0', ground2: '#f2c6d9', path: '#fff1e2', pathEdge: '#dda0b8', frame: '#b93d72', dot: 'rgba(255,255,255,.4)',
    deco: ['coeurmini', 'rose', 'fleur', 'coeurmini', 'rose'], obstacle: 'coeurbuisson',
    best: { feu: 'A', terre: 'A', eau: 'I', glace: 'I', vent: 'Q', foudre: 'Q' },
    paths: [[[10, -1], [10, 4], [7, 4], [7, 1], [2, 1], [2, 7], [6, 7], [6, 10], [10, 10], [10, 13]], [[10, -1], [10, 4], [13, 4], [13, 1], [18, 1], [18, 7], [14, 7], [14, 10], [10, 10], [10, 13]]],
    terrain: ['AAII..QQQ..XXA', 'A..II.......XA', 'II.....QQ....A', 'I..AA.....QQ..', '...AAA.....QQ.', 'X..C.QQ.......', '....II.....AAA', 'QQ..II..XC..AA', 'XXAAXXQQXXIIXX'] },
  { id: 'nouvelan', name: T('Quartier Dim Sum'), price: 0, hpMul: 1.25, shards: 1.5, season: 'nouvelan', blurb: T('Événement Nouvel An chinois : lanternes, jardins de thé et pics de jade. Raviolis, lions dansants, enveloppes rouges pleines d’or et le Dragon défilent dans les rues !'),
    ground: '#ecd3a0', ground2: '#e6cb96', path: '#f8e6bf', pathEdge: '#b8864a', frame: '#a31e2e', dot: 'rgba(255,210,63,.3)',
    deco: ['lanternemini', 'petard', 'bambou', 'mandarine', 'lanternemini'], obstacle: 'pagode',
    best: { feu: 'D', foudre: 'D', terre: 'T', eau: 'T', vent: 'U', glace: 'U' },
    paths: [[[21, 2], [2, 2], [2, 6], [18, 6], [18, 10], [-1, 10]], [[10, -1], [10, 2], [2, 2], [2, 6], [18, 6], [18, 10], [-1, 10]]],
    terrain: ['DDTT..UUU..XXD', 'D..TT.UU.....X', 'UU.......DD..D', 'UU..DD.....TT.', '...DDD..X..TT.', 'X..C....TT...U', '....UU.......U', 'TT..UU..XC..TT', 'XXDDXXTTXXUUXX'] },
];
const DORDER = ['facile', 'moyen', 'difficile', 'infini'];
const DIFFS = {
  facile: { name: T('Facile'), waves: 20, hp: 0.8, speed: 1, lives: 30, gold: 260, shards: 0.75, bonus: 1.25, malus: 0.5,
    desc: T('20 vagues · ennemis −20 % de PV · 30 vies · moins d’obstacles et plus de collines · bonus de terrain renforcés, malus adoucis') },
  moyen: { name: T('Moyen'), waves: 30, hp: 1, speed: 1, lives: 20, gold: 200, shards: 1, bonus: 1, malus: 1, timer: 30,
    desc: T('30 vagues · 20 vies · la carte telle quelle · vague suivante automatique 30 s après la sortie du dernier ennemi') },
  difficile: { name: T('Difficile'), waves: 30, hp: 1.35, speed: 1.1, lives: 12, gold: 170, shards: 1.5, bonus: 0.75, malus: 1.5, timer: 15,
    desc: T('30 vagues · ennemis +35 % de PV et plus rapides · 12 vies · plus d’obstacles, aucune colline · malus de terrain renforcés · vague suivante automatique après 15 s') },
  infini: { name: T('Infini'), waves: Infinity, hp: 1, speed: 1, lives: 20, gold: 200, shards: 1.25, bonus: 1, malus: 1, timer: w => w < 10 ? null : Math.max(15, 30 - Math.floor((w - 10) / 5)),
    desc: T('Vagues sans fin, de plus en plus dures · 20 vies · vagues 1 à 10 sans chrono, puis vague suivante automatique après 30 s, un délai qui raccourcit jusqu’à 15 s · bats ton record') },
};
const BEST2 = 'elemento.best2';
// Clé des records d'une carte (les cartes d'événement ont des records par édition annuelle)
const recId = m => m.rid || m.id;
const terrCache = {};
function diffTerrain(mi, diff) {
  const m = MAPS[mi], key = (m.rnd ? 'r' + m.rnd.seed : mi) + '|' + diff; if (terrCache[key]) return terrCache[key];
  return withGrid(m, () => diffTerrain2(m, mi, key, diff));
}
function diffTerrain2(m, mi, key, diff) {
  const cells = buildPath(m).cells, rows = m.terrain.map(r => r.split('')), rnd = mulberry(mi * 31 + 7);
  const near = (q, r) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (cells.has((q + a) + ',' + (r + b))) return true; return false; };
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    const x = rnd(); if (cells.has(q + ',' + r)) continue;
    const ch = rows[r][q];
    if (diff === 'facile') { if (ch === 'X' && x < 0.6) rows[r][q] = '.'; else if (ch === '.' && near(q, r) && x > 0.88) rows[r][q] = 'C'; }
    else if (diff === 'difficile') { if (ch === 'C') rows[r][q] = '.'; else if (ch === '.' && near(q, r) && x < 0.25) rows[r][q] = 'X'; }
  }
  return (terrCache[key] = rows.map(r => r.join('')));
}
// Météos : elles changent toutes les 5 vagues (les 5 premières sont toujours par beau temps)
const WEATHERS = {
  clear: { name: T('Beau temps'), icon: '☀', mods: {}, desc: 'aucun effet' },
  rain: { name: T('Pluie'), icon: '🌧', mods: { eau: 0.2, foudre: 0.1, feu: -0.15 }, desc: T('Ondine +20 %, Voltie +10 %, Braise −15 %, ennemis mouillés') },
  heat: { name: T('Canicule'), icon: '🔥', mods: { feu: 0.2, glace: -0.2 }, desc: T('Braise +20 %, Givrette −20 %') },
  storm: { name: T('Tempête'), icon: '🌪', mods: { vent: 0.25 }, desc: T('Zéphyr +25 %, volants plus rapides') },
  blizzard: { name: 'Blizzard', icon: '❄', mods: { glace: 0.2, feu: -0.15 }, desc: T('Givrette +20 %, Braise −15 %, ennemis ralentis') },
  thunder: { name: T('Orage'), icon: '⛈', mods: { foudre: 0.25 }, desc: T('Voltie +25 %, des éclairs frappent les ennemis') },
  fog: { name: T('Brouillard'), icon: '🌫', mods: {}, range: -0.4, desc: T('portée de toutes les tours −0,4') },
  aurora: { name: T('Aurore boréale'), icon: '🌌', mods: { foudre: 0.15, vent: 0.15, glace: 0.1 }, desc: T('Voltie +15 %, Zéphyr +15 %, Givrette +10 %') },
  shower: { name: T('Giboulées'), icon: '🌦', mods: { eau: 0.2, vent: 0.1, feu: -0.1 }, desc: T('Ondine +20 %, Zéphyr +10 %, Braise −10 %, ennemis mouillés') },
  rainbow: { name: T('Arc-en-ciel'), icon: '🌈', mods: { feu: 0.1, eau: 0.1, terre: 0.1, vent: 0.1, foudre: 0.1, glace: 0.1 }, desc: T('toutes les tours +10 %') },
  petals: { name: T('Pluie de pétales'), icon: '🌸', mods: { vent: 0.15, feu: 0.1 }, desc: T('Zéphyr +15 %, Braise +10 %') },
  fireworks: { name: T('Feux d’artifice'), icon: '🎆', mods: { feu: 0.15, foudre: 0.15, eau: -0.1 }, desc: T('Braise +15 %, Voltie +15 %, Ondine −10 %, des fusées frappent les ennemis') },
  moon: { name: T('Pleine lune'), icon: '🌕', mods: { foudre: 0.15, glace: 0.15 }, desc: T('Voltie +15 %, Givrette +15 %, les spectres restent intangibles moins longtemps') },
};
const WEATHER_POOL = {
  prairie: ['clear', 'rain', 'fog', 'thunder'], plage: ['clear', 'rain', 'storm', 'heat'], marais: ['rain', 'fog', 'thunder', 'clear'],
  foret: ['clear', 'rain', 'fog', 'storm'], desert: ['heat', 'heat', 'storm', 'clear'], ile: ['rain', 'thunder', 'storm', 'clear'],
  canyon: ['storm', 'heat', 'fog', 'clear'], volcan: ['heat', 'thunder', 'fog', 'clear'], pic: ['blizzard', 'blizzard', 'fog', 'storm', 'clear'],
  toundra: ['blizzard', 'blizzard', 'fog', 'storm'],
  halloween: ['moon', 'fog', 'thunder', 'moon', 'rain'],
  noel: ['blizzard', 'aurora', 'fog', 'aurora', 'clear'],
  paques: ['rainbow', 'shower', 'clear', 'shower', 'storm'],
  valentin: ['petals', 'clear', 'rainbow', 'petals', 'fog'],
  nouvelan: ['fireworks', 'clear', 'fog', 'fireworks', 'rain'],
};
const BIOMES = {
  prairie: { name: T('Tempéré'), mods: {} },
  plage: { name: T('Côtier'), mods: { eau: 0.1, vent: 0.1, feu: -0.1 } },
  marais: { name: T('Humide'), mods: { eau: 0.15, terre: 0.1, feu: -0.15 } },
  foret: { name: T('Forestier'), mods: { terre: 0.15, feu: 0.1, vent: -0.15 } },
  desert: { name: T('Aride'), mods: { feu: 0.15, vent: 0.1, eau: -0.15, glace: -0.15 } },
  ile: { name: 'Tropical', mods: { eau: 0.15, foudre: 0.1, feu: -0.1 } },
  canyon: { name: T('Rocheux'), mods: { terre: 0.15, vent: 0.15, eau: -0.1 } },
  volcan: { name: T('Volcanique'), mods: { feu: 0.15, terre: 0.1, eau: -0.1, glace: -0.2 } },
  pic: { name: T('Alpin'), mods: { glace: 0.15, vent: 0.1, feu: -0.15 } },
  toundra: { name: T('Polaire'), mods: { glace: 0.2, foudre: 0.1, feu: -0.2 } },
  halloween: { name: T('Hanté'), mods: { feu: 0.1, foudre: 0.1, eau: -0.1 } },
  noel: { name: T('Festif'), mods: { glace: 0.15, foudre: 0.1, feu: -0.1 } },
  paques: { name: T('Printanier'), mods: { vent: 0.1, eau: 0.1, glace: -0.1 } },
  valentin: { name: T('Romantique'), mods: { feu: 0.1, vent: 0.1, glace: -0.1 } },
  nouvelan: { name: T('Impérial'), mods: { feu: 0.15, foudre: 0.1, glace: -0.1 } },
};
MAPS.forEach(m => { m.biome = BIOMES[m.id]; });
function biomeText(B) {
  const e = Object.entries(B.mods).sort((a, b) => b[1] - a[1]);
  return e.length ? e.map(([k, v]) => ELNAME[k] + ' ' + fmtAff(v)).join(', ') : T('aucun effet sur les tours');
}
// Événements saisonniers (?halloween, ?noel ou ?paques dans l'adresse pour les essayer hors saison)
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114; return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
}
const DAY = 864e5, frDate = d => IS_EN ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }).replace(/^1 /, '1er ');
const SEASONS = {
  halloween: { name: 'Halloween', icon: '🎃', on: d => d.getMonth() === 9 || (d.getMonth() === 10 && d.getDate() <= 10), until: () => T('jusqu’au 10 novembre'), back: T('Revient en octobre') },
  noel: { name: T('Noël'), icon: '🎄', on: d => d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 6), until: () => T('jusqu’au 6 janvier'), back: T('Revient en décembre') },
  paques: { name: T('Pâques'), icon: '🐣', on: d => Math.abs(d - easter(d.getFullYear())) <= 14 * DAY,
    until: () => T('jusqu’au ') + frDate(new Date(+easter(new Date().getFullYear()) + 14 * DAY)), back: T('Revient pour Pâques') },
  valentin: { name: T('Saint-Valentin'), icon: '💘', on: d => d.getMonth() === 1 && d.getDate() <= 20, until: () => T('jusqu’au 20 février'), back: T('Revient en février') },
  nouvelan: { name: T('Nouvel An chinois'), icon: '🏮', on: d => { const n = lunarNY(d.getFullYear()); return d >= n - 7 * DAY && d <= +n + 15 * DAY; },
    until: () => T('jusqu’au ') + frDate(new Date(+lunarNY(new Date().getFullYear()) + 15 * DAY)), back: T('Revient pour le Nouvel An chinois') },
};
// Date de début de chaque événement pour une année donnée, et prochain début à venir
const SEASON_START = {
  halloween: y => new Date(y, 9, 1), noel: y => new Date(y, 11, 1), valentin: y => new Date(y, 1, 1),
  paques: y => new Date(+easter(y) - 14 * DAY), nouvelan: y => new Date(+lunarNY(y) - 7 * DAY),
};
function nextSeasonStart(k, now = new Date()) { const y = now.getFullYear(); const a = SEASON_START[k](y); return a > now ? a : SEASON_START[k](y + 1); }
// Nouvel An chinois : la date suit le calendrier lunaire (fin janvier ou février selon les années)
const LUNAR = { 2025: '01-29', 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08', 2036: '01-28', 2037: '02-15', 2038: '02-04', 2039: '01-24', 2040: '02-12' };
function lunarNY(y) { const [m, d] = (LUNAR[y] || '02-05').split('-').map(Number); return new Date(y, m - 1, d); }
// TEMPORAIRE : mode test, toutes les cartes et tous les événements sont débloqués (repasser à false pour revenir à la normale)
const TEST_ALL = false;
function inSeason(m) {
  if (!m || !m.season || TEST_ALL) return true;
  return SEASONS[m.season].on(new Date()) || new RegExp('[?&]' + m.season + '\\b').test(location.search);
}
// Événement de la partie en cours (null sur les cartes normales)
const evt = () => (G && !G.demo && MAPS[G.map] && MAPS[G.map].season) || null;
const spooky = () => evt() === 'halloween';
const mapReqOk = i => {
  if (i === 0 || TEST_ALL) return true;
  if (MAPS[i].season) return inSeason(MAPS[i]);
  const rec = (store.get(BEST2) || {})[MAPS[i - 1].id] || {};
  return !!((rec.moyen && rec.moyen.won) || (rec.difficile && rec.difficile.won));
};
const mapOwned = i => TEST_ALL || !MAPS[i].price || M('map_' + MAPS[i].id) > 0;
function saveMapIndex(sv) {
  if (!sv || sv.grid !== GRIDV) return -1; // sauvegarde faite sur l'ancienne grille : plus utilisable
  if (sv.mapId === 'random') return sv.rnd && typeof loadRandom === 'function' ? loadRandom(sv.rnd) : -1;
  const id = sv.mapId || ['prairie', 'plage', 'volcan', 'pic'][sv.map];
  return MAPS.findIndex(m => m.id === id);
}
const TERRAINS = {
  L: { name: T('Eau'), color: '#7fd0ff', color2: '#70c6f8', mods: { eau: 0.4, glace: 0.2, foudre: 0.2, feu: -0.4, terre: -0.2 } },
  M: { name: T('Marécage'), color: '#a4ad62', color2: '#99a358', mods: { eau: 0.2, terre: 0.2, feu: -0.2, vent: -0.2 } },
  S: { name: T('Sable'), color: '#f6dc9c', color2: '#efd18a', mods: { feu: 0.2, terre: 0.2, vent: 0.2, eau: -0.4, glace: -0.4, foudre: -0.4 } },
  R: { name: T('Roche'), color: '#ab9db5', color2: '#a092aa', mods: { terre: 0.4, foudre: 0.2, vent: 0.1, eau: -0.2 } },
  V: { name: T('Lave'), color: '#e36a3c', color2: '#d85f33', mods: { feu: 0.4, terre: 0.2, eau: -0.5, glace: -0.5 } },
  N: { name: T('Neige'), color: '#f7fbff', color2: '#ebf3fb', mods: { glace: 0.4, eau: 0.2, vent: 0.2, feu: -0.4 } },
  W: { name: T('Crête venteuse'), color: '#bfe6dc', color2: '#b3ddd2', mods: { vent: 0.4, feu: 0.2, terre: -0.4, eau: -0.2 } },
  K: { name: T('Cristaux'), color: '#cdb8f2', color2: '#c2abec', mods: { foudre: 0.4, glace: 0.2, vent: -0.4, feu: -0.2 } },
  P: { name: T('Champ de citrouilles'), color: '#c07a3e', color2: '#b8733a', season: 'halloween', mods: { feu: 0.3, terre: 0.15, glace: -0.2 } },
  H: { name: T('Brume hantée'), color: '#b4a6e2', color2: '#ab9cdc', season: 'halloween', mods: { foudre: 0.3, vent: 0.15, feu: -0.2 } },
  B: { name: T('Potion bouillonnante'), color: '#86de6e', color2: '#7dd665', season: 'halloween', mods: { eau: 0.3, glace: 0.15, feu: -0.25 } },
  G: { name: T('Pain d’épices'), color: '#c9874a', color2: '#c07f43', season: 'noel', mods: { feu: 0.3, terre: 0.15, glace: -0.2 } },
  J: { name: T('Lac gelé'), color: '#a9dcf5', color2: '#a0d4ef', season: 'noel', mods: { glace: 0.3, eau: 0.15, feu: -0.25 } },
  E: { name: T('Guirlandes'), color: '#3f8a5a', color2: '#398253', season: 'noel', mods: { foudre: 0.3, vent: 0.15, eau: -0.2 } },
  O: { name: T('Fontaine de chocolat'), color: '#8a5a3c', color2: '#835436', season: 'paques', mods: { feu: 0.3, terre: 0.15, glace: -0.2 } },
  Y: { name: T('Ruisseau pastel'), color: '#a6e0ff', color2: '#9dd8fa', season: 'paques', mods: { eau: 0.3, glace: 0.15, feu: -0.2 } },
  Z: { name: T('Pré fleuri'), color: '#d6f5a8', color2: '#cdee9e', season: 'paques', mods: { vent: 0.3, foudre: 0.15, terre: -0.2 } },
  A: { name: T('Roseraie'), color: '#e8587e', color2: '#e05077', season: 'valentin', mods: { feu: 0.3, terre: 0.15, glace: -0.2 } },
  I: { name: T('Fontaine des vœux'), color: '#a8dcff', color2: '#9fd4fa', season: 'valentin', mods: { eau: 0.3, glace: 0.15, feu: -0.2 } },
  Q: { name: T('Barbe à papa'), color: '#f6d6ff', color2: '#efcbfa', season: 'valentin', mods: { vent: 0.3, foudre: 0.15, terre: -0.2 } },
  D: { name: T('Lanternes'), color: '#e8443a', color2: '#df3c33', season: 'nouvelan', mods: { feu: 0.3, foudre: 0.15, eau: -0.2 } },
  T: { name: T('Jardin de thé'), color: '#7fbf5a', color2: '#77b753', season: 'nouvelan', mods: { terre: 0.3, eau: 0.15, vent: -0.2 } },
  U: { name: T('Pics de jade'), color: '#7fd6b4', color2: '#76ceab', season: 'nouvelan', mods: { vent: 0.3, glace: 0.15, feu: -0.2 } },
  C: { name: T('Colline'), color: '#b3ea88', color2: '#a8e27c', range: 0.6, mods: {} },
  X: { name: 'Obstacle', block: true },
};
const ELNAME = { feu: T('Feu'), eau: T('Eau'), terre: T('Terre'), vent: T('Vent'), foudre: T('Éclair'), glace: T('Glace') };
const fmtAff = a => (a > 0 ? '+' : '−') + Math.round(Math.abs(a) * 100) + '\u00a0%';
function affinity(type, T) {
  if (!T || !T.mods) return 0;
  const els = TOWERS[type].parents || [type];
  const a = els.reduce((sum, e) => sum + (T.mods[e] || 0), 0) / els.length;
  return !G ? a : a > 0 ? a * (G.bm || 1) : a * (G.mm || 1);
}

const TORDER = ['feu', 'eau', 'terre', 'vent', 'foudre', 'glace'];
const TOWERS = {
  feu: { name: T('Braise'), elem: T('Feu'), cost: 60, range: 2.0, rate: 1.4, dmg: 10, air: true, kind: 'mono', color: '#ff7a3d',
    desc: T('Crache des boules de feu qui enflamment la cible.'),
    lv: [{ burn: 5, burnT: 2.5 }, { burn: 9, burnT: 2.5 }, { burn: 16, burnT: 3 }] },
  eau: { name: T('Ondine'), elem: T('Eau'), cost: 50, range: 2.6, rate: 0.9, dmg: 6, air: true, kind: 'zone', color: '#3aa0ff',
    desc: T('Éclaboussure de zone qui ralentit et mouille.'),
    lv: [{ slow: 0.3, splash: 0.9 }, { slow: 0.38, splash: 1.0 }, { slow: 0.46, splash: 1.15 }] },
  terre: { name: T('Rocaille'), elem: T('Terre'), cost: 80, range: 3.5, rate: 0.45, dmg: 34, air: false, kind: 'zone', color: '#c08a58',
    desc: T('Gros rochers de zone. Ne touche pas les volants.'),
    lv: [{ splash: 1.0, stun: 0 }, { splash: 1.1, stun: 0.12 }, { splash: 1.25, stun: 0.25 }] },
  vent: { name: T('Zéphyr'), elem: T('Vent'), cost: 70, range: 3.2, rate: 0.7, dmg: 7, air: true, kind: 'mono', color: '#5fe0bd', airBonus: 2.5,
    desc: T('Rafales qui repoussent. Dégâts ×2,5 sur les volants.'),
    lv: [{ knock: 0.6 }, { knock: 0.8 }, { knock: 1.1 }] },
  foudre: { name: T('Voltie'), elem: T('Éclair'), cost: 100, range: 2.5, rate: 0.8, dmg: 15, air: true, kind: 'chaine', color: '#ffd23f',
    desc: T('Un éclair qui rebondit d’ennemi en ennemi.'),
    lv: [{ chain: 3 }, { chain: 4 }, { chain: 6 }] },
  glace: { name: T('Givrette'), elem: T('Glace'), cost: 90, range: 1.6, rate: 0.6, dmg: 6, air: true, kind: 'onde', color: '#8fdfff',
    desc: T('Onde glacée autour d’elle : ralentit, puis gèle.'),
    lv: [{ slow: 0.4, every: 4, freeze: 0.8 }, { slow: 0.48, every: 3, freeze: 1.0 }, { slow: 0.55, every: 2, freeze: 1.2 }] },
};
const LVL = { dmg: [1, 1.7, 2.6, 3.6], range: [0, 0.3, 0.5, 0.7], rate: [1, 1.15, 1.3, 1.45] };
const BRANCHES = ['sol', 'air', 'boss'];
const BRANCH = {
  sol: { name: T('Écrase-sol'), short: T('Sol'), color: '#8fdc6a', target: T('Contre les ennemis au sol'), vs: T('au sol'), mul: [1.5, 2.0],
    ranks: [T('Dégâts ×1,5 contre les ennemis au sol'), T('Dégâts ×2 au sol, et 15 % de chances d’étourdir')] },
  air: { name: T('Chasse-ciel'), short: 'Air', color: '#7fd3ff', target: T('Contre les volants'), vs: T('en vol'), mul: [1.8, 2.6],
    ranks: [T('Dégâts ×1,8 contre les volants, +0,3 de portée'), T('Dégâts ×2,6 contre les volants, +0,6 de portée')] },
  boss: { name: T('Tueur de Kaiju'), short: 'Boss', color: '#ff4f6e', target: T('Contre les boss'), vs: T('sur boss'), mul: [1.7, 2.5],
    ranks: [T('Dégâts ×1,7 contre les Kaiju, ignore 3 d’armure'), T('Dégâts ×2,5 contre les Kaiju, ignore toute l’armure')] },
};
function rankText(key, r, type) {
  let x = BRANCH[key].ranks[r - 1];
  if (r === 1 && key === 'air' && !TOWERS[type].air) x += T('. Rocaille peut enfin toucher les volants');
  if (r === 1 && key === 'boss' && type === 'glace') x += T('. Gèle aussi les Kaiju longtemps');
  if (r === 1 && key === 'boss' && type === 'vent') x += T('. Repousse mieux les Kaiju');
  return x;
}
const KIND = { mono: T('Cible unique'), zone: T('Zone'), chaine: T('Chaîne'), onde: T('Onde autour d’elle'), chemin: T('Remonte le chemin'), flaque: T('Flaque au sol'), rayon: T('Rayon continu') };
const rangeLabel = r => r < 1.9 ? T('portée très courte') : r < 2.4 ? T('portée courte') : r < 3 ? T('portée moyenne') : T('portée longue');
const kindLine = type => KIND[TOWERS[type].kind] + ' · ' + rangeLabel(TOWERS[type].range);
const FUSIONS = {
  tornade: { name: T('Tornade de feu'), elem: T('Feu + Vent'), parents: ['feu', 'vent'], unlock: 25, fee: 100, cost: 170, snd: 'vent',
    range: 3.0, rate: 0.5, dmg: 18, air: true, kind: 'chemin', color: '#ff7a3d', knock: 0.3,
    desc: T('Lâche des tornades enflammées qui remontent le chemin et brûlent tout sur leur passage.'),
    lv: [{ burn: 10 }, { burn: 16 }, { burn: 26 }], fx: s => T('Brûlure ') + Math.round(s.burn) + '/s' },
  orage: { name: T('Orage'), elem: T('Eau + Éclair'), parents: ['eau', 'foudre'], unlock: 30, fee: 130, cost: 200, snd: 'foudre',
    range: 2.8, rate: 1.0, dmg: 14, air: true, kind: 'onde', color: '#8a8fd6',
    desc: T('Un nuage noir qui mouille tout dans son cercle et y fait tomber la foudre, deux fois plus forte sur les mouillés.'),
    lv: [{ chain: 4 }, { chain: 5 }, { chain: 7 }], fx: s => s.chain + T(' éclairs par seconde') },
  volcan: { name: T('Volcan'), elem: T('Feu + Terre'), parents: ['feu', 'terre'], unlock: 30, fee: 130, cost: 200, snd: 'terre',
    range: 3.4, rate: 0.4, dmg: 40, air: false, kind: 'zone', color: '#e0553a', splash: 1.1,
    desc: T('Crache des bombes de lave qui explosent en zone et laissent une flaque brûlante sur le chemin.'),
    lv: [{ lava: 14 }, { lava: 22 }, { lava: 35 }], fx: s => T('Lave ') + Math.round(s.lava) + '/s' },
  geyser: { name: 'Geyser', elem: T('Eau + Feu'), parents: ['eau', 'feu'], unlock: 25, fee: 110, cost: 180, snd: 'eau',
    range: 2.6, rate: 0.6, dmg: 22, air: true, kind: 'zone', color: '#9fe6ff', splash: 0.9,
    desc: T('Fait jaillir de la vapeur sous les ennemis : dégâts de zone, ennemis mouillés et projetés en l’air.'),
    lv: [{ stun: 0.6 }, { stun: 0.8 }, { stun: 1.0 }], fx: s => T('Projette ') + fr(s.stun) + ' s' },
  marais: { name: T('Marais'), elem: T('Eau + Terre'), parents: ['eau', 'terre'], unlock: 25, fee: 100, cost: 170, snd: 'eau',
    range: 2.8, rate: 0.5, dmg: 10, air: false, kind: 'flaque', color: '#9aa35a',
    desc: T('Lance des boules de boue qui laissent une flaque collante : ralentit fort et empoisonne.'),
    lv: [{ poison: 8, slow: 0.55 }, { poison: 13, slow: 0.62 }, { poison: 20, slow: 0.7 }], fx: s => T('Boue −') + Math.round(s.slow * 100) + ' %, poison ' + Math.round(s.poison) + '/s' },
  blizzard: { name: 'Blizzard', elem: T('Vent + Glace'), parents: ['vent', 'glace'], unlock: 35, fee: 140, cost: 210, snd: 'glace',
    range: 2.6, rate: 0.8, dmg: 10, air: true, kind: 'onde', color: '#bfeeff', airBonus: 2,
    desc: T('Une grande onde de neige : ralentit tout, gèle souvent et frappe fort les volants.'),
    lv: [{ slow: 0.5, every: 3, freeze: 1.0 }, { slow: 0.55, every: 2, freeze: 1.1 }, { slow: 0.6, every: 2, freeze: 1.4 }], fx: s => T('Gèle 1 onde / ') + s.every },
  sable: { name: T('Tempête de sable'), elem: T('Terre + Vent'), parents: ['terre', 'vent'], unlock: 30, fee: 120, cost: 190, snd: 'vent',
    range: 2.4, rate: 1.0, dmg: 8, air: true, kind: 'onde', color: '#e8c784',
    desc: T('Le sable use les armures : chaque onde retire de l’armure aux ennemis, jusqu’à la fin de la partie.'),
    lv: [{ shred: 1 }, { shred: 2 }, { shred: 3 }], fx: s => T('Armure −') + s.shred + T(' par onde') },
  plasma: { name: 'Plasma', elem: T('Feu + Éclair'), parents: ['feu', 'foudre'], unlock: 40, fee: 150, cost: 220, snd: 'plasma',
    range: 2.6, rate: 1, dmg: 20, air: true, kind: 'rayon', color: '#ff6ad5',
    desc: T('Un rayon continu qui chauffe de plus en plus tant qu’il reste sur la même cible. Idéal contre les Kaiju.'),
    lv: [{ rampMax: 2 }, { rampMax: 3 }, { rampMax: 4 }], fx: s => T('Jusqu’à ×') + (1 + s.rampMax) + T(' en chauffant') },
};
for (const k in FUSIONS) TOWERS[k] = Object.assign({ fusion: true }, FUSIONS[k]);
const fusionUnlocked = k => M('f_' + k) > 0;
function fusionKey(a, b) {
  for (const k in FUSIONS) { const [x, y] = FUSIONS[k].parents; if ((x === a && y === b) || (x === b && y === a)) return k; }
  return null;
}
const MODES = ['premier', 'fort', 'proche'], MODE_LABEL = { premier: T('Cible : 1er'), fort: T('Cible : costaud'), proche: T('Cible : proche') };

const ETYPES = {
  gloop: { name: 'Gloop', hp: 30, speed: 1.0, reward: 3, size: 0.24, color: '#b57bff', light: '#e2caff', mood: 'happy', desc: T('Le slime de base.') },
  zip: { name: 'Zippy', hp: 16, speed: 2.0, reward: 2, size: 0.18, color: '#ff7eb6', light: '#ffd0e5', mood: 'open', desc: T('Minuscule et très rapide.') },
  flappy: { name: 'Flappy', hp: 24, speed: 1.3, reward: 3, size: 0.2, color: '#7a69e0', light: '#b9adff', mood: 'fang', flying: true, desc: T('Vole : Rocaille ne l’atteint pas.') },
  tonk: { name: 'Tonk', hp: 110, speed: 0.6, reward: 6, size: 0.31, color: '#7fa4c9', light: '#cfe0f2', mood: 'grr', angry: true, armor: 3, lifeCost: 2, desc: T('Casqué : encaisse chaque coup.') },
  magma: { name: 'Magmo', hp: 60, speed: 0.9, reward: 5, size: 0.26, color: '#ff6a3d', light: '#ffc08a', mood: 'grr', angry: true, immune: 'feu', desc: T('Immunisé au feu.') },
  gresil: { name: T('Grésillon'), hp: 40, speed: 1.1, reward: 4, size: 0.22, color: '#c6e84a', light: '#eeffa8', mood: 'open', desc: T('Paralyse les tours proches quelques secondes.') },
  crachou: { name: T('Crachou'), hp: 70, speed: 0.8, reward: 6, size: 0.27, color: '#ff8a5c', light: '#ffc6a8', mood: 'grr', angry: true, armor: 1, desc: T('Crache sur les tours et leur fait perdre des PV.') },
  malefik: { name: T('Maléfik'), hp: 150, speed: 0.7, reward: 12, size: 0.28, color: '#7a4fb8', light: '#c9a8f0', mood: 'grr', angry: true, armor: 2, desc: T('Pervertit une tour : elle attaque les autres tours un moment.') },
  boss: { name: 'Kaiju', hp: 650, speed: 0.42, reward: 45, size: 0.42, color: '#ff4f6e', light: '#ffa3b3', mood: 'grr', angry: true, armor: 5, lifeCost: 10, boss: true, desc: T('Boss des vagues 10, 20, 30. Ses coups de patte abîment les tours.') },
  spectre: { name: 'Spectre', hp: 50, speed: 1.15, reward: 5, size: 0.24, color: '#e6e0ff', light: '#ffffff', mood: 'open', season: 'halloween', desc: T('Halloween : devient intangible par moments, aucune attaque ne le touche alors.') },
  potiron: { name: T('Potiron'), hp: 70, speed: 1.3, reward: 3, size: 0.2, color: '#ff8a2b', light: '#ffc27a', mood: 'grr', angry: true, season: 'halloween', desc: T('Halloween : trois Potirons s’échappent du Roi Citrouille quand il tombe.') },
  cadeau: { name: T('Cadeau surprise'), hp: 90, speed: 0.75, reward: 6, size: 0.26, color: '#e8344e', light: '#ff9aa8', mood: 'grr', angry: true, armor: 2, season: 'noel', desc: T('Noël : en s’ouvrant, il libère deux Lutins.') },
  lapin: { name: T('Lapin sauteur'), hp: 45, speed: 0.9, reward: 5, size: 0.22, color: '#f2ece8', light: '#ffffff', mood: 'happy', season: 'paques', desc: T('Pâques : fait un grand bond en avant toutes les 3 secondes.') },
  calinou: { name: T('Câlinou'), hp: 60, speed: 0.8, reward: 6, size: 0.25, color: '#ff9ac6', light: '#ffd6ea', mood: 'happy', season: 'valentin', desc: T('Saint-Valentin : soigne les ennemis autour de lui toutes les 3 secondes.') },
  hongbao: { name: T('Enveloppe rouge'), hp: 35, speed: 1.7, reward: 16, size: 0.21, color: '#e8344e', light: '#ff8f9a', mood: 'open', lifeCost: 0, season: 'nouvelan', desc: T('Nouvel An chinois : très rapide et pleine d’or. Elle ne coûte pas de vie si elle s’échappe.') },
};
// Déguisements des événements : même comportement, autre allure et autre nom sur la carte de l'événement
const SKINS = {};
SKINS.halloween = {
  gloop: { name: T('Fantôme'), color: '#ece8ff', light: '#ffffff' },
  zip: { name: T('Chat noir'), color: '#3b3150', light: '#6d6188' },
  flappy: { name: T('Chauve-souris'), color: '#4a3d63', light: '#7f71a0' },
  tonk: { name: T('Chevalier Citrouille'), color: '#ff8a2b', light: '#ffc27a' },
  magma: { name: 'Potion', color: '#6fd64a', light: '#c4ff9a' },
  gresil: { name: T('Araignée'), color: '#463a5c', light: '#7d6f96' },
  crachou: { name: 'Zombie', color: '#93b86e', light: '#cfe6b0' },
  malefik: { name: T('Sorcière'), color: '#7cc65a', light: '#c4f0a6' },
  boss: { name: T('Roi Citrouille'), color: '#ff8a2b', light: '#ffc27a' },
};
SKINS.noel = {
  gloop: { name: T('Bonhomme de neige'), color: '#eef5ff', light: '#ffffff' },
  zip: { name: T('Lutin'), color: '#5cc85a', light: '#b8f0a0' },
  flappy: { name: T('Harfang'), color: '#e8f0fb', light: '#ffffff' },
  tonk: { name: T('Casse-noisette'), color: '#d93a4a', light: '#ff8f9a' },
  magma: { name: 'Pudding', color: '#9a5a3a', light: '#d29a6e' },
  gresil: { name: T('Ampoule'), color: '#ffd23f', light: '#fff4b0' },
  crachou: { name: T('Renne grognon'), color: '#b07a4e', light: '#e2b48a' },
  malefik: { name: T('Père Fouettard'), color: '#4a4560', light: '#8a84a6' },
  boss: { name: T('Yéti'), color: '#dfeefc', light: '#ffffff' },
};
SKINS.paques = {
  gloop: { name: T('Poussin'), color: '#ffe066', light: '#fff6c0' },
  zip: { name: T('Coccinelle'), color: '#ff4f5e', light: '#ffa3ab' },
  flappy: { name: T('Papillon'), color: '#ff9ad0', light: '#ffd6ec' },
  tonk: { name: T('Œuf blindé'), color: '#9fd8ff', light: '#e2f5ff' },
  magma: { name: T('Chocolat'), color: '#8a5a3c', light: '#c8936a' },
  gresil: { name: T('Abeille'), color: '#ffcf3a', light: '#fff0a8' },
  crachou: { name: T('Grenouille'), color: '#6fcf6a', light: '#c0f0b0' },
  malefik: { name: T('Lapin magicien'), color: '#b8a2ff', light: '#e4dbff' },
  boss: { name: T('Lapin en chocolat'), color: '#7a4a2c', light: '#b8805a' },
};
SKINS.valentin = {
  gloop: { name: T('Guimauve'), color: '#ffc2dc', light: '#ffeaf3' },
  zip: { name: T('Cupidon'), color: '#ffd9b0', light: '#fff1de' },
  flappy: { name: T('Colombe'), color: '#f4f2ff', light: '#ffffff' },
  tonk: { name: T('Ours en peluche'), color: '#c48a5a', light: '#e8bc92' },
  magma: { name: T('Bonbon cœur'), color: '#ff5a8a', light: '#ffb0c8' },
  gresil: { name: T('Luciole'), color: '#e2f55a', light: '#f8ffc0' },
  crachou: { name: T('Crapaud charmant'), color: '#7bd06a', light: '#c4f0b4' },
  malefik: { name: T('Cœur brisé'), color: '#9a3a6a', light: '#d884b0' },
  boss: { name: T('Reine des Cœurs'), color: '#ff4f81', light: '#ffa8c2' },
};
SKINS.nouvelan = {
  gloop: { name: T('Ravioli'), color: '#fff1dc', light: '#ffffff' },
  zip: { name: T('Souris'), color: '#a8a0b8', light: '#dcd6e8' },
  flappy: { name: T('Cerf-volant'), color: '#ff5a4a', light: '#ffa89a' },
  tonk: { name: T('Lion dansant'), color: '#ffc23a', light: '#fff0a0' },
  magma: { name: T('Pétard'), color: '#e8344e', light: '#ff8f9a' },
  gresil: { name: T('Lanterne'), color: '#ff6a3d', light: '#ffc08a' },
  crachou: { name: T('Crapaud doré'), color: '#e8b83a', light: '#fff0a0' },
  malefik: { name: T('Renard à neuf queues'), color: '#ff9a4d', light: '#ffd2a8' },
  boss: { name: 'Dragon', color: '#e8344e', light: '#ff9aa8' },
};
const skinOf = k => { const e = evt(); return e && SKINS[e] ? SKINS[e][k] || null : null; };
const eName = k => (skinOf(k) || ETYPES[k]).name;
const BOSSNAME = { halloween: 'ROI CITROUILLE', noel: T('YÉTI'), paques: T('LAPIN GÉANT'), valentin: T('REINE DES CŒURS'), nouvelan: 'DRAGON' };
const BOSSAPP = { halloween: T('Le Roi Citrouille approche...'), noel: T('Le Yéti approche...'), paques: T('Le Lapin en chocolat approche...'), valentin: T('La Reine des Cœurs approche...'), nouvelan: T('Le Dragon approche...') };
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
const MASTERY = { feu: T('du feu'), eau: T('de l’eau'), terre: T('de la terre'), vent: T('du vent'), foudre: T('de l’éclair'), glace: T('de la glace') };
const UPGRADES = [
  { id: 'gold', name: T('Trésor de départ'), max: 5, base: 8, fx: l => '+' + l * 25 + T(' or au départ') },
  { id: 'lives', name: T('Cœur solide'), max: 5, base: 10, fx: l => '+' + l * 2 + T(' vies au départ') },
  { id: 'loot', name: T('Butin'), max: 5, base: 12, fx: l => '+' + l * 6 + T(' % d’or par ennemi') },
  { id: 'bonus', name: T('Prime de vague'), max: 5, base: 8, fx: l => '+' + l * 20 + T(' % de prime de fin de vague') },
  { id: 'cheap', name: T('Rabais'), max: 5, base: 15, fx: l => T('Tours et améliorations ') + l * 4 + T(' % moins chères') },
  { id: 'resell', name: T('Revente'), max: 4, base: 8, fx: l => T('Tours revendues à ') + (70 + l * 5) + ' %' },
  { id: 'remparts', name: T('Remparts'), max: 5, base: 10, fx: l => T('Tours +') + l * 20 + T(' % de PV') },
  { id: 'bouclier', name: T('Bouclier'), max: 3, base: 15, fx: l => T('Chaque tour commence la vague avec un bouclier de ') + l * 15 + T(' % de ses PV') },
  { id: 'paratonnerre', name: T('Paratonnerre'), max: 3, base: 12, fx: l => T('Paralysie des Grésillons −') + l * 25 + ' %' },
  { id: 'talisman', name: 'Talisman', max: 3, base: 14, fx: l => T('Perversion des Maléfik −') + l * 25 + T(' % de durée') },
  { id: 'revive', name: T('Seconde chance'), max: 1, base: 60, fx: () => T('Une fois par partie, la maison repart avec 5 vies') },
  ...TORDER.map(t => ({ id: 'm_' + t, tower: t, name: T('Maîtrise ') + MASTERY[t], max: 5, base: 10,
    fx: l => TOWERS[t].name + ' : +' + l * 10 + T(' % de dégâts') + (l >= 5 ? T(', +0,3 de portée') : '') })),
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
        case 'cri': this.tone('sawtooth', 1900, 1100, 0.14, 0.1); this.tone('square', 2400, 1500, 0.11, 0.06, 0.09); this.tone('sawtooth', 1700, 900, 0.16, 0.08, 0.17); break;
        case 'clear': [659, 784, 988].forEach((f, i) => this.tone('sine', f, f, 0.14, 0.25, i * 0.08)); break;
      }
    } catch (e) {}
  },
};

