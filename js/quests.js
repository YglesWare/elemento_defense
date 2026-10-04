// Élémento Defense : défis du jour.
// Trois défis par jour (un facile, un moyen, un plus dur), tirés au sort avec la date, parmi ceux qui ont un sens pour le
// joueur (rien sur un élément pas encore débloqué, pas de « gagne en Difficile » trop tôt). Seules les parties solo comptent.
// Ils rapportent de l'or dans la cagnotte ; les trois faits, un coffre bonus. Tout reste sur l'appareil (et suit la
// progression en ligne) : ça marche hors ligne.
'use strict';

const QUEST_KEY = 'elemento.quests';
STORE_DOMAINS[QUEST_KEY] = 'progress';
const QUEST_GOLD = [50, 80, 120], QUEST_CHEST = 100;
const ELEM_OF = { feu: 'de feu', eau: 'd’eau', terre: 'de terre', vent: 'de vent', foudre: 'd’éclair', glace: 'de glace' };
const ELEM_IC = { feu: '🔥', eau: '💧', terre: '🪨', vent: '🌪️', foudre: '⚡', glace: '❄️' };
const hasWon = diff => Object.values(store.get(BEST2) || {}).some(r => r && r[diff] && r[diff].won);
// ev : l'événement qui fait avancer le défi ; test : condition sur la partie ; ok : le défi a du sens pour ce joueur
const QUESTS = {
  win1: { tier: 0, ic: '🏆', n: 1, ev: 'win', txt: () => T('Gagne 1 partie') },
  towers: { tier: 0, ic: '🏗️', n: 20, ev: 'tower', txt: n => T('Pose ') + n + T(' tours') },
  waves: { tier: 0, ic: '🌊', n: 25, ev: 'wave', txt: n => T('Repousse ') + n + T(' vagues') },
  kills: { tier: 0, ic: '⚔️', n: 300, ev: 'kill', txt: n => T('Élimine ') + n + T(' ennemis') },
  win2: { tier: 1, ic: '🏆', n: 2, ev: 'win', txt: n => T('Gagne ') + n + T(' parties') },
  boss: { tier: 1, ic: '🐲', n: 2, ev: 'boss', txt: n => T('Bats ') + n + T(' boss') },
  fusion: { tier: 1, ic: '✨', n: 1, ev: 'fusion', txt: () => T('Crée une fusion'), ok: () => Object.keys(FUSIONS).some(fusionUnlocked) },
  daily: { tier: 1, ic: '📅', n: 1, ev: 'end', txt: () => T('Termine la carte du jour'), test: d => d.daily },
  mono: { tier: 2, ic: '🎨', n: 1, ev: 'win', el: true, txt: (n, q) => T('Gagne une partie avec seulement des tours ') + T(ELEM_OF[q.el]), test: (d, q) => d.types.length > 0 && d.types.every(t => t === q.el) },
  nolife: { tier: 2, ic: '❤️', n: 1, ev: 'win', txt: () => T('Gagne une partie sans perdre de vie'), test: d => !d.lostLife },
  moyen: { tier: 2, ic: '🥈', n: 1, ev: 'win', txt: () => T('Gagne une partie en Moyen ou plus'), test: d => d.diff !== 'facile', ok: () => hasWon('facile') },
  hard: { tier: 2, ic: '🥇', n: 1, ev: 'win', txt: () => T('Gagne une partie en Difficile'), test: d => d.diff === 'difficile', ok: () => hasWon('moyen') },
};
const questsOn = () => stats.wins >= 1;
let QST = null;
// Les défis d'aujourd'hui (tirés au premier passage de la journée)
function questDay() {
  const day = dayKey();
  if (QST && QST.day === day) return QST;
  const saved = store.get(QUEST_KEY);
  if (saved && saved.day === day) return (QST = saved);
  let h = hashStr('quests' + day) >>> 0; const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (h >>> 8) / 16777216; };
  const els = TORDER.filter(unlocked);
  const list = [0, 1, 2].map(tier => {
    const pool = Object.keys(QUESTS).filter(k => QUESTS[k].tier === tier && (!QUESTS[k].ok || QUESTS[k].ok()));
    const id = pool[Math.floor(rnd() * pool.length)], q = { id };
    if (QUESTS[id].el) q.el = els[Math.floor(rnd() * els.length)];
    return q;
  });
  QST = { day, list, prog: [0, 0, 0], claimed: [false, false, false], chest: false };
  store.set(QUEST_KEY, QST);
  return QST;
}
const questIcon = q => QUESTS[q.id].el ? ELEM_IC[q.el] || '🎨' : QUESTS[q.id].ic;
const questText = q => QUESTS[q.id].txt(QUESTS[q.id].n, q);
// Appelé par le jeu (js/game.js, js/ui.js) : win, end, tower, wave, kill, boss, fusion
function questEvent(ev, d = {}) {
  if (!questsOn() || !G || G.demo || G.duel || G.coop || G.guide || G.story || (window.parent !== window && window.parent.BALANCE)) return;
  const st = questDay(); let changed = false;
  st.list.forEach((q, i) => {
    const Q = QUESTS[q.id]; if (!Q || Q.ev !== ev || st.prog[i] >= Q.n || (Q.test && !Q.test(d, q))) return;
    st.prog[i] = Math.min(Q.n, st.prog[i] + 1); changed = true;
    if (st.prog[i] >= Q.n) questDone(q);
  });
  if (changed) { store.set(QUEST_KEY, st); questPaint(); }
}
function questDone(q) {
  (G.questsDone = G.questsDone || []).push(questText(q));
  const t = $('#questToast'); t.textContent = T('🎯 Défi réussi ! ') + questText(q); t.hidden = false; t.classList.remove('out'); void t.offsetWidth; t.classList.add('in');
  clearTimeout(questDone.tm); questDone.tm = setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.hidden = true; }, 400); }, 3200);
  Snd.play('clear');
}

// ---------- Accueil et fenêtre des défis ----------
function questPaint() {
  const b = $('#tQuests'); if (!b) return;
  b.hidden = !questsOn(); if (!questsOn()) return;
  const st = questDay(), done = st.prog.filter((p, i) => p >= QUESTS[st.list[i].id].n).length;
  const toClaim = st.list.filter((q, i) => st.prog[i] >= QUESTS[q.id].n && !st.claimed[i]).length + (st.claimed.every(Boolean) && !st.chest ? 1 : 0);
  $('#tqN').textContent = done + '/3';
  $('#tqBadge').hidden = !toClaim; $('#tqBadge').textContent = toClaim;
  if (!$('#questPop').hidden) questRender();
}
function questRender() {
  const st = questDay();
  $('#qList').innerHTML = st.list.map((q, i) => {
    const Q = QUESTS[q.id], p = st.prog[i], full = p >= Q.n, cl = st.claimed[i];
    return '<div class="qcard' + (cl ? ' claimed' : full ? ' done' : '') + '"><div class="qh"><span class="qic">' + questIcon(q) + '</span><span class="qt">' + questText(q) + '</span><span class="qr">' + (cl ? '✓ ' : '') + COIN + QUEST_GOLD[Q.tier] + '</span></div>'
      + (cl ? '' : full ? '<button class="btn green qclaim" type="button" data-i="' + i + '">' + T('Récupérer ') + COIN + QUEST_GOLD[Q.tier] + '</button>'
        : '<div class="qf"><span class="qbar"><i style="width:' + Math.round(p / Q.n * 100) + '%"></i></span>' + p + '/' + Q.n + '</div>') + '</div>';
  }).join('');
  const all = st.claimed.every(Boolean), n = st.claimed.filter(Boolean).length;
  $('#qChest').className = 'qchest' + (st.chest ? ' claimed' : all ? ' done' : '');
  $('#qChest').innerHTML = '<span class="qic">' + (st.chest ? '📭' : '🎁') + '</span><span class="qct">' + T('Les 3 défis : coffre bonus') + '<small>' + COIN + QUEST_CHEST + T(' dans la cagnotte') + '</small></span>'
    + (st.chest ? '<span class="qr">✓</span>' : all ? '<button class="btn green qclaim" type="button" data-i="chest">' + T('Ouvrir') + '</button>' : '<span class="qr">' + n + '/3</span>');
  const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), mn = Math.max(1, Math.round((next - now) / 60000));
  $('#qLeft').textContent = T('Nouveaux défis dans ') + (mn >= 60 ? Math.floor(mn / 60) + ' h ' + String(mn % 60).padStart(2, '0') : mn + ' min');
  document.querySelectorAll('#questPop .qclaim').forEach(b => b.addEventListener('click', () => questClaim(b.dataset.i)));
}
function questClaim(i) {
  const st = questDay();
  let gain = 0;
  if (i === 'chest') { if (!st.claimed.every(Boolean) || st.chest) return; st.chest = true; gain = QUEST_CHEST; }
  else { i = +i; const Q = QUESTS[st.list[i].id]; if (st.claimed[i] || st.prog[i] < Q.n) return; st.claimed[i] = true; gain = QUEST_GOLD[Q.tier]; }
  meta.bank = (meta.bank || 0) + gain; saveMeta(); store.set(QUEST_KEY, st);
  Snd.play('win'); hint('+' + gain + T(' or dans la cagnotte'), 1600);
  questRender(); questPaint(); if (typeof refreshTitle === 'function') refreshTitle();
}
function openQuests() { Snd.init(); questRender(); $('#questPop').hidden = false; }
$('#tQuests').addEventListener('click', openQuests);
$('#qClose').addEventListener('click', () => { $('#questPop').hidden = true; });
setInterval(() => { if (curScreen === 'title') questPaint(); }, 1500);
questPaint();
