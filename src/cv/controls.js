// Turns per-frame gesture readings into the car's controls (steer, throttle, brake, indicator, seatbelt).
// Pure code (no camera, no MediaPipe), so it can be unit-tested with synthetic poses.
import { angleToSteer, liftToThrottle, spanToThrottle, leanFwdToThrottle, combineSteer } from './gestures.js';

export function createControls() {
  return {
    haltOn: 0,
    haltOff: 99,
    heldOn: 0,
    heldOff: 0,
    indFrames: 0,
    indDir: null,
    lastIndT: -1e9,
    belt: { phase: 0, t: 0 },
    restFrames: 0,
    noHandsFrames: 0,
    calibSamples: null,
  };
}

/**
 * @param S      controls state from createControls()
 * @param input  the shared input object to write into
 * @param g      readGesture() result      @param one  readOneHand() result or null
 * @param calib  { angle, lean, sw }       @param opts { speedMode, armRest }
 * @param now    ms timestamp
 */
export function applyGesture(S, input, g, one, calib, { speedMode = 'auto', armRest = true } = {}, now = 0) {
  input.poseVisible = g.visible;

  // ---- Brake (debounced so a single bad frame never brakes) ----
  const haltRaw = one ? one.haltRaw : g.haltRaw;
  if (haltRaw) {
    S.haltOn++;
    S.haltOff = 0;
  } else {
    S.haltOff++;
    S.haltOn = 0;
  }
  if (S.haltOn >= 3) input.halt = true;
  if (S.haltOff >= 6) input.halt = false;

  // A brake starts as "right hand shoots up while the left hand stays put". Turning the wheel moves
  // BOTH hands in opposite directions, so this asymmetric raise can't be a turn. Catch it early,
  // before the hand is high enough to count as a brake, and hold the wheel straight for a moment.
  const dt = S.prevT != null ? Math.max(0.001, (now - S.prevT) / 1000) : 0;
  if (dt && g.rwY != null && S.prevR != null && g.lwY != null && S.prevL != null) {
    const vR = (g.rwY - S.prevR) / dt; // negative = moving up
    const vL = (g.lwY - S.prevL) / dt;
    if (vR < -0.35 && Math.abs(vL) < Math.abs(vR) * 0.35) S.raiseUntil = now + 500;
  }
  S.prevR = g.rwY;
  S.prevL = g.lwY;
  S.prevT = now;
  const raising = now < (S.raiseUntil || 0);

  // While the right hand is going up, is up, or just came down from braking: drive straight.
  // (Otherwise the rising hand looks like turning the wheel left and the car swerves.)
  const braking = (one ? one.haltRaw : g.brakeIntent) || raising || input.halt || S.haltOff < 12;

  // ---- Indicator: arm held out for ~4 frames fires once (re-arm after 1.5 s) ----
  if (g.indicator && g.indicator === S.indDir) S.indFrames++;
  else {
    S.indDir = g.indicator;
    S.indFrames = g.indicator ? 1 : 0;
  }
  const signalling = S.indFrames >= 2;
  if (S.indFrames === 4 && now - S.lastIndT > 1500) {
    input.indicator = S.indDir;
    S.lastIndT = now;
  }

  // ---- Seatbelt: reach to the left shoulder, then pull down within 3 s ----
  if (!input.seatbelt) {
    if (g.beltReach) S.belt = { phase: 1, t: now };
    else if (S.belt.phase === 1 && g.beltDown && now - S.belt.t < 3000) {
      input.seatbelt = true;
      S.belt.phase = 2;
    } else if (S.belt.phase === 1 && now - S.belt.t > 3000) S.belt.phase = 0;
  }

  // ---- Is the wheel held? ----
  const heldRaw = one ? one.held : g.held;
  if (heldRaw || signalling || braking) {
    S.heldOn++;
    S.heldOff = 0;
  } else {
    S.heldOff++;
    S.heldOn = 0;
  }
  if (S.heldOn >= 3) input.wheelHeld = true;
  if (S.heldOff >= 8) input.wheelHeld = false;
  S.noHandsFrames = g.handsSeen ? 0 : S.noHandsFrames + 1;

  if (braking || signalling) {
    // Straighten the wheel and keep the current speed; the brake itself is handled by input.halt
    input.steer *= 0.6;
    if (Math.abs(input.steer) < 0.02) input.steer = 0;
    input.wheelAngle *= 0.75;
    input.steerSource = 'wheel';
    S.restFrames = 0;
    input.resting = false;
    return;
  }

  if (heldRaw) {
    S.restFrames = 0;
    input.resting = false;
    input.steerSource = 'wheel';
    if (S.calibSamples) S.calibSamples.push({ angle: g.angle, lean: g.lean, sw: g.sw });
    let steerTarget;
    if (one) {
      steerTarget = one.steer;
      input.wheelAngle += (one.steer * 0.7 - input.wheelAngle) * 0.35;
      input.wheelLift += (one.lift - input.wheelLift) * 0.25;
    } else {
      const angle = g.angle - calib.angle;
      input.wheelAngle += (angle - input.wheelAngle) * 0.35;
      steerTarget = combineSteer(angleToSteer(input.wheelAngle), g.lean - calib.lean);
      input.wheelLift += (g.lift - input.wheelLift) * 0.25;
    }
    input.steer += (steerTarget - input.steer) * 0.35;
    const t =
      speedMode === 'distance' && !one ? spanToThrottle(g.span)
      : speedMode === 'lean' ? leanFwdToThrottle(g.sw, calib.sw)
      : liftToThrottle(input.wheelLift);
    input.throttle += (t - input.throttle) * 0.2;
    return;
  }

  if (!input.wheelHeld) {
    // Hands really out of view (not just a wobbly frame): steer by leaning, as in the brief
    if (g.visible && S.noHandsFrames > 20) {
      const lean = g.lean - calib.lean;
      const a = Math.abs(lean);
      const leanSteer = a < 0.3 ? 0 : Math.sign(lean) * Math.min(1, (a - 0.3) / 0.7);
      input.steer += (leanSteer - input.steer) * 0.25;
      input.steerSource = 'lean';
      input.wheelAngle += (input.steer * 0.7 - input.wheelAngle) * 0.3;
    } else {
      input.steer *= 0.8;
      input.wheelAngle *= 0.85;
    }
    if (speedMode === 'lean' && g.visible) {
      input.throttle += (leanFwdToThrottle(g.sw, calib.sw) - input.throttle) * 0.2;
    } else if (speedMode !== 'auto') {
      // Arm rest: hold the speed for ~6 s, then roll gently to a stop
      S.restFrames++;
      input.resting = armRest && S.restFrames < 180;
      if (!input.resting) input.throttle += (0 - input.throttle) * 0.08;
    }
  }
}
