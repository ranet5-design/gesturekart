import { LANES, ROAD_HALF, CAR_LEN, CAR_W, SPEED_LIMIT_KMH, carById, POINTS, NPC_TYPES } from './config.js';
import { FREE_DRIVE } from './levels.js';
import { settings } from './settings.js';
import { computeSkills } from './rules.js';
import { input, updateKeyboard } from '../cv/input.js';
import { say } from '../audio/voice.js';
import * as sfx from '../audio/sound.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NPC_SLOTS = ['car', 'rickshaw', 'car', 'bus', 'rickshaw', 'car', 'rickshaw', 'car', 'car', 'rickshaw'];
const SPECIAL = ['ambulance', 'bike', 'cart', 'cart'];
const REPLAY_TYPES = ['redLight', 'pedestrian', 'crash', 'wrongWay'];
const CRITICAL = ['redLight', 'pedestrian', 'crash', 'wrongWay'];

// Camera views the player can pick before (or during, with C) the drive
export const VIEWS = [
  { id: 'cockpit', name: 'Driver seat', ur: 'Steering aapke saamne', desc: 'Sit inside the kart with the steering wheel in front of you.' },
  { id: 'chase', name: 'Behind the car', ur: 'Gaari ke peeche se', desc: 'Classic view from just behind your kart.' },
  { id: 'wide', name: 'Wide angle', ur: 'Upar se, door tak', desc: 'High, wide view to see signals and traffic early.' },
];
const VIEW_KEY = 'gesturekart.view';
function loadView() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return VIEWS.some((x) => x.id === v) ? v : 'cockpit';
  } catch {
    return 'cockpit';
  }
}
export function setView(id) {
  if (!VIEWS.some((x) => x.id === id)) return;
  game.view = id;
  try {
    localStorage.setItem(VIEW_KEY, id);
  } catch {
    /* preference just won't be remembered */
  }
}
export function nextView() {
  const i = VIEWS.findIndex((x) => x.id === game.view);
  setView(VIEWS[(i + 1) % VIEWS.length].id);
  return game.view;
}

/* All live game data lives in this one mutable object. The 3D scene and HUD read it;
   only this file writes to it. React re-renders are avoided during play for smooth 60 FPS. */
export const game = {
  phase: 'menu', // menu | loading | practice | countdown | playing | paused | over | history | levels
  view: loadView(),
  car: 'kart',
  level: FREE_DRIVE,
  length: FREE_DRIVE.length,
  profile: { age: null, cnicMasked: '' },
  runId: 0,
  player: 'Driver',
  mode: 'keyboard',
  t: 0,
  s: 0,
  x: 0,
  v: 0,
  yaw: 0,
  roll: 0,
  braking: false,
  score: 100,
  maxKmh: 0,
  shake: 0,
  invuln: 0,
  endReason: '',
  signals: [],
  npcs: [],
  peds: [],
  events: [],
  telemetry: [],
  counts: {},
  indicator: { dir: null, at: -99 },
  seatbelt: false,
  combo: 0,
  maxCombo: 0,
  xp: 0,
  popup: null, // { text, kind, t } big "Perfect stop!" style feedback
  ruleCard: null, // { type, t }
  focus: { alerts: [], banner: null, pulse: 0, pause: false, attentive: 0, watched: 0, capUntil: 0 },
  replay: null,
  replayed: {},
  secondChanceUsed: false,
  pendingFail: '',
  bestMoment: null,
  hazardsDone: {},
  lane: { settled: 1, settledT: 0, lastChangeT: -99, straddleT: 0, straddleFlag: false },
  timers: { over: 0, overFlag: false, tail: 0, tailFlag: false, lost: 0, tele: 0, rest: 0 },
  halfwaySaid: false,
};

const phaseListeners = new Set();
export function onPhase(fn) {
  phaseListeners.add(fn);
  return () => phaseListeners.delete(fn);
}
export function setPhase(p) {
  game.phase = p;
  phaseListeners.forEach((fn) => fn(p));
}

/** Speed limit at a point on the route (zones like "School zone 30"). */
export function limitAt(s) {
  for (const z of game.level.zones || []) if (s >= z.from && s <= z.to) return z;
  return { limit: SPEED_LIMIT_KMH, label: '' };
}

function buildSignals(cfg, length) {
  const list = [];
  if (!cfg) return list;
  let s = cfg.first;
  while (s < length - 140) {
    list.push({
      id: list.length,
      s,
      state: 'green',
      timer: 0,
      triggered: false,
      // The first signal always turns red so every player learns the halt gesture.
      willTurn: list.length === 0 || Math.random() < cfg.p,
      passed: false,
      stopped: false,
      cued: false,
      result: null,
    });
    s += rand(cfg.gap[0], cfg.gap[1]);
  }
  return list;
}

export function resetGame(player = 'Driver', mode = 'keyboard', level = game.level || FREE_DRIVE) {
  Object.assign(game, {
    runId: game.runId + 1,
    player: (player || '').trim() || 'Driver',
    mode,
    level,
    length: level.length,
    t: 0, s: 0, x: LANES[1], v: 0, yaw: 0, roll: 0, braking: false,
    score: 100, maxKmh: 0, shake: 0, invuln: 0, endReason: '',
    events: [], telemetry: [], counts: {},
    indicator: { dir: null, at: -99 },
    combo: 0, maxCombo: 0, xp: 0, popup: null, ruleCard: null,
    focus: { alerts: [], banner: null, pulse: 0, pause: false, attentive: 0, watched: 0, capUntil: 0 },
    replay: null, replayed: {}, secondChanceUsed: false, pendingFail: '', bestMoment: null, hazardsDone: {},
    lane: { settled: 1, settledT: 0, lastChangeT: -99, straddleT: 0, straddleFlag: false },
    timers: { over: 0, overFlag: false, tail: 0, tailFlag: false, lost: 0, tele: 0, rest: 0 },
    halfwaySaid: false,
  });
  game.signals = buildSignals(level.signals, level.length);
  game.npcs = [...NPC_SLOTS, ...SPECIAL].map((type, id) => ({
    id, type, special: SPECIAL.includes(type) && id >= NPC_SLOTS.length,
    active: false, s: 0, x: 0, v: 0, cruise: 10, braking: false, flag: null,
  }));
  game.peds = Array.from({ length: 8 }, (_, id) => ({
    id, active: false, s: 0, x: 0, dir: 1, speed: 1.8, delay: 0, hit: false, sig: -1, phase: 0,
  }));
  if (level.traffic > 0) [45, 90, 135].slice(0, Math.ceil(level.traffic / 2)).forEach((s, i) => spawnNpc(s, i % 3));
  spawnTimer = 1;
  replayBuf.length = 0;
}

/* ---------------- Events, combos & XP ---------------- */

const GOOD_POPUPS = {
  goodStop: 'Perfect stop!',
  cleanLane: 'Clean lane change!',
  gaveWay: 'Gave way. Lives saved!',
  avoided: 'Great reflexes!',
  seatbelt: 'Seatbelt on ✓',
};

function addEvent(type, label, points, voiceText, { sound = true } = {}) {
  game.score = clamp(game.score + points, 0, 100);
  game.counts[type] = (game.counts[type] || 0) + 1;
  const ev = { t: game.t, s: game.s, type, label, points };
  game.events.push(ev);
  if (points > 0) {
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    const gained = points * 5 * Math.min(5, game.combo);
    game.xp += gained;
    ev.combo = game.combo;
    game.popup = { text: GOOD_POPUPS[type] || label, sub: game.combo > 1 ? `Combo x${game.combo} · +${gained} XP` : `+${gained} XP`, kind: 'good', t: game.t };
    if (!game.bestMoment || game.combo >= (game.bestMoment.combo || 0)) game.bestMoment = { ...ev, combo: game.combo };
    if (sound) sfx.combo(game.combo);
  } else if (points < 0) {
    game.combo = 0;
    game.popup = { text: label, sub: `${points} points`, kind: 'bad', t: game.t };
    game.ruleCard = { type, t: game.t };
    if (sound) sfx.buzz();
  }
  if (voiceText) say(voiceText, { key: 'ev-' + type, cooldown: 2500, urgent: points < 0 });

  if (points < 0 && REPLAY_TYPES.includes(type)) startReplay(type);
  if (game.level.examiner && CRITICAL.includes(type)) {
    game.pendingFail = label;
    say('The examiner has stopped the test.', { key: 'examiner', urgent: true });
    if (!game.replay) finish('failed');
  }
}

export function gradeFor(score) {
  if (score >= 95) return { grade: 'A+', label: 'Model Citizen' };
  if (score >= 85) return { grade: 'A', label: 'Responsible Driver' };
  if (score >= 70) return { grade: 'B', label: 'Mostly Civic' };
  if (score >= 55) return { grade: 'C', label: 'Needs Practice' };
  if (score >= 40) return { grade: 'D', label: 'Risky Driver' };
  return { grade: 'F', label: 'Licence Suspended' };
}

function finish(reason) {
  if (game.phase === 'over') return;
  game.endReason = reason;
  game.v = 0;
  game.replay = null;
  sfx.updateEngine(0, false);
  sfx.siren(false);
  if (reason === 'finish') say('You reached the finish. Here is your civic driving score.', { urgent: true });
  else if (reason === 'suspended') say('Licence suspended. Too many violations.', { urgent: true });
  else if (reason === 'failed') say('Test failed. Let us look at what to improve.', { urgent: true });
  else say('Drive ended. Here is your score card.', { urgent: true });
  setPhase('over');
}

export function endDrive() {
  if (game.phase === 'playing' || game.phase === 'paused') finish('quit');
}

/* ---------------- Replay (last few seconds, slow motion) ---------------- */

const replayBuf = [];
const REPLAY_FRAMES = 150; // ~5 s at 30 snapshots per second
let snapAcc = 0;

function takeSnap() {
  return {
    s: game.s, x: game.x, yaw: game.yaw, roll: game.roll, v: game.v,
    npcs: game.npcs.map((n) => [n.active ? 1 : 0, n.s, n.x, n.v, n.braking ? 1 : 0]),
    peds: game.peds.map((p) => [p.active ? 1 : 0, p.x, p.s, p.hit ? 1 : 0, p.delay, p.phase]),
    sig: game.signals.map((g) => g.state),
  };
}
function applySnap(f) {
  game.s = f.s; game.x = f.x; game.yaw = f.yaw; game.roll = f.roll; game.v = f.v;
  f.npcs.forEach((a, i) => {
    const n = game.npcs[i];
    n.active = !!a[0]; n.s = a[1]; n.x = a[2]; n.v = a[3]; n.braking = !!a[4];
  });
  f.peds.forEach((a, i) => {
    const p = game.peds[i];
    p.active = !!a[0]; p.x = a[1]; p.s = a[2]; p.hit = !!a[3]; p.delay = a[4]; p.phase = a[5];
  });
  f.sig.forEach((st, i) => (game.signals[i].state = st));
}

function startReplay(type) {
  if (!settings.replays || game.replayed[type] || replayBuf.length < 30) return;
  game.replayed[type] = true;
  game.replay = { frames: replayBuf.slice(-REPLAY_FRAMES), i: 0, acc: 0, live: takeSnap(), type, liveV: game.v };
  sfx.siren(false);
}

export function skipReplay() {
  if (!game.replay) return;
  applySnap(game.replay.live);
  game.replay = null;
  if (game.pendingFail) finish('failed');
}

function stepReplay(dt) {
  const R = game.replay;
  R.acc += dt * 30 * 0.45; // 45% speed
  while (R.acc >= 1 && R.i < R.frames.length - 1) {
    R.acc -= 1;
    R.i++;
  }
  applySnap(R.frames[R.i]);
  if (R.i >= R.frames.length - 1) {
    R.hold = (R.hold || 0) + dt;
    if (R.hold > 1.2) skipReplay();
  }
}

/* ---------------- Traffic ---------------- */

let spawnTimer = 0;

function spawnNpc(s, laneIdx) {
  const free = game.npcs.filter((n) => !n.active && !n.special);
  if (!free.length) return;
  const lane = laneIdx ?? Math.floor(Math.random() * 3);
  const x = LANES[lane];
  const blocked = game.npcs.some((n) => n.active && Math.abs(n.x - x) < 1 && Math.abs(n.s - s) < 28);
  const nearSignal = game.signals.some((g) => s > g.s - 6 && s < g.s + 16);
  if (blocked || nearSignal || s > game.length + 40) return;
  const pick = free[Math.floor(Math.random() * free.length)];
  const cruise = pick.type === 'bus' ? rand(8, 10) : pick.type === 'rickshaw' ? rand(6.5, 9) : rand(9.5, 13);
  Object.assign(pick, { active: true, s, x, v: cruise * 0.7, cruise, braking: false, flag: null });
}

function spawnHazard(type) {
  const slot = game.npcs.find((n) => n.special && n.type === type && !n.active);
  if (!slot) return;
  const lane = LANES.reduce((b, c, i) => (Math.abs(game.x - c) < Math.abs(game.x - LANES[b]) ? i : b), 0);
  if (type === 'ambulance') {
    Object.assign(slot, { active: true, s: game.s - 75, x: LANES[lane], v: Math.max(14, game.v + 7), cruise: 18, flag: { yieldT: 0, done: false } });
    sfx.siren(true);
    say('Ambulance behind you! Move to another lane and let it pass.', { key: 'amb', urgent: true });
  } else if (type === 'bike') {
    Object.assign(slot, { active: true, s: game.s + 170, x: LANES[lane], v: -8, cruise: -8, flag: { done: false } });
    say('Wrong-way biker ahead in your lane! Move aside.', { key: 'bike', urgent: true });
  } else if (type === 'cart') {
    const busy = game.npcs.some((n) => n.active && n.type === 'cart');
    const free = game.npcs.find((n) => n.special && n.type === 'cart' && !n.active && !busy) || slot;
    Object.assign(free, { active: true, s: game.s + 120, x: LANES[Math.random() < 0.5 ? 0 : 1], v: 3, cruise: 3, flag: null });
    say('Slow donkey cart ahead. Overtake carefully.', { key: 'cart', cooldown: 15000 });
  }
}

function nextSignalAhead(frontS) {
  for (const g of game.signals) if (g.s > frontS - 0.5) return g;
  return null;
}

function updateNpcs(dt) {
  for (const n of game.npcs) {
    if (!n.active) continue;
    const spec = NPC_TYPES[n.type];
    const front = n.s + spec.len / 2;

    if (n.type === 'bike') {
      // Wrong-way biker: rides straight at you, swerves a little at the last moment if you don't
      n.s += n.v * dt;
      if (!n.flag.done && n.s < game.s - 4) {
        n.flag.done = true;
        addEvent('avoided', 'Avoided a wrong-way biker', POINTS.avoided, null);
      }
      if (n.s < game.s - 60) n.active = false;
      continue;
    }

    let target = n.cruise;
    if (n.type !== 'ambulance') {
      const sig = nextSignalAhead(front);
      if (sig && sig.state !== 'green') {
        const d = sig.s - front - 0.8;
        if (!(sig.state === 'yellow' && d < 3)) target = Math.min(target, Math.max(0, d * 0.55));
      }
    }
    for (const o of game.npcs) {
      if (o === n || !o.active || o.type === 'bike' || Math.abs(o.x - n.x) > 2 || o.s <= n.s) continue;
      const gap = o.s - NPC_TYPES[o.type].len / 2 - front;
      if (gap < 30) target = Math.min(target, Math.max(0, o.v + (gap - 4) * 0.6));
    }
    if (Math.abs(game.x - n.x) < 2.2 && game.s > n.s) {
      const gap = game.s - CAR_LEN / 2 - front;
      if (gap < 30) target = Math.min(target, Math.max(0, game.v + (gap - 5) * 0.6));
    }

    // Ambulance: did the player give way?
    if (n.type === 'ambulance' && !n.flag.done) {
      const behind = game.s - n.s;
      const sameLane = Math.abs(game.x - n.x) < 2;
      if (behind > 0 && behind < 18 && sameLane) {
        n.flag.yieldT += dt;
        if (n.flag.yieldT > 4.5) {
          n.flag.done = true;
          addEvent('noYield', "Didn't give way to the ambulance", POINTS.noYield, 'You blocked the ambulance. Always make way.');
        }
      } else if (behind > 0 && behind < 30 && !sameLane) {
        n.flag.done = true;
        addEvent('gaveWay', 'Gave way to the ambulance', POINTS.gaveWay, 'Well done. You made way for the ambulance.');
      } else if (behind < -10) {
        n.flag.done = true;
      }
    }

    const dv = target - n.v;
    n.braking = dv < -0.5;
    n.v = Math.max(0, n.v + clamp(dv, -9 * dt, (n.type === 'ambulance' ? 5 : 2.5) * dt));
    n.s += n.v * dt;
    if (n.s < game.s - 90 || n.s > game.s + 340) {
      n.active = false;
      if (n.type === 'ambulance') sfx.siren(false);
    }
  }

  const traffic = game.level.traffic;
  spawnTimer -= dt;
  const active = game.npcs.filter((n) => n.active && !n.special).length;
  if (traffic > 0 && spawnTimer <= 0 && active < traffic) {
    spawnNpc(game.s + rand(150, 270));
    spawnTimer = rand(1.2, 2.6);
  }
  for (const [i, h] of (game.level.hazards || []).entries()) {
    if (!game.hazardsDone[i] && game.s >= h.at) {
      game.hazardsDone[i] = true;
      spawnHazard(h.type);
    }
  }
}

/* ---------------- Signals & pedestrians ---------------- */

function spawnPeds(sig) {
  const count = 2 + Math.floor(Math.random() * 2);
  let made = 0;
  for (const p of game.peds) {
    if (p.active || made >= count) continue;
    const dir = Math.random() < 0.5 ? 1 : -1;
    Object.assign(p, {
      active: true, hit: false, sig: sig.id, dir,
      s: sig.s + rand(2, 4.2),
      x: dir > 0 ? -ROAD_HALF - 1.2 : ROAD_HALF + 1.2,
      speed: rand(1.7, 2.3), delay: made * rand(0.6, 1.4), phase: Math.random() * 6,
    });
    made++;
  }
}

function pedsClear(sig) {
  return !game.peds.some((p) => p.active && !p.hit && p.sig === sig.id && Math.abs(p.x) < ROAD_HALF + 0.6);
}

function updateSignals(dt, prevFront, front) {
  for (const sig of game.signals) {
    const dist = sig.s - front;
    if (!sig.triggered && dist > 0 && dist < 75 + game.v * 2.2) {
      sig.triggered = true;
      if (sig.willTurn) {
        sig.state = 'yellow';
        sig.timer = 0;
        sfx.beep();
      }
    }
    if (sig.state === 'yellow') {
      sig.timer += dt;
      if (sig.timer > 2.6) {
        sig.state = 'red';
        sig.timer = 0;
        spawnPeds(sig);
      }
    } else if (sig.state === 'red') {
      sig.timer += dt;
      if (sig.timer > 6 && pedsClear(sig)) {
        sig.state = 'green';
        sig.timer = 0;
        if (sig.stopped && !sig.passed) {
          sfx.go();
          say('Green light. Off you go.', { key: 'green', cooldown: 3000 });
        }
      }
    }

    if (sig.passed) continue;

    if (sig.state !== 'green' && !sig.cued && dist > 4 && dist < 55 && game.v > 4) {
      sig.cued = true;
      say(
        sig.state === 'red' ? 'Red light ahead! Raise your right hand to stop.' : 'Signal is changing. Get ready to stop.',
        { key: 'approach', cooldown: 2000, urgent: true },
      );
    }
    if (sig.state !== 'green' && !sig.stopped && dist > -0.5 && dist < 45 && game.v < 0.6) {
      sig.stopped = true;
      say('Good stop. Wait for the green.', { key: 'goodstop', cooldown: 3000 });
    }
    if (prevFront < sig.s && front >= sig.s) {
      sig.passed = true;
      if (sig.state === 'red') {
        sig.result = 'run';
        addEvent('redLight', 'Ran a red light', POINTS.redLight, 'You ran a red light! Heavy penalty.');
      } else if (sig.state === 'yellow') {
        sig.result = 'yellow';
        say('That was a yellow light. Slow down next time.', { key: 'yellow', cooldown: 3000 });
      } else if (sig.stopped) {
        sig.result = 'stopped';
        addEvent('goodStop', 'Stopped at red, waited for green', POINTS.goodStop, null);
      } else {
        sig.result = 'green';
      }
    }
  }

  for (const p of game.peds) {
    if (!p.active) continue;
    if (p.delay > 0) {
      p.delay -= dt;
      continue;
    }
    if (p.hit) continue;
    p.x += p.dir * p.speed * dt;
    p.phase += dt * 8;
    if (p.x * p.dir > ROAD_HALF + 2.5) p.active = false;
  }
}

/* ---------------- Focus (eyes, sleepiness, distraction) ---------------- */

const FOCUS_TEXT = {
  eyes: 'Eyes closed! Stay awake.',
  drowsy: 'You look sleepy. Focus on the road.',
  yawn: 'Yawning: you may be tired. Stay sharp.',
  away: 'Look at the road, not around.',
  down: 'Eyes up! Are you on your phone?',
  noface: "I can't see your face. Look at the road.",
};

function updateFocus(dt) {
  const F = game.focus;
  const active = input.source === 'camera' && settings.focusCheck && input.faceReady;
  if (!active) {
    input.focusEvents.length = 0;
    return;
  }
  F.watched += dt;
  if (input.attentive) F.attentive += dt;
  F.pulse = Math.max(0, F.pulse - dt);

  while (input.focusEvents.length) {
    const ev = input.focusEvents.shift();
    F.alerts = F.alerts.filter((t) => game.t - t < 120);
    F.alerts.push(game.t);
    const level = F.alerts.length;
    const text = FOCUS_TEXT[ev] || FOCUS_TEXT.away;
    F.banner = { text, t: game.t, level };
    F.capUntil = game.t + 4; // ease off the gas while they refocus
    addEvent('focus', ev === 'down' ? 'Looked down (phone?) while driving' : ev === 'eyes' || ev === 'drowsy' || ev === 'yawn' ? 'Drowsy driving' : 'Not watching the road', POINTS.focus, text);
    if (level >= 2) F.pulse = 1.6; // a few soft white pulses
    if (level >= 3) {
      // Repeated: stop the car and pause until the player is 100% alert again
      F.pause = true;
      say('Too many focus warnings. The game is paused until you are fully alert.', { key: 'focuspause', urgent: true });
    }
  }
}

/* ---------------- Main step ---------------- */

export function stepFrame(dt) {
  if (game.phase === 'menu' || game.phase === 'levels' || game.phase === 'history') {
    game.s += 7 * dt;
    if (game.s > game.length - 200) game.s = 0;
    game.v = 7;
    return;
  }
  if (game.phase !== 'playing') {
    sfx.updateEngine(0, game.phase === 'countdown');
    return;
  }
  if (game.replay) {
    stepReplay(dt);
    sfx.updateEngine(game.v * 0.4, true);
    return;
  }

  game.t += dt;
  updateKeyboard(dt);
  updateFocus(dt);

  // Record for replays
  snapAcc += dt;
  if (snapAcc >= 1 / 30) {
    snapAcc = 0;
    replayBuf.push(takeSnap());
    if (replayBuf.length > REPLAY_FRAMES + 10) replayBuf.shift();
  }

  // ---- Player longitudinal motion ----
  const halt = input.halt || game.focus.pause;
  const car = carById(game.car);
  const wet = game.level.env?.weather === 'rain' ? 0.65 : 1;
  let throttle = input.throttle;
  if (input.source === 'camera' && settings.speedMode === 'auto') {
    // Auto speed: hold a safe speed just under the limit. Lowering the wheel slows you down;
    // the right hand up still brakes to a full stop.
    const limit = limitAt(game.s).limit;
    const safe = Math.min(car.top, limit - (wet < 1 || game.level.env?.time === 'night' ? 12 : 6));
    const factor = input.wheelHeld && input.steerSource === 'wheel' ? 0.35 + 0.65 * clamp(input.wheelLift / 0.5, 0, 1) : 1;
    throttle = (safe * factor) / car.top;
  }
  if (game.t < game.focus.capUntil) throttle = Math.min(throttle, 0.4);
  const target = halt ? 0 : throttle * (car.top / 3.6);
  const accel = halt ? car.brake * wet : target > game.v ? car.accel * (wet < 1 ? 0.85 : 1) : car.accel * 0.8 * wet;
  game.v = Math.max(0, game.v + clamp(target - game.v, -accel * dt, accel * dt));
  game.braking = halt || target < game.v - 0.5;

  // ---- Indicator ----
  if (input.indicator) {
    game.indicator = { dir: input.indicator, at: game.t };
    input.indicator = null;
    sfx.tick();
  }
  if (game.indicator.dir && game.t - game.indicator.at > 6) game.indicator.dir = null;

  // ---- Player lateral motion ----
  // Braking = drive straight (raising the right hand must never swerve the car)
  const steer = halt ? 0 : input.steer;
  const nearestIdx = LANES.reduce((best, c, i) => (Math.abs(game.x - c) < Math.abs(game.x - LANES[best]) ? i : best), 0);
  let vx;
  if (Math.abs(steer) < 0.08) {
    vx = clamp(LANES[nearestIdx] - game.x, -1, 1) * 1.8; // lane-keep assist
  } else {
    vx = steer * (3 + game.v * 0.28) * car.steer;
  }
  vx *= clamp(game.v / 3, 0, 1);
  game.x = clamp(game.x + vx * dt, -ROAD_HALF + 1, ROAD_HALF - 1);
  game.yaw += (-vx * 0.045 - game.yaw) * Math.min(1, dt * 8);
  game.roll += (steer * 0.08 * clamp(game.v / 10, 0, 1) - game.roll) * Math.min(1, dt * 6);

  const prevFront = game.s + CAR_LEN / 2;
  game.s += game.v * dt;
  const front = game.s + CAR_LEN / 2;
  const kmh = game.v * 3.6;
  game.maxKmh = Math.max(game.maxKmh, kmh);
  game.invuln = Math.max(0, game.invuln - dt);
  game.shake = Math.max(0, game.shake - dt * 2);

  if (game.t < dt * 1.5 && game.seatbelt) addEvent('seatbelt', 'Seatbelt fastened', POINTS.seatbelt, null);

  updateSignals(dt, prevFront, front);
  updateNpcs(dt);
  if (game.replay || game.phase !== 'playing') return;

  // ---- Collisions ----
  if (game.invuln <= 0) {
    for (const n of game.npcs) {
      if (!n.active) continue;
      const spec = NPC_TYPES[n.type];
      const ox = (CAR_W + spec.w) / 2 - 0.15 - Math.abs(n.x - game.x);
      const os = (CAR_LEN + spec.len) / 2 - 0.15 - Math.abs(n.s - game.s);
      if (ox > 0 && os > 0) {
        if (n.type === 'bike') {
          n.active = false;
          n.flag.done = true;
          game.v = 0;
          game.invuln = 1.5;
          game.shake = 1;
          sfx.crash();
          addEvent('wrongWay', 'Hit a wrong-way biker', POINTS.wrongWay, 'Crash! Always watch for wrong-way riders.', { sound: false });
          break;
        }
        if (os < ox || game.s < n.s - 1) {
          if (game.s < n.s) game.s = n.s - (CAR_LEN + spec.len) / 2 - 0.4;
          else n.s = game.s - (CAR_LEN + spec.len) / 2 - 0.4;
        } else {
          game.x += Math.sign(game.x - n.x || 1) * (ox + 0.3);
          game.x = clamp(game.x, -ROAD_HALF + 1, ROAD_HALF - 1);
        }
        game.v = 0;
        game.invuln = 1.5;
        game.shake = 1;
        sfx.crash();
        addEvent('crash', 'Collision with a vehicle', POINTS.crash, 'Crash! Keep a safe distance.', { sound: false });
        break;
      }
    }
    for (const p of game.peds) {
      if (!p.active || p.hit || p.delay > 0) continue;
      if (Math.abs(p.x - game.x) < 1.25 && Math.abs(p.s - game.s) < CAR_LEN / 2 + 0.3) {
        p.hit = true;
        game.v = 0;
        game.invuln = 1.5;
        game.shake = 1;
        sfx.crash();
        addEvent('pedestrian', 'Hit a pedestrian on the zebra', POINTS.pedestrian,
          'You hit a pedestrian! Always stop for people on the zebra crossing.', { sound: false });
      }
    }
  }
  if (game.phase !== 'playing') return;

  // ---- Over-speeding (zone-aware) ----
  const T = game.timers;
  const zone = limitAt(game.s);
  if (zone.label && !T.zoneSaid?.[zone.label + zone.from]) {
    T.zoneSaid = { ...(T.zoneSaid || {}), [zone.label + zone.from]: true };
    say(`${zone.label.toLowerCase()}. Speed limit ${zone.limit}.`, { key: 'zone', cooldown: 3000, urgent: true });
  }
  if (kmh > zone.limit + 3) {
    T.over += dt;
    if (T.over > 0.4) say(`Slow down. The limit is ${zone.limit}.`, { key: 'speed', cooldown: 7000 });
    if (T.over > 2.5 && !T.overFlag) {
      T.overFlag = true;
      addEvent('overspeed', `Over-speeding (${Math.round(kmh)} in a ${zone.limit} zone)`, POINTS.overspeed, null);
    }
  } else if (kmh < zone.limit - 2) {
    T.over = 0;
    T.overFlag = false;
  }

  // ---- Tailgating ----
  let lead = null;
  for (const n of game.npcs) {
    if (!n.active || n.type === 'bike' || Math.abs(n.x - game.x) > 2 || n.s <= game.s) continue;
    if (!lead || n.s < lead.s) lead = n;
  }
  const gap = lead ? lead.s - NPC_TYPES[lead.type].len / 2 - front : Infinity;
  // Forward collision warning, like modern cars: closing fast on something slower
  const closing = lead ? game.v - lead.v : 0;
  if (closing > 2 && gap > 0 && gap / closing < 2.5) {
    game.fcw = game.t;
    say('Brake! Car stopped ahead.', { key: 'fcw', cooldown: 4000, urgent: true });
    sfx.beep();
  }
  if (game.v > 6 && gap > 0 && gap < game.v * 0.9) {
    T.tail += dt;
    if (T.tail > 0.5) say('Too close! Back off.', { key: 'tail', cooldown: 6000 });
    if (T.tail > 1.8 && !T.tailFlag) {
      T.tailFlag = true;
      addEvent('tailgate', 'Tailgating the vehicle ahead', POINTS.tailgate, null);
    }
  } else {
    T.tail = Math.max(0, T.tail - dt);
    if (T.tail === 0) T.tailFlag = false;
  }

  // ---- Lane discipline (+ indicators) ----
  const L = game.lane;
  const off = Math.abs(game.x - LANES[nearestIdx]);
  if (off > 1.0 && game.v > 2) {
    L.straddleT += dt;
    if (L.straddleT > 2.5 && !L.straddleFlag) {
      L.straddleFlag = true;
      addEvent('straddle', 'Driving between lanes', POINTS.straddle, 'Stay inside your lane.');
    }
  } else if (off < 0.5) {
    if (nearestIdx !== L.settled) {
      const dir = nearestIdx > L.settled ? 'right' : 'left';
      const took = game.t - L.settledT;
      const crowded = game.npcs.some(
        (n) => n.active && n.type !== 'bike' && Math.abs(n.x - LANES[nearestIdx]) < 1.2 && Math.abs(n.s - game.s) < 9,
      );
      const atJunction = game.signals.some((g) => game.s > g.s - 12 && game.s < g.s + 14);
      const weaving = game.t - L.lastChangeT < 5;
      const signalled = game.indicator.dir === dir && game.t - game.indicator.at < 6;
      L.lastChangeT = game.t;
      if (crowded || atJunction) {
        addEvent('unsafeLane', atJunction ? 'Lane change at a junction' : 'Cut in too close',
          POINTS.unsafeLane, atJunction ? 'No lane changes at the crossing.' : 'That was too close. Check your mirrors.');
      } else if (weaving) {
        addEvent('unsafeLane', 'Weaving between lanes', POINTS.unsafeLane, 'Stop weaving between lanes.');
      } else if (game.level.indicators && !signalled) {
        addEvent('noIndicator', `Lane change ${dir} without indicator`, POINTS.noIndicator, 'Use your indicator before changing lanes.');
      } else if (took < 4 && !L.straddleFlag) {
        addEvent('cleanLane', signalled ? 'Clean lane change with indicator' : 'Clean lane change', POINTS.cleanLane, null);
      }
      game.indicator.dir = null;
      L.settled = nearestIdx;
    }
    L.settledT = game.t;
    L.straddleT = 0;
    L.straddleFlag = false;
  }

  // ---- Hands off the wheel ----
  if (input.source === 'camera' && !input.wheelHeld && !input.halt) {
    T.lost += dt;
    if (T.lost > 1.2 && !input.resting) say('Hold the steering wheel with both hands to drive.', { key: 'lost', cooldown: 8000 });
  } else T.lost = 0;

  // ---- Telemetry ----
  T.tele += dt;
  if (T.tele >= 0.25) {
    T.tele = 0;
    game.telemetry.push({ t: game.t, kmh, score: game.score, x: game.x, halt, limit: zone.limit });
  }

  if (!game.halfwaySaid && game.s > game.length / 2) {
    game.halfwaySaid = true;
    say('Halfway there. Keep it civic.', { key: 'half' });
  }

  sfx.updateEngine(game.v, true);

  if (game.score <= 0) {
    if (game.level.secondChance && !game.secondChanceUsed) {
      // One second chance per free drive: learning beats punishment
      game.secondChanceUsed = true;
      game.score = 30;
      game.events.push({ t: game.t, s: game.s, type: 'secondChance', label: 'Second chance: score reset to 30', points: 0 });
      game.popup = { text: 'Second chance!', sub: 'Score back to 30. Drive carefully.', kind: 'good', t: game.t };
      say('Second chance. Your score is back to thirty. Drive carefully now.', { urgent: true });
    } else if (game.level.id > 0) finish('failed');
    else finish('suspended');
  } else if (game.s >= game.length) finish('finish');
}

/* ---------------- Report ---------------- */

export function buildReport() {
  const signals = game.signals.filter((g) => g.passed);
  const reds = signals.filter((g) => g.result === 'run' || g.result === 'stopped' || g.result === 'yellow');
  const c = game.counts;
  const score = Math.round(game.score);
  const F = game.focus;
  const attention = F.watched > 5 ? Math.round((100 * F.attentive) / F.watched) : null;
  const route = game.level.route;
  const r = {
    player: game.player,
    date: new Date(),
    route: `${route.name}, Lahore`,
    routeFrom: route.from,
    routeTo: route.to,
    levelId: game.level.id,
    levelName: game.level.name,
    reason: game.endReason,
    failReason: game.pendingFail,
    mode: game.mode,
    view: game.view,
    car: game.car,
    carName: carById(game.car).name,
    age: game.profile.age,
    cnic: game.profile.cnicMasked,
    score,
    ...gradeFor(score),
    distance: Math.min(game.s, game.length),
    routeLength: game.length,
    time: game.t,
    avgKmh: game.t > 0 ? (game.s / game.t) * 3.6 : 0,
    maxKmh: game.maxKmh,
    signalsPassed: signals.length,
    redsFaced: reds.length,
    redsRun: c.redLight || 0,
    properStops: c.goodStop || 0,
    counts: { ...c },
    events: [...game.events],
    telemetry: [...game.telemetry],
    attention,
    focusAlerts: c.focus || 0,
    maxCombo: game.maxCombo,
    drivingXp: game.xp,
    bestMoment: game.bestMoment,
    secondChanceUsed: game.secondChanceUsed,
  };
  r.skills = computeSkills(r);
  return r;
}
