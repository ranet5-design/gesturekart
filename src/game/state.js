import {
  LANES, ROAD_HALF, CAR_LEN, CAR_W, MAX_SPEED, SPEED_LIMIT_KMH,
  ROUTE_LENGTH, ROUTE_NAME, POINTS, NPC_TYPES,
} from './config.js';
import { input, updateKeyboard } from '../cv/input.js';
import { say } from '../audio/voice.js';
import * as sfx from '../audio/sound.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NPC_SLOTS = ['car', 'rickshaw', 'car', 'bus', 'rickshaw', 'car', 'rickshaw', 'car', 'car', 'rickshaw'];

/* All live game data lives in this one mutable object. The 3D scene and HUD read it;
   only this file writes to it. React re-renders are avoided during play for smooth 60 FPS. */
export const game = {
  phase: 'menu', // menu | loading | practice | countdown | playing | paused | over
  view: 'cockpit', // 'cockpit' (driver's seat) | 'chase' (behind the car)
  runId: 0,
  player: 'Driver',
  mode: 'keyboard',
  t: 0,
  s: 0, // distance along the road (m)
  x: 0, // lateral position (m), negative = left
  v: 0, // speed (m/s)
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
  lane: { settled: 1, settledT: 0, leftT: 0, straddleT: 0, straddleFlag: false },
  timers: { over: 0, overFlag: false, tail: 0, tailFlag: false, lost: 0, tele: 0 },
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

function buildSignals() {
  const list = [];
  let s = 170;
  while (s < ROUTE_LENGTH - 140) {
    list.push({
      id: list.length,
      s, // stop line position
      state: 'green',
      timer: 0,
      triggered: false,
      // The first signal always turns red so every player learns the halt gesture.
      willTurn: list.length === 0 || Math.random() < 0.72,
      passed: false,
      stopped: false,
      cued: false,
      result: null, // 'run' | 'stopped' | 'green' | 'yellow'
    });
    s += rand(230, 300);
  }
  return list;
}

export function resetGame(player = 'Driver', mode = 'keyboard') {
  Object.assign(game, {
    runId: game.runId + 1,
    player: player.trim() || 'Driver',
    mode,
    t: 0, s: 0, x: LANES[1], v: 0, yaw: 0, roll: 0, braking: false,
    score: 100, maxKmh: 0, shake: 0, invuln: 0, endReason: '',
    events: [], telemetry: [], counts: {},
    lane: { settled: 1, settledT: 0, lastChangeT: -99, straddleT: 0, straddleFlag: false },
    timers: { over: 0, overFlag: false, tail: 0, tailFlag: false, lost: 0, tele: 0 },
    halfwaySaid: false,
  });
  game.signals = buildSignals();
  game.npcs = NPC_SLOTS.map((type, id) => ({
    id, type, active: false, s: 0, x: 0, v: 0, cruise: 10, braking: false,
  }));
  game.peds = Array.from({ length: 8 }, (_, id) => ({
    id, active: false, s: 0, x: 0, dir: 1, speed: 1.8, delay: 0, hit: false, sig: -1, phase: 0,
  }));
  // A little traffic already on the road
  [45, 90, 135].forEach((s, i) => spawnNpc(s, i % 3));
  spawnTimer = 1;
}

/* ---------------- Events & scoring ---------------- */

function addEvent(type, label, points, voiceText, { sound = true } = {}) {
  game.score = clamp(game.score + points, 0, 100);
  game.counts[type] = (game.counts[type] || 0) + 1;
  game.events.push({ t: game.t, s: game.s, type, label, points });
  if (sound) points < 0 ? sfx.buzz() : sfx.chime();
  if (voiceText) say(voiceText, { key: 'ev-' + type, cooldown: 2500, urgent: points < 0 });
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
  game.endReason = reason;
  game.v = 0;
  sfx.updateEngine(0, false);
  if (reason === 'finish') say('You reached the finish. Here is your civic driving score.', { urgent: true });
  else if (reason === 'suspended') say('Licence suspended. Too many violations.', { urgent: true });
  else say('Drive ended. Here is your score card.', { urgent: true });
  setPhase('over');
}

export function endDrive() {
  if (game.phase === 'playing' || game.phase === 'paused') finish('quit');
}

/* ---------------- Traffic ---------------- */

let spawnTimer = 0;

function spawnNpc(s, laneIdx) {
  const free = game.npcs.filter((n) => !n.active);
  if (!free.length) return;
  const lane = laneIdx ?? Math.floor(Math.random() * 3);
  const x = LANES[lane];
  const blocked = game.npcs.some((n) => n.active && Math.abs(n.x - x) < 1 && Math.abs(n.s - s) < 28);
  const nearSignal = game.signals.some((g) => s > g.s - 6 && s < g.s + 16);
  if (blocked || nearSignal || s > ROUTE_LENGTH + 40) return;
  const pick = free[Math.floor(Math.random() * free.length)];
  const cruise = pick.type === 'bus' ? rand(8, 10) : pick.type === 'rickshaw' ? rand(6.5, 9) : rand(9.5, 13);
  Object.assign(pick, { active: true, s, x, v: cruise * 0.7, cruise, braking: false });
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
    let target = n.cruise;

    // Obey signals: stop at the line on yellow or red
    const sig = nextSignalAhead(front);
    if (sig && sig.state !== 'green') {
      const d = sig.s - front - 0.8;
      if (!(sig.state === 'yellow' && d < 3)) target = Math.min(target, Math.max(0, d * 0.55));
    }
    // Keep distance from the vehicle ahead (NPC or player)
    for (const o of game.npcs) {
      if (o === n || !o.active || Math.abs(o.x - n.x) > 2 || o.s <= n.s) continue;
      const gap = o.s - NPC_TYPES[o.type].len / 2 - front;
      if (gap < 30) target = Math.min(target, Math.max(0, o.v + (gap - 4) * 0.6));
    }
    if (Math.abs(game.x - n.x) < 2.2 && game.s > n.s) {
      const gap = game.s - CAR_LEN / 2 - front;
      if (gap < 30) target = Math.min(target, Math.max(0, game.v + (gap - 5) * 0.6));
    }
    const dv = target - n.v;
    n.braking = dv < -0.5;
    n.v = Math.max(0, n.v + clamp(dv, -9 * dt, 2.5 * dt));
    n.s += n.v * dt;
    if (n.s < game.s - 45 || n.s > game.s + 340) n.active = false;
  }

  spawnTimer -= dt;
  const active = game.npcs.filter((n) => n.active).length;
  if (spawnTimer <= 0 && active < 6) {
    spawnNpc(game.s + rand(150, 270));
    spawnTimer = rand(1.2, 2.6);
  }
}

/* ---------------- Signals & pedestrians ---------------- */

function spawnPeds(sig) {
  const n = 2 + Math.floor(Math.random() * 2);
  let made = 0;
  for (const p of game.peds) {
    if (p.active || made >= n) continue;
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

    // Coach the player as they approach a signal that is not green
    if (sig.state !== 'green' && !sig.cued && dist > 4 && dist < 55 && game.v > 4) {
      sig.cued = true;
      say(
        sig.state === 'red'
          ? 'Red light ahead! Raise your right hand to stop.'
          : 'Signal is changing. Get ready to stop.',
        { key: 'approach', cooldown: 2000, urgent: true },
      );
    }
    // Stopped properly before the line (or in the queue behind other cars)
    if (sig.state !== 'green' && !sig.stopped && dist > -0.5 && dist < 45 && game.v < 0.6) {
      sig.stopped = true;
      say('Good stop. Wait for the green.', { key: 'goodstop', cooldown: 3000 });
    }
    // Crossing the stop line
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
    if (p.hit) {
      p.delay = 0;
      continue;
    }
    p.x += p.dir * p.speed * dt;
    p.phase += dt * 8;
    if (p.x * p.dir > ROAD_HALF + 2.5) p.active = false;
  }
}

/* ---------------- Main step ---------------- */

export function stepFrame(dt) {
  if (game.phase === 'menu') {
    // Attract mode: drift down the road behind the menu
    game.s += 7 * dt;
    if (game.s > ROUTE_LENGTH - 200) game.s = 0;
    game.v = 7;
    return;
  }
  if (game.phase !== 'playing') {
    sfx.updateEngine(0, game.phase === 'countdown');
    return;
  }

  game.t += dt;
  updateKeyboard(dt);

  // ---- Player longitudinal motion ----
  const halt = input.halt;
  const target = halt ? 0 : input.throttle * MAX_SPEED;
  const accel = halt ? 11 : target > game.v ? 5 : 4;
  game.v = Math.max(0, game.v + clamp(target - game.v, -accel * dt, accel * dt));
  game.braking = halt || target < game.v - 0.5;

  // ---- Player lateral motion ----
  const steer = input.steer;
  const nearestIdx = LANES.reduce((best, c, i) => (Math.abs(game.x - c) < Math.abs(game.x - LANES[best]) ? i : best), 0);
  let vx;
  if (Math.abs(steer) < 0.08) {
    // Gentle lane-keep assist pulls you to the centre of your lane when you sit upright
    vx = clamp(LANES[nearestIdx] - game.x, -1, 1) * 1.8;
  } else {
    vx = steer * (3 + game.v * 0.28);
  }
  vx *= clamp(game.v / 3, 0, 1); // can't slide sideways when stopped
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

  updateSignals(dt, prevFront, front);
  updateNpcs(dt);

  // ---- Collisions ----
  if (game.invuln <= 0) {
    for (const n of game.npcs) {
      if (!n.active) continue;
      const spec = NPC_TYPES[n.type];
      const ox = (CAR_W + spec.w) / 2 - 0.15 - Math.abs(n.x - game.x);
      const os = (CAR_LEN + spec.len) / 2 - 0.15 - Math.abs(n.s - game.s);
      if (ox > 0 && os > 0) {
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

  // ---- Over-speeding ----
  const T = game.timers;
  if (kmh > SPEED_LIMIT_KMH + 3) {
    T.over += dt;
    if (T.over > 0.4) say('Slow down. The limit is sixty.', { key: 'speed', cooldown: 7000 });
    if (T.over > 2.5 && !T.overFlag) {
      T.overFlag = true;
      addEvent('overspeed', `Over-speeding (${Math.round(kmh)} km/h)`, POINTS.overspeed, null);
    }
  } else if (kmh < SPEED_LIMIT_KMH - 2) {
    T.over = 0;
    T.overFlag = false;
  }

  // ---- Tailgating ----
  let lead = null;
  for (const n of game.npcs) {
    if (!n.active || Math.abs(n.x - game.x) > 2 || n.s <= game.s) continue;
    if (!lead || n.s < lead.s) lead = n;
  }
  const gap = lead ? lead.s - NPC_TYPES[lead.type].len / 2 - front : Infinity;
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

  // ---- Lane discipline ----
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
      // Finished a lane change: judge it
      const took = game.t - L.settledT;
      const crowded = game.npcs.some(
        (n) => n.active && Math.abs(n.x - LANES[nearestIdx]) < 1.2 && Math.abs(n.s - game.s) < 9,
      );
      const atJunction = game.signals.some((g) => game.s > g.s - 12 && game.s < g.s + 14);
      const weaving = game.t - L.lastChangeT < 5;
      L.lastChangeT = game.t;
      if (crowded || atJunction) {
        addEvent('unsafeLane', atJunction ? 'Lane change at a junction' : 'Cut in too close',
          POINTS.unsafeLane, atJunction ? 'No lane changes at the crossing.' : 'That was too close. Check your mirrors.');
      } else if (weaving) {
        addEvent('unsafeLane', 'Weaving between lanes', POINTS.unsafeLane, 'Stop weaving between lanes.');
      } else if (took < 4 && !L.straddleFlag) {
        addEvent('cleanLane', 'Clean lane change', POINTS.cleanLane, null);
        say('Clean lane change.', { key: 'clean', cooldown: 6000 });
      }
      L.settled = nearestIdx;
    }
    L.settledT = game.t;
    L.straddleT = 0;
    L.straddleFlag = false;
  }

  // ---- Hands off the wheel (the car rolls to a stop) ----
  if (input.source === 'camera' && !input.wheelHeld && !input.halt) {
    T.lost += dt;
    if (T.lost > 1.2) say('Hold the steering wheel with both hands to drive.', { key: 'lost', cooldown: 8000 });
  } else T.lost = 0;

  // ---- Telemetry for the score card graph ----
  T.tele += dt;
  if (T.tele >= 0.25) {
    T.tele = 0;
    game.telemetry.push({ t: game.t, kmh, score: game.score, x: game.x, halt });
  }

  if (!game.halfwaySaid && game.s > ROUTE_LENGTH / 2) {
    game.halfwaySaid = true;
    say('Halfway there. Keep it civic.', { key: 'half' });
  }

  sfx.updateEngine(game.v, true);

  if (game.score <= 0) finish('suspended');
  else if (game.s >= ROUTE_LENGTH) finish('finish');
}

/* ---------------- Report ---------------- */

export function buildReport() {
  const signals = game.signals.filter((g) => g.passed);
  const reds = signals.filter((g) => g.result === 'run' || g.result === 'stopped' || g.result === 'yellow');
  const c = game.counts;
  const score = Math.round(game.score);
  return {
    player: game.player,
    date: new Date(),
    route: ROUTE_NAME,
    reason: game.endReason,
    mode: game.mode,
    score,
    ...gradeFor(score),
    distance: Math.min(game.s, ROUTE_LENGTH),
    routeLength: ROUTE_LENGTH,
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
  };
}
