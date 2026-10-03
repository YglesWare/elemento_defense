// Élémento Defense : actions secrètes avec le téléphone (volontairement absentes de l'aide : ce sont des trophées cachés).
// - Brouillard : balayer la carte du doigt chasse la brume ; ensuite, souffler dans le micro aussi (avec accord).
// - Tempête : pencher le téléphone oriente le vent, qui décale la zone de tir des tours (windCenter, js/game.js).
// - Secouer le téléphone : séisme qui étourdit les ennemis au sol (une fois par vague).
// - Blizzard : frotter l'écran réchauffe les tours (cadence +20 % pendant 10 s, une fois par vague).
// Rien de tout ça en multijoueur (pour ne pas avantager un téléphone), ni dans le tutoriel animé.
'use strict';

const MIC_KEY = 'elemento.mic', MIC_ASKED = 'elemento.micAsked';
const ACT = { last: performance.now(), path: null, swipes: [], tilt: null, base: null, tiltT: 0, peaks: [], mic: null, blowT: 0 };
const actOn = () => G && !G.over && !G.demo && !G.duel && !G.coop && curScreen === 'game' && !G.paused && !(window.parent !== window && window.parent.BALANCE);
const restat = () => { for (const t of G.towers) t.s = towerStats(t); if (typeof refreshInfo === 'function') { hudCache.info = null; refreshInfo(); } };
const midMap = () => [(COLS / 2) * L.cw, (ROWS / 2) * L.cw];

// ---------- Brouillard ----------
function clearFog(how) {
  if (G.weather !== 'fog' || G.fogClear > 0) return;
  G.fogClear = 15; restat();
  const [x, y] = midMap(); ono(how === 'blow' ? T('PFIOUUU !') : T('ZOUH !'), x, y, '#ffffff', 0.7, 0, 1.1); Snd.play('vent');
  trophy(how === 'blow' ? 'egg_blow' : 'egg_fog_swipe');
  // Première fois avec les doigts : Yglou propose de souffler, en expliquant pourquoi il faut le micro
  if (how === 'swipe' && !store.get(MIC_ASKED) && (typeof parentMic !== 'function' || parentMic()) && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) micAsk();
}
function micAsk() {
  store.set(MIC_ASKED, true);
  ACT.askPaused = G.paused; G.paused = true;
  $('#micAsk').hidden = false;
  drawYglou(prepMini($('#micYg'), 72, 72), 36, 44, 60, 'wink', 0, { noShadow: true, noConfetti: true });
}
function micAnswer(yes) {
  $('#micAsk').hidden = true; if (G) G.paused = !!ACT.askPaused;
  store.set(MIC_KEY, yes ? 'on' : 'off');
  if (yes) micOpen();
}
$('#micYes').addEventListener('click', () => micAnswer(true));
$('#micNo').addEventListener('click', () => micAnswer(false));
// Le micro n'est ouvert que pendant un brouillard, et seulement pour mesurer le souffle (rien n'est enregistré ni envoyé)
async function micOpen() {
  if (ACT.mic || ACT.micOpening) return;
  ACT.micOpening = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    const ac = new (window.AudioContext || window.webkitAudioContext)(), src = ac.createMediaStreamSource(stream), an = ac.createAnalyser();
    an.fftSize = 512; src.connect(an);
    ACT.mic = { stream, ac, an, wave: new Uint8Array(an.fftSize), freq: new Uint8Array(an.frequencyBinCount) };
  } catch (e) { store.set(MIC_KEY, 'off'); }
  ACT.micOpening = false;
}
function micClose() {
  if (!ACT.mic) return;
  ACT.mic.stream.getTracks().forEach(t => t.stop()); try { ACT.mic.ac.close(); } catch (e) {}
  ACT.mic = null; ACT.blowT = 0;
}
// Un souffle : un bruit fort, surtout dans les graves, qui dure un quart de seconde
function micBlow(dt) {
  const m = ACT.mic; if (!m) return;
  m.an.getByteTimeDomainData(m.wave); m.an.getByteFrequencyData(m.freq);
  let s = 0; for (const v of m.wave) { const d = (v - 128) / 128; s += d * d; }
  const rms = Math.sqrt(s / m.wave.length), n = m.freq.length, low = m.freq.slice(0, n / 8).reduce((a, b) => a + b, 0), all = m.freq.reduce((a, b) => a + b, 0) || 1;
  ACT.blowT = rms > 0.09 && low / all > 0.35 ? ACT.blowT + dt : Math.max(0, ACT.blowT - dt * 2);
  if (ACT.blowT > 0.25) { ACT.blowT = 0; clearFog('blow'); }
}

// ---------- Gestes sur la carte : balayer (brouillard) et frotter (blizzard) ----------
cv.addEventListener('pointerdown', ev => {
  if (!actOn()) return;
  const b = cv.getBoundingClientRect(), [q, r] = toGrid(ev.clientX - b.left, ev.clientY - b.top);
  if (inside(q, r) && towerAt(q, r)) return; // une tour sous le doigt : c'est un glisser-déposer de fusion
  ACT.path = { id: ev.pointerId, pts: [[ev.clientX, ev.clientY, performance.now()]] };
}, { passive: true });
cv.addEventListener('pointermove', ev => { if (ACT.path && ev.pointerId === ACT.path.id) ACT.path.pts.push([ev.clientX, ev.clientY, performance.now()]); }, { passive: true });
const endPath = ev => {
  const p = ACT.path; ACT.path = null;
  if (!p || ev.pointerId !== p.id || !actOn() || p.pts.length < 3) return;
  let len = 0, flips = 0, lastSign = 0;
  for (let i = 1; i < p.pts.length; i++) {
    const dx = p.pts[i][0] - p.pts[i - 1][0], dy = p.pts[i][1] - p.pts[i - 1][1]; len += Math.hypot(dx, dy);
    const main = Math.abs(dx) > Math.abs(dy) ? dx : dy, sg = Math.abs(main) > 4 ? Math.sign(main) : 0;
    if (sg && lastSign && sg !== lastSign) flips++; if (sg) lastSign = sg;
  }
  const dur = p.pts[p.pts.length - 1][2] - p.pts[0][2], now = performance.now();
  // Brouillard : deux grands balayages rapides
  if (G.weather === 'fog' && len > 0.35 * Math.min(L.w, L.h) && dur < 700) {
    ACT.swipes = ACT.swipes.filter(t => now - t < 3000); ACT.swipes.push(now);
    if (ACT.swipes.length >= 2) { ACT.swipes = []; clearFog('swipe'); }
  }
  // Blizzard : frotter (au moins 5 allers-retours)
  if (G.weather === 'blizzard' && flips >= 5 && dur < 2500 && G.warmWave !== G.wave) {
    G.warmWave = G.wave; G.warmT = 10; restat();
    const [x, y] = midMap(); ono(T('ÇA RÉCHAUFFE !'), x, y, '#ff9a3d', 0.7, 0, 1.1); Snd.play('feu');
    for (const t of G.towers) burst(t.x, t.y, 0.4, 6, ['#ffb03d', '#ff7a3d', '#ffe066'], 1.6, 0.07, 2, 0.6);
    trophy('egg_rub');
  }
};
cv.addEventListener('pointerup', endPath, { passive: true });
cv.addEventListener('pointercancel', () => { ACT.path = null; }, { passive: true });

// ---------- Inclinaison : le vent de la tempête ----------
addEventListener('deviceorientation', ev => {
  if (ev.beta == null || ev.gamma == null) return;
  // Inclinaison dans le repère de l'écran (selon la rotation de l'affichage)
  const a = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) % 360, b = ev.beta, g = ev.gamma;
  ACT.tilt = a === 90 ? [b, -g] : a === 270 || a === -90 ? [-b, g] : a === 180 ? [-g, -b] : [g, b];
});
function tiltWind(dt) {
  if (G.weather !== 'storm' || !ACT.tilt) { G.windS = G.windW = null; ACT.base = null; ACT.tiltT = 0; return; }
  if (!ACT.base) ACT.base = ACT.tilt.slice(); // position de départ : la façon dont le joueur tient son téléphone
  const dx = ACT.tilt[0] - ACT.base[0], dy = ACT.tilt[1] - ACT.base[1], d = Math.hypot(dx, dy);
  const m = clamp((d - 6) / 20, 0, 1), sx = d ? dx / d : 0, sy = d ? dy / d : 0;
  G.windS = { x: sx, y: sy, m };
  G.windW = L.portrait ? { x: sy, y: sx, m } : { x: sx, y: sy, m }; // à l'écran → sur la carte (en portrait, la carte est tournée)
  ACT.tiltT = m > 0.8 ? ACT.tiltT + dt : 0;
  if (ACT.tiltT > 1.5) trophy('egg_tilt');
}

// ---------- Secouer : séisme ----------
addEventListener('devicemotion', ev => {
  const a = ev.accelerationIncludingGravity; if (!a || a.x == null || !actOn()) return;
  const now = performance.now(), jolt = Math.abs(Math.hypot(a.x, a.y, a.z) - 9.81);
  if (jolt < 14 || (ACT.peaks.length && now - ACT.peaks[ACT.peaks.length - 1] < 120)) return;
  ACT.peaks = ACT.peaks.filter(t => now - t < 1000); ACT.peaks.push(now);
  if (ACT.peaks.length >= 3 && G.waveActive && G.quakeWave !== G.wave) {
    ACT.peaks = []; G.quakeWave = G.wave;
    for (const e of G.enemies) if (!e.dead && !e.flying) { const boss = ETYPES[e.type].boss; e.stun = Math.max(e.stun || 0, boss ? 0.6 : 1.6); hurt(e, e.maxHp * (boss ? 0.03 : 0.08), 'terre', null); }
    G.shake = Math.max(G.shake, 1.2); const [x, y] = midMap(); ono(T('SÉISME !'), x, y, '#c08a58', 0.8, 0, 1.2); Snd.play('terre');
    try { navigator.vibrate && navigator.vibrate([60, 40, 90]); } catch (e) {}
    trophy('egg_shake');
  }
});

// ---------- Boucle : minuteries, vent, souffle ----------
setInterval(() => {
  const now = performance.now(), dt = Math.min(0.2, (now - ACT.last) / 1000); ACT.last = now;
  if (!G || G.demo) { micClose(); return; }
  const live = actOn();
  if (G.fogClear > 0 && live) { G.fogClear -= dt; if (G.fogClear <= 0) { G.fogClear = 0; restat(); } }
  G.fogA = clamp((G.fogA ?? 1) + ((G.fogClear > 0 ? 0 : 1) - (G.fogA ?? 1)) * Math.min(1, dt * 2.5), 0, 1);
  if (G.warmT > 0 && live) { G.warmT -= dt; if (G.warmT <= 0) { G.warmT = 0; restat(); } }
  if (live) tiltWind(dt); else if (!G.duel && !G.coop) { G.windS = G.windW = null; }
  // Micro : ouvert seulement pendant un brouillard en cours, si le joueur l'a accepté
  if (live && G.weather === 'fog' && store.get(MIC_KEY) === 'on' && (typeof parentMic !== 'function' || parentMic())) { micOpen(); if (!(G.fogClear > 0)) micBlow(dt); } else micClose();
}, 50);
