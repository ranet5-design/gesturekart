// Small Web Audio sound kit: engine hum plus short effects. Everything is synthesised, no audio files.
let ctx = null;
let master = null;
let engine = null;
let muted = false;

export function initAudio() {
  if (ctx) {
    ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);

  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'square';
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  o1.connect(filter);
  o2.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  o1.start();
  o2.start();
  engine = { o1, o2, filter, gain };
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.6;
}
export const isMuted = () => muted;

export function updateEngine(speed, running) {
  if (!engine) return;
  const t = ctx.currentTime;
  const f = 48 + speed * 4.2;
  engine.o1.frequency.setTargetAtTime(f, t, 0.1);
  engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.1);
  engine.filter.frequency.setTargetAtTime(380 + speed * 40, t, 0.1);
  engine.gain.gain.setTargetAtTime(running ? 0.035 + speed * 0.0016 : 0, t, 0.15);
}

function tone(freq, start, dur, type = 'sine', vol = 0.2) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function chime() {
  tone(880, 0, 0.18);
  tone(1320, 0.1, 0.3);
}

export function buzz() {
  tone(140, 0, 0.35, 'square', 0.12);
  tone(110, 0.12, 0.35, 'square', 0.1);
}

export function beep() {
  tone(660, 0, 0.12, 'sine', 0.15);
}

export function go() {
  tone(990, 0, 0.4, 'sine', 0.2);
}

export function crash() {
  if (!ctx) return;
  const len = ctx.sampleRate * 0.6;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

export function horn() {
  tone(420, 0, 0.35, 'square', 0.08);
  tone(520, 0, 0.35, 'square', 0.06);
}

// Combo "ding": each step of the combo plays a little higher
export function combo(n = 1) {
  const base = 660 * Math.pow(2, Math.min(n - 1, 6) / 12);
  tone(base, 0, 0.16, 'sine', 0.18);
  tone(base * 1.5, 0.08, 0.28, 'sine', 0.14);
}

export function tick() {
  tone(1800, 0, 0.03, 'square', 0.05);
  tone(1400, 0.35, 0.03, 'square', 0.05);
}

// Two-tone ambulance siren (Pakistani style hi-lo)
let sirenNodes = null;
export function siren(on) {
  if (!ctx) return;
  if (on && !sirenNodes) {
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 760;
    lfo.type = 'square';
    lfo.frequency.value = 1.6;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(master);
    o.start();
    lfo.start();
    sirenNodes = { o, lfo, g };
  } else if (!on && sirenNodes) {
    const { o, lfo, g } = sirenNodes;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => {
      try {
        o.stop();
        lfo.stop();
      } catch {
        /* already stopped */
      }
    }, 800);
    sirenNodes = null;
  }
}

// Rain: looping filtered noise
let rainNodes = null;
export function rain(on) {
  if (!ctx) return;
  if (on && !rainNodes) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500;
    f.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
    rainNodes = { src, g };
  } else if (!on && rainNodes) {
    try {
      rainNodes.src.stop();
    } catch {
      /* already stopped */
    }
    rainNodes = null;
  }
}

// Distant city horns now and then, so Lahore sounds like Lahore
export function distantHorn() {
  if (!ctx) return;
  const f = 330 + Math.random() * 260;
  tone(f, 0, 0.25 + Math.random() * 0.2, 'square', 0.025);
  if (Math.random() < 0.5) tone(f * 1.2, 0.3, 0.2, 'square', 0.02);
}

// Gentle background music: a slow four-chord loop, very quiet
let musicTimer = 0;
const CHORDS = [
  [220, 277, 330],
  [196, 247, 294],
  [175, 220, 262],
  [196, 247, 330],
];
export function music(on) {
  clearInterval(musicTimer);
  musicTimer = 0;
  if (!on || !ctx) return;
  let i = 0;
  const play = () => {
    if (muted) return;
    CHORDS[i % 4].forEach((f, k) => tone(f, k * 0.12, 1.6, 'sine', 0.025));
    tone(CHORDS[i % 4][0] / 2, 0, 1.8, 'triangle', 0.03);
    i++;
  };
  play();
  musicTimer = setInterval(play, 2000);
}
