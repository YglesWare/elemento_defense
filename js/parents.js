// Élémento Defense : espace parents, protégé par un code à 6 chiffres.
// Le code se crée après un calcul écrit en lettres (pour qu'un adulte soit là), et se refait de la même façon s'il est oublié.
// Réglages : jeu en ligne, ajout d'amis par l'enfant, limite de temps par jour, pas d'en-ligne le soir, vidéos à récompense, micro,
// et la liste d'amis de l'enfant (js/friends.js). Ils sont sauvegardés avec la progression (domaine « profile ») :
// une réinitialisation de la progression ne les efface pas, et ils suivent le compte sur un autre téléphone.
'use strict';

const PARENT_KEY = 'elemento.parent', PLOCK_KEY = 'elemento.parentLock', PDAY_KEY = 'elemento.playDay';
STORE_DOMAINS[PARENT_KEY] = 'profile';
if (typeof RESET_KEEP !== 'undefined') RESET_KEEP.push(PARENT_KEY);
const PARENT_DEF = { pin: null, online: true, childAdd: true, emotes: true, dayLimit: 0, nightFrom: '', ads: false, mic: true };
const parent = () => Object.assign({}, PARENT_DEF, store.get(PARENT_KEY) || {});
function parentSet(k, v) { const p = parent(); p[k] = v; store.set(PARENT_KEY, p); }
// Le soir (de l'heure choisie à 6 h), pas de jeu en ligne ; le solo reste possible
function nightNow(p = parent()) {
  if (!p.nightFrom) return false;
  const [h, m] = p.nightFrom.split(':').map(Number), d = new Date(), now = d.getHours() * 60 + d.getMinutes();
  return now >= h * 60 + m || now < 6 * 60;
}
const onlineAllowed = () => { const p = parent(); return p.online && !nightNow(p); };
const parentMic = () => parent().mic;
// Vidéos à récompense (js/ads.js) : proposées tant qu'aucun code parent n'existe ; dès qu'un parent crée son code,
// elles sont coupées, et il peut les rallumer dans les réglages
const adsAllowed = () => { const p = parent(); return !p.pin || p.ads === true; };

// ---------- Temps de jeu par jour ----------
function playDay() { const r = store.get(PDAY_KEY) || {}; return r.d === dayKey() ? r : { d: dayKey(), s: 0, extra: 0 }; }
function timeUp() { const p = parent(); if (!p.dayLimit) return false; const r = playDay(); return r.s >= (p.dayLimit + (r.extra || 0)) * 60; }
let pdAcc = 0;
// Appelé par la boucle du jeu (js/ui.js) pendant qu'une partie tourne
function playTick(dt) {
  if (!G || G.demo) return;
  pdAcc += dt; if (pdAcc < 5) return;
  const r = playDay(); r.s += pdAcc; pdAcc = 0; store.set(PDAY_KEY, r);
  // En multijoueur, on laisse finir la partie (les autres joueurs n'y sont pour rien) ; la suivante sera refusée
  if (timeUp() && !G.duel && !G.coop && curScreen === 'game' && !G.over) showTimeUp();
}
const fmtMin = m => m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : '') : m + ' min';
function showTimeUp() {
  if (G && !G.over) G.paused = true;
  const p = parent(), box = $('#timeUp');
  $('#tuText').textContent = T('Tu as joué ') + fmtMin(p.dayLimit + (playDay().extra || 0)) + T(' aujourd’hui. On se repose les yeux, et on reprend demain !');
  $('#tuSave').hidden = !(G && !G.over);
  box.hidden = false;
  drawYglou(prepMini($('#tuYg'), 72, 72), 36, 44, 60, 'happy', 0, { noShadow: true, noConfetti: true });
}
$('#tuOk').addEventListener('click', () => { $('#timeUp').hidden = true; if (G && curScreen === 'game') { G = null; show('title'); } });
$('#tuParent').addEventListener('click', () => { $('#timeUp').hidden = true; openParents('extend'); });
// Limite atteinte : pas de nouvelle partie depuis l'accueil
for (const id of ['#tPlay', '#tMulti', '#tContinue']) $(id).addEventListener('click', ev => { if (timeUp()) { ev.stopImmediatePropagation(); showTimeUp(); } }, true);

// ---------- Code parent ----------
async function pinHash(pin, salt) {
  const txt = 'elemento-parent:' + salt + ':' + pin;
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 2166136261; for (const ch of txt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return 'f' + h.toString(16); }
}
const plock = () => store.get(PLOCK_KEY) || { f: 0, u: 0 };
// Calcul écrit en lettres : une multiplication puis une soustraction, différent à chaque fois
const FR_U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const EN_U = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
function numWords(n) {
  const U = IS_EN ? EN_U : FR_U, D = IS_EN ? { 20: 'twenty', 30: 'thirty', 40: 'forty' } : { 20: 'vingt', 30: 'trente', 40: 'quarante' };
  if (n < 20) return U[n];
  const t = Math.floor(n / 10) * 10, u = n % 10;
  return u === 0 ? D[t] : u === 1 && !IS_EN ? D[t] + ' et un' : D[t] + '-' + U[u];
}
function newMath() {
  const a = 12 + Math.floor(Math.random() * 38), b = 3 + Math.floor(Math.random() * 7), c = 2 + Math.floor(Math.random() * 18);
  return { q: numWords(a) + T(' multiplié par ') + numWords(b) + T(', moins ') + numWords(c), a: a * b - c };
}

// ---------- Écrans ----------
screens.parents = $('#sParents');
const PA = { view: 'pin', entry: '', first: '', math: null, then: null, msg: '' };
function openParents(then) {
  Snd.init();
  PA.then = then || null; PA.entry = ''; PA.first = ''; PA.msg = '';
  PA.view = parent().pin ? 'pin' : 'math';
  if (PA.view === 'math') PA.math = newMath();
  show('parents'); screens.parents.scrollTop = 0; paRender();
}
function paClose() {
  PA.view = 'pin'; PA.entry = '';
  if (typeof frPaint === 'function') frPaint();
  if (curScreen === 'parents') show(PA.then === 'extend' ? (G ? 'game' : 'title') : 'profile');
  if (PA.then === 'extend' && G) { G.paused = false; if (typeof resume === 'function') resume(); }
  PA.then = null;
}
const paDots = n => '<div class="padots">' + Array.from({ length: 6 }, (_, i) => '<span class="' + (i < n ? 'on' : '') + '"></span>').join('') + '</div>';
const paPad = () => '<div class="papad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : '<button class="sbtn" type="button" data-k="' + k + '">' + k + '</button>').join('') + '</div>';
const toggle = (k, on) => '<button class="patog' + (on ? ' on' : '') + '" type="button" data-tog="' + k + '" role="switch" aria-checked="' + on + '"></button>';
const LIMITS = [0, 30, 45, 60, 90, 120, 180], NIGHTS = ['', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];

function paRender() {
  const b = $('#paBody'), p = parent(), lk = plock(), wait = Math.max(0, Math.ceil((lk.u - Date.now()) / 60000));
  let h = '';
  if (PA.view === 'pin') {
    h = '<div class="pahead"><span class="mp-label">' + T('Code parent') + '</span><p class="pa-q">' + T('Tape les 6 chiffres') + '</p>' + paDots(PA.entry.length)
      + (wait ? '<p class="fine pa-err">' + T('Trop d’erreurs : réessaie dans ') + wait + ' min.</p>' : PA.msg ? '<p class="fine pa-err">' + PA.msg + '</p>' : '')
      + '<button class="linkbtn" id="paForgot" type="button">' + T('Code oublié ?') + '</button></div>' + paPad();
  } else if (PA.view === 'math') {
    h = '<div class="pahead"><span class="mp-label">' + T('Réservé aux adultes') + '</span>'
      + '<p class="pa-q">' + (parent().pin ? T('Pour refaire le code parent, écris en chiffres le résultat de :') : T('Pour créer le code parent, écris en chiffres le résultat de :')) + '</p>'
      + '<p class="pa-math">' + PA.math.q + '</p><div class="pa-ans">' + (PA.entry || '&nbsp;') + '</div>'
      + (PA.msg ? '<p class="fine pa-err">' + PA.msg + '</p>' : '') + '</div>'
      + '<div class="papad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].map(k => '<button class="sbtn' + (k === 'OK' ? ' ok' : '') + '" type="button" data-k="' + k + '">' + k + '</button>').join('') + '</div>';
  } else if (PA.view === 'new' || PA.view === 'new2') {
    h = '<div class="pahead"><span class="mp-label">' + T('Nouveau code parent') + '</span><p class="pa-q">' + (PA.view === 'new' ? T('Choisis 6 chiffres que l’enfant ne connaît pas') : T('Tape-les une deuxième fois')) + '</p>'
      + paDots(PA.entry.length) + (PA.msg ? '<p class="fine pa-err">' + PA.msg + '</p>' : '') + '</div>' + paPad();
  } else if (PA.view === 'settings') {
    const played = Math.round(playDay().s / 60), fr = typeof frOn === 'function' && typeof cloudOff === 'function' && !cloudOff();
    const row = (title, sub, ctl) => '<div class="paset"><div><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + ctl + '</div>';
    h = '<span class="mp-label">' + T('En ligne') + '</span>'
      + row(T('Jeu en ligne et amis'), T('Coupé : seulement le solo et le multi « À côté »'), toggle('online', p.online))
      + row(T('Ajout d’amis par l’enfant'), T('Coupé : seul un parent ajoute ses amis et accepte ses demandes'), toggle('childAdd', p.childAdd))
      + row(T('Émoticônes en partie'), T('Messages tout faits entre joueurs (aucun texte libre)'), toggle('emotes', p.emotes))
      + row(T('Pas de jeu en ligne après'), T('Jusqu’à 6 h du matin ; le solo reste possible'), '<button class="sbtn pa-pill" type="button" id="paNight">' + (p.nightFrom || T('Jamais')) + '</button>')
      + '<span class="mp-label">' + T('Temps de jeu') + '</span>'
      + row(T('Limite par jour'), T('Aujourd’hui : ') + fmtMin(played) + T(' joués'), '<button class="sbtn pa-pill" type="button" id="paLimit">' + (p.dayLimit ? fmtMin(p.dayLimit) : T('Aucune')) + '</button>')
      + (p.dayLimit ? row(T('Rallonge pour aujourd’hui'), (playDay().extra ? '+' + fmtMin(playDay().extra) + T(' déjà ajoutées') : ''), '<button class="sbtn pa-pill" type="button" id="paExtra">+15 min</button>') : '')
      + '<span class="mp-label">' + T('Divers') + '</span>'
      + row(T('Vidéos à récompense'), T('Une courte pub contre de l’or ou des éclats, seulement si l’enfant la demande. Coupé : aucune pub'), toggle('ads', p.ads))
      + row(T('Micro (actions secrètes)'), T('Coupé : le jeu ne demande jamais le micro'), toggle('mic', p.mic))
      + row(T('Code parent'), T('6 chiffres, demandé à chaque ouverture'), '<button class="sbtn pa-pill" type="button" id="paChange">' + T('Changer') + '</button>')
      + (fr ? '<button class="btn" type="button" id="paFriends">' + T('👥 Ses amis') + '</button>' : '');
  } else if (PA.view === 'friends' && typeof frParentHTML === 'function') h = frParentHTML();
  b.innerHTML = h;
  b.querySelectorAll('[data-k]').forEach(x => x.addEventListener('click', () => paKey(String(x.dataset.k))));
  b.querySelectorAll('[data-tog]').forEach(x => x.addEventListener('click', () => { const k = x.dataset.tog; parentSet(k, !parent()[k]); if (k === 'mic' && !parent().mic && typeof micClose === 'function') micClose(); paRender(); }));
  const on = (id, fn) => { const e = b.querySelector('#' + id); if (e) e.addEventListener('click', fn); };
  on('paForgot', () => { PA.view = 'math'; PA.math = newMath(); PA.entry = ''; PA.msg = ''; paRender(); });
  on('paNight', () => { parentSet('nightFrom', NIGHTS[(NIGHTS.indexOf(p.nightFrom) + 1) % NIGHTS.length]); paRender(); });
  on('paLimit', () => { parentSet('dayLimit', LIMITS[(LIMITS.indexOf(p.dayLimit) + 1) % LIMITS.length]); paRender(); });
  on('paExtra', () => { const r = playDay(); r.extra = (r.extra || 0) + 15; store.set(PDAY_KEY, r); paRender(); hint(T('+15 min pour aujourd’hui'), 1500); });
  on('paChange', () => { PA.view = 'new'; PA.entry = ''; PA.msg = ''; paRender(); });
  on('paFriends', () => { PA.view = 'friends'; paRender(); if (typeof frLoad === 'function') frLoad(true).then(() => { if (PA.view === 'friends') paRender(); }); });
  if (PA.view === 'friends' && typeof frParentWire === 'function') frParentWire(b);
  $('#paBack').textContent = PA.view === 'friends' ? T('Retour aux réglages') : T('Retour');
}
async function paKey(k) {
  if (PA.view === 'pin' || PA.view === 'new' || PA.view === 'new2') {
    if (PA.view === 'pin' && plock().u > Date.now()) return;
    if (k === '⌫') PA.entry = PA.entry.slice(0, -1); else if (PA.entry.length < 6) PA.entry += k;
    PA.msg = '';
    if (PA.entry.length < 6) return paRender();
    paRender();
    const code = PA.entry; PA.entry = '';
    if (PA.view === 'pin') {
      const p = parent(), ok = p.pin && (await pinHash(code, p.pin.s)) === p.pin.h;
      if (ok) { store.set(PLOCK_KEY, { f: 0, u: 0 }); paUnlocked(); }
      else { const lk = plock(); lk.f = (lk.f || 0) + 1; if (lk.f >= 5) { lk.f = 0; lk.u = Date.now() + 5 * 60e3; } store.set(PLOCK_KEY, lk); PA.msg = T('Ce n’est pas le bon code.'); try { navigator.vibrate && navigator.vibrate(80); } catch (e) {} }
    } else if (PA.view === 'new') { PA.first = code; PA.view = 'new2'; }
    else if (code === PA.first) {
      const s = Math.random().toString(36).slice(2, 10);
      parentSet('pin', { s, h: await pinHash(code, s) }); store.set(PLOCK_KEY, { f: 0, u: 0 });
      hint(T('Code parent enregistré'), 1800); PA.first = ''; paUnlocked();
    } else { PA.view = 'new'; PA.first = ''; PA.msg = T('Les deux codes sont différents : recommence.'); }
    return paRender();
  }
  if (PA.view === 'math') {
    if (k === '⌫') PA.entry = PA.entry.slice(0, -1);
    else if (k === 'OK') {
      if (+PA.entry === PA.math.a) { PA.view = 'new'; PA.msg = ''; }
      else { PA.math = newMath(); PA.msg = T('Raté : voici un autre calcul.'); }
      PA.entry = '';
    } else if (PA.entry.length < 4) PA.entry += k;
    paRender();
  }
}
// Code bon (ou nouveau code créé) : la rallonge du soir, ou les réglages
function paUnlocked() {
  if (PA.then === 'delacct') { paClose(); if (typeof cloudDeleteAccount === 'function') cloudDeleteAccount(); return; }
  if (PA.then === 'extend') { const r = playDay(); r.extra = (r.extra || 0) + 15; store.set(PDAY_KEY, r); hint(T('+15 min pour aujourd’hui'), 1800); paClose(); return; }
  PA.view = 'settings';
}
$('#paBack').addEventListener('click', () => { if (PA.view === 'friends') { PA.view = 'settings'; paRender(); } else paClose(); });
$('#prParents').addEventListener('click', () => openParents());
