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
  Snd.init(); show('profile'); screens.profile.scrollTop = 0; if (typeof refreshTrophyBtn === 'function') refreshTrophyBtn();
  $('#prName').value = store.get('elemento.pseudo') || '';
  const best = store.get(BEST2) || {}, owned = MAPS.filter((m, i) => !m.season && !m.random && mapOwned(i)).length, wins = Object.values(best).reduce((n, r) => n + Object.values(r).filter(x => x && x.won).length, 0);
  const n = v => (IS_EN ? v.toLocaleString('en-US') : v.toLocaleString('fr-FR')), h = Math.floor(stats.time / 3600), mn = Math.floor(stats.time / 60) % 60;
  const pl = (v, one, many) => n(v) + T(v === 1 ? one : many);
  $('#prStats2').textContent = pl(stats.games, ' partie · ', ' parties · ') + pl(stats.kills, ' ennemi vaincu · ', ' ennemis vaincus · ') + n(stats.bosses) + (IS_EN && stats.bosses !== 1 ? ' bosses · ' : ' boss · ') + pl(stats.towers, ' tour posée · ', ' tours posées · ') + (h ? h + ' h ' + String(mn).padStart(2, '0') : mn + ' min') + T(' de jeu');
  $('#prStats').textContent = (meta.shards || 0) + T(' éclats · ') + (meta.earned || 0) + T(' gagnés en tout · cagnotte ') + (meta.bank || 0) + T(' or · ') + owned + T('/10 cartes · ') + wins + (IS_EN ? ' win' + (wins === 1 ? '' : 's') : ' victoire' + (wins > 1 ? 's' : ''));
}
$('#tProfile').addEventListener('click', openProfile);
$('#prName').addEventListener('input', ev => { store.set('elemento.pseudo', ev.target.value.trim().slice(0, 12)); refreshProfileChip(); });
$('#prName').addEventListener('keydown', ev => ev.stopPropagation());
// Champ laissé vide : on redonne un pseudo au hasard
$('#prName').addEventListener('change', ev => { if (!ev.target.value.trim()) { ev.target.value = randomPseudo(); store.set('elemento.pseudo', ev.target.value); refreshProfileChip(); } });
$('#prBack').addEventListener('click', () => { $('#prResetBox').hidden = true; show('title'); });

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
