// Élémento Defense : compte et sauvegarde en ligne (Supabase).
// Au premier lancement en ligne, un compte anonyme est créé tout seul et la progression est synchronisée
// (js/storage.js, Sync). Se connecter avec Google ou Discord rattache ce compte (la progression le suit) ;
// sur un autre appareil, la même connexion récupère la progression. Les règles RLS de la base
// (supabase/schema.sql) font que chacun ne lit et n'écrit que ses propres données.
'use strict';

// Clé publique : faite pour être visible ; la clé secrète ne doit jamais être dans le jeu
const SUPA_URL = 'https://iqxeeauemqedudbqnihb.supabase.co', SUPA_KEY = 'sb_publishable_w1tE_arugsOhYTQkxWSJEw_-NWpcljf';
// Lien de retour de connexion dans l'appli : la version Play Store et la version dev (APK GitHub) ont chacune le leur
const APP_CALLBACK = window.STORE_BUILD ? 'io.github.yglesware.elemento://login-callback' : 'io.github.yglesware.elemento.dev://login-callback';
const CLOUD = { sb: null, user: null, state: 'off', err: '', lastSync: 0, syncing: null };
const PROVIDERS = { google: 'Google', discord: 'Discord' };

// Pas de compte en ligne : outil d'équilibrage, page d'invité servie par un hôte de l'app, librairie absente
const cloudOff = () => (window.parent !== window && window.parent.BALANCE) || (typeof lanInfo === 'function' && lanInfo(location.href)) || typeof supabase === 'undefined';

// L'adaptateur que Sync (js/storage.js) utilise : toutes les lignes du joueur, puis l'envoi des changements locaux
const SupaSync = {
  user: async () => CLOUD.user,
  async pull() {
    const { data, error } = await CLOUD.sb.from('player_data').select('k,v,at,del');
    if (error) throw error;
    return data.map(r => ({ k: r.k, v: r.v, at: +r.at, del: r.del }));
  },
  async push(recs) {
    const rows = recs.map(r => ({ k: r.k, v: r.v, at: r.at, del: !!r.del, domain: r.domain }));
    const { error } = await CLOUD.sb.from('player_data').upsert(rows, { onConflict: 'user_id,k' });
    if (error) throw error;
  },
};

// Identifiant unique de la progression : créé une fois sur l'appareil et sauvegardé avec elle. Deux sauvegardes qui ont
// le même identifiant sont la même partie (on les fusionne) ; sinon, on demande au joueur laquelle garder.
const PID_KEY = 'elemento.playerId';
if (!store.get(PID_KEY)) store.set(PID_KEY, crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2));
const pidShort = id => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase().replace(/(.{4})(.{4})/, '$1-$2');
// Avancement d'une progression (0 = rien de joué)
const progressOf = (metaV, statsV) => ((metaV && metaV.earned) || 0) + 50 * ((statsV && statsV.games) || 0);
// Résumé d'une sauvegarde pour la fenêtre de choix
function saveSummary(get, at) {
  const m = get(META) || {}, st = get(STATS) || {}, best = get(BEST2) || {}, tr = get('elemento.trophies') || {};
  const maps = 1 + Object.keys(m.lv || {}).filter(k => k.startsWith('map_') && m.lv[k] > 0).length, won = Object.values(best).filter(r => Object.values(r).some(x => x && x.won)).length;
  const h = Math.floor((st.time || 0) / 3600), mn = Math.floor((st.time || 0) / 60) % 60;
  return { shards: m.shards || 0, bank: m.bank || 0, maps, won, games: st.games || 0, time: h ? h + ' h ' + String(mn).padStart(2, '0') : mn + ' min', trophies: Object.keys(tr).filter(k => !k.startsWith('_')).length, at };
}
// Fenêtre « quelle progression garder ? » : rend 'local' ou 'remote'
function cloudChoose(local, remote) {
  return new Promise(ok => {
    const card = (s, who) => '<div class="ccard"><b>' + who + '</b><span>💎 ' + s.shards + T(' éclats') + '</span><span>🐷 ' + s.bank + T(' or') + '</span><span>🗺️ ' + s.maps + T('/10 cartes · ') + s.won + T(' réussies') + '</span><span>🎮 ' + s.games + T(' parties · ') + s.time + '</span><span>🏆 ' + s.trophies + T(' trophées') + '</span>'
      + (s.at ? '<small>' + T('Modifiée le ') + new Date(s.at).toLocaleString(IS_EN ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</small>' : '') + '</div>';
    $('#ccCards').innerHTML = card(local, T('📱 Sur cet appareil')) + card(remote, T('☁️ En ligne'));
    const box = $('#cloudChoose'); box.hidden = false;
    const done = v => { box.hidden = true; ok(v); };
    $('#ccLocal').onclick = () => done('local'); $('#ccRemote').onclick = () => done('remote');
  });
}

// ---------- Journal des parties (pour comparer les vraies parties au bot d'équilibrage) ----------
// Chaque partie solo terminée (gagnée, perdue ou abandonnée) est notée sur l'appareil, puis envoyée à la table game_log
// à la synchro suivante (hors ligne, elle attend). Rien de personnel : la carte, la difficulté, le résultat, les éclats.
// Le joueur ne le voit pas et ne peut ni le relire ni l'effacer en ligne (RLS : ajout seulement) ; il sert à analyser
// et améliorer le jeu. Si le compte est supprimé, ses parties restent mais deviennent anonymes (supabase/game_log.sql).
const LOG_KEY = 'elemento.gamelog', LOG_MAX = 300;
function logGame(result, award) {
  if (!G || G.demo || G.duel || G.coop || G.story || G.logged || DEV_HOST || (window.parent !== window && window.parent.BALANCE)) return;
  G.logged = true;
  const m = MAPS[G.map], towers = {};
  for (const t of G.towers) towers[t.type] = (towers[t.type] || 0) + 1;
  const e = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2),
    player_id: store.get(PID_KEY), at: Date.now(), build: BUILD, app: NATIVE ? 'apk' : 'web',
    map: m.daily ? 'jour-' + m.daily : m.rnd ? 'aleatoire-' + m.rnd.size : m.id, map_n: m.rnd ? null : G.map + 1, diff: G.diff,
    result, wave: G.wave, waves: G.maxw, lives: Math.max(0, G.lives), game_n: stats.games, secs: Math.round(G.time),
    shards: award ? award.gain : 0, shards_left: meta.shards, earned: meta.earned || 0, atelier: Object.values(meta.lv).reduce((a, b) => a + (b || 0), 0),
    towers, hard: typeof hardMode === 'function' ? hardMode() : false,
    // Ce que le joueur a fait pendant la partie, son expérience, et où étaient ses tours
    placed: G.nPlaced || 0, sold: G.nSold || 0, ups: G.nUps || 0, first_leak: G.firstLeak ?? null, revives: G.revives || 0,
    ad_offer: !!G.adRevived, max_speed: G.maxSpd || 1, xp: logXp(), layout: logLayout(),
  };
  const log = store.get(LOG_KEY) || [];
  log.push(e);
  // Longtemps hors ligne : on garde les plus récentes
  while (log.length > LOG_MAX) log.shift();
  store.set(LOG_KEY, log);
}
// Expérience du joueur au moment de la partie : pour distinguer un débutant perdu d'un vrai mur de difficulté
function logXp() {
  const best = store.get(BEST2) || {}, won = Object.values(best).filter(r => Object.values(r).some(x => x && x.won)).length;
  return { games: stats.games, wins: stats.wins, ko: stats.ko, quits: stats.quits, towers: stats.towers, mins: Math.round(stats.time / 60), maps_won: won,
    guide: !!store.get('elemento.guideDone'), story: typeof storyDone === 'function' ? Object.values(storyDone()).filter(Boolean).length : 0 };
}
// Tours en place à la fin : case, distance au chemin le plus proche et portée (en cases, de centre à centre), nombre
// d'achats. Une tour plus loin du chemin que sa portée ne touche jamais rien
function logLayout() {
  const path = [...P.cells].map(k => k.split(',').map(Number)), r1 = v => Math.round(v * 10) / 10;
  return G.towers.map(t => {
    let d = Infinity; for (const [q, r] of path) d = Math.min(d, Math.hypot(q - t.c, r - t.r));
    return { t: t.type, q: t.c, r: t.r, d: r1(d), rg: r1(t.s.range || 0), n: upTot(t.up) };
  });
}
// Envoi d'un journal gardé sur l'appareil (parties, pubs) vers sa table
async function cloudPushQueue(key, table) {
  const out = store.get(key) || [];
  if (!out.length) return;
  // Même identifiant = même ligne : déjà envoyée (réponse perdue en route), la base la refuse comme doublon.
  // Ajout simple (le joueur n'a pas le droit de relire le journal, donc pas d'« upsert ») ; un doublon dans le lot
  // fait échouer tout le lot : on renvoie alors une par une.
  const sentIds = [], ins = rows => CLOUD.sb.from(table).insert(rows);
  const { error } = await ins(out);
  if (!error) sentIds.push(...out.map(x => x.id));
  else if (error.code === '23505') for (const x of out) { const r = await ins([x]); if (!r.error || r.error.code === '23505') sentIds.push(x.id); }
  if (!sentIds.length) return; // table absente, réseau… : on réessaiera à la prochaine synchro, sans gêner la sauvegarde
  const ids = new Set(sentIds), cur = store.get(key) || [];
  // Envoyées : elles n'ont plus rien à faire sur l'appareil
  store.set(key, cur.filter(x => !ids.has(x.id)));
}
const cloudPushLog = () => cloudPushQueue(LOG_KEY, 'game_log');

// Nouveau compte sur cet appareil (ou première synchro) : une seule des deux sauvegardes a été jouée → on la garde
// (fusion si c'est celle de l'appareil) ; les deux ont été jouées → le joueur choisit laquelle garder
async function cloudAdopt() {
  const uid = CLOUD.user.id;
  if ((await store.sys('syncUser')) === uid) return;
  const remote = await SupaSync.pull(), rm = new Map(remote.filter(r => !r.del).map(r => [r.k, r.v]));
  const rProg = progressOf(rm.get(META), rm.get(STATS)), lProg = progressOf(store.get(META), store.get(STATS));
  // Deux sauvegardes jouées (même venant d'une même progression) : le joueur choisit laquelle garder
  let choice = 'merge';
  if (rProg > 0) {
    if (lProg === 0) choice = 'remote';
    else {
      const lAt = Math.max(0, ...(await store.records()).filter(r => store.domain(r.k) !== 'local').map(r => r.at || 0));
      choice = await cloudChoose(saveSummary(k => store.get(k), lAt), saveSummary(k => rm.get(k), Math.max(0, ...remote.map(r => r.at || 0))));
    }
  }
  const remoteWins = choice === 'remote';
  // Garder celle de l'appareil : la sauvegarde en ligne est remplacée entièrement
  if (choice === 'local') { const { error } = await CLOUD.sb.from('player_data').delete().eq('user_id', uid); if (error) throw error; }
  if (remoteWins) {
    // La progression en ligne remplace celle de l'appareil (les préférences de l'appareil restent)
    for (const k of [...store.mem.keys()]) if (store.domain(k) !== 'local' && !rm.has(k)) store.mem.delete(k), store.queue.set(k, { k, v: null, del: 1, at: Date.now(), dirty: 0 });
    for (const r of remote) if (store.domain(r.k) !== 'local') { const v = r.del ? null : JSON.stringify(r.v); if (r.del) store.mem.delete(r.k); else store.mem.set(r.k, v); store.queue.set(r.k, { k: r.k, v, at: r.at, del: r.del ? 1 : 0, dirty: 0 }); }
    await store.flush(); cloudRehydrate();
  } else await Sync.markAllDirty();
  await store.sys('syncUser', uid); await store.sys('lastPull', 0);
}
// Recharge en mémoire ce que le jeu garde à part (progression, stats, options) après une synchro qui a apporté du neuf
function cloudRehydrate() {
  if (duelOn) return;
  const m = store.get(META) || {}; for (const k of Object.keys(meta)) delete meta[k]; Object.assign(meta, { shards: 0, earned: 0, lv: {} }, m); if (!meta.lv) meta.lv = {};
  const s = store.get(STATS) || {}; for (const k of Object.keys(stats)) stats[k] = 0; Object.assign(stats, s);
  Object.assign(opts, store.get(OPTS) || {});
  if (curScreen === 'title') refreshTitle();
  if (curScreen === 'profile') openProfile();
  if (typeof refreshTrophyBtn === 'function') refreshTrophyBtn();
}

// Fonctions en bêta (page admin.html, table feature_flags) : coupées, réservées aux administrateurs, ou ouvertes à tous.
// Le dernier état reçu reste sur l'appareil ; sans réponse du serveur (jamais connecté), tout est coupé.
// Réglages du jeu (table game_settings) : des nombres changés depuis admin.html, sinon la valeur par défaut du code.
const FLAGS_KEY = 'elemento.flags', SETTINGS_KEY = 'elemento.settings', CREATOR_KEY = 'elemento.creator';
const flagOn = k => !!(store.get(FLAGS_KEY) || {})[k];
const setting = (k, def) => { const v = (store.get(SETTINGS_KEY) || {})[k]; return typeof v === 'number' ? v : def; };
async function flagsLoad() {
  const [f, s] = await Promise.all([CLOUD.sb.rpc('flags_get'), CLOUD.sb.rpc('settings_get')]);
  if (!f.error) store.set(FLAGS_KEY, f.data || {});
  if (!s.error) store.set(SETTINGS_KEY, s.data || {});
  // Compte administrateur (tableau admins de supabase/admin.sql) : il peut porter le pseudo réservé « Ygles »
  // (js/trophies.js), sur n'importe quel appareil où il se connecte. Un invité ne l'est jamais.
  if (CLOUD.user && CLOUD.user.is_anonymous) store.set(CREATOR_KEY, false);
  else if (CLOUD.user) { const w = await CLOUD.sb.rpc('admin_whoami'); if (!w.error) store.set(CREATOR_KEY, !!(w.data && w.data.admin)); }
  if (typeof adPaintAll === 'function') adPaintAll();
}

// Synchronisation (hors partie et hors multijoueur, pour ne pas changer la progression en plein jeu)
function cloudSync(force) {
  if (!CLOUD.user || duelOn || (G && !G.over && curScreen === 'game')) return Promise.resolve();
  if (!force && Date.now() - CLOUD.lastSync < 30e3) return Promise.resolve();
  if (CLOUD.syncing) return CLOUD.syncing;
  CLOUD.state = 'sync'; cloudPaint();
  return CLOUD.syncing = (async () => {
    try {
      // Fonctions en bêta et statut admin d'abord : elles ne dépendent pas de la sauvegarde (une fenêtre de choix
      // ou une erreur de synchro ne doivent pas les bloquer)
      await flagsLoad().catch(() => {});
      await cloudMoveFinish().catch(() => {});
      await cloudAdopt();
      Sync.adapter = SupaSync;
      const r = await Sync.run();
      if (r && r.pulled) cloudRehydrate();
      await cloudPushLog().catch(() => {});
      if (typeof cloudPushErrors === 'function') await cloudPushErrors().catch(() => {});
      if (typeof cloudPushDaily === 'function') await cloudPushDaily().catch(() => {});
      if (typeof cloudPushMaps === 'function') await cloudPushMaps().catch(() => {});
      if (typeof ADLOG_KEY !== 'undefined') await cloudPushQueue(ADLOG_KEY, 'ad_log').catch(() => {});
      CLOUD.lastSync = Date.now(); CLOUD.state = 'ok'; CLOUD.err = '';
    } catch (e) { CLOUD.state = 'err'; CLOUD.err = (e && e.message) || String(e); }
    finally { CLOUD.syncing = null; cloudPaint(); }
  })();
}

async function cloudStart() {
  if (cloudOff()) return;
  // realtime : le multi en ligne peut passer par Supabase quand la liaison directe échoue (une dizaine de messages par seconde)
  CLOUD.sb = supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !NATIVE, flowType: 'pkce' }, realtime: { params: { eventsPerSecond: 40 } },
    global: { fetch: acctFetch } });
  CLOUD.sb.auth.onAuthStateChange((ev, session) => {
    const u = session ? session.user : null, changed = (u && u.id) !== (CLOUD.user && CLOUD.user.id);
    if (u && !u.is_anonymous) acctRemember(u);
    // Session perdue sans que le joueur se déconnecte : on note pourquoi (rapports techniques), pour corriger la cause
    if (ev === 'SIGNED_OUT' && !CLOUD.leaving && acctGet()) errNote('Session Google perdue : ' + (CLOUD.refreshErr || 'raison inconnue'), 'cloud.js');
    CLOUD.user = u; cloudPaint();
    if (u && changed) setTimeout(() => cloudSync(true), 0);
  });
  // Retour de connexion dans l'application Android (lien io.github.yglesware.elemento://login-callback?code=…)
  if (NATIVE) window.Capacitor.Plugins.App.addListener('appUrlOpen', async ev => {
    if (!ev.url || !ev.url.startsWith(APP_CALLBACK)) return;
    const q = new URL(ev.url.replace(APP_CALLBACK, 'https://cb/')).searchParams, code = q.get('code');
    if (q.get('error_description')) { cloudLoginError(q.get('error_description')); return; }
    if (code) { const { error } = await CLOUD.sb.auth.exchangeCodeForSession(code); if (error) { CLOUD.err = error.message; CLOUD.state = 'err'; cloudPaint(); } else hint(T('Connecté !'), 2000); }
  });
  try { CLOUD.providers = (await (await fetch(SUPA_URL + '/auth/v1/settings', { headers: { apikey: SUPA_KEY } })).json()).external || {}; } catch (e) { CLOUD.providers = {}; }
  // Sur le site, l'erreur de connexion revient dans l'adresse de la page : on la lit puis on nettoie l'adresse
  if (!NATIVE) {
    const ps = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, '')), ed = ps.get('error_description');
    if (ed) { history.replaceState(null, '', location.origin + location.pathname); cloudLoginError(ed); }
  }
  cloudPaint();
  await cloudEnsureUser();
  addEventListener('online', () => cloudEnsureUser().then(() => cloudSync(true)));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cloudSync(true); });
}
// ---------- Compte retenu sur l'appareil ----------
// Le jeu retient que l'appareil était connecté à Google. Si la session se perd (jeton refusé au redémarrage, par
// exemple après une mise à jour de l'appli), il ne crée plus de compte invité à la place : dans l'appli il se reconnecte
// tout seul au même compte Google, sinon il demande de se reconnecter (la progression reste sur l'appareil).
const ACCT_KEY = 'elemento.account';
function acctGet() { try { return JSON.parse(localStorage.getItem(ACCT_KEY) || 'null'); } catch (e) { return null; } }
function acctRemember(u) {
  const id = (u.identities || []).find(i => PROVIDERS[i.provider]); if (!id) return;
  try { localStorage.setItem(ACCT_KEY, JSON.stringify({ prov: id.provider, email: u.email || '', id: u.id })); } catch (e) {}
}
function acctForget() { try { localStorage.removeItem(ACCT_KEY); } catch (e) {} }
// Les réponses d'erreur du renouvellement de session, pour savoir pourquoi une session se perd
async function acctFetch(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok && /grant_type=refresh_token/.test(String(url))) r.clone().text().then(t => { CLOUD.refreshErr = r.status + ' ' + t.slice(0, 200); }).catch(() => {});
  return r;
}

// Une session, sinon (appareil jamais connecté) un compte anonyme ; il faut être en ligne
async function cloudEnsureUser() {
  if (!CLOUD.sb) return;
  const { data } = await CLOUD.sb.auth.getSession();
  if (data && data.session) { CLOUD.user = data.session.user; cloudPaint(); return cloudSync(true); }
  if (!navigator.onLine) { CLOUD.state = 'offline'; cloudPaint(); return; }
  const acct = acctGet();
  if (acct) {
    // Appli : reconnexion silencieuse au compte Google déjà autorisé (Google affiche juste « Connexion en tant que… »)
    if (acct.prov === 'google' && gidNative() && await gidNativeLogin(true)) return;
    CLOUD.state = 'relogin'; cloudPaint();
    if (!cloudEnsureUser.told) { cloudEnsureUser.told = true; hint(T('🔑 Reconnecte-toi à Google dans le Profil pour retrouver ta sauvegarde en ligne.'), 3500); }
    return;
  }
  const { error } = await CLOUD.sb.auth.signInAnonymously();
  if (error) { CLOUD.state = 'err'; CLOUD.err = error.message; cloudPaint(); }
}

const LOGIN_PROV = 'elemento.loginProv';
const loginOpts = () => ({ redirectTo: NATIVE ? APP_CALLBACK : location.origin + location.pathname, skipBrowserRedirect: NATIVE });
// Retour de connexion avec une erreur. Si ce compte Google appartient déjà à un autre compte du jeu (connexion faite
// ailleurs, sur un autre appareil ou la page d'administration), on s'y connecte directement : la progression de
// l'appareil part ensuite à la synchro (la fenêtre de choix s'ouvre si les deux comptes ont une progression)
async function cloudLoginError(desc) {
  let prov = 'google'; try { prov = localStorage.getItem(LOGIN_PROV) || 'google'; } catch (e) {}
  if (/already linked|already exists|identity_already_exists|manual linking/i.test(desc)) {
    hint(T('Ce compte ') + (PROVIDERS[prov] || prov) + T(' est déjà utilisé : connexion à ce compte…'), 3000);
    await cloudMoveStart();
    const res = await CLOUD.sb.auth.signInWithOAuth({ provider: prov, options: loginOpts() });
    if (res.error) { CLOUD.err = res.error.message; CLOUD.state = 'err'; cloudPaint(); return; }
    if (NATIVE && res.data && res.data.url) location.href = res.data.url;
    return;
  }
  CLOUD.err = desc; CLOUD.state = 'err'; cloudPaint();
}
// Connexion Google intégrée (jeton d'identité) : sur Android, le panneau Google du téléphone ; sur le site, le bouton
// officiel de Google. Google y montre le nom du jeu au lieu de l'adresse du serveur, et le même jeton sert à rattacher
// l'invité ou à se connecter : une seule étape. ID client « Web » du projet Google Cloud (public, comme la clé Supabase) ;
// vide, ou sans réglage pour cette appli : connexion par le navigateur
const GOOGLE_WEB_CLIENT = '164389209779-e8918dq22kh2dth8f6kr1g2r1qk54cj0.apps.googleusercontent.com';
const GID = { init: false, nonce: null, web: 'off' };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
// Google reçoit l'empreinte du nonce, Supabase le nonce lui-même : un jeton volé ne peut pas resservir ailleurs
async function gidNonce() {
  const raw = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { raw, hashed: hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))) };
}
const gidNative = () => NATIVE && !!GOOGLE_WEB_CLIENT && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('SocialLogin');
// Invité : on rattache le compte Google (même compte, la progression suit) ; s'il sert déjà ailleurs, le même jeton
// connecte à ce compte-là, et les amis, le code ami et les scores suivent (cloudMoveStart)
async function cloudLoginIdToken(token, raw) {
  CLOUD.state = 'sync'; cloudPaint();
  const cred = { provider: 'google', token, nonce: raw };
  let res = CLOUD.user && CLOUD.user.is_anonymous ? await CLOUD.sb.auth.linkIdentity(cred) : await CLOUD.sb.auth.signInWithIdToken(cred);
  if (res.error && /already|exists|linked|manual linking/i.test(res.error.message)) { await cloudMoveStart(); res = await CLOUD.sb.auth.signInWithIdToken(cred); }
  if (res.error) { CLOUD.state = 'err'; CLOUD.err = res.error.message; cloudPaint(); return; }
  if (res.data && res.data.user) CLOUD.user = res.data.user;
  hint(T('Connecté !'), 2000); cloudPaint();
  cloudSync(true);
}
// Android : panneau Google du téléphone. Renvoie false si ce n'est pas possible (pas réglé dans Google Cloud…),
// pour passer par le navigateur
// silent : reconnexion automatique, seulement au compte déjà autorisé, sans rien demander au joueur
async function gidNativeLogin(silent) {
  const SL = window.Capacitor.Plugins.SocialLogin;
  try {
    if (!GID.init) { await SL.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT, mode: 'online' } }); GID.init = true; }
    const n = await gidNonce();
    // Pas de filtre sur les comptes déjà utilisés quand le joueur choisit : sinon les comptes Family Link des enfants n'apparaissent pas
    const r = await SL.login({ provider: 'google', options: { nonce: n.hashed, style: 'bottom', filterByAuthorizedAccounts: !!silent, autoSelectEnabled: !!silent } });
    const tok = r && r.result && r.result.idToken;
    if (!tok) return false;
    await cloudLoginIdToken(tok, n.raw);
    return true;
  } catch (e) {
    const m = String(e && (e.message || e));
    if (silent) return false; // pas de reconnexion automatique possible : le joueur le fera depuis le Profil
    if (/cancel/i.test(m)) return true; // le joueur a fermé le panneau
    errNote('Connexion Google native : ' + m, 'cloud.js');
    return false;
  }
}
// Site : bouton officiel « Se connecter avec Google » à la place du nôtre, une fois le script de Google chargé
function gidWebLoad() {
  if (NATIVE || !GOOGLE_WEB_CLIENT || GID.web !== 'off' || !navigator.onLine) return;
  GID.web = 'loading';
  const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
  sc.onload = async () => {
    try {
      GID.nonce = await gidNonce();
      google.accounts.id.initialize({ client_id: GOOGLE_WEB_CLIENT, nonce: GID.nonce.hashed, use_fedcm_for_button: true,
        callback: r => { if (r && r.credential) cloudLoginIdToken(r.credential, GID.nonce.raw); } });
      google.accounts.id.renderButton($('#prGsi'), { type: 'standard', theme: 'outline', size: 'medium', shape: 'pill', text: 'signin', logo_alignment: 'left', locale: IS_EN ? 'en' : 'fr' });
      GID.web = 'ready';
    } catch (e) { GID.web = 'fail'; }
    cloudPaint();
  };
  sc.onerror = () => { GID.web = 'fail'; cloudPaint(); };
  document.head.appendChild(sc);
}
// Connexion Google ou Discord : un compte anonyme est rattaché (sa progression le suit) ; si ce compte Google
// est déjà utilisé ailleurs, on s'y connecte, et la progression la plus avancée est gardée
async function cloudLogin(provider) {
  if (!CLOUD.sb) return;
  if (provider === 'google' && gidNative() && await gidNativeLogin()) return;
  // Connexion pas encore activée dans Supabase : on le dit ici plutôt que d'ouvrir une page d'erreur
  try {
    const st = await (await fetch(SUPA_URL + '/auth/v1/settings', { headers: { apikey: SUPA_KEY } })).json();
    if (!st.external || !st.external[provider]) { CLOUD.state = 'err'; CLOUD.err = T('La connexion ') + PROVIDERS[provider] + T(' n’est pas encore activée.'); cloudPaint(); return; }
  } catch (e) { CLOUD.state = 'offline'; cloudPaint(); return; }
  try { localStorage.setItem(LOGIN_PROV, provider); } catch (e) {}
  // Par le navigateur, on ne sait pas d'avance si ce compte sert déjà ailleurs : tenter de le rattacher ouvrait la page
  // de Google une 2e fois quand il servait déjà. On se connecte donc directement, et l'invité passe son jeton de
  // déménagement (amis, code ami, scores) ; sa progression part à la synchro (la fenêtre de choix s'ouvre si besoin)
  await cloudMoveStart();
  const res = await CLOUD.sb.auth.signInWithOAuth({ provider, options: loginOpts() });
  if (res.error) { CLOUD.state = 'err'; CLOUD.err = /not enabled|unsupported provider/i.test(res.error.message) ? T('La connexion ') + PROVIDERS[provider] + T(' n’est pas encore activée.') : res.error.message; cloudPaint(); return; }
  // Dans l'app, Google refuse les WebView : la connexion s'ouvre dans le navigateur du téléphone, qui revient par le lien de l'app
  if (NATIVE && res.data && res.data.url) location.href = res.data.url;
}
// Invité qui se connecte à un compte Google déjà utilisé : on change de compte. Avant de partir, l'invité prend un jeton
// (supabase/friends.sql) ; une fois connecté, le jeu le rend et les amis, le code ami et les scores suivent.
const MOVE_KEY = 'elemento-move';
async function cloudMoveStart() {
  if (!CLOUD.user || !CLOUD.user.is_anonymous) return;
  const { data, error } = await CLOUD.sb.rpc('account_move_start');
  if (!error && data) try { localStorage.setItem(MOVE_KEY, data); } catch (e) {}
}
async function cloudMoveFinish() {
  let t = null; try { t = localStorage.getItem(MOVE_KEY); } catch (e) {}
  if (!t || !CLOUD.user || CLOUD.user.is_anonymous) return;
  const { data, error } = await CLOUD.sb.rpc('account_move_finish', { p_token: t });
  if (error && !/expiré|introuvable/.test(error.message)) return; // réseau… : on réessaiera à la prochaine synchro
  try { localStorage.removeItem(MOVE_KEY); } catch (e) {}
  if (data && data.amis) hint(T('Tes amis ont suivi sur ton compte (') + data.amis + ')', 2600);
  if (typeof FR !== 'undefined') { FR.ok = false; if (typeof frLoad === 'function') frLoad(true); }
}
async function cloudLogout() {
  if (!CLOUD.sb) return;
  await cloudSync(true);
  CLOUD.leaving = true; acctForget();
  await CLOUD.sb.auth.signOut().catch(() => {});
  CLOUD.leaving = false;
  CLOUD.user = null; await store.sys('syncUser', null);
  await cloudEnsureUser();
}
// Efface la sauvegarde en ligne du compte (la progression reste sur cet appareil)
async function cloudErase() {
  if (!CLOUD.user) return;
  const { error } = await CLOUD.sb.from('player_data').delete().eq('user_id', CLOUD.user.id);
  if (error) { CLOUD.err = error.message; CLOUD.state = 'err'; } else { await Sync.markAllDirty(); await store.sys('syncUser', null); CLOUD.state = 'erased'; }
  cloudPaint();
}

// ---------- Profil : bloc « Compte en ligne » ----------
function cloudWho() {
  const u = CLOUD.user, a = !u && CLOUD.state === 'relogin' && acctGet();
  if (a) return (PROVIDERS[a.prov] || T('Compte')) + (a.email ? ' · ' + a.email : '');
  if (!u) return null;
  if (u.is_anonymous) return T('Invité');
  const id = (u.identities || []).find(i => PROVIDERS[i.provider]), name = u.email || (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '';
  return (id ? PROVIDERS[id.provider] : T('Compte')) + (name ? ' · ' + name : '');
}
function cloudPaint() {
  const box = $('#prCloud'); if (!box) return;
  if (cloudOff()) { box.hidden = true; return; }
  const who = cloudWho(), ago = CLOUD.lastSync ? Math.max(0, Math.round((Date.now() - CLOUD.lastSync) / 60000)) : null;
  const st = CLOUD.state === 'relogin' ? T('🔑 Connexion expirée : touche « Se connecter » pour retrouver ta sauvegarde.') : CLOUD.state === 'sync' ? T('Synchronisation…') : CLOUD.state === 'offline' || !navigator.onLine ? T('Hors ligne : la synchro reprendra au retour du réseau.') : CLOUD.state === 'err' ? '⚠️ ' + CLOUD.err : CLOUD.state === 'erased' ? T('Sauvegarde en ligne effacée.') : ago == null ? '' : ago < 1 ? T('Synchronisée à l’instant.') : IS_EN ? 'Synced ' + ago + ' min ago.' : 'Synchronisée il y a ' + ago + ' min.';
  $('#prCloudWho').textContent = who || T('Invité');
  $('#prCloudState').textContent = st;
  const anon = !CLOUD.user || CLOUD.user.is_anonymous, prov = CLOUD.providers || {};
  let any = false;
  for (const b of box.querySelectorAll('[data-login]')) { b.hidden = !anon || !prov[b.dataset.login]; any = any || !b.hidden; }
  // Site : le bouton officiel de Google remplace le nôtre dès qu'il est prêt
  const gb = box.querySelector('[data-login="google"]'), gsi = $('#prGsi');
  if (gb && !gb.hidden) gidWebLoad();
  if (gsi) { gsi.hidden = !(gb && !gb.hidden && GID.web === 'ready'); if (!gsi.hidden) gb.hidden = true; }
  $('#prCloudId').textContent = T('Identifiant de progression : ') + pidShort(store.get(PID_KEY));
  // Administrateur : état des fonctions en bêta sur cet appareil (pour comprendre pourquoi un bouton n'apparaît pas)
  const adm = $('#prAdmin');
  if (adm) {
    adm.hidden = store.get(CREATOR_KEY) !== true;
    if (!adm.hidden) adm.textContent = '🛠️ Admin · ' + T('pubs : ') + (flagOn('ads') ? (typeof adsAllowed === 'function' && !adsAllowed() ? T('coupées par le code parent') : T('actives') + (typeof admob === 'function' && admob() ? T(' (vidéos de test pour toi)') : typeof AD_TEST !== 'undefined' && !AD_TEST ? T(' (pas de pub sur le site)') : '')) : T('coupées (fonction en bêta)'));
  }
  // Connexion expirée : « Se déconnecter » permet aussi de continuer en invité (le compte retenu est oublié)
  $('#prLogout').hidden = anon && CLOUD.state !== 'relogin';
  // L'encart du compte reste sous le pseudo, dans la carte du profil
}
// Supprimer son compte (après la confirmation d'un parent) : tout est effacé en ligne ; la progression reste sur l'appareil,
// sur un nouveau compte invité
async function cloudDeleteAccount() {
  if (!CLOUD.sb || !CLOUD.user) return;
  CLOUD.state = 'sync'; cloudPaint();
  const { error } = await CLOUD.sb.rpc('delete_my_account');
  if (error) { CLOUD.state = 'err'; CLOUD.err = /function|schema cache/i.test(error.message) ? T('La suppression de compte n’est pas encore activée.') : error.message; cloudPaint(); return; }
  CLOUD.leaving = true; acctForget();
  await CLOUD.sb.auth.signOut({ scope: 'local' }).catch(() => {});
  CLOUD.leaving = false;
  CLOUD.user = null; await store.sys('syncUser', null);
  hint(T('Compte supprimé.'), 2200);
  await cloudEnsureUser();
}
document.querySelectorAll('#prCloud [data-login]').forEach(b => b.addEventListener('click', () => { Snd.init(); cloudLogin(b.dataset.login); }));
$('#prSyncNow').addEventListener('click', () => cloudEnsureUser().then(() => cloudSync(true)));
$('#prLogout').addEventListener('click', () => cloudLogout());
$('#prErase').addEventListener('click', () => { const b = $('#prEraseBox'); b.hidden = !b.hidden; });
$('#prEraseNo').addEventListener('click', () => { $('#prEraseBox').hidden = true; });
$('#prEraseYes').addEventListener('click', () => { $('#prEraseBox').hidden = true; cloudErase(); });
$('#prDelAcct').addEventListener('click', () => { const b = $('#prDelBox'); b.hidden = !b.hidden; });
$('#prDelNo').addEventListener('click', () => { $('#prDelBox').hidden = true; });
$('#prDelYes').addEventListener('click', () => { $('#prDelBox').hidden = true; openParents('delacct'); });

cloudStart().catch(e => { CLOUD.state = 'err'; CLOUD.err = (e && e.message) || String(e); cloudPaint(); });
