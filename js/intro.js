// Élémento Defense : fenêtres d'explication, une seule fois par joueur et en solo, avec le jeu en pause :
// la première apparition de chaque monstre, et la première tour attaquée (règles du Difficile à part).
'use strict';

const INTRO_KEY = 'elemento.intro';
// Monstres de base : ce qu'il fait et comment le contrer (les monstres d'événement gardent leur description)
const MOB_TIPS = {
  gloop: T('Le slime de base : lent et sans pouvoir. Une Braise ou une Ondine en vient facilement à bout.'),
  zip: T('Minuscule et très rapide : il file entre les tirs. Les ralentissements d’Ondine et de Givrette l’arrêtent net.'),
  flappy: T('Il vole au-dessus du chemin : Rocaille ne peut pas l’atteindre. Zéphyr lui fait 2,5 fois plus de dégâts.'),
  tonk: T('Casqué : son armure retire des dégâts à chaque coup. Les gros coups (Rocaille, tours améliorées) marchent mieux que les tirs rapides.'),
  magma: T('Immunisé au feu : Braise ne lui fait rien. Mise sur l’eau, la terre, l’éclair ou la glace.'),
  gresil: T('Il paralyse les tours proches quelques secondes. Élimine-le vite, avant qu’il n’atteigne tes défenses.'),
  crachou: T('Il crache sur les tours et leur fait perdre des PV. Une tour abîmée tire toujours, mais à 0 PV elle tombe.'),
  malefik: T('Il pervertit une tour : pendant un moment, elle attaque tes autres tours. Garde des tours loin les unes des autres.'),
  boss: T('Le boss des vagues 10, 20 et 30 : énormément de PV, et ses coups de patte abîment les tours proches. Concentre toutes tes tours sur lui.'),
  soignou: T('Un monstre d’élite : toutes les 3 secondes, il soigne les slimes autour de lui. Abats-le en premier, sinon la vague ne faiblit pas.'),
  bulle: T('Un monstre d’élite protégé par une bulle : elle encaisse les coups avant ses PV. Le feu de Braise et l’éclair de Voltie l’éclatent deux fois plus vite.'),
  scindo: T('Un monstre d’élite costaud : quand il tombe, il se divise en trois Gloops. Garde une tour de zone (Ondine, Rocaille) juste derrière lui.'),
  taupe: T('Toutes les 4 secondes, il creuse sous terre : pendant 1,5 seconde, aucune tour ne peut le toucher et il avance plus vite. Place des tours tout le long du chemin.'),
  voleur: T('Rapide et fragile. À la maison, il ne prend pas de vie : il vole 10 % de ton or, puis repart du portail, jusqu’à 3 fois. L’or volé ne revient pas !'),
  aimant: T('Les tours à cible unique qui l’ont à portée tirent sur lui en priorité : il protège les slimes qui le suivent. Les tours de zone (Ondine, Rocaille, Givrette) touchent tout le monde.'),
  givre: T('Le froid ne lui fait rien (ni ralenti, ni gelé), et les tours à moins de 2 cases de lui tirent 30 % moins vite. Mise sur Braise et Voltie, un peu en retrait.'),
  pilleur: T('Comme Chipeur, mais il vole des éclats gagnés pendant la partie, puis repart du portail, jusqu’à 3 fois. Les éclats volés ne reviennent pas !'),
};
const introSeen = () => store.get(INTRO_KEY) || {};
// Pas en multijoueur (ça mettrait les autres en pause), ni dans le tutoriel guidé, l'animation de démo ou l'outil d'équilibrage
const introOk = () => G && !G.demo && !G.duel && !G.coop && !G.guide && !G.story && !(window.parent !== window && window.parent.BALANCE);
const INTRO = { q: [], open: null };

function introPush(key, item) {
  const seen = introSeen();
  if (!introOk() || seen[key] || INTRO.q.some(x => x.key === key) || (INTRO.open && INTRO.open.key === key)) return;
  seen[key] = 1; store.set(INTRO_KEY, seen);
  INTRO.q.push({ key, ...item });
  // Pause d'avant la première fenêtre (les suivantes s'enchaînent sans la changer)
  if (!INTRO.open) { INTRO.wasPaused = !!G.paused; introNext(); }
}
// Première apparition d'un monstre
function introMob(type) {
  const D = ETYPES[type]; if (!D) return;
  // Nouveau dans le bestiaire (js/bestiary.js) : 2 éclats, une seule fois par monstre
  const fresh = !introSeen()['mob_' + type] && introOk();
  introPush('mob_' + type, { kind: 'mob', type, title: eName(type), text: MOB_TIPS[type] || D.desc, tip: fresh ? T('📖 Nouveau dans ton bestiaire : +2 éclats') : '' });
  if (fresh) { meta.shards += 2; meta.earned = (meta.earned || 0) + 2; saveMeta(); }
}
// Première tour attaquée (Facile, Moyen, Infini) et, à part, la première en Difficile
function introTower(t) {
  if (hardMode()) introPush('towerHard', { kind: 'tower', tower: t.type, title: T('Tes tours en danger !'), text: T('En Difficile, une tour à 0 PV est détruite : elle laisse des ruines et sa case ne peut plus accueillir de tour. Ses PV ne reviennent plus tout seuls à la fin de la vague.'),
    tip: T('Pour la soigner, touche-la puis « Soigner » : ça coûte de l’or. Pendant une vague, elle regagne aussi un peu de PV chaque seconde, et un même ennemi ne peut l’attaquer qu’une fois.') });
  else introPush('tower', { kind: 'tower', tower: t.type, title: T('Une tour est attaquée !'), text: T('Certains ennemis abîment les tours : surveille la barre de PV sous chacune. À 0 PV, la tour est K.O. 8 secondes, puis repart avec la moitié de ses PV.'),
    tip: T('Elle se soigne entièrement toute seule à la fin de chaque vague. Le Bouclier et les Remparts de l’Atelier la protègent mieux.') });
}
function introNext() {
  const it = INTRO.q.shift(); if (!it || !G || G.over) { INTRO.open = null; return; }
  INTRO.open = it; G.paused = true;
  const box = $('#intro');
  $('#introTitle').textContent = it.title;
  $('#introText').textContent = it.text;
  $('#introTip').textContent = it.tip || ''; $('#introTip').hidden = !it.tip;
  $('#introTag').textContent = it.kind === 'mob' ? T('Nouveau monstre') : T('Attention');
  box.hidden = false;
  const c = prepMini($('#introCv'), 96, 96);
  if (it.kind === 'mob') drawEnemy(c, it.type, 48, 84, it.type === 'boss' ? 74 : 84, 0.6, null);
  else drawTower(c, it.tower, 48, 56, 70, 1, 0.5, 0, 0.3, 0, false);
  const yc = prepMini($('#introYg'), 56, 56); drawYglou(yc, 28, 33, 48, it.kind === 'mob' ? 'shock' : 'wink', 0, { noShadow: true, noConfetti: true });
  $('#introOk').focus({ preventScroll: true });
}
function introClose() {
  if (!INTRO.open) return;
  $('#intro').hidden = true; INTRO.open = null;
  if (G && !INTRO.q.length) G.paused = !!INTRO.wasPaused;
  if (INTRO.q.length) introNext();
}
$('#introOk').addEventListener('click', () => { Snd.init(); introClose(); });
// Échap (et le bouton retour d'Android) ferme la fenêtre avant tout le reste
document.addEventListener('keydown', ev => { if (INTRO.open && (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); ev.stopImmediatePropagation(); introClose(); } }, true);
