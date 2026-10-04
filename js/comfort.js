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
  ['vib', 'Vibrations', 'Séisme, invitations, QR code scanné…'],
  ['calm', 'Moins de secousses', 'L’écran ne tremble plus, et moins de flashs'],
];
function comfortRender() {
  $('#cfList').innerHTML = COMFORT_ROWS.map(([k, t, sub]) => '<div class="paset"><div><b>' + T(t) + '</b><small>' + T(sub) + '</small></div><button class="patog' + (COMFORT[k] ? ' on' : '') + '" type="button" role="switch" aria-checked="' + !!COMFORT[k] + '" data-k="' + k + '"></button></div>').join('');
  $('#cfList').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    COMFORT[b.dataset.k] = !COMFORT[b.dataset.k]; store.set(COMFORT_KEY, COMFORT); comfortApply(); comfortRender();
    if (b.dataset.k === 'vib' && COMFORT.vib) navigator.vibrate(40);
  }));
}
$('#prComfort').addEventListener('click', () => { Snd.init(); comfortRender(); $('#comfortPop').hidden = false; });
$('#cfClose').addEventListener('click', () => { $('#comfortPop').hidden = true; });
comfortApply();
