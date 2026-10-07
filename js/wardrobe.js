// Élémento Defense : garde-robe d'Yglou (chapeaux, couleur de crête, aura), payée avec l'or de la cagnotte.
// Rien ne s'achète avec de l'argent réel. Ce qui est acheté reste à toi (meta.wear, suit la progression en ligne).
// Yglou porte la tenue choisie sur l'accueil, le Profil, les fins de partie… et tes amis le voient (avatar « yg… »).
'use strict';

const WEAR_HATS = [
  ['none', 'Aucun', 0], ['halloween', 'Chapeau de sorcier', 2500], ['noel', 'Bonnet de Noël', 2500], ['paques', 'Oreilles de lapin', 2500],
  ['valentin', 'Serre-tête cœurs', 3000], ['nouvelan', 'Chapeau doré', 3000], ['cap', 'Casquette', 2000], ['ninja', 'Bandeau ninja', 2000],
  ['tophat', 'Haut-de-forme', 4000], ['crown', 'Couronne', 6000], ['nightcap', 'Bonnet de nuit', 0, 'story'],
];
const WEAR_CRESTS = [
  ['or', 'Dorée', 0, '#e0a640'], ['rose', 'Rose', 1000, '#ff4f81'], ['bleu', 'Bleue', 1000, '#3fa9ff'], ['vert', 'Verte', 1000, '#4fd36a'],
  ['violet', 'Violette', 1000, '#b06cff'], ['orange', 'Orange', 1000, '#ff8a2b'], ['blanc', 'Blanche', 1000, '#ffffff'], ['nuit', 'Nuit', 1500, '#3b2458'],
];
const WEAR_AURA = 10000;
const wear = () => { meta.wear = meta.wear || { own: [], hat: null, crest: null, aura: false }; return meta.wear; };
const wearOwns = id => id === 'hat:none' || id === 'crest:or' || wear().own.includes(id);
const wearHat = () => { const h = wear().hat; return h && h !== 'none' ? h : null; };
const wearCrest = () => { const c = WEAR_CRESTS.find(x => x[0] === wear().crest); return c && c[0] !== 'or' ? c[3] : null; };
// Avatar vu par les amis : « yg » + lettre du chapeau + lettre de la crête (+ « z » avec l'aura)
const AV_L = 'abcdefghijk';
function myAvatar() {
  const w = wear(), hi = Math.max(0, WEAR_HATS.findIndex(x => x[0] === (w.hat || 'none'))), ci = Math.max(0, WEAR_CRESTS.findIndex(x => x[0] === (w.crest || 'or')));
  return 'yg' + AV_L[hi] + AV_L[ci] + (w.aura ? 'z' : '');
}
function avatarLook(av) {
  const m = /^yg([a-k])([a-h])(z?)$/.exec(av || ''); if (!m) return null;
  const h = WEAR_HATS[AV_L.indexOf(m[1])], cr = WEAR_CRESTS[AV_L.indexOf(m[2])];
  return { costume: h && h[0] !== 'none' ? h[0] : null, crest: cr && cr[0] !== 'or' ? cr[3] : null, aura: !!m[3] };
}
// Tête d'Yglou dans un cadre carré n × n (avatar)
function drawYglouHead(c, n, look) {
  const hat = !!look.costume && look.costume !== 'ninja', s = n * (hat ? 1.02 : 1.18), r = s * 0.36;
  drawYglou(c, n / 2, n * (hat ? 0.6 : 0.52) + r * 0.62, s, 'happy', 0.4, { noShadow: true, noConfetti: true, costume: look.costume, crest: look.crest, aura: look.aura });
}

// ---------- Écran de la garde-robe ----------
screens.wardrobe = $('#sWardrobe');
const WR = { tab: 'hat', sel: null };
const wrItems = () => WR.tab === 'hat' ? WEAR_HATS.map(([k, n, p, lock]) => ({ id: 'hat:' + k, key: k, name: n, price: p, lock }))
  : WR.tab === 'crest' ? WEAR_CRESTS.map(([k, n, p, col]) => ({ id: 'crest:' + k, key: k, name: n, price: p, col }))
  : [{ id: 'aura:off', key: 'off', name: 'Sans aura', price: 0 }, { id: 'aura:on', key: 'on', name: 'Aura dorée', price: WEAR_AURA }];
const wrWorn = it => it.id.startsWith('hat:') ? (wear().hat || 'none') === it.key : it.id.startsWith('crest:') ? (wear().crest || 'or') === it.key : (it.key === 'on') === !!wear().aura;
// lock : objet gagné ailleurs (« story » : en finissant le mode histoire), jamais en vente
const wrOwn = it => it.lock ? wearOwns(it.id) : it.price === 0 || wearOwns(it.id);
// La tenue montrée : celle portée, avec l'objet essayé par-dessus
function wrLook(it) {
  const w = wear(), look = { costume: wearHat(), crest: wearCrest(), aura: !!w.aura };
  if (!it) return look;
  if (it.id.startsWith('hat:')) look.costume = it.key === 'none' ? null : it.key;
  else if (it.id.startsWith('crest:')) look.crest = it.key === 'or' ? null : it.col;
  else look.aura = it.key === 'on';
  return look;
}
function openWardrobe() { Snd.init(); WR.sel = null; show('wardrobe'); screens.wardrobe.scrollTop = 0; wrRender(); }
function wrRender() {
  $('#wrBank').textContent = (meta.bank || 0).toLocaleString(IS_EN ? 'en-US' : 'fr-FR');
  $('#wrTabs').querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === WR.tab));
  const box = $('#wrTiles');
  box.innerHTML = wrItems().map((it, i) => {
    const own = wrOwn(it), worn = wrWorn(it), poor = !own && (meta.bank || 0) < it.price;
    const st = worn ? '<span class="wst worn">' + T('✓ Porté') + '</span>' : own ? '<span class="wst own">' + T('À toi') + '</span>' : it.lock ? '<span class="wst poor">' + T('🔒 Histoire') + '</span>' : '<span class="wst ' + (poor ? 'poor' : 'buy') + '">' + COIN + it.price.toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + '</span>';
    return '<button class="wtile' + (worn ? ' worn' : '') + (poor ? ' poor' : '') + (WR.sel && WR.sel.id === it.id ? ' sel' : '') + '" type="button" data-i="' + i + '"><canvas></canvas><b>' + T(it.name) + '</b>' + st + '</button>';
  }).join('');
  box.querySelectorAll('.wtile').forEach(b => {
    const it = wrItems()[+b.dataset.i], look = WR.tab === 'aura' ? wrLook(it) : Object.assign(wrLook(null), WR.tab === 'hat' ? { costume: it.key === 'none' ? null : it.key } : { crest: it.key === 'or' ? null : it.col });
    drawYglouHead(prepMini(b.querySelector('canvas'), 64, 64), 64, look);
    b.addEventListener('click', () => { if (it.lock && !wrOwn(it)) { Snd.play('no'); hint(T('À gagner en finissant le mode histoire « La flamme de Braise » !'), 2400); return; } Snd.play('build'); WR.sel = wrWorn(it) ? null : it; wrRender(); });
  });
  // Objet essayé : nom, prix, et le bon bouton (acheter, porter, enlever)
  const sel = WR.sel, p = $('#wrSel');
  p.hidden = !sel;
  if (sel) {
    const own = wrOwn(sel), poor = (meta.bank || 0) < sel.price;
    $('#wrSelName').textContent = T(sel.name);
    $('#wrSelPrice').innerHTML = own ? T('À toi') : COIN + sel.price.toLocaleString(IS_EN ? 'en-US' : 'fr-FR');
    const buy = $('#wrBuy');
    buy.innerHTML = own ? T('Porter') : T('Acheter ') + COIN + sel.price.toLocaleString(IS_EN ? 'en-US' : 'fr-FR');
    buy.disabled = !own && poor;
    $('#wrPoor').hidden = own || !poor;
    if (!own && poor) $('#wrPoor').textContent = T('Il manque ') + (sel.price - (meta.bank || 0)).toLocaleString(IS_EN ? 'en-US' : 'fr-FR') + T(' or : gagne des parties et réussis les défis du jour !');
  }
}
function wrPut(it) {
  const w = wear();
  if (it.id.startsWith('hat:')) w.hat = it.key === 'none' ? null : it.key;
  else if (it.id.startsWith('crest:')) w.crest = it.key === 'or' ? null : it.key;
  else w.aura = it.key === 'on';
}
$('#wrBuy').addEventListener('click', () => {
  const it = WR.sel; if (!it) return;
  if (!wrOwn(it)) {
    if ((meta.bank || 0) < it.price) { Snd.play('no'); return; }
    meta.bank -= it.price; wear().own.push(it.id); Snd.play('win'); hint(T('Nouveau ! ') + T(it.name), 1600);
  } else Snd.play('up');
  wrPut(it); saveMeta(); WR.sel = null; wrRender();
  if (typeof FR !== 'undefined') FR.sent = ''; // les amis verront la nouvelle tenue à la prochaine synchro
});
$('#wrCancel').addEventListener('click', () => { WR.sel = null; wrRender(); });
$('#wrTabs').addEventListener('click', ev => { const b = ev.target.closest('[data-t]'); if (!b) return; WR.tab = b.dataset.t; WR.sel = null; wrRender(); });
$('#wrBack').addEventListener('click', () => { WR.sel = null; openProfile(); });
$('#prWardrobe').addEventListener('click', openWardrobe);
$('#prCv').addEventListener('click', openWardrobe); // toucher Yglou ouvre aussi la garde-robe
// Aperçu animé (appelé par la boucle de la mascotte)
function wardrobeTick(t) {
  if (curScreen !== 'wardrobe') return;
  const look = wrLook(WR.sel), cv = $('#wrPrev');
  paintYglou(cv, 200, 210, (t % 5) < 0.5 ? 'wink' : 'happy', t, { noConfetti: true, costume: look.costume, crest: look.crest, aura: look.aura, top: 0.1 });
}
