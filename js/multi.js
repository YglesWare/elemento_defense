// Élémento Defense : écran Multijoueur (étape 1 : connexion et salon d'attente) + jeu installable hors ligne.
'use strict';

const GH_URL = 'https://yglesware.github.io/elemento_defense/';
// Application Android (Capacitor)
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const MP = { state: 'home', err: '', info: '', code: '', hostName: '', scanFor: null, busyText: '', manual: false, camFail: false, cam: null, facing: (store.get('elemento.mpFacing') === 'environment' ? 'environment' : 'user') };
screens.multi = $('#sMulti');
// Pseudo par défaut au hasard (Yglou + 4 chiffres), en attendant que le joueur choisisse le sien
const randomPseudo = () => 'Yglou' + (1000 + Math.floor(Math.random() * 9000));
if (!(store.get('elemento.pseudo') || '').trim()) store.set('elemento.pseudo', randomPseudo());
const mpName = () => (store.get('elemento.pseudo') || '').slice(0, 12);
const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ---------- Caméra et QR codes ----------
let camStream = null, camRaf = 0, jsqrLoad = null, mpTimer = 0;
function loadJsQR() {
  if (typeof jsQR !== 'undefined') return Promise.resolve();
  return jsqrLoad || (jsqrLoad = new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'js/vendor/jsQR.js'; sc.onload = ok; sc.onerror = () => ko(new Error(T('Lecteur de QR code introuvable.'))); document.head.appendChild(sc); }));
}
// Tant que la caméra est active, le navigateur donne la vraie adresse locale du téléphone
// (sinon il la masque derrière un nom en « .local », que certains réseaux ne savent pas résoudre).
function openCamera(facing = 'environment') {
  const ask = navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
  const late = new Promise(res => setTimeout(() => res(null), 10000));
  return Promise.race([ask, late]).then(st => { if (!st) ask.then(closeCamera, () => {}); return st; });
}
const closeCamera = s => { if (s) s.getTracks().forEach(t => t.stop()); };
// facing : 'user' (caméra avant, téléphones face à face) ou 'environment' (caméra arrière) ; stream : caméra déjà ouverte
// accept : quels QR codes garder (par défaut, ceux du multijoueur) ; videoSel : la vidéo où montrer la caméra
async function startScan(onCode, facing = 'environment', stream = null, accept = null, videoSel = '#mpVideo') {
  const video = $(videoSel); if (!video) { closeCamera(stream); return; }
  camStream = stream || await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
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
      if (txt && (accept ? accept(txt) : isSignalText(txt) || lanInfo(txt))) { cancelAnimationFrame(camRaf); const keep = camStream; camStream = null; try { navigator.vibrate && navigator.vibrate(30); } catch (e) {} onCode(txt, keep); return; }
    }
    camRaf = requestAnimationFrame(loop);
  };
  loop();
}
function stopScan() { cancelAnimationFrame(camRaf); if (camStream) camStream.getTracks().forEach(t => t.stop()); camStream = null; }
function drawQR(canvas, text) {
  const q = qrcode(0, 'L'); q.addData(text, /^[0-9A-Z]+$/.test(text) ? 'Alphanumeric' : 'Byte'); q.make();
  const n = q.getModuleCount(), m = 4, size = n + m * 2, px = Math.max(4, Math.floor(640 / size));
  canvas.width = canvas.height = size * px;
  const c = canvas.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect((k + m) * px, (r + m) * px, px, px);
}
function camError(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return T('La caméra est refusée. Autorise-la dans les réglages du navigateur pour ce site, puis réessaie.');
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return T('Aucune caméra trouvée sur cet appareil. Utilise « Saisir le code à la main ».');
  return (e && e.message) || T('La caméra ne s’est pas lancée.');
}

// ---------- Parties trouvées sur le Wi-Fi (invité dans l'app) ----------
let foundTimer = 0;
const MPF = new Map();
function foundHTML() {
  const now = Date.now(), list = [...MPF.values()].filter(f => now - f.t < 4000);
  if (!list.length) return '';
  return '<p class="mp-label">' + T('Parties sur ce Wi-Fi') + '</p>' + list.map(f => '<button class="btn green" type="button" data-a="lan-join" data-url="' + esc(f.url) + '"' + (f.n >= f.max ? ' disabled' : '') + '>'
    + T('Rejoindre ') + esc(f.host) + ' · ' + f.n + '/' + f.max + '</button>').join('');
}
function startFound() {
  MPF.clear();
  const paint = () => { const el = $('#mpFound'); if (el) el.innerHTML = foundHTML(); };
  if (!Net.discover(f => { const had = MPF.has(f.url); MPF.set(f.url, { ...f, t: Date.now() }); if (!had) paint(); })) return;
  foundTimer = setInterval(paint, 1000);
}
function stopFound() { clearInterval(foundTimer); foundTimer = 0; MPF.clear(); Net.stopDiscover(); }

// ---------- États de l'écran ----------
function mpGo(state, extra) {
  stopScan(); clearTimeout(mpTimer); stopFound();
  Object.assign(MP, { state, err: '', info: '', manual: false, camFail: false, cam: null }, extra || {});
  renderMP();
}
function rosterHTML() {
  const ps = Net.players.length ? Net.players : [{ name: mpName() || T('Toi'), host: true, ping: 0, id: 'me' }];
  return '<ul class="mp-list">' + ps.map((p, i) => '<li><canvas class="mp-yg" data-i="' + i + '" aria-hidden="true"></canvas><b>' + esc(p.name) + '</b>' + (p.host ? T('<span class="mp-tag">hôte</span>') : '') + (Net.me && p.id === Net.me.id ? '<span class="mp-tag you">toi</span>' : '') + (p.away ? '<span class="mp-tag away">' + T('connexion perdue…') + '</span>' : '') + '<span class="mp-ping">' + (p.host && Net.role === 'host' ? '' : p.ping ? p.ping + ' ms' : '') + '</span></li>').join('') + '</ul>';
}
// Code à taper : par groupes de 4 (les tirets, espaces et minuscules sont acceptés à la saisie)
const groupCode = c => (/^E[0-9A-Z]+$/.test(c) ? c.match(/.{1,4}/g).join('-') : c);
const camHTML = () => (MP.camFail ? '' : '<div class="mp-cam' + (MP.facing === 'user' ? ' mirror small' : '') + '"><video id="mpVideo" playsinline muted></video><span class="mp-frame"></span></div>')
  + '<button class="sbtn mp-flip" type="button" data-a="flip">' + (MP.facing === 'user' ? T('📷 Utiliser la caméra arrière') : T('🤳 Mode face à face (caméra avant)')) + '</button>';
function manualHTML(copyCode) {
  return '<details class="mp-manual"' + (MP.manual ? ' open' : '') + T('><summary>Pas de caméra ? Saisir le code à la main</summary>')
    + (copyCode ? T('<p class="fine">Ton code, à transmettre :</p><textarea readonly id="mpCodeOut" rows="3">') + esc(groupCode(copyCode)) + T('</textarea><button class="sbtn" type="button" id="mpCopy">Copier le code</button>') : '')
    + T('<p class="fine">Code reçu :</p><textarea id="mpCodeIn" rows="3" placeholder="Colle le code ici"></textarea><button class="sbtn" type="button" id="mpPaste">Valider le code</button></details>');
}
// Mode de jeu du salon : duel (chacun sa carte) ou coop (tous sur la même carte, avec une difficulté)
function sendLobby() { Net.send('all', { k: 'lobby', map: DUEL.lobbyMap, rsize: DUEL.lobbySize, mode: DUEL.lobbyMode || 'duel', diff: DUEL.lobbyDiff || 'moyen', chal: DUEL.lobbyChal || null }); }
function modePickHTML(canPick) {
  const mode = DUEL.lobbyMode || 'duel', diff = DUEL.lobbyDiff || 'moyen';
  const seg = (items, cur, pre) => '<div class="mp-seg">' + items.map(([k, label]) => '<button class="sbtn' + (k === cur ? ' on' : '') + '" type="button"' + (canPick ? ' data-a="' + pre + k + '"' : ' disabled') + '>' + label + '</button>').join('') + '</div>';
  return '<div class="mp-mode"><small>Mode</small>' + seg([['duel', '⚔ Duel'], ['coop', '🤝 Coop']], mode, 'mode-')
    + (mode === 'coop' ? T('<small>Difficulté</small>') + seg(DORDER.map(k => [k, DIFFS[k].name]), diff, 'diff-') : '') + '</div>'
    + (typeof chalLobbyHTML === 'function' ? chalLobbyHTML(canPick) : '');
}
function mapPickHTML(canPick) {
  const m = MAPS[DUEL.lobbyMap] || MAPS[0], rz = DUEL.lobbySize || 'moyenne';
  // Carte aléatoire : l'hôte choisit la taille, la graine est tirée au lancement et envoyée à tous
  const name = m.random ? T('🎲 Carte aléatoire') : m.name, sub = m.random ? 'taille ' + RSIZES[rz].name.toLowerCase() + T(' · générée au lancement') : 'biome ' + m.biome.name.toLowerCase();
  return '<div class="mp-map">' + (canPick ? T('<button class="ibtn" type="button" data-a="map-prev" aria-label="Carte précédente">◀</button>') : '')
    + T('<div class="mp-mapn"><small>Carte</small><b>') + esc(name) + '</b><span>' + sub + '</span></div>'
    + (canPick ? T('<button class="ibtn" type="button" data-a="map-next" aria-label="Carte suivante">▶</button>') : '') + '</div>'
    + (m.random && canPick ? '<div class="rsz mp-rsz">' + Object.entries(RSIZES).map(([k, S]) => '<button class="sbtn' + (k === rz ? ' on' : '') + '" type="button" data-a="rsize-' + k + '"><b>' + S.name + '</b><small>' + S.short + '</small></button>').join('') + '</div>' : '');
}
function rulesHTML() {
  if (DUEL.lobbyMode === 'coop') return T('<details class="mp-manual"><summary>Règles de la coop</summary><ul class="tips">')
    + T('<li>Tout le monde défend la même carte et repart de zéro, comme en duel : Braise et Ondine, 0 éclat. Ta progression solo n’est pas touchée.</li>')
    + T('<li>Les éclats gagnés à chaque vague servent dans l’Atelier (bouton violet), qui ne met pas le jeu en pause. Chaque tour porte un anneau de la couleur de son joueur : seul son propriétaire peut l’améliorer, la vendre ou la fusionner.</li>')
    + T('<li>Les vies sont communes. Les ennemis ont plus de PV et sont plus nombreux selon le nombre de joueurs, et leur or est partagé à parts égales.</li>')
    + T('<li>Touche un coéquipier dans le bandeau du haut pour lui donner 50 or. Appui long sur la carte : un ping visible par tous.</li>')
    + T('<li>Seul l’hôte peut accélérer ou mettre en pause.</li></ul></details>');
  return T('<details class="mp-manual"><summary>Règles du duel</summary><ul class="tips">')
    + T('<li>Mode infini, tout le monde repart de zéro : Braise et Ondine, 200 or, 0 éclat. Ta progression solo n’est pas touchée.</li>')
    + T('<li>Une vague part toutes les 25 s pour tout le monde. Pas de pause ni d’accélération.</li>')
    + T('<li>Onglet « Envoyer » : dépense de l’or pour envoyer des ennemis à ta cible. Chaque envoi augmente ton revenu, versé à chaque vague. À 3 ou 4 joueurs, le mode « À tous » envoie l’ennemi à chaque adversaire, avec 20 % de réduction.</li>')
    + T('<li>Les éclats gagnés à chaque vague servent dans l’Atelier (bouton violet), qui ne met pas le jeu en pause.</li>')
    + T('<li>Le dernier survivant gagne. Quitter l’appli plus de 10 s élimine.</li></ul></details>');
}
function renderMP() {
  const b = $('#mpBody'), S = MP.state, name = mpName();
  let h = '';
  if (MP.err) h += '<p class="mp-err">' + esc(MP.err) + '</p>';
  if (MP.info) h += '<p class="mp-info">' + esc(MP.info) + '</p>';
  if (S === 'unsupported') {
    h += T('<p class="trnote">Le multijoueur a besoin d’un navigateur récent, de la caméra et d’une liaison directe entre téléphones. Cette version du jeu ne le permet pas.</p>')
      + T('<p class="fine" style="text-align:left">Ouvre le jeu depuis cette adresse, sur chaque téléphone :</p><p class="mp-url">') + GH_URL + '</p>'
      + T('<button class="btn alt" type="button" data-a="back">Retour</button>');
  } else if (S === 'home') {
    // Deux onglets quand le jeu en ligne est permis : « À côté » (sans internet) et « En ligne » (avec ses amis, js/online.js)
    const onl = typeof frOn === 'function' && frOn();
    if (onl) h += '<div class="mp-seg mp-tabs"><button class="sbtn' + (MP.tab !== 'online' ? ' on' : '') + '" type="button" data-a="tab-near">' + T('📶 À côté') + '</button><button class="sbtn' + (MP.tab === 'online' ? ' on' : '') + '" type="button" data-a="tab-online">' + T('🌍 En ligne') + '</button></div>';
    if (onl && MP.tab === 'online') h += onlineHomeHTML();
    else h += T('<p class="trnote">De 2 à 4 joueurs, téléphones côte à côte, <b>sans internet</b>. Connectez-vous au même Wi-Fi, ou activez le partage de connexion d’un des téléphones et connectez les autres dessus.</p>')
      + T('<label class="mp-label" for="mpName">Ton pseudo</label><input id="mpName" class="mp-input" maxlength="12" autocomplete="nickname" placeholder="Ex. Léa" value="') + esc(name) + '">'
      + T('<button class="btn" type="button" data-a="create">Créer une partie</button>')
      + T('<button class="btn green" type="button" data-a="join">Rejoindre une partie</button>');
    h += T('<button class="btn alt" type="button" data-a="back">Retour</button>');
  } else if (S === 'busy') {
    h += '<p class="mp-busy">' + esc(MP.busyText || T('Un instant…')) + T('</p><button class="btn alt" type="button" data-a="cancel">Annuler</button>');
  } else if (S === 'host') {
    const full = Net.players.length >= NET_MAX;
    h += (Net.online ? T('<h3 class="mp-h">Salon en ligne · ') : T('<h3 class="mp-h">Salon · ')) + Net.players.length + '/' + NET_MAX + T(' joueurs</h3>') + rosterHTML()
      + (full ? T('<p class="fine">La partie est complète.</p>') : Net.online ? '<div class="mp-online"><span class="mp-label">' + T('Inviter un ami en ligne') + '</span><div id="onlFriends"></div></div>' : T('<button class="btn green" type="button" data-a="invite">Inviter un joueur</button>'))
      + modePickHTML(true) + mapPickHTML(true)
      + '<button class="btn" type="button" data-a="launch"' + (Net.players.length < 2 ? ' disabled' : '') + '>' + (Net.players.length < 2 ? T('Invite au moins 1 joueur') : T('Lancer la partie !')) + '</button>'
      + rulesHTML()
      + T('<button class="btn pink" type="button" data-a="leave">Fermer la partie</button>');
  } else if (S === 'invite' && MP.lan) {
    // Hôte dans l'app : un seul QR, valable pour tous les invités (navigateur ou app)
    h += '<canvas class="mp-qr" id="mpQr"></canvas>'
      + '<p class="mp-step">' + T('Ton ami scanne ce QR avec l’appareil photo de son téléphone, ou touche « Rejoindre une partie » dans le jeu. Il te rejoint aussitôt.') + '</p>'
      + '<p class="fine">' + T('Sur le même Wi-Fi ou sur ton partage de connexion. Adresse : ') + esc(MP.code.replace(/\/\?j=.*/, '')) + '</p>'
      + T('<button class="btn alt" type="button" data-a="cancel">Retour au salon</button>');
  } else if (S === 'invite') {
    // Un seul écran : le QR de l'invitation, et la caméra qui attend déjà la réponse de l'invité
    h += '<canvas class="mp-qr" id="mpQr"></canvas>'
      + '<p class="mp-step">' + (MP.facing === 'user' ? T('Mettez les deux téléphones <b>écran contre écran</b>, dans le même sens, à 15–20 cm. Ton ami touche « Rejoindre une partie » : la connexion se fait toute seule.')
        : T('Ton ami touche « Rejoindre une partie » et vise ce QR. Vise ensuite sa réponse avec ta caméra arrière.')) + '</p>'
      + camHTML() + '<p class="fine">' + T('Ta caméra attend la réponse de ton ami…') + '</p>'
      + manualHTML(MP.code) + T('<button class="btn alt" type="button" data-a="cancel">Annuler</button>');
  } else if (S === 'scan') {
    h += '<h3 class="mp-h">' + (MP.scanFor === 'answer' ? T('Vise le QR de réponse de ton ami') : T('Vise le QR code affiché par l’hôte')) + '</h3>'
      + (MP.scanFor !== 'answer' ? '<div id="mpFound">' + foundHTML() + '</div>' : '')
      + (MP.facing === 'user' && MP.scanFor !== 'answer' ? '<p class="mp-step">' + T('Mets ton téléphone <b>écran contre écran</b> avec celui de l’hôte, dans le même sens, à 15–20 cm.') + '</p>' : '')
      + camHTML()
      + manualHTML(null)
      + '<button class="btn alt" type="button" data-a="' + (MP.scanFor === 'answer' ? 'back-invite' : 'cancel') + '">' + T('Annuler') + '</button>';
  } else if (S === 'answer') {
    h += T('<canvas class="mp-qr" id="mpQr"></canvas><p class="mp-busy">En attente de connexion…</p>')
      + '<p class="mp-step">' + T('Garde ton écran face à celui de ') + esc(MP.hostName) + T(' : sa caméra lit ta réponse et la connexion se fait toute seule.') + '</p>'
      + manualHTML(MP.code) + T('<button class="btn alt" type="button" data-a="cancel">Annuler</button>');
  } else if (S === 'lobby') {
    const hp = Net.players.find(p => p.host);
    h += T('<h3 class="mp-h">Connecté ! · ') + Net.players.length + '/' + NET_MAX + T(' joueurs</h3>') + rosterHTML()
      + modePickHTML(false) + mapPickHTML(false)
      + T('<p class="mp-busy">En attente que ') + esc(hp ? hp.name : T('l’hôte')) + T(' lance la partie…</p>') + rulesHTML()
      + T('<button class="btn pink" type="button" data-a="leave">Quitter la partie</button>');
  }
  b.innerHTML = h;
  b.querySelectorAll('canvas.mp-yg').forEach(cv => drawYglou(prepMini(cv, 34, 34), 17, 19, 30, 'happy', 0, { crest: ['#ff4f81', '#3fa9ff', '#4fd36a', '#ffb03d'][+cv.dataset.i % 4], noShadow: true }));
  if (S === 'host' && Net.online && typeof paintOnlineFriends === 'function') paintOnlineFriends();
  const qr = $('#mpQr'); if (qr && MP.code) { try { drawQR(qr, MP.code); } catch (e) { MP.err = T('Impossible de dessiner le QR code.'); } }
  if (S === 'scan' && MP.scanFor !== 'answer' && !foundTimer) startFound();
  if (S === 'invite' && !MP.camFail && !MP.lan) { const st = MP.cam; MP.cam = null; startScan(hostGotAnswer, MP.facing, st).catch(e => { if (MP.state !== 'invite') return; stopScan(); MP.camFail = true; MP.manual = true; MP.err = camError(e); renderMP(); }); }
  if (S === 'scan' && !MP.camFail) startScan((txt, cam) => MP.scanFor === 'answer' ? hostGotAnswer(txt, cam) : guestGotOffer(txt, cam), MP.facing).catch(e => { if (MP.state !== 'scan') return; stopScan(); MP.camFail = true; MP.manual = true; MP.err = camError(e); renderMP(); });
}

// ---------- Actions ----------
function needName() {
  const inp = $('#mpName'); let v = (inp ? inp.value : mpName()).trim().slice(0, 12) || randomPseudo();
  if (typeof pseudoGuard === 'function') v = pseudoGuard(v, store.get('elemento.pseudo'));
  store.set('elemento.pseudo', v); return v;
}
async function hostInvite() {
  if (Net.lan) { mpGo('invite', { code: Net.lan.url, lan: true }); return; }
  mpGo('busy', { busyText: T('Préparation de l’invitation…') });
  let cam = null;
  try {
    cam = await openCamera(MP.facing).catch(() => null);
    const code = await Net.createInvite();
    // La caméra reste allumée : elle lira directement la réponse de l'invité
    if (MP.state === 'busy') { mpGo('invite', { code, cam }); cam = null; }
  } catch (e) { mpGo('host', { err: e.message || String(e) }); }
  finally { closeCamera(cam); }
}
async function hostGotAnswer(txt, cam) {
  closeCamera(cam);
  mpGo('busy', { busyText: T('Connexion en cours…') });
  try {
    await Net.acceptAnswer(txt);
    mpTimer = setTimeout(() => { if (MP.state === 'busy') mpGo('host', { err: T('La connexion n’a pas abouti. Vérifiez que les téléphones sont sur le même Wi-Fi ou partage de connexion, puis recommencez l’invitation.') }); }, 20000);
  } catch (e) { mpGo('host', { err: e.message || String(e) }); }
}
// Rejoindre un hôte de l'app : dans l'app, connexion directe ; dans un navigateur, on ouvre le jeu servi par l'hôte
function joinLanGame(url) {
  if (!NATIVE && location.origin + location.pathname + location.search !== url) { store.flush().then(() => { location.href = url; }); return; }
  mpGo('busy', { busyText: T('Connexion à la partie…'), lanJoin: true });
  try { Net.joinLan(mpName() || randomPseudo(), url); }
  catch (e) { mpGo('home', { err: e.message || String(e) }); return; }
  mpTimer = setTimeout(() => { if (MP.state === 'busy') { Net.reset(); mpGo('home', { err: T('Impossible de joindre la partie. Vérifiez que les téléphones sont sur le même Wi-Fi ou partage de connexion.') }); } }, 12000);
}
async function guestGotOffer(txt, cam) {
  if (lanInfo(txt)) { closeCamera(cam); joinLanGame(lanInfo(txt).url); return; }
  const name = mpName() || T('Joueur');
  mpGo('busy', { busyText: T('Préparation de ta réponse…') });
  try {
    if (!cam) cam = await openCamera(MP.facing).catch(() => null);
    const { hostName, code } = await Net.join(name, txt).finally(() => closeCamera(cam));
    mpGo('answer', { code, hostName });
    mpTimer = setTimeout(() => { if (MP.state === 'answer') mpGo('home', { err: T('La connexion n’a pas abouti. Vérifiez que les téléphones sont sur le même Wi-Fi ou partage de connexion, puis recommencez.') }); Net.reset(); }, 90000);
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
    const ta = $('#mpCodeOut'); const done = () => { MP.info = T('Code copié.'); MP.manual = true; renderMP(); };
    navigator.clipboard && navigator.clipboard.writeText(groupCode(MP.code)).then(done, () => { ta.select(); });
    return;
  }
  if (el.id === 'mpPaste') {
    const v = ($('#mpCodeIn').value || '').trim(); if (!v) return;
    if (Net.role === 'host') hostGotAnswer(v); else guestGotOffer(v);
    return;
  }
  const a = el.dataset.a;
  if (a === 'back') { show('title'); }
  else if (a === 'tab-near' || a === 'tab-online') { MP.tab = a.slice(4); MP.err = ''; renderMP(); if (MP.tab === 'online' && typeof frLoad === 'function') frLoad(true).then(() => { if (MP.state === 'home') renderMP(); }); }
  else if (a === 'ocreate') { (async () => { mpGo('busy', { busyText: T('Ouverture du salon…') }); if (await onlineCreate()) mpGo('host'); })(); }
  else if (a === 'create') { const n = needName(); if (!n) return; Net.host(n); keepAwake(); mpGo('host'); }
  else if (a === 'join') { const n = needName(); if (!n) return; keepAwake(); mpGo('scan', { scanFor: 'offer' }); }
  else if (a === 'invite') hostInvite();
  else if (a === 'lan-join') joinLanGame(el.dataset.url);
  else if (a === 'scan-answer') mpGo('scan', { scanFor: 'answer', code: MP.code });
  else if (a === 'flip') { MP.facing = MP.facing === 'user' ? 'environment' : 'user'; store.set('elemento.mpFacing', MP.facing); stopScan(); MP.camFail = false; renderMP(); }
  else if (a === 'back-invite') mpGo('invite', { code: MP.code });
  else if (a === 'cancel' || a === 'leave') mpCancel();
  else if (a === 'map-prev' || a === 'map-next') { do DUEL.lobbyMap = (DUEL.lobbyMap + (a === 'map-next' ? 1 : MAPS.length - 1)) % MAPS.length; while (!inSeason(MAPS[DUEL.lobbyMap])); sendLobby(); renderMP(); }
  else if (a.startsWith('rsize-')) { DUEL.lobbySize = a.slice(6); sendLobby(); renderMP(); }
  else if (a.startsWith('mode-')) { DUEL.lobbyMode = a.slice(5); sendLobby(); renderMP(); }
  else if (a.startsWith('diff-')) { DUEL.lobbyDiff = a.slice(5); sendLobby(); renderMP(); }
  else if (a === 'chal') { if (typeof chalLobbyOpen === 'function') chalLobbyOpen(); }
  else if (a === 'launch') { if (DUEL.lobbyMode === 'coop') coopHostStart(); else duelHostStart(); }
});
// Garde le panneau de saisie manuelle ouvert d'un affichage à l'autre
$('#mpBody').addEventListener('toggle', ev => { if (ev.target.classList && ev.target.classList.contains('mp-manual')) MP.manual = ev.target.open; }, true);

Net.on('roster', () => {
  if ((MP.state === 'answer' || (MP.state === 'busy' && MP.lanJoin)) && Net.role === 'guest') { mpGo('lobby'); Snd.play('clear'); return; }
  if (MP.state === 'host' || MP.state === 'lobby') renderMP();
});
Net.on('join', id => {
  const p = Net.players.find(x => x.id === id);
  Snd.play('clear');
  if (Net.role === 'host') mpGo('host', { info: (p ? p.name : T('Un joueur')) + T(' a rejoint la partie !') });
});
Net.on('leave', () => { if (MP.state === 'host') renderMP(); });
// Le serveur local de l'hôte vient de démarrer : l'écran d'invitation passe au QR d'adresse
Net.on('lan', lan => { if (MP.state === 'invite' && !MP.lan) mpGo('invite', { code: lan.url, lan: true }); });
Net.on('closed', msg => mpGo('home', { err: msg }));
Net.on('error', msg => mpGo('home', { err: msg }));

function openMulti() {
  const ok = Net.supported() && navigator.mediaDevices && window.isSecureContext && !/claude/.test(location.hostname);
  show('multi'); screens.multi.scrollTop = 0;
  if (Net.role) mpGo(Net.role === 'host' ? 'host' : 'lobby');
  else mpGo(ok ? 'home' : 'unsupported');
}
$('#tMulti').addEventListener('click', () => { Snd.init(); openMulti(); });
// Page ouverte depuis le QR d'un hôte de l'app (jeu servi par son téléphone) : on rejoint sa partie tout de suite
if (lanInfo(location.href)) { show('multi'); joinLanGame(lanInfo(location.href).url); }
document.addEventListener('keydown', ev => { if (curScreen === 'multi' && ev.key === 'Escape') mpCancel(); });

// ---------- Jeu installable hors ligne ----------
// Application Android (Capacitor) : le jeu est déjà dans l'APK, pas besoin du service worker
if (NATIVE) {
  // Bouton retour d'Android : même effet que la touche Échap (pause, retour au menu…) ; sur l'écran titre, il quitte le jeu
  const App = window.Capacitor.Plugins.App;
  App.addListener('backButton', () => {
    if (curScreen === 'title') App.exitApp();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  // Mises à jour : l'APK installé à la main regarde la dernière release GitHub ; si elle est plus récente,
  // un bouton sur l'écran titre télécharge le nouvel APK (à installer par-dessus, même signature)
  checkUpdate();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - (checkUpdate.at || 0) > 3600e3) checkUpdate(); });
}
async function checkUpdate(current = BUILD) {
  checkUpdate.at = Date.now();
  try {
    const r = await fetch('https://api.github.com/repos/YglesWare/elemento_defense/releases/latest', { cache: 'no-store' });
    if (!r.ok) return;
    const rel = await r.json(), m = /(\d+)\.(\d+)\.(\d+)$/.exec(rel.tag_name || ''), apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
    if (!m || !apk || +m[3] <= current) return;
    const b = $('#tUpdate');
    b.textContent = T('⬆ Mise à jour ') + m[1] + '.' + m[2] + '.' + m[3];
    b.onclick = () => { Snd.init(); location.href = apk.browser_download_url; };
    b.hidden = false;
  } catch (e) { /* hors ligne : on réessaiera au prochain retour dans l'app */ }
}
if (!NATIVE && 'serviceWorker' in navigator && location.protocol === 'https:' && !/claude/.test(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // Nouvelle version installée : on recharge pour l'utiliser tout de suite, mais jamais en pleine partie
  if (navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => {
    const go = () => { if (curScreen !== 'game') store.flush().then(() => location.reload()); else setTimeout(go, 2000); };
    go();
  });
}
