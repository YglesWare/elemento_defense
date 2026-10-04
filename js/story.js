// Élémento Defense : mode histoire « La flamme de Braise » (remplace les tutoriels).
// Un petit RPG drôle : Braise part à l'aventure, rencontre les autres gardiens un par un et apprend le jeu…
// et se réveille à la fin : tout était un rêve. Rien n'est donc compté pour de vrai : la progression solo est mise de côté
// pendant les chapitres (comme en duel), sans sauvegarde, records, stats, défis ni trophées (G.story, js/game.js).
'use strict';

const STORY_KEY = 'elemento.story';
STORE_DOMAINS[STORY_KEY] = 'progress';
let storyRun = null;      // chapitre en cours (lu par newGame)
const storyDone = () => (store.get(STORY_KEY) || {}).done || {};

// ---------- Les chapitres ----------
// waves : une liste par vague de [type d'ennemi, nombre] ; events : dialogues au début (start) ou à la fin (end) d'une vague
const CHAPTERS = [
  { title: 'La petite maison', place: 'Prairie Mochi', map: 0, towers: ['feu'], gold: 150, lives: 10,
    waves: [[['gloop', 4]], [['gloop', 6]], [['gloop', 9]]],
    intro: [
      ['narr', 'Il était une fois, dans la Prairie Mochi, une petite flamme nommée Braise.'],
      ['feu', 'Ah… La belle journée pour faire la sieste au soleil…'],
      ['yglou', 'Sauf que… des slimes foncent droit sur la maison de Mamie Mochi !'],
      ['feu', 'QUOI ?! Pas touche à Mamie ! Je vais les griller !'],
      ['yglou', 'Touche une case près du chemin pour poser Braise, puis lance la vague avec ▶.'],
    ],
    events: { start2: [['yglou', 'Chaque slime battu donne de l’or. Avec l’or, pose un autre Braise… ou améliore le premier en le touchant !']] },
    outro: [
      ['feu', 'Et voilà ! Plus un seul slime.'],
      ['yglou', 'Bravo ! Mais regarde : leurs traces viennent de très loin, au-delà du lac…'],
      ['feu', 'Alors c’est décidé : je pars à l’aventure ! Qui m’aime me suive !'],
      ['yglou', 'Moi ! Moi ! Attends-moi, Braise !'],
    ] },
  { title: 'Le lac d’Ondine', place: 'Plage Ramune', map: 1, towers: ['feu', 'eau'], gold: 200, lives: 12,
    waves: [[['gloop', 6]], [['zip', 8]], [['zip', 10], ['gloop', 4]], [['zip', 15]]],
    intro: [
      ['narr', 'Au bord du lac, quelqu’un appelle à l’aide…'],
      ['eau', 'Au secours ! Ces Zippy vont trop vite, je n’arrive pas à les arrêter toute seule !'],
      ['feu', 'Moi non plus ! Ils filent entre mes flammes !'],
      ['eau', 'Et si je les ralentissais… pendant que tu les brûles ?'],
      ['feu', 'Ça, c’est une idée qui me chauffe !'],
    ],
    events: { start2: [['yglou', 'Ondine éclabousse et ralentit les ennemis. Place-la juste avant tes Braise !']] },
    outro: [
      ['eau', 'Merci, Braise ! Je peux venir avec toi ? Il faut bien quelqu’un pour éteindre tes bêtises.'],
      ['feu', 'Hé ! … Bon, d’accord. Bienvenue dans l’équipe !'],
    ] },
  { title: 'Les gemmes scintillantes', place: 'Prairie Mochi', map: 0, towers: ['feu', 'eau'], gold: 220, lives: 12, shards: 60,
    waves: [[['gloop', 10]], [['gloop', 8], ['zip', 6]], [['zip', 10], ['gloop', 8]], [['gloop', 14], ['zip', 8]]],
    intro: [
      ['narr', 'Sur le chemin, quelque chose brille dans l’herbe…'],
      ['feu', 'Une gemme violette ! Elle a l’air… croustillante.'],
      ['eau', 'Tu ne vas quand même pas la manger ?'],
      ['feu', 'CRONCH. … Ouh là ! Je me sens PLUS FORT ! Et je vois loin, loin, loin !'],
      ['yglou', 'Ces gemmes s’appellent des éclats. Dans l’Atelier, onglet Maîtrises : prends une Maîtrise du feu (plus de dégâts) et une Longue-vue (plus de portée) !'],
    ],
    atelier: true,
    outro: [
      ['feu', 'Avec les gemmes, je suis un vrai feu d’artifice !'],
      ['eau', 'Garde-en pour la suite… On entend des bruits de casseroles du côté du marais.'],
    ] },
  { title: 'Le marais de Rocaille', place: 'Marais Matcha', map: 2, towers: ['feu', 'eau', 'terre'], gold: 240, lives: 14,
    waves: [[['gloop', 8]], [['tonk', 4]], [['tonk', 6], ['gloop', 6]], [['tonk', 8]], [['tonk', 8], ['zip', 8]], [['tonk', 12]]],
    intro: [
      ['narr', 'Dans le marais, des Tonk casqués avancent en rang…'],
      ['feu', 'Prenez ça ! … Hein ? Mes flammes rebondissent sur leurs casques !'],
      ['terre', 'Grmbl… Encore des Tonk casqués. Tes petites flammes, ça leur fait des chatouilles.'],
      ['feu', 'Hé ! Elles sont TRÈS chaudes, mes flammes !'],
      ['terre', 'Regarde et apprends. BAM. Voilà comment on enlève un casque.'],
    ],
    events: { start2: [['yglou', 'Les Tonk ont une armure : elle retire des dégâts à chaque coup. Les gros coups de Rocaille passent quand même !']] },
    outro: [
      ['terre', 'Grmbl. Vous êtes bruyants… mais pas mauvais. Je viens. Juste pour vous surveiller.'],
      ['eau', 'Il nous aime bien, en fait.'],
      ['terre', 'Grmbl.'],
    ] },
  { title: 'Le premier géant', place: 'Forêt Dango', map: 3, towers: ['feu', 'eau', 'terre'], gold: 300, lives: 15,
    waves: [[['gloop', 10]], [['zip', 10], ['gloop', 6]], [['tonk', 6], ['gloop', 8]], [['gloop', 12], ['zip', 8]], [['gloop', 6], ['boss', 1]]],
    intro: [
      ['narr', 'À la sortie de la forêt, le sol se met à trembler…'],
      ['feu', 'C’est un tremblement de terre ?'],
      ['terre', 'Non. C’est un Kaiju. Un très, très gros slime.'],
      ['eau', 'Il paraît qu’on le bat en visant tous ensemble.'],
    ],
    events: { start5: [['yglou', 'Le Kaiju arrive ! Il a énormément de PV, et ses coups de patte abîment les tours proches. Vise-le avec tout le monde !']] },
    outro: [
      ['feu', 'On l’a eu !! On est TROP forts !'],
      ['terre', 'Grmbl… pas mal.'],
      ['yglou', 'Le Kaiju a laissé tomber une carte… Elle mène aux crêtes venteuses. La suite de l’aventure, très bientôt !'],
    ] },
  { title: 'Le vent de Zéphyr', place: 'Île Takoyaki', map: 5, towers: ['feu', 'eau', 'terre', 'vent'], gold: 300, lives: 15,
    waves: [[['gloop', 8]], [['flappy', 6]], [['flappy', 8], ['gloop', 6]], [['tonk', 6], ['flappy', 6]], [['flappy', 16]], [['zip', 10], ['flappy', 10]]],
    intro: [
      ['narr', 'Sur l’île, des Flappy tournoient au-dessus des palmiers…'],
      ['terre', 'Grmbl ! Ils volent trop haut, je ne peux pas les toucher !'],
      ['vent', 'Ooooh… des nuages tout ronds… Ah, pardon. Vous parlez des slimes volants ?'],
      ['feu', 'Oui ! Tu peux les attraper ?'],
      ['vent', 'Facile. Le vent, c’est mon truc… enfin, quand je ne rêvasse pas.'],
    ],
    events: { start2: [['yglou', 'Les Flappy volent : Rocaille ne peut pas les toucher. Zéphyr leur fait 2,5 fois plus de dégâts !']] },
    outro: [
      ['vent', 'Je viens avec vous. Il paraît qu’il y a de jolis nuages plus loin.'],
      ['eau', 'Il est un peu dans la lune, non ?'],
      ['vent', 'Hein ? Quelle lune ?'],
    ] },
  { title: 'Le désert brûlant', place: 'Désert Dorayaki', map: 4, towers: ['feu', 'eau', 'terre', 'vent'], gold: 320, lives: 15,
    waves: [[['gloop', 10]], [['magma', 4], ['gloop', 6]], [['tonk', 8]], [['magma', 8], ['zip', 8]], [['gloop', 14], ['flappy', 6]], [['magma', 10], ['tonk', 6]]],
    intro: [
      ['narr', 'Dans le désert, le sable brûle les pattes…'],
      ['feu', 'Ahhh, quelle douce chaleur ! Je me sens en pleine forme !'],
      ['eau', 'Moi, je m’évapore… Ici, mes éclaboussures sont toutes molles.'],
      ['yglou', 'Chaque terrain change la puissance des tours : regarde le + ou le − sur leurs boutons. Et pose-les sur les collines : +0,4 de portée !'],
    ],
    events: { start2: [['yglou', 'Les Magmo ne craignent pas le feu ! Contre eux, mise sur Ondine, Rocaille et Zéphyr.']] },
    outro: [
      ['feu', 'Le désert, c’est le paradis !'],
      ['eau', 'Pour toi, peut-être. Moi, je veux une piscine.'],
      ['terre', 'Grmbl. J’ai du sable partout.'],
    ] },
  { title: 'Le canyon de Voltie', place: 'Canyon Taiyaki', map: 6, towers: ['feu', 'eau', 'terre', 'vent', 'foudre'], gold: 340, lives: 15,
    waves: [[['gloop', 12]], [['zip', 14]], [['gloop', 18]], [['gresil', 6], ['gloop', 8]], [['zip', 16], ['gloop', 10]], [['gloop', 24]]],
    intro: [
      ['narr', 'Dans le canyon, ça crépite de partout…'],
      ['foudre', 'BZZT ! Salut ! Vous êtes qui ? Vous faites quoi ? On joue ? BZZT !'],
      ['feu', 'Euh… on chasse des slimes. Il y en a plein, groupés en paquets.'],
      ['foudre', 'DES PAQUETS ?! Mes éclairs rebondissent d’un slime à l’autre ! Trop bien ! BZZT !'],
    ],
    events: { start4: [['yglou', 'Les Grésillons paralysent les tours proches. Élimine-les vite !']] },
    outro: [
      ['foudre', 'Je viens ! Je viens ! Je viens ! On va où ? C’est loin ? BZZT !'],
      ['terre', 'Grmbl… Elle va me fatiguer, celle-là.'],
    ] },
  { title: 'Le Grand Sage', place: 'Pic Kakigori', map: 8, towers: ['feu', 'eau', 'terre', 'vent', 'foudre', 'glace'], fusion: true, gold: 450, lives: 16,
    waves: [[['gloop', 12]], [['flappy', 10], ['gloop', 6]], [['tonk', 8], ['zip', 8]], [['gloop', 16], ['flappy', 8]], [['tonk', 10], ['magma', 6]], [['gloop', 20], ['flappy', 10]]],
    intro: [
      ['narr', 'Au sommet du Pic Kakigori, dans la neige, vit un très vieil aigle…'],
      ['yglou', 'Papi !'],
      ['papi', 'Hé hé hé… Mon petit Yglou ! Et tu m’amènes des amis. Entrez, entrez, il fait frisquet.'],
      ['glace', 'B-b-bonjour… Je suis Givrette. J’aide Papi à garder la montagne.'],
      ['papi', 'Écoutez bien, jeunes gardiens : deux amis qui unissent leurs pouvoirs, ça décoiffe. Même moi, et j’ai plus beaucoup de plumes.'],
      ['papi', 'Monte deux tours au niveau 2, puis fais glisser l’une sur l’autre : elles fusionnent ! Essaie Braise et Zéphyr : ça fait une Tornade de feu.'],
    ],
    events: { start2: [['glace', 'M-moi, je ralentis tout le monde avec mon froid… P-pose-moi au milieu du chemin.']] },
    outro: [
      ['papi', 'Bravo ! Vous apprenez vite. Revenez demain, je vous apprendrai encore un tour… ou deux.'],
      ['glace', 'J-je peux venir avec vous ? Je n’ai jamais vu le reste du monde…'],
      ['feu', 'Bien sûr ! Je te réchaufferai !'],
      ['glace', 'Pas trop, hein…'],
    ] },
  { title: 'Le choix du chemin', place: 'Volcan Wasabi', map: 7, towers: ['feu', 'eau', 'terre', 'vent', 'foudre', 'glace'], fusion: true, gold: 500, lives: 16,
    waves: [[['gloop', 14]], [['flappy', 12]], [['tonk', 10], ['gloop', 8]], [['gloop', 10], ['boss', 1]], [['flappy', 14], ['zip', 10]], [['tonk', 12], ['magma', 8]], [['gloop', 20], ['boss', 1]]],
    intro: [
      ['narr', 'Au pied du volcan, Papi Yglou a encore une leçon…'],
      ['papi', 'Une tour, ça peut se spécialiser. Monte-la au niveau 3 et choisis son talent : écraser le sol, chasser le ciel… ou terrasser les Kaiju !'],
      ['terre', 'Grmbl… Moi, je choisis Tueur de Kaiju. Évidemment.'],
      ['vent', 'Moi, Chasse-ciel. Les nuages, c’est chez moi.'],
    ],
    events: { start4: [['yglou', 'Un Kaiju ! Une tour « Tueur de Kaiju » lui fait très mal.']] },
    outro: [
      ['papi', 'Vous êtes prêts. Le Roi Gloop vous attend dans la Toundra. Courage, mes petits !'],
      ['feu', 'On arrive, Roi Gloop ! Prépare-toi à fondre !'],
    ] },
  { title: 'Le Roi Gloop', place: 'Toundra Yuzu', map: 9, towers: ['feu', 'eau', 'terre', 'vent', 'foudre', 'glace'], fusion: true, gold: 600, lives: 20, final: true,
    waves: [[['gloop', 16]], [['zip', 16], ['flappy', 8]], [['tonk', 12], ['gloop', 10]], [['magma', 10], ['gresil', 6]], [['flappy', 20]], [['gloop', 24], ['boss', 1]], [['tonk', 14], ['zip', 14]], [['gloop', 20], ['flappy', 12], ['boss', 2]]],
    intro: [
      ['narr', 'Au cœur de la Toundra glacée, sur un trône de neige…'],
      ['king', 'MOUAHAHA ! Qui ose déranger le Roi Gloop ?'],
      ['feu', 'Nous ! Pourquoi tu envoies tes slimes partout ?'],
      ['king', 'Parce que… parce que… j’ai FROID ! Ici, tout est glacé !'],
      ['eau', '…C’est tout ?'],
      ['king', 'SILENCE ! À l’attaque, mes slimes !'],
    ],
    events: { start6: [['king', 'Mon Kaiju préféré va vous écrabouiller !']], start8: [['king', 'Tous ensemble, mes slimes ! Même les gros !']] },
    outro: [
      ['king', 'Bouhouhou… Vous avez gagné… Je voulais juste un peu de chaleur…'],
      ['feu', 'Fallait le dire ! Viens te réchauffer près de moi.'],
      ['king', '…C’est vrai ? Oh, c’est tout doux, tout chaud…'],
      ['narr', 'Et c’est ainsi que la vallée retrouva la paix…'],
    ] },
];
const STORY_SOON = [];
// Le réveil : tout était un rêve… qui donne à Braise l'envie de partir pour de vrai
const WAKE_LINES = [
  ['feu', 'Hein ?… Le Roi Gloop, Rocaille, les gemmes… C’était un rêve ?'],
  ['yglou', 'Un rêve, oui ! Tu parlais en dormant… « Grmbl », « BZZT »…'],
  ['feu', 'Mais c’était trop bien ! Et si… on partait pour de vrai ?'],
  ['yglou', 'J’espérais que tu dirais ça ! La vallée a vraiment besoin d’un héros.'],
];
const LOSE_LINES = [['yglou', 'Aïe, les slimes sont passés ! Pas grave : on réessaie, avec un peu plus d’or.']];

// ---------- Dialogues : pages de BD en plein écran (cases, bulles, trame façon manga) ----------
const STORY_NAMES = { feu: 'Braise', eau: 'Ondine', terre: 'Rocaille', vent: 'Zéphyr', foudre: 'Voltie', glace: 'Givrette', yglou: 'Yglou', papi: 'Papi Yglou', king: 'Roi Gloop' };
const COMIC_COL = { feu: '#ffbd7a', eau: '#9ad6ff', terre: '#ddbb92', vent: '#a6ecd6', foudre: '#ffe773', glace: '#d3f0ff', yglou: '#dcc8ff', papi: '#ebe5d8', king: '#dccdff' };
// Le personnage en grand, à la position (x, y) = ses pieds, taille s
function drawPortraitAt(c, who, x, y, s) {
  if (who === 'yglou') drawYglou(c, x, y - s * 0.42, s, 'happy', 0.4, { noShadow: true, noConfetti: true });
  else if (who === 'papi') drawPapi(c, x, y - s * 0.42, s);
  else if (who === 'king') drawKingGloop(c, x, y, s * 1.25);
  else drawTower(c, who, x, y - s * 0.22, s, 1, 0.4, 0, 0.3, 0, false);
}
// Le dessin d'une case : trame de la couleur du personnage, traits de vitesse s'il s'exclame, portrait du côté « side »
const COMIC_SFX = /\b(CRONCH|BAM|BZZT|Grmbl|QUOI)\b/;
// Hauteur du bord haut (0-1) ou bas (3-2) du quadrilatère q à l'abscisse x
const edgeY = (q, a, b, x) => q[a][1] + (q[b][1] - q[a][1]) * (x - q[a][0]) / ((q[b][0] - q[a][0]) || 1);
function comicArt(cv, who, txt, side, w, h, q) {
  const c = prepMini(cv, w, h);
  const ink = () => { c.beginPath(); q.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.lineJoin = 'miter'; c.lineWidth = 8; c.strokeStyle = INK; c.stroke(); };
  if (who === 'narr') {
    c.fillStyle = '#f2dfb0'; c.fillRect(0, 0, w, h);
    const R = REGIONS[storyRun ? storyRun.ch : 0] || REGIONS[0], u = Math.min(h * 0.28, w * 0.18), cy = (edgeY(q, 0, 1, w / 2) + edgeY(q, 3, 2, w / 2)) / 2;
    blob(c, w / 2, cy + u * 0.35, u * 2.6, u * 1.2, R.c, 5); landmark(c, R.k, w / 2, cy + u * 0.4, u);
    ink(); return;
  }
  c.fillStyle = COMIC_COL[who] || '#ffffff'; c.fillRect(0, 0, w, h);
  const px = side === 'l' ? w * 0.2 : w * 0.8, top = edgeY(q, 0, 1, px), bot = edgeY(q, 3, 2, px), py = top + (bot - top) * 0.47, s = Math.min((bot - top) * 0.72, w * 0.36);
  // Trame : des points plus gros loin du personnage
  c.fillStyle = 'rgba(42,27,61,.13)';
  for (let y = 4; y < h; y += 9) for (let x = (y / 9 % 2) * 4.5 + 4; x < w; x += 9) { const d = Math.hypot(x - px, y - py) / Math.hypot(w, h); c.beginPath(); c.arc(x, y, 0.6 + d * 3.2, 0, TAU); c.fill(); }
  // Traits de vitesse quand ça s'exclame
  if (/[!?]/.test(txt)) {
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineCap = 'round';
    for (let k = 0; k < 28; k++) { const a = k / 28 * TAU, r0 = s * 0.62, r1 = Math.hypot(w, h); c.lineWidth = 1.5 + (k % 3); c.beginPath(); c.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0); c.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); c.stroke(); }
  }
  drawPortraitAt(c, who, px, py + s * 0.5, s);
  // Onomatopée en grosses lettres au-dessus du personnage
  const sfx = who !== 'yglou' && txt.match(COMIC_SFX);
  if (sfx) {
    const fs = Math.round(Math.min(h * 0.22, 40));
    c.save(); c.translate(px + (side === 'l' ? s * 0.25 : -s * 0.25), Math.max(top + fs * 0.8, py - s * 0.48)); c.rotate(side === 'l' ? -0.18 : 0.18);
    c.font = fs + "px Bangers, Impact, 'Arial Black', sans-serif"; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = fs * 0.22; c.strokeStyle = INK; c.strokeText(sfx[1].toUpperCase(), 0, 0);
    c.fillStyle = '#ffe14d'; c.fillText(sfx[1].toUpperCase(), 0, 0); c.restore();
  }
  ink();
}
const COMIC_PAGES = {
  3: [[[0, 0], [100, 0], [100, 30], [0, 37]], [[0, 40], [100, 25], [97, 63], [3, 70]], [[0, 64], [100, 70], [100, 100], [0, 100]]],
  2: [[[0, 0], [100, 0], [100, 46], [0, 54]], [[0, 57], [100, 42], [100, 100], [0, 100]]],
};
let dlgQ = null;
function storySay(lines) {
  return new Promise(done => {
    if (!lines || !lines.length) { done(); return; }
    const wasPaused = G ? G.paused : false; if (G) G.paused = true;
    const box = $('#comic'), page = $('#cmPage');
    let i = 0, side = 'l', lastWho = null;
    const addPanel = () => {
      const [who, txt] = lines[i], per = innerHeight < 560 ? 2 : 3;
      page.classList.toggle('two', per === 2);
      if (page.children.length >= per) page.innerHTML = '';
      if (lastWho && who !== lastWho && who !== 'narr') side = side === 'l' ? 'r' : 'l';
      if (who !== 'narr') lastWho = who;
      // Une page sur deux en miroir, pour varier
      const flip = (storySay.pg = (storySay.pg || 0) + (page.children.length ? 0 : 1)) % 2 === 0;
      const Q = COMIC_PAGES[per][page.children.length].map(([x, y]) => [flip ? 100 - x : x, y]);
      if (flip) Q.reverse().push(...Q.splice(0, 2));
      const x0 = Math.min(...Q.map(v => v[0])), x1 = Math.max(...Q.map(v => v[0])), y0 = Math.min(...Q.map(v => v[1])), y1 = Math.max(...Q.map(v => v[1]));
      const p = document.createElement('div');
      p.className = 'cpanel';
      p.style.cssText = 'left:' + x0 + '%;top:' + y0 + '%;width:' + (x1 - x0) + '%;height:' + (y1 - y0) + '%';
      p.innerHTML = '<canvas aria-hidden="true"></canvas>' + (who === 'narr' ? '<div class="ccap">' + esc(T(txt)) + '</div>'
        : '<div class="cbal ' + side + '"><b>' + esc(T(STORY_NAMES[who] || who)) + '</b>' + esc(T(txt)) + '</div>');
      page.appendChild(p);
      // clientWidth/Height ne tiennent pas compte de l'animation d'apparition (scale)
      const w = Math.max(200, p.clientWidth), h = Math.max(90, p.clientHeight);
      const q = Q.map(([x, y]) => [(x - x0) / ((x1 - x0) || 1) * w, (y - y0) / ((y1 - y0) || 1) * h]);
      const cv = p.querySelector('canvas');
      cv.style.clipPath = 'polygon(' + q.map(([x, y]) => x.toFixed(1) + 'px ' + y.toFixed(1) + 'px').join(',') + ')';
      // Bulle et cartouche au milieu de la case, sous le bord penché
      const tl = Math.max(edgeY(q, 0, 1, 0), edgeY(q, 0, 1, w)), bl = Math.min(edgeY(q, 3, 2, 0), edgeY(q, 3, 2, w));
      const lab = p.querySelector('.cbal, .ccap');
      if (who === 'narr') lab.style.top = (edgeY(q, 0, 1, 12) + 10) + 'px'; else lab.style.top = ((tl + bl) / 2) + 'px';
      comicArt(cv, who, T(txt), side, w, h, q);
    };
    dlgQ = () => { i++; if (i < lines.length) { addPanel(); Snd.play('build'); return; } box.hidden = true; page.innerHTML = ''; dlgQ = null; if (G) G.paused = wasPaused; done(); };
    page.innerHTML = ''; box.hidden = false; addPanel();
  });
}
$('#comic').addEventListener('click', () => { if (dlgQ) dlgQ(); });
$('#cmSkip').addEventListener('click', ev => { ev.stopPropagation(); while (dlgQ) dlgQ(); });

// Papi Yglou : crête blanche, lunettes rondes, sourcils en bataille
function drawPapi(c, x, y, s) {
  drawYglou(c, x, y, s, 'happy', 0.4, { noShadow: true, noConfetti: true, crest: '#f4f1ea' });
  const r = s * 0.36, hy = -r * 0.45, hr = r * 0.85, fy = hy - hr * 0.04, ex = hr * 0.44, ew = hr * 0.17;
  c.save(); c.translate(x, y); c.lineWidth = Math.max(1.5, s * 0.025); c.strokeStyle = INK;
  for (const sg of [-1, 1]) { c.beginPath(); c.arc(sg * ex, fy, ew * 1.75, 0, TAU); c.fillStyle = 'rgba(255,255,255,.25)'; c.fill(); c.stroke(); }
  c.beginPath(); c.moveTo(-ex + ew * 1.75, fy); c.quadraticCurveTo(0, fy - ew, ex - ew * 1.75, fy); c.stroke();
  c.fillStyle = '#ffffff'; for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * ex, fy - ew * 2.4, ew * 1.5, ew * 0.55, sg * 0.25, 0, TAU); c.fill(); c.stroke(); }
  c.restore();
}
// Le Roi Gloop : un gros slime couronné (x, y : ses pieds)
function drawKingGloop(c, x, y, s) {
  drawEnemy(c, 'gloop', x, y, s, 0.4, null);
  const r = s * ETYPES.gloop.size, top = y - r * 0.85 - r;
  c.save(); c.translate(x, top + r * 0.12); c.lineJoin = 'round'; crownHat(c, 0, r * 0.95, Math.max(1.5, s * 0.03)); c.restore();
}

// ---------- Carte du monde (parchemin de jeu de rôle, dessiné avec le canvas) ----------
screens.story = $('#sStory');
// Étapes en zigzag, du haut (Prairie) vers le bas (Toundra) ; coordonnées en fraction de la carte
const NODE_POS = [[0.22, 0.09], [0.74, 0.13], [0.36, 0.23], [0.75, 0.31], [0.24, 0.39], [0.73, 0.48], [0.28, 0.57], [0.74, 0.65], [0.27, 0.74], [0.73, 0.82], [0.5, 0.885]];
// Décor de chaque région (centre décalé vers l'extérieur de l'étape)
const REGIONS = [
  { k: 'prairie', at: [0.18, 0.06], c: '#a9da8c' }, { k: 'lac', at: [0.8, 0.1], c: '#8fd0f0' }, { k: 'gemmes', at: [0.42, 0.2], c: '#cdb7ef' },
  { k: 'marais', at: [0.82, 0.3], c: '#86b073' }, { k: 'foret', at: [0.16, 0.38], c: '#73aa63' }, { k: 'ile', at: [0.82, 0.47], c: '#8fd0f0' },
  { k: 'desert', at: [0.2, 0.56], c: '#edd28c' }, { k: 'canyon', at: [0.84, 0.64], c: '#df9a66' }, { k: 'pic', at: [0.17, 0.74], c: '#eef3fa' },
  { k: 'volcan', at: [0.84, 0.82], c: '#b8765a' }, { k: 'toundra', at: [0.5, 0.95], c: '#dff1fb' },
];
function storyRnd(seed) { let h = seed >>> 0; return () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (h >>> 8) / 16777216; }; }
// Une tache de terrain aux bords irréguliers
function blob(c, x, y, rx, ry, col, seed) {
  const r = storyRnd(seed); c.beginPath();
  for (let a = 0; a <= 24; a++) { const t = a / 24 * TAU, k = 0.82 + r() * 0.3; const px = x + Math.cos(t) * rx * k, py = y + Math.sin(t) * ry * k; a ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath(); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(90,58,30,.35)'; c.stroke();
}
const pine = (c, x, y, s, col = '#3f7f4a') => { c.fillStyle = col; c.strokeStyle = '#2a1b3d'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.6, y); c.lineTo(x - s * 0.6, y); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#7a4a2a'; c.fillRect(x - s * 0.1, y, s * 0.2, s * 0.25); };
const bush = (c, x, y, s) => { c.fillStyle = '#5c9a4c'; c.strokeStyle = '#2a1b3d'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); c.stroke(); };
function landmark(c, k, x, y, u) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  if (k === 'prairie') { // la maison de Mamie Mochi et des arbres
    c.fillStyle = '#fff3d6'; c.strokeStyle = '#2a1b3d'; c.lineWidth = 2; c.fillRect(x - u * 0.5, y - u * 0.3, u, u * 0.7); c.strokeRect(x - u * 0.5, y - u * 0.3, u, u * 0.7);
    c.fillStyle = '#e8495e'; c.beginPath(); c.moveTo(x - u * 0.65, y - u * 0.25); c.lineTo(x, y - u * 0.8); c.lineTo(x + u * 0.65, y - u * 0.25); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#8a5a3b'; c.fillRect(x - u * 0.12, y + u * 0.05, u * 0.24, u * 0.35); bush(c, x + u * 1.1, y + u * 0.2, u * 0.32); bush(c, x - u * 1.0, y + u * 0.15, u * 0.26);
  } else if (k === 'lac' || k === 'ile') {
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x - u * 0.6 + i * u * 0.6, y + u * 0.35 + (i % 2) * u * 0.2, u * 0.22, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    if (k === 'ile') { c.fillStyle = '#f2d98f'; c.strokeStyle = '#2a1b3d'; c.beginPath(); c.ellipse(x, y, u * 0.75, u * 0.35, 0, 0, TAU); c.fill(); c.stroke();
      c.strokeStyle = '#7a4a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + u * 0.15, y - u * 0.5, x + u * 0.05, y - u * 0.85); c.stroke();
      c.fillStyle = '#4f9a4a'; for (const a of [-2.6, -1.9, -1.2, -0.5]) { c.beginPath(); c.ellipse(x + u * 0.05 + Math.cos(a) * u * 0.3, y - u * 0.85 + Math.sin(a) * u * 0.12, u * 0.32, u * 0.09, a, 0, TAU); c.fill(); } }
  } else if (k === 'gemmes') {
    for (const [dx, h, col] of [[-0.45, 0.7, '#b06cff'], [0, 1, '#8a4fe0'], [0.45, 0.6, '#c99bff']]) { c.fillStyle = col; c.strokeStyle = '#2a1b3d'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + dx * u, y - h * u); c.lineTo(x + dx * u + u * 0.22, y - h * u * 0.5); c.lineTo(x + dx * u, y); c.lineTo(x + dx * u - u * 0.22, y - h * u * 0.5); c.closePath(); c.fill(); c.stroke(); }
  } else if (k === 'marais') {
    c.fillStyle = '#5f8f5a'; c.beginPath(); c.ellipse(x, y, u * 0.7, u * 0.28, 0, 0, TAU); c.fill(); c.strokeStyle = '#3c6a3a'; c.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const px = x - u * 0.6 + i * u * 0.3; c.beginPath(); c.moveTo(px, y - u * 0.1); c.lineTo(px + u * 0.05, y - u * 0.6); c.stroke(); c.fillStyle = '#8a5a3b'; c.beginPath(); c.ellipse(px + u * 0.05, y - u * 0.6, u * 0.05, u * 0.12, 0, 0, TAU); c.fill(); }
  } else if (k === 'foret') {
    for (const [dx, dy, s2] of [[-0.6, 0.1, 0.55], [0, -0.1, 0.75], [0.6, 0.15, 0.6], [-0.25, 0.45, 0.5], [0.35, 0.5, 0.45]]) pine(c, x + dx * u, y + dy * u, s2 * u);
  } else if (k === 'desert') {
    c.strokeStyle = '#c99a4a'; c.lineWidth = 2.5; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x - u * 0.5 + i * u * 0.55, y + u * 0.3, u * 0.35, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    c.fillStyle = '#5aa356'; c.strokeStyle = '#2a1b3d'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x - u * 0.1, y - u * 0.6, u * 0.2, u * 0.75, u * 0.1); c.fill(); c.stroke(); c.beginPath(); c.roundRect(x - u * 0.35, y - u * 0.35, u * 0.18, u * 0.3, u * 0.09); c.fill(); c.stroke();
  } else if (k === 'canyon') {
    c.fillStyle = '#c4703f'; c.strokeStyle = '#2a1b3d'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - u * 0.8, y + u * 0.3); c.lineTo(x - u * 0.6, y - u * 0.4); c.lineTo(x - u * 0.15, y - u * 0.45); c.lineTo(x, y + u * 0.3); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x + u * 0.15, y + u * 0.3); c.lineTo(x + u * 0.3, y - u * 0.3); c.lineTo(x + u * 0.75, y - u * 0.35); c.lineTo(x + u * 0.85, y + u * 0.3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x + u * 0.05, y - u * 0.95); c.lineTo(x - u * 0.12, y - u * 0.55); c.lineTo(x + u * 0.02, y - u * 0.55); c.lineTo(x - u * 0.1, y - u * 0.2); c.lineTo(x + u * 0.16, y - u * 0.62); c.lineTo(x + u * 0.03, y - u * 0.62); c.closePath(); c.fill(); c.stroke();
  } else if (k === 'pic') {
    c.fillStyle = '#9aa7bd'; c.strokeStyle = '#2a1b3d'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - u * 0.9, y + u * 0.35); c.lineTo(x - u * 0.1, y - u * 0.85); c.lineTo(x + u * 0.8, y + u * 0.35); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - u * 0.38, y - u * 0.43); c.lineTo(x - u * 0.1, y - u * 0.85); c.lineTo(x + u * 0.2, y - u * 0.4); c.lineTo(x + u * 0.02, y - u * 0.48); c.lineTo(x - u * 0.15, y - u * 0.36); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#8a5a3b'; c.fillRect(x + u * 0.35, y + u * 0.02, u * 0.36, u * 0.28); c.strokeRect(x + u * 0.35, y + u * 0.02, u * 0.36, u * 0.28); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x + u * 0.28, y + u * 0.04); c.lineTo(x + u * 0.53, y - u * 0.2); c.lineTo(x + u * 0.78, y + u * 0.04); c.closePath(); c.fill(); c.stroke();
  } else if (k === 'volcan') {
    c.fillStyle = '#7a4a3a'; c.strokeStyle = '#2a1b3d'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - u * 0.85, y + u * 0.35); c.lineTo(x - u * 0.25, y - u * 0.55); c.lineTo(x + u * 0.25, y - u * 0.55); c.lineTo(x + u * 0.85, y + u * 0.35); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ff7a3d'; c.beginPath(); c.moveTo(x - u * 0.25, y - u * 0.55); c.quadraticCurveTo(x - u * 0.15, y - u * 0.2, x - u * 0.3, y + u * 0.05); c.lineTo(x - u * 0.12, y - u * 0.15); c.lineTo(x + u * 0.05, y + u * 0.1); c.quadraticCurveTo(x + u * 0.1, y - u * 0.25, x + u * 0.25, y - u * 0.55); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(120,110,120,.55)'; for (const [dx, dy, r2] of [[0, -0.75, 0.18], [0.15, -0.95, 0.15], [-0.05, -1.12, 0.12]]) { c.beginPath(); c.arc(x + dx * u, y + dy * u, r2 * u, 0, TAU); c.fill(); }
  } else if (k === 'toundra') { // le château de glace du Roi Gloop
    c.fillStyle = '#bfe6f7'; c.strokeStyle = '#2a1b3d'; c.lineWidth = 2;
    c.fillRect(x - u * 0.6, y - u * 0.35, u * 1.2, u * 0.55); c.strokeRect(x - u * 0.6, y - u * 0.35, u * 1.2, u * 0.55);
    for (const dx of [-0.75, 0.45]) { c.fillRect(x + dx * u, y - u * 0.7, u * 0.3, u * 0.9); c.strokeRect(x + dx * u, y - u * 0.7, u * 0.3, u * 0.9); c.beginPath(); c.moveTo(x + dx * u - u * 0.05, y - u * 0.7); c.lineTo(x + dx * u + u * 0.15, y - u * 1.0); c.lineTo(x + dx * u + u * 0.35, y - u * 0.7); c.closePath(); c.fillStyle = '#8fc6e8'; c.fill(); c.stroke(); c.fillStyle = '#bfe6f7'; }
    c.fillStyle = '#5c86b0'; c.beginPath(); c.arc(x, y + u * 0.2, u * 0.16, Math.PI, 0); c.fill(); c.stroke();
    c.strokeStyle = '#2a1b3d'; c.beginPath(); c.moveTo(x, y - u * 0.35); c.lineTo(x, y - u * 0.75); c.stroke(); c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x, y - u * 0.75); c.lineTo(x + u * 0.3, y - u * 0.66); c.lineTo(x, y - u * 0.57); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}
function drawWorldMap(c, W, H, upTo) {
  // Parchemin : fond clair, bords plus foncés, petites taches
  c.fillStyle = '#f2dfb0'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6); g.addColorStop(0, 'rgba(255,248,225,0)'); g.addColorStop(1, 'rgba(150,100,45,.45)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = storyRnd(7); c.fillStyle = 'rgba(140,95,45,.12)'; for (let i = 0; i < 90; i++) { c.beginPath(); c.arc(r() * W, r() * H, 1 + r() * 2.5, 0, TAU); c.fill(); }
  const u = W * 0.085;
  REGIONS.forEach((R, i) => blob(c, R.at[0] * W, R.at[1] * H, u * (R.k === 'toundra' ? 2.4 : 1.7), u * 1.25, R.c, 11 + i * 7));
  REGIONS.forEach(R => landmark(c, R.k, R.at[0] * W, R.at[1] * H, u));
  // Le chemin : des pointillés rouges, façon carte au trésor (plein jusqu'à l'étape en cours)
  const pts = NODE_POS.map(([x, y]) => [x * W, y * H]);
  const trace = (from, to) => { c.beginPath(); c.moveTo(...pts[from]); for (let i = from + 1; i <= to; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; c.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) + (y1 - y0) * 0.1 + 6, x1, y1); } c.stroke(); };
  c.lineCap = 'round'; c.setLineDash([2, 9]); c.lineWidth = 5; c.strokeStyle = '#b0302a'; trace(0, Math.max(0, upTo));
  c.strokeStyle = 'rgba(120,80,40,.5)'; c.lineWidth = 4; if (upTo < pts.length - 1) trace(upTo, pts.length - 1); c.setLineDash([]);
  // Rose des vents
  const cx = W * 0.1, cy = H * 0.965, R2 = W * 0.06; c.save(); c.translate(cx, cy); c.fillStyle = '#5a3a1e';
  for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, -R2); c.lineTo(R2 * 0.22, 0); c.lineTo(-R2 * 0.22, 0); c.closePath(); c.fill(); }
  c.fillStyle = '#f2dfb0'; c.beginPath(); c.arc(0, 0, R2 * 0.15, 0, TAU); c.fill(); c.restore();
  c.font = 'bold ' + Math.round(W * 0.035) + 'px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#5a3a1e'; c.textAlign = 'center'; c.fillText('N', cx, cy - R2 - 3);
}
function openStory() {
  Snd.init(); show('story'); screens.story.scrollTop = 0;
  const done = storyDone(), next = CHAPTERS.findIndex((c, i) => !done[i]), cur = next < 0 ? CHAPTERS.length - 1 : next;
  const all = CHAPTERS.map(c => c.title).concat(STORY_SOON);
  const box = $('#stWorld');
  box.innerHTML = '<canvas class="stmap" id="stMap" aria-hidden="true"></canvas>'
    + all.map((t, i) => {
      const [x, y] = NODE_POS[i] || [0.5, 0.5], ready = i < CHAPTERS.length, st = !ready ? 'soon' : done[i] ? 'done' : i === cur ? 'cur' : i < cur ? 'done' : 'lock';
      return '<button class="stnode ' + st + '" type="button" data-i="' + i + '" style="left:' + x * 100 + '%;top:' + y * 100 + '%" aria-label="' + esc(T(t)) + '">' + (i === all.length - 1 ? '👑' : done[i] ? '✓' : i) + '</button>'
        + '<span class="stlbl" style="left:' + x * 100 + '%;top:calc(' + y * 100 + '% + 25px)">' + esc(T(t)) + '</span>';
    }).join('')
    + '<canvas class="sttok" id="stTok" style="left:' + NODE_POS[cur][0] * 100 + '%;top:' + NODE_POS[cur][1] * 100 + '%"></canvas>';
  // La carte se dessine à la taille de son cadre
  const W = box.clientWidth || 340, H = box.clientHeight || 490;
  drawWorldMap(prepMini($('#stMap'), W, H), W, H, cur);
  const c = prepMini($('#stTok'), 44, 48); drawTower(c, 'feu', 22, 30, 38, 1, 0.4, 0, 0.3, 0, false);
  box.querySelectorAll('.stnode').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    if (i >= CHAPTERS.length) { hint(T('La suite de l’histoire arrive bientôt !'), 2000); return; }
    if (i > cur && !done[i]) { hint(T('Termine d’abord le chapitre ') + cur + ' !', 2000); return; }
    playChapter(i);
  }));
  const ch = CHAPTERS[cur];
  $('#stPlay').textContent = next < 0 ? T('Rejouer un chapitre en touchant la carte') : T('Chapitre ') + cur + ' · ' + T(ch.title) + ' ▸';
  $('#stPlay').disabled = next < 0;
  $('#stPlay').onclick = () => playChapter(cur);
}

// ---------- Un chapitre ----------
async function playChapter(i) {
  const ch = CHAPTERS[i]; Snd.init();
  // Le rêve a sa propre progression : on met la vraie de côté (rendue à la fin, comme après un duel)
  enterDuelMeta();
  for (const t of ch.towers) if (UNLOCK[t]) meta.lv['u_' + t] = 1;
  if (ch.fusion) for (const k in FUSIONS) if (FUSIONS[k].parents.every(p => ch.towers.includes(p))) meta.lv['f_' + k] = 1;
  meta.shards = ch.shards || 0;
  storyRun = { ch: i, towers: ch.towers, waves: ch.waves, events: ch.events || {}, tries: 0 };
  await storySay(ch.intro);
  if (ch.atelier) {
    openShop(); const tab = document.querySelector('[data-tab=mast]'); if (tab) tab.click();
    hint(T('Dépense tes éclats, puis touche « Retour » pour continuer l’aventure.'), 4000);
    STORY.afterShop = () => storyBattle();
    return;
  }
  storyBattle();
}
const STORY = { afterShop: null };
$('#sBack').addEventListener('click', () => { if (STORY.afterShop) { const f = STORY.afterShop; STORY.afterShop = null; setTimeout(f, 0); } });
function storyBattle() {
  const ch = CHAPTERS[storyRun.ch];
  newGame(ch.map, null, 'facile');
  // Un coup de pouce à chaque nouvel essai
  Object.assign(G, { gold: ch.gold + 50 * storyRun.tries, lives: ch.lives, startLives: ch.lives, maxw: ch.waves.length });
  hudCache = {}; refreshPalette();
  banner(T('CHAPITRE ') + storyRun.ch, T(ch.title));
}
// Vagues écrites à la main (appelée par makeWave, js/game.js)
function storyWave(w) {
  const spec = (G.story.waves[w - 1] || G.story.waves[G.story.waves.length - 1]), list = [];
  const gap = Math.max(0.5, 1 - w * 0.04);
  for (const [type, n] of spec) for (let k = 0; k < n; k++) list.push({ type, gap: gap * (type === 'zip' ? 0.55 : type === 'tonk' ? 1.5 : type === 'boss' ? 3 : 1) });
  // On mélange un peu, le boss toujours en dernier
  for (let k = list.length - 1; k > 0; k--) { if (list[k].type === 'boss') continue; const j = Math.floor(Math.random() * (k + 1)); if (list[j].type === 'boss') continue; [list[k], list[j]] = [list[j], list[k]]; }
  list.sort((a, b) => (a.type === 'boss') - (b.type === 'boss'));
  const np = P ? P.portals.length : 1, portals = w <= 1 ? [0] : [...Array(np).keys()];
  const routes = P ? P.paths.map((pa, i) => i).filter(i => portals.includes(P.paths[i].pk || 0)) : [0];
  list.forEach((it, i) => { it.pi = routes[i % routes.length]; });
  return { list, label: spec.some(([t]) => t === 'boss') ? T('Un Kaiju approche...') : '', portals };
}
function storyWaveStart(n) { const ev = G.story.events['start' + n]; if (ev) storySay(ev); }
function storyWaveEnd(n) { const ev = G.story.events['end' + n]; if (ev) storySay(ev); }
function storyLeave() { G = null; storyRun = null; exitDuelMeta(); }
async function storyWin() {
  if (!G || G.over) return;
  G.over = true; G.won = true; Snd.play('win');
  const i = storyRun.ch, ch = CHAPTERS[i];
  await storySay(ch.outro);
  const st = store.get(STORY_KEY) || {}; st.done = st.done || {}; st.done[i] = true; store.set(STORY_KEY, st);
  storyLeave();
  if (ch.final) storyWake(); else openStory();
}
// Le réveil (après le Roi Gloop) : récompense, puis la vraie aventure (la campagne)
async function storyWake() {
  show('wake'); screens.wake.scrollTop = 0;
  const c = prepMini($('#wkBed'), 220, 150); drawBed(c);
  await storySay(WAKE_LINES);
  // Récompense, dans la vraie progression (rendue juste avant) : un trophée et le bonnet de nuit d'Yglou
  if (typeof wear === 'function' && !wear().own.includes('hat:nightcap')) { wear().own.push('hat:nightcap'); saveMeta(); }
  if (typeof trophy === 'function') trophy('story_end');
  $('#wkReward').hidden = false;
}
function drawBed(c) {
  c.fillStyle = '#8a5a3b'; c.strokeStyle = INK; c.lineWidth = 3;
  c.beginPath(); c.roundRect(20, 78, 180, 54, 10); c.fill(); c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(28, 68, 52, 24, 10); c.fill(); c.stroke();
  drawTower(c, 'feu', 64, 86, 74, 1, 0.4, 0, 0.3, 0, true);
  c.beginPath(); c.roundRect(78, 88, 116, 38, 9); c.fillStyle = '#ff9ec0'; c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(94 + k * 22, 107, 4, 0, TAU); c.fill(); }
  c.font = '24px Bangers, Impact, sans-serif'; c.fillStyle = '#ffffff'; c.fillText('Z', 108, 46); c.font = '18px Bangers, Impact, sans-serif'; c.fillText('z', 128, 32); c.fillText('z', 142, 20);
}
screens.wake = $('#sWake');
$('#wkGo').addEventListener('click', () => { Snd.init(); renderMaps(); show('maps'); screens.maps.scrollTop = 0; });
async function storyLose() {
  if (!G || G.over) return;
  G.over = true; G.lives = 0; Snd.play('ko');
  await storySay(LOSE_LINES);
  storyRun.tries++;
  storyBattle();
}
function storyAbort() { storyLeave(); openStory(); }
$('#tStory').addEventListener('click', openStory);
$('#stBack').addEventListener('click', () => show('title'));
