// Élémento Defense : compte et sauvegarde en ligne (Supabase).
// Au premier lancement en ligne, un compte anonyme est créé tout seul et la progression est synchronisée
// (js/storage.js, Sync). Se connecter avec Google ou Discord rattache ce compte (la progression le suit) ;
// sur un autre appareil, la même connexion récupère la progression. Les règles RLS de la base
// (supabase/schema.sql) font que chacun ne lit et n'écrit que ses propres données.
'use strict';

// Clé publique : faite pour être visible ; la clé secrète ne doit jamais être dans le jeu
const SUPA_URL = 'https://iqxeeauemqedudbqnihb.supabase.co', SUPA_KEY = 'sb_publishable_w1tE_arugsOhYTQkxWSJEw_-NWpcljf';
const APP_CALLBACK = 'io.github.yglesware.elemento://login-callback';
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
  };
  const log = store.get(LOG_KEY) || [];
  log.push(e);
  // Longtemps hors ligne : on garde les plus récentes
  while (log.length > LOG_MAX) log.shift();
  store.set(LOG_KEY, log);
}
async function cloudPushLog() {
  const out = store.get(LOG_KEY) || [];
  if (!out.length) return;
  // Même identifiant = même partie : déjà envoyée (réponse perdue en route), la base la refuse comme doublon.
  // Ajout simple (le joueur n'a pas le droit de relire le journal, donc pas d'« upsert ») ; un doublon dans le lot
  // fait échouer tout le lot : on renvoie alors une par une.
  const sentIds = [], ins = rows => CLOUD.sb.from('game_log').insert(rows);
  const { error } = await ins(out);
  if (!error) sentIds.push(...out.map(x => x.id));
  else if (error.code === '23505') for (const x of out) { const r = await ins([x]); if (!r.error || r.error.code === '23505') sentIds.push(x.id); }
  if (!sentIds.length) return; // table absente, réseau… : on réessaiera à la prochaine synchro, sans gêner la sauvegarde
  const ids = new Set(sentIds), cur = store.get(LOG_KEY) || [];
  // Envoyées : elles n'ont plus rien à faire sur l'appareil
  store.set(LOG_KEY, cur.filter(x => !ids.has(x.id)));
}

// Nouveau compte sur cet appareil (ou première synchro) : même progression → fusion ; une seule des deux a été jouée →
// on la garde ; deux progressions différentes → le joueur choisit
async function cloudAdopt() {
  const uid = CLOUD.user.id;
  if ((await store.sys('syncUser')) === uid) return;
  const remote = await SupaSync.pull(), rm = new Map(remote.filter(r => !r.del).map(r => [r.k, r.v]));
  const rProg = progressOf(rm.get(META), rm.get(STATS)), lProg = progressOf(store.get(META), store.get(STATS));
  let choice = 'merge';
  if (rProg > 0 && rm.get(PID_KEY) !== store.get(PID_KEY)) {
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

// Synchronisation (hors partie et hors multijoueur, pour ne pas changer la progression en plein jeu)
function cloudSync(force) {
  if (!CLOUD.user || duelOn || (G && !G.over && curScreen === 'game')) return Promise.resolve();
  if (!force && Date.now() - CLOUD.lastSync < 30e3) return Promise.resolve();
  if (CLOUD.syncing) return CLOUD.syncing;
  CLOUD.state = 'sync'; cloudPaint();
  return CLOUD.syncing = (async () => {
    try {
      await cloudAdopt();
      Sync.adapter = SupaSync;
      const r = await Sync.run();
      if (r && r.pulled) cloudRehydrate();
      await cloudPushLog().catch(() => {});
      if (typeof cloudPushErrors === 'function') await cloudPushErrors().catch(() => {});
      if (typeof cloudPushDaily === 'function') await cloudPushDaily().catch(() => {});
      if (typeof cloudPushMaps === 'function') await cloudPushMaps().catch(() => {});
      CLOUD.lastSync = Date.now(); CLOUD.state = 'ok'; CLOUD.err = '';
    } catch (e) { CLOUD.state = 'err'; CLOUD.err = (e && e.message) || String(e); }
    finally { CLOUD.syncing = null; cloudPaint(); }
  })();
}

async function cloudStart() {
  if (cloudOff()) return;
  // realtime : le multi en ligne peut passer par Supabase quand la liaison directe échoue (une dizaine de messages par seconde)
  CLOUD.sb = supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !NATIVE, flowType: 'pkce' }, realtime: { params: { eventsPerSecond: 40 } } });
  CLOUD.sb.auth.onAuthStateChange((ev, session) => {
    const u = session ? session.user : null, changed = (u && u.id) !== (CLOUD.user && CLOUD.user.id);
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
// Une session, sinon un compte anonyme (il faut être en ligne)
async function cloudEnsureUser() {
  if (!CLOUD.sb) return;
  const { data } = await CLOUD.sb.auth.getSession();
  if (data && data.session) { CLOUD.user = data.session.user; cloudPaint(); return cloudSync(true); }
  if (!navigator.onLine) { CLOUD.state = 'offline'; cloudPaint(); return; }
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
    const res = await CLOUD.sb.auth.signInWithOAuth({ provider: prov, options: loginOpts() });
    if (res.error) { CLOUD.err = res.error.message; CLOUD.state = 'err'; cloudPaint(); return; }
    if (NATIVE && res.data && res.data.url) location.href = res.data.url;
    return;
  }
  CLOUD.err = desc; CLOUD.state = 'err'; cloudPaint();
}
// Connexion Google ou Discord : un compte anonyme est rattaché (sa progression le suit) ; si ce compte Google
// est déjà utilisé ailleurs, on s'y connecte, et la progression la plus avancée est gardée
async function cloudLogin(provider) {
  if (!CLOUD.sb) return;
  // Connexion pas encore activée dans Supabase : on le dit ici plutôt que d'ouvrir une page d'erreur
  try {
    const st = await (await fetch(SUPA_URL + '/auth/v1/settings', { headers: { apikey: SUPA_KEY } })).json();
    if (!st.external || !st.external[provider]) { CLOUD.state = 'err'; CLOUD.err = T('La connexion ') + PROVIDERS[provider] + T(' n’est pas encore activée.'); cloudPaint(); return; }
  } catch (e) { CLOUD.state = 'offline'; cloudPaint(); return; }
  try { localStorage.setItem(LOGIN_PROV, provider); } catch (e) {}
  const opts2 = loginOpts();
  let res = CLOUD.user && CLOUD.user.is_anonymous ? await CLOUD.sb.auth.linkIdentity({ provider, options: opts2 }) : await CLOUD.sb.auth.signInWithOAuth({ provider, options: opts2 });
  if (res.error && /already|exists|linked|manual linking/i.test(res.error.message)) res = await CLOUD.sb.auth.signInWithOAuth({ provider, options: opts2 });
  if (res.error) { CLOUD.state = 'err'; CLOUD.err = /not enabled|unsupported provider/i.test(res.error.message) ? T('La connexion ') + PROVIDERS[provider] + T(' n’est pas encore activée.') : res.error.message; cloudPaint(); return; }
  // Dans l'app, Google refuse les WebView : la connexion s'ouvre dans le navigateur du téléphone, qui revient par le lien de l'app
  if (NATIVE && res.data && res.data.url) location.href = res.data.url;
}
async function cloudLogout() {
  if (!CLOUD.sb) return;
  await cloudSync(true);
  await CLOUD.sb.auth.signOut();
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
  const u = CLOUD.user; if (!u) return null;
  if (u.is_anonymous) return T('Invité');
  const id = (u.identities || []).find(i => PROVIDERS[i.provider]), name = u.email || (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '';
  return (id ? PROVIDERS[id.provider] : T('Compte')) + (name ? ' · ' + name : '');
}
function cloudPaint() {
  const box = $('#prCloud'); if (!box) return;
  if (cloudOff()) { box.hidden = true; return; }
  const who = cloudWho(), ago = CLOUD.lastSync ? Math.max(0, Math.round((Date.now() - CLOUD.lastSync) / 60000)) : null;
  const st = CLOUD.state === 'sync' ? T('Synchronisation…') : CLOUD.state === 'offline' || !navigator.onLine ? T('Hors ligne : la synchro reprendra au retour du réseau.') : CLOUD.state === 'err' ? '⚠️ ' + CLOUD.err : CLOUD.state === 'erased' ? T('Sauvegarde en ligne effacée.') : ago == null ? '' : ago < 1 ? T('Synchronisée à l’instant.') : IS_EN ? 'Synced ' + ago + ' min ago.' : 'Synchronisée il y a ' + ago + ' min.';
  $('#prCloudWho').textContent = who || T('Invité');
  $('#prCloudState').textContent = st;
  const anon = !CLOUD.user || CLOUD.user.is_anonymous, prov = CLOUD.providers || {};
  let any = false;
  for (const b of box.querySelectorAll('[data-login]')) { b.hidden = !anon || !prov[b.dataset.login]; any = any || !b.hidden; }
  $('#prCloudId').textContent = T('Identifiant de progression : ') + pidShort(store.get(PID_KEY));
  $('#prLogout').hidden = anon;
  // Invité : l'encart sous le pseudo (pour se connecter) ; connecté : tout en bas, avant « Réinitialiser la progression »
  const anchor = anon ? $('#prNameWarn') : $('#prReset');
  if (anchor) { if (anon && box.previousElementSibling !== anchor) anchor.after(box); else if (!anon && box.nextElementSibling !== anchor) anchor.before(box); }
}
// Supprimer son compte (après la confirmation d'un parent) : tout est effacé en ligne ; la progression reste sur l'appareil,
// sur un nouveau compte invité
async function cloudDeleteAccount() {
  if (!CLOUD.sb || !CLOUD.user) return;
  CLOUD.state = 'sync'; cloudPaint();
  const { error } = await CLOUD.sb.rpc('delete_my_account');
  if (error) { CLOUD.state = 'err'; CLOUD.err = /function|schema cache/i.test(error.message) ? T('La suppression de compte n’est pas encore activée.') : error.message; cloudPaint(); return; }
  await CLOUD.sb.auth.signOut({ scope: 'local' }).catch(() => {});
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
