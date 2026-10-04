// Élémento Defense : musique d'ambiance, composée et jouée par le navigateur (aucun fichier audio, marche hors ligne).
// 4 morceaux : menus, partie calme, tension (moitié des vies perdue ou Kaiju en jeu), danger (3/4 des vies perdues).
// La partie et la tension sont composées au fil de l'eau (« gen ») : tonalité, tempo, accords et mélodie tirés au sort,
// jamais deux fois pareil, et des silences entre les morceaux pour ne pas fatiguer (comme dans Minecraft).
'use strict';

// Mélodies : 16 notes par mesure, en demi-tons au-dessus de la tonique (octave haute). « . » = silence, « - » = note tenue.
const TRACKS = {
  // Menu : ambiance douce et posée (accords feutrés, clochette espacée avec écho, pas de batterie)
  menu: {
    bpm: 76, root: 60, vol: 0.75, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 9]],
    mel: ['7 - - - - - - - 4 - - - - - - -', '0 - - - - - - - 4 - - - 2 - - -', '5 - - - - - - - 9 - - - 7 - - -', '2 - - - - - - - - - - - . . . .'],
    bass: 'r...............', kick: '................', snare: '................', hat: '................',
    arp: true, arpEvery: 2, arpType: 'sine', arpVol: 0.022, padVol: 0.03, bassVol: 0.08, bassType: 'sine',
    lead: 0.05, leadType: 'sine', leadAtt: 0.04, leadLp: 1800, echo: true,
  },
  // Partie : composée au fil de l'eau, avec l'ambiance du biome ou de l'événement de la carte (voir GEN_MOOD)
  level: { gen: 'biome' },
  tension: { gen: 'tension' },
  danger: {
    bpm: 144, root: 57, chords: [[0, 3, 7], [0, 3, 7], [8, 12, 15], [7, 11, 14]],
    mel: ['12 - 11 - 12 - 11 - 12 - 11 - 12 - 11 -', '12 - 11 - 12 - 11 - 12 - 11 - 12 - 11 -', '8 - 7 - 8 - 7 - 8 - 7 - 8 - 7 -', '7 - - - 11 - - - 14 - - - 11 - - -'],
    bass: 'rrrrrrrrrrrrrrrr', kick: 'x.x.....x.x.....', snare: '....x.......x...', hat: 'x...x...x...x...', arp: false, lead: 0.06, leadType: 'triangle', leadLp: 2600,
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
  hijaz: { I: [0, 4, 7], II: [1, 5, 8], iv: [5, 8, 12], vii: [-2, 1, 5], start: 'I', end: 'I', scale: [0, 1, 4, 5, 7, 8, 10],
    next: { I: ['II', 'iv', 'vii'], II: ['I', 'I', 'vii'], iv: ['II', 'I'], vii: ['I', 'II'] } },
};
// Ambiances : mode, tempo, toniques, longueur d'un morceau et du silence qui suit (en mesures), instrument de la mélodie
// (lead, leadType, oct, pluck = notes piquées), nappe (padType, open = quintes à vide), arpège de harpe, clochettes,
// percussions douces (perc : k grosse caisse, t tambour, h charleston, s grelots, sur 16 pas ; gong toutes les 4 mesures)
// et fond sonore qui continue pendant les silences (amb : vagues, vent, grondement, bulles, oiseaux)
const GEN_MOOD = {
  prairie: { mode: 'major', bpm: [70, 80], roots: [60, 62, 65, 67], lead: 0.045, bells: 0.2, amb: 'birds' },
  plage: { mode: 'major', bpm: [66, 76], roots: [62, 64, 65], lead: 0.05, leadType: 'sine', pluck: true, harp: true, amb: 'waves' },
  marais: { mode: 'dorian', bpm: [60, 68], roots: [55, 57], lead: 0.045, leadType: 'sine', oct: -12, padType: 'triangle', padLp: 900, bells: 0, amb: 'bubbles' },
  foret: { mode: 'mixo', bpm: [72, 82], roots: [60, 62, 67], lead: 0.04, leadAtt: 0.08, harp: true, amb: 'birds' },
  desert: { mode: 'hijaz', bpm: [78, 88], roots: [60, 62], lead: 0.035, leadType: 'square', leadLp: 1300, pluck: true, bells: 0, perc: { t: 't..t..t.t.......', h: '......h.......h.' }, amb: 'wind' },
  ile: { mode: 'lydian', bpm: [86, 96], roots: [60, 65, 67], lead: 0.05, leadType: 'sine', pluck: true, oct: 12, perc: { s: '..s...s...s...s.' }, amb: 'waves' },
  canyon: { mode: 'dorian', bpm: [70, 80], roots: [57, 59, 62], lead: 0.045, pluck: true, echo: 4, perc: { k: 'k.......k.......' }, amb: 'wind' },
  volcan: { mode: 'minor', bpm: [62, 72], roots: [52, 55, 57], lead: 0.045, padType: 'sawtooth', padLp: 500, open: true, bells: 0, perc: { k: 'k...............', t: '........t.......' }, amb: 'rumble' },
  pic: { mode: 'lydian', bpm: [64, 74], roots: [62, 64, 67], lead: 0.04, leadType: 'sine', oct: 12, bells: 0.4, echo: 4, amb: 'wind' },
  toundra: { mode: 'dorian', bpm: [58, 66], roots: [59, 62, 64], lead: 0.04, leadType: 'sine', oct: 12, bells: 0.35, echo: 5, open: true, amb: 'wind', ambVol: 1.6 },
  halloween: { mode: 'harmonic', bpm: [84, 96], roots: [57, 55], lead: 0.045, echo: 4, harp: true, perc: { k: 'k...........k...' }, amb: 'wind' },
  noel: { mode: 'major', bpm: [92, 104], roots: [62, 67], lead: 0.045, leadType: 'sine', oct: 12, bells: 0.5, perc: { s: 's.s.s.s.s.s.s.s.' } },
  paques: { mode: 'mixo', bpm: [84, 96], roots: [65, 67], lead: 0.04, leadAtt: 0.07, harp: true, amb: 'birds' },
  valentin: { mode: 'major', bpm: [62, 70], roots: [64, 65], lead: 0.045, leadType: 'sine', leadAtt: 0.06, padVol: 0.032, bells: 0.15 },
  nouvelan: { mode: 'major', bpm: [88, 100], roots: [62, 65], lead: 0.035, leadType: 'square', leadLp: 1500, pluck: true, open: true, gong: true, perc: { t: 't.......t...t...' } },
  tension: { mode: 'minor', bpm: [96, 106], roots: [55, 57, 59], piece: [16, 16], silence: [0, 0], lead: 0.05, bells: 0, perc: { k: 'k.......k.......', h: '....h.......h...' } },
};
for (const k in GEN_MOOD) GEN_MOOD[k] = { piece: [16, 24], silence: [6, 12], vol: 0.8, ...GEN_MOOD[k] };
const gPick = a => a[Math.floor(Math.random() * a.length)], gInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const Music = {
  ac: null, out: null, timer: 0, step: 0, bar: -1, nextT: 0, track: 'menu', g: null,
  start() {
    if (this.timer || !Snd.ac) return;
    this.ac = Snd.ac; this.out = this.ac.createGain(); this.out.gain.value = 0; this.out.connect(this.ac.destination);
    // Écho doux (retard + filtre) pour les morceaux qui le demandent
    const ac = this.ac, fb = ac.createGain(), lp = ac.createBiquadFilter();
    this.echo = ac.createDelay(1); this.echo.delayTime.value = 0.42; fb.gain.value = 0.33; lp.type = 'lowpass'; lp.frequency.value = 1600;
    this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo); lp.connect(this.out);
    this.echoIn = ac.createGain(); this.echoIn.gain.value = 0.4; this.echoIn.connect(this.echo);
    this.nextT = this.ac.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 25);
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
      if (this.step % 16 === 0) {
        const nt = this.want(); this.bar = nt === this.track ? this.bar + 1 : 0;
        if (nt !== this.track) this.g = null;
        this.track = nt; const T = TRACKS[nt];
        if (T.gen) this.genBar(T.gen === 'biome' ? this.mood() : GEN_MOOD[T.gen], this.nextT);
        else this.echo.delayTime.setValueAtTime(T.echoSteps ? T.echoSteps * 60 / T.bpm / 4 : 0.42, this.nextT);
      }
      const T = TRACKS[this.track];
      if (!T.gen) this.play(T, this.step, this.bar, this.nextT);
      this.nextT += 60 / (T.gen ? this.g.bpm : T.bpm) / 4; this.step++;
    }
  },
  play(T, step, nb, t) {
    const s = step % 16, bar = Math.max(0, nb) % T.chords.length, sd = 60 / T.bpm / 4, ch = T.chords[bar];
    if (s === 0) for (const c of ch) this.voice('sine', midiHz(T.root + c), t, sd * 16, T.padVol || 0.035, 0.35);
    const b = T.bass[s];
    if (b !== '.') this.voice(T.bassType || 'triangle', midiHz(T.root - 12 + ch[0] + (b === 'f' ? 7 : b === 'o' ? 12 : 0)), t, sd * (T.bassType === 'sine' ? 12 : 0.9), T.bassVol || 0.2, T.bassType === 'sine' ? 0.2 : 0.005);
    const ev = T.arpEvery || 1;
    if (T.arp && s % ev === 0) this.voice(T.arpType || 'triangle', midiHz(T.root + (T.arpOct ?? 12) + ch[(s / ev) % ch.length]), t, sd * ev * 0.9, T.arpVol || 0.035, 0.005, 0, T.echo && T.arpEcho !== false);
    const n = T.notes[bar][s];
    if (n) this.voice(T.leadType || 'square', midiHz(T.root + 12 + n.n), t, sd * n.d * 0.92, T.lead, T.leadAtt || 0.01, T.leadLp || 2600, T.echo);
    if (T.kick[s] === 'x') this.kick(t);
    if (T.snare[s] === 'x') this.noise(t, 0.12, 1800, 'bandpass', 0.16);
    if (T.hat[s] === 'x') this.noise(t, 0.035, 7000, 'highpass', T.hat === 'xxxxxxxxxxxxxxxx' ? 0.035 : 0.05);
  },
  // Un nouveau morceau : tonique, tempo et longueur tirés au sort
  genPiece(M) {
    const old = this.g;
    this.g = { M, root: gPick(M.roots.filter(r => !old || r !== old.root)), bpm: gInt(M.bpm[0], M.bpm[1]), len: gInt(M.piece[0], M.piece[1]), bar: 0, chord: null,
      phrase: 4, pos: 0, rest: 0, motif: null, last: 7, silence: 0 };
  },
  // L'ambiance de la carte en cours : son événement, sinon son biome
  mood() { const m = G && !G.demo && MAPS[G.map]; return (m && GEN_MOOD[m.season || m.wid || m.id]) || GEN_MOOD.prairie; },
  // Une mesure : accords toutes les 2 mesures, mélodie en phrases de 4 mesures (la 3e reprend la 1re, un peu changée),
  // respirations avec quelques clochettes, et un silence (juste le fond sonore) après chaque morceau
  genBar(M, t) {
    if (!this.g || this.g.M !== M) this.genPiece(M);
    const g = this.g, C = GEN_CH[M.mode], sd = 60 / g.bpm / 4;
    this.echo.delayTime.setValueAtTime(Math.min(0.95, (M.echo || 3) * sd), t);
    if (M.amb && g.bar % 2 === 0) this.amb(M, t, sd * 32);
    if (g.silence > 0) { if (--g.silence === 0) this.genPiece(M); else if (M.amb && g.silence % 2) this.amb(M, t, sd * 32); return; }
    const last = g.bar >= g.len - 1;
    if (g.bar % 2 === 0 || last) {
      g.chord = g.bar === 0 ? C.start : g.bar >= g.len - 2 ? C.end : gPick(C.next[g.chord]);
      const ch = C[g.chord], len = last ? 24 : 32;
      for (const c of M.open ? [ch[0], ch[0] + 7] : ch) this.voice(M.padType || 'sine', midiHz(g.root + c), t, sd * len, M.padVol || 0.026, 0.9, M.padLp || 1500);
      this.voice('sine', midiHz(g.root - 12 + ch[0]), t, sd * (len - 4), 0.1, 0.3);
      if (M.gong && g.bar % 4 === 0) this.gong(midiHz(g.root - 12 + ch[0]), t);
    }
    const ch = C[g.chord];
    if (M.harp && !last) ch.forEach((c, k) => this.voice('sine', midiHz(g.root + 12 + c), t + (8 + k * 2) * sd, sd * 3, 0.014, 0.005, 0, true));
    if (!last && g.phrase > 0) {
      const notes = g.pos === 2 && g.motif ? this.genVary(g.motif, C, ch) : this.genMelody(C, ch);
      if (g.pos === 0) g.motif = notes;
      for (const n of notes) this.voice(M.leadType || 'triangle', midiHz(g.root + 12 + (M.oct || 0) + n.n), t + n.s * sd, sd * (M.pluck ? Math.min(n.d, 1.5) : n.d * 0.95), M.lead, M.leadAtt || (M.pluck ? 0.005 : 0.03), M.leadLp || 1800, true);
      g.pos++; if (--g.phrase === 0) g.rest = gInt(1, 3);
    } else if (!last) {
      const pb = M.bells ?? 0.2;
      for (let q = 0; q < 16; q += 4) if (Math.random() < pb) this.voice('sine', midiHz(g.root + 24 + gPick(ch) % 12), t + q * sd, sd * 6, 0.016, 0.005, 0, true);
      if (--g.rest <= 0) { g.phrase = 4; g.pos = 0; }
    }
    if (M.perc && !last) for (let q = 0; q < 16; q++) {
      const tq = t + q * sd, P = M.perc;
      if (P.k && P.k[q] === 'k') this.kick(tq, 0.2);
      if (P.t && P.t[q] === 't') this.tom(tq, 0.14);
      if (P.h && P.h[q] === 'h') this.noise(tq, 0.05, 6000, 'highpass', 0.03);
      if (P.s && P.s[q] === 's') this.noise(tq, 0.07, 7500, 'bandpass', 0.035);
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
    else if (M.amb === 'birds') { if (Math.random() < 0.6) { const t0 = t + Math.random() * dur * 0.8, f = 2200 + Math.random() * 900; for (let k = 0; k < gInt(2, 4); k++) this.blip(t0 + k * 0.11, f, 0.01 * v, 1.3, 0.07); } }
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
  // Notes possibles de la mélodie (moins haut quand l'instrument joue déjà une octave au-dessus)
  genTones(C) { const top = (this.g.M.oct || 0) > 0 ? 12 : 21, out = []; for (const o of [0, 12, 24]) for (const x of C.scale) if (x + o <= top) out.push(x + o); return out; },
  // Mélodie d'une mesure : notes de la gamme, par petits pas, notes de l'accord sur les temps forts
  genMelody(C, ch) {
    const g = this.g, tones = this.genTones(C);
    const inCh = n => ch.some(c => ((n - c) % 12 + 12) % 12 === 0), out = [];
    let free = 0;
    for (let s = 0; s < 16; s += 2) {
      const p = s === 0 ? 0.55 : s === 8 ? 0.5 : s % 4 === 0 ? 0.3 : 0.15;
      if (s < free || Math.random() > p) continue;
      let near = tones.filter(n => Math.abs(n - g.last) <= 5 && n !== g.last);
      if (s % 8 === 0) { const c = near.filter(inCh); if (c.length) near = c; }
      const n = near.length ? gPick(near) : g.last, d = Math.min(16 - s, gPick([2, 2, 4, 4, 6]));
      out.push({ s, n, d }); free = s + d; g.last = n;
    }
    if (!out.length) { const n = tones.find(inCh) ?? 7; out.push({ s: 0, n, d: 6 }); g.last = n; }
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
