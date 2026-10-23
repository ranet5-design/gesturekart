import { FilesetResolver, PoseLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { input } from './input.js';
import {
  readGesture, readOneHand, angleToSteer, liftToThrottle, spanToThrottle, leanFwdToThrottle,
  bodyCheck, stepLock, combineSteer,
} from './gestures.js';
import { newFocusState, stepFocus, beginFocusCalibration, endFocusCalibration, headAngles } from './focus.js';
import { settings } from '../game/settings.js';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export const pose = {
  video: null,
  ready: false,
  calib: { angle: 0, lean: 0, sw: 0 },
};

let landmarker = null;
let faceMarker = null;
let stream = null;
let rafId = 0;
let lastVideoTime = -1;
let frame = 0;
let haltOn = 0;
let haltOff = 0;
let heldOn = 0;
let heldOff = 0;
let indFrames = 0;
let indDir = null;
let lastIndT = -1e9;
let belt = { phase: 0, t: 0 };
let restFrames = 0;
let fpsFrames = 0;
let fpsT = 0;
let calibSamples = null;
let lastDetectT = 0;
let lastFaceT = 0;
const focusState = newFocusState();

export async function startPose(onStatus = () => {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot open the webcam. Use Chrome or Edge over HTTPS.');
  }
  onStatus('Asking for webcam access…');
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
    audio: false,
  });
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  pose.video = video;

  onStatus('Loading the body-tracking model…');
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const poseOpts = (delegate) => ({
    baseOptions: { modelAssetPath: POSE_MODEL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, poseOpts('GPU'));
  } catch {
    landmarker = await PoseLandmarker.createFromOptions(fileset, poseOpts('CPU'));
  }

  // The face model powers the focus / drowsiness check. If it can't load, the game still works.
  onStatus('Loading the focus (face) model…');
  const faceOpts = (delegate) => ({
    baseOptions: { modelAssetPath: FACE_MODEL, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  try {
    faceMarker = await FaceLandmarker.createFromOptions(fileset, faceOpts('GPU'));
  } catch {
    try {
      faceMarker = await FaceLandmarker.createFromOptions(fileset, faceOpts('CPU'));
    } catch {
      faceMarker = null;
    }
  }
  input.faceReady = !!faceMarker;

  pose.ready = true;
  input.source = 'camera';
  loop();
}

export function stopPose() {
  cancelAnimationFrame(rafId);
  stream?.getTracks().forEach((t) => t.stop());
  landmarker?.close();
  faceMarker?.close();
  landmarker = null;
  faceMarker = null;
  stream = null;
  pose.video = null;
  pose.ready = false;
  input.landmarks = null;
  input.faceLandmarks = null;
  input.poseVisible = false;
  input.wheelHeld = false;
  input.faceReady = false;
  input.lock = 0;
  input.locked = false;
  lastDetectT = 0;
}

// Learn the player's neutral posture and face (a tilted webcam or a slouch shouldn't steer the car).
export function beginCalibration() {
  calibSamples = [];
  beginFocusCalibration(focusState);
}
export function endCalibration() {
  if (calibSamples && calibSamples.length > 5) {
    const median = (key) => {
      const sorted = calibSamples.map((s) => s[key]).filter((v) => v != null).sort((a, b) => a - b);
      return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    };
    pose.calib.angle = Math.max(-0.25, Math.min(0.25, median('angle')));
    pose.calib.lean = Math.max(-0.6, Math.min(0.6, median('lean')));
    pose.calib.sw = median('sw');
  }
  calibSamples = null;
  endFocusCalibration(focusState);
}
export const resetSeatbelt = () => {
  belt = { phase: 0, t: 0 };
  input.seatbelt = false;
};

function loop() {
  rafId = requestAnimationFrame(loop);
  const video = pose.video;
  if (!landmarker || !video || video.readyState < 2) return;
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  frame++;

  const now = performance.now();
  const result = landmarker.detectForVideo(video, now);
  const lm = result.landmarks?.[0] || null;
  input.landmarks = lm;
  const dt = lastDetectT ? Math.min(0.2, (now - lastDetectT) / 1000) : 0;
  lastDetectT = now;
  const check = bodyCheck(lm);
  const next = stepLock({ lock: input.lock, locked: input.locked }, check, dt);
  input.lock = next.lock;
  input.locked = next.locked;
  input.lockIssue = check.issue;
  input.lockParts = check.parts;
  const aspect = video.videoWidth / video.videoHeight || 4 / 3;
  apply(readGesture(lm, aspect), lm, aspect, now);

  // Face model every other frame keeps both models smooth on ordinary laptops
  if (faceMarker && settings.focusCheck && frame % 2 === 0) {
    const fdt = lastFaceT ? Math.min(0.3, (now - lastFaceT) / 1000) : 0;
    lastFaceT = now;
    runFace(video, now + 0.5, fdt);
  }

  fpsFrames++;
  if (now - fpsT > 1000) {
    input.cvFps = Math.round((fpsFrames * 1000) / (now - fpsT));
    fpsFrames = 0;
    fpsT = now;
  }
}

function runFace(video, ts, dt) {
  let res;
  try {
    res = faceMarker.detectForVideo(video, ts);
  } catch {
    return;
  }
  const seen = !!res.faceLandmarks?.length;
  input.faceLandmarks = seen ? res.faceLandmarks[0] : null;
  let blink = 0;
  let jaw = 0;
  if (seen && res.faceBlendshapes?.[0]) {
    const cats = res.faceBlendshapes[0].categories;
    const get = (n) => cats.find((c) => c.categoryName === n)?.score ?? 0;
    blink = (get('eyeBlinkLeft') + get('eyeBlinkRight')) / 2;
    jaw = get('jawOpen');
  }
  const { yaw, pitch } = headAngles(res.facialTransformationMatrixes?.[0]?.data);
  const out = stepFocus(focusState, { seen, blink, jaw, yaw, pitch }, dt);
  input.faceSeen = seen;
  input.eyesClosed = out.eyesClosed;
  input.attentive = out.attentive;
  input.focusMeter = out.meter;
  if (input.focusArmed) input.focusEvents.push(...out.events);
}

function apply(g, lm, aspect, now) {
  input.poseVisible = g.visible;
  const one = settings.oneHand ? readOneHand(lm, aspect) : null;

  // Debounce so a single bad frame never brakes or lets go of the wheel
  const haltRaw = one ? one.haltRaw : g.haltRaw;
  if (haltRaw) {
    haltOn++;
    haltOff = 0;
  } else {
    haltOff++;
    haltOn = 0;
  }
  if (haltOn >= 3) input.halt = true;
  if (haltOff >= 6) input.halt = false;

  // Indicator: arm held out for ~4 frames fires once (re-arm after 1.5 s)
  if (g.indicator && g.indicator === indDir) indFrames++;
  else {
    indDir = g.indicator;
    indFrames = g.indicator ? 1 : 0;
  }
  const signalling = indFrames >= 2;
  if (indFrames === 4 && now - lastIndT > 1500) {
    input.indicator = indDir;
    lastIndT = now;
  }

  // Seatbelt: reach to the left shoulder, then pull down within 3 s
  if (!input.seatbelt) {
    if (g.beltReach) belt = { phase: 1, t: now };
    else if (belt.phase === 1 && g.beltDown && now - belt.t < 3000) {
      input.seatbelt = true;
      belt.phase = 2;
    } else if (belt.phase === 1 && now - belt.t > 3000) belt.phase = 0;
  }

  const heldRaw = one ? one.held : g.held;
  if (heldRaw || signalling) {
    heldOn++;
    heldOff = 0;
  } else {
    heldOff++;
    heldOn = 0;
  }
  if (heldOn >= 3) input.wheelHeld = true;
  if (heldOff >= 8) input.wheelHeld = false;

  const mode = settings.speedMode;
  if (heldRaw) {
    restFrames = 0;
    input.resting = false;
    input.steerSource = 'wheel';
    if (calibSamples) calibSamples.push({ angle: g.angle, lean: g.lean, sw: g.sw });
    let steerTarget;
    if (one) {
      steerTarget = one.steer;
      input.wheelAngle += (one.steer * 0.7 - input.wheelAngle) * 0.4;
      input.wheelLift += (one.lift - input.wheelLift) * 0.25;
    } else {
      const angle = g.angle - pose.calib.angle;
      input.wheelAngle += (angle - input.wheelAngle) * 0.4;
      steerTarget = combineSteer(angleToSteer(input.wheelAngle), g.lean - pose.calib.lean);
      input.wheelLift += (g.lift - input.wheelLift) * 0.25;
    }
    input.steer += (steerTarget - input.steer) * 0.4;
    const t =
      mode === 'distance' && !one ? spanToThrottle(g.span)
      : mode === 'lean' ? leanFwdToThrottle(g.sw, pose.calib.sw)
      : liftToThrottle(input.wheelLift);
    input.throttle += (t - input.throttle) * 0.2;
  } else if (signalling) {
    // One arm out for the indicator: keep the speed, wheel straight
    input.steer *= 0.85;
  } else if (!input.wheelHeld) {
    // Hands out of view: steer by leaning (as in the brief) so the car stays controllable
    if (g.visible) {
      const lean = g.lean - pose.calib.lean;
      const a = Math.abs(lean);
      const leanSteer = a < 0.25 ? 0 : Math.sign(lean) * Math.min(1, (a - 0.25) / 0.75);
      input.steer += (leanSteer - input.steer) * 0.3;
      input.steerSource = 'lean';
      input.wheelAngle += (input.steer * 0.7 - input.wheelAngle) * 0.3;
    } else {
      input.steer *= 0.8;
      input.wheelAngle *= 0.85;
    }
    if (mode === 'lean' && g.visible) {
      input.throttle += (leanFwdToThrottle(g.sw, pose.calib.sw) - input.throttle) * 0.2;
    } else if (mode !== 'auto') {
      // Arm rest: hold the speed for ~6 s, then roll gently to a stop
      restFrames++;
      input.resting = settings.armRest && restFrames < 180;
      if (!input.resting) input.throttle += (0 - input.throttle) * 0.08;
    }
  }
}

// Skeleton connections for drawing
export const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [0, 11], [0, 12],
];
