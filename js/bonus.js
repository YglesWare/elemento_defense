// Élémento Defense : bonus à usage unique, achetés avec l'or de la cagnotte (onglet « Bonus » de l'Atelier)
// et utilisés pendant une partie solo : 2 au maximum par partie, jamais en multijoueur.
'use strict';

const BONUS_MAX = 2;
// aim : le bonus vise une case (zone, ou ruine) ; ruin : il faut au moins une ruine sur la carte
const BONUSES = [
  { id: 'tresor', icon: '💰', name: T('Trésor'), price: 300, desc: T('+150 or tout de suite.') },
  { id: 'gel', icon: '❄️', name: T('Gel du temps'), price: 450, desc: T('Tous les ennemis sont figés 5 secondes (moins longtemps pour les boss).') },
  { id: 'meteore', icon: '☄️', name: T('Météore'), price: 500, aim: 'zone', desc: T('Touche la carte : gros dégâts à tous les ennemis de la zone.') },
  { id: 'bouclier', icon: '🛡️', name: T('Bouclier'), price: 400, desc: T('Toutes tes tours gagnent un bouclier de la moitié de leurs PV.') },
  { id: 'reparation', icon: '🔧', name: T('Réparation'), price: 500, desc: T('Toutes tes tours sont soignées à fond (pas les ruines).') },
  { id: 'coeur', icon: '❤️', name: T('Cœur de secours'), price: 600, desc: T('+5 vies.') },
  { id: 'nettoyage', icon: '🧹', name: T('Nettoyage'), price: 900, aim: 'ruin', desc: T('Difficile : touche une ruine pour la déblayer, la case redevient constructible.') },
  { id: 'resurrection', icon: '✨', name: T('Résurrection'), price: 2000, aim: 'ruin', desc: T('Difficile : touche une ruine, la tour détruite revient à son niveau.') },
];
const bonusById = id => BONUSES.find(b => b.id === id);
const bonusOwned = id => (meta.bonus && meta.bonus[id]) || 0;
const bonusOk = () => G && !G.over && !G.demo && !G.duel && !G.coop && !G.guide && !duelOn;
function bonusUsable(b) {
  if (!bonusOk() || !bonusOwned(b.id) || (G.bonusUsed || 0) >= BONUS_MAX) return false;
  if (b.aim === 'ruin' && !(G.ruins && G.ruins.length)) return false;
  return true;
}

// ---------- Boutique (Atelier) ----------
function renderBonusShop(boughtId) {
  const box = $('#sBonus'); if (!box) return;
  $('#sBank').textContent = meta.bank || 0;
  box.innerHTML = '';
  for (const b of BONUSES) {
    const d = document.createElement('div'), n = bonusOwned(b.id), poor = (meta.bank || 0) < b.price;
    d.className = 'up bonus' + (boughtId === b.id ? ' bought' : '');
    d.innerHTML = '<span class="bico" aria-hidden="true">' + b.icon + '</span><span class="un">' + b.name + '</span><span class="tag own">' + T('En stock : ') + n + '</span>'
      + '<p>' + b.desc + '</p><button class="sbtn buy" type="button"' + (poor || duelOn ? ' disabled' : '') + '>' + T('Acheter ') + COIN + b.price + '</button>';
    d.querySelector('button').addEventListener('click', () => buyBonus(b));
    box.appendChild(d);
  }
}
function buyBonus(b) {
  if (duelOn || (meta.bank || 0) < b.price) { Snd.play('no'); return; }
  meta.bank -= b.price; meta.bonus = meta.bonus || {}; meta.bonus[b.id] = bonusOwned(b.id) + 1; saveMeta();
  Snd.init(); Snd.play('win'); renderBonusShop(b.id);
}

// ---------- Pendant la partie ----------
function refreshBonusBtn() {
  const btn = $('#bBonus'); if (!btn) return;
  const show = bonusOk() && BONUSES.some(b => bonusOwned(b.id));
  btn.hidden = !show; $('#stage').classList.toggle('bonus-on', show); if (!show) return;
  const left = BONUS_MAX - (G.bonusUsed || 0);
  btn.querySelector('b').textContent = left + '/' + BONUS_MAX;
  btn.classList.toggle('aim', !!G.bonusAim); btn.disabled = left <= 0 && !G.bonusAim;
}
function openBonusPop() {
  if (!bonusOk()) return;
  if (G.bonusAim) { G.bonusAim = null; hint(T('Bonus annulé'), 1500); refreshBonusBtn(); return; }
  const pop = $('#bonusPop'); if (!pop.hidden) { pop.hidden = true; return; }
  const list = BONUSES.filter(b => bonusOwned(b.id));
  pop.innerHTML = '<p class="bp-h">' + T('Bonus utilisés : ') + (G.bonusUsed || 0) + '/' + BONUS_MAX + '</p>' + list.map(b => '<button class="bp-it" type="button" data-b="' + b.id + '"' + (bonusUsable(b) ? '' : ' disabled') + '><span>' + b.icon + '</span><b>' + b.name + '</b><small>×' + bonusOwned(b.id) + '</small></button>').join('');
  pop.hidden = false;
}
$('#bBonus').addEventListener('click', () => { Snd.init(); openBonusPop(); });
// Échap (bouton retour d'Android) : annule la visée ou ferme la liste avant tout le reste
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || !G) return;
  if (G.bonusAim) { G.bonusAim = null; refreshBonusBtn(); } else if (!$('#bonusPop').hidden) $('#bonusPop').hidden = true; else return;
  ev.preventDefault(); ev.stopImmediatePropagation();
}, true);
$('#bonusPop').addEventListener('click', ev => {
  const it = ev.target.closest('[data-b]'); if (!it) return;
  const b = bonusById(it.dataset.b); $('#bonusPop').hidden = true;
  if (!bonusUsable(b)) return;
  if (b.aim) { G.bonusAim = b.id; hint(b.aim === 'ruin' ? T('Touche une ruine') : T('Touche la carte pour lancer le météore'), 3000); refreshBonusBtn(); return; }
  useBonus(b);
});
// Un bonus qui vise : la case touchée (renvoie true si le toucher a été pris par le bonus)
function bonusTap(q, r) {
  if (!G || !G.bonusAim) return false;
  const b = bonusById(G.bonusAim);
  if (b.aim === 'ruin' && !ruinAt(q, r)) { Snd.play('no'); hint(T('Touche une ruine'), 1800); return true; }
  useBonus(b, q, r); return true;
}
function useBonus(b, q, r) {
  G.bonusAim = null;
  if (!bonusUsable(b)) { refreshBonusBtn(); return; }
  const [cx, cy] = q != null ? cellW(q, r) : [0, 0];
  if (b.id === 'tresor') { G.gold += 150; ono('+150', P.bases[0][0], P.bases[0][1], '#ffd23f', 0.6, 0, 1); }
  else if (b.id === 'gel') { for (const e of G.enemies) e.frozen = Math.max(e.frozen || 0, ETYPES[e.type].boss ? 2 : 5); banner(T('GEL !'), T('Les ennemis sont figés'), false); }
  else if (b.id === 'meteore') {
    const R = 1.8;
    for (const e of G.enemies) if (!e.dead && (e.x - cx) ** 2 + (e.y - cy) ** 2 <= R * R) hurt(e, e.maxHp * (ETYPES[e.type].boss ? 0.15 : 0.6), null, null);
    G.fx.push({ kind: 'ring', gx: cx, gy: cy, r0: 0.2, r1: R, t: 0, dur: 0.6, color: '#ff7a3d' });
    burst(cx, cy, 0.3, 30, ['#ffe066', '#ff7a3d', '#ff4f4f'], 4, 0.14, 4, 0.8); G.shake = Math.max(G.shake, 0.6); ono('BOOM!', cx, cy, '#ff7a3d', 0.8, 0, 1.1);
  }
  else if (b.id === 'bouclier') for (const t of G.towers) t.shield = Math.max(t.shield || 0, Math.round(t.maxHp * 0.5));
  else if (b.id === 'reparation') for (const t of G.towers) { t.ko = 0; t.hp = t.maxHp; }
  else if (b.id === 'coeur') G.lives += 5;
  else if (b.id === 'nettoyage') { G.ruins = G.ruins.filter(u => !(u.c === q && u.r === r)); burst(cx, cy, 0.2, 14, ['#cdbfe0', '#ffffff'], 2, 0.08, 3, 0.5); }
  else if (b.id === 'resurrection') {
    const u = G.ruins.find(x => x.c === q && x.r === r); G.ruins = G.ruins.filter(x => x !== u);
    const t = addTower(u.type, q, r, u.lvl || 1, u.mode || 'premier', u.inv, u.br); t.recoil = 1;
    burst(t.x, t.y, 0.4, 24, ['#ffd23f', '#ffffff', '#b8f5c0'], 3, 0.1, 2, 0.8, 'star'); ono(T('DE RETOUR !'), t.x, t.y, '#5cd86a', 0.6, 0, 1.1);
  }
  meta.bonus[b.id] = bonusOwned(b.id) - 1; saveMeta();
  G.bonusUsed = (G.bonusUsed || 0) + 1;
  Snd.play('win'); hint(b.icon + ' ' + b.name + T(' utilisé · bonus ') + G.bonusUsed + '/' + BONUS_MAX, 2200);
  hudCache = {}; refreshBonusBtn();
}
