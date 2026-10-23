// Shared helpers for the tests: fake landmarks, an in-memory localStorage, and scripted drivers.

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

/** A seated player facing the camera. Coordinates are the RAW camera frame (player's left = larger x). */
export function body({ lw = [0.6, 0.62], rw = [0.4, 0.62], re = [0.38, 0.6], le = [0.62, 0.6], visHands = 1, scale = 1, cx = 0.5 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.9, visibility: 0.1 }));
  const s = (x) => cx + (x - 0.5) * scale;
  lm[0] = { x: s(0.5), y: 0.3, visibility: 0.99 };
  lm[11] = { x: s(0.6), y: 0.45, visibility: 0.99 };
  lm[12] = { x: s(0.4), y: 0.45, visibility: 0.99 };
  lm[13] = { x: s(le[0]), y: le[1], visibility: 0.95 };
  lm[14] = { x: s(re[0]), y: re[1], visibility: 0.95 };
  lm[15] = { x: s(lw[0]), y: lw[1], visibility: visHands };
  lm[16] = { x: s(rw[0]), y: rw[1], visibility: visHands };
  return lm;
}

/**
 * Drive a whole level with a scripted player and return the report.
 * style 'good' obeys every rule (indicators, ambulance, signals); 'bad' floors it and weaves.
 */
export function drive(mods, level, style = 'good') {
  const { game, resetGame, setPhase, stepFrame, buildReport } = mods.state;
  const { input, resetInput } = mods.input;
  const { LANES, CAR_LEN, NPC_TYPES } = mods.config;
  resetGame(style, 'keyboard', level);
  resetInput('keyboard');
  game.seatbelt = style === 'good';
  setPhase('playing');
  input.source = 'camera'; // so the keyboard reader doesn't overwrite our scripted input
  input.wheelHeld = true;
  input.steerSource = 'wheel';
  input.wheelLift = 0.5;
  let laneTarget = 1;
  let changeTimer = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 900 && game.phase === 'playing'; i++) {
    if (game.replay) {
      stepFrame(dt);
      continue;
    }
    const front = game.s + CAR_LEN / 2;
    const sig = game.signals.find((g) => g.s > front - 0.5);
    const d = sig ? sig.s - front : 999;
    const zoneLimit = mods.state.limitAt(game.s + 40).limit;
    if (style === 'good') {
      input.throttle = Math.min(0.68, (zoneLimit - 8) / 80);
      input.halt = !!sig && sig.state !== 'green' && d < 30 && d > -0.5;
      const near = (n, lane, ahead, behind) => n.active && Math.abs(n.x - LANES[lane]) < 1.6 && n.s - game.s < ahead && game.s - n.s < behind;
      const lead = game.npcs.filter((n) => n.active && n.type !== 'bike' && n.type !== 'ambulance' && Math.abs(n.x - game.x) < 2 && n.s > game.s).sort((a, b) => a.s - b.s)[0];
      const amb = game.npcs.find((n) => n.active && n.type === 'ambulance' && game.s - n.s > 0 && game.s - n.s < 70 && Math.abs(n.x - game.x) < 2);
      const bike = game.npcs.find((n) => n.active && n.type === 'bike' && n.s - game.s < 120 && n.s > game.s && Math.abs(n.x - game.x) < 1.5);
      changeTimer -= dt;
      const slowLead = lead && lead.s - game.s < 40 && lead.v < 8;
      const needMove = amb || bike || slowLead || (lead && lead.s - game.s < 25);
      const atJunction = game.signals.some((g) => game.s > g.s - 30 && game.s < g.s + 20);
      if (needMove && changeTimer <= 0 && (!atJunction || amb || bike)) {
        const options = [laneTarget - 1, laneTarget + 1].filter((l) => l >= 0 && l <= 2);
        const free = options.find((l) => !game.npcs.some((n) => n.type !== 'bike' && near(n, l, 35, 18)));
        if (free !== undefined) {
          input.indicator = free > laneTarget ? 'right' : 'left';
          laneTarget = free;
          changeTimer = 5.5;
        }
      }
      // Follow at a safe gap: never faster than the vehicle ahead once close
      const top = mods.config.carById(game.car).top / 3.6;
      if (lead) {
        const g = lead.s - NPC_TYPES[lead.type].len / 2 - front;
        if (g < 22) input.throttle = Math.min(input.throttle, (lead.v * (g < 10 ? 0.6 : 0.95)) / top);
        // Brake (right hand up) when closing in on a slower or stopped vehicle
        if (game.v > lead.v + 0.5 && g < 4 + (game.v - lead.v) * 2.2) input.halt = true;
      }
      // Abort a planned lane change if the target lane filled up during the indicator second
      if (changeTimer > 4.5 && changeTimer < 4.6 && game.npcs.some((n) => n.type !== 'bike' && near(n, laneTarget, 14, 10))) {
        laneTarget = mods.config.LANES.reduce((b, c, k) => (Math.abs(game.x - c) < Math.abs(game.x - mods.config.LANES[b]) ? k : b), 0);
      }
      const err = LANES[laneTarget] - game.x;
      input.steer = changeTimer > 4.5 ? 0 : Math.abs(err) > 0.3 ? Math.sign(err) : 0;
    } else {
      input.throttle = 1;
      input.halt = false;
      input.steer = Math.sin(i / 90) * 0.5;
    }
    stepFrame(dt);
  }
  return buildReport();
}
