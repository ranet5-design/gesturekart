// Pure gesture maths: turns one frame of MediaPipe Pose landmarks into "steering wheel" readings.
// No browser APIs here, so it can be unit-tested in Node.

const NOSE = 0;
const L_SHOULDER = 11; // the person's own left
const R_SHOULDER = 12;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;
// Upper body is enough, so players can sit down
const REQUIRED = [NOSE, L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST];
const CORE = [NOSE, L_SHOULDER, R_SHOULDER];
const GOOD = 0.65;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const vis = (p) => (p ? p.visibility ?? 1 : 0);

/**
 * @param lm      33 pose landmarks (x, y in 0..1 of the raw, un-mirrored camera frame)
 * @param aspect  video width / height, so x and y distances are comparable
 * @returns {{visible, held, angle, lift, haltRaw}}
 *   visible  shoulders are in view
 *   held     both hands are up in front of the body, like holding a wheel
 *   angle    wheel rotation in radians, + = turned right (clockwise from the driver's view)
 *   lift     0 = wheel held low (slow) .. 1 = wheel held at shoulder height (fast)
 *   haltRaw  right hand raised above the head this frame
 */
export function readGesture(lm, aspect = 4 / 3) {
  const out = {
    visible: false, held: false, angle: 0, lift: 0.5, haltRaw: false, lean: 0, bodyLean: 0,
    sw: 0, span: 0, indicator: null, beltReach: false, beltDown: false, brakeIntent: false, handsSeen: 0,
  };
  if (!lm) return out;
  const ls = lm[L_SHOULDER];
  const rs = lm[R_SHOULDER];
  if (vis(ls) < 0.5 || vis(rs) < 0.5) return out;
  out.visible = true;

  const sw = Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y) || 0.2; // shoulder width = body-size unit
  out.sw = sw;
  const shoulderY = (ls.y + rs.y) / 2;
  const nose = lm[NOSE];
  const lw = lm[L_WRIST];
  const rw = lm[R_WRIST];
  const le = lm[L_ELBOW];
  const re = lm[R_ELBOW];

  // Mirror x so "left" means the driver's left, like looking through the windscreen.
  const mx = (p) => (1 - p.x) * aspect;
  const SLx = mx(ls);
  const SRx = mx(rs);

  // Torso lean (from the brief): shoulder line tilt. + = leaning right. Works without hands in view.
  out.lean = clamp(Math.atan2(rs.y - ls.y, SRx - SLx) / 0.35, -1.5, 1.5);
  // Whole-body sideways lean for the brief's "lean torso to steer": shoulder tilt plus how far the
  // head has moved over to one side of the shoulders. + = leaning right (as the player sees it).
  if (vis(nose) > 0.5) {
    const headOff = (mx(nose) - (SLx + SRx) / 2) / sw;
    out.bodyLean = clamp(0.5 * out.lean + 0.5 * (headOff / 0.3), -1.5, 1.5);
  } else out.bodyLean = out.lean;

  // Brake: right hand clearly above the head. If the hand goes past the top of the frame,
  // a raised right elbow still counts.
  out.haltRaw =
    (vis(rw) > 0.5 && vis(nose) > 0.5 && rw.y < nose.y - sw * 0.1) ||
    (vis(rw) < 0.5 && vis(re) > 0.5 && re.y < rs.y - sw * 0.35);
  // The right hand on its way up to brake: well above the shoulders. While rising it would look like
  // "left hand low, right hand high" = turning left, so this is not treated as steering.
  out.brakeIntent =
    out.haltRaw ||
    (vis(rw) > 0.5 && rw.y < shoulderY - sw * 0.3) ||
    (vis(re) > 0.5 && re.y < rs.y - sw * 0.15);

  // Indicator: stretch one arm straight out to the side at shoulder height
  // Only ONE arm out counts: both hands spread wide is the speed gesture, not an indicator.
  const armOut = (w, e, sx, sy, dir) => {
    const beyond = (p) => (dir < 0 ? sx - mx(p) : mx(p) - sx);
    const wristOut = vis(w) > 0.5 && beyond(w) > sw * 1.05 && Math.abs(w.y - sy) < sw * 0.45;
    const elbowOut = vis(e) > 0.5 && beyond(e) > sw * 0.55 && Math.abs(e.y - sy) < sw * 0.4 && vis(w) < 0.5;
    return wristOut || elbowOut;
  };
  const leftOut = armOut(lw, le, SLx, ls.y, -1);
  const rightOut = !out.haltRaw && armOut(rw, re, SRx, rs.y, 1);
  if (leftOut && !rightOut) out.indicator = 'left';
  else if (rightOut && !leftOut) out.indicator = 'right';

  // Seatbelt: right hand reaches over to the left shoulder, then pulls down to the right hip
  if (vis(rw) > 0.5) {
    out.beltReach = Math.hypot(mx(rw) - SLx, rw.y - ls.y) < sw * 0.6;
    out.beltDown = rw.y > shoulderY + sw * 1.0 && mx(rw) > (SLx + SRx) / 2;
  }

  out.rwY = vis(rw) > 0.5 ? rw.y : null;
  out.lwY = vis(lw) > 0.5 ? lw.y : null;
  const bothHands = vis(lw) > 0.5 && vis(rw) > 0.5;
  out.handsSeen = (vis(lw) > 0.5 ? 1 : 0) + (vis(rw) > 0.5 ? 1 : 0);
  // Hands pushed right up to the lens track badly; MediaPipe's z is smaller = closer to the camera
  if (bothHands && Number.isFinite(lw.z) && Number.isFinite(ls.z)) {
    out.handsTooClose = (ls.z + rs.z) / 2 - (lw.z + rw.z) / 2 > sw * 1.6;
  }
  if (!bothHands || out.brakeIntent || out.indicator) return out;

  const Lx = mx(lw);
  const Rx = mx(rw);
  const span = Math.hypot(Rx - Lx, rw.y - lw.y) / sw;
  out.span = span;
  const lowest = Math.max(lw.y, rw.y);
  // Hands roughly a wheel-width apart and not resting down in the lap
  out.held = span > 0.45 && span < 4 && lowest < shoulderY + sw * 1.5;

  if (!out.held) return out;

  // Turning right: the left hand rises, the right hand drops.
  out.angle = clamp(Math.atan2(rw.y - lw.y, Rx - Lx), -1.3, 1.3);
  const midY = (lw.y + rw.y) / 2;
  out.lift = clamp((shoulderY + sw * 1.3 - midY) / (sw * 1.3), 0, 1);
  return out;
}

/**
 * Is the player framed well enough to lock on?
 * ok      everything needed is clearly visible and well placed (needed to build the lock)
 * coreOk  head and shoulders still visible (enough to keep an existing lock while braking etc.)
 * issue   a plain-language hint for what to fix
 * parts   how many of the 7 upper-body points are clearly seen
 */
export function bodyCheck(lm) {
  if (!lm) return { ok: false, coreOk: false, issue: 'Sit in front of the camera', parts: 0 };
  const seen = (i) => vis(lm[i]) >= GOOD && lm[i].x > 0.02 && lm[i].x < 0.98 && lm[i].y > 0.02 && lm[i].y < 0.98;
  const parts = REQUIRED.filter(seen).length;
  const coreOk = CORE.every(seen);
  const ls = lm[L_SHOULDER];
  const rs = lm[R_SHOULDER];
  const width = Math.abs(ls.x - rs.x);
  const midX = (ls.x + rs.x) / 2;
  let issue = '';
  if (!coreOk) issue = 'Face the camera so your head and both shoulders are visible';
  else if (width > 0.55) issue = 'Move back a little';
  else if (width < 0.13) issue = 'Move closer to the camera';
  else if (midX < 0.3 || midX > 0.7) issue = 'Move to the centre of the frame';
  else if (!seen(L_WRIST) || !seen(R_WRIST)) issue = 'Hold both hands up in front of your chest';
  else if (!seen(L_ELBOW) || !seen(R_ELBOW)) issue = 'Keep both elbows in view';
  return { ok: !issue, coreOk, issue, parts };
}

/**
 * Advance the lock meter by one frame. Building a lock needs a perfect frame for ~1.5 s in a row.
 * Once locked, only losing the head/shoulders wears it down, so raising a hand to brake is fine.
 */
export function stepLock(state, check, dt) {
  let { lock, locked } = state;
  if (locked) {
    lock = check.coreOk ? Math.min(1, lock + dt / 1.5) : Math.max(0, lock - dt / 1.0);
    if (lock < 0.4) locked = false;
  } else {
    // Every bad frame costs as much as ~5 good ones, so shaky tracking can't sneak up to 100%
    lock = check.ok ? Math.min(1, lock + dt / 1.5) : Math.max(0, lock - 0.1);
    if (lock >= 1) locked = true;
  }
  return { lock, locked };
}

// Wheel angle -> steering command with a small dead zone. Full lock at about 40 degrees.
export function angleToSteer(angle, dead = 0.12, full = 0.7) {
  const a = Math.abs(angle);
  if (a < dead) return 0;
  return Math.sign(angle) * clamp((a - dead) / (full - dead), 0, 1);
}

/** Steering = the wheel, plus a little extra if you lean into the turn (big dead zone, so sitting normally adds nothing). */
export function combineSteer(wheelSteer, lean) {
  const a = Math.abs(lean);
  const leanSteer = a < 0.35 ? 0 : Math.sign(lean) * Math.min(1, (a - 0.35) / 0.65) * 0.5;
  return clamp(wheelSteer + leanSteer, -1, 1);
}

/** Torso lean -> steering (the brief's main steering control). Dead zone so sitting normally is straight. */
export function leanToSteer(lean, dead = 0.2, full = 0.9) {
  const a = Math.abs(lean);
  if (a < dead) return 0;
  return Math.sign(lean) * clamp((a - dead) / (full - dead), 0, 1);
}

// Wheel height -> gas. Chest height is a normal ~45 km/h, shoulder height is fast.
export const liftToThrottle = (lift) => 0.25 + 0.65 * lift;

// Hand distance -> gas (the brief's "distance between hands" control). 1 shoulder-width = slow, 2.6 = full.
export const spanToThrottle = (span) => clamp((span - 0.8) / (2.6 - 0.8), 0.1, 1);

// Lean forward / back -> gas: shoulders look wider when you lean toward the camera.
export const leanFwdToThrottle = (sw, baseSw) => (baseSw > 0 ? clamp(0.55 + (sw / baseSw - 1) * 2.5, 0.15, 1) : 0.55);

/**
 * One-hand mode: a single raised hand steers by moving left/right in front of the chest,
 * sets speed by its height, and brakes by going above the head.
 */
export function readOneHand(lm, aspect = 4 / 3) {
  const out = { held: false, steer: 0, lift: 0.5, haltRaw: false };
  if (!lm) return out;
  const ls = lm[L_SHOULDER];
  const rs = lm[R_SHOULDER];
  if (vis(ls) < 0.5 || vis(rs) < 0.5) return out;
  const sw = Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y) || 0.2;
  const shoulderY = (ls.y + rs.y) / 2;
  const midX = (1 - (ls.x + rs.x) / 2) * aspect;
  const nose = lm[NOSE];
  const w = vis(lm[R_WRIST]) > 0.5 ? lm[R_WRIST] : vis(lm[L_WRIST]) > 0.5 ? lm[L_WRIST] : null;
  if (!w) return out;
  if (vis(nose) > 0.5 && w.y < nose.y - sw * 0.1) {
    out.haltRaw = true;
    return out;
  }
  out.held = w.y < shoulderY + sw * 1.6;
  if (!out.held) return out;
  const dx = ((1 - w.x) * aspect - midX) / (sw * 0.9);
  out.steer = Math.abs(dx) < 0.15 ? 0 : clamp((Math.abs(dx) - 0.15) / 0.85, 0, 1) * Math.sign(dx);
  out.lift = clamp((shoulderY + sw * 1.3 - w.y) / (sw * 1.3), 0, 1);
  return out;
}
