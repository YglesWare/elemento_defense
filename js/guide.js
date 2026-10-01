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
  const B = near.find(c => c.T && c.T.name === 'Eau' && (c.q !== A.q || c.r !== A.r)) || near.find(c => !c.T && c.order >= A.order + 1 && (c.q !== A.q || c.r !== A.r)) || near[1];
  return [A, B];
}
const cellEl = c => c ? { cell: c } : null;
const GSTEPS = [
  { text: 'Salut, moi c’est <b>Yglou</b> ! Les slimes sortent du <b>portail violet</b> et suivent le chemin jusqu’à <b>mon nid</b>. Chaque slime qui y entre te coûte une vie.', target: () => ({ cell: { q: Math.floor(P.portals[0][0] / L.cw), r: Math.floor(P.portals[0][1] / L.cw) } }), btn: 'Suivant' },
  { text: 'Touche <b>Braise</b>, en bas, pour choisir cette tour de feu.', target: () => palBtns.feu, wait: () => G.selType === 'feu' || G.towers.length >= 1 },
  { text: 'Pose Braise sur la <b>case indiquée</b>, juste à côté du chemin : touche-la <b>deux fois</b> (une fois pour voir sa portée, une fois pour confirmer).', target: () => cellEl(GUIDE.cellA), wait: () => G.towers.length >= 1 },
  { text: 'Choisis maintenant <b>Ondine</b>. Regarde la carte : les cases <b>vertes</b> lui donnent un bonus, les <b>rouges</b> un malus. Ondine adore l’eau !', target: () => palBtns.eau, wait: () => G.selType === 'eau' || G.towers.length >= 2 },
  { text: 'Pose Ondine sur la <b>case indiquée</b> (deux touchers). Elle éclabousse et ralentit les ennemis.', target: () => cellEl(GUIDE.cellB), wait: () => G.towers.length >= 2 },
  { text: 'Tout est prêt : lance la <b>première vague</b> avec ce bouton.', target: () => $('#bWave'), wait: () => G.wave >= 1 },
  { text: 'Tes tours attaquent <b>toutes seules</b>. Chaque slime vaincu te rapporte de l’or (en haut). Attends la fin de la vague…', target: () => $('#hGoldChip'), wait: () => G.wave >= 1 && !G.waveActive && !G.spawnQ.length },
  { text: 'Bravo ! Touche ta <b>Braise</b> sur la carte pour ouvrir son panneau.', target: () => { const t = G.towers.find(x => x.type === 'feu'); return t ? { cell: { q: t.c, r: t.r } } : null; }, wait: () => (G.selTower && G.selTower.type === 'feu') || G.towers.some(t => t.lvl >= 2) },
  { text: 'Touche <b>« Améliorer »</b> : plus de dégâts et plus de portée. Au niveau 2, chaque tour pourra aussi choisir une spécialisation.', target: () => $('#iUp'), wait: () => G.towers.some(t => t.lvl >= 2) },
  { text: 'Sous la carte, l’<b>aperçu</b> montre la prochaine vague et la météo à venir. Pratique pour choisir tes tours !', target: () => $('#nextWave'), btn: 'Suivant', enter: () => deselect() },
  { text: 'Le bouton violet ouvre l’<b>Atelier</b> : tu y dépenses tes éclats (gagnés à chaque vague) pour débloquer d’autres tours, des fusions et des bonus.', target: () => $('#bShop'), btn: 'Suivant' },
  { text: 'Lance la <b>vague 2</b>. Astuce : la lancer avant la fin de la vague en cours rapporte un <b>bonus d’audace</b>.', target: () => $('#bWave'), wait: () => G.wave >= 2 },
  { text: 'À toi de jouer ! Pose d’autres tours avec ton or et tiens jusqu’à la <b>fin de la vague 5</b> pour terminer le tutoriel.', target: () => null, wait: () => G.wave >= 5 && !G.waveActive && !G.spawnQ.length, compact: true },
  { text: '🎓 <b>Tutoriel terminé !</b> Tu connais l’essentiel. La partie continue librement : bonne chance !', target: () => null, btn: 'Terminer', enter: () => guideReward() },
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
  hint('Tutoriel terminé : +10 éclats !', 3000); Snd.play('win');
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
  guideBox.innerHTML = '<canvas class="gy" aria-hidden="true"></canvas><div class="gstep">Tutoriel · ' + (GUIDE.i + 1) + '/' + GSTEPS.length + '</div><p>' + st.text + '</p><div class="gbtns">'
    + '<button type="button" class="sbtn" data-g="skip">Passer</button>' + (st.btn ? '<button type="button" class="sbtn up" data-g="next">' + st.btn + '</button>' : '') + '</div>';
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
  if (b.dataset.g === 'skip') { stopGuide(); hint('Tutoriel arrêté. Tu peux le relancer depuis l’écran des cartes.', 2600); }
  else guideNext();
});
$('#mGuide').addEventListener('click', startGuide);
