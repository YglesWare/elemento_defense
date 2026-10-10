// Élémento Defense : défis par carte (le bouton 🌶) et classement des cartes entre amis (voir supabase/maps.sql).
// Sur une carte déjà gagnée une fois, le joueur règle des malus (plus de points) et des bonus (moins de points).
// Les défis ne changent que les points : ni or gagné, ni éclats. Le réglage est retenu par carte, sur l'appareil.
// Le meilleur score par carte et par difficulté part à la synchro (hors ligne, il attend) ; on ne voit que ses amis.
// En multijoueur, l'hôte règle les défis dans le salon (pas de classement).
// En plus : des règles spéciales, les piments d'événement, le Monochrome et la 🎲 surprise ; les médailles (meilleure victoire
// pimentée de chaque carte) ; le piment de la semaine (même carte et même piment pour tous, son classement passe par la même
// table que les cartes) et le petit piment imposé de la carte du jour.
'use strict';

const CHAL_KEY = 'elemento.chal', MB_KEY = 'elemento.mapbest', MQ_KEY = 'elemento.mapQ', MEDAL_KEY = 'elemento.medals', MONO_KEY = 'elemento.mono';
STORE_DOMAINS[CHAL_KEY] = 'progress'; STORE_DOMAINS[MB_KEY] = 'progress'; STORE_DOMAINS[MEDAL_KEY] = 'progress'; STORE_DOMAINS[MONO_KEY] = 'progress';
// p : points par cran (en %), négatif pour un bonus ; max : nombre de crans ; timer : n'agit que si la difficulté a un chrono ;
// g : 'rule' pour les règles qui changent la façon de jouer ; need : 'portals' (carte à plusieurs portails) ; season : piment d'un événement
const CHAL = [
  { k: 'horde', ic: '👥', n: T('Horde'), d: T('+5 % d’ennemis par cran'), p: 4, max: 4 },
  { k: 'pv', ic: '❤️', n: T('Costauds'), d: T('+5 % de PV par cran'), p: 5, max: 4 },
  { k: 'vite', ic: '💨', n: T('Pressés'), d: T('+5 % de vitesse par cran'), p: 6, max: 4 },
  { k: 'armure', ic: '🛡️', n: T('Blindés'), d: T('+1 d’armure par cran'), p: 8, max: 3 },
  { k: 'bourse', ic: '🪙', n: T('Bourse plate'), d: T('−10 % d’or par cran'), p: 5, max: 3 },
  { k: 'fragile', ic: '💔', n: T('Fragile'), d: T('−2 vies par cran'), p: 6, max: 3 },
  { k: 'chrono', ic: '⏱️', n: T('Chrono serré'), d: T('−20 % de temps entre les vagues'), p: 5, max: 3, timer: true },
  { k: 'puriste', ic: '🧘', n: T('Puriste'), d: T('sans les améliorations de l’Atelier'), p: 40, max: 1, g: 'rule' },
  { k: 'chantier', ic: '🏗️', n: T('Chantier limité'), d: T('12, puis 10, puis 8 tours au plus en même temps'), p: 8, max: 3, g: 'rule' },
  { k: 'meteo', ic: '🌧️', n: T('Ciel capricieux'), d: T('la météo change toutes les 3 vagues'), p: 6, max: 1, g: 'rule' },
  { k: 'brume', ic: '🌫️', n: T('Brouillard permanent'), d: T('−15 % de portée pour toutes les tours'), p: 15, max: 1, g: 'rule' },
  { k: 'fantome', ic: '👻', n: T('Fantômes'), d: T('chaque ennemi devient intangible par moments'), p: 12, max: 1, g: 'rule' },
  { k: 'portail', ic: '🌀', n: T('Portails fous'), d: T('chaque ennemi sort d’un portail au hasard'), p: 8, max: 1, g: 'rule', need: 'portals' },
  // Piments d'événement : seulement sur la carte de cet événement (son monstre dès la 1re vague, et de plus en plus)
  { k: 'f_halloween', ic: '🦇', n: T('Nuit des spectres'), d: T('des Spectres dès la 1re vague, de plus en plus'), p: 6, max: 3, season: 'halloween' },
  { k: 'f_noel', ic: '🎁', n: T('Hotte pleine'), d: T('des Cadeaux surprises dès la 1re vague, de plus en plus'), p: 6, max: 3, season: 'noel' },
  { k: 'f_paques', ic: '🐇', n: T('Lapins fous'), d: T('des Lapins sauteurs dès la 1re vague, de plus en plus'), p: 6, max: 3, season: 'paques' },
  { k: 'f_valentin', ic: '💞', n: T('Câlins en série'), d: T('des Câlinous dès la 1re vague, de plus en plus'), p: 6, max: 3, season: 'valentin' },
  { k: 'f_nouvelan', ic: '🧧', n: T('Pluie d’or'), d: T('des Enveloppes rouges dès la 1re vague, de plus en plus'), p: -4, max: 3, season: 'nouvelan' },
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

// ---------- Réglage : { m: { horde: 2… }, sans: ['feu'…], sur: 1 (tiré par 🎲) } ----------
// Nombre de portails d'une carte (ses itinéraires qui partent d'endroits différents)
const chalPortals = mi => { const m = MAPS[mi]; return m ? new Set((m.paths || [m.pts]).map(r => r[0].join(','))).size : 1; };
// Ce piment a-t-il un sens sur cette carte ? (mi absent : réglage sans carte précise, tout est permis)
function chalFits(D, mi) {
  if (mi == null || !MAPS[mi]) return true;
  if (D.season) return MAPS[mi].season === D.season;
  if (D.need === 'portals') return chalPortals(mi) > 1;
  return true;
}
// Ne garde que des clés connues et des nombres dans les bornes (le réglage d'un ami vient du réseau) ; avec une carte,
// seulement ce qui a un sens sur elle. « Ciel capricieux » et « Beau temps garanti » s'excluent : le beau temps gagne
function chalClean(c, mi) {
  const out = { m: {}, sans: [] }; if (!c || typeof c !== 'object') return out;
  for (const D of CHAL) { const v = Math.floor(+((c.m || {})[D.k]) || 0); if (v > 0 && chalFits(D, mi)) out.m[D.k] = Math.min(D.max, v); }
  if (out.m.soleil) delete out.m.meteo;
  if (Array.isArray(c.sans)) for (const e of c.sans) if (CHAL_ELEM[e] && !out.sans.includes(e) && out.sans.length < 5) out.sans.push(e);
  if (c.sur && chalOn(out)) out.sur = 1;
  return out;
}
const chalOn = c => !!c && (Object.keys(c.m).length > 0 || c.sans.length > 0);
const chalTimer = diff => !diff || !!(DIFFS[diff] && DIFFS[diff].timer);
// Multiplicateur de points (1 + malus − bonus, entre ×0,3 et ×3) ; les défis liés au chrono ne comptent pas sans chrono
function chalMult(c, diff, mi) {
  let m = 1;
  for (const k in c.m) { const D = CHAL_BY[k]; if (D && (!D.timer || chalTimer(diff)) && chalFits(D, mi)) m += D.p * c.m[k] / 100; }
  m += SANS_P * c.sans.length / 100;
  return Math.round(clamp(m, 0.3, 3) * 100) / 100;
}
const chalX = v => '×' + fr(v);
// Les 5 éléments interdits, c'est le Monochrome : un seul élément gardé
const chalMono = c => c.sans.length === 5 ? Object.keys(CHAL_ELEM).find(e => !c.sans.includes(e)) : null;
function chalNames(c) {
  const out = (c.sur ? ['🎲'] : []).concat(CHAL.filter(D => c.m[D.k]).map(D => D.n + (D.max > 1 ? ' ' + c.m[D.k] : '')));
  const mono = chalMono(c);
  if (mono) out.push(T('Monochrome ') + TOWERS[mono].name); else for (const e of c.sans) out.push(T('Sans ') + TOWERS[e].name);
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
  const used = !!(c && c.used); c = chalClean(c, G.map);
  if (!chalOn(c)) { G.chal = null; return; }
  G.chal = { m: c.m, sans: c.sans, sur: c.sur, mult: chalMult(c, G.diff, G.map), used };
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
// Chantier limité : nombre de tours permis en même temps (les siennes en coop)
const chalTowerCap = () => [Infinity, 12, 10, 8][chalLv('chantier')];
const chalFull = () => !!(G && G.chal && chalLv('chantier')) && G.towers.filter(t => !G.coop || t.own === coopMe()).length >= chalTowerCap();
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
  if (G.won) chalWonFx();
  // Piment de la semaine : son propre classement (une « carte » semaine-AAAA-SS dans la même table)
  const id = G.week || MAPS[G.map].id, k = id + '|' + G.diff, all = store.get(MB_KEY) || {}, cur = all[k], sc = scoreFinal();
  if (cur && cur.score >= sc) return;
  const c = G.chal ? { m: G.chal.m, sans: G.chal.sans, sur: G.chal.sur } : { m: {}, sans: [] };
  all[k] = { map: id, diff: G.diff, score: sc, mult: (G.chal && G.chal.mult) || 1, chal: c, wave: G.wave, won: !!G.won };
  store.set(MB_KEY, all);
  const q = store.get(MQ_KEY) || {}; q[k] = all[k]; store.set(MQ_KEY, q);
  if (typeof trophyScan === 'function') trophyScan();
}
// ---------- Médailles de piment : la meilleure victoire de chaque carte, selon son multiplicateur ----------
const MEDALS = [{ k: 'or', ic: '🥇', n: T('d’or'), s: T('Or'), x: 2 }, { k: 'argent', ic: '🥈', n: T('d’argent'), s: T('Argent'), x: 1.6 }, { k: 'bronze', ic: '🥉', n: T('de bronze'), s: T('Bronze'), x: 1.25 }];
const medalOf = x => MEDALS.find(M => x >= M.x) || null;
const medalBest = id => +((store.get(MEDAL_KEY) || {})[id]) || 0;
// Victoire en solo avec un piment : médaille, Monochrome et trophées (une seule fois par partie)
function chalWonFx() {
  if (!G.chal || G.chalWon) return; G.chalWon = true;
  const id = MAPS[G.map].id, x = G.chal.mult, all = store.get(MEDAL_KEY) || {}, before = medalOf(+all[id] || 0), now = medalOf(x);
  if (x > (+all[id] || 0)) { all[id] = x; store.set(MEDAL_KEY, all); }
  if (now && (!before || now.x > before.x)) G.newMedal = now;
  const tr = typeof trophy === 'function' ? trophy : () => {};
  if (x >= 2) tr('pim_x2');
  if (Object.values(all).filter(v => v >= 2).length >= 5) tr('pim_gold5');
  if (G.chal.sur) tr('pim_surprise');
  if (G.week) tr('pim_week');
  if (Object.keys(G.chal.m).some(k => CHAL_BY[k] && CHAL_BY[k].season)) tr('pim_event');
  const mono = chalMono(G.chal);
  if (mono) {
    tr('pim_mono');
    const done = store.get(MONO_KEY) || []; if (!done.includes(mono)) { done.push(mono); store.set(MONO_KEY, done); }
    if (Object.keys(CHAL_ELEM).every(e => done.includes(e))) tr('pim_mono6');
  }
}
// Médaille en bref (écran d'une carte) : « 🥉 Bronze · 🥈 à ×1,6 »
function medalShort(mi) {
  const best = medalBest(MAPS[mi].id), cur = medalOf(best), next = MEDALS.slice().reverse().find(M => M.x > best);
  return (cur ? cur.ic + ' ' + cur.s : T('🏅 Pas de médaille')) + (next ? ' · ' + next.ic + T(' à ') + chalX(next.x) : '');
}
// Ligne « médaille » sous le multiplicateur du panneau : la médaille de la carte et la suivante à viser
function medalLine(mi, mult) {
  const best = medalBest(MAPS[mi].id), cur = medalOf(best), next = MEDALS.slice().reverse().find(M => M.x > best);
  return (cur ? cur.ic + T(' Médaille ') + cur.n + T(' (victoire ') + chalX(best) + ')' : T('🏅 Pas encore de médaille'))
    + (next ? ' · ' + next.ic + ' ' + chalX(next.x) + (mult >= next.x ? T(' : ce piment la vise !') : T(' pour la suivante')) : '');
}

// ---------- Tirage de piments (🎲 surprise, piment du jour, piment de la semaine) ----------
// r : générateur (Math.random ou une graine) ; o : { n: nombre de malus, lv: cran maxi, sans: chance d'un élément interdit, bonus: chance d'un bonus,
// min et max : bornes du multiplicateur }
function chalRoll(r, mi, o) {
  const pool = CHAL.filter(D => D.p > 0 && !D.timer && !D.season && D.k !== 'puriste' && (mi != null || !D.need) && chalFits(D, mi));
  // Plusieurs tirages : le premier dans les bornes, sinon le plus proche (toujours le même pour une même graine)
  let best = null, bx = 0;
  for (let tries = 0; tries < 200; tries++) {
    const c = { m: {}, sans: [] }, left = pool.slice();
    for (let i = 0; i < o.n && left.length; i++) { const D = left.splice(Math.floor(r() * left.length), 1)[0]; c.m[D.k] = 1 + Math.floor(r() * Math.min(D.max, o.lv)); }
    if (o.sans && r() < o.sans) c.sans.push(Object.keys(CHAL_ELEM)[Math.floor(r() * 6)]);
    if (r() < (o.bonus || 0)) { const B = CHAL.filter(D => D.p < 0 && !D.timer && !D.season); const D = B[Math.floor(r() * B.length)]; c.m[D.k] = 1; }
    const cc = chalClean(c, mi), x = chalMult(cc, null, mi);
    if (x > (o.min || 1) && x <= o.max) return cc;
    if (x <= o.max && x > bx) { best = cc; bx = x; }
  }
  return best || chalClean({ m: { horde: 1 } }, mi);
}
// Carte du jour : un petit piment imposé, le même pour tout le monde ce jour-là (le classement du jour reste juste)
const chalDaily = day => chalRoll(mulberry(hashStr('piment-du-jour:' + day)), null, { n: 1 + (hashStr(day) % 2), lv: 1, max: 1.3 });

// Piment de la semaine : une carte et un piment pour tout le monde, du lundi au dimanche, en Facile, avec son classement
// (semaine ISO : la semaine 1 contient le premier jeudi de l'année)
function weekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return 'semaine-' + y + '-' + String(w).padStart(2, '0');
}
function weekInfo() {
  const id = weekId(), r = mulberry(hashStr('piment:' + id));
  const maps = MAPS.map((m, i) => i).filter(i => MAPS[i].prog).slice(0, 8), mi = maps[Math.floor(r() * maps.length)];
  const now = new Date(), left = 8 - (now.getDay() || 7);
  return { id, mi, diff: 'facile', c: chalRoll(r, mi, { n: 4, lv: 2, sans: 0.4, min: 1.5, max: 2.2 }), left };
}
let chalWeekGo = null; // lu par newGame (js/game.js) : la prochaine partie est celle de la semaine
function weekPlay() {
  const w = weekInfo(); if (!chalOpen(w.mi)) return;
  Snd.init(); chalWeekGo = w; newGame(w.mi, null, w.diff);
}
// Vignette du bandeau des défis : elle ouvre l'écran de la carte en mode « semaine » (piment, record, classement)
function weekTile() {
  const w = weekInfo(), ok = chalOpen(w.mi);
  const d = stripTile('week', T('🌶 De la semaine'), ok ? '<span class="chchip">' + chalX(chalMult(w.c, w.diff, w.mi)) + '</span><span class="msub">' + w.left + T(' j') + '</span>'
    : '<span class="msub">' + T('Gagne d’abord ') + MAPS[w.mi].name + '</span>', ok ? () => openDiff(w.mi, w) : null);
  drawMapMini(prepMini(d.querySelector('canvas'), 140, 90), w.mi, 140, 90, 'moyen');
  return d;
}
function openWeekRank(w) {
  Snd.init(); MR.map = w.mi; MR.week = w;
  $('#mrTitle').textContent = T('🌶 Piment de la semaine'); $('#mapRankPop').hidden = false; mapRankPaint(null);
  mapBoardLoad(true).then(by => mapRankPaint(by), () => mapRankPaint(null, true));
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
  const play = card.querySelector(':scope > .mapact, :scope > .sbtn'); if (play) card.insertBefore(row, play); else card.appendChild(row);
  row.querySelector('button').addEventListener('click', ev => { ev.stopPropagation(); openMapRank(mi); });
  mapBoardLoad().then(by => {
    if (!by) return;
    let best = null;
    for (const d of DORDER) for (const r of by[id + '|' + d] || []) if (!r.me && (!best || r.score > best.r.score)) best = { r, d };
    if (best) row.querySelector('.drtxt').textContent = best.r.pseudo + ' · ' + best.r.score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + ' (' + DIFFS[best.d].name + ')';
  }).catch(() => {});
}
async function openMapRank(mi) {
  Snd.init(); MR.map = mi; MR.week = null;
  const id = MAPS[mi].id, mine = store.get(MB_KEY) || {};
  MR.diff = MR.diff && mine[id + '|' + MR.diff] ? MR.diff : DORDER.filter(d => mine[id + '|' + d]).pop() || 'facile';
  $('#mrTitle').textContent = T('🏆 ') + MAPS[mi].name; $('#mapRankPop').hidden = false; mapRankPaint(null);
  try { mapRankPaint(await mapBoardLoad(true)); } catch (e) { mapRankPaint(null, true); }
}
function mapRankPaint(by, err) {
  // Piment de la semaine : une seule difficulté, et pas de « Relever » (tout le monde a déjà le même piment)
  const W = MR.week, id = W ? W.id : MAPS[MR.map].id, diff = W ? W.diff : MR.diff;
  $('#mrTabs').innerHTML = W ? '<small class="fine">' + MAPS[W.mi].name + ' · ' + DIFFS[W.diff].name + ' · ' + chalX(chalMult(W.c, W.diff, W.mi)) + '</small>'
    : DORDER.map(d => '<button class="sbtn' + (d === MR.diff ? ' on' : '') + '" type="button" data-d="' + d + '">' + (d === 'infini' ? '∞' : DIFFS[d].name) + '</button>').join('');
  $('#mrTabs').querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { MR.diff = b.dataset.d; mapRankPaint(MR.by); }));
  const box = $('#mrList');
  if (!by) { box.innerHTML = '<p class="fine">' + (err || !frLive() ? T('Il faut internet pour voir le classement.') : T('Chargement…')) + '</p>'; return; }
  const list = by[id + '|' + diff] || [], medal = i => i === 0 ? ' g' : i === 1 ? ' s' : i === 2 ? ' b' : '';
  box.innerHTML = list.map((r, i) => '<div class="rkrow' + (r.me ? ' me' : '') + '"><span class="rkn' + medal(i) + '">' + (i + 1) + '</span><span class="frav"><canvas data-av="' + esc(r.av || 'feu') + '"></canvas></span>'
    + '<div class="frwho"><b>' + esc(r.pseudo) + (r.me ? T(' (toi)') : '') + '</b><small>' + esc(chalOn(r.chal) ? chalNames(r.chal).join(' · ') : T('Partie normale')) + '</small></div>'
    + '<div class="rksc">' + r.score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + '<small><span class="chchip' + (r.mult < 1 ? ' g' : '') + '">' + chalX(r.mult) + '</span></small>'
    + (!W && !r.me && chalOn(r.chal) && chalOpen(MR.map) ? '<button class="sbtn chtake" type="button" data-i="' + i + '">' + T('Relever') + '</button>' : '') + '</div></div>').join('')
    || '<p class="fine">' + T('Personne n’a encore joué cette difficulté sur cette carte.') + '</p>';
  box.querySelectorAll('.chtake').forEach(b => b.addEventListener('click', () => {
    const r = list[+b.dataset.i]; chalSet(id, r.chal); Snd.play('build');
    hint(T('Piment de ') + r.pseudo + T(' copié : ') + chalX(chalMult(r.chal, MR.diff, MR.map)), 2400);
    $('#mapRankPop').hidden = true; if (curScreen === 'maps') renderMaps(); if (curScreen === 'diff') openDiff(MR.map);
  }));
  if (typeof frAvatars === 'function') frAvatars(box);
}
$('#mrClose').addEventListener('click', () => { $('#mapRankPop').hidden = true; });

// ---------- Le panneau des défis ----------
const CP = { cur: null, done: null };
// o : { title, sub, get: () => réglage, set: réglage => …, done: () => … }
// o.mi : la carte (pour ne proposer que les piments qui ont un sens sur elle, et sa médaille)
function openChal(o) {
  Snd.init(); CP.cur = chalClean(o.get(), o.mi); CP.o = o;
  $('#chTitle').textContent = o.title || T('🌶 Piments'); $('#chSub').textContent = o.sub || '';
  $('#chPre').innerHTML = Object.entries(CHAL_PRESETS).map(([k, [ic, n]]) => '<button type="button" data-pre="' + k + '"><span>' + ic + '</span>' + n + '</button>').join('')
    + '<button type="button" data-pre="sur"><span>🎲</span>' + T('Surprise') + '</button>';
  $('#chPre').querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.pre;
    CP.cur = k === 'sur' ? Object.assign(chalRoll(Math.random, o.mi, { n: 2 + Math.floor(Math.random() * 2), lv: 2, sans: 0.3, bonus: 0.35, max: 2.4 }), { sur: 1 }) : chalClean({ m: CHAL_PRESETS[k][2] }, o.mi);
    chalPaint(); Snd.play('build');
  }));
  $('#chalPop').hidden = false; chalPaint();
}
function chalRow(D) {
  const v = CP.cur.m[D.k] || 0, kind = D.p > 0 ? 'malus' : 'bonus';
  return '<div class="chmod ' + kind + (v ? ' on' : '') + '"><span class="chic">' + D.ic + '</span><span class="chn"><b>' + D.n + '</b><small>' + D.d + ' · ' + (D.p > 0 ? '+' : '−') + Math.abs(D.p) + T(' % de points') + (D.max > 1 ? T(' par cran') : '')
    + (D.timer ? T(' (pas en Facile)') : '') + '</small></span><span class="chstep"><button type="button" data-k="' + D.k + '" data-d="-1" aria-label="' + T('Moins') + '">−</button><output>' + v + '</output><button type="button" data-k="' + D.k + '" data-d="1" aria-label="' + T('Plus') + '">+</button></span></div>';
}
function chalPaint() {
  const c = CP.cur, mi = CP.o && CP.o.mi, mult = chalMult(c, null, mi), names = chalNames(c), mono = chalMono(c);
  const fit = D => chalFits(D, mi), elBtns = (attr, on) => Object.entries(CHAL_ELEM).map(([e, ic]) => '<button type="button" class="' + (on(e) ? 'on' : '') + '" ' + attr + '="' + e + '" title="' + TOWERS[e].name + '">' + ic + '</button>').join('');
  $('#chMx').textContent = chalX(mult); $('#chMxs').textContent = names.length ? names.join(' · ') : T('Partie normale');
  const med = $('#chMedal'); if (med) { med.hidden = mi == null || !chalMapOk(mi); if (!med.hidden) med.textContent = medalLine(mi, mult); }
  const evs = CHAL.filter(D => D.season && fit(D));
  $('#chMods').innerHTML = '<p class="chsect m">' + T('▲ Malus · plus de points') + '</p>' + CHAL.filter(D => D.p > 0 && !D.g && !D.season).map(chalRow).join('')
    + '<p class="chsect r">' + T('✨ Règles spéciales · plus de points') + '</p>' + CHAL.filter(D => D.g === 'rule' && fit(D)).map(chalRow).join('')
    + '<div class="chmod malus' + (c.sans.length && !mono ? ' on' : '') + '"><span class="chic">🚫</span><span class="chn"><b>' + T('Sans un élément') + '</b><small>' + T('touche les éléments interdits · +') + SANS_P + T(' % de points chacun') + '</small>'
    + '<span class="chels">' + elBtns('data-e', e => c.sans.includes(e)) + '</span></span></div>'
    + '<div class="chmod malus' + (mono ? ' on' : '') + '"><span class="chic">🎨</span><span class="chn"><b>' + T('Monochrome') + '</b><small>' + T('un seul élément pour toute la partie · +') + 5 * SANS_P + T(' % de points') + '</small>'
    + '<span class="chels">' + elBtns('data-mono', e => e === mono) + '</span></span></div>'
    + (evs.length ? '<p class="chsect e">' + SEASONS[evs[0].season].icon + T(' Piment de l’événement') + '</p>' + evs.map(chalRow).join('') : '')
    + '<p class="chsect b">' + T('▼ Bonus · moins de points') + '</p>' + CHAL.filter(D => D.p < 0 && !D.season).map(chalRow).join('');
  // Toucher un réglage à la main : ce n'est plus une surprise
  const touched = () => { delete CP.cur.sur; chalPaint(); Snd.play('build'); };
  $('#chMods').querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    const D = CHAL_BY[b.dataset.k], v = clamp((CP.cur.m[D.k] || 0) + +b.dataset.d, 0, D.max);
    if (v) CP.cur.m[D.k] = v; else delete CP.cur.m[D.k];
    if (v && D.k === 'meteo') delete CP.cur.m.soleil; if (v && D.k === 'soleil') delete CP.cur.m.meteo; // l'un ou l'autre
    touched();
  }));
  $('#chMods').querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => {
    const e = b.dataset.e, s = CP.cur.sans, i = s.indexOf(e);
    if (i >= 0) s.splice(i, 1); else if (s.length < 5) s.push(e); else { Snd.play('no'); hint(T('Il faut garder au moins un élément'), 1800); return; }
    touched();
  }));
  $('#chMods').querySelectorAll('[data-mono]').forEach(b => b.addEventListener('click', () => {
    const e = b.dataset.mono; CP.cur.sans = chalMono(CP.cur) === e ? [] : Object.keys(CHAL_ELEM).filter(x => x !== e); touched();
  }));
}
$('#chReset').addEventListener('click', () => { CP.cur = { m: {}, sans: [] }; chalPaint(); Snd.play('build'); });
$('#chOk').addEventListener('click', () => { $('#chalPop').hidden = true; if (CP.o) { CP.o.set(CP.cur); if (CP.o.done) CP.o.done(); } Snd.play('clear'); });
$('#chClose').addEventListener('click', () => { $('#chalPop').hidden = true; });
// Pastilles d'une ligne de l'écran des cartes : la médaille, et le piment réglé s'il y en a un
function mapBadge(mi) {
  if (!chalOpen(mi)) return '';
  const md = medalOf(medalBest(MAPS[mi].id)), c = chalGet(MAPS[mi].id);
  return (md ? '<span class="mmed" title="' + T('Médaille ') + md.n + '">' + md.ic + '</span>' : '') + (chalOn(c) ? '<span class="chchip">🌶 ' + chalX(chalMult(c, null, mi)) + '</span>' : '');
}
function openChalMap(mi, done) {
  const id = MAPS[mi].id;
  openChal({ mi, title: T('🌶 Piments · ') + MAPS[mi].name, sub: T('Les piments ne changent que les points, pas l’or ni les éclats.'), get: () => chalGet(id), set: c => chalSet(id, c), done });
}
// Écran d'une carte : la ligne du piment (réglable, imposé pour la carte du jour et la semaine), la médaille, et le classement
function chalDiffLine(mi, week) {
  const box = $('#dfChal'), med = $('#dfMedal'), meta = () => { $('#dfMeta').hidden = med.hidden && $('#dfRank').hidden; }; if (!box) return;
  med.hidden = true; chalDiffRank(mi, week); meta();
  const fixed = week ? week.c : MAPS[mi] && MAPS[mi].daily ? chalDaily(MAPS[mi].daily) : null;
  if (fixed) {
    box.hidden = false;
    box.innerHTML = '<span>' + (week ? T('🌶 Le même piment pour tous : ') : T('🌶 Piment du jour, le même pour tous : ')) + '<span class="chchip">' + chalX(chalMult(fixed, week ? week.diff : null, week ? mi : null)) + '</span> ' + esc(chalNames(fixed).join(' · ')) + '</span>';
    return;
  }
  if (!chalOpen(mi)) { box.hidden = true; return; }
  const c = chalGet(MAPS[mi].id), x = chalMult(c, null, mi);
  box.hidden = false;
  box.innerHTML = '<span>' + (chalOn(c) ? '🌶 <span class="chchip">' + chalX(x) + '</span> ' + esc(chalNames(c).join(' · ')) : T('Aucun piment : partie normale')) + '</span><button class="sbtn" type="button">' + T('🌶 Piments') + '</button>';
  box.querySelector('button').addEventListener('click', () => openChalMap(mi, () => openDiff(mi)));
  med.hidden = false; med.textContent = medalShort(mi); meta();
}
// Classement entre amis de cette carte, de la carte du jour ou du piment de la semaine
function chalDiffRank(mi, week) {
  const box = $('#dfRank'); if (!box) return;
  box.innerHTML = ''; box.hidden = true;
  if (typeof rankOn !== 'function' || !rankOn()) return;
  if (week) {
    const row = document.createElement('div'); row.className = 'drank';
    row.innerHTML = '<button class="sbtn drbtn" type="button">' + T('🏆 Amis') + '</button><span class="drtxt"></span>';
    row.querySelector('button').addEventListener('click', () => openWeekRank(week));
    box.appendChild(row);
    mapBoardLoad().then(by => {
      const list = by && by[week.id + '|' + week.diff]; if (!list || !list.length) return;
      const i = list.findIndex(r => r.me);
      row.querySelector('.drtxt').textContent = i >= 0 && list.length > 1 ? T('Tu es ') + ord(i + 1) + T(' sur ') + list.length : list.length - (i >= 0 ? 1 : 0) + T(' ami(s) ont joué');
    }).catch(() => {});
  } else if (MAPS[mi] && MAPS[mi].daily && typeof rankCard === 'function') rankCard(box, MAPS[mi].daily);
  else if (chalMapOk(mi)) mapRankRow(box, mi);
  box.hidden = !box.children.length;
}

// ---------- Fin de partie : le défi et la place parmi les amis ----------
function chalOverExtra(box) {
  if (!G || G.duel || G.coop || G.story) return;
  if (G.chal) {
    const p = document.createElement('p'); p.className = 'oxq';
    p.textContent = T('🌶 Piment ') + chalX(G.chal.mult) + ' : ' + G.score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + ' → ' + scoreFinal().toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + T(' points');
    box.prepend(p); box.hidden = false;
    if (G.newMedal) { const q = document.createElement('p'); q.className = 'oxq medal'; q.textContent = G.newMedal.ic + T(' Nouvelle médaille ') + G.newMedal.n + T(' sur ') + MAPS[G.map].name + ' !'; box.prepend(q); }
  }
  // Piment de la semaine : sa place parmi les amis
  if (G.week && typeof rankOn === 'function' && rankOn()) {
    const w = { id: G.week, mi: G.map, diff: G.diff, c: G.chal || { m: {}, sans: [] } };
    (async () => {
      await cloudPushMaps().catch(() => {});
      const by = await mapBoardLoad(true), list = by && by[w.id + '|' + w.diff];
      if (!list || list.length < 2 || curScreen !== 'over') return;
      const i = list.findIndex(r => r.me); if (i < 0) return;
      const p = document.createElement('div'); p.className = 'oxrank';
      p.innerHTML = '<b>' + T('🌶 ') + ord(i + 1) + T(' sur ') + list.length + T(' amis') + T(' · Piment de la semaine') + '</b><small>' + (i === 0 ? T('Tu es devant tous tes amis !') : esc(list[0].pseudo) + T(' est en tête avec ') + list[0].score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + ' pts') + '</small>'
        + '<button class="sbtn" type="button">' + T('Voir le classement') + '</button>';
      p.querySelector('button').addEventListener('click', () => openWeekRank(w));
      box.prepend(p); box.hidden = false;
    })().catch(() => {});
    return;
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
  return '<div class="mp-chal"><small>' + T('Piments') + '</small><span>' + (chalOn(c) ? '🌶 <b>' + chalX(chalMult(c, DUEL.lobbyMode === 'coop' ? DUEL.lobbyDiff || 'moyen' : 'infini', lobbyMi())) + '</b> · ' + esc(chalNames(c).join(' · ')) : T('Aucun piment')) + '</span>'
    + (canPick ? '<button class="sbtn" type="button" data-a="chal">' + T('⚙️ Régler') + '</button>' : '') + '</div>';
}
// Carte du salon (la carte aléatoire n'a pas encore d'itinéraire : on ne filtre pas)
const lobbyMi = () => MAPS[DUEL.lobbyMap] && !MAPS[DUEL.lobbyMap].random ? DUEL.lobbyMap : null;
function chalLobbyOpen() {
  openChal({ mi: lobbyMi(), title: T('🌶 Piments de la partie'), sub: T('Les mêmes piments pour tous les joueurs. Pas de classement en multijoueur.'),
    get: () => DUEL.lobbyChal, set: c => { DUEL.lobbyChal = chalClean(c); }, done: () => { if (typeof sendLobby === 'function') sendLobby(); if (typeof renderMP === 'function') renderMP(); } });
}
