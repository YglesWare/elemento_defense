// Élémento Defense : vidéos à récompense, jamais imposées. Le joueur touche un bouton, confirme, regarde, et gagne
// de l'or ou des éclats. Quatre endroits : fin de partie (doubler les éclats), écran des cartes (coup de pouce pour la
// carte suivante), défis du jour (2e coffre), K.O. (continuer avec 5 vies). 10 pubs par jour au plus (réglable dans admin.html).
// Rien ne s'affiche si l'espace parents les coupe (js/parents.js), dans l'histoire, en multijoueur, ni sur le site,
// ni tant que la fonction en bêta « ads » n'est pas ouverte dans admin.html (js/cloud.js, flagOn).
// Tant que le compte AdMob n'existe pas, une « pub d'essai » de 3 secondes la remplace (localhost et APK GitHub).
'use strict';

const ADS_KEY = 'elemento.ads', ADS_CHEST = 100, ADS_REVIVE = 5;
// Maximums par jour : changés depuis admin.html (réglages du jeu), sinon 10 en tout et 3 sur l'écran des cartes
const adsMax = () => typeof setting === 'function' ? setting('ads_max', 10) : 10;
const adsMapMax = () => typeof setting === 'function' ? setting('ads_map_max', 3) : 3;
STORE_DOMAINS[ADS_KEY] = 'progress';
const ADMOB_REWARD_ID = null; // identifiant du bloc d'annonces « avec récompense », à remplir avec le compte AdMob
const admob = () => ADMOB_REWARD_ID && window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.AdMob;
const AD_TEST = DEV_HOST || (NATIVE && !window.STORE_BUILD);
// Compteur du jour : n pubs en tout, map coups de pouce en cagnotte, revive (une seconde chance par jour)
function adDay() { const r = store.get(ADS_KEY) || {}; return r.d === dayKey() ? r : { d: dayKey(), n: 0, map: 0, revive: false }; }
function adCount(k) { const r = adDay(); r.n++; if (k === 'map') r.map = (r.map || 0) + 1; if (k === 'revive') r.revive = true; store.set(ADS_KEY, r); }
// Tant que tout n'est pas prêt, les pubs sont une fonction en bêta : ouverte aux administrateurs ou à tous depuis admin.html
const adReady = () => typeof flagOn === 'function' && flagOn('ads') && adsAllowed() && adDay().n < adsMax() && (admob() ? navigator.onLine !== false : AD_TEST);
const adSolo = () => G && !G.story && !G.duel && !G.coop && !G.demo;

// ---------- Journal des pubs (supabase/ad_log.sql), pour voir plus tard quels emplacements et quels gains marchent ----------
// Une ligne par réponse du joueur : 'no' (refus à la confirmation), 'done' (vue, récompense donnée), 'skip' (fermée avant
// la fin), 'err' (pas de pub disponible) ; et 'seen' la première fois de la journée qu'un bouton s'affiche.
// Comme le journal des parties : gardé sur l'appareil, envoyé à la synchro suivante (js/cloud.js), rien depuis localhost.
const ADLOG_KEY = 'elemento.adlog', ADLOG_MAX = 300;
function adLog(kind, outcome, o) {
  if (DEV_HOST) return;
  const g = G && (kind === 'shards' || kind === 'revive') ? G : null, m = g && MAPS[g.map]; // la partie concernée
  const log = store.get(ADLOG_KEY) || [];
  log.push({ id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2),
    player_id: store.get(PID_KEY), at: Date.now(), build: BUILD, app: NATIVE ? 'apk' : 'web', test: !admob(),
    kind, outcome, amount: o ? o.amount : null, unit: o ? o.unit : null, day_n: adDay().n,
    map: m ? (m.daily ? 'jour-' + m.daily : m.rnd ? 'aleatoire-' + m.rnd.size : m.id) : null, diff: g ? g.diff : null, wave: g ? g.wave : null });
  while (log.length > ADLOG_MAX) log.shift();
  store.set(ADLOG_KEY, log);
}
// 'seen' : une fois par jour et par emplacement
function adSeen(kind) { const r = adDay(); r.seen = r.seen || {}; if (r.seen[kind]) return; r.seen[kind] = 1; store.set(ADS_KEY, r); adLog(kind, 'seen'); }

// ---------- Confirmation, puis la pub ----------
// o : { kind, amount, unit (pour le journal), title, reward (texte HTML), give (récompense), no (texte du refus),
//       cancel (appelé au refus ou si la pub n'a pas été vue jusqu'au bout) }
let AD = null;
function adOffer(o) {
  if (!adReady()) { if (o.cancel) o.cancel(); return; }
  AD = o; Snd.init();
  $('#adTitle').textContent = o.title || T('Regarder une courte pub ?');
  $('#adReward').innerHTML = o.reward;
  $('#adNo').textContent = o.no || T('Non merci');
  $('#adLeft').textContent = T('Publicité · ') + (adDay().n + 1) + T(' sur ') + adsMax() + T(' aujourd’hui');
  $('#adAsk').hidden = false;
}
function adCancel() { const o = AD; AD = null; $('#adAsk').hidden = true; if (o) adLog(o.kind, 'no', o); if (o && o.cancel) o.cancel(); }
$('#adNo').addEventListener('click', adCancel);
$('#adGo').addEventListener('click', async () => {
  const o = AD; if (!o) return;
  $('#adAsk').hidden = true;
  let ok = false, err = false;
  try { ok = admob() ? await adShowAdmob() : await adShowTest(); } catch (e) { ok = false; err = true; }
  AD = null;
  adLog(o.kind, ok ? 'done' : err ? 'err' : 'skip', o);
  if (!ok) { hint(T('Pas de récompense cette fois : la pub n’a pas été vue jusqu’au bout.'), 2400); if (o.cancel) o.cancel(); return; }
  adCount(o.kind); o.give(); Snd.play('win');
  adPaintAll();
});

// Pub d'essai : 3 secondes, on peut la fermer avant (sans récompense)
function adShowTest() {
  return new Promise(res => {
    const box = $('#adPlay'), bar = $('#adBar'), t0 = performance.now(), DUR = 3000;
    box.hidden = false; $('#adSkip').textContent = T('Fermer');
    let raf = 0;
    const end = ok => { cancelAnimationFrame(raf); box.hidden = true; $('#adSkip').onclick = null; res(ok); };
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / DUR); bar.style.width = Math.round(p * 100) + '%';
      $('#adSec').textContent = Math.ceil((1 - p) * DUR / 1000);
      if (p >= 1) { $('#adSkip').textContent = T('Récupérer la récompense'); $('#adSkip').onclick = () => end(true); return; }
      raf = requestAnimationFrame(tick);
    };
    $('#adSkip').onclick = () => end(false);
    tick();
  });
}

// Vraie pub (module @capacitor-community/admob) : pubs « destinées aux enfants », non personnalisées, tous publics.
// La récompense n'est donnée qu'au signal de Google (vidéo vue). À vérifier sur un téléphone au branchement du compte.
let adInit = null;
async function adShowAdmob() {
  const A = admob();
  if (!adInit) adInit = A.initialize({ tagForChildDirectedTreatment: true, tagForUnderAgeOfConsent: true, maxAdContentRating: 'General' });
  await adInit;
  await A.prepareRewardVideoAd({ adId: ADMOB_REWARD_ID, npa: true });
  let got = false;
  const h = await A.addListener('onRewardedVideoAdReward', () => { got = true; });
  try { await A.showRewardVideoAd(); } finally { h.remove(); } // la musique se coupe seule : l'appli passe en arrière-plan
  return got;
}

// ---------- A · Fin de partie : doubler les éclats (une fois par partie) ----------
function adOverPaint(quit) {
  adOverPaint.q = quit;
  const b = $('#oAd'), n = G ? G.shardsPaid : 0;
  b.hidden = quit || !adSolo() || G.adShards || n <= 0 || !adReady();
  if (b.hidden) return;
  adSeen('shards');
  b.innerHTML = T('🎬 Doubler les éclats : +') + n + ' <small>' + T('PUB') + '</small>';
  b.onclick = () => adOffer({ kind: 'shards', amount: n, unit: 'shards', reward: GEM + ' +' + n + T(' éclats'), give: () => {
    if (!G || G.adShards) return;
    G.adShards = n; meta.shards += n; meta.earned += n; saveMeta();
    $('#oShards').textContent = '+' + (G.shardsPaid + n);
    $('#oGainDetail').textContent = T('Éclats doublés grâce à la pub. Tu as maintenant ') + meta.shards + T(' éclats.');
    hint(T('Merci ! +') + n + T(' éclats'), 1800);
  } });
}

// ---------- B · Écran des cartes : 10 % de la carte suivante quand il manque de l'or (3 fois par jour, réglable) ----------
function adMapNext() { const i = MAPS.findIndex((m, k) => !m.season && !m.random && !mapOwned(k)); return i >= 0 && (meta.bank || 0) < MAPS[i].price ? i : -1; }
function adMapsPaint() {
  const b = $('#mAd'), i = adMapNext();
  b.hidden = i < 0 || (adDay().map || 0) >= adsMapMax() || !adReady();
  if (b.hidden) return;
  adSeen('map');
  const g = clamp(Math.round(MAPS[i].price * 0.1 / 10) * 10, 50, 300);
  b.innerHTML = T('🎬 +') + g + T(' or dans la cagnotte') + ' <small>' + T('PUB') + '</small>';
  b.onclick = () => adOffer({ kind: 'map', amount: g, unit: 'gold', reward: COIN + ' +' + g + T(' or'), give: () => {
    meta.bank = (meta.bank || 0) + g; saveMeta(); renderMaps();
    hint(T('Merci ! +') + g + T(' or dans la cagnotte'), 1800);
  } });
}

// ---------- C · Défis du jour : un 2e coffre, une fois par jour, après le premier ----------
function adQuestPaint() {
  const b = $('#qAd'), st = typeof questDay === 'function' ? questDay() : null;
  b.hidden = !st || !st.chest || st.adChest || !adReady();
  if (b.hidden) return;
  adSeen('chest');
  b.innerHTML = T('🎬 Encore un coffre : +') + ADS_CHEST + T(' or') + ' <small>' + T('PUB') + '</small>';
  b.onclick = () => adOffer({ kind: 'chest', amount: ADS_CHEST, unit: 'gold', reward: '🎁 ' + COIN + ' +' + ADS_CHEST + T(' or'), give: () => {
    const s = questDay(); if (s.adChest) return;
    s.adChest = true; store.set(QUEST_KEY, s); meta.bank = (meta.bank || 0) + ADS_CHEST; saveMeta();
    hint(T('Merci ! +') + ADS_CHEST + T(' or dans la cagnotte'), 1800);
    questRender(); if (typeof refreshTitle === 'function') refreshTitle();
  } });
}

// ---------- D · K.O. : continuer avec 5 vies (une fois par jour, pas si la seconde chance de l'Atelier a servi) ----------
// Pas sur la carte du jour ni avec des piments : leurs classements entre amis doivent rester justes
function adCanRevive() { return adSolo() && !G.reviveUsed && !G.chal && !MAPS[G.map].daily && !adDay().revive && adReady(); }
function adKoAsk(B) {
  G.paused = true; G.koAsk = true;
  adSeen('revive');
  adOffer({ kind: 'revive', amount: ADS_REVIVE, unit: 'lives', title: T('K.O. ! Une seconde chance ?'), reward: '♥ ' + ADS_REVIVE + T(' vies'), no: T('Abandonner'),
    cancel: () => { if (!G) return; G.koAsk = false; gameOver(); },
    give: () => { if (!G) return; G.koAsk = false; G.paused = false; G.reviveUsed = true; reviveFx(B); } });
}

function adPaintAll() {
  if (curScreen === 'over' && G) adOverPaint(adOverPaint.q);
  if (curScreen === 'maps') adMapsPaint();
  if (!$('#questPop').hidden) adQuestPaint();
}
// Bouton retour d'Android (ou Échap) : refuse la pub proposée ; pendant la pub d'essai, ne fait rien
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (!$('#adPlay').hidden) ev.stopImmediatePropagation();
  else if (!$('#adAsk').hidden) { ev.stopImmediatePropagation(); adCancel(); }
}, true);
