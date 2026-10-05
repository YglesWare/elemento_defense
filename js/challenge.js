// Élémento Defense : défis par carte (l'engrenage ⚙️) et classement des cartes entre amis (voir supabase/maps.sql).
// Sur une carte déjà gagnée une fois, le joueur règle des malus (plus de points) et des bonus (moins de points).
// Les défis ne changent que les points : ni or gagné, ni éclats. Le réglage est retenu par carte, sur l'appareil.
// Le meilleur score par carte et par difficulté part à la synchro (hors ligne, il attend) ; on ne voit que ses amis.
// En multijoueur, l'hôte règle les défis dans le salon (pas de classement).
'use strict';

const CHAL_KEY = 'elemento.chal', MB_KEY = 'elemento.mapbest', MQ_KEY = 'elemento.mapQ';
STORE_DOMAINS[CHAL_KEY] = 'progress'; STORE_DOMAINS[MB_KEY] = 'progress';
// p : points par cran (en %), négatif pour un bonus ; max : nombre de crans ; timer : n'agit que si la difficulté a un chrono
const CHAL = [
  { k: 'horde', ic: '👥', n: T('Horde'), d: T('+5 % d’ennemis par cran'), p: 4, max: 4 },
  { k: 'pv', ic: '❤️', n: T('Costauds'), d: T('+5 % de PV par cran'), p: 5, max: 4 },
  { k: 'vite', ic: '💨', n: T('Pressés'), d: T('+5 % de vitesse par cran'), p: 6, max: 4 },
  { k: 'armure', ic: '🛡️', n: T('Blindés'), d: T('+1 d’armure par cran'), p: 8, max: 3 },
  { k: 'bourse', ic: '🪙', n: T('Bourse plate'), d: T('−10 % d’or par cran'), p: 5, max: 3 },
  { k: 'fragile', ic: '💔', n: T('Fragile'), d: T('−2 vies par cran'), p: 6, max: 3 },
  { k: 'chrono', ic: '⏱️', n: T('Chrono serré'), d: T('−20 % de temps entre les vagues'), p: 5, max: 3, timer: true },
  { k: 'puriste', ic: '🧘', n: T('Puriste'), d: T('sans les améliorations de l’Atelier'), p: 40, max: 1 },
  { k: 'petits', ic: '🍬', n: T('Petits slimes'), d: T('−5 % de PV par cran'), p: -5, max: 4 },
  { k: 'escargot', ic: '🐢', n: T('Escargots'), d: T('−5 % de vitesse par cran'), p: -6, max: 4 },
  { k: 'tresor', ic: '💰', n: T('Trésor'), d: T('+10 % d’or au départ par cran'), p: -4, max: 3 },
  { k: 'maison', ic: '🏠', n: T('Maison solide'), d: T('+2 vies par cran'), p: -5, max: 3 },
  { k: 'soleil', ic: '☀️', n: T('Beau temps garanti'), d: T('pas de météo'), p: -5, max: 1 },
  { k: 'longue', ic: '🔭', n: T('Longue vue'), d: T('+5 % de portée par cran'), p: -6, max: 3 },
  { k: 'pouce', ic: '🎁', n: T('Coup de pouce'), d: T('ta première tour arrive au niveau 2'), p: -10, max: 1 },
  { k: 'calme', ic: '⏳', n: T('Pas de chrono'), d: T('les vagues ne partent jamais seules'), p: -5, max: 1, timer: true },
];
const CHAL_BY = Object.fromEntries(CHAL.map(c => [c.k, c])), SANS_P = 10;
const CHAL_ELEM = { feu: '🔥', eau: '💧', terre: '🪨', vent: '🌪️', foudre: '⚡', glace: '❄️' };
const CHAL_PRESETS = {
  tranquille: ['🍼', T('Tranquille'), { petits: 2, escargot: 2, maison: 1 }],
  epice: ['🌶', T('Épicé'), { horde: 2, pv: 2, vite: 1 }],
  infernal: ['🔥', T('Infernal'), { horde: 4, pv: 4, vite: 3, armure: 2, fragile: 2 }],
};

// ---------- Réglage : { m: { horde: 2… }, sans: ['feu'…] } ----------
// Ne garde que des clés connues et des nombres dans les bornes (le réglage d'un ami vient du réseau)
function chalClean(c) {
  const out = { m: {}, sans: [] }; if (!c || typeof c !== 'object') return out;
  for (const D of CHAL) { const v = Math.floor(+((c.m || {})[D.k]) || 0); if (v > 0) out.m[D.k] = Math.min(D.max, v); }
  if (Array.isArray(c.sans)) for (const e of c.sans) if (CHAL_ELEM[e] && !out.sans.includes(e) && out.sans.length < 5) out.sans.push(e);
  return out;
}
const chalOn = c => !!c && (Object.keys(c.m).length > 0 || c.sans.length > 0);
const chalTimer = diff => !diff || !!(DIFFS[diff] && DIFFS[diff].timer);
// Multiplicateur de points (1 + malus − bonus, entre ×0,3 et ×3) ; les défis liés au chrono ne comptent pas sans chrono
function chalMult(c, diff) {
  let m = 1;
  for (const k in c.m) { const D = CHAL_BY[k]; if (D && (!D.timer || chalTimer(diff))) m += D.p * c.m[k] / 100; }
  m += SANS_P * c.sans.length / 100;
  return Math.round(clamp(m, 0.3, 3) * 100) / 100;
}
const chalX = v => '×' + fr(v);
function chalNames(c) {
  const out = CHAL.filter(D => c.m[D.k]).map(D => D.n + (D.max > 1 ? ' ' + c.m[D.k] : ''));
  for (const e of c.sans) out.push(T('Sans ') + TOWERS[e].name);
  return out;
}
const chalGet = id => chalClean((store.get(CHAL_KEY) || {})[id]);
function chalSet(id, c) { const all = store.get(CHAL_KEY) || {}; c = chalClean(c); if (chalOn(c)) all[id] = c; else delete all[id]; store.set(CHAL_KEY, all); }
// Les défis existent sur les cartes fixes et les événements (pas sur la carte du jour ni les cartes aléatoires)
const chalMapOk = mi => { const m = MAPS[mi]; return !!m && !m.random && !m.daily && !m.rnd; };
// L'engrenage apparaît une fois la carte gagnée (dans n'importe quelle difficulté)
const chalOpen = mi => chalMapOk(mi) && Object.values((store.get(BEST2) || {})[recId(MAPS[mi])] || {}).some(r => r && r.won);

// ---------- Pendant la partie ----------
// Appelé par newGame (partie solo) et par le multijoueur (réglage de l'hôte)
function chalStart(c, fresh) {
  const used = !!(c && c.used); c = chalClean(c);
  if (!chalOn(c)) { G.chal = null; return; }
  G.chal = { m: c.m, sans: c.sans, mult: chalMult(c, G.diff), used };
  if (!fresh) return;
  // Puriste : l'or et les vies de départ achetés dans l'Atelier ne comptent pas non plus (baseState les a déjà ajoutés)
  const pur = chalLv('puriste') ? Math.round(lvOf(meta.lv, 'lives') * 2) : 0;
  if (chalLv('puriste')) G.gold -= Math.round(lvOf(meta.lv, 'gold') * 25);
  G.gold = Math.round(G.gold * chalGold());
  const dl = 2 * (chalLv('maison') - chalLv('fragile')) - pur;
  G.startLives = Math.max(1, G.startLives + dl); G.lives = Math.max(1, G.lives + dl);
}
const chalLv = k => (G && G.chal && G.chal.m[k]) || 0;
const chalGold = () => Math.max(0.3, (1 - 0.1 * chalLv('bourse')) * (1 + 0.1 * chalLv('tresor')));
const chalLoot = () => Math.max(0.3, 1 - 0.1 * chalLv('bourse'));
const chalHp = () => (1 + 0.05 * chalLv('pv')) * (1 - 0.05 * chalLv('petits'));
const chalSpd = () => (1 + 0.05 * chalLv('vite')) * (1 - 0.05 * chalLv('escargot'));
function chalBanned(type) {
  if (!G || !G.chal || !G.chal.sans.length) return false;
  if (G.chal.sans.includes(type)) return true;
  const F = typeof FUSIONS !== 'undefined' && FUSIONS[type];
  return !!(F && F.parents.some(p => G.chal.sans.includes(p)));
}
// Score affiché, enregistré et classé : le score de la partie × le multiplicateur des défis
const scoreFinal = () => Math.round(G.score * ((G.chal && G.chal.mult) || 1));

// ---------- Meilleurs scores par carte (appelé par recordBest, js/game.js) ----------
function chalRecord() {
  if (!G || G.duel || G.coop || G.story || G.demo || duelOn || !chalMapOk(G.map)) return;
  const id = MAPS[G.map].id, k = id + '|' + G.diff, all = store.get(MB_KEY) || {}, cur = all[k], sc = scoreFinal();
  if (cur && cur.score >= sc) return;
  const c = G.chal ? { m: G.chal.m, sans: G.chal.sans } : { m: {}, sans: [] };
  all[k] = { map: id, diff: G.diff, score: sc, mult: (G.chal && G.chal.mult) || 1, chal: c, wave: G.wave, won: !!G.won };
  store.set(MB_KEY, all);
  const q = store.get(MQ_KEY) || {}; q[k] = all[k]; store.set(MQ_KEY, q);
  if (typeof trophyScan === 'function') trophyScan();
}
async function cloudPushMaps() {
  const q = store.get(MQ_KEY) || {}, keys = Object.keys(q); if (!keys.length || DEV_HOST) return; // pas de scores de test depuis l'ordinateur
  for (const k of keys) {
    const r = q[k];
    const { error } = await CLOUD.sb.rpc('map_submit', { p_map: r.map, p_diff: r.diff, p_score: r.score, p_mult: r.mult, p_chal: r.chal, p_wave: r.wave, p_won: r.won });
    if (error) return; // fonction pas encore créée (supabase/maps.sql), réseau… : on réessaiera
    const now = store.get(MQ_KEY) || {}; if (now[k] && now[k].score === r.score) delete now[k]; store.set(MQ_KEY, now);
  }
  MR.at = 0;
}

// ---------- Classement des cartes entre amis ----------
const MR = { by: null, at: 0, map: null, diff: null };
const mrCmp = (a, b) => b.score - a.score;
// Toutes les cartes d'un coup : { 'volcan|moyen': [lignes triées] }
async function mapBoardLoad(force) {
  if (MR.by && !force && Date.now() - MR.at < 60e3) return MR.by;
  if (typeof frLive !== 'function' || !frLive()) return MR.by;
  const rows = await frRpc('map_board', {});
  const by = {};
  for (const r of rows || []) (by[r.map + '|' + r.diff] = by[r.map + '|' + r.diff] || []).push({ id: r.user_id, me: r.me, pseudo: r.me ? cleanPseudo() : r.pseudo, av: r.avatar, score: r.score, mult: +r.mult || 1, chal: chalClean(r.chal), wave: r.wave, won: r.won });
  for (const k in by) by[k].sort(mrCmp);
  MR.by = by; MR.at = Date.now();
  return by;
}
// Ligne « 🏆 » d'une carte : le meilleur ami (toutes difficultés), ou ma place
function mapRankRow(card, mi) {
  if (typeof rankOn !== 'function' || !rankOn()) return;
  const id = MAPS[mi].id, row = document.createElement('div'); row.className = 'drank';
  row.innerHTML = '<button class="sbtn drbtn" type="button">' + T('🏆 Amis') + '</button><span class="drtxt"></span>';
  const play = card.querySelector(':scope > .sbtn'); if (play) card.insertBefore(row, play); else card.appendChild(row);
  row.querySelector('button').addEventListener('click', ev => { ev.stopPropagation(); openMapRank(mi); });
  mapBoardLoad().then(by => {
    if (!by) return;
    let best = null;
    for (const d of DORDER) for (const r of by[id + '|' + d] || []) if (!r.me && (!best || r.score > best.r.score)) best = { r, d };
    if (best) row.querySelector('.drtxt').textContent = best.r.pseudo + ' · ' + best.r.score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + ' (' + DIFFS[best.d].name + ')';
  }).catch(() => {});
}
async function openMapRank(mi) {
  Snd.init(); MR.map = mi;
  const id = MAPS[mi].id, mine = store.get(MB_KEY) || {};
  MR.diff = MR.diff && mine[id + '|' + MR.diff] ? MR.diff : DORDER.filter(d => mine[id + '|' + d]).pop() || 'facile';
  $('#mrTitle').textContent = T('🏆 ') + MAPS[mi].name; $('#mapRankPop').hidden = false; mapRankPaint(null);
  try { mapRankPaint(await mapBoardLoad(true)); } catch (e) { mapRankPaint(null, true); }
}
function mapRankPaint(by, err) {
  const id = MAPS[MR.map].id;
  $('#mrTabs').innerHTML = DORDER.map(d => '<button class="sbtn' + (d === MR.diff ? ' on' : '') + '" type="button" data-d="' + d + '">' + (d === 'infini' ? '∞' : DIFFS[d].name) + '</button>').join('');
  $('#mrTabs').querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { MR.diff = b.dataset.d; mapRankPaint(MR.by); }));
  const box = $('#mrList');
  if (!by) { box.innerHTML = '<p class="fine">' + (err || !frLive() ? T('Il faut internet pour voir le classement.') : T('Chargement…')) + '</p>'; return; }
  const list = by[id + '|' + MR.diff] || [], medal = i => i === 0 ? ' g' : i === 1 ? ' s' : i === 2 ? ' b' : '';
  box.innerHTML = list.map((r, i) => '<div class="rkrow' + (r.me ? ' me' : '') + '"><span class="rkn' + medal(i) + '">' + (i + 1) + '</span><span class="frav"><canvas data-av="' + esc(r.av || 'feu') + '"></canvas></span>'
    + '<div class="frwho"><b>' + esc(r.pseudo) + (r.me ? T(' (toi)') : '') + '</b><small>' + esc(chalOn(r.chal) ? chalNames(r.chal).join(' · ') : T('Partie normale')) + '</small></div>'
    + '<div class="rksc">' + r.score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + '<small><span class="chchip' + (r.mult < 1 ? ' g' : '') + '">' + chalX(r.mult) + '</span></small>'
    + (!r.me && chalOn(r.chal) && chalOpen(MR.map) ? '<button class="sbtn chtake" type="button" data-i="' + i + '">' + T('Relever') + '</button>' : '') + '</div></div>').join('')
    || '<p class="fine">' + T('Personne n’a encore joué cette difficulté sur cette carte.') + '</p>';
  box.querySelectorAll('.chtake').forEach(b => b.addEventListener('click', () => {
    const r = list[+b.dataset.i]; chalSet(id, r.chal); Snd.play('build');
    hint(T('Piment de ') + r.pseudo + T(' copié : ') + chalX(chalMult(r.chal, MR.diff)), 2400);
    $('#mapRankPop').hidden = true; if (curScreen === 'maps') renderMaps(); if (curScreen === 'diff') openDiff(MR.map);
  }));
  if (typeof frAvatars === 'function') frAvatars(box);
}
$('#mrClose').addEventListener('click', () => { $('#mapRankPop').hidden = true; });

// ---------- Le panneau des défis ----------
const CP = { cur: null, done: null };
// o : { title, sub, get: () => réglage, set: réglage => …, done: () => … }
function openChal(o) {
  Snd.init(); CP.cur = chalClean(o.get()); CP.o = o;
  $('#chTitle').textContent = o.title || T('⚙️ Piments'); $('#chSub').textContent = o.sub || '';
  $('#chPre').innerHTML = Object.entries(CHAL_PRESETS).map(([k, [ic, n]]) => '<button type="button" data-pre="' + k + '"><span>' + ic + '</span>' + n + '</button>').join('');
  $('#chPre').querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => { CP.cur = chalClean({ m: CHAL_PRESETS[b.dataset.pre][2] }); chalPaint(); Snd.play('build'); }));
  $('#chalPop').hidden = false; chalPaint();
}
function chalRow(D) {
  const v = CP.cur.m[D.k] || 0, kind = D.p > 0 ? 'malus' : 'bonus';
  return '<div class="chmod ' + kind + (v ? ' on' : '') + '"><span class="chic">' + D.ic + '</span><span class="chn"><b>' + D.n + '</b><small>' + D.d + ' · ' + (D.p > 0 ? '+' : '−') + Math.abs(D.p) + T(' % de points') + (D.max > 1 ? T(' par cran') : '')
    + (D.timer ? T(' (pas en Facile)') : '') + '</small></span><span class="chstep"><button type="button" data-k="' + D.k + '" data-d="-1" aria-label="' + T('Moins') + '">−</button><output>' + v + '</output><button type="button" data-k="' + D.k + '" data-d="1" aria-label="' + T('Plus') + '">+</button></span></div>';
}
function chalPaint() {
  const c = CP.cur, mult = chalMult(c, null), names = chalNames(c);
  $('#chMx').textContent = chalX(mult); $('#chMxs').textContent = names.length ? names.join(' · ') : T('Partie normale');
  $('#chMods').innerHTML = '<p class="chsect m">' + T('▲ Malus · plus de points') + '</p>' + CHAL.filter(D => D.p > 0).map(chalRow).join('')
    + '<div class="chmod malus' + (c.sans.length ? ' on' : '') + '"><span class="chic">🚫</span><span class="chn"><b>' + T('Sans un élément') + '</b><small>' + T('touche les éléments interdits · +') + SANS_P + T(' % de points chacun') + '</small>'
    + '<span class="chels">' + Object.entries(CHAL_ELEM).map(([e, ic]) => '<button type="button" class="' + (c.sans.includes(e) ? 'on' : '') + '" data-e="' + e + '" title="' + TOWERS[e].name + '">' + ic + '</button>').join('') + '</span></span></div>'
    + '<p class="chsect b">' + T('▼ Bonus · moins de points') + '</p>' + CHAL.filter(D => D.p < 0).map(chalRow).join('');
  $('#chMods').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    const D = CHAL_BY[b.dataset.k], v = clamp((CP.cur.m[D.k] || 0) + +b.dataset.d, 0, D.max);
    if (v) CP.cur.m[D.k] = v; else delete CP.cur.m[D.k]; chalPaint(); Snd.play('build');
  }));
  $('#chMods').querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => {
    const e = b.dataset.e, s = CP.cur.sans, i = s.indexOf(e);
    if (i >= 0) s.splice(i, 1); else if (s.length < 5) s.push(e); else { Snd.play('no'); hint(T('Il faut garder au moins un élément'), 1800); return; }
    chalPaint(); Snd.play('build');
  }));
}
$('#chReset').addEventListener('click', () => { CP.cur = { m: {}, sans: [] }; chalPaint(); Snd.play('build'); });
$('#chOk').addEventListener('click', () => { $('#chalPop').hidden = true; if (CP.o) { CP.o.set(CP.cur); if (CP.o.done) CP.o.done(); } Snd.play('clear'); });
$('#chClose').addEventListener('click', () => { $('#chalPop').hidden = true; });
const chalBadge = c => chalOn(c) ? '<span class="chbadge">🌶 ' + chalX(chalMult(c, null)) + '</span>' : '';
// Engrenage d'une carte de l'écran des cartes
function chalCard(card, mi) {
  if (!chalOpen(mi)) return;
  const id = MAPS[mi].id, c = chalGet(id);
  card.insertAdjacentHTML('afterbegin', '<button class="chgear" type="button" aria-label="' + T('Piments') + '">⚙️</button>' + chalBadge(c));
  card.querySelector('.chgear').addEventListener('click', ev => { ev.stopPropagation(); openChalMap(mi, () => renderMaps()); });
}
function openChalMap(mi, done) {
  const id = MAPS[mi].id;
  openChal({ title: T('⚙️ Piments · ') + MAPS[mi].name, sub: T('Les piments ne changent que les points, pas l’or ni les éclats.'), get: () => chalGet(id), set: c => chalSet(id, c), done });
}
// Ligne des défis sur l'écran des difficultés
function chalDiffLine(mi) {
  const box = $('#dfChal'); if (!box) return;
  if (!chalOpen(mi)) { box.hidden = true; return; }
  const c = chalGet(MAPS[mi].id);
  box.hidden = false;
  box.innerHTML = '<span>' + (chalOn(c) ? '🌶 <b>' + chalX(chalMult(c, null)) + '</b> · ' + esc(chalNames(c).join(' · ')) : T('Aucun piment : partie normale')) + '</span><button class="sbtn" type="button">' + T('⚙️ Piments') + '</button>';
  box.querySelector('button').addEventListener('click', () => openChalMap(mi, () => openDiff(mi)));
}

// ---------- Fin de partie : le défi et la place parmi les amis ----------
function chalOverExtra(box) {
  if (!G || G.duel || G.coop || G.story) return;
  if (G.chal) {
    const p = document.createElement('p'); p.className = 'oxq';
    p.textContent = T('🌶 Piment ') + chalX(G.chal.mult) + ' : ' + G.score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + ' → ' + scoreFinal().toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + T(' points');
    box.prepend(p); box.hidden = false;
  }
  if (!chalMapOk(G.map) || typeof rankOn !== 'function' || !rankOn()) return;
  const id = MAPS[G.map].id, diff = G.diff, mi = G.map;
  (async () => {
    await cloudPushMaps().catch(() => {});
    const by = await mapBoardLoad(true), list = by && by[id + '|' + diff];
    if (!list || list.length < 2 || curScreen !== 'over') return;
    const i = list.findIndex(r => r.me); if (i < 0) return;
    const p = document.createElement('div'); p.className = 'oxrank';
    p.innerHTML = '<b>' + T('🏆 ') + ord(i + 1) + T(' sur ') + list.length + T(' amis') + ' · ' + MAPS[mi].name + ' (' + DIFFS[diff].name + ')</b><small>' + (i === 0 ? T('Tu es devant tous tes amis !') : esc(list[0].pseudo) + T(' est en tête avec ') + list[0].score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + ' pts') + '</small>'
      + '<button class="sbtn" type="button">' + T('Voir le classement') + '</button>';
    p.querySelector('button').addEventListener('click', () => { MR.diff = diff; openMapRank(mi); });
    box.prepend(p); box.hidden = false;
  })().catch(() => {});
}

// ---------- Salon multijoueur (l'hôte règle, les autres voient) ----------
function chalLobbyHTML(canPick) {
  const c = chalClean(DUEL.lobbyChal);
  return '<div class="mp-chal"><small>' + T('Piments') + '</small><span>' + (chalOn(c) ? '🌶 <b>' + chalX(chalMult(c, DUEL.lobbyMode === 'coop' ? DUEL.lobbyDiff || 'moyen' : 'infini')) + '</b> · ' + esc(chalNames(c).join(' · ')) : T('Aucun piment')) + '</span>'
    + (canPick ? '<button class="sbtn" type="button" data-a="chal">' + T('⚙️ Régler') + '</button>' : '') + '</div>';
}
function chalLobbyOpen() {
  openChal({ title: T('⚙️ Piments de la partie'), sub: T('Les mêmes piments pour tous les joueurs. Pas de classement en multijoueur.'),
    get: () => DUEL.lobbyChal, set: c => { DUEL.lobbyChal = chalClean(c); }, done: () => { if (typeof sendLobby === 'function') sendLobby(); if (typeof renderMP === 'function') renderMP(); } });
}
