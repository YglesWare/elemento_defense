// Élémento Defense : musique d'ambiance, composée et jouée par le navigateur (aucun fichier audio, marche hors ligne).
// 4 morceaux : menus, partie calme, tension (moitié des vies perdue ou Kaiju en jeu), danger (3/4 des vies perdues).
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
  level: {
    bpm: 112, root: 62, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]],
    mel: ['0 . 4 . 7 - 4 . 9 - 7 . 4 . 2 .', '2 . 7 . 11 - 7 . 14 - 11 . 7 - . .', '4 . 9 . 12 - 9 . 16 - 12 . 9 . 7 .', '5 . 9 . 12 - 14 - 12 - 9 - 7 - . .'],
    bass: 'r.r.f.r.r.r.f.o.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', arp: true, lead: 0.06,
  },
  // Morceaux des événements (joués pendant les parties sur leur carte)
  // Halloween : valse mystérieuse en mineur, avec écho
  halloween: {
    bpm: 104, root: 57, vol: 0.9, chords: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-1, 2, 8]],
    mel: ['12 - 11 - 12 - 7 - 8 - 7 - 3 - - -', '8 - 7 - 8 - 3 - 5 - 3 - 0 - - -', '5 - 3 - 5 - 0 - 3 - 2 - -1 - - -', '2 - 3 - 5 - 8 - 11 - - - . . . .'],
    bass: 'r.......f.......', kick: 'x.......x.......', snare: '................', hat: '....x.......x...',
    arp: true, arpEvery: 2, arpType: 'triangle', arpVol: 0.022, arpOct: 0, arpEcho: false, lead: 0.05, leadType: 'triangle', leadLp: 2200, echo: true, echoSteps: 4, bassType: 'sine', bassVol: 0.12,
  },
  // Noël : clochettes et grelots, en majeur
  noel: {
    bpm: 118, root: 62, vol: 0.8, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
    mel: ['7 . 7 . 9 . 7 . 4 . 2 . 4 - - -', '5 . 5 . 9 . 12 . 11 . 9 . 7 - - -', '9 . 11 . 12 . 11 . 9 . 7 . 4 . 2 .', '4 . 2 . 0 - - - 7 . 4 . 0 - - -'],
    bass: 'r...f...r...f...', kick: 'x.......x.......', snare: '................', hat: 'x.x.x.x.x.x.x.x.',
    arp: true, arpEvery: 2, arpType: 'sine', arpVol: 0.018, arpOct: 24, arpEcho: false, lead: 0.055, leadType: 'sine', leadAtt: 0.005, echo: true, echoSteps: 3, bassType: 'sine', bassVol: 0.13,
  },
  // Pâques : ritournelle champêtre, comme une flûte
  paques: {
    bpm: 96, root: 65, vol: 0.85, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]],
    mel: ['12 - 9 - 7 - 9 - 12 - 14 - 12 - - -', '9 - 7 - 4 - 7 - 9 - 12 - 9 - - -', '10 - 9 - 7 - 5 - 7 - 9 - 10 - - -', '11 - 12 - 14 - 11 - 7 - - - . . . .'],
    bass: 'r.......f.......', kick: 'x.......x.......', snare: '................', hat: '..x...x...x...x.',
    arp: true, arpEvery: 2, arpType: 'triangle', arpVol: 0.02, arpOct: 0, lead: 0.05, leadType: 'triangle', leadAtt: 0.03, leadLp: 3000, bassType: 'sine', bassVol: 0.12,
  },
  // Saint-Valentin : ballade douce et lente
  valentin: {
    bpm: 84, root: 64, vol: 0.85, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]],
    mel: ['7 - - - 11 - 12 - 11 - - - 7 - - -', '4 - - - 7 - 9 - 7 - - - 4 - - -', '5 - - - 9 - 12 - 11 - - - 9 - - -', '7 - - - - - 5 - 2 - - - . . . .'],
    bass: 'r.......r.......', kick: '................', snare: '................', hat: '................',
    arp: true, arpEvery: 2, arpType: 'sine', arpVol: 0.022, arpOct: 0, lead: 0.05, leadType: 'sine', leadAtt: 0.04, leadLp: 1800, echo: true, echoSteps: 4, arpEcho: false, bassType: 'sine', bassVol: 0.1,
  },
  // Nouvel An chinois : gamme pentatonique et gros tambour
  nouvelan: {
    bpm: 116, root: 62, vol: 0.85, chords: [[0, 4, 7], [-3, 2, 7], [2, 7, 9], [0, 4, 9]],
    mel: ['9 . 7 . 4 . 7 . 9 - 12 - 9 - - -', '7 . 4 . 2 . 4 . 7 - 9 - 7 - - -', '12 . 14 . 12 . 9 . 7 . 9 . 12 - - -', '9 . 7 . 4 . 2 . 0 - - - . . . .'],
    bass: 'r...r...r...r...', kick: 'x...x...x..xx...', snare: '........x.......', hat: '..x...x...x...x.',
    arp: false, lead: 0.055, leadType: 'square', leadLp: 1800, leadAtt: 0.005, echo: true, echoSteps: 2, bassType: 'sine', bassVol: 0.14,
  },
  tension: {
    bpm: 124, root: 57, chords: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]],
    mel: ['0 - - . 3 - 7 - 5 - 3 - 2 - 3 -', '0 - - - . . 8 - 7 - 5 - 3 - . .', '3 - - . 7 - 10 - 8 - 7 - 5 - 7 -', '10 - - - 8 - 7 - 5 - 3 - 2 - - -'],
    bass: 'r.rrr.rrr.rrf.rr', kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', arp: true, lead: 0.065,
  },
  danger: {
    bpm: 144, root: 57, chords: [[0, 3, 7], [0, 3, 7], [8, 12, 15], [7, 11, 14]],
    mel: ['12 - 11 - 12 - 11 - 12 - 11 - 12 - 11 -', '12 - 11 - 12 - 11 - 12 - 11 - 12 - 11 -', '8 - 7 - 8 - 7 - 8 - 7 - 8 - 7 -', '7 - - - 11 - - - 14 - - - 11 - - -'],
    bass: 'rrrrrrrrrrrrrrrr', kick: 'x.x.....x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', arp: false, lead: 0.07,
  },
};
// Prépare chaque mélodie : pour chaque pas, la note qui démarre et sa durée en pas
for (const k in TRACKS) {
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

const Music = {
  ac: null, out: null, timer: 0, step: 0, nextT: 0, track: 'menu',
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
      const ev = evt(); return ev && TRACKS[ev] ? ev : 'level';
    }
    return 'menu';
  },
  tick() {
    const ac = this.ac; if (!ac || ac.state !== 'running') return;
    const on = opts.music !== false, inGame = G && !G.over;
    const duck = inGame && (G.paused || curScreen !== 'game') ? 0.45 : 1;
    this.out.gain.setTargetAtTime(on ? 0.5 * duck * (TRACKS[this.track].vol || 1) : 0, ac.currentTime, 0.25);
    if (this.nextT < ac.currentTime - 0.25) this.nextT = ac.currentTime + 0.05;
    if (!on) { this.nextT = Math.max(this.nextT, ac.currentTime); return; }
    while (this.nextT < ac.currentTime + 0.15) {
      if (this.step % 16 === 0) { this.track = this.want(); const T = TRACKS[this.track]; this.echo.delayTime.setValueAtTime(T.echoSteps ? T.echoSteps * 60 / T.bpm / 4 : 0.42, this.nextT); }
      this.play(TRACKS[this.track], this.step, this.nextT);
      this.nextT += 60 / TRACKS[this.track].bpm / 4; this.step++;
    }
  },
  play(T, step, t) {
    const s = step % 16, bar = Math.floor(step / 16) % 4, sd = 60 / T.bpm / 4, ch = T.chords[bar];
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
  voice(type, f, t, dur, vol, att, lp, echo) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att + 0.001);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    let node = o;
    if (lp) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; o.connect(f2); node = f2; }
    node.connect(g); g.connect(this.out); if (echo && this.echoIn) g.connect(this.echoIn); o.start(t); o.stop(t + dur + 0.1);
  },
  kick(t) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
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
document.addEventListener('keydown', () => { Snd.init(); Music.start(); });
