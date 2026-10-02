// Élémento Defense : Yglou, la mascotte, dans l'interface (écran titre, fins de partie, Atelier, tutoriel guidé).
// Il porte le déguisement de l'événement en cours. Secret : le toucher 10 fois sur l'écran titre donne 5 éclats, une seule fois.
'use strict';

const MASCOT = { taps: 0, jumpT: 0, overMood: 'happy', shopParty: 0, lastShards: null, lastT: 0 };
const EGG_KEY = 'elemento.yglouEgg';
const liveCostume = () => { const now = new Date(); for (const k in SEASONS) if (SEASONS[k].on(now)) return k; return null; };
function paintYglou(cv, w, h, mood, t, o = {}) {
  if (!cv || !cv.offsetParent) return;
  const c = prepMini(cv, w, h), oo = Object.assign({ costume: liveCostume() }, o);
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
    if (!MASCOT.chipT || t - MASCOT.chipT > 1) { MASCOT.chipT = t; paintYglou($('#tProfCv'), 30, 30, 'happy', 0, { noShadow: true, noConfetti: true, costume: null }); }
  } else if (curScreen === 'over') paintYglou($('#oYglou'), 170, 130, MASCOT.overMood, t, { atom: 1.3 });
  else if (curScreen === 'profile') paintYglou($('#prCv'), 70, 70, (t % 5) < 0.6 ? 'wink' : 'happy', t, { noConfetti: true });
  else if (curScreen === 'shop') paintYglou($('#sYglou'), 72, 72, MASCOT.shopParty > 0 ? 'party' : (t % 6) < 0.6 ? 'wink' : 'happy', t, { noConfetti: true });
  const gb = document.querySelector('#guideBox:not([hidden]) .gy');
  if (gb && typeof GUIDE !== 'undefined') paintYglou(gb, 56, 56, GUIDE.i === 0 ? 'wink' : GUIDE.i === GSTEPS.length - 1 ? 'party' : 'happy', t, { noConfetti: true, noShadow: true });
}
// Toucher Yglou sur l'écran titre : il saute et pousse un cri
$('#tYglou').addEventListener('click', () => {
  Snd.init(); Snd.play('cri'); MASCOT.jumpT = 0.6; MASCOT.taps++;
  try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
  if (MASCOT.taps >= 10 && !store.get(EGG_KEY)) {
    store.set(EGG_KEY, true); meta.shards += 5; meta.earned = (meta.earned || 0) + 5; saveMeta();
    document.querySelector('#sTitle .bubble').textContent = T('Kiiaaa ! Tu as trouvé mon secret : +5 éclats pour toi !');
    Snd.play('win'); refreshTitle();
  }
});

// ---------- Profil : pseudo, son, tutoriel et aide ----------
function refreshProfileChip() { const n = (store.get('elemento.pseudo') || '').trim(); $('#tProfName').textContent = n || T('Profil'); }
function openProfile() {
  Snd.init(); show('profile'); screens.profile.scrollTop = 0;
  $('#prName').value = store.get('elemento.pseudo') || '';
  const best = store.get(BEST2) || {}, owned = MAPS.filter((m, i) => !m.season && !m.random && mapOwned(i)).length, wins = Object.values(best).reduce((n, r) => n + Object.values(r).filter(x => x && x.won).length, 0);
  $('#prStats').textContent = (meta.shards || 0) + T(' éclats · ') + (meta.earned || 0) + T(' gagnés en tout · cagnotte ') + (meta.bank || 0) + T(' or · ') + owned + T('/10 cartes · ') + wins + (IS_EN ? ' win' + (wins === 1 ? '' : 's') : ' victoire' + (wins > 1 ? 's' : ''));
}
$('#tProfile').addEventListener('click', openProfile);
$('#prName').addEventListener('input', ev => { store.set('elemento.pseudo', ev.target.value.trim().slice(0, 12)); refreshProfileChip(); });
$('#prName').addEventListener('keydown', ev => ev.stopPropagation());
$('#prBack').addEventListener('click', () => show('title'));
refreshProfileChip();
$('#tBuild').textContent = 'build ' + BUILD;

// Langue : auto (celle du téléphone), français ou anglais ; changer recharge le jeu
document.querySelectorAll('#prLang [data-lang]').forEach(b => {
  b.classList.toggle('on', b.dataset.lang === LANG_PREF);
  b.addEventListener('click', () => { if (b.dataset.lang !== LANG_PREF) setLang(b.dataset.lang); });
});
