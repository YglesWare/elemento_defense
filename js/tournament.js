// Élémento Defense : tournoi du mois entre amis (supabase/tournament.sql).
// Un duel 1 contre 1 « À zéro » entre deux amis connectés est envoyé par les deux téléphones ; il ne compte que s'ils sont
// d'accord. Matchs aller du 1er au 15, retour du 16 à la fin du mois : un match compté par ami et par phase.
// Victoire 3 points, nul 1, défaite 0 ; ± : vies restantes du gagnant. Fin du mois : podium (éclats et trophées).
// Hors ligne d'abord : les résultats attendent dans une file et partent dès que le réseau revient.
'use strict';

const TOUR_Q = 'elemento.tourQ', TOUR_B = 'elemento.tourBoard', TOUR_PAID = 'elemento.tourPaid';
STORE_DOMAINS[TOUR_PAID] = 'progress';
const TOUR = { board: store.get(TOUR_B) || null, busy: false, err: '' };
const TOUR_PRIZE = [30, 20, 10];
const tourUid = () => (typeof frLive === 'function' && frLive() && CLOUD.user ? CLOUD.user.id : null);
const UUID_RE = /^[0-9a-f-]{36}$/i;
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SH = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const tourMo = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const tourPrev = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return tourMo(d); };
// « Tournoi d’octobre », « Tournoi de mars », « October tournament »
function tourName(mo) {
  const m = +String(mo || tourMo()).slice(5, 7) - 1;
  if (IS_EN) return MONTHS_EN[m] + ' tournament';
  return 'Tournoi ' + (/^[aeiouyéèâ]/i.test(MONTHS_FR[m]) ? 'd’' : 'de ') + MONTHS_FR[m];
}
const tourShort = mo => { const m = +String(mo).slice(5, 7) - 1; return IS_EN ? MONTHS_EN[m].slice(0, 3) + '.' : MONTHS_SH[m]; };
const lastDay = mo => new Date(+mo.slice(0, 4), +mo.slice(5, 7), 0).getDate();
// Carte du mois : une carte aléatoire tirée du mois, exactement la même sur chaque téléphone (même pour l'aller et le retour)
const tourSeed = (mo = tourMo()) => [...('tour-' + mo)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 60466175 + 1;
const tourRnd = (mo = tourMo()) => ({ size: 'moyenne', seed: tourSeed(mo) });
function tourMapName(mo = tourMo()) {
  const m = +String(mo).slice(5, 7) - 1;
  return IS_EN ? MONTHS_EN[m] + ' map' : 'Carte ' + (/^[aeiouyéèâ]/i.test(MONTHS_FR[m]) ? 'd’' : 'de ') + MONTHS_FR[m];
}
// Aperçu de la carte du mois dans un canevas (W : largeur en px)
function tourMapDraw(cv, W) {
  const R = tourRnd(), mi = makeRandom(R.size, R.seed), pt = miniPortrait(), H = Math.round(pt ? W * 13 / 9 : W * 9 / 14);
  cv.style.width = W + 'px'; cv.style.height = H + 'px'; drawMapMini(prepMini(cv, W, H), mi, W, H, 'infini');
  return mi;
}
// Le mode 🏆 Tournoi n'est proposé que si le jeu en ligne est permis
const tourAvail = () => typeof frOn === 'function' && frOn();
const phaseName = p => (p === 1 ? T('match aller') : T('match retour'));

// ---------- Fin d'un duel : le résultat part dans la file, puis vers Supabase ----------
// won : victoire ; reason : 'net' (coupure ou appli quittée) ou 'ko'
function tourDuelEnd(won, reason) {
  const t = DUEL.tour; if (!t || t.sent) return;
  t.sent = true; t.won = won; t.reason = reason;
  const q = store.get(TOUR_Q) || [];
  q.push({ mid: t.mid, opp: t.opp, result: won ? 'win' : 'loss', margin: won && G ? Math.max(0, Math.min(99, G.lives | 0)) : null, reason, at: Date.now() });
  store.set(TOUR_Q, q);
  tourDuelPaint(); tourFlush();
}
async function tourFlush() {
  if (TOUR.busy || !tourUid()) return;
  const q = store.get(TOUR_Q) || []; if (!q.length) return;
  TOUR.busy = true;
  const keep = [];
  try {
    for (const it of q) {
      let r = null;
      try { r = await frRpc('tour_report', { p_mid: it.mid, p_opp: it.opp, p_result: it.result, p_margin: it.margin, p_reason: it.reason }); }
      catch (e) { keep.push(it); continue; }
      // En attente de l'autre téléphone : on réessaie pendant une semaine
      if (r && r.ok === 'pending' && Date.now() - it.at < 7 * 864e5) keep.push(it);
      if (DUEL.tour && DUEL.tour.mid === it.mid) { DUEL.tour.res = r; tourDuelPaint(); }
    }
  } finally {
    // Des résultats ont pu arriver pendant l'envoi
    const now = store.get(TOUR_Q) || [], sent = new Set(q.map(x => x.mid));
    store.set(TOUR_Q, keep.concat(now.filter(x => !sent.has(x.mid))));
    TOUR.busy = false;
  }
  // L'autre téléphone envoie souvent quelques secondes plus tard : on réessaie tant que l'écran de fin est affiché
  if (DUEL.tour && DUEL.tour.res && DUEL.tour.res.ok === 'pending' && curScreen === 'duel' && (DUEL.tour.tries = (DUEL.tour.tries || 0) + 1) < 8) setTimeout(tourFlush, 6000);
}
// Le bloc « Tournoi » de l'écran de fin de duel (index.html, #dTour)
function tourDuelPaint() {
  const el = $('#dTour'), t = DUEL.tour; if (!el) return;
  el.hidden = !t || !t.sent; if (el.hidden) return;
  const r = t.res, name = esc(dname(t.oppPeer));
  let h = '<span class="tchip">🏆 ' + tourName() + '</span>';
  if (!r) h += '<p>' + (tourUid() ? T('Envoi du résultat…') : T('Hors ligne : le résultat sera envoyé au retour du réseau.')) + '</p>';
  else if (r.err === 'not_friend') h += '<p>' + T('Ce duel ne compte pas pour le tournoi : vous n’êtes pas amis dans le jeu.') + '</p>';
  else if (r.err) h += '<p>' + T('Ce duel ne compte pas pour le tournoi.') + '</p>';
  else if (r.ok === 'pending') h += '<p>' + T('En attente du résultat envoyé par ') + name + '…</p>';
  else if (r.ok === 'mismatch') h += '<p>' + T('Les deux téléphones ne sont pas d’accord sur le résultat : ce duel ne compte pas.') + '</p>';
  else if (r.ok === 'not_counted') h += '<p>' + T('Ce duel ne compte pas : vous vous êtes déjà affrontés pendant les ') + (r.phase === 1 ? T('matchs aller') : T('matchs retour')) + '.</p>';
  else {
    h += '<div class="tpts"><div class="' + (r.pts ? 'y' : '') + '"><b>+' + r.pts + '</b><small>' + (r.pts > 1 ? T('points') : T('point')) + '</small></div><div><b>' + phaseName(r.phase) + '</b><small>' + T('contre ') + name + '</small></div></div>';
    if (!t.won && t.reason === 'net' && !t.asked) h += '<p>' + T('Ta connexion a coupé ? Demande à ') + name + T(' de rejouer : s’il accepte, ce match ne compte pas.') + '</p><button class="btn green" type="button" id="dTourAsk">' + T('🔁 Demander à rejouer') + '</button>';
    if (t.asked) h += '<p>' + T('Demande envoyée à ') + name + T('. Sans réponse en 2 jours, la défaite reste.') + '</p>';
  }
  el.innerHTML = h;
  const ask = $('#dTourAsk');
  if (ask) ask.addEventListener('click', async () => {
    ask.disabled = true;
    try { const a = await frRpc('tour_replay_ask', { p_id: t.res.id }); if (a && a.ok) { t.asked = true; Snd.play('build'); } else hint(T('La demande n’a pas pu partir.'), 2200); }
    catch (e) { hint(T('Pas de réseau : réessaie depuis l’écran du tournoi.'), 2400); }
    tourDuelPaint();
  });
}

// ---------- Écran du tournoi ----------
screens.tour = $('#sTour');
function openTour() {
  Snd.init(); show('tour'); screens.tour.scrollTop = 0; tourPaint();
  (async () => { await tourFlush(); await tourLoad(); await tourRewards(); })();
}
async function tourLoad() {
  if (!tourUid()) { tourPaint(); return; }
  TOUR.loading = true; tourPaint();
  try { const b = await frRpc('tour_board', { p_month: null }); if (b && !b.err) { TOUR.board = b; TOUR.err = ''; store.set(TOUR_B, b); } }
  catch (e) { TOUR.err = T('Le tournoi n’est pas disponible pour l’instant. Réessaie plus tard.'); }
  TOUR.loading = false; tourPaint();
  if (curScreen === 'multi' && typeof renderMP === 'function' && MP.state === 'home') renderMP();
}
const avCv = (av, n = 24) => '<canvas data-av="' + esc(av || 'feu') + '" data-size="' + n + '" style="width:' + n + 'px;height:' + n + 'px"></canvas>';
function tourPaint() {
  const b = $('#tourBody'); if (!b || curScreen !== 'tour') return;
  const B = TOUR.board, mo = B ? B.month : tourMo();
  $('#tourMo').textContent = '🏆 ' + tourName(mo);
  let h = '';
  if (!(typeof frOn === 'function' && frOn())) {
    b.innerHTML = '<p class="trnote">' + T('Le tournoi se joue entre amis, en ligne. Un parent doit d’abord autoriser le jeu en ligne (Profil → Espace parents).') + '</p>';
    return;
  }
  if (!tourUid() && !B) { b.innerHTML = '<p class="trnote">' + T('Connecte-toi à internet pour voir le tournoi de tes amis.') + '</p>'; return; }
  if (TOUR.err) h += '<p class="mp-err">' + esc(TOUR.err) + '</p>';
  const ph = B && B.current ? B.phase : 0, last = lastDay(mo), sh = tourShort(mo);
  h += '<div class="tphase"><span class="' + (ph === 1 ? 'on' : '') + '"><b>' + T('Matchs aller') + '</b>1 → 15 ' + sh + (ph === 1 ? T(' · en cours') : '') + '</span>'
    + '<span class="' + (ph === 2 ? 'on' : '') + '"><b>' + T('Matchs retour') + '</b>16 → ' + last + ' ' + sh + (ph === 2 ? T(' · en cours') : '') + '</span></div>';
  const card = '<div class="tmap"><canvas aria-hidden="true"></canvas><div><b>🗺️ ' + tourMapName(mo) + '</b><small>' + T('La même pour tous les duels du tournoi, jusqu’au ') + lastDay(mo) + ' ' + sh.replace(/\.$/, '') + T('. Elle change chaque mois.') + '</small>'
    + '<small class="how">' + T('Pour jouer : Multijoueur → Créer une partie → ⚙️ Configurer → 🏆 Tournoi') + '</small></div></div>';
  h += card;
  if (!B) { b.innerHTML = h + '<p class="mp-busy">' + T('Chargement…') + '</p>'; tourMapDraw(b.querySelector('.tmap canvas'), miniPortrait() ? 70 : 120); return; }
  const by = {}; for (const p of B.players.concat(B.friends)) by[p.id] = p;
  const nm = id => esc((by[id] || {}).pseudo || T('Joueur'));
  // Demandes de revanche : reçues (je suis le gagnant), envoyées
  for (const m of B.matches) if (m.status === 'replay_asked' && m.res === 'win')
    h += '<div class="treq"><p>🔌 <b>' + nm(m.opp) + '</b>' + T(' demande à rejouer votre ') + phaseName(m.phase) + T(' : sa connexion a coupé.') + '</p>'
      + '<div class="tbb"><button class="sbtn" type="button" data-rp="' + m.id + '" data-ok="1">' + T('Rejouer le match') + '</button><button class="sbtn" type="button" data-rp="' + m.id + '" data-ok="0">' + T('Garder ma victoire') + '</button></div></div>';
  for (const m of B.matches) if (m.status === 'replay_asked' && m.res === 'loss')
    h += '<div class="treq sent"><p>⏳ ' + T('Demande de revanche envoyée à ') + '<b>' + nm(m.opp) + '</b>' + T(' (sans réponse en 2 jours, la défaite reste).') + '</p></div>';
  // Classement
  h += '<p class="tlbl">' + T('Classement (aller + retour)') + '</p>';
  if (B.players.length < 2) h += '<p class="fine tfine">' + T('Personne n’a encore joué ce mois-ci. Lance un duel en mode 🏆 Tournoi avec un ami : il comptera.') + '</p>';
  else h += '<table class="tst"><tr><th>#</th><th>' + T('Joueur') + '</th><th>' + T('J') + '</th><th>' + T('V') + '</th><th>' + T('N') + '</th><th>' + T('D') + '</th><th>±</th><th>' + T('Pts') + '</th></tr>'
    + B.players.map((p, i) => '<tr class="' + (p.id === B.me ? 'me' : '') + '"><td>' + (i + 1) + '</td><td class="nm">' + avCv(p.avatar, 22) + '<span>' + esc(p.pseudo) + '</span>' + (p.id === B.me ? '<span class="tg">' + T('toi') + '</span>' : '') + '</td><td>' + p.j + '</td><td>' + p.v + '</td><td>' + p.n + '</td><td>' + p.d + '</td><td>' + (p.diff > 0 ? '+' : p.diff < 0 ? '−' : '') + Math.abs(p.diff) + '</td><td>' + p.pts + '</td></tr>').join('')
    + '</table><p class="tleg">' + T('J joués · V victoires (3 pts) · N nuls (1 pt) · D défaites (0 pt) · ± vies restantes du gagnant') + '</p>';
  // Mes matchs, ami par ami
  h += '<p class="tlbl">' + T('Tes matchs') + '</p>';
  if (!B.friends.length) h += '<p class="fine tfine">' + T('Ajoute des amis avec leur code ami (Profil → Amis) pour jouer le tournoi.') + '</p>';
  const cell = (f, p) => {
    const m = B.matches.find(x => x.opp === f.id && x.phase === p);
    if (m) {
      const k = m.res === 'win' ? 'w' : m.res === 'loss' ? 'l' : 'd', s = m.res === 'win' ? T('V +') + m.margin : m.res === 'loss' ? T('D −') + m.margin : T('Nul');
      const ask = m.res === 'loss' && m.reason === 'net' && !m.asked && B.current ? '<button class="sbtn tre" type="button" data-ask="' + m.id + '" title="' + T('Demander à rejouer') + '">🔁</button>' : '';
      return '<span class="tres ' + k + '">' + (p === 1 ? T('Aller : ') : T('Retour : ')) + s + (m.status === 'replay_asked' ? ' ⏳' : '') + '</span>' + ask;
    }
    const todo = !B.current ? T('pas joué') : p < B.phase ? T('pas joué') : p === B.phase ? T('à jouer') : T('dès le 16');
    return '<span class="tres t">' + (p === 1 ? T('Aller : ') : T('Retour : ')) + todo + '</span>';
  };
  h += '<div class="tvs">' + B.friends.map(f => '<div class="r"><span class="nm">' + avCv(f.avatar, 22) + '<span>' + esc(f.pseudo) + '</span></span>' + cell(f, 1) + cell(f, 2) + '</div>').join('') + '</div>';
  h += '<p class="fine tfine">' + T('Comptent : les duels en mode 🏆 Tournoi entre amis connectés, le premier contre chaque ami dans chaque phase. Fin du mois : 🥇 ') + TOUR_PRIZE[0] + T(' éclats, 🥈 ') + TOUR_PRIZE[1] + T(', 🥉 ') + TOUR_PRIZE[2] + '.</p>';
  if (TOUR.loading) h += '<p class="mp-busy">' + T('Mise à jour…') + '</p>';
  b.innerHTML = h;
  const tc = b.querySelector('.tmap canvas'); if (tc && mo === tourMo()) tourMapDraw(tc, miniPortrait() ? 70 : 120); else if (tc) tc.remove();
  if (typeof frAvatars === 'function') frAvatars(b);
}
$('#tourBody').addEventListener('click', async ev => {
  const rp = ev.target.closest('[data-rp]'), ask = ev.target.closest('[data-ask]');
  if (!rp && !ask) return;
  Snd.init(); (rp || ask).disabled = true;
  try {
    const r = rp ? await frRpc('tour_replay_answer', { p_id: rp.dataset.rp, p_accept: rp.dataset.ok === '1' }) : await frRpc('tour_replay_ask', { p_id: ask.dataset.ask });
    if (r && r.ok) { Snd.play('build'); hint(rp ? (rp.dataset.ok === '1' ? T('Match effacé : vous pouvez le rejouer.') : T('Ta victoire est gardée.')) : T('Demande envoyée.'), 2200); }
    else hint(r && r.err === 'expired' ? T('Trop tard : la demande date de plus de 2 jours.') : T('Ce n’est plus possible.'), 2400);
  } catch (e) { hint(T('Pas de réseau : réessaie plus tard.'), 2200); }
  tourLoad();
});
$('#tourBack').addEventListener('click', () => { if (typeof openMulti === 'function') openMulti(); else show('title'); });
document.addEventListener('keydown', ev => { if (curScreen === 'tour' && ev.key === 'Escape') $('#tourBack').click(); });

// Encart de l'écran Multijoueur (js/multi.js) : mon rang et les demandes en attente
function tourCardHTML() {
  if (!(typeof frOn === 'function' && frOn())) return '';
  const B = TOUR.board && TOUR.board.month === tourMo() ? TOUR.board : null;
  let sub = T('Affronte tes amis en duel ce mois-ci');
  if (B) {
    const i = B.players.findIndex(p => p.id === B.me), req = B.matches.filter(m => m.status === 'replay_asked' && m.res === 'win').length;
    if (B.players.length > 1 && i >= 0 && B.players[i].j) sub = T('Tu es ') + (IS_EN ? (i + 1) + (['st', 'nd', 'rd'][i] || 'th') : (i ? i + 1 + 'e' : '1er')) + ' · ' + B.players[i].pts + ' pts';
    if (req) sub += ' · ' + req + (req > 1 ? T(' demandes de revanche') : T(' demande de revanche'));
  }
  return '<button class="mp-tour" type="button" data-a="tour"><span class="ti">🏆</span><span class="tt"><b>' + tourName() + '</b><small>' + sub + '</small></span><span class="tv">' + T('Voir ›') + '</span></button>';
}

// ---------- Fin du mois : podium (éclats et trophées), une seule fois par mois ----------
async function tourRewards() {
  if (!tourUid() || (typeof duelOn !== 'undefined' && duelOn)) return;
  const prev = tourPrev(), paid = store.get(TOUR_PAID) || {};
  if (paid[prev]) return;
  let B = null;
  try { B = await frRpc('tour_board', { p_month: prev }); } catch (e) { return; }
  if (!B || B.err) return;
  const ps = B.players.filter(p => p.j > 0), i = ps.findIndex(p => p.id === B.me);
  const rec = { rank: i + 1, n: ps.length, shards: 0 };
  if (i >= 0 && ps.length >= 2) {
    rec.shards = i < 3 && ps.length > i ? TOUR_PRIZE[i] : 0;
    if (i === 0) trophy('tour_win');
    if (i < 3) trophy('tour_pod');
    // Tous ses matchs : chaque autre participant affronté à l'aller et au retour
    if (ps.filter(p => p.id !== B.me).every(p => [1, 2].every(ph => B.matches.some(m => m.opp === p.id && m.phase === ph)))) trophy('tour_all');
  }
  paid[prev] = rec; store.set(TOUR_PAID, paid);
  if (rec.shards) {
    meta.shards += rec.shards; meta.earned = (meta.earned || 0) + rec.shards; saveMeta();
    hint('🏆 ' + tourName(prev) + T(' : tu finis ') + (IS_EN ? rec.rank + (['st', 'nd', 'rd'][rec.rank - 1] || 'th') : rec.rank === 1 ? '1er' : rec.rank + 'e') + ' ! +' + rec.shards + T(' éclats'), 4000);
  }
}

// Au démarrage et au retour du réseau : les résultats en attente partent, puis le podium du mois passé
setTimeout(() => { tourFlush().then(tourRewards); if (tourUid()) tourLoad(); }, 9000);
window.addEventListener('online', () => setTimeout(() => tourFlush().then(tourRewards), 3000));
