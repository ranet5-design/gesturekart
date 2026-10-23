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
