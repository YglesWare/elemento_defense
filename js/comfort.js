// Élémento Defense : confort et accessibilité (réglages de cet appareil, COMFORT dans js/data.js).
// Texte plus grand, couleurs pour daltoniens (bleu et orange au lieu de vert et rouge, avec des symboles),
// vibrations, moins de secousses (pas de tremblement de l'écran ni de flash rouge).
'use strict';

const COMFORT_KEY = 'elemento.comfort';
// Vibrations coupées : toutes les vibrations du jeu passent par navigator.vibrate
(() => {
  const real = navigator.vibrate ? navigator.vibrate.bind(navigator) : null;
  try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => (COMFORT.vib && real ? real(p) : false) }); } catch (e) {}
})();
function comfortApply() {
  document.documentElement.classList.toggle('bigtext', !!COMFORT.big);
  document.documentElement.classList.toggle('cvd', !!COMFORT.cvd);
  if (typeof refreshCosts === 'function' && G) refreshCosts();
}
const COMFORT_ROWS = [
  ['big', 'Texte plus grand', 'Tous les textes un peu plus gros'],
  ['cvd', 'Couleurs pour daltoniens', 'Bleu et orange au lieu de vert et rouge, avec des symboles ✓ ✕ ▲ ▼'],
  ['calm', 'Moins de secousses', 'L’écran ne tremble plus, et moins de flashs'],
];
// Son : effets et musique (opts, gardés par la réinitialisation) ; vibrations (COMFORT)
const SOUND_ROWS = [
  ['sound', 'Effets sonores', 'Tirs, explosions, pièces'],
  ['music', 'Musique', 'Un air différent par carte'],
  ['vib', 'Vibrations', 'Séisme, invitations, QR code scanné…'],
];
const soundOn = k => k === 'vib' ? !!COMFORT.vib : k === 'music' ? opts.music !== false : !!opts.sound;
const setRow = (k, t, sub, on) => '<div class="paset"><div><b>' + T(t) + '</b><small>' + T(sub) + '</small></div><button class="patog' + (on ? ' on' : '') + '" type="button" role="switch" aria-checked="' + !!on + '" data-k="' + k + '"></button></div>';
function comfortRender() {
  $('#cfList').innerHTML = COMFORT_ROWS.map(([k, t, sub]) => setRow(k, t, sub, COMFORT[k])).join('');
  $('#cfList').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    COMFORT[b.dataset.k] = !COMFORT[b.dataset.k]; store.set(COMFORT_KEY, COMFORT); comfortApply(); comfortRender();
  }));
  if (typeof sreRender === 'function') sreRender(); // la version simplifiée d'un ami testeur (js/surprise.js)
  admRender();
}
// Page Réglages (depuis le Profil) : langue, écran, son, confort, réinitialisation
function settingsRender() {
  $('#setSound').innerHTML = SOUND_ROWS.map(([k, t, sub]) => setRow(k, t, sub, soundOn(k))).join('');
  $('#setSound').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k;
    if (k === 'vib') { COMFORT.vib = !COMFORT.vib; store.set(COMFORT_KEY, COMFORT); if (COMFORT.vib) navigator.vibrate(40); }
    else { opts[k] = !soundOn(k); store.set(OPTS, opts); Snd.init(); if (typeof Music !== 'undefined') Music.start(); }
    if (typeof refreshOptBtns === 'function') refreshOptBtns(); settingsRender();
  }));
  $('#setOrientBox').hidden = !ORIENT;
  $('#setOrient').querySelectorAll('[data-o]').forEach(b => b.classList.toggle('on', b.dataset.o === (opts.orient || 'auto')));
  comfortRender();
}
// Options admin : tout débloquer, une catégorie à la fois (js/data.js admOn)
const ADM_ROWS = [
  ['maps', 'Toutes les cartes', 'Cartes, difficultés et événements ouverts'],
  ['towers', 'Toutes les tours', 'Les six gardiens débloqués'],
  ['fusions', 'Toutes les fusions', 'Toutes les recettes de fusion débloquées'],
  ['mastery', 'Maîtrises au max', 'Dégâts de chaque élément et de chaque fusion'],
  ['range', 'Longues-vues au max', 'Portée de chaque élément et de chaque fusion'],
  ['rate', 'Sabliers au max', 'Cadence de chaque élément et de chaque fusion'],
  ['camp', 'Camp au max', 'Trésor, vies, butin, remparts, bouclier, seconde chance…'],
  ['best', 'Tout le bestiaire', 'Tous les monstres affichés comme rencontrés'],
  ['wear', 'Toute la garde-robe', 'Tous les habits d’Yglou'],
];
function admRender() {
  const box = $('#setAdm'), on = store.get('elemento.creator') === true; box.hidden = !on; if (!on) return;
  $('#admList').innerHTML = ADM_ROWS.map(([k, t, sub]) => setRow(k, t, sub, !!ADMX[k])).join('');
  $('#admList').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k; ADMX[k] = !ADMX[k]; store.set(ADMX_KEY, ADMX); admRender();
    if (typeof refreshCosts === 'function' && G) refreshCosts(); if (typeof refreshPalette === 'function' && G) refreshPalette();
  }));
}
function openSettings() { Snd.init(); $('#prResetBox').hidden = true; settingsRender(); show('settings'); screens.settings.scrollTop = 0; }
$('#prSettings').addEventListener('click', openSettings);
$('#setBack').addEventListener('click', () => { $('#prResetBox').hidden = true; openProfile(); });
// Orientation de l'écran (appli Android, MainActivity) : auto (le jeu suit le téléphone, sauf rotation bloquée),
// portrait ou paysage. Le choix est aussi gardé côté Android, pour s'appliquer dès l'ouverture suivante.
const ORIENT = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.Orient;
function orientApply() { if (ORIENT) ORIENT.set({ mode: opts.orient || 'auto' }).catch(() => {}); }
$('#setOrient').querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => {
  opts.orient = b.dataset.o; store.set(OPTS, opts); orientApply(); settingsRender();
}));
orientApply();
comfortApply();
