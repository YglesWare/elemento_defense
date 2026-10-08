// Élémento Defense : trophées (exploits visibles) et easter eggs (trophées cachés, « ??? » tant qu'ils ne sont pas trouvés).
// Chaque trophée rapporte quelques éclats, versés dès qu'on n'est plus dans une partie multijoueur.
'use strict';

const TROPHY_KEY = 'elemento.trophies';
// Secrets des cartes : la décoration à toucher 5 fois sur chaque carte
const MAP_EGGS = { prairie: 'champi', plage: 'etoile', marais: 'buisson', foret: 'fleur', desert: 'roche', ile: 'coquillage', canyon: 'roche', volcan: 'cristal', pic: 'sapinet', toundra: 'flocon' };
// Indices des secrets de carte : vagues exprès
const MAP_HINTS = { prairie: T('Un champignon de la Prairie est un peu magique.'), plage: T('Une étoile est tombée sur la plage.'), marais: T('Un buisson du marais frémit.'), foret: T('Une fleur de la forêt aime les caresses.'), desert: T('Un rocher du désert sonne creux.'), ile: T('Un coquillage de l’île chante.'), canyon: T('Une pierre du canyon cache quelque chose.'), volcan: T('Un cristal du volcan scintille.'), pic: T('Un petit sapin du Pic a froid.'), toundra: T('Un flocon de la toundra est unique.') };
const TROPHIES = [
  { id: 'first_win', icon: '🏁', name: T('Première victoire'), desc: T('Gagner une partie solo.'), r: 2 },
  { id: 'win_moyen', icon: '🥈', name: T('Ça se corse'), desc: T('Gagner une partie en Moyen.'), r: 5 },
  { id: 'win_diff', icon: '🥇', name: T('Sans peur'), desc: T('Gagner une partie en Difficile.'), r: 10 },
  { id: 'all_easy', icon: '🗺️', name: T('Grand voyageur'), desc: T('Gagner les 10 cartes en Facile.'), r: 10 },
  { id: 'all_moyen', icon: '🧭', name: T('Explorateur aguerri'), desc: T('Gagner les 10 cartes en Moyen.'), r: 15 },
  { id: 'all_diff', icon: '👑', name: T('Légende élémentaire'), desc: T('Gagner les 10 cartes en Difficile.'), r: 15 },
  { id: 'flawless', icon: '💎', name: T('Sans une égratignure'), desc: T('Gagner une partie sans perdre une seule vie.'), r: 8 },
  { id: 'boss1', icon: '🐲', name: T('Chasseur de boss'), desc: T('Vaincre un boss.'), r: 2 },
  { id: 'bosses_all', icon: '🏆', name: T('Bestiaire complet'), desc: T('Vaincre le boss de chacune des 10 cartes.'), r: 15 },
  { id: 'kills_1k', icon: '⚔️', name: T('Mille slimes'), desc: T('Vaincre 1 000 ennemis.'), r: 5 },
  { id: 'kills_10k', icon: '🗡️', name: T('Fléau des slimes'), desc: T('Vaincre 10 000 ennemis.'), r: 12 },
  { id: 'towers_100', icon: '🏗️', name: T('Bâtisseur'), desc: T('Poser 100 tours.'), r: 5 },
  { id: 'first_fusion', icon: '⚗️', name: T('Alchimiste'), desc: T('Réussir une fusion.'), r: 2 },
  { id: 'all_fusions', icon: '🧪', name: T('Grand alchimiste'), desc: T('Débloquer toutes les fusions.'), r: 10 },
  { id: 'all_maps', icon: '📜', name: T('Propriétaire'), desc: T('Posséder les 10 cartes.'), r: 10 },
  { id: 'inf_30', icon: '♾️', name: T('Endurant'), desc: T('Atteindre la vague 30 en Infini.'), r: 5 },
  { id: 'inf_50', icon: '🌀', name: T('Inarrêtable'), desc: T('Atteindre la vague 50 en Infini.'), r: 12 },
  { id: 'random_win', icon: '🎲', name: T('Coup de dés'), desc: T('Gagner une carte aléatoire.'), r: 5 },
  { id: 'event_win', icon: '🎉', name: T('Jour de fête'), desc: T('Gagner une carte d’événement.'), r: 5 },
  { id: 'coop_win', icon: '🤝', name: T('Main dans la main'), desc: T('Gagner une partie en coop.'), r: 5 },
  { id: 'duel_win', icon: '⚡', name: T('Dernier debout'), desc: T('Gagner un duel.'), r: 5 },
  { id: 'bonus_use', icon: '🎁', name: T('Coup de pouce'), desc: T('Utiliser un bonus pendant une partie.'), r: 2 },
  { id: 'time_5h', icon: '⏳', name: T('Passionné'), desc: T('Jouer 5 heures.'), r: 8 },
  { id: 'daily_7', icon: '📅', name: T('Fidèle au poste'), desc: T('Réussir la carte du jour 7 jours différents.'), r: 8 },
  { id: 'rich', icon: '🐷', name: T('Tirelire pleine'), desc: T('Avoir 5 000 or dans la cagnotte.'), r: 5 },
  // Piments (js/challenge.js)
  { id: 'pim_x2', icon: '🥇', name: T('Ça pique !'), desc: T('Gagner une carte avec un piment ×2 ou plus (médaille d’or).'), r: 5 },
  { id: 'pim_gold5', icon: '🏅', name: T('Collection d’or'), desc: T('Avoir la médaille d’or sur 5 cartes.'), r: 10 },
  { id: 'pim_mono', icon: '🎨', name: T('Monochrome'), desc: T('Gagner une carte avec un seul élément.'), r: 5 },
  { id: 'pim_mono6', icon: '🌈', name: T('Arc-en-ciel'), desc: T('Gagner en Monochrome avec chacun des 6 éléments.'), r: 12 },
  { id: 'pim_surprise', icon: '🎲', name: T('Surprise !'), desc: T('Gagner avec un piment surprise.'), r: 3 },
  { id: 'pim_week', icon: '📅', name: T('Piment de la semaine'), desc: T('Gagner le piment de la semaine.'), r: 5 },
  { id: 'pim_event', icon: '🎉', name: T('Fête pimentée'), desc: T('Gagner une carte d’événement avec son piment d’événement.'), r: 5 },
  // Easter eggs
  { id: 'egg_yglou', icon: '🦅', name: T('Kiiaaa !'), desc: T('Toucher Yglou 10 fois sur l’accueil.'), r: 5, hidden: true, hint: T('Yglou adore qu’on s’occupe de lui…') },
  { id: 'egg_house', icon: '🏠', name: T('Maison chatouilleuse'), desc: T('Toucher 10 fois la maison pendant une partie.'), r: 5, hidden: true, hint: T('Même une maison peut être chatouilleuse.') },
  { id: 'egg_logo', icon: '✨', name: T('Logo en folie'), desc: T('Toucher 7 fois le logo de l’accueil.'), r: 5, hidden: true, hint: T('Le titre a du ressort.') },
  { id: 'story_end', icon: '🌙', name: T('Doux rêveur'), desc: T('Finir le mode histoire « La flamme de Braise ».'), r: 10 },
  { id: 'egg_ygles', icon: '🧑‍🎨', name: T('Bonjour, créateur !'), desc: T('Prendre « Ygles » comme pseudo.'), r: 5, hidden: true, hint: T('Le créateur a un nom… et un bec.') },
  { id: 'egg_night', icon: '🌙', name: T('Oiseau de nuit'), desc: T('Lancer une partie entre minuit et 5 h.'), r: 5, hidden: true, hint: T('Les hiboux jouent tard.') },
  { id: 'egg_close', icon: '😅', name: T('Sur le fil'), desc: T('Gagner une partie avec une seule vie.'), r: 5, hidden: true, hint: T('Gagner de justesse a du charme.') },
  { id: 'egg_regret', icon: '🙃', name: T('Finalement non'), desc: T('Revendre une tour juste après l’avoir posée.'), r: 5, hidden: true, hint: T('Tout le monde peut changer d’avis.') },
  { id: 'egg_fire', icon: '🔥', name: T('Tout feu tout flamme'), desc: T('Avoir 10 ennemis en feu en même temps.'), r: 5, hidden: true, hint: T('Que ça brûle de partout !') },
  { id: 'egg_konami', icon: '🎮', name: T('Code secret'), desc: T('Le code Konami : au clavier, ou en glissant le doigt sur l’accueil (puis B à gauche, A à droite).'), r: 5, hidden: true, hint: T('Haut, haut… un vieux code de joueur.') },
  { id: 'egg_fog_swipe', icon: '🌫️', name: T('Coup de balai'), desc: T('Chasser le brouillard en le balayant du doigt.'), r: 5, hidden: true, hint: T('La brume n’aime pas qu’on la dérange.') },
  { id: 'egg_blow', icon: '🌬️', name: T('Grand souffle'), desc: T('Souffler sur le téléphone pour chasser le brouillard.'), r: 5, hidden: true, hint: T('Un petit souffle, et pfiou !') },
  { id: 'egg_tilt', icon: '🌪️', name: T('Maître du vent'), desc: T('Pencher le téléphone pendant une tempête pour orienter le vent.'), r: 5, hidden: true, hint: T('Quand la tempête souffle, penche-toi.') },
  { id: 'egg_shake', icon: '🌋', name: T('Tremblement de terre'), desc: T('Secouer le téléphone pendant une vague.'), r: 5, hidden: true, hint: T('Secoue-toi, la terre tremblera.') },
  { id: 'egg_rub', icon: '🔥', name: T('Chauffe, Marcel !'), desc: T('Frotter l’écran pendant un blizzard pour réchauffer les tours.'), r: 5, hidden: true, hint: T('Le froid ? Frotte-toi les mains !') },
  ...Object.entries(MAP_EGGS).map(([m, d]) => ({ id: 'map_' + m, icon: '🔍', name: T('Secret de la carte ') + (MAPS.find(x => x.id === m) || {}).name, desc: T('Toucher 5 fois une décoration cachée de la carte.'), r: 5, hidden: true, hint: MAP_HINTS[m], map: m, deco: d })),
];
const trophyData = () => store.get(TROPHY_KEY) || {};
const trophyHas = id => !!trophyData()[id];
// Pas de trophée pendant le tutoriel animé ni dans l'outil d'équilibrage
const trophyOff = () => (window.parent !== window && window.parent.BALANCE) || (G && (G.demo || G.story));

function trophy(id) {
  if (trophyOff()) return;
  const T0 = TROPHIES.find(t => t.id === id), data = trophyData(); if (!T0 || data[id]) return;
  data[id] = { at: Date.now(), paid: false }; store.set(TROPHY_KEY, data);
  trophyPay(); trophyToast(T0);
}
// Récompenses en éclats (en multijoueur, la progression est mise de côté : on paie au retour)
function trophyPay() {
  if (duelOn) return;
  const data = trophyData(); let gain = 0;
  for (const id in data) if (!data[id].paid) { const T0 = TROPHIES.find(t => t.id === id); data[id].paid = true; gain += T0 ? T0.r : 0; }
  if (!gain) return;
  store.set(TROPHY_KEY, data); meta.shards += gain; meta.earned = (meta.earned || 0) + gain; saveMeta();
}
const TQ = [];
function trophyToast(T0) {
  TQ.push(T0); if (TQ.length > 1) return;
  const next = () => {
    const t = TQ[0]; if (!t) return;
    const el = $('#trophyToast');
    el.innerHTML = '<span class="tt-ico">' + t.icon + '</span><span class="tt-txt"><small>' + (t.hidden ? T('Trophée secret !') : T('Trophée débloqué !')) + '</small><b>' + t.name + '</b></span><span class="tt-r">' + GEM + t.r + '</span>';
    el.hidden = false; el.classList.remove('out'); try { Snd.play('win'); } catch (e) {}
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; TQ.shift(); next(); }, 350); }, 3200);
  };
  next();
}

// Vérifications d'ensemble : statistiques, cartes, fusions, cagnotte (à la fin des vagues, sur l'accueil…)
function trophyScan() {
  if (trophyOff() || duelOn) return;
  if (stats.kills >= 1000) trophy('kills_1k');
  if (stats.kills >= 10000) trophy('kills_10k');
  if (stats.towers >= 100) trophy('towers_100');
  if (stats.time >= 5 * 3600) trophy('time_5h');
  if ((meta.bank || 0) >= 5000) trophy('rich');
  const prog = MAPS.map((m, i) => i).filter(i => MAPS[i].prog);
  if (prog.every(mapOwned)) trophy('all_maps');
  if (Object.keys(FUSIONS).every(fusionUnlocked)) trophy('all_fusions');
  const best = store.get(BEST2) || {}, wonAll = k => prog.every(i => (best[recId(MAPS[i])] || {})[k] && best[recId(MAPS[i])][k].won);
  if (wonAll('facile')) trophy('all_easy');
  if (wonAll('moyen')) trophy('all_moyen');
  if (wonAll('difficile')) trophy('all_diff');
}
// Fin de partie solo gagnée
function trophyWin() {
  if (!G || G.coop || G.duel) return;
  const m = MAPS[G.map];
  trophy('first_win');
  if (G.diff === 'moyen') trophy('win_moyen');
  if (G.diff === 'difficile') trophy('win_diff');
  if (G.lives >= G.startLives) trophy('flawless');
  if (G.lives === 1) trophy('egg_close');
  if (m.random) trophy('random_win');
  if (m.season) trophy('event_win');
  trophyScan();
}
// Cartes du jour réussies, tous jours confondus
function trophyDaily() { const n = Object.values(store.get('elemento.daily') || {}).filter(d => Object.values(d).some(x => x && x.won)).length; if (n >= 7) trophy('daily_7'); }
// Boss vaincu : on retient sur quelles cartes
function trophyBoss() {
  if (!G || G.coopGuest || trophyOff()) return;
  trophy('boss1');
  const m = MAPS[G.map]; if (!m.prog) return;
  const data = trophyData(), maps = new Set(data._bossMaps || []); maps.add(m.id); data._bossMaps = [...maps]; store.set(TROPHY_KEY, data);
  if (MAPS.filter(x => x.prog).every(x => maps.has(x.id))) trophy('bosses_all');
}

// ---------- Easter eggs ----------
// Sur la carte : la maison et la décoration secrète (appelé quand on touche une case sans rien construire)
function trophyTap(q, r) {
  if (!G || G.duel || G.coop || trophyOff()) return;
  const k = q + ',' + r;
  if (P.bases.some(b => Math.floor(b[0] / L.cw) === q && Math.floor(b[1] / L.cw) === r)) {
    G.houseTaps = (G.houseTaps || 0) + 1; G.baseHit = 0.15;
    if (G.houseTaps === 10) { const [x, y] = cellW(q, r); burst(x, y, 0.5, 16, ['#ff4f6e', '#ffffff', '#ffd23f'], 2.4, 0.08, 2, 0.7, 'star'); ono(T('HIHI !'), x, y, '#ff4f81', 0.5, 0, 1); trophy('egg_house'); }
    return;
  }
  const m = MAPS[G.map], egg = MAP_EGGS[m.id]; if (!egg || !m.prog) return;
  const d = G.deco.find(x => x.c === q && x.r === r && x.type === egg); if (!d) return;
  G.eggTaps = G.eggTaps || {}; G.eggTaps[k] = (G.eggTaps[k] || 0) + 1;
  const [x, y] = cellW(q, r); burst(x, y, 0.2, 5, ['#ffffff', '#ffd23f'], 1.6, 0.06, 2, 0.4, 'star');
  if (G.eggTaps[k] === 5) { burst(x, y, 0.3, 24, ['#ffd23f', '#ffffff', '#ff6ad5'], 3, 0.1, 2, 0.8, 'star'); ono(T('SECRET !'), x, y, '#ff6ad5', 0.6, 0, 1.1); trophy('map_' + m.id); }
}
// Logo de l'accueil
let logoTaps = 0;
$('#sTitle .logo').addEventListener('click', () => {
  const el = $('#sTitle .logo'); el.classList.remove('wob'); void el.offsetWidth; el.classList.add('wob');
  if (++logoTaps === 7) trophy('egg_logo');
});
// Pseudo du créateur : le trouver donne le trophée, mais « Ygles » lui est réservé (variantes comprises : YGLES, Ygl3s, Y g l e s…).
// Peuvent le porter : ses appareils, reconnus à leur identifiant de progression (Profil → Compte en ligne), et tout appareil
// où il est connecté avec un compte administrateur (vérifié par Supabase, js/cloud.js flagsLoad)
const CREATOR_IDS = ['7D08-EE30'];
const pidShortOf = id => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase().replace(/(.{4})(.{4})/, '$1-$2');
const isCreator = () => CREATOR_IDS.includes(pidShortOf(store.get('elemento.playerId'))) || store.get('elemento.creator') === true;
const reservedName = n => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/3/g, 'e').replace(/[1!|]/g, 'l').replace(/[^a-z]/g, '') === 'ygles';
const trophyName = n => { if (reservedName(n)) trophy('egg_ygles'); };
// Rend un pseudo utilisable : le pseudo réservé redevient « fallback » (le pseudo d'avant), avec le trophée en cadeau
function pseudoGuard(n, fallback) {
  if (!reservedName(n) || isCreator()) return n;
  trophy('egg_ygles');
  return fallback && !reservedName(fallback) ? fallback : randomPseudo();
}
let namePrev = null;
$('#prName').addEventListener('focus', ev => { namePrev = store.get('elemento.pseudo') || ''; });
$('#prName').addEventListener('input', ev => {
  const v = ev.target.value, ok = pseudoGuard(v, namePrev);
  if (ok === v) return;
  ev.target.value = ok; store.set('elemento.pseudo', ok); refreshProfileChip();
  const w = $('#prNameRes'); w.hidden = false; clearTimeout(w._t); w._t = setTimeout(() => { w.hidden = true; }, 5000);
});
// Code Konami : ↑ ↑ ↓ ↓ ← → ← → B A, au clavier ; sur l'écran d'accueil d'un téléphone, les flèches sont
// des glissés du doigt, B un toucher sur la moitié gauche de l'écran et A un toucher sur la moitié droite
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiAt = 0;
function konamiKey(k) { konamiAt = k === KONAMI[konamiAt] ? konamiAt + 1 : k === KONAMI[0] ? 1 : 0; if (konamiAt === KONAMI.length) { konamiAt = 0; trophy('egg_konami'); } }
document.addEventListener('keydown', ev => konamiKey(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key));
// Événements tactiles (et non pointeur) : touchend arrive même quand le navigateur prend le glissé pour un défilement
let swipe0 = null;
$('#sTitle').addEventListener('touchstart', ev => { const p = ev.changedTouches[0]; swipe0 = ev.touches.length === 1 ? { x: p.clientX, y: p.clientY } : null; }, { passive: true });
$('#sTitle').addEventListener('touchend', ev => {
  if (!swipe0) return;
  const p = ev.changedTouches[0], dx = p.clientX - swipe0.x, dy = p.clientY - swipe0.y, ax = Math.abs(dx), ay = Math.abs(dy); swipe0 = null;
  if (ax < 15 && ay < 15) konamiKey(p.clientX < innerWidth / 2 ? 'b' : 'a');
  else if (Math.max(ax, ay) > 40) konamiKey(ax > ay ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'));
}, { passive: true });
// Dix ennemis en feu en même temps (vérifié chaque seconde)
setInterval(() => { if (G && !G.over && !G.demo && G.enemies.filter(e => !e.dead && e.burnT > 0).length >= 10) trophy('egg_fire'); }, 1000);

// ---------- Page des trophées (depuis le Profil) ----------
screens.trophies = $('#sTrophies');
function openTrophies() {
  const data = trophyData(), list = $('#trList'), got = TROPHIES.filter(t => data[t.id]).length;
  $('#trCount').textContent = got + ' / ' + TROPHIES.length;
  list.innerHTML = TROPHIES.map(t => {
    const ok = !!data[t.id], secret = t.hidden && !ok;
    return '<li class="tr' + (ok ? ' ok' : '') + (secret ? ' secret' : '') + '"><span class="tr-ico">' + (secret ? '❔' : t.icon) + '</span><span class="tr-txt"><b>' + (secret ? '???' : t.name) + '</b><span>' + (secret ? '💡 ' + (t.hint || T('Trophée caché : à toi de le trouver !')) : t.desc) + '</span></span><span class="tr-r">' + (ok ? '✓' : GEM + t.r) + '</span></li>';
  }).join('');
  show('trophies'); screens.trophies.scrollTop = 0;
}
function refreshTrophyBtn() { const b = $('#prTrSub'); if (b) b.textContent = TROPHIES.filter(t => trophyData()[t.id]).length + ' / ' + TROPHIES.length; }
$('#prTrophies').addEventListener('click', () => { Snd.init(); openTrophies(); });
$('#trBack').addEventListener('click', () => { refreshTrophyBtn(); show('profile'); });
document.addEventListener('keydown', ev => { if (curScreen === 'trophies' && ev.key === 'Escape') { refreshTrophyBtn(); show('profile'); } });

// Au démarrage : l'ancien secret d'Yglou devient un trophée, le pseudo est vérifié, les récompenses en attente sont versées
if (store.get(EGG_KEY) && !trophyHas('egg_yglou')) { const d = trophyData(); d.egg_yglou = { at: Date.now(), paid: true }; store.set(TROPHY_KEY, d); }
{ const n = store.get('elemento.pseudo'), ok = pseudoGuard(n, null); if (ok !== n) { store.set('elemento.pseudo', ok); refreshProfileChip(); } }
trophyPay(); trophyScan(); refreshTrophyBtn();
