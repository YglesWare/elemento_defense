// Élémento Defense : écran Multijoueur (étape 1 : connexion et salon d'attente) + jeu installable hors ligne.
'use strict';

const GH_URL = 'https://yglesware.github.io/elemento_defense/';
const MP = { state: 'home', err: '', info: '', code: '', hostName: '', scanFor: null, busyText: '', manual: false, camFail: false };
screens.multi = $('#sMulti');
const mpName = () => (store.get('elemento.pseudo') || '').slice(0, 12);
const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ---------- Caméra et QR codes ----------
let camStream = null, camRaf = 0, jsqrLoad = null, mpTimer = 0;
function loadJsQR() {
  if (typeof jsQR !== 'undefined') return Promise.resolve();
  return jsqrLoad || (jsqrLoad = new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'js/vendor/jsQR.js'; sc.onload = ok; sc.onerror = () => ko(new Error('Lecteur de QR code introuvable.')); document.head.appendChild(sc); }));
}
// Tant que la caméra est active, le navigateur donne la vraie adresse locale du téléphone
// (sinon il la masque derrière un nom en « .local », que certains réseaux ne savent pas résoudre).
function openCamera() {
  const ask = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  const late = new Promise(res => setTimeout(() => res(null), 10000));
  return Promise.race([ask, late]).then(st => { if (!st) ask.then(closeCamera, () => {}); return st; });
}
const closeCamera = s => { if (s) s.getTracks().forEach(t => t.stop()); };
async function startScan(onCode) {
  const video = $('#mpVideo');
  camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  video.srcObject = camStream; video.setAttribute('playsinline', ''); video.muted = true; await video.play();
  let det = null;
  if ('BarcodeDetector' in window) { try { const f = await BarcodeDetector.getSupportedFormats(); if (f.includes('qr_code')) det = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) {} }
  if (!det) await loadJsQR();
  const cvs = document.createElement('canvas'), cx = cvs.getContext('2d', { willReadFrequently: true });
  let busy = false;
  const loop = async () => {
    if (!camStream) return;
    if (!busy && video.readyState >= 2 && video.videoWidth) {
      busy = true; let txt = null;
      try {
        if (det) { const r = await det.detect(video); if (r && r[0]) txt = r[0].rawValue; }
        else {
          const w = Math.min(720, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
          cvs.width = w; cvs.height = h; cx.drawImage(video, 0, 0, w, h);
          const r = jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' }); if (r) txt = r.data;
        }
      } catch (e) {}
      busy = false;
      if (txt && txt.startsWith(QR_PREFIX)) { cancelAnimationFrame(camRaf); const keep = camStream; camStream = null; try { navigator.vibrate && navigator.vibrate(30); } catch (e) {} onCode(txt, keep); return; }
    }
    camRaf = requestAnimationFrame(loop);
  };
  loop();
}
function stopScan() { cancelAnimationFrame(camRaf); if (camStream) camStream.getTracks().forEach(t => t.stop()); camStream = null; }
function drawQR(canvas, text) {
  const q = qrcode(0, 'L'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4, size = n + m * 2, px = Math.max(4, Math.floor(640 / size));
  canvas.width = canvas.height = size * px;
  const c = canvas.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect((k + m) * px, (r + m) * px, px, px);
}
function camError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'La caméra est refusée. Autorise-la dans les réglages du navigateur pour ce site, puis réessaie.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Aucune caméra trouvée sur cet appareil. Utilise « Saisir le code à la main ».';
  return (e && e.message) || 'La caméra ne s’est pas lancée.';
}

// ---------- États de l'écran ----------
function mpGo(state, extra) {
  stopScan(); clearTimeout(mpTimer);
  Object.assign(MP, { state, err: '', info: '', manual: false, camFail: false }, extra || {});
  renderMP();
}
function rosterHTML() {
  const ps = Net.players.length ? Net.players : [{ name: mpName() || 'Toi', host: true, ping: 0, id: 'me' }];
  return '<ul class="mp-list">' + ps.map(p => '<li><span class="mp-dot"></span><b>' + esc(p.name) + '</b>' + (p.host ? '<span class="mp-tag">hôte</span>' : '') + (Net.me && p.id === Net.me.id ? '<span class="mp-tag you">toi</span>' : '') + '<span class="mp-ping">' + (p.host && Net.role === 'host' ? '' : p.ping ? p.ping + ' ms' : '') + '</span></li>').join('') + '</ul>';
}
function manualHTML(copyCode) {
  return '<details class="mp-manual"' + (MP.manual ? ' open' : '') + '><summary>Pas de caméra ? Saisir le code à la main</summary>'
    + (copyCode ? '<p class="fine">Ton code, à transmettre :</p><textarea readonly id="mpCodeOut" rows="3">' + esc(copyCode) + '</textarea><button class="sbtn" type="button" id="mpCopy">Copier le code</button>' : '')
    + '<p class="fine">Code reçu :</p><textarea id="mpCodeIn" rows="3" placeholder="Colle le code ici"></textarea><button class="sbtn" type="button" id="mpPaste">Valider le code</button></details>';
}
function mapPickHTML(canPick) {
  const m = MAPS[DUEL.lobbyMap] || MAPS[0];
  return '<div class="mp-map">' + (canPick ? '<button class="ibtn" type="button" data-a="map-prev" aria-label="Carte précédente">◀</button>' : '')
    + '<div class="mp-mapn"><small>Carte</small><b>' + esc(m.name) + '</b><span>biome ' + m.biome.name.toLowerCase() + '</span></div>'
    + (canPick ? '<button class="ibtn" type="button" data-a="map-next" aria-label="Carte suivante">▶</button>' : '') + '</div>';
}
function rulesHTML() {
  return '<details class="mp-manual"><summary>Règles du duel</summary><ul class="tips">'
    + '<li>Mode infini, tout le monde repart de zéro : Braise et Ondine, 200 or, 0 éclat. Ta progression solo n’est pas touchée.</li>'
    + '<li>Une vague part toutes les 25 s pour tout le monde. Pas de pause ni d’accélération.</li>'
    + '<li>Onglet « Envoyer » : dépense de l’or pour envoyer des ennemis à ta cible. Chaque envoi augmente ton revenu, versé à chaque vague.</li>'
    + '<li>Les éclats gagnés à chaque vague servent dans l’Atelier (bouton violet), qui ne met pas le jeu en pause.</li>'
    + '<li>Le dernier survivant gagne. Quitter l’appli plus de 10 s élimine.</li></ul></details>';
}
function renderMP() {
  const b = $('#mpBody'), S = MP.state, name = mpName();
  let h = '';
  if (MP.err) h += '<p class="mp-err">' + esc(MP.err) + '</p>';
  if (MP.info) h += '<p class="mp-info">' + esc(MP.info) + '</p>';
  if (S === 'unsupported') {
    h += '<p class="trnote">Le multijoueur a besoin d’un navigateur récent, de la caméra et d’une liaison directe entre téléphones. Cette version du jeu ne le permet pas.</p>'
      + '<p class="fine" style="text-align:left">Ouvre le jeu depuis cette adresse, sur chaque téléphone :</p><p class="mp-url">' + GH_URL + '</p>'
      + '<button class="btn alt" type="button" data-a="back">Retour</button>';
  } else if (S === 'home') {
    h += '<p class="trnote">De 2 à 4 joueurs, téléphones côte à côte, <b>sans internet</b>. Connectez-vous au même Wi-Fi, ou activez le partage de connexion d’un des téléphones et connectez les autres dessus.</p>'
      + '<label class="mp-label" for="mpName">Ton pseudo</label><input id="mpName" class="mp-input" maxlength="12" autocomplete="nickname" placeholder="Ex. Léa" value="' + esc(name) + '">'
      + '<button class="btn" type="button" data-a="create">Créer une partie</button>'
      + '<button class="btn green" type="button" data-a="join">Rejoindre une partie</button>'
      + '<button class="btn alt" type="button" data-a="back">Retour</button>';
  } else if (S === 'busy') {
    h += '<p class="mp-busy">' + esc(MP.busyText || 'Un instant…') + '</p><button class="btn alt" type="button" data-a="cancel">Annuler</button>';
  } else if (S === 'host') {
    const full = Net.players.length >= NET_MAX;
    h += '<h3 class="mp-h">Salon · ' + Net.players.length + '/' + NET_MAX + ' joueurs</h3>' + rosterHTML()
      + (full ? '<p class="fine">La partie est complète.</p>' : '<button class="btn green" type="button" data-a="invite">Inviter un joueur</button>')
      + mapPickHTML(true)
      + '<button class="btn" type="button" data-a="launch"' + (Net.players.length < 2 ? ' disabled' : '') + '>' + (Net.players.length < 2 ? 'Invite au moins 1 joueur' : 'Lancer la partie !') + '</button>'
      + rulesHTML()
      + '<button class="btn pink" type="button" data-a="leave">Fermer la partie</button>';
  } else if (S === 'invite') {
    h += '<h3 class="mp-h">1. Fais scanner ce QR code</h3><p class="fine" style="text-align:left">Ton ami touche « Rejoindre une partie » et vise ce QR avec sa caméra. Monte la luminosité de ton écran.</p>'
      + '<canvas class="mp-qr" id="mpQr"></canvas>'
      + '<h3 class="mp-h">2. Scanne sa réponse</h3><button class="btn" type="button" data-a="scan-answer">Scanner sa réponse</button>'
      + manualHTML(MP.code) + '<button class="btn alt" type="button" data-a="cancel">Annuler</button>';
  } else if (S === 'scan') {
    h += '<h3 class="mp-h">' + (MP.scanFor === 'answer' ? 'Vise le QR de réponse de ton ami' : 'Vise le QR code affiché par l’hôte') + '</h3>'
      + (MP.camFail ? '' : '<div class="mp-cam"><video id="mpVideo" playsinline muted></video><span class="mp-frame"></span></div>')
      + manualHTML(null)
      + '<button class="btn alt" type="button" data-a="' + (MP.scanFor === 'answer' ? 'back-invite' : 'cancel') + '">Annuler</button>';
  } else if (S === 'answer') {
    h += '<h3 class="mp-h">Montre ce QR code à ' + esc(MP.hostName) + '</h3><p class="fine" style="text-align:left">' + esc(MP.hostName) + ' touche « Scanner sa réponse » et vise ton écran. La connexion se fait toute seule ensuite.</p>'
      + '<canvas class="mp-qr" id="mpQr"></canvas><p class="mp-busy">En attente de connexion…</p>'
      + manualHTML(MP.code) + '<button class="btn alt" type="button" data-a="cancel">Annuler</button>';
  } else if (S === 'lobby') {
    const hp = Net.players.find(p => p.host);
    h += '<h3 class="mp-h">Connecté ! · ' + Net.players.length + '/' + NET_MAX + ' joueurs</h3>' + rosterHTML()
      + mapPickHTML(false)
      + '<p class="mp-busy">En attente que ' + esc(hp ? hp.name : 'l’hôte') + ' lance la partie…</p>' + rulesHTML()
      + '<button class="btn pink" type="button" data-a="leave">Quitter la partie</button>';
  }
  b.innerHTML = h;
  const qr = $('#mpQr'); if (qr && MP.code) { try { drawQR(qr, MP.code); } catch (e) { MP.err = 'Impossible de dessiner le QR code.'; } }
  if (S === 'scan' && !MP.camFail) startScan((txt, cam) => MP.scanFor === 'answer' ? hostGotAnswer(txt, cam) : guestGotOffer(txt, cam)).catch(e => { if (MP.state !== 'scan') return; stopScan(); MP.camFail = true; MP.manual = true; MP.err = camError(e); renderMP(); });
}

// ---------- Actions ----------
function needName() {
  const inp = $('#mpName'), v = (inp ? inp.value : mpName()).trim().slice(0, 12);
  if (!v) { MP.err = 'Choisis un pseudo pour que les autres te reconnaissent.'; renderMP(); return null; }
  store.set('elemento.pseudo', v); return v;
}
async function hostInvite() {
  mpGo('busy', { busyText: 'Préparation de l’invitation…' });
  let cam = null;
  try {
    cam = await openCamera().catch(() => null);
    const code = await Net.createInvite();
    if (MP.state === 'busy') mpGo('invite', { code });
  } catch (e) { mpGo('host', { err: e.message || String(e) }); }
  finally { closeCamera(cam); }
}
async function hostGotAnswer(txt, cam) {
  closeCamera(cam);
  mpGo('busy', { busyText: 'Connexion en cours…' });
  try {
    await Net.acceptAnswer(txt);
    mpTimer = setTimeout(() => { if (MP.state === 'busy') mpGo('host', { err: 'La connexion n’a pas abouti. Vérifiez que les téléphones sont sur le même Wi-Fi ou partage de connexion, puis recommencez l’invitation.' }); }, 20000);
  } catch (e) { mpGo('host', { err: e.message || String(e) }); }
}
async function guestGotOffer(txt, cam) {
  const name = mpName() || 'Joueur';
  mpGo('busy', { busyText: 'Préparation de ta réponse…' });
  try {
    if (!cam) cam = await openCamera().catch(() => null);
    const { hostName, code } = await Net.join(name, txt).finally(() => closeCamera(cam));
    mpGo('answer', { code, hostName });
    mpTimer = setTimeout(() => { if (MP.state === 'answer') mpGo('home', { err: 'La connexion n’a pas abouti. Vérifiez que les téléphones sont sur le même Wi-Fi ou partage de connexion, puis recommencez.' }); Net.reset(); }, 90000);
  } catch (e) { mpGo('home', { err: e.message || String(e) }); }
}
function mpCancel() {
  if (MP.state === 'home' || MP.state === 'unsupported') { stopScan(); show('title'); return; }
  if (Net.role === 'host' && (MP.state === 'invite' || MP.state === 'busy' || MP.state === 'scan')) { mpGo('host'); return; }
  if (Net.role === 'host' || MP.state === 'lobby') { Net.leave(); }
  else Net.reset();
  mpGo('home');
}
$('#mpBody').addEventListener('click', ev => {
  const el = ev.target.closest('[data-a], #mpCopy, #mpPaste'); if (!el) return;
  Snd.init();
  if (el.id === 'mpCopy') {
    const ta = $('#mpCodeOut'); const done = () => { MP.info = 'Code copié.'; MP.manual = true; renderMP(); };
    navigator.clipboard && navigator.clipboard.writeText(MP.code).then(done, () => { ta.select(); });
    return;
  }
  if (el.id === 'mpPaste') {
    const v = ($('#mpCodeIn').value || '').trim(); if (!v) return;
    if (Net.role === 'host') hostGotAnswer(v); else guestGotOffer(v);
    return;
  }
  const a = el.dataset.a;
  if (a === 'back') { show('title'); }
  else if (a === 'create') { const n = needName(); if (!n) return; Net.host(n); keepAwake(); mpGo('host'); }
  else if (a === 'join') { const n = needName(); if (!n) return; keepAwake(); mpGo('scan', { scanFor: 'offer' }); }
  else if (a === 'invite') hostInvite();
  else if (a === 'scan-answer') mpGo('scan', { scanFor: 'answer', code: MP.code });
  else if (a === 'back-invite') mpGo('invite', { code: MP.code });
  else if (a === 'cancel' || a === 'leave') mpCancel();
  else if (a === 'map-prev' || a === 'map-next') { DUEL.lobbyMap = (DUEL.lobbyMap + (a === 'map-next' ? 1 : MAPS.length - 1)) % MAPS.length; Net.send('all', { k: 'lobby', map: DUEL.lobbyMap }); renderMP(); }
  else if (a === 'launch') duelHostStart();
});
// Garde le panneau de saisie manuelle ouvert d'un affichage à l'autre
$('#mpBody').addEventListener('toggle', ev => { if (ev.target.classList && ev.target.classList.contains('mp-manual')) MP.manual = ev.target.open; }, true);

Net.on('roster', () => {
  if (MP.state === 'answer' && Net.role === 'guest') { mpGo('lobby'); Snd.play('clear'); return; }
  if (MP.state === 'host' || MP.state === 'lobby') renderMP();
});
Net.on('join', id => {
  const p = Net.players.find(x => x.id === id);
  Snd.play('clear');
  if (Net.role === 'host') mpGo('host', { info: (p ? p.name : 'Un joueur') + ' a rejoint la partie !' });
});
Net.on('leave', () => { if (MP.state === 'host') renderMP(); });
Net.on('closed', msg => mpGo('home', { err: msg }));
Net.on('error', msg => mpGo('home', { err: msg }));

function openMulti() {
  const ok = Net.supported() && navigator.mediaDevices && window.isSecureContext && !/claude/.test(location.hostname);
  show('multi'); screens.multi.scrollTop = 0;
  if (Net.role) mpGo(Net.role === 'host' ? 'host' : 'lobby');
  else mpGo(ok ? 'home' : 'unsupported');
}
$('#tMulti').addEventListener('click', () => { Snd.init(); openMulti(); });
document.addEventListener('keydown', ev => { if (curScreen === 'multi' && ev.key === 'Escape') mpCancel(); });

// ---------- Jeu installable hors ligne ----------
if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude/.test(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
