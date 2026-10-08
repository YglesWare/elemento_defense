// Élémento Defense : tutoriel guidé (une vraie partie sur Prairie Mochi, consignes pas à pas).
'use strict';

const GUIDE = { on: false, i: 0, timer: 0, cellA: null, cellB: null };
const guideBox = $('#guideBox'), guideRing = $('#guideRing');

// Cases conseillées : constructibles, collées au début du premier chemin ; pour Ondine, une case d'eau si possible
function guideCells() {
  const near = [], seen = new Set();
  P.paths[0].order.forEach(([pq, pr], i) => {
    for (const [a, b] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const q = pq + a, r = pr + b, k = q + ',' + r;
      if (seen.has(k) || !canBuild(q, r)) continue;
      seen.add(k); near.push({ q, r, order: i, T: terrainAt(q, r) });
    }
  });
  near.sort((a, b) => a.order - b.order);
  const A = near.find(c => !c.T && c.order >= 2) || near[0];
  const B = near.find(c => c.T && c.T.name === T('Eau') && (c.q !== A.q || c.r !== A.r)) || near.find(c => !c.T && c.order >= A.order + 1 && (c.q !== A.q || c.r !== A.r)) || near[1];
  return [A, B];
}
const cellEl = c => c ? { cell: c } : null;
const GSTEPS = [
  { text: T('Salut, moi c’est <b>Yglou</b> ! Les slimes sortent du <b>portail violet</b> et suivent le chemin jusqu’à ta <b>maison</b>. Chaque slime qui y entre te coûte une vie.'), target: () => ({ cell: { q: Math.floor(P.portals[0][0] / L.cw), r: Math.floor(P.portals[0][1] / L.cw) } }), btn: T('Suivant') },
  { text: T('Touche <b>Braise</b>, en bas, pour choisir cette tour de feu.'), target: () => palBtns.feu, wait: () => G.selType === 'feu' || G.towers.length >= 1 },
  { text: T('Pose Braise sur la <b>case indiquée</b>, juste à côté du chemin : touche-la <b>deux fois</b> (une fois pour voir sa portée, une fois pour confirmer).'), target: () => cellEl(GUIDE.cellA), wait: () => G.towers.length >= 1 },
  { text: T('Choisis maintenant <b>Ondine</b>. Regarde la carte : les cases <b>vertes</b> lui donnent un bonus, les <b>rouges</b> un malus. Ondine adore l’eau !'), target: () => palBtns.eau, wait: () => G.selType === 'eau' || G.towers.length >= 2 },
  { text: T('Pose Ondine sur la <b>case indiquée</b> (deux touchers). Elle éclabousse et ralentit les ennemis.'), target: () => cellEl(GUIDE.cellB), wait: () => G.towers.length >= 2 },
  { text: T('Tout est prêt : lance la <b>première vague</b> avec ce bouton.'), target: () => $('#bWave'), wait: () => G.wave >= 1 },
  { text: T('Tes tours attaquent <b>toutes seules</b>. Chaque slime vaincu te rapporte de l’or (en haut). Attends la fin de la vague…'), target: () => $('#hGoldChip'), wait: () => G.wave >= 1 && !G.waveActive && !G.spawnQ.length },
  { text: T('Bravo ! Touche ta <b>Braise</b> sur la carte pour ouvrir son panneau.'), target: () => { const t = G.towers.find(x => x.type === 'feu'); return t ? { cell: { q: t.c, r: t.r } } : null; }, wait: () => (G.selTower && G.selTower.type === 'feu') || G.towers.some(t => t.lvl >= 2) },
  { text: T('Touche <b>« Améliorer »</b>, puis achète des <b>Dégâts</b> : chaque achat renforce la tour, et coûte un peu plus que le précédent.'), target: () => curScreen === 'tree' ? $('#trBrs button[data-k="dmg"]') : $('#iUp'), wait: () => G.towers.some(t => upTot(t.up) >= 1) },
  { text: T('Sous la carte, l’<b>aperçu</b> montre la prochaine vague et la météo à venir. Pratique pour choisir tes tours !'), target: () => $('#nextWave'), btn: T('Suivant'), enter: () => deselect() },
  { text: T('Le bouton violet ouvre l’<b>Atelier</b> : tu y dépenses tes éclats (gagnés à chaque vague) pour débloquer d’autres tours, des fusions et des bonus.'), target: () => $('#bShop'), btn: T('Suivant') },
  { text: T('Lance la <b>vague 2</b>. Astuce : la lancer avant la fin de la vague en cours rapporte un <b>bonus d’audace</b>.'), target: () => $('#bWave'), wait: () => G.wave >= 2 },
  { text: T('À toi de jouer ! Pose d’autres tours avec ton or et tiens jusqu’à la <b>fin de la vague 5</b> pour terminer le tutoriel.'), target: () => null, wait: () => G.wave >= 5 && !G.waveActive && !G.spawnQ.length, compact: true },
  { text: T('🎓 <b>Tutoriel terminé !</b> Tu connais l’essentiel. La partie continue librement : bonne chance !'), target: () => null, btn: T('Terminer'), enter: () => guideReward() },
];
function startGuide() {
  Snd.init();
  newGame(0, null, 'facile');
  G.guide = true;
  [GUIDE.cellA, GUIDE.cellB] = guideCells();
  Object.assign(GUIDE, { on: true, i: 0 });
  clearInterval(GUIDE.timer); GUIDE.timer = setInterval(guideTick, 150);
  renderGuide();
}
function stopGuide() {
  GUIDE.on = false; clearInterval(GUIDE.timer);
  guideBox.hidden = true; guideRing.hidden = true;
}
function guideReward() {
  if (store.get('elemento.guideDone')) return;
  store.set('elemento.guideDone', true);
  meta.shards += 10; saveMeta();
  hint(T('Tutoriel terminé : +10 éclats !'), 3000); Snd.play('win');
}
function guideNext() {
  GUIDE.i++;
  if (GUIDE.i >= GSTEPS.length) { stopGuide(); return; }
  const st = GSTEPS[GUIDE.i]; if (st.enter) st.enter();
  Snd.play('build');
  renderGuide();
}
function renderGuide() {
  const st = GSTEPS[GUIDE.i];
  guideBox.innerHTML = T('<canvas class="gy" aria-hidden="true"></canvas><div class="gstep">Tutoriel · ') + (GUIDE.i + 1) + '/' + GSTEPS.length + '</div><p>' + st.text + '</p><div class="gbtns">'
    + T('<button type="button" class="sbtn" data-g="skip">Passer</button>') + (st.btn ? '<button type="button" class="sbtn up" data-g="next">' + st.btn + '</button>' : '') + '</div>';
  guideTick();
}
function targetRect(t) {
  if (!t) return null;
  if (t.cell) {
    const sr = stage.getBoundingClientRect(), [x, y] = cellXY(t.cell.q, t.cell.r);
    return { left: sr.left + x, top: sr.top + y, width: L.cs, height: L.cs };
  }
  if (t.hidden || !t.getBoundingClientRect) return null;
  const r = t.getBoundingClientRect(); if (!r.width) return null;
  return r;
}
function guideTick() {
  if (!GUIDE.on) return;
  if (!G || !G.guide) { stopGuide(); return; }
  if (G.over) { stopGuide(); return; }
  const st = GSTEPS[GUIDE.i];
  if (st.wait && st.wait()) { guideNext(); return; }
  const show = curScreen === 'game';
  guideBox.hidden = !show;
  const r = show ? targetRect(st.target && st.target()) : null;
  guideRing.hidden = !r;
  if (r) { const pad = 6; Object.assign(guideRing.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' }); }
  if (show) {
    const sr = stage.getBoundingClientRect(), low = r && r.top + r.height / 2 > sr.top + sr.height * 0.55;
    guideBox.classList.toggle('top', !!low || !r); guideBox.classList.toggle('compact', !!st.compact);
    guideBox.style.top = (low || !r ? sr.top + 52 : '') + (low || !r ? 'px' : '');
    guideBox.style.bottom = low || !r ? '' : (window.innerHeight - sr.bottom + 44) + 'px';
  }
}
guideBox.addEventListener('click', ev => {
  const b = ev.target.closest('[data-g]'); if (!b) return;
  if (b.dataset.g === 'skip') { stopGuide(); hint(T('Tutoriel arrêté. Tu peux le relancer depuis l’écran des cartes.'), 2600); }
  else guideNext();
});
$('#mGuide').addEventListener('click', startGuide);

// ---------- Coup de pouce de la toute première partie ----------
// Pour un joueur qui n'a encore jamais posé de tour (et n'a pas fait le tutoriel) : en 6 temps, un anneau, une main et
// une petite bulle d'Yglou montrent quoi toucher (choisir Braise, la poser, l'améliorer, lancer la vague). Il revient à
// chaque partie tant qu'il n'est pas fini ; « ✕ » l'arrête pour de bon.
const COACH_KEY = 'elemento.coachDone';
const COACH = { on: false, i: 0, timer: 0, cell: null };
const coachRing = document.createElement('div'), coachHand = document.createElement('div'), coachBox = document.createElement('div');
coachRing.id = 'coachRing'; coachHand.id = 'coachHand'; coachBox.id = 'coachBox';
for (const e of [coachRing, coachHand, coachBox]) { e.hidden = true; document.body.appendChild(e); }
const coachTower = () => G.towers[0] || null;
const coachRows = () => {
  const rows = [...document.querySelectorAll('#trBrs .uprow')].slice(0, 3).map(e => e.getBoundingClientRect()).filter(r => r.width);
  if (!rows.length) return null;
  COACH.first = rows[0]; // la main montre l'achat de Dégâts
  const l = Math.min(...rows.map(r => r.left)), t = Math.min(...rows.map(r => r.top)), rr = Math.max(...rows.map(r => r.right)), b = Math.max(...rows.map(r => r.bottom));
  return { left: l, top: t, width: rr - l, height: b - t };
};
// hand : où se met la main par rapport à la cible (au-dessus, en dessous, à droite)
const CSTEPS = [
  { text: T('Touche <b>Braise</b> pour choisir ta première tour.<small>Elle crache du feu sur les slimes.</small>'), hand: 'above',
    target: () => palBtns.feu, done: () => G.selType === 'feu' || G.towers.length > 0 },
  { text: T('Touche <b>deux fois</b> la case qui brille : juste à côté du chemin, Braise touchera les slimes.'), hand: 'below', round: true,
    target: () => COACH.cell && { cell: COACH.cell }, done: () => G.towers.length > 0, back: () => G.selType !== 'feu' && !G.towers.length ? 0 : null },
  { text: T('Bien joué ! Touche maintenant <b>ta Braise</b> pour la rendre plus forte.'), hand: 'below', round: true,
    target: () => coachTower() && { cell: { q: coachTower().c, r: coachTower().r } }, done: () => !!G.selTower },
  { text: T('Touche <b>Améliorer</b> : avec ton or, tu achètes des niveaux pour ta tour.'), hand: 'right',
    target: () => $('#iUp'), done: () => curScreen === 'tree', back: () => !G.selTower && curScreen === 'game' ? 2 : null },
  { text: T('<b>⚔️ Dégâts</b> : chaque tir fait plus mal.<br><b>🎯 Portée</b> : elle tire plus loin.<br><b>⚡ Cadence</b> : elle tire plus vite.<small>Achètes-en un, puis touche « Retour au jeu ».</small>'), hand: 'inside',
    target: coachRows, done: () => curScreen === 'game' },
  { text: T('Tout est prêt ! Lance la <b>vague</b> : tes tours tirent toutes seules.<small>Pose d’autres tours quand tu as de l’or.</small>'), hand: 'below',
    target: () => $('#bWave'), done: () => G.wave >= 1 },
];
function coachStart() {
  if (store.get(COACH_KEY) || stats.towers || store.get('elemento.guideDone') || !G || G.demo || G.duel || G.coop || G.story || G.guide) return;
  Object.assign(COACH, { on: true, i: 0, cell: guideCells()[0] });
  clearInterval(COACH.timer); COACH.timer = setInterval(coachTick, 150);
  coachRender();
}
function coachStop(done) {
  COACH.on = false; clearInterval(COACH.timer);
  coachRing.hidden = coachHand.hidden = coachBox.hidden = true;
  if (done) store.set(COACH_KEY, true);
}
function coachRender() {
  coachBox.innerHTML = '<canvas aria-hidden="true"></canvas><p>' + CSTEPS[COACH.i].text + '</p><span class="ctag">' + T('Coup de pouce · ') + (COACH.i + 1) + '/' + CSTEPS.length + '</span>'
    + '<button class="cskip" type="button" aria-label="' + T('Arrêter le coup de pouce') + '">✕</button>';
  drawYglou(prepMini(coachBox.querySelector('canvas'), 40, 44), 20, 27, 30, 'happy', 0, { noShadow: true, noConfetti: true });
  coachTick();
}
function coachTick() {
  if (!COACH.on) return;
  if (!G || G.over || G.guide || G.story || G.duel || G.coop) { coachStop(false); return; }
  const st = CSTEPS[COACH.i];
  if (st.done()) {
    if (COACH.i + 1 >= CSTEPS.length) { coachStop(true); return; }
    COACH.i++; Snd.play('build'); coachRender(); return;
  }
  const b = st.back && st.back(); if (b != null && b !== COACH.i) { COACH.i = b; coachRender(); return; }
  const show = curScreen === 'game' || curScreen === 'tree';
  const tg = show ? st.target() : null; // un cadre déjà calculé (les lignes d'achat) passe tel quel
  const r0 = !tg ? null : tg.cell || tg.getBoundingClientRect ? targetRect(tg) : tg;
  const r = r0 && { left: r0.left, top: r0.top, width: r0.width, height: r0.height, right: r0.left + r0.width, bottom: r0.top + r0.height };
  coachBox.hidden = !show; coachRing.hidden = coachHand.hidden = !r;
  if (!r) return;
  const pad = 6, W = innerWidth, H = innerHeight;
  coachRing.classList.toggle('round', !!st.round);
  Object.assign(coachRing.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
  // La main : du côté demandé, ou de l'autre s'il n'y a pas la place (paysage)
  let side = st.hand, hx, hy;
  if (side === 'right' && r.right + 52 > W) side = 'left';
  if (side === 'above' && r.top < 56) side = r.left > 60 ? 'left' : 'below';
  if (side === 'below' && r.bottom + 56 > H) side = 'above';
  const cx = r.left + r.width / 2 - 22;
  if (side === 'above') { hx = cx; hy = r.top - 54; coachHand.textContent = '👇'; }
  else if (side === 'below') { hx = cx; hy = r.bottom + 4; coachHand.textContent = '👆'; }
  else if (side === 'right') { hx = r.right + 6; hy = r.top + r.height / 2 - 24; coachHand.textContent = '👈'; }
  else if (side === 'left') { hx = r.left - 52; hy = r.top + r.height / 2 - 24; coachHand.textContent = '👉'; }
  else { const f = COACH.first || r; hx = f.left + f.width - 56; hy = f.top + f.height - 30; coachHand.textContent = '👆'; }
  Object.assign(coachHand.style, { left: Math.max(2, Math.min(W - 48, hx)) + 'px', top: Math.max(2, Math.min(H - 50, hy)) + 'px' });
  // La bulle : de l'autre côté de la cible, sans la cacher
  const bh = coachBox.offsetHeight || 70, low = r.top + r.height / 2 > H * 0.55;
  const above = r.top - bh - (side === 'above' ? 62 : 14), below = r.bottom + (side === 'below' || side === 'inside' ? 58 : 14), fitB = below + bh <= H - 6;
  // Ni au-dessus ni en dessous (paysage) : tout en haut de l'écran
  const top = low ? (above >= 6 ? above : fitB ? below : 6) : (fitB ? below : above >= 6 ? above : 6);
  coachBox.style.top = top + 'px';
}
coachBox.addEventListener('click', ev => {
  if (ev.target.closest('.cskip')) { coachStop(true); hint(T('Coup de pouce arrêté.'), 1800); }
});
