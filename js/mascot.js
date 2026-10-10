// Élémento Defense : Yglou, la mascotte, dans l'interface (écran titre, fins de partie, Atelier, tutoriel guidé).
// Il porte le déguisement de l'événement en cours. Secret : le toucher 10 fois sur l'écran titre donne 5 éclats, une seule fois.
'use strict';

const MASCOT = { taps: 0, jumpT: 0, overMood: 'happy', shopParty: 0, lastShards: null, lastT: 0 };
const EGG_KEY = 'elemento.yglouEgg';
const liveCostume = () => { const now = new Date(); for (const k in SEASONS) if (SEASONS[k].on(now)) return k; return null; };
function paintYglou(cv, w, h, mood, t, o = {}) {
  if (!cv || !cv.offsetParent) return;
  // Tenue de la garde-robe (js/wardrobe.js) ; sans chapeau choisi, le déguisement de l'événement en cours
  const W = typeof wear === 'function' ? wear() : {}, oo = Object.assign({ costume: (typeof wearHat === 'function' && wearHat()) || liveCostume(), crest: typeof wearCrest === 'function' ? wearCrest() : null, aura: !!W.aura }, o);
  const c = prepMini(cv, w, h);
  // Avec un chapeau, Yglou est un peu plus petit et plus bas pour que le chapeau tienne dans le cadre
  // o.top : place vide en haut du cadre (part de la hauteur) pour que les sauts et le chapeau ne soient jamais coupés
  // Avec l'atome d'éléments, Yglou est un peu plus petit pour que les électrons restent dans le cadre
  const h0 = h / (1 + (o.top || 0)), hat = !!oo.costume, sz = h0 * (hat ? 0.66 : 0.8) * (o.atom ? 0.9 : 1), cy = h - h0 + h0 * (hat ? 0.67 : 0.6);
  drawYglou(c, w / 2, cy - (o.jump || 0), sz, mood, t, oo);
}
function mascotTick(t) {
  const dt = Math.min(0.1, Math.max(0, t - (MASCOT.lastT || t))); MASCOT.lastT = t;
  if (MASCOT.jumpT > 0) MASCOT.jumpT -= dt;
  if (MASCOT.shopParty > 0) MASCOT.shopParty -= dt;
  if (MASCOT.lastShards != null && meta.shards < MASCOT.lastShards && curScreen === 'shop') MASCOT.shopParty = 1.6;
  MASCOT.lastShards = meta.shards;
  if (curScreen === 'title') {
    const j = MASCOT.jumpT > 0 ? Math.sin((0.6 - MASCOT.jumpT) / 0.6 * Math.PI) * 18 : 0;
    const cv = $('#tYglou'), hh = cv.clientHeight || 175, base = hh / 1.35;
    paintYglou(cv, Math.round(cv.clientWidth || hh * 0.8), hh, MASCOT.jumpT > 0 ? 'party' : (t % 7) < 0.6 ? 'wink' : 'happy', t, { jump: j * base / 130, top: 0.35, atom: 1.3 });
    if (!MASCOT.chipT || t - MASCOT.chipT > 1) { MASCOT.chipT = t; paintYglou($('#tProfCv'), 30, 30, 'happy', 0, { noShadow: true, noConfetti: true, costume: typeof wearHat === 'function' ? wearHat() : null, aura: false }); }
  } else if (curScreen === 'over') paintYglou($('#oYglou'), 170, 130, MASCOT.overMood, t, { atom: 1.3 });
  else if (curScreen === 'profile') paintYglou($('#prCv'), 70, 70, (t % 5) < 0.6 ? 'wink' : 'happy', t, { noConfetti: true });
  else if (curScreen === 'shop') paintYglou($('#sYglou'), 72, 72, MASCOT.shopParty > 0 ? 'party' : (t % 6) < 0.6 ? 'wink' : 'happy', t, { noConfetti: true });
  if (typeof wardrobeTick === 'function') wardrobeTick(t);
  const gb = document.querySelector('#guideBox:not([hidden]) .gy');
  if (gb && typeof GUIDE !== 'undefined') paintYglou(gb, 56, 56, GUIDE.i === 0 ? 'wink' : GUIDE.i === GSTEPS.length - 1 ? 'party' : 'happy', t, { noConfetti: true, noShadow: true });
}
// Toucher Yglou sur l'écran titre : il saute et pousse un cri
$('#tYglou').addEventListener('click', () => {
  Snd.init(); Snd.play('cri'); MASCOT.jumpT = 0.6; MASCOT.taps++;
  try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
  if (MASCOT.taps >= 10 && typeof trophy === 'function') trophy('egg_yglou');
  if (MASCOT.taps >= 10 && !store.get(EGG_KEY)) {
    store.set(EGG_KEY, true); meta.shards += 5; meta.earned = (meta.earned || 0) + 5; saveMeta();
    document.querySelector('#sTitle .bubble').textContent = T('Kiiaaa ! Tu as trouvé mon secret : +5 éclats pour toi !');
    Snd.play('win'); refreshTitle();
  }
});

// ---------- Profil : pseudo, son, tutoriel et aide ----------
function refreshProfileChip() { const n = (store.get('elemento.pseudo') || '').trim(); $('#tProfName').textContent = n || T('Profil'); }
function openProfile() {
  Snd.init(); show('profile'); screens.profile.scrollTop = 0; if (typeof refreshTrophyBtn === 'function') refreshTrophyBtn(); if (typeof cloudPaint === 'function') cloudPaint();
  $('#prName').value = store.get('elemento.pseudo') || ''; nameWarn();
  $('#prNewsSub').textContent = T('Version ') + '1.0.' + BUILD;
  if (typeof bestTile === 'function') bestTile();
}
// Page des stats (depuis le Profil) : une tuile par chiffre
screens.stats = $('#sStats');
function openStats() {
  const best = store.get(BEST2) || {}, owned = MAPS.filter((m, i) => m.prog && mapOwned(i)).length;
  const won = k => Object.values(best).filter(r => r[k] && r[k].won).length, maps = Object.values(best).filter(r => Object.values(r).some(x => x && x.won)).length;
  const n = v => Math.round(v).toLocaleString(IS_EN ? 'en-US' : 'fr-FR'), h = Math.floor(stats.time / 3600), mn = Math.floor(stats.time / 60) % 60;
  const tiles = [
    ['💎', n(meta.shards || 0), T('éclats')], ['✨', n(meta.earned || 0), T('éclats gagnés en tout')], ['🐷', n(meta.bank || 0), T('or en cagnotte')],
    ['🗺️', owned + ' / ' + MAPS.filter(m => m.prog).length, T('cartes possédées')], ['🏁', n(maps), T('cartes réussies')], ['🥇', won('facile') + ' · ' + won('moyen') + ' · ' + won('difficile'), T('réussies en F · M · D')],
    ['🎮', n(stats.games), T('parties lancées')], ['🏆', n(stats.wins), T('victoires')], ['💥', n(stats.ko), 'K.O.'],
    ['🌊', n(stats.waves), T('vagues repoussées')], ['⚔️', n(stats.kills), T('ennemis vaincus')], ['🐲', n(stats.bosses), T('boss vaincus')],
    ['🏗️', n(stats.towers), T('tours posées')], ['⏳', h ? h + ' h ' + String(mn).padStart(2, '0') : mn + ' min', T('temps de jeu')],
  ];
  $('#stGrid').innerHTML = tiles.map(([ic, v, l]) => '<div class="st"><span class="st-ic">' + ic + '</span><b>' + v + '</b><span>' + l + '</span></div>').join('');
  show('stats'); screens.stats.scrollTop = 0;
}
$('#prStatsBtn').addEventListener('click', () => { Snd.init(); openStats(); });
$('#stBack').addEventListener('click', () => show('profile'));
document.addEventListener('keydown', ev => { if (curScreen === 'stats' && ev.key === 'Escape') show('profile'); });
$('#tProfile').addEventListener('click', openProfile);
// Pseudo vu par les amis : un gros mot est remplacé par « Joueur » (js/friends.js)
const nameWarn = () => { $('#prNameWarn').hidden = !(typeof badPseudo === 'function' && badPseudo($('#prName').value)); };
$('#prName').addEventListener('input', ev => { store.set('elemento.pseudo', ev.target.value.trim().slice(0, 12)); refreshProfileChip(); nameWarn(); });
$('#prName').addEventListener('keydown', ev => ev.stopPropagation());
// Champ laissé vide : on redonne un pseudo au hasard
$('#prName').addEventListener('change', ev => { if (!ev.target.value.trim()) { ev.target.value = randomPseudo(); store.set('elemento.pseudo', ev.target.value); refreshProfileChip(); } });
$('#prBack').addEventListener('click', () => show('title'));

// Réinitialiser la progression : confirmation dans la page, puis effacement (le pseudo, la langue et le son restent)
const RESET_KEEP = ['elemento.pseudo', 'elemento.lang', 'elemento.opts', 'elemento.mpFacing'];
$('#prReset').addEventListener('click', () => { const b = $('#prResetBox'); b.hidden = !b.hidden; if (!b.hidden) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
$('#prResetNo').addEventListener('click', () => { $('#prResetBox').hidden = true; });
$('#prResetYes').addEventListener('click', () => {
  for (const k of [...store.mem.keys()]) if (k.startsWith('elemento.') && !RESET_KEEP.includes(k)) store.del(k);
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('elemento.') && !RESET_KEEP.includes(k)) localStorage.removeItem(k); } } catch (e) {}
  store.flush().then(() => location.reload());
});
refreshProfileChip();
$('#tBuild').textContent = 'build ' + BUILD;

// Langue : auto (celle du téléphone), français ou anglais ; changer recharge le jeu
document.querySelectorAll('#prLang [data-lang]').forEach(b => {
  b.classList.toggle('on', b.dataset.lang === LANG_PREF);
  b.addEventListener('click', () => { if (b.dataset.lang !== LANG_PREF) setLang(b.dataset.lang); });
});
