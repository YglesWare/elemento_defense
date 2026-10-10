// Élémento Defense : les monstres arrivent carte après carte (Facile), et le joueur est prévenu de ceux qu'il ne
// connaît pas. En Facile, chaque carte de l'aventure ajoute un monstre (dès la vague 5) ; un monstre pas encore
// introduit est remplacé par un monstre déjà vu (jamais par le Kaiju). Moyen, Difficile, Infini : tous les monstres,
// mais ceux jamais rencontrés sont présentés au départ, puis annoncés une vague avant leur arrivée.
'use strict';

// Le monstre ajouté par chaque carte de l'aventure (dans l'ordre) ; Gloop, Zippy et le Kaiju sont là dès la carte 1
const MOB_ORDER = ['', 'flappy', 'tonk', 'magma', 'gresil', 'crachou', 'malefik', 'soignou', 'bulle', 'scindo', 'taupe', 'voleur', 'aimant', 'givre', 'pilleur'];
// Les élites (cartes 8 à 10) et les monstres du chapitre 2 (cartes 11 à 15) n'existent qu'à partir de leur carte de l'aventure, dès la vague 5
const ELITES = { soignou: 7, bulle: 8, scindo: 9, taupe: 10, voleur: 11, aimant: 12, givre: 13, pilleur: 14 };
const MOB_FRESH_WAVE = 5;
// Première vague où chaque monstre peut sortir (js/game.js makeWave)
const MOB_FIRST = { zip: 3, flappy: 4, tonk: 6, gresil: 7, magma: 8, crachou: 9, boss: 10, malefik: 12, soignou: 5, bulle: 5, scindo: 5, taupe: 5, voleur: 5, aimant: 5, givre: 5, pilleur: 5 };
const MOB_SHORT = {
  gloop: T('Le slime de base, lent et sans pouvoir.'),
  zip: T('Minuscule et très rapide : Ondine le ralentit.'),
  flappy: T('Il vole : Braise et Ondine le touchent, Rocaille non.'),
  tonk: T('Casqué : vise-le avec des tours améliorées en Dégâts.'),
  magma: T('Immunisé au feu : Braise ne lui fait rien.'),
  gresil: T('Il paralyse les tours proches : élimine-le vite.'),
  crachou: T('Il crache sur les tours et les abîme.'),
  malefik: T('Il retourne une tour contre les autres un moment.'),
  boss: T('Énorme ! Garde de l’or pour améliorer tes tours.'),
  soignou: T('Il soigne les slimes autour de lui : abats-le en premier.'),
  bulle: T('Sa bulle encaisse les coups : Braise et Voltie l’éclatent plus vite.'),
  scindo: T('Il se divise en trois Gloops : une tour de zone juste derrière lui.'),
  taupe: T('Il creuse sous terre : place des tours tout le long du chemin.'),
  voleur: T('Il vole de l’or à la maison puis repart : ralentis-le et abats-le vite.'),
  aimant: T('Il attire les tirs : les tours de zone touchent quand même les autres.'),
  givre: T('Le froid ne lui fait rien, et il ralentit les tours proches : mise sur Braise.'),
  pilleur: T('Il vole des éclats de la partie : une chaîne de tours près de la maison.'),
};
// Élites possibles sur la carte en cours (pour le tirage des vagues, js/game.js makeWave)
function mobElites(w) {
  if (!G || G.story || w < MOB_FRESH_WAVE) return [];
  const a = ADV_MAPS.indexOf(G.map); if (a < 0) return [];
  return Object.keys(ELITES).filter(k => a >= ELITES[k]);
}
const ADV_MAPS = MAPS.map((m, i) => m.prog ? i : -1).filter(i => i >= 0);
const mobSeen = k => !!(typeof introSeen === 'function' && introSeen()['mob_' + k]);

// Ce que la partie en cours autorise : null = tous les monstres ; sinon { lv, fresh } : les monstres des cartes 0..lv,
// fresh = celui que cette carte ajoute (seulement dès la vague 5)
function mobLimit() {
  if (!G || G.duel || G.coop || G.story || G.demo || G.diff !== 'facile') return null;
  if (G.mobLim !== undefined) return G.mobLim;
  const a = ADV_MAPS.indexOf(G.map);
  let lim;
  if (a >= 0) lim = a >= MOB_ORDER.length ? null : { lv: a, fresh: MOB_ORDER[a] || null };
  else {
    // Carte du jour, aléatoire, événement : selon la meilleure carte de l'aventure réussie, plus une
    const best = store.get(BEST2) || {};
    let won = -1; ADV_MAPS.forEach((mi, k) => { const r = best[MAPS[mi].id] || {}; if (Object.values(r).some(x => x && x.won)) won = k; });
    const lv = won + 1; lim = lv >= MOB_ORDER.length ? null : { lv, fresh: null };
  }
  return (G.mobLim = lim);
}
// Ce monstre peut-il sortir à la vague w ?
function mobOk(type, w) {
  const lim = mobLimit(); if (!lim) return true;
  const k = MOB_ORDER.indexOf(type); if (k <= 0) return true; // Gloop, Zippy, Kaiju, monstres d'événement
  if (k < lim.lv) return true;
  return k === lim.lv && w >= MOB_FRESH_WAVE;
}
// Appliqué à une vague tirée par makeWave : remplace les monstres pas encore introduits, avance le nouveau monstre de
// la carte à la vague 5 (et l'assure dans cette vague-là)
function mobFilter(list, pool, w) {
  const lim = mobLimit(); if (!lim) return list;
  const known = [...new Set(pool)].filter(t => t !== 'boss' && mobOk(t, w));
  const fresh = lim.fresh && w >= MOB_FRESH_WAVE ? lim.fresh : null;
  if (fresh && !known.includes(fresh)) known.push(fresh);
  const alt = known.length ? known : ['gloop'];
  for (const it of list) if (it.type !== 'boss' && !mobOk(it.type, w)) {
    it.type = alt[Math.floor(Math.random() * alt.length)];
  }
  if (fresh && w === MOB_FRESH_WAVE && !list.some(it => it.type === fresh)) {
    const idx = list.map((it, i) => it.type === 'boss' ? -1 : i).filter(i => i >= 0);
    for (let n = 0; n < Math.min(3, idx.length); n++) list[idx[Math.floor((n + 1) * idx.length / 4)]].type = fresh;
  }
  return list;
}

// ---------- Au départ : les monstres nouveaux de cette partie ----------
function mobStartList() {
  if (!G || G.duel || G.coop || G.story || G.demo || G.guide || G.wave > 0) return null;
  const lim = mobLimit();
  if (lim) {
    if (G.map === ADV_MAPS[0]) return null; // carte 1 : le coup de pouce, et Gloop et Zippy se présentent tout seuls
    if (lim.fresh) return mobSeen(lim.fresh) ? null : { kind: 'fresh', list: [lim.fresh] };
    const l = MOB_ORDER.filter((t, k) => t && k < lim.lv && !mobSeen(t));
    return l.length ? { kind: 'new', list: l } : null;
  }
  if (G.diff === 'facile') return null;
  const l = ['zip', 'flappy', 'tonk', 'gresil', 'magma', 'crachou', 'boss', 'malefik'].concat(mobElites(99)).filter(t => !mobSeen(t));
  return l.length ? { kind: 'unknown', list: l } : null;
}
const mobWave = t => { const lim = mobLimit(); return lim && lim.fresh === t ? MOB_FRESH_WAVE : MOB_FIRST[t] || 1; };
function mobStart() {
  const s = mobStartList(); if (!s) return;
  const pop = $('#mobPop'), one = s.list.length === 1;
  $('#mobTag').textContent = s.kind === 'unknown' ? '⚠️ ' + T('Mode ') + DIFFS[G.diff].name : s.kind === 'fresh' ? T('🆕 Nouveau sur cette carte') : T('🆕 Nouveaux monstres');
  $('#mobTitle').textContent = s.kind === 'fresh' ? MAPS[G.map].name : s.kind === 'unknown' ? T('Des monstres que tu ne connais pas') : T('Ils peuvent arriver sur cette carte');
  const box = $('#mobList'); box.className = one ? 'moblist one' : 'moblist';
  box.innerHTML = s.list.map(t => '<div class="mobrow"><canvas data-t="' + t + '"></canvas><div><b>' + esc(eName(t)) + '</b><small>' + MOB_SHORT[t] + '</small>'
    + (one ? '' : '<em>' + T('dès la vague ') + mobWave(t) + '</em>') + '</div>' + (one ? '<span class="mobwv"><span>' + T('VAGUE') + '</span>' + mobWave(t) + '</span>' : '') + '</div>').join('');
  box.querySelectorAll('canvas').forEach(cv => { const t = cv.dataset.t, n = one ? 58 : 40; drawEnemy(prepMini(cv, n, n), t, n / 2, n * 0.9, n * (t === 'boss' ? 0.8 : 1.1), 0.6, null); });
  $('#mobFine').textContent = s.kind === 'fresh' ? T('Prends ton temps : la vague 1 ne part que quand tu la lances.') : T('Yglou te prévient une vague avant l’arrivée de chacun.');
  $('#mobGo').textContent = one ? T('C’est parti !') : T('Je suis prêt !');
  G.mobWasPaused = !!G.paused; G.paused = true; pop.hidden = false;
}
$('#mobGo').addEventListener('click', () => { Snd.init(); $('#mobPop').hidden = true; if (G) G.paused = !!G.mobWasPaused; });

// ---------- Une vague avant : la bulle d'Yglou sur l'aperçu de la vague ----------
const mobBub = document.createElement('div'), mobRing = document.createElement('div');
mobBub.id = 'mobWarn'; mobRing.id = 'mobRing'; mobBub.hidden = mobRing.hidden = true;
document.body.append(mobBub, mobRing);
let mobWarnT = 0;
function mobWarnHide() { clearTimeout(mobWarnT); mobBub.hidden = mobRing.hidden = true; }
mobBub.addEventListener('click', mobWarnHide);
function mobWarn() {
  if (!G || G.over || G.duel || G.coop || G.story || G.demo || G.guide || G.waveActive || curScreen !== 'game') return;
  const nw = G.nextWave; if (!nw || !nw.list) return;
  G.mobWarned = G.mobWarned || {};
  const types = [...new Set(nw.list.map(it => it.type))].filter(t => MOB_SHORT[t] && !mobSeen(t) && !G.mobWarned[t] && t !== 'gloop');
  if (!types.length) return;
  for (const t of types) G.mobWarned[t] = 1;
  const t = types[0], names = types.map(k => eName(k));
  const what = t === 'boss' && types.length === 1 ? T('un Kaiju arrive !') : T('des ') + names.join(T(' et des ')) + T(' arrivent !');
  mobBub.innerHTML = '<canvas aria-hidden="true"></canvas><p>' + T('Vague ') + nw.n + ' : ' + esc(what) + '<small>' + MOB_SHORT[t] + '</small></p>';
  drawEnemy(prepMini(mobBub.querySelector('canvas'), 52, 52), t, 26, 47, t === 'boss' ? 42 : 58, 0.6, null);
  const r = $('#nextWave').getBoundingClientRect(), W = innerWidth, H = innerHeight, land = r.width && r.left < W * 0.3 && r.bottom < H * 0.8;
  mobBub.hidden = false;
  if (r.width) {
    mobRing.hidden = false;
    Object.assign(mobRing.style, { left: (r.left - 5) + 'px', top: (r.top - 5) + 'px', width: (r.width + 10) + 'px', height: (r.height + 10) + 'px' });
    if (land) Object.assign(mobBub.style, { left: (r.right + 14) + 'px', right: 'auto', top: Math.max(8, r.top) + 'px', bottom: 'auto' });
    else Object.assign(mobBub.style, { left: '', right: '', top: 'auto', bottom: (H - r.top + 12) + 'px' });
  }
  Snd.play('build');
  clearTimeout(mobWarnT); mobWarnT = setTimeout(mobWarnHide, 7000);
}

// ---------- Le bestiaire (Profil → Bestiaire) ----------
// Un monstre est « rencontré » quand sa fenêtre de présentation s'est ouverte (js/intro.js) ; les autres sont en
// silhouette, avec un indice pour les trouver. Chaque nouveau monstre rapporte 2 éclats (js/intro.js introMob).
screens.best = $('#sBest');
const BEST_GROUPS = [
  [T('L’aventure'), ['gloop', 'zip', 'flappy', 'tonk', 'magma', 'gresil', 'crachou', 'malefik', 'boss']],
  [T('Les élites'), ['soignou', 'bulle', 'scindo']],
  [T('Le chapitre 2'), ['taupe', 'voleur', 'aimant', 'givre', 'pilleur']],
  [T('Les événements'), ['spectre', 'potiron', 'cadeau', 'lapin', 'calinou', 'hongbao']],
];
const BEST_ALL = BEST_GROUPS.flatMap(g => g[1]);
// Où trouver un monstre pas encore rencontré
function bestHint(k) {
  const D = ETYPES[k];
  if (D.season && SEASONS[D.season]) return SEASONS[D.season].icon + ' ' + (MAPS.find(m => m.season === D.season) || {}).name;
  const n = k === 'gloop' || k === 'zip' || k === 'boss' ? 0 : MOB_ORDER.indexOf(k);
  return n >= 0 ? T('Carte ') + (n + 1) : '';
}
const bestSeen = k => mobSeen(k) || admOn('best'); // option admin « Tout le bestiaire »
const bestCount = () => BEST_ALL.filter(bestSeen).length;
// Sprite d'un monstre pour le bestiaire (les volants un peu plus bas : leurs ailes restent dans le cadre)
function bestDraw(cv, k, n) { const c = prepMini(cv, n, n), fly = ETYPES[k].flying; drawEnemy(c, k, n / 2, n * (fly ? 1.02 : 0.9), n * (k === 'boss' ? 0.82 : fly ? 0.9 : 1.12), 0.6, null); }
function openBest() {
  Snd.init();
  $('#bestCnt').textContent = '👾 ' + bestCount() + ' / ' + BEST_ALL.length + T(' rencontrés');
  $('#bestList').innerHTML = BEST_GROUPS.map(([t, L]) => '<h3 class="besth">' + t + '</h3><div class="bestg">'
    + L.map(k => { const seen = bestSeen(k); return '<button class="bestc' + (seen ? '' : ' no') + '" type="button" data-k="' + k + '"><canvas></canvas><b>' + (seen ? esc(ETYPES[k].name) : '???') + '</b>' + (seen ? '' : '<small>' + esc(bestHint(k)) + '</small>') + '</button>'; }).join('') + '</div>').join('');
  $('#bestList').querySelectorAll('.bestc').forEach(b => { bestDraw(b.querySelector('canvas'), b.dataset.k, 56); b.addEventListener('click', () => bestOpen(b.dataset.k)); });
  show('best'); screens.best.scrollTop = 0;
}
function bestOpen(k) {
  const D = ETYPES[k], seen = bestSeen(k);
  Snd.init(); Snd.play('build');
  const cv = $('#bpCv'); bestDraw(cv, k, 110); cv.style.filter = seen ? '' : 'brightness(0) opacity(.3)';
  $('#bpName').textContent = seen ? D.name : '???';
  $('#bpText').textContent = seen ? (typeof MOB_TIPS !== 'undefined' && MOB_TIPS[k]) || D.desc : T('Pas encore rencontré. Indice : ') + bestHint(k);
  const sp = D.speed >= 1.6 ? T('Très rapide') : D.speed >= 1.15 ? T('Rapide') : D.speed >= 0.8 ? T('Normal') : T('Lent');
  const chips = [['❤️', D.hp + T(' PV')], ['💨', sp]];
  if (D.flying) chips.push(['🪽', T('Vole')]);
  if (D.armor) chips.push(['🪖', T('Armure')]);
  if (D.immune) chips.push(['🚫', T('Immunisé au feu')]);
  if (D.lifeCost > 1) chips.push(['💔', '−' + D.lifeCost + T(' vies')]);
  $('#bpChips').innerHTML = seen ? chips.map(([i, t]) => '<span>' + i + ' ' + t + '</span>').join('') : '';
  const kills = (stats.killsBy || {})[k] || 0;
  $('#bpMeta').textContent = seen ? kills + T(' vaincus') : '';
  $('#bestPop').hidden = false;
}
$('#bpClose').addEventListener('click', () => { $('#bestPop').hidden = true; });
$('#bestBack').addEventListener('click', () => { $('#bestPop').hidden = true; openProfile(); });
$('#prBest').addEventListener('click', openBest);
function bestTile() { const e = $('#prBestSub'); if (e) e.textContent = bestCount() + ' / ' + BEST_ALL.length + T(' monstres'); }
