// Élémento Defense : amis (Supabase, voir supabase/friends.sql).
// Sécurité enfants : pas de recherche de joueurs, pas de chat. On ajoute un ami avec son code ami (tapé ou scanné),
// et il doit accepter. Chacun ne voit que ses amis : pseudo, gardien, présence. Un parent peut couper l'ajout d'amis
// par l'enfant et gérer sa liste depuis l'espace parents (js/parents.js).
// Hors ligne d'abord : la liste est gardée sur le téléphone ; seules les actions (ajouter, accepter…) demandent internet.
'use strict';

const FR_KEY = 'elemento.friends', FRC_KEY = 'elemento.friendCode', FR_QR = 'ELDAMI';
const FR = { list: store.get(FR_KEY) || [], code: store.get(FRC_KEY) || '', ok: !!store.get(FRC_KEY), sent: '', lastPing: 0, lastLoad: 0, err: '', from: 'friends', entry: '', res: null, busy: false };

// ---------- Pseudo : filtre de gros mots (le pseudo n'est vu que par les amis, mais on reste prudents) ----------
const BAD_ROOTS = ['merde', 'putain', 'pute', 'salope', 'salaud', 'connard', 'connasse', 'encul', 'batard', 'bite', 'couille', 'chier', 'nique', 'niquer', 'pede', 'tapette', 'gouine', 'negre', 'bougnoul', 'youpin', 'nazi', 'hitler', 'fuck', 'shit', 'bitch', 'dick', 'cock', 'pussy', 'cunt', 'asshole', 'nigg', 'faggot', 'slut', 'whore', 'porn', 'sexe', 'sexy', 'teub', 'chatte', 'zizi', 'penis', 'vagin', 'branle', 'suce', 'nichon', 'bordel', 'crotte', 'caca', 'pipi', 'prout'];
const BAD_WORDS = ['pd', 'fdp', 'ntm', 'tg', 'con', 'cul', 'sex', 'zob', 'ass', 'fag', 'wtf', 'kkk', 'ss'];
function badPseudo(p) {
  const n = String(p || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4|@/g, 'a').replace(/5|\$/g, 's').replace(/7/g, 't');
  const flat = n.replace(/[^a-z]/g, '');
  return BAD_ROOTS.some(w => flat.includes(w)) || n.split(/[^a-z]+/).some(w => BAD_WORDS.includes(w)) || BAD_WORDS.includes(flat);
}
const cleanPseudo = () => { const p = (store.get('elemento.pseudo') || '').trim().slice(0, 12); return p && !badPseudo(p) ? p : 'Joueur'; };
// Le gardien affiché à côté du pseudo : l'élément le plus travaillé dans l'Atelier
const favElement = () => TORDER.reduce((b, t) => ((meta.lv['m_' + t] || 0) + (meta.lv['p_' + t] || 0) > (meta.lv['m_' + b] || 0) + (meta.lv['p_' + b] || 0) ? t : b), 'feu');

// ---------- Liaison avec Supabase ----------
const frOn = () => typeof CLOUD !== 'undefined' && !cloudOff() && onlineAllowed();
const frLive = () => frOn() && !!CLOUD.user && !!CLOUD.sb && navigator.onLine;
async function frRpc(fn, args) { const { data, error } = await CLOUD.sb.rpc(fn, args || {}); if (error) throw error; return data; }
async function frProfile() {
  const av = typeof myAvatar === 'function' ? myAvatar() : favElement(), key = cleanPseudo() + '|' + av;
  const r = await frRpc('profile_sync', { p_pseudo: cleanPseudo(), p_avatar: av });
  FR.sent = key; FR.ok = true;
  if (r && r.code && r.code !== FR.code) { FR.code = r.code; store.set(FRC_KEY, r.code); }
}
async function frLoad(force) {
  if (!frLive()) return;
  if (!force && FR.busy) return;
  FR.busy = true;
  try {
    if (!FR.ok || FR.sent !== cleanPseudo() + '|' + (typeof myAvatar === 'function' ? myAvatar() : favElement())) await frProfile();
    const rows = await frRpc('friends_list');
    FR.list = (rows || []).map(r => ({ id: r.user_id, pseudo: r.pseudo, av: r.avatar, kind: r.kind, since: r.since, online: !!r.online, state: r.state, seen: r.last_seen }));
    store.set(FR_KEY, FR.list); FR.lastLoad = Date.now(); FR.err = '';
  } catch (e) { FR.err = (e && e.message) || String(e); }
  finally { FR.busy = false; frPaint(); }
}
// Présence (« en ligne », « en partie ») toutes les minutes ; la liste toutes les 2 s quand une page d'amis est ouverte,
// toutes les 15 s sur l'accueil (pastille des demandes), sinon toutes les minutes
async function frTick() {
  if (!frLive() || document.visibilityState !== 'visible') return;
  const now = Date.now();
  try {
    if (now - FR.lastPing > 55e3) { FR.lastPing = now; if (FR.ok) await frRpc('presence_ping', { p_state: G && curScreen === 'game' && !G.over ? 'game' : 'menu' }); }
    const open = curScreen === 'friends' || curScreen === 'fradd' || (curScreen === 'parents' && PA.view === 'friends');
    if (now - FR.lastLoad > (open ? 1.8e3 : curScreen === 'title' ? 15e3 : 60e3)) await frLoad();
  } catch (e) {}
}
setTimeout(frTick, 4000); setInterval(frTick, 2000);
// En arrière-plan, ou jeu en ligne coupé : on apparaît hors ligne
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && FR.ok && typeof CLOUD !== 'undefined' && CLOUD.user && navigator.onLine) frRpc('presence_ping', { p_state: 'off' }).catch(() => {}); else if (document.visibilityState === 'visible') { FR.lastPing = 0; FR.lastLoad = 0; frTick(); } });

// ---------- Affichage ----------
const fmtCode = c => c ? 'YGL-' + c.slice(0, 3) + '-' + c.slice(3) : '…';
function seenAgo(iso) {
  if (!iso) return T('Hors ligne');
  const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 60) return T('Vu il y a ') + m + ' min';
  if (m < 24 * 60) return T('Vu il y a ') + Math.round(m / 60) + ' h';
  if (m < 48 * 60) return T('Vu hier');
  return T('Vu le ') + new Date(iso).toLocaleDateString(IS_EN ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' });
}
const frDay = iso => new Date(iso).toLocaleDateString(IS_EN ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' });
function frStatus(f) {
  if (f.kind === 'out') return T('Demande envoyée');
  if (f.kind === 'in') return T('veut être ton ami');
  if (f.kind === 'blocked') return T('Bloqué le ') + frDay(f.since);
  if (f.online) return f.state === 'game' ? T('En partie') : T('En ligne');
  return seenAgo(f.seen);
}
const frDot = f => f.kind !== 'friend' ? '' : '<i class="frdot ' + (f.online ? (f.state === 'game' ? 'play' : 'on') : 'off') + '"></i>';
const frRow = (f, acts, sub) => '<div class="frrow" data-id="' + f.id + '"><span class="frav"><canvas data-av="' + esc(f.av || 'feu') + '"></canvas>' + frDot(f) + '</span>'
  + '<div class="frwho"><b>' + esc(f.pseudo) + '</b><small>' + (sub || frStatus(f)) + '</small></div>' + acts + '</div>';
const frBtn = (act, label, cls = '') => '<button class="sbtn frb ' + cls + '" type="button" data-act="' + act + '">' + label + '</button>';
const byOnline = (a, b) => (b.online - a.online) || a.pseudo.localeCompare(b.pseudo);
const frOf = kind => FR.list.filter(f => f.kind === kind).sort(byOnline);
function frAvatars(root) {
  // Avatar : l'Yglou déguisé du joueur (« yg… », js/wardrobe.js), ou un gardien pour les anciennes versions du jeu
  root.querySelectorAll('canvas[data-av]').forEach(cv => {
    const n = +(cv.dataset.size || 40), c = prepMini(cv, n, n), look = typeof avatarLook === 'function' && avatarLook(cv.dataset.av);
    if (look) drawYglouHead(c, n, look); else drawTower(c, TOWERS[cv.dataset.av] ? cv.dataset.av : 'feu', n / 2, n * 0.6, n * 0.8, 1, 0.5, 0, 0.3, 0, false);
  });
}
function frNote() {
  if (!navigator.onLine || (typeof CLOUD !== 'undefined' && !CLOUD.user)) return T('Hors ligne : la liste se mettra à jour au retour du réseau.');
  if (!FR.ok && FR.err) return T('Les amis ne sont pas encore disponibles. Réessaie plus tard.');
  return '';
}

// Page Amis (enfant)
screens.friends = $('#sFriends');
function openFriends() { Snd.init(); show('friends'); screens.friends.scrollTop = 0; frPaint(); frLoad(true); }
function frPaint() {
  // Bouton de l'accueil et sa pastille (demandes reçues, si l'enfant peut les accepter)
  const chip = $('#tFriends'), vis = frOn() && (FR.ok || FR.list.length > 0);
  chip.hidden = !vis; $('#sTitle').classList.toggle('hasfr', vis);
  const ins = parent().childAdd ? frOf('in').length : 0, bd = $('#tFrBadge');
  bd.hidden = !ins; bd.textContent = ins;
  if (curScreen === 'friends') frPaintPage();
  if (curScreen === 'parents' && typeof PA !== 'undefined' && PA.view === 'friends' && !FR.busy) paRender();
}
function frPaintPage() {
  const add = parent().childAdd, ins = add ? frOf('in') : [], fr = frOf('friend'), outs = frOf('out');
  $('#frMyCode').textContent = fmtCode(FR.code);
  $('#frAddBtn').hidden = !add;
  const note = frNote(); $('#frState').hidden = !note; $('#frState').textContent = note;
  let h = '';
  if (ins.length) h += '<div class="frsec"><span class="mp-label">' + T('Demandes') + ' (' + ins.length + ')</span>' + ins.map(f => frRow(f, frBtn('accept', '✓', 'yes') + frBtn('refuse', '✕', 'no'))).join('') + '</div>';
  h += '<div class="frsec"><span class="mp-label">' + T('Amis') + ' (' + fr.length + ')</span>'
    + (fr.length ? fr.map(f => frRow(f, (canInvite(f) ? frBtn('invite', T('Inviter'), 'inv') : '') + frBtn('menu', '⋯', 'more'))).join('') : '<p class="fine frempty">' + (add ? T('Pas encore d’amis. Donne ton code à un copain, ou tape le sien !') : T('Pas encore d’amis. Un parent peut en ajouter depuis l’espace parents.')) + '</p>')
    + outs.map(f => frRow(f, add ? frBtn('cancel', '✕', 'no') : '')).join('') + '</div>';
  const box = $('#frList'); box.innerHTML = h; frAvatars(box);
  box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => frDo(b.dataset.act, b.closest('.frrow').dataset.id)));
}
// Inviter : l'ami est en ligne, pas en pleine partie, et on peut jouer en ligne (js/online.js)
const canInvite = f => f.kind === 'friend' && f.online && f.state !== 'game' && frLive() && typeof inviteFriend === 'function' && (!Net.role || (Net.role === 'host' && Net.online));
// Actions sur un ami (page enfant, menu ⋯ et espace parents)
async function frAct(fn, args, okMsg) {
  if (!frLive()) { hint(T('Il faut internet pour ça.'), 1800); return false; }
  try { await frRpc(fn, args); if (okMsg) hint(okMsg, 1600); await frLoad(true); return true; }
  catch (e) { hint(T('Oups, ça n’a pas marché. Réessaie.'), 1800); return false; }
}
function frDo(act, id) {
  const f = FR.list.find(x => x.id === id); if (!f) return;
  if (act === 'accept') frAct('friend_respond', { p_other: id, p_accept: true }, T('Vous êtes amis !'));
  else if (act === 'refuse') frAct('friend_respond', { p_other: id, p_accept: false });
  else if (act === 'cancel') frAct('friend_remove', { p_other: id });
  else if (act === 'remove') frAct('friend_remove', { p_other: id }, T('Retiré de la liste'));
  else if (act === 'block') frAct('friend_block', { p_other: id }, T('Bloqué'));
  else if (act === 'unblock') frAct('friend_unblock', { p_other: id }, T('Débloqué'));
  else if (act === 'invite') inviteFriend(id);
  else if (act === 'menu') frMenu(f);
}

// Menu d'un ami : retirer ou bloquer (deuxième appui pour confirmer, simple pour un enfant)
let frArm = '';
function frMenu(f) {
  frArm = '';
  const box = $('#frMenu'), paint = () => {
    $('#fmName').textContent = f.pseudo;
    $('#fmSince').textContent = T('Ami depuis le ') + frDay(f.since) + ' · ' + frStatus(f);
    $('#fmRemove').textContent = frArm === 'remove' ? T('Touche encore pour retirer') : T('Retirer de mes amis');
    $('#fmBlock').textContent = frArm === 'block' ? T('Touche encore pour bloquer') : T('🚫 Bloquer');
  };
  $('#fmAv').dataset.av = f.av || 'feu'; $('#fmAv').dataset.size = 56; frAvatars(box);
  $('#fmRemove').onclick = () => { if (frArm !== 'remove') { frArm = 'remove'; paint(); return; } box.hidden = true; frDo('remove', f.id); };
  $('#fmBlock').onclick = () => { if (frArm !== 'block') { frArm = 'block'; paint(); return; } box.hidden = true; frDo('block', f.id); };
  const inv = canInvite(f);
  $('#fmDuel').hidden = $('#fmCoop').hidden = !inv;
  $('#fmDuel').onclick = () => { box.hidden = true; DUEL.lobbyMode = 'duel'; inviteFriend(f.id); };
  $('#fmCoop').onclick = () => { box.hidden = true; DUEL.lobbyMode = 'coop'; inviteFriend(f.id); };
  $('#fmClose').onclick = () => { box.hidden = true; };
  paint(); box.hidden = false;
}

// Mon QR code (à scanner par un ami à côté de moi)
$('#frQrBtn').addEventListener('click', () => {
  if (!FR.code) { hint(T('Ton code arrive dès que tu es en ligne.'), 2000); return; }
  drawQR($('#fqCv'), FR_QR + FR.code); $('#fqCode').textContent = fmtCode(FR.code); $('#frQr').hidden = false;
});
$('#fqClose').addEventListener('click', () => { $('#frQr').hidden = true; });

// ---------- Ajouter un ami : code tapé sur le clavier du jeu, ou QR scanné ----------
screens.fradd = $('#sFrAdd');
function openFrAdd(from = 'friends') {
  FR.from = from; FR.entry = ''; FR.res = null;
  show('fradd'); screens.fradd.scrollTop = 0; faPaint();
}
function faPaint() {
  const e = FR.entry, cells = Array.from({ length: 7 }, (_, i) => e[i] ? esc(e[i]) : '<i>_</i>');
  $('#faIn').innerHTML = '<span class="fapre">YGL-</span>' + cells.slice(0, 3).join('') + '-' + cells.slice(3).join('');
  const r = FR.res, box = $('#faRes');
  box.hidden = !r;
  if (r) {
    box.className = 'fares' + (r.ok ? ' ok' : ' ko');
    box.innerHTML = (r.av ? '<canvas data-av="' + esc(r.av) + '" data-size="52"></canvas>' : '') + '<p>' + r.msg + '</p>';
    frAvatars(box);
  }
}
const FA_ERR = { not_found: 'Ce code n’existe pas. Vérifie-le avec ton ami.', self: 'C’est ton propre code !', too_many: 'Trop d’essais : attends une minute.', too_many_day: 'Trop de codes faux aujourd’hui : réessaie demain.', you_blocked: 'Ce joueur est bloqué. Un parent peut le débloquer dans l’espace parents.' };
async function faSend(code) {
  if (!frLive()) { FR.res = { ok: false, msg: T('Il faut internet pour ajouter un ami.') }; return faPaint(); }
  FR.res = { ok: true, msg: T('Recherche…') }; faPaint();
  try {
    const r = await frRpc('friend_request', { p_code: code });
    if (r.err) FR.res = { ok: false, msg: T(FA_ERR[r.err] || 'Oups, ça n’a pas marché. Réessaie.') };
    else {
      const who = '<b>' + esc(r.pseudo) + '</b>';
      FR.res = { ok: true, av: r.avatar, msg: r.ok === 'accepted' ? T('Vous êtes maintenant amis avec ') + who + ' !' : r.ok === 'already' ? T('Tu es déjà ami avec ') + who + ' !' : T('Demande envoyée à ') + who + T(' ! Il reste à l’accepter de son côté.') };
      FR.entry = ''; frLoad(true);
    }
  } catch (e) { FR.res = { ok: false, msg: T('Oups, ça n’a pas marché. Réessaie.') }; }
  faPaint();
}
$('#faKeys').innerHTML = [...'123456789'].map(k => '<button class="sbtn" type="button" data-k="' + k + '">' + k + '</button>').join('') + '<span></span><button class="sbtn" type="button" data-k="0">0</button><button class="sbtn" type="button" data-k="⌫" aria-label="' + T('Effacer') + '">⌫</button>';
$('#faKeys').addEventListener('click', ev => {
  const b = ev.target.closest('[data-k]'); if (!b) return;
  const k = b.dataset.k;
  if (k === '⌫') FR.entry = FR.entry.slice(0, -1); else if (FR.entry.length < 7) FR.entry += k;
  FR.res = null; faPaint();
  if (FR.entry.length === 7) faSend(FR.entry);
});
$('#faScan').addEventListener('click', async () => {
  const cam = $('#faCam'); cam.hidden = false;
  try {
    await startScan(txt => { stopScan(); cam.hidden = true; FR.entry = txt.slice(FR_QR.length, FR_QR.length + 7); faPaint(); faSend(FR.entry); },
      'environment', null, txt => new RegExp('^' + FR_QR + '[0-9]{7}$').test(txt), '#faVideo');
  } catch (e) { stopScan(); cam.hidden = true; FR.res = { ok: false, msg: camError(e) }; faPaint(); }
});
function faBack() { stopScan(); $('#faCam').hidden = true; if (FR.from === 'parents') { show('parents'); PA.view = 'friends'; paRender(); } else openFriends(); }
$('#faBack').addEventListener('click', faBack);
$('#frAddBtn').addEventListener('click', () => openFrAdd('friends'));
$('#frBack').addEventListener('click', () => show('title'));
drawYglouIcon(prepMini($('#tFrCv'), 40, 32), 'friends', 40, 32);
$('#tFriends').addEventListener('click', openFriends);

// ---------- Espace parents : ses amis ----------
function frParentHTML() {
  const ins = frOf('in'), fr = frOf('friend'), outs = frOf('out'), bl = frOf('blocked'), note = frNote();
  const sec = (title, list, acts) => list.length ? '<div class="frsec"><span class="mp-label">' + title + ' (' + list.length + ')</span>' + list.map(f => frRow(f, acts(f), f.kind === 'friend' ? T('Ami depuis le ') + frDay(f.since) : '')).join('') + '</div>' : '';
  return '<span class="mp-label">' + T('Son code ami') + '</span><div class="frcode pa"><b>' + fmtCode(FR.code) + '</b>' + frBtn('newcode', T('Nouveau code')) + '</div>'
    + '<p class="fine">' + T('Un nouveau code remplace l’ancien (qui ne marche plus) ; ses amis restent.') + '</p>'
    + (note ? '<p class="fine pa-err">' + note + '</p>' : '')
    + '<button class="btn" type="button" id="paFrAdd">' + T('➕ Ajouter un ami pour lui') + '</button>'
    + sec(T('Demandes reçues'), ins, () => frBtn('accept', '✓', 'yes') + frBtn('refuse', '✕', 'no'))
    + sec(T('Amis'), fr, () => frBtn('remove', T('Retirer')) + frBtn('block', '🚫', 'no'))
    + sec(T('Demandes envoyées'), outs, () => frBtn('cancel', T('Annuler')))
    + sec(T('Bloqués'), bl, () => frBtn('unblock', T('Débloquer')))
    + (!ins.length && !fr.length && !outs.length && !bl.length ? '<p class="fine frempty">' + T('Pas encore d’amis.') + '</p>' : '');
}
function frParentWire(root) {
  frAvatars(root);
  root.querySelectorAll('.frrow [data-act]').forEach(b => b.addEventListener('click', () => frDo(b.dataset.act, b.closest('.frrow').dataset.id)));
  const nc = root.querySelector('[data-act="newcode"]');
  if (nc) nc.addEventListener('click', async () => {
    if (!frLive()) { hint(T('Il faut internet pour ça.'), 1800); return; }
    try { const r = await frRpc('friend_new_code'); if (r && r.code) { FR.code = r.code; store.set(FRC_KEY, r.code); paRender(); hint(T('Nouveau code : ') + fmtCode(r.code), 2200); } } catch (e) { hint(T('Oups, ça n’a pas marché. Réessaie.'), 1800); }
  });
  const ad = root.querySelector('#paFrAdd'); if (ad) ad.addEventListener('click', () => openFrAdd('parents'));
}
frPaint();
