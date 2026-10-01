// Élémento Defense : Yglou, la mascotte, dans l'interface (écran titre, fins de partie, Atelier, tutoriel guidé).
// Il porte le déguisement de l'événement en cours. Secret : le toucher 10 fois sur l'écran titre donne 5 éclats, une seule fois.
'use strict';

const MASCOT = { taps: 0, jumpT: 0, overMood: 'happy', shopParty: 0, lastShards: null, lastT: 0 };
const EGG_KEY = 'elemento.yglouEgg';
const liveCostume = () => { const now = new Date(); for (const k in SEASONS) if (SEASONS[k].on(now)) return k; return null; };
function paintYglou(cv, w, h, mood, t, o = {}) {
  if (!cv || !cv.offsetParent) return;
  const c = prepMini(cv, w, h);
  drawYglou(c, w / 2, h * 0.6 - (o.jump || 0), h * 0.82, mood, t, Object.assign({ costume: liveCostume() }, o));
}
function mascotTick(t) {
  const dt = Math.min(0.1, Math.max(0, t - (MASCOT.lastT || t))); MASCOT.lastT = t;
  if (MASCOT.jumpT > 0) MASCOT.jumpT -= dt;
  if (MASCOT.shopParty > 0) MASCOT.shopParty -= dt;
  if (MASCOT.lastShards != null && meta.shards < MASCOT.lastShards && curScreen === 'shop') MASCOT.shopParty = 1.6;
  MASCOT.lastShards = meta.shards;
  if (curScreen === 'title') {
    const j = MASCOT.jumpT > 0 ? Math.sin((0.6 - MASCOT.jumpT) / 0.6 * Math.PI) * 18 : 0;
    paintYglou($('#tYglou'), 120, 120, MASCOT.jumpT > 0 ? 'party' : (t % 7) < 0.6 ? 'wink' : 'happy', t, { jump: j });
  } else if (curScreen === 'over') paintYglou($('#oYglou'), 130, 130, MASCOT.overMood, t);
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
    document.querySelector('#sTitle .bubble').textContent = 'Kiiaaa ! Tu as trouvé mon secret : +5 éclats pour toi !';
    Snd.play('win'); refreshTitle();
  }
});
