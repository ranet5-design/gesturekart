// Pure focus / drowsiness maths (no browser APIs), so it can be unit-tested.
// Input each frame: { seen, blink (0..1), jaw (0..1), yaw (rad), pitch (rad) } from MediaPipe Face Landmarker.

const COOLDOWN = { eyes: 4, away: 5, down: 5, noface: 6, yawn: 20, drowsy: 30 };

export function newFocusState() {
  return {
    t: 0,
    closedT: 0,
    awayT: 0,
    downT: 0,
    nofaceT: 0,
    yawnT: 0,
    hist: [], // eyes-closed samples every 0.2 s, last 60 s (PERCLOS)
    histT: 0,
    last: {}, // last time each event fired
    meter: 1,
    base: null, // personal baseline: open-eye blink score, straight-ahead yaw & pitch
    calib: null,
  };
}

export function beginFocusCalibration(S) {
  S.calib = { n: 0, blink: [], yaw: [], pitch: [] };
}

export function endFocusCalibration(S) {
  const c = S.calib;
  S.calib = null;
  if (!c || c.n < 10) return;
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  S.base = { blink: Math.min(0.35, med(c.blink)), yaw: med(c.yaw), pitch: med(c.pitch) };
}

/**
 * Advance one frame.
 * @returns {{ events: string[], attentive: boolean, eyesClosed: boolean, meter: number }}
 *   events   'eyes' | 'drowsy' | 'yawn' | 'away' | 'down' | 'noface' (rate-limited)
 *   meter    0..1 "how alert are you right now"; reaches 1 after ~3 s of steady attention
 */
export function stepFocus(S, o, dt) {
  S.t += dt;
  const events = [];
  const fire = (name) => {
    if (S.t - (S.last[name] ?? -1e9) >= COOLDOWN[name]) {
      S.last[name] = S.t;
      events.push(name);
    }
  };

  if (S.calib && o.seen) {
    S.calib.n++;
    S.calib.blink.push(o.blink);
    S.calib.yaw.push(o.yaw);
    S.calib.pitch.push(o.pitch);
  }

  const base = S.base || { blink: 0.1, yaw: 0, pitch: 0 };
  const closedThr = Math.max(0.5, base.blink + 0.32);
  const closed = o.seen && o.blink > closedThr;
  const away = o.seen && Math.abs(o.yaw - base.yaw) > 0.45; // ~26° to the side
  const down = o.seen && Math.abs(o.pitch - base.pitch) > 0.38; // ~22° up/down (phone in lap)
  const yawning = o.seen && o.jaw > 0.6;

  // Normal blinks last < 0.4 s, so only long closures count
  S.closedT = closed ? S.closedT + dt : 0;
  S.awayT = away ? S.awayT + dt : 0;
  S.downT = down && !closed ? S.downT + dt : 0;
  S.nofaceT = o.seen ? 0 : S.nofaceT + dt;
  S.yawnT = yawning ? S.yawnT + dt : 0;

  if (S.closedT > 1.3) fire('eyes');
  if (S.awayT > 2) fire('away');
  if (S.downT > 2) fire('down');
  if (S.nofaceT > 2.5) fire('noface');
  if (S.yawnT > 1.5) fire('yawn');

  S.histT += dt;
  if (S.histT >= 0.2) {
    S.histT = 0;
    S.hist.push(closed ? 1 : 0);
    if (S.hist.length > 300) S.hist.shift();
    if (S.hist.length >= 100) {
      const perclos = S.hist.reduce((a, b) => a + b, 0) / S.hist.length;
      if (perclos > 0.18) fire('drowsy');
    }
  }

  const attentive = o.seen && !closed && !away && !down;
  S.meter = Math.max(0, Math.min(1, S.meter + (attentive ? dt / 3 : -dt / 1)));
  return { events, attentive, eyesClosed: closed, meter: S.meter };
}

/** Head yaw / pitch (radians) from MediaPipe's 4×4 column-major facial transformation matrix. */
export function headAngles(m) {
  if (!m || m.length < 16) return { yaw: 0, pitch: 0 };
  return { yaw: Math.atan2(m[8], m[10]), pitch: Math.atan2(-m[9], m[10]) };
}
