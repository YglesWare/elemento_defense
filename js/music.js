// Élémento Defense : musique d'ambiance, composée et jouée par le navigateur (aucun fichier audio, marche hors ligne).
// 4 morceaux : menus, partie calme, tension (moitié des vies perdue ou Kaiju en jeu), danger (3/4 des vies perdues).
// La partie et la tension sont composées au fil de l'eau (« gen ») : tonalité, tempo, accords et mélodie tirés au sort,
// jamais deux fois pareil, et des silences entre les morceaux pour ne pas fatiguer (comme dans Minecraft).
// Les instruments sont fabriqués par le navigateur (piano électrique en FM, cordes pincées en Karplus-Strong, marimba,
// flûte, célesta, nappe de cordes, basse ronde), avec une réverbération et un filtre qui adoucit les aigus.
'use strict';

// Mélodies : 16 notes par mesure, en demi-tons au-dessus de la tonique. « . » = silence, « - » = note tenue.
const TRACKS = {
  // Menu : ambiance douce et posée (nappe de cordes, harpe espacée, piano électrique, pas de batterie)
  menu: {
    bpm: 76, root: 55, vol: 0.65, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 9]],
    mel: ['7 - - - - - - - 4 - - - - - - -', '0 - - - - - - - 4 - - - 2 - - -', '5 - - - - - - - 9 - - - 7 - - -', '2 - - - - - - - - - - - . . . .'],
    bass: 'r...............', kick: '................', snare: '................', hat: '................', arp: true, arpEvery: 2,
  },
  // Partie : composée au fil de l'eau, avec l'ambiance du biome ou de l'événement de la carte (voir GEN_MOOD)
  level: { gen: 'biome' },
  tension: { gen: 'tension' },
  danger: {
    bpm: 144, root: 52, chords: [[0, 3, 7], [0, 3, 7], [8, 12, 15], [7, 11, 14]],
    mel: ['12 - 11 - 12 - 11 - 12 - 11 - 12 - 11 -', '12 - 11 - 12 - 11 - 12 - 11 - 12 - 11 -', '8 - 7 - 8 - 7 - 8 - 7 - 8 - 7 -', '7 - - - 11 - - - 14 - - - 11 - - -'],
    bass: 'r.r.r.r.r.r.r.r.', kick: 'x.x.....x.x.....', snare: '....x.......x...', hat: 'x...x...x...x...', arp: false,
  },
};
// Prépare chaque mélodie : pour chaque pas, la note qui démarre et sa durée en pas
for (const k in TRACKS) {
  if (TRACKS[k].gen) continue;
  TRACKS[k].notes = TRACKS[k].mel.map(bar => {
    const tk = bar.trim().split(/\s+/), out = new Array(16).fill(null);
    for (let i = 0; i < 16; i++) {
      if (tk[i] === '.' || tk[i] === '-' || tk[i] == null) continue;
      let d = 1; while (tk[i + d] === '-') d++;
      out[i] = { n: +tk[i], d };
    }
    return out;
  });
}
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

// ---------- Musique composée au fil de l'eau ----------
// Modes : accords (demi-tons au-dessus de la tonique), enchaînements possibles et gamme de la mélodie
const GEN_CH = {
  major: { I: [0, 4, 7, 11], IV: [5, 9, 12, 16], vi: [-3, 0, 4, 7], ii: [2, 5, 9, 12], V: [7, 12, 14], start: 'I', end: 'I', scale: [0, 2, 4, 7, 9],
    next: { I: ['IV', 'vi', 'ii', 'IV'], IV: ['I', 'V', 'ii', 'I'], vi: ['IV', 'ii', 'V'], ii: ['V', 'IV'], V: ['I', 'vi', 'I'] } },
  lydian: { I: [0, 4, 7, 11], II: [2, 6, 9, 14], vi: [-3, 0, 4, 7], iii: [4, 7, 11, 14], start: 'I', end: 'I', scale: [0, 2, 4, 6, 7, 9, 11],
    next: { I: ['II', 'vi', 'iii'], II: ['I', 'iii', 'I'], vi: ['II', 'I'], iii: ['vi', 'II'] } },
  mixo: { I: [0, 4, 7], VII: [-2, 2, 5], IV: [5, 9, 12], v: [7, 10, 14], start: 'I', end: 'I', scale: [0, 2, 4, 5, 7, 9, 10],
    next: { I: ['VII', 'IV', 'v'], VII: ['IV', 'I'], IV: ['I', 'VII', 'v'], v: ['IV', 'I'] } },
  dorian: { i: [0, 3, 7, 10], IV: [5, 9, 12, 15], VII: [-2, 2, 5, 9], III: [3, 7, 10, 14], start: 'i', end: 'i', scale: [0, 2, 3, 5, 7, 9, 10],
    next: { i: ['IV', 'VII', 'III'], IV: ['i', 'VII'], VII: ['i', 'III', 'IV'], III: ['IV', 'VII'] } },
  minor: { i: [0, 3, 7, 10], VI: [-4, 0, 3, 7], III: [3, 7, 10, 14], VII: [-2, 2, 5, 9], iv: [5, 8, 12, 15], start: 'i', end: 'i', scale: [0, 3, 5, 7, 10],
    next: { i: ['VI', 'iv', 'VII'], VI: ['VII', 'III', 'iv'], III: ['VII', 'VI'], VII: ['i', 'III'], iv: ['i', 'VII', 'VI'] } },
  harmonic: { i: [0, 3, 7], VI: [-4, 0, 3], iv: [5, 8, 12], V: [7, 11, 14], start: 'i', end: 'i', scale: [0, 2, 3, 5, 7, 8, 11],
    next: { i: ['VI', 'iv', 'V'], VI: ['iv', 'V'], iv: ['V', 'i'], V: ['i', 'VI'] } },
  romance: { I: [0, 4, 7, 11], vi: [-3, 0, 4, 7], IV: [-7, -3, 0, 4], iv: [-7, -4, 0, 3], iii: [-8, -5, -1, 2], V: [-5, 0, 2], start: 'I', end: 'I', scale: [0, 2, 4, 7, 9, 11],
    next: { I: ['vi', 'IV', 'iii'], vi: ['IV', 'iii', 'V'], IV: ['iv', 'V', 'I'], iv: ['I'], iii: ['vi', 'IV'], V: ['I', 'vi'] } },
  hijaz: { I: [0, 4, 7], II: [1, 5, 8], iv: [5, 8, 12], vii: [-2, 1, 5], start: 'I', end: 'I', scale: [0, 1, 4, 5, 7, 8, 10],
    next: { I: ['II', 'iv', 'vii'], II: ['I', 'I', 'vii'], iv: ['II', 'I'], vii: ['I', 'II'] } },
};
// Ambiances : mode, tempo, toniques (graves : la mélodie reste entre mi 3 et la 4), longueur d'un morceau et du silence
// qui suit (en mesures), instrument de la mélodie (inst), nappe (padLp : plus sombre si bas ; open = quintes à vide),
// arpège de harpe, célesta de temps en temps (bells), percussions douces (perc : k grosse caisse, t tambour,
// h shaker, s grelots, sur 16 pas ; gong toutes les 4 mesures), écho (en pas) et fond sonore qui continue pendant
// les silences (amb : vagues, vent, grondement, bulles, oiseaux)
const GEN_MOOD = {
  // Prairie : air champêtre à l'ocarina, guitare en arpèges, oiseaux
  prairie: { mode: 'major', bpm: [70, 80], roots: [57, 58, 60, 62], inst: 'ocarina', pick: true, bells: 0.1, amb: 'birds' },
  // Plage : bossa-nova (guitare, basse syncopée, petits clics), vagues
  plage: { mode: 'major', bpm: [72, 82], roots: [57, 59, 60], inst: 'guitar', bossa: true, perc: { r: 'r..r..r...r..r..' }, bells: 0, amb: 'waves' },
  // Marais : clarinette grave et feutrée, bulles et grenouilles
  marais: { mode: 'dorian', bpm: [60, 68], roots: [50, 52], inst: 'clarinet', padLp: 500, bells: 0, amb: 'swamp' },
  foret: { mode: 'mixo', bpm: [72, 82], roots: [55, 57, 60], inst: 'flute', harp: true, amb: 'birds' },
  desert: { mode: 'hijaz', bpm: [78, 88], roots: [55, 57], inst: 'oud', bells: 0, perc: { t: 't..t..t.t.......', h: '......h.......h.' }, amb: 'wind' },
  ile: { mode: 'lydian', bpm: [86, 96], roots: [57, 60, 62], inst: 'marimba', perc: { s: '..s...s...s...s.' }, amb: 'waves' },
  // Canyon : guitare western avec grand écho, trot de cheval, vent
  canyon: { mode: 'dorian', bpm: [70, 80], roots: [52, 54, 57], inst: 'guitar', echo: 4, perc: { w: 'w..w....w..w....', k: 'k.......k.......' }, amb: 'wind' },
  // Volcan : cor grave et tambours façon taiko, grondement
  volcan: { mode: 'minor', bpm: [64, 72], roots: [48, 50, 52], inst: 'horn', padLp: 450, open: true, bells: 0, perc: { t: 't..t..t.t.......', k: 'k.......k.......' }, amb: 'rumble' },
  // Pic : cor des Alpes (le mode lydien est sa gamme), grand écho de montagne, vent
  pic: { mode: 'lydian', bpm: [62, 70], roots: [50, 52, 55], inst: 'horn', bells: 0.1, echo: 5, amb: 'wind' },
  // Toundra : célesta cristallin sur une nappe lente, vent glacé
  toundra: { mode: 'dorian', bpm: [56, 64], roots: [54, 57, 59], inst: 'celesta', bells: 0.2, echo: 5, open: true, amb: 'wind', ambVol: 1.6 },
  // Halloween : valse lente au thérémine sur un orgue, glas toutes les 4 mesures, chouettes ; ouverture : la Toccata de Bach
  halloween: { mode: 'harmonic', bpm: [96, 108], roots: [50, 52], steps: 12, inst: 'theremin', pad: 'organ', waltz: true, toll: true, bells: 0.15, echo: 4, amb: 'owls', tunes: ['toccata'] },
  // Noël : Vive le vent au célesta, grelots de traîneau, basse qui marche, puis des variations
  noel: { mode: 'major', bpm: [100, 112], roots: [57, 60], inst: 'celesta', walk: true, harp: true, bells: 0.2, perc: { s: 's.s.s.s.s.s.s.s.' }, tunes: ['jingle'] },
  // Pâques : Le Printemps de Vivaldi en ouverture, violon, cordes en pizzicato, oiseaux
  paques: { mode: 'major', bpm: [92, 104], roots: [58, 60], inst: 'violin', pizz: true, bells: 0, amb: 'birds', tunes: ['printemps'] },
  // Saint-Valentin : le Canon de Pachelbel en ouverture, violon, piano en arpèges, accords tendres, en 6/8 et lent
  valentin: { mode: 'romance', bpm: [60, 68], roots: [55, 57], steps: 12, inst: 'violin', roll: true, bells: 0, tunes: ['canon'] },
  // Nouvel An chinois : un thème original (Lanternes) en ouverture, koto, gong, tambour
  nouvelan: { mode: 'major', bpm: [88, 100], roots: [57, 60], inst: 'koto', open: true, gong: true, perc: { t: 't.......t...t...' }, tunes: ['lanternes'] },
  // Kaiju : cor menaçant, basse martelée, timbales
  tension: { mode: 'minor', bpm: [96, 106], roots: [50, 52, 54], piece: [16, 16], silence: [0, 0], inst: 'horn', ostinato: true, bells: 0, perc: { t: 't.......t.......' } },
};
for (const k in GEN_MOOD) GEN_MOOD[k] = { piece: [16, 24], silence: [6, 12], vol: 0.65, ...GEN_MOOD[k] };
// Instruments : volume, part envoyée dans la réverbération ; cordes pincées : amortissement et brillance de l'attaque
const INSTS = {
  epiano: { vol: 0.17, rev: 0.35 }, celesta: { vol: 0.09, rev: 0.5 }, marimba: { vol: 0.24, rev: 0.25 }, flute: { vol: 0.11, rev: 0.35 },
  strings: { vol: 0.018, rev: 0.5 }, bass: { vol: 0.12, rev: 0.05 },
  ocarina: { vol: 0.12, rev: 0.35 }, clarinet: { vol: 0.06, rev: 0.35 }, horn: { vol: 0.07, rev: 0.45 }, violin: { vol: 0.06, rev: 0.45 },
  block: { vol: 0.09, rev: 0.15 }, frog: { vol: 0.05, rev: 0.2 }, pizz: { vol: 0.2, rev: 0.35, ks: { decay: 0.99, bright: 0.5, len: 0.6 } },
  theremin: { vol: 0.1, rev: 0.5 }, organ: { vol: 0.035, rev: 0.55 }, cello: { vol: 0.07, rev: 0.4 }, bell: { vol: 0.12, rev: 0.6 }, owl: { vol: 0.05, rev: 0.5 },
  guitar: { vol: 0.26, rev: 0.3, ks: { decay: 0.996, bright: 0.45, len: 1.8 } }, harp: { vol: 0.22, rev: 0.4, ks: { decay: 0.998, bright: 0.3, len: 1.8 } },
  oud: { vol: 0.24, rev: 0.25, ks: { decay: 0.993, bright: 0.65, len: 1.4 } }, koto: { vol: 0.2, rev: 0.35, ks: { decay: 0.995, bright: 0.75, len: 1.6 } },
};
// Airs joués en ouverture d'un morceau (domaine public, sauf Lanternes, composé pour le jeu) (le premier, puis environ une fois sur trois) :
// tonique (midi), puis par mesure : accord et mélodie (même notation que les morceaux écrits, 16 pas par mesure)
const GEN_TUNES = {
  // Bach, Toccata et fugue en ré mineur : le début, à l'orgue, puis une octave plus bas
  toccata: { root: 50, bars: [
    [[0, 7], '19 17 19 - - - - - - - - - . . . .'], [[0, 7], '17 15 14 12 11 - - - - - - - 12 - - -'], [[-1, 2, 5, 8], '11 . 14 . 17 . 20 - - - - - - - - -'],
    [[0, 7], '7 5 7 - - - - - - - - - . . . .'], [[0, 7], '5 3 2 0 -1 - - - - - - - 0 - - -'], [[0, 3, 7], '0 - - - - - - - - - - - . . . .']] },
  // Vivaldi, Le Printemps : le premier thème, puis son écho plus doux
  printemps: { root: 64, bars: [
    [[0, 4, 7], '. . . . . . . . . . . . . . 0 -'], [[0, 4, 7], '4 - 4 - 4 - 2 0 7 - - - - - 0 -'], [[0, 4, 7], '4 - 4 - 4 - 2 0 7 - - - - - - -', 0.55], [[-5, -1, 2], '. . . . . . . . . . . . . . . .']] },
  // Pachelbel, Canon en ré : la basse et les accords célèbres (deux par mesure), la ligne de violon qui descend
  canon: { root: 62, bars: [
    [[[0, 4, 7], [-5, -1, 2]], '4 - - - - - - - 2 - - - - - - -'], [[[-3, 0, 4], [-8, -5, -1]], '0 - - - - - - - -1 - - - - - - -'],
    [[[-7, -3, 0], [0, 4, 7]], '-3 - - - - - - - -5 - - - - - - -'], [[[-7, -3, 0], [-5, -1, 2]], '-3 - - - - - - - -1 - - - - - - -'],
    [[[0, 4, 7], [-5, -1, 2]], '0 - - - - - - - -1 - - - - - - -'], [[[-3, 0, 4], [-8, -5, -1]], '-3 - - - - - - - -5 - - - - - - -'],
    [[[-7, -3, 0], [0, 4, 7]], '-7 - - - - - - - -8 - - - - - - -'], [[[-7, -3, 0], [-5, -1, 2]], '-7 - - - - - - - -10 - - - - - - -']] },
  // Lanternes : thème original pour le Nouvel An chinois, gamme pentatonique, accords en quintes à vide
  lanternes: { root: 57, bars: [
    [[0, 7], '9 - 7 - 9 - 12 - 14 - - - 12 - 9 -'], [[-3, 4], '7 - - - 4 - 7 - 9 - - - - - - -'], [[2, 9], '12 - 9 - 7 - 4 - 2 - 4 - 7 - - -'], [[0, 7], '4 - 2 - 0 - - - - - - - - - - -']] },
  // Vive le vent (Jingle Bells, J. Pierpont, 1857) : le refrain
  jingle: { root: 57, bars: [
    [[0, 4, 7], '4 - - - 4 - - - 4 - - - - - - -'], [[0, 4, 7], '4 - - - 4 - - - 4 - - - - - - -'], [[0, 4, 7], '4 - - - 7 - - - 0 - - - - - 2 -'], [[0, 4, 7], '4 - - - - - - - - - - - - - - -'],
    [[5, 9, 12], '5 - - - 5 - - - 5 - - - - - 5 -'], [[0, 4, 7], '5 - - - 4 - - - 4 - - - 4 - 4 -'], [[2, 6, 9, 12], '4 - - - 2 - - - 2 - - - 4 - - -'], [[7, 11, 14], '2 - - - - - - - 7 - - - - - - -'],
    [[0, 4, 7], '4 - - - 4 - - - 4 - - - - - - -'], [[0, 4, 7], '4 - - - 4 - - - 4 - - - - - - -'], [[0, 4, 7], '4 - - - 7 - - - 0 - - - - - 2 -'], [[0, 4, 7], '4 - - - - - - - - - - - - - - -'],
    [[5, 9, 12], '5 - - - 5 - - - 5 - - - - - 5 -'], [[0, 4, 7], '5 - - - 4 - - - 4 - - - 4 - 4 -'], [[7, 11, 14, 17], '7 - - - 7 - - - 5 - - - 2 - - -'], [[0, 4, 7], '0 - - - - - - - - - - - - - - -']] },
};
const parseBar = bar => { const tk = bar.trim().split(/\s+/), out = []; for (let i = 0; i < 16; i++) { if (tk[i] === '.' || tk[i] === '-' || tk[i] == null) continue; let d = 1; while (tk[i + d] === '-') d++; out.push({ s: i, n: +tk[i], d }); } return out; };
// Un accord par mesure, ou deux (une par demi-mesure) ; k : volume de la mesure (un écho plus doux)
for (const k in GEN_TUNES) GEN_TUNES[k].bars = GEN_TUNES[k].bars.map(([ch, mel, v]) => ({ chs: Array.isArray(ch[0]) ? ch : [ch], notes: parseBar(mel), k: v || 1 }));
const gPick = a => a[Math.floor(Math.random() * a.length)], gInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const Music = {
  ac: null, out: null, rev: null, revIn: null, timer: 0, step: 0, sub: 0, bar: -1, nextT: 0, track: 'menu', g: null, ks: null, ks: null,
  start() {
    if (this.timer || !Snd.ac) return;
    const ac = this.ac = Snd.ac;
    // Sortie : volume, puis aigus adoucis (étagère −7 dB au-dessus de 2,2 kHz et coupe au-delà de 4,2 kHz)
    this.out = ac.createGain(); this.out.gain.value = 0;
    const shelf = ac.createBiquadFilter(), lp = ac.createBiquadFilter();
    shelf.type = 'highshelf'; shelf.frequency.value = 2200; shelf.gain.value = -7; lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.4;
    this.out.connect(shelf); shelf.connect(lp); lp.connect(ac.destination);
    // Réverbération : réponse de salle fabriquée (bruit qui s'éteint, assombri)
    this.rev = ac.createConvolver(); this.rev.buffer = this.roomIR(2.4); this.revIn = ac.createGain(); this.revIn.gain.value = 1;
    const revOut = ac.createGain(); revOut.gain.value = 0.8; this.revIn.connect(this.rev); this.rev.connect(revOut); revOut.connect(this.out);
    // Écho doux (retard + filtre) pour les ambiances qui le demandent
    const fb = ac.createGain(), elp = ac.createBiquadFilter();
    this.echo = ac.createDelay(1); this.echo.delayTime.value = 0.42; fb.gain.value = 0.3; elp.type = 'lowpass'; elp.frequency.value = 1200;
    this.echo.connect(elp); elp.connect(fb); fb.connect(this.echo); elp.connect(this.out);
    this.echoIn = ac.createGain(); this.echoIn.gain.value = 0.35; this.echoIn.connect(this.echo);
    this.ks = new Map();
    this.nextT = ac.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 25);
  },
  roomIR(sec) {
    const ac = this.ac, n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let y = 0; for (let i = 0; i < n; i++) { y += 0.3 * ((Math.random() * 2 - 1) - y); d[i] = y * Math.pow(1 - i / n, 3); } }
    return b;
  },
  want() {
    if (G && !G.over && !G.demo) {
      const ratio = G.lives / (G.startLives || 20);
      if (ratio <= 0.25) return 'danger';
      if (ratio <= 0.5 || G.enemies.some(e => ETYPES[e.type].boss)) return 'tension';
      return 'level';
    }
    return 'menu';
  },
  tick() {
    const ac = this.ac; if (!ac || ac.state !== 'running') return;
    // Jeu en arrière-plan ou sans le focus (autre onglet, autre fenêtre, appli quittée) : la musique se tait
    const away = document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus() && window.parent === window);
    const on = opts.music !== false && !away, inGame = G && !G.over;
    const duck = inGame && (G.paused || curScreen !== 'game') ? 0.45 : 1;
    const tv = TRACKS[this.track].gen ? (this.g ? this.g.M.vol : 0.8) : TRACKS[this.track].vol || 1;
    this.out.gain.setTargetAtTime(on ? 0.5 * duck * tv : 0, ac.currentTime, away ? 0.05 : 0.25);
    if (this.nextT < ac.currentTime - 0.25) this.nextT = ac.currentTime + 0.05;
    if (!on) { this.nextT = Math.max(this.nextT, ac.currentTime); return; }
    while (this.nextT < ac.currentTime + 0.15) {
      if (this.sub === 0) {
        const nt = this.want(); this.bar = nt === this.track ? this.bar + 1 : 0;
        if (nt !== this.track) this.g = null;
        this.track = nt; const T = TRACKS[nt];
        if (T.gen) this.genBar(T.gen === 'biome' ? this.mood() : GEN_MOOD[T.gen], this.nextT);
        else this.echo.delayTime.setValueAtTime(T.echoSteps ? T.echoSteps * 60 / T.bpm / 4 : 0.42, this.nextT);
      }
      const T = TRACKS[this.track];
      if (!T.gen) this.play(T, this.sub, this.bar, this.nextT);
      this.nextT += 60 / (T.gen ? this.g.bpm : T.bpm) / 4; this.step++;
      if (++this.sub >= (T.gen ? this.g.steps || 16 : 16)) this.sub = 0;
    }
  },
  play(T, step, nb, t) {
    const s = step % 16, bar = Math.max(0, nb) % T.chords.length, sd = 60 / T.bpm / 4, ch = T.chords[bar];
    if (s === 0) for (const c of ch) this.inst('strings', T.root - 12 + c, t, sd * 16, 1);
    if (T.bass[s] !== '.') this.inst('bass', this.bassNote(T.root + ch[0]), t, sd * (T.bass === 'r...............' ? 14 : 1.6), 1);
    const ev = T.arpEvery || 1;
    if (T.arp && s % ev === 0) this.inst('harp', T.root - 12 + ch[(s / ev) % ch.length], t, sd * ev, 0.6, false);
    const n = T.notes[bar][s];
    if (n) this.inst('epiano', T.root + n.n, t, sd * n.d * 0.92, 1);
    if (T.kick[s] === 'x') this.kick(t, 0.35);
    if (T.snare[s] === 'x') this.noise(t, 0.12, 1500, 'bandpass', 0.12);
    if (T.hat[s] === 'x') this.noise(t, 0.05, 3500, 'bandpass', 0.03);
  },
  // Basse : la fondamentale dans l'octave grave (mi 1 à mi 2), ses harmoniques la rendent audible sur un téléphone
  bassNote(m) { m -= 24; while (m < 40) m += 12; while (m > 52) m -= 12; return m; },
  // Un nouveau morceau : tonique, tempo et longueur tirés au sort
  genPiece(M) {
    const old = this.g, first = !old || old.M !== M;
    const tune = M.tunes && (first || Math.random() < 1 / 3) ? GEN_TUNES[gPick(M.tunes)] : null;
    this.g = { M, root: tune ? tune.root : gPick(M.roots.filter(r => !old || r !== old.root)), bpm: gInt(M.bpm[0], M.bpm[1]), len: gInt(M.piece[0], M.piece[1]), bar: 0, chord: null,
      phrase: 4, pos: 0, rest: 0, motif: null, last: 4, silence: 0, tune, steps: tune ? 16 : M.steps || 16 };
    if (tune) this.g.len = Math.max(this.g.len, tune.bars.length + 8);
  },
  // L'ambiance de la carte en cours : son événement, sinon son biome
  mood() { const m = G && !G.demo && MAPS[G.map]; return (m && GEN_MOOD[m.season || m.wid || m.id]) || GEN_MOOD.prairie; },
  // Une mesure : accords toutes les 2 mesures, mélodie en phrases de 4 mesures (la 3e reprend la 1re, un peu changée),
  // respirations avec quelques clochettes, et un silence (juste le fond sonore) après chaque morceau
  genBar(M, t) {
    if (!this.g || this.g.M !== M) this.genPiece(M);
    const g = this.g, C = GEN_CH[M.mode], sd = 60 / g.bpm / 4, TB = g.tune && g.tune.bars[g.bar];
    if (g.tune && !TB) g.steps = M.steps || 16;
    const st = g.steps;
    this.echo.delayTime.setValueAtTime(Math.min(0.95, (M.echo || 3) * sd), t);
    if (M.amb && g.bar % 2 === 0) this.amb(M, t, sd * st * 2);
    if (g.silence > 0) { if (--g.silence === 0) this.genPiece(M); else if (M.amb && g.silence % 2) this.amb(M, t, sd * st * 2); return; }
    const last = g.bar >= g.len - 1, pad = M.pad || 'strings';
    let ch;
    if (TB) {
      // Air connu : son accord à chaque mesure, et sa mélodie
      const hl = st / TB.chs.length;
      TB.chs.forEach((c0, h) => {
        for (const c of c0) this.inst(pad, g.root - 12 + c, t + h * hl * sd, sd * hl, 1, true, M.padLp);
        if (!M.walk && !M.waltz && !M.bossa && !M.ostinato) this.inst('bass', this.bassNote(g.root + c0[0]), t + h * hl * sd, sd * (hl - 1), 1);
      });
      ch = TB.chs[TB.chs.length - 1];
      for (const n of TB.notes) this.inst(g.tune === GEN_TUNES.toccata ? 'organ' : M.inst, g.root + n.n, t + n.s * sd, sd * n.d * 0.95, (g.tune === GEN_TUNES.toccata ? 1.6 : 1) * TB.k, true);
      g.last = 4; g.phrase = 0; g.rest = 1;
    } else {
      if (g.bar % 2 === 0 || last || (g.tune && g.bar === g.tune.bars.length)) {
        g.chord = g.bar === 0 || !g.chord ? C.start : g.bar >= g.len - 2 ? C.end : gPick(C.next[g.chord]);
        const c0 = C[g.chord], len = last ? st * 1.5 : st * 2;
        for (const c of M.open ? [c0[0], c0[0] + 7] : c0) this.inst(pad, g.root - 12 + c, t, sd * len, M.open ? 1.4 : 1, true, M.padLp);
        if (!M.walk && !M.waltz && !M.bossa && !M.ostinato) this.inst('bass', this.bassNote(g.root + c0[0]), t, sd * (len - 4), 1);
        if (M.gong && g.bar % 4 === 0) this.gong(midiHz(g.root - 12 + c0[0]), t);
      }
      ch = C[g.chord];
    }
    // Accompagnements des fêtes : valse (basse puis deux accords pincés), basse qui marche, harpe qui roule, glas, cœur
    if (M.waltz && !last && !TB) { this.inst('bass', this.bassNote(g.root + ch[0]), t, sd * 3, 1.1); for (const q of [4, 8]) ch.forEach(c => this.inst('harp', g.root - 12 + c, t + q * sd, sd * 2, 0.35)); }
    if (M.walk && !last) for (let q = 0; q < 4; q++) this.inst('bass', this.bassNote(g.root + ch[0] + [0, 7, 12, 7][q]), t + q * 4 * sd, sd * 3.5, 1);
    if (M.roll && !TB && !last) [0, 1, 2, 3, 2, 1].forEach((k, i) => this.inst('epiano', g.root - 12 + ch[k % ch.length] + (k >= ch.length ? 12 : 0), t + i * 2 * sd, sd * 4, 0.4));
    if (M.roll && TB) [0, 1, 2, 3, 2, 1, 0, 1].forEach((k, i) => { const c0 = TB.chs[Math.floor(i / 4) % TB.chs.length]; this.inst('epiano', g.root - 12 + c0[k % c0.length] + (k >= c0.length ? 12 : 0), t + i * 2 * sd, sd * 3, 0.35); });
    if (M.pick && !last) [0, 2, 1, 2, 0, 2, 1, 2].forEach((k, i) => this.inst('guitar', g.root - 12 + ch[k % ch.length] + (i % 4 === 0 ? -12 : 0), t + i * 2 * sd, sd * 2, 0.35));
    if (M.bossa && !last) for (const [q, iv] of [[0, 0], [6, 0], [8, 7], [14, 7]]) this.inst('bass', this.bassNote(g.root + ch[0] + iv), t + q * sd, sd * 1.8, 1);
    if (M.pizz && !last) for (let q = 0; q < st; q += 4) this.inst('pizz', g.root - 12 + ch[(q / 4) % ch.length], t + q * sd, sd, 0.6);
    if (M.ostinato && !last) for (let q = 0; q < st; q += 2) this.inst('bass', this.bassNote(g.root + ch[0]) + (q % 8 === 6 ? 12 : 0), t + q * sd, sd * 1.2, 0.9);
    if (M.toll && g.bar % 4 === 0) this.inst('bell', g.root - 12, t, sd * st, 1);
    if (M.harp && !last && !TB) ch.forEach((c, k) => this.inst('harp', g.root - 12 + c, t + (8 + k * 2) * sd, sd * 3, 0.5, false));
    if (TB) {} else if (!last && g.phrase > 0) {
      const notes = g.pos === 2 && g.motif ? this.genVary(g.motif, C, ch) : this.genMelody(C, ch);
      if (g.pos === 0) g.motif = notes;
      for (const n of notes) this.inst(M.inst, g.root + n.n, t + n.s * sd, sd * n.d * 0.95, 1, true);
      g.pos++; if (--g.phrase === 0) g.rest = gInt(1, 3);
    } else if (!last) {
      const pb = M.bells ?? 0.15;
      for (let q = 0; q < st; q += 4) if (Math.random() < pb) { let m = g.root + 12 + gPick(ch) % 12; if (m > 74) m -= 12; this.inst('celesta', m, t + q * sd, sd * 6, 0.7, true); }
      if (--g.rest <= 0) { g.phrase = 4; g.pos = 0; }
    }
    if (M.perc && !last) for (let q = 0; q < st; q++) {
      const tq = t + q * sd, P = M.perc;
      if (P.k && P.k[q] === 'k') this.kick(tq, 0.25);
      if (P.t && P.t[q] === 't') this.tom(tq, 0.16);
      if (P.h && P.h[q] === 'h') this.noise(tq, 0.06, 3500, 'bandpass', 0.025);
      if (P.s && P.s[q] === 's') this.noise(tq, 0.08, 5000, 'bandpass', 0.022);
      if (P.w && P.w[q] === 'w') this.inst('block', q % 8 ? 79 : 74, tq, 0.06, 1);
      if (P.r && P.r[q] === 'r') this.noise(tq, 0.03, 1800, 'bandpass', 0.05);
    }
    if (++g.bar >= g.len) { const s = gInt(M.silence[0], M.silence[1]); if (s) g.silence = s; else this.genPiece(M); }
  },
  // Fond sonore (sur 2 mesures) : vagues, vent, grondement du volcan, bulles du marais, oiseaux
  amb(M, t, dur) {
    const v = M.ambVol || 1;
    if (M.amb === 'waves') { this.swell(t, dur * 0.5, 500, 'lowpass', 0.05 * v); this.swell(t + dur * 0.5, dur * 0.5, 650, 'lowpass', 0.04 * v); }
    else if (M.amb === 'wind') this.swell(t, dur, 800 + Math.random() * 600, 'bandpass', 0.03 * v);
    else if (M.amb === 'rumble') this.swell(t, dur, 140, 'lowpass', 0.08 * v);
    else if (M.amb === 'bubbles') { for (let k = gInt(2, 5); k > 0; k--) this.blip(t + Math.random() * dur, 180 + Math.random() * 220, 0.025 * v); }
    else if (M.amb === 'swamp') { for (let k = gInt(1, 3); k > 0; k--) this.blip(t + Math.random() * dur, 180 + Math.random() * 220, 0.022 * v); if (Math.random() < 0.6) { const t0 = t + Math.random() * dur * 0.8; for (let k = 0; k < gInt(1, 3); k++) this.inst('frog', 0, t0 + k * 0.32, 0.22, 1); } }
    else if (M.amb === 'owls') { this.swell(t, dur, 700, 'bandpass', 0.02 * v); if (Math.random() < 0.4) { const t0 = t + Math.random() * dur * 0.7; this.inst('owl', 0, t0, 0.3, 1); this.inst('owl', 0, t0 + 0.45, 0.6, 1); } }
    else if (M.amb === 'birds') { if (Math.random() < 0.45) { const t0 = t + Math.random() * dur * 0.8, f = 900 + Math.random() * 400; for (let k = 0; k < gInt(2, 3); k++) this.blip(t0 + k * 0.13, f, 0.005 * v, 1.2, 0.08); } }
  },
  swell(t, dur, f, type, vol) {
    if (!Snd.noise) return;
    const ac = this.ac, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = Snd.noise; s.loop = true; fl.type = type; fl.frequency.value = f; if (type === 'bandpass') fl.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t); s.stop(t + dur + 0.05);
  },
  // Petit son qui glisse vers le haut (bulle, ou pépiement d'oiseau quand il est aigu et court)
  blip(t, f, vol, up = 2, dur = 0.12) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * up, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  },
  tom(t, vol) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(95, t + 0.15);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.25);
  },
  // Gong : partiels inharmoniques qui s'éteignent lentement
  gong(f, t) { for (const [m, v] of [[1, 0.05], [2.76, 0.02], [5.4, 0.01]]) this.voice('sine', f * m, t, 3.5, v, 0.005); },
  // Notes possibles de la mélodie : dans le grave, de la tierce sous la tonique à la neuvième au-dessus (l'aigu fatigue)
  genTones(C) { const out = []; for (const o of [-12, 0, 12]) for (const x of C.scale) if (x + o >= -4 && x + o <= 14) out.push(x + o); return out; },
  // Mélodie d'une mesure : notes de la gamme, par petits pas, notes de l'accord sur les temps forts
  genMelody(C, ch) {
    const g = this.g, tones = this.genTones(C);
    const inCh = n => ch.some(c => ((n - c) % 12 + 12) % 12 === 0), out = [];
    let free = 0;
    const st = g.steps || 16, half = st === 12 ? 6 : 8;
    for (let s = 0; s < st; s += 2) {
      const p = s === 0 ? 0.55 : s === half ? 0.5 : s % (st === 12 ? 6 : 4) === 0 ? 0.3 : 0.15;
      if (s < free || Math.random() > p) continue;
      let near = tones.filter(n => Math.abs(n - g.last) <= 5 && n !== g.last);
      if (s % half === 0) { const c = near.filter(inCh); if (c.length) near = c; }
      const n = near.length ? gPick(near) : g.last, d = Math.min(st - s, gPick([2, 2, 4, 4, 6]));
      out.push({ s, n, d }); free = s + d; g.last = n;
    }
    if (!out.length) { const n = tones.find(inCh) ?? 0; out.push({ s: 0, n, d: 6 }); g.last = n; }
    return out;
  },
  // Reprise du motif : même rythme, quelques notes déplacées, la dernière posée sur l'accord
  genVary(motif, C, ch) {
    const tones = this.genTones(C);
    const out = motif.map(m => { if (Math.random() > 0.3) return { ...m }; const i = tones.indexOf(m.n), j = Math.max(0, Math.min(tones.length - 1, i + gPick([-1, 1]))); return { ...m, n: tones[j] }; });
    const end = out[out.length - 1], cands = tones.filter(n => ch.some(c => ((n - c) % 12 + 12) % 12 === 0));
    if (cands.length) end.n = cands.reduce((a, b) => Math.abs(b - end.n) < Math.abs(a - end.n) ? b : a);
    this.g.last = end.n;
    return out;
  },
  // Joue une note (midi m) sur un instrument ; k : volume relatif ; echo : envoi dans l'écho ; lp : filtre de la nappe
  inst(name, m, t, dur, k = 1, echo = false, lp) {
    const I = INSTS[name] || INSTS.epiano, ac = this.ac, f = midiHz(m), vol = I.vol * k, out = ac.createGain();
    out.connect(this.out);
    const send = ac.createGain(); send.gain.value = I.rev; out.connect(send); send.connect(this.revIn);
    if (echo && this.echoIn) out.connect(this.echoIn);
    const osc = (type, fr, det = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(fr, t); if (det) o.detune.value = det; return o; };
    const env = (g, att, peak, end) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(0.0001, end); };
    if (I.ks) {
      // Corde pincée (Karplus-Strong), calculée une fois par note puis gardée
      const src = ac.createBufferSource(), g = ac.createGain(), end = t + Math.min(I.ks.len, Math.max(dur, 0.25) + 0.9);
      src.buffer = this.ksBuf(name, m); g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, end - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, end);
      src.connect(g); g.connect(out); src.start(t); src.stop(end + 0.02); return;
    }
    if (name === 'epiano' || name === 'celesta') {
      // FM : un modulateur qui s'éteint vite donne l'attaque du piano électrique (ou du célesta, plus cristallin)
      const ratio = name === 'celesta' ? 4 : 1, idx = name === 'celesta' ? 0.9 : 1.6, tail = name === 'celesta' ? 1.6 : 1.2;
      const car = osc('sine', f), mod = osc('sine', f * ratio), mg = ac.createGain(), g = ac.createGain(), end = t + Math.max(dur, 0.3) + tail;
      mg.gain.setValueAtTime(f * idx, t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.5);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, end);
      car.start(t); mod.start(t); car.stop(end + 0.05); mod.stop(end + 0.05); return;
    }
    if (name === 'marimba') {
      // Lame de bois : la fondamentale, et un partiel 4 fois plus haut qui s'éteint tout de suite
      const end = t + (m < 60 ? 1 : 0.7);
      for (const [mul, a, d] of [[1, 1, end], [4, 0.25, t + 0.06]]) { const o = osc('sine', f * mul), g = ac.createGain(); env(g, 0.003, vol * a, d); o.connect(g); g.connect(out); o.start(t); o.stop(d + 0.02); }
      return;
    }
    if (name === 'flute') {
      // Flûte : son doux, souffle léger et vibrato qui arrive après l'attaque
      const o = osc('sine', f), o2 = osc('triangle', f), g2 = ac.createGain(), g = ac.createGain(), lfo = osc('sine', 5), lg = ac.createGain(), end = t + dur + 0.25;
      g2.gain.value = 0.25; o2.connect(g2); g2.connect(g); o.connect(g); g.connect(out);
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + 0.25); lg.gain.linearRampToValueAtTime(f * 0.005, t + 0.6); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.09); g.gain.setValueAtTime(vol, t + Math.max(0.1, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end);
      if (Snd.noise) { const nz = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain(); nz.buffer = Snd.noise; nz.loop = true; bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.5; env(ng, 0.05, vol * 0.08, end); nz.connect(bp); bp.connect(ng); ng.connect(out); nz.start(t); nz.stop(end + 0.02); }
      for (const x of [o, o2, lfo]) { x.start(t); x.stop(end + 0.05); }
      return;
    }
    if (name === 'ocarina' || name === 'clarinet' || name === 'horn' || name === 'violin') {
      // Vents et cordes frottées : une source, un filtre qui donne le timbre, un vibrato qui arrive après l'attaque
      const V = { ocarina: ['sine', 0, 0.04, 0.003], clarinet: ['square', 2.5, 0.05, 0.003], horn: ['sawtooth', 2.2, 0.09, 0.002], violin: ['sawtooth', 5, 0.12, 0.007] }[name];
      const o = osc(V[0], f), g = ac.createGain(), lfo = osc('sine', name === 'violin' ? 5.5 : 5), lg = ac.createGain(), end = t + dur + 0.3;
      let node = o;
      if (V[1]) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.6; fl.frequency.setValueAtTime(f * (name === 'horn' ? 1.2 : V[1]), t); if (name === 'horn') fl.frequency.exponentialRampToValueAtTime(Math.min(1600, f * V[1]), t + 0.15); else fl.frequency.value = Math.min(2400, f * V[1]); o.connect(fl); node = fl; }
      if (name === 'ocarina') { const o2 = osc('sine', f * 2), g2 = ac.createGain(); g2.gain.value = 0.08; o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(end + 0.05); }
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + 0.2); lg.gain.linearRampToValueAtTime(f * V[3], t + 0.6); lfo.connect(lg); lg.connect(o.frequency);
      node.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + V[2]); g.gain.setValueAtTime(vol, t + Math.max(V[2] + 0.01, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const x of [o, lfo]) { x.start(t); x.stop(end + 0.05); }
      return;
    }
    if (name === 'block') {
      // Wood-block : petit « toc » de bois
      const o = osc('sine', f), g = ac.createGain(); env(g, 0.002, vol, t + 0.06); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08);
      return;
    }
    if (name === 'frog') {
      // Grenouille : son grave et râpeux qui vibre vite
      const o = osc('square', 130), fl = ac.createBiquadFilter(), g = ac.createGain(), am = osc('sine', 28), ag = ac.createGain(), end = t + dur;
      fl.type = 'lowpass'; fl.frequency.value = 500; ag.gain.value = vol * 0.8; am.connect(ag); ag.connect(g.gain);
      env(g, 0.02, vol, end); o.connect(fl); fl.connect(g); g.connect(out);
      for (const x of [o, am]) { x.start(t); x.stop(end + 0.02); }
      return;
    }
    if (name === 'theremin') {
      // Thérémine : son pur qui glisse d'une note à l'autre, avec un large vibrato (les films de fantômes)
      const o = osc('sine', this.thF || f), g = ac.createGain(), lfo = osc('sine', 5.5), lg = ac.createGain(), end = t + dur + 0.3;
      o.frequency.setValueAtTime(this.thF || f, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12); this.thF = f;
      lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.12); g.gain.setValueAtTime(vol, t + Math.max(0.13, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const x of [o, lfo]) { x.start(t); x.stop(end + 0.05); }
      return;
    }
    if (name === 'organ') {
      // Orgue : quelques harmoniques comme des tirettes, avec un léger tremblement
      const g = ac.createGain(), trem = osc('sine', 5.5), tg = ac.createGain(), end = t + dur + 0.25;
      tg.gain.value = vol * 0.15; trem.connect(tg); tg.connect(g.gain);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.06); g.gain.setValueAtTime(vol, t + Math.max(0.07, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end); g.connect(out);
      for (const [mul, a] of [[0.5, 0.6], [1, 1], [2, 0.5], [3, 0.25], [4, 0.12]]) { const o = osc('sine', f * mul), og = ac.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(end + 0.05); }
      trem.start(t); trem.stop(end + 0.05);
      return;
    }
    if (name === 'cello') {
      // Violoncelle : archet doux (dent de scie filtrée), vibrato qui arrive après l'attaque
      const o = osc('sawtooth', f), fl = ac.createBiquadFilter(), g = ac.createGain(), lfo = osc('sine', 5), lg = ac.createGain(), end = t + dur + 0.35;
      fl.type = 'lowpass'; fl.frequency.value = Math.min(1400, f * 4); fl.Q.value = 0.7; o.connect(fl); fl.connect(g); g.connect(out);
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + 0.2); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.6); lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.15); g.gain.setValueAtTime(vol, t + Math.max(0.16, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const x of [o, lfo]) { x.start(t); x.stop(end + 0.05); }
      return;
    }
    if (name === 'bell') {
      // Glas : cloche grave aux partiels inharmoniques, qui résonne longtemps
      const end = t + 4;
      for (const [mul, a, d] of [[1, 1, 4], [2.0, 0.5, 2.5], [2.4, 0.35, 2], [3.0, 0.2, 1.5], [4.2, 0.12, 1]]) { const o = osc('sine', f * mul), g = ac.createGain(); env(g, 0.004, vol * a, t + d); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.02); }
      return;
    }
    if (name === 'owl') {
      // Chouette : « hou » grave qui glisse un peu vers le bas
      const o = osc('sine', 420), g = ac.createGain(), end = t + dur;
      o.frequency.exponentialRampToValueAtTime(360, end); env(g, 0.05, vol, end); o.connect(g); g.connect(out); o.start(t); o.stop(end + 0.02);
      return;
    }
    if (name === 'strings') {
      // Nappe de cordes : trois dents de scie légèrement désaccordées, filtrées, qui montent et descendent lentement
      const fl = ac.createBiquadFilter(), g = ac.createGain(), att = Math.min(1.2, dur * 0.3), end = t + dur + 1.2;
      fl.type = 'lowpass'; fl.frequency.value = lp || Math.min(1100, f * 3); fl.Q.value = 0.3; fl.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.setValueAtTime(vol, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const d of [-8, 0, 8]) { const o = osc('sawtooth', f, d); o.connect(fl); o.start(t); o.stop(end + 0.05); }
      return;
    }
    if (name === 'bass') {
      // Basse ronde : fondamentale et deux harmoniques (que les petits haut-parleurs savent jouer)
      const fl = ac.createBiquadFilter(), g = ac.createGain(), end = t + dur + 0.3;
      fl.type = 'lowpass'; fl.frequency.value = 700; fl.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(vol * 0.7, t + 0.4); g.gain.setValueAtTime(vol * 0.7, t + Math.max(0.4, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const [mul, a] of [[1, 1], [2, 0.45], [3, 0.18]]) { const o = osc('sine', f * mul), og = ac.createGain(); og.gain.value = a; o.connect(og); og.connect(fl); o.start(t); o.stop(end + 0.05); }
    }
  },
  // Corde pincée : bruit filtré qui tourne dans une boucle de la longueur d'une période et s'amortit
  ksBuf(name, m) {
    const key = name + m; let b = this.ks.get(key); if (b) return b;
    const K = INSTS[name].ks, sr = 22050, f = midiHz(m), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * K.len);
    b = this.ac.createBuffer(1, len, sr); const d = b.getChannelData(0), ring = new Float32Array(N);
    let y = 0, peak = 0;
    for (let i = 0; i < N; i++) { y += K.bright * ((Math.random() * 2 - 1) - y); ring[i] = y; peak = Math.max(peak, Math.abs(y)); }
    for (let i = 0; i < N; i++) ring[i] /= peak || 1;
    for (let i = 0; i < len; i++) { const j = i % N, v = ring[j]; d[i] = v; ring[j] = K.decay * 0.5 * (v + ring[(j + 1) % N]); }
    if (this.ks.size > 48) this.ks.delete(this.ks.keys().next().value);
    this.ks.set(key, b); return b;
  },
  voice(type, f, t, dur, vol, att, lp, echo) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att + 0.001);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    let node = o;
    if (lp) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; o.connect(f2); node = f2; }
    node.connect(g); g.connect(this.out); if (echo && this.echoIn) g.connect(this.echoIn); o.start(t); o.stop(t + dur + 0.1);
  },
  kick(t, vol = 0.45) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.2);
  },
  noise(t, dur, f, type, vol) {
    if (!Snd.noise) return;
    const ac = this.ac, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = Snd.noise; fl.type = type; fl.frequency.value = f; if (type === 'bandpass') fl.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.02);
  },
};
document.addEventListener('pointerdown', () => { Snd.init(); Music.start(); }, { passive: true });
// Retour sur le jeu : le contexte audio a pu être mis en pause par le téléphone pendant l'absence
const musicBack = () => { if (!document.hidden && Snd.ac && Snd.ac.state === 'suspended') Snd.ac.resume().catch(() => {}); };
addEventListener('focus', musicBack); document.addEventListener('visibilitychange', musicBack);
document.addEventListener('keydown', () => { Snd.init(); Music.start(); });
