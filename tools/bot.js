// Élémento Defense : joueur automatique pour l'équilibrage. Ce fichier est injecté dans une iframe du jeu
// (tools/balance.html) : il a accès aux fonctions du jeu (newGame, build, upgrade, update…).
// botGame(mi, diff, lv) joue une partie complète, sans affichage, avec les améliorations d'Atelier « lv » (paliers achetés).
'use strict';

// Ordre de construction : on alterne les éléments débloqués, avec du Zéphyr dès que des volants arrivent
const BOT_MIX = ['feu', 'eau', 'feu', 'terre', 'vent', 'foudre', 'glace', 'feu', 'terre', 'vent'];
const BOT_BR = { vent: 'air', terre: 'boss' };

function botCells() {
  // Cases constructibles, notées par la longueur de chemin couverte à portée moyenne (et le bonus de terrain)
  const pts = [];
  for (const pa of P.paths) for (let d = 0; d < pa.total; d += 0.2) { const [x, y] = pathOn(pa, d); pts.push([x, y]); }
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
    if (!canBuild(q, r)) continue;
    const [x, y] = cellW(q, r); let near = 0, close = 0;
    for (const [px, py] of pts) { const d2 = (px - x) ** 2 + (py - y) ** 2; if (d2 < 2.4 * 2.4) near++; if (d2 < 1.5 * 1.5) close++; }
    if (near) out.push({ q, r, score: near + close * 0.6 });
  }
  return out.sort((a, b) => b.score - a.score);
}
function botPickType(n) {
  const ok = BOT_MIX.filter(unlocked);
  // Volants dans la prochaine vague et pas encore de Zéphyr : on en pose un
  const flying = G.nextWave && G.nextWave.list && G.nextWave.list.some(it => ETYPES[it.type] && ETYPES[it.type].flying);
  if (flying && unlocked('vent') && !G.towers.some(t => t.type === 'vent')) return 'vent';
  return ok[n % ok.length];
}
// Dépense l'or : on améliore la tour la moins chère à monter si on a déjà assez de tours, sinon on construit
// Réglages de jeu du bot : nombre de tours visé (base + par vague, plafond) et choix des améliorations
const BOT = { base: 5, per: 1 / 2, cap: 20, upBest: false };
function botSpend(cells, st) {
  for (let guard = 0; guard < 40; guard++) {
    const want = Math.min(BOT.base + Math.floor(G.wave * BOT.per), BOT.cap), free = cells.filter(c => canBuild(c.q, c.r));
    // upBest : on monte d'abord les tours les mieux placées (les premières construites), sinon la moins chère
    const ups = G.towers.filter(t => upCost(t) > 0).sort((a, b) => BOT.upBest ? (a.lvl - b.lvl) || (a.id - b.id) : upCost(a) - upCost(b));
    const type = botPickType(st.built);
    if (G.towers.length < want && free.length && G.gold >= costOf(type)) {
      // Case la mieux placée, avec le bonus de terrain pour cet élément
      const best = free.slice(0, 12).map(c => ({ c, v: c.score * (1 + affinity(type, terrainAt(c.q, c.r))) })).sort((a, b) => b.v - a.v)[0].c;
      build(type, best.q, best.r); st.built++; continue;
    }
    if (ups.length && G.gold >= upCost(ups[0])) { const t = ups[0]; upgrade(t, t.br || BOT_BR[t.type] || 'sol'); continue; }
    if (free.length && G.gold >= costOf(type) && G.towers.length < 22) { const c = free[0]; build(type, c.q, c.r); st.built++; continue; }
    break;
  }
}
// Une partie complète. Rend : victoire, vague atteinte, éclats et or de cagnotte gagnés
// lv = null : on garde la progression en cours (campagne)
function botGame(mi, diff, lv) {
  const keep = { lv: meta.lv, shards: meta.shards, earned: meta.earned, bank: meta.bank };
  if (lv) { meta.lv = Object.assign({}, lv); meta.shards = 0; meta.earned = 0; meta.bank = 0; }
  try {
    newGame(mi, null, diff); G.speed = 1; opts.auto = false;
    const cells = botCells(), st = { built: 0 }, dt = 0.05;
    let steps = 0;
    while (!G.over && !G.won && steps < 400000) {
      // La victoire part d'un setTimeout dans le jeu, qui n'a pas le temps de passer ici : on la déclenche nous-mêmes
      if (!G.waveActive && G.wave >= G.maxw && !G.endless) { victory(); break; }
      if (!G.waveActive) { botSpend(cells, st); startWave(true); }
      for (let i = 0; i < 10 && !G.over && !G.won; i++) { update(dt); steps++; }
      if (steps % 100 === 0) botSpend(cells, st);
    }
    return { won: !!G.won, wave: G.wave, lives: G.lives, shards: meta.shards, bank: meta.bank, towers: G.towers.length, steps };
  } finally {
    G = null; if (lv) { meta.lv = keep.lv; meta.shards = keep.shards; meta.earned = keep.earned; meta.bank = keep.bank; }
  }
}

// Atelier : achète ce qui est le moins cher, tours d'abord (les fusions ne servent pas au bot)
const BOT_SKIP = ['paratonnerre', 'talisman', 'revive'];
function botAtelier() {
  for (let guard = 0; guard < 500; guard++) {
    const offers = [];
    for (const t in UNLOCK) if (!unlocked(t)) offers.push({ p: UNLOCK[t], w: UNLOCK[t] * 0.5, buy: () => { meta.lv['u_' + t] = 1; } });
    for (const u of UPGRADES) if (upLv(u) < u.max && (!u.tower || unlocked(u.tower)) && !BOT_SKIP.includes(u.id)) offers.push({ p: upPrice(u), w: upPrice(u), buy: () => { meta.lv[u.id] = upLv(u) + 1; } });
    const o = offers.filter(x => x.p <= meta.shards).sort((a, b) => a.w - b.w)[0];
    if (!o) return;
    meta.shards -= o.p; o.buy();
  }
}
// Éclats déjà dépensés dans l'Atelier (tours débloquées + paliers achetés)
function botSpent() {
  let n = 0; for (const t in UNLOCK) if (unlocked(t)) n += UNLOCK[t];
  for (const u of UPGRADES) for (let l = 0; l < upLv(u); l++) n += Math.max(1, Math.round(u.base * ECO.atelier * (l + 1) / (u.k * u.k)));
  return n;
}
// Campagne : de zéro, le bot achète les cartes dès qu'il peut, vise le prochain niveau à réussir (difficulté la plus basse,
// puis carte la plus basse), et quand il bloque, rejoue pour gagner des éclats. Rend le journal des parties.
function botCampaign(maxGames = 80, stopAt = 'difficile') {
  Object.assign(meta, { shards: 0, earned: 0, bank: 0, lv: {}, lvv: 2 }); store.set(BEST2, {});
  const fails = {}, log = [], regular = MAPS.map((m, i) => i).filter(i => !MAPS[i].season && !MAPS[i].random);
  const won = (i, k) => { const r = (store.get(BEST2) || {})[recId(MAPS[i])] || {}; return !!(r[k] && r[k].won); };
  for (let g = 0; g < maxGames; g++) {
    for (const i of regular) if (!mapOwned(i) && mapReqOk(i) && (meta.bank || 0) >= MAPS[i].price) { meta.bank -= MAPS[i].price; meta.lv['map_' + MAPS[i].id] = 1; }
    botAtelier();
    const todo = [];
    for (const k of ['facile', 'moyen', 'difficile']) for (const i of regular) if (mapOwned(i) && diffOpen(i, k) && !won(i, k)) todo.push([i, k]);
    let pickd = todo.find(([i, k]) => (fails[i + k] || 0) < 2);
    // Tout bloque : on farme le niveau réussi qui rapporte le plus (carte la plus haute, difficulté la plus haute)
    if (!pickd) { for (const k in fails) fails[k] = 0; const farm = []; for (const k of ['difficile', 'moyen', 'facile']) for (const i of regular.slice().reverse()) if (won(i, k)) farm.push([i, k]); pickd = farm[0] || todo[0]; }
    if (!pickd) break;
    const [i, k] = pickd, s0 = meta.shards + botSpent(), b0 = meta.bank || 0, r = botGame(i, k, null);
    if (!r.won) fails[i + k] = (fails[i + k] || 0) + 1; else for (const x in fails) fails[x] = 0;
    log.push({ g: g + 1, map: i + 1, diff: k, won: r.won, wave: r.wave, shards: meta.shards + botSpent() - s0, bank: (meta.bank || 0) - b0, invested: botSpent() });
    if (r.won && k === stopAt) break;
  }
  return log;
}
