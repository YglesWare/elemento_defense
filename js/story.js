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
      ['yglou', 'Il était une fois, dans la Prairie Mochi, une petite flamme nommée Braise.'],
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
      ['yglou', 'Au bord du lac, quelqu’un appelle à l’aide…'],
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
      ['yglou', 'Sur le chemin, quelque chose brille dans l’herbe…'],
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
      ['yglou', 'Dans le marais, des Tonk casqués avancent en rang…'],
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
      ['yglou', 'À la sortie de la forêt, le sol se met à trembler…'],
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
];
// Les chapitres à venir (la suite de l'histoire arrive dans une prochaine version)
const STORY_SOON = ['Le vent de Zéphyr', 'Le désert brûlant', 'Le canyon de Voltie', 'Le Grand Sage', 'Le choix du chemin', 'Le Roi Gloop'];
const LOSE_LINES = [['yglou', 'Aïe, les slimes sont passés ! Pas grave : on réessaie, avec un peu plus d’or.']];

// ---------- Dialogues (portraits dessinés avec les vrais personnages du jeu) ----------
const STORY_NAMES = { feu: 'Braise', eau: 'Ondine', terre: 'Rocaille', vent: 'Zéphyr', foudre: 'Voltie', glace: 'Givrette', yglou: 'Yglou' };
function drawPortrait(cv, who) {
  const c = prepMini(cv, 72, 72);
  if (who === 'yglou') drawYglou(c, 36, 50, 60, 'happy', 0.4, { noShadow: true, noConfetti: true });
  else drawTower(c, who, 36, 46, 60, 1, 0.4, 0, 0.3, 0, false);
}
let dlgQ = null;
function storySay(lines) {
  return new Promise(done => {
    if (!lines || !lines.length) { done(); return; }
    const wasPaused = G ? G.paused : false; if (G) G.paused = true;
    let i = 0;
    const box = $('#dlg'), paint = () => {
      const [who, txt] = lines[i];
      box.classList.toggle('right', who === 'feu');
      drawPortrait($('#dlgAv'), who);
      $('#dlgName').textContent = T(STORY_NAMES[who] || who);
      $('#dlgText').textContent = T(txt);
    };
    dlgQ = () => { i++; if (i < lines.length) { paint(); Snd.play('build'); return; } box.hidden = true; dlgQ = null; if (G) G.paused = wasPaused; done(); };
    box.hidden = false; paint();
  });
}
$('#dlg').addEventListener('click', () => { if (dlgQ) dlgQ(); });
$('#dlgSkip').addEventListener('click', ev => { ev.stopPropagation(); while (dlgQ) dlgQ(); });

// ---------- Carte du monde ----------
screens.story = $('#sStory');
// 11 étapes en zigzag du haut (Prairie) vers le bas (Toundra)
const NODE_POS = [[20, 6], [66, 12], [36, 21], [70, 29], [28, 37], [64, 45], [30, 53], [68, 61], [34, 69], [66, 77], [50, 88]];
function openStory() {
  Snd.init(); show('story'); screens.story.scrollTop = 0;
  const done = storyDone(), next = CHAPTERS.findIndex((c, i) => !done[i]), cur = next < 0 ? CHAPTERS.length - 1 : next;
  const all = CHAPTERS.map(c => c.title).concat(STORY_SOON);
  const box = $('#stWorld');
  box.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + NODE_POS.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ') + '" fill="none" stroke="#2a1b3d" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="' + NODE_POS.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ') + '" fill="none" stroke="#f3dfae" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    + all.map((t, i) => {
      const [x, y] = NODE_POS[i] || [50, 50], ready = i < CHAPTERS.length, st = !ready ? 'soon' : done[i] ? 'done' : i === cur ? 'cur' : i < cur ? 'done' : 'lock';
      return '<button class="stnode ' + st + '" type="button" data-i="' + i + '" style="left:' + x + '%;top:' + y + '%" aria-label="' + esc(T(t)) + '">' + (i === all.length - 1 ? '👑' : i) + '</button>'
        + '<span class="stlbl" style="left:' + x + '%;top:calc(' + y + '% ' + '+ 20px' + ')">' + esc(T(t)) + '</span>';
    }).join('')
    + '<canvas class="sttok" id="stTok" style="left:' + NODE_POS[cur][0] + '%;top:' + NODE_POS[cur][1] + '%"></canvas>';
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
  storyLeave(); openStory();
}
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
