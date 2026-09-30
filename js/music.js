// Élémento Defense : musique d'ambiance, composée et jouée par le navigateur (aucun fichier audio, marche hors ligne).
// 4 morceaux : menus, partie calme, tension (moitié des vies perdue ou Kaiju en jeu), danger (3/4 des vies perdues).
'use strict';

// Mélodies : 16 notes par mesure, en demi-tons au-dessus de la tonique (octave haute). « . » = silence, « - » = note tenue.
const TRACKS = {
  menu: {
    bpm: 100, root: 60, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]],
    mel: ['4 - 7 - 12 - 7 - 9 - 7 - 4 - 2 -', '0 - 4 - 9 - - - 7 - 4 - - - . .', '5 - 9 - 12 - 9 - 7 - 5 - 4 - 2 -', '2 - 7 - 11 - 14 - 12 - - - - - . .'],
    bass: 'r...f...r...f...', kick: 'x.......x.......', snare: '........x.......', hat: '....x.......x...', arp: false, lead: 0.07,
  },
  level: {
    bpm: 112, root: 62, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]],
    mel: ['0 . 4 . 7 - 4 . 9 - 7 . 4 . 2 .', '2 . 7 . 11 - 7 . 14 - 11 . 7 - . .', '4 . 9 . 12 - 9 . 16 - 12 . 9 . 7 .', '5 . 9 . 12 - 14 - 12 - 9 - 7 - . .'],
    bass: 'r.r.f.r.r.r.f.o.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', arp: true, lead: 0.06,
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
    const on = opts.music !== false, inGame = G && !G.over;
    const duck = inGame && (G.paused || curScreen !== 'game') ? 0.45 : 1;
    this.out.gain.setTargetAtTime(on ? 0.5 * duck : 0, ac.currentTime, 0.25);
    if (this.nextT < ac.currentTime - 0.25) this.nextT = ac.currentTime + 0.05;
    if (!on) { this.nextT = Math.max(this.nextT, ac.currentTime); return; }
    while (this.nextT < ac.currentTime + 0.15) {
      if (this.step % 16 === 0) this.track = this.want();
      this.play(TRACKS[this.track], this.step, this.nextT);
      this.nextT += 60 / TRACKS[this.track].bpm / 4; this.step++;
    }
  },
  play(T, step, t) {
    const s = step % 16, bar = Math.floor(step / 16) % 4, sd = 60 / T.bpm / 4, ch = T.chords[bar];
    if (s === 0) for (const c of ch) this.voice('sine', midiHz(T.root + c), t, sd * 16, 0.035, 0.35);
    const b = T.bass[s];
    if (b !== '.') this.voice('triangle', midiHz(T.root - 12 + ch[0] + (b === 'f' ? 7 : b === 'o' ? 12 : 0)), t, sd * 0.9, 0.2, 0.005);
    if (T.arp) this.voice('triangle', midiHz(T.root + 12 + ch[s % 3]), t, sd * 0.7, 0.035, 0.005);
    const n = T.notes[bar][s];
    if (n) this.voice('square', midiHz(T.root + 12 + n.n), t, sd * n.d * 0.92, T.lead, 0.01, 2600);
    if (T.kick[s] === 'x') this.kick(t);
    if (T.snare[s] === 'x') this.noise(t, 0.12, 1800, 'bandpass', 0.16);
    if (T.hat[s] === 'x') this.noise(t, 0.035, 7000, 'highpass', T.hat === 'xxxxxxxxxxxxxxxx' ? 0.035 : 0.05);
  },
  voice(type, f, t, dur, vol, att, lp) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att + 0.001);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    let node = o;
    if (lp) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; o.connect(f2); node = f2; }
    node.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.1);
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
