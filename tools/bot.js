// Élémento Defense : joueur automatique pour l'équilibrage. Ce fichier est injecté dans une iframe du jeu
// (tools/balance.html) : il a accès aux fonctions du jeu (newGame, build, upgrade, update…).
// botGame(mi, diff, lv) joue une partie complète, sans affichage, avec les améliorations d'Atelier « lv » (paliers achetés).
'use strict';

// Comme un joueur raisonnable : il débloque les tours dès qu'il peut, mise sur 4 éléments « de cœur » dans l'Atelier,
// choisit sur chaque carte 2 éléments principaux selon le terrain, et garde des Zéphyr pour les volants.
const BOT_CORE = ['feu', 'eau', 'vent', 'terre'];
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
// Les 2 éléments principaux de la carte (hors Zéphyr) : affinité avec le biome, puis maîtrise dans l'Atelier
function botMains() {
  if (G.botMains) return G.botMains;
  // Givrette (glace) : une tour de soutien (ralentit, peu de dégâts), jamais un élément principal
  const bio = MAPS[G.map].biome, cand = TORDER.filter(t => t !== 'vent' && t !== 'glace' && unlocked(t));
  const v = t => affinity(t, bio) + 0.04 * (M('m_' + t) + M('p_' + t)) + (BOT_CORE.includes(t) ? 0.02 : 0);
  return (G.botMains = cand.sort((a, b) => v(b) - v(a)).slice(0, 2));
}
const botFlyers = () => (G.nextWave && G.nextWave.list ? G.nextWave.list.filter(it => ETYPES[it.type] && ETYPES[it.type].flying).length : 0);
function botPickType(n) {
  const mains = botMains(), vents = G.towers.filter(t => t.type === 'vent').length;
  // Un Zéphyr pour 4 tours dès la vague 3, au moins 2 avant une nuée de volants
  if (unlocked('vent') && ((G.wave >= 3 && vents < Math.round(G.towers.length / 4)) || (botFlyers() >= 8 && vents < 2) || (botFlyers() && vents < 1))) return 'vent';
  // Une Rocaille pour 4 tours dès la vague 5 : gros coups contre les boss et les Tonk cuirassés
  if (unlocked('terre') && !mains.includes('terre') && G.wave >= 5 && G.towers.filter(t => t.type === 'terre').length < Math.round(G.towers.length / 4)) return 'terre';
  // Sinon les deux éléments principaux, deux pour un
  return mains[n % 3 === 2 && mains[1] ? 1 : 0] || 'feu';
}
// Note d'une case pour un élément : chemin couvert, bonus de terrain, colline (+0,4 de portée)
const botCellValue = (c, type) => { const Tt = terrainAt(c.q, c.r); return c.score * (1 + affinity(type, Tt)) * (Tt && Tt.range ? 1.25 : 1); };
// Dépense l'or : on améliore la tour la moins chère à monter si on a déjà assez de tours, sinon on construit
// Réglages de jeu du bot : nombre de tours visé (base + par vague, plafond) et choix des améliorations
const BOT = { base: 5, per: 1 / 2, cap: 20, upBest: false, fuse: true };
function botSpend(cells, st) {
  // Difficile : on soigne d'abord les tours sous 60 % de PV
  if (hardMode()) for (const t of G.towers.filter(t => t.hp < t.maxHp * 0.6).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)) if (G.gold >= healCost(t)) healPaid(t);
  // Fusions : deux tours compatibles au niveau 2 → une tour fusionnée, sur la case la mieux placée des deux
  if (BOT.fuse) for (let guard = 0; guard < 6; guard++) {
    const score = t => { const c = cells.find(c => c.q === t.c && c.r === t.r); return c ? c.score : 0; };
    let best = null;
    for (const a of G.towers) for (const b of G.towers) {
      if (a === b || TOWERS[a.type].fusion || TOWERS[b.type].fusion || a.lvl < 2 || b.lvl < 2) continue;
      const k = fusionKey(a.type, b.type); if (!k || !fusionUnlocked(k) || G.gold < TOWERS[k].fee) continue;
      const [src, dst] = score(a) >= score(b) ? [b, a] : [a, b];
      if (!best || score(dst) > best.v) best = { src, dst, k, v: score(dst) };
    }
    if (!best) break;
    doFuse(best.src, best.dst, best.k);
  }
  // Nuée de volants à venir et pas assez de Zéphyr : on en pose, même au-delà du nombre de tours visé
  if (unlocked('vent') && botFlyers() >= 8 && G.towers.filter(t => t.type === 'vent').length < 2 && G.towers.length < BOT.cap + 2 && G.gold >= costOf('vent')) {
    const free = cells.filter(c => canBuild(c.q, c.r));
    if (free.length) { const best = free.slice(0, 12).sort((a, b) => botCellValue(b, 'vent') - botCellValue(a, 'vent'))[0]; build('vent', best.q, best.r); st.built++; }
  }
  for (let guard = 0; guard < 40; guard++) {
    const want = Math.min(BOT.base + Math.floor(G.wave * BOT.per), BOT.cap), free = cells.filter(c => canBuild(c.q, c.r));
    // upBest : on monte d'abord les tours les mieux placées (les premières construites), sinon la moins chère
    const ups = G.towers.filter(t => upCost(t) > 0).sort((a, b) => BOT.upBest ? (a.lvl - b.lvl) || (a.id - b.id) : upCost(a) - upCost(b));
    const type = botPickType(st.built);
    if (G.towers.length < want && free.length && G.gold >= costOf(type)) {
      // Case la mieux placée, avec le bonus de terrain pour cet élément
      const best = free.slice(0, 12).sort((a, b) => botCellValue(b, type) - botCellValue(a, type))[0];
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

// Atelier : achète ce qui est le moins cher, tours et fusions d'abord
const BOT_SKIP = ['paratonnerre', 'talisman', 'revive'];
function botAtelier() {
  for (let guard = 0; guard < 500; guard++) {
    const offers = [];
    // Une nouvelle tour dès qu'on peut se l'offrir ; les fusions des éléments de cœur ; les maîtrises de ces éléments seulement
    for (const t in UNLOCK) if (!unlocked(t)) offers.push({ p: UNLOCK[t], w: 0, buy: () => { meta.lv['u_' + t] = 1; } });
    if (BOT.fuse) for (const k in FUSIONS) if (!fusionUnlocked(k) && FUSIONS[k].parents.every(unlocked) && FUSIONS[k].parents.every(p => BOT_CORE.includes(p))) offers.push({ p: FUSIONS[k].unlock, w: FUSIONS[k].unlock * 0.3, buy: () => { meta.lv['f_' + k] = 1; } });
    for (const u of UPGRADES) if (!upFull(u) && (!u.tower || (unlocked(u.tower) && BOT_CORE.includes(u.tower))) && !BOT_SKIP.includes(u.id)) offers.push({ p: upPrice(u), w: upPrice(u), buy: () => { meta.lv[u.id] = upLv(u) + 1; } });
    const o = offers.filter(x => x.p <= meta.shards).sort((a, b) => a.w - b.w)[0];
    if (!o) return;
    meta.shards -= o.p; o.buy();
  }
}
// Éclats déjà dépensés dans l'Atelier (tours débloquées + paliers achetés)
function botSpent() {
  let n = 0; for (const t in UNLOCK) if (unlocked(t)) n += UNLOCK[t];
  for (const k in FUSIONS) if (fusionUnlocked(k)) n += FUSIONS[k].unlock;
  for (const u of UPGRADES) for (let l = 0; l < upLv(u); l++) n += upPriceAt(u, l);
  return n;
}
// Campagne : de zéro, le bot achète les cartes dès qu'il peut, vise le prochain niveau à réussir (difficulté la plus basse,
// puis carte la plus basse), et quand il bloque, rejoue pour gagner des éclats. Rend le journal des parties.
function botCampaign(maxGames = 80, stopAt = 'difficile') {
  Object.assign(meta, { shards: 0, earned: 0, bank: 0, lv: {}, lvv: 2 }); store.set(BEST2, {});
  let lastFail = false;
  const fails = {}, log = [], regular = MAPS.map((m, i) => i).filter(i => !MAPS[i].season && !MAPS[i].random);
  const won = (i, k) => { const r = (store.get(BEST2) || {})[recId(MAPS[i])] || {}; return !!(r[k] && r[k].won); };
  for (let g = 0; g < maxGames; g++) {
    for (const i of regular) if (!mapOwned(i) && mapReqOk(i) && (meta.bank || 0) >= MAPS[i].price) { meta.bank -= MAPS[i].price; meta.lv['map_' + MAPS[i].id] = 1; }
    botAtelier();
    const todo = [];
    for (const k of ['facile', 'moyen', 'difficile']) for (const i of regular) if (mapOwned(i) && diffOpen(i, k) && !won(i, k)) todo.push([i, k]);
    // Comme un joueur : un niveau raté deux fois n'est retenté qu'une fois nettement plus fort (+15 % d'éclats investis)
    const inv = botSpent(), ready = ([i, k]) => { const f = fails[i + k]; return !f || f.n < 2 || inv >= f.at * 1.15; };
    const farm = []; for (const i of regular.slice().reverse()) for (const k of ['difficile', 'moyen', 'facile']) if (won(i, k)) farm.push([i, k]);
    // Comme un joueur : après un échec, il rejoue une fois un niveau déjà réussi (de l'or pour la carte suivante, des éclats)
    let pickd = lastFail && farm.length ? farm[0] : todo.find(ready);
    // Sinon, on farme le niveau réussi qui rapporte le plus (carte la plus haute, puis difficulté la plus haute)
    if (!pickd) pickd = farm[0] || todo[0];
    if (!pickd) break;
    const [i, k] = pickd, s0 = meta.shards + botSpent(), b0 = meta.bank || 0, r = botGame(i, k, null);
    lastFail = !r.won;
    if (!r.won) { const f = fails[i + k]; fails[i + k] = { n: f && inv < f.at * 1.15 ? f.n + 1 : 1, at: inv }; } else delete fails[i + k];
    log.push({ g: g + 1, map: i + 1, diff: k, won: r.won, wave: r.wave, shards: meta.shards + botSpent() - s0, bank: (meta.bank || 0) - b0, invested: botSpent() });
    if (r.won && k === stopAt) break;
  }
  return log;
}
