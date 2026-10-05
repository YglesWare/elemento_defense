// Élémento Defense : classement de la carte du jour entre amis (voir supabase/daily.sql).
// Le meilleur résultat du jour par difficulté part à la synchro (hors ligne, il attend sur l'appareil).
// On ne voit que ses amis et soi. Une victoire passe devant, puis la vague atteinte, puis le score.
'use strict';

const DQ_KEY = 'elemento.dailyQ';
const RK = { cache: {}, diff: null, day: null };
const rkCmp = (a, b) => (b.won - a.won) || (b.wave - a.wave) || (b.score - a.score);
const ord = n => IS_EN ? n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th') : n + (n === 1 ? 'er' : 'e');
const rankOn = () => typeof frOn === 'function' && frOn() && FR.list.some(f => f.kind === 'friend');

// Appelé par recordBest (js/game.js) à chaque vague et en fin de partie sur la carte du jour
function dailyQueue(day, diff, rec) {
  const q = store.get(DQ_KEY) || {}, k = day + '|' + diff, cur = q[k];
  if (!cur || rkCmp(rec, cur) < 0) { q[k] = { day, diff, won: !!rec.won, wave: rec.wave | 0, score: rec.score | 0 }; store.set(DQ_KEY, q); }
}
async function cloudPushDaily() {
  const q = store.get(DQ_KEY) || {}, keys = Object.keys(q); if (!keys.length || DEV_HOST) return; // pas de scores de test depuis l'ordinateur
  for (const k of keys) {
    const r = q[k];
    const { error } = await CLOUD.sb.rpc('daily_submit', { p_day: r.day, p_diff: r.diff, p_won: r.won, p_wave: r.wave, p_score: r.score });
    if (error) return; // fonction pas encore créée, réseau… : on réessaiera
    const now = store.get(DQ_KEY) || {}; if (now[k] && rkCmp(now[k], r) === 0) delete now[k]; store.set(DQ_KEY, now);
  }
  RK.cache = {};
}
// Classement d'un jour : { diff: [lignes triées] }, avec en plus les amis qui n'ont pas encore joué
async function rankLoad(day, force) {
  const c = RK.cache[day];
  if (c && !force && Date.now() - c.at < 60e3) return c.by;
  if (!frLive()) return c ? c.by : null;
  const rows = await frRpc('daily_board', { p_day: day });
  const by = {};
  for (const r of rows || []) (by[r.diff] = by[r.diff] || []).push({ id: r.user_id, me: r.me, pseudo: r.me ? cleanPseudo() : r.pseudo, av: r.avatar, won: r.won, wave: r.wave, score: r.score });
  for (const d in by) by[d].sort(rkCmp);
  RK.cache[day] = { by, at: Date.now() };
  return by;
}
// Ma place pour une difficulté : { rank, total, first } (null si aucun ami n'a joué cette difficulté)
function myRank(list) {
  if (!list || list.length < 2) return null;
  const i = list.findIndex(r => r.me); if (i < 0) return null;
  return { rank: i + 1, total: list.length, first: list[0] };
}

// ---------- Carte du jour (écran des cartes) ----------
function rankCard(card, day) {
  if (!rankOn()) return;
  const row = document.createElement('div'); row.className = 'drank';
  row.innerHTML = '<button class="sbtn drbtn" type="button">' + T('🏆 Amis') + '</button><span class="drtxt"></span>';
  // Au-dessus du bouton « Jouer », pour que les boutons « Jouer » restent alignés d'une carte à l'autre
  const play = card.querySelector(':scope > .sbtn'); if (play) card.insertBefore(row, play); else card.appendChild(row);
  row.querySelector('button').addEventListener('click', ev => { ev.stopPropagation(); openRank(day); });
  rankLoad(day).then(by => {
    if (!by) return;
    const recs = (dailyRecs()[day]) || {}, mine = DORDER.filter(d => recs[d]).reverse();
    const d = mine.find(x => myRank(by[x])), r = d && myRank(by[d]);
    const played = new Set(Object.values(by).flat().filter(x => !x.me).map(x => x.id)).size;
    row.querySelector('.drtxt').textContent = r ? T('Tu es ') + ord(r.rank) + T(' sur ') + r.total + T(' en ') + DIFFS[d].name : played ? played + (played > 1 ? T(' amis ont joué') : T(' ami a joué')) : '';
  }).catch(() => {});
}

// ---------- Fenêtre du classement ----------
async function openRank(day) {
  Snd.init(); RK.day = day;
  const recs = dailyRecs()[day] || {};
  RK.diff = RK.diff || DORDER.filter(d => recs[d]).pop() || 'facile';
  const dt = new Date(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8));
  $('#rkDate').textContent = T('Carte du ') + dt.toLocaleDateString(IS_EN ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long' }) + T(' · seulement tes amis');
  $('#rankPop').hidden = false; rankPaint(null);
  try { rankPaint(await rankLoad(day, true)); } catch (e) { rankPaint(null, true); }
}
function rankPaint(by, err) {
  $('#rkTabs').innerHTML = DORDER.map(d => '<button class="sbtn' + (d === RK.diff ? ' on' : '') + '" type="button" data-d="' + d + '">' + (d === 'infini' ? '∞' : DIFFS[d].name) + '</button>').join('');
  $('#rkTabs').querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { RK.diff = b.dataset.d; rankPaint(RK.cache[RK.day] ? RK.cache[RK.day].by : by); }));
  const box = $('#rkList');
  if (!by) { box.innerHTML = '<p class="fine">' + (err || !frLive() ? T('Il faut internet pour voir le classement.') : T('Chargement…')) + '</p>'; return; }
  const list = by[RK.diff] || [], ids = new Set(list.map(r => r.id)), waves = DIFFS[RK.diff] && DIFFS[RK.diff].waves;
  const idle = FR.list.filter(f => f.kind === 'friend' && !ids.has(f.id));
  const medal = i => i === 0 ? ' g' : i === 1 ? ' s' : i === 2 ? ' b' : '';
  box.innerHTML = list.map((r, i) => '<div class="rkrow' + (r.me ? ' me' : '') + '"><span class="rkn' + medal(i) + '">' + (i + 1) + '</span><span class="frav"><canvas data-av="' + esc(r.av || 'feu') + '"></canvas></span>'
    + '<div class="frwho"><b>' + esc(r.pseudo) + (r.me ? T(' (toi)') : '') + '</b><small>' + (RK.diff === 'infini' ? T('Mode infini') : r.won ? T('Victoire') : 'K.O.') + '</small></div>'
    + '<div class="rksc">' + T('Vague ') + r.wave + (waves && RK.diff !== 'infini' ? '/' + waves : '') + '<small>' + r.score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + ' pts</small></div></div>').join('')
    + idle.map(f => '<div class="rkrow idle"><span class="rkn">–</span><span class="frav"><canvas data-av="' + esc(f.av || 'feu') + '"></canvas></span><div class="frwho"><b>' + esc(f.pseudo) + '</b><small>' + T('Pas encore joué') + '</small></div></div>').join('')
    || '<p class="fine">' + T('Personne n’a encore joué cette difficulté aujourd’hui.') + '</p>';
  frAvatars(box);
}
$('#rkClose').addEventListener('click', () => { $('#rankPop').hidden = true; });
$('#rkPlay').addEventListener('click', () => { $('#rankPop').hidden = true; if (G && curScreen === 'over') { G = null; } playDaily(); });

// ---------- Fin de partie : défis réussis et place du jour ----------
function overExtra() {
  const box = $('#oExtra'), lines = [];
  for (const q of (G && G.questsDone) || []) lines.push('<p class="oxq">' + T('🎯 Défi réussi : ') + q + '</p>');
  box.innerHTML = lines.join(''); box.hidden = !lines.length;
  if (typeof chalOverExtra === 'function') chalOverExtra(box);
  const m = G && MAPS[G.map]; if (!m || !m.daily || !rankOn() || G.duel || G.coop) return;
  const day = m.daily, diff = G.diff;
  (async () => {
    await cloudPushDaily().catch(() => {});
    const by = await rankLoad(day, true), r = myRank(by && by[diff]);
    if (!r || curScreen !== 'over') return;
    const p = document.createElement('div'); p.className = 'oxrank';
    p.innerHTML = '<b>' + T('🏆 ') + ord(r.rank) + T(' sur ') + r.total + T(' amis aujourd’hui') + '</b><small>' + (r.rank === 1 ? T('Tu es devant tous tes amis !') : esc(r.first.pseudo) + T(' est en tête avec ') + r.first.score.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + ' pts') + '</small>'
      + '<button class="sbtn" type="button">' + T('Voir le classement') + '</button>';
    p.querySelector('button').addEventListener('click', () => { RK.diff = diff; openRank(day); });
    box.prepend(p); box.hidden = false;
  })().catch(() => {});
}
