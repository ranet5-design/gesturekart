import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { input } from './input.js';
import { readGesture, angleToSteer, liftToThrottle, bodyCheck, stepLock, combineSteer } from './gestures.js';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const pose = {
  video: null,
  ready: false,
  calib: { angle: 0, lean: 0 },
};

let landmarker = null;
let stream = null;
let rafId = 0;
let lastVideoTime = -1;
let haltOn = 0;
let haltOff = 0;
let heldOn = 0;
let heldOff = 0;
let fpsFrames = 0;
let fpsT = 0;
let calibSamples = null;
let lastDetectT = 0;

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
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, opts('GPU'));
  } catch {
    landmarker = await PoseLandmarker.createFromOptions(fileset, opts('CPU'));
  }
  pose.ready = true;
  input.source = 'camera';
  loop();
}

export function stopPose() {
  cancelAnimationFrame(rafId);
  stream?.getTracks().forEach((t) => t.stop());
  landmarker?.close();
  landmarker = null;
  stream = null;
  pose.video = null;
  pose.ready = false;
  input.landmarks = null;
  input.poseVisible = false;
  input.wheelHeld = false;
  input.lock = 0;
  input.locked = false;
  lastDetectT = 0;
}

// Learn what "wheel straight" looks like for this player (a tilted webcam shouldn't steer the car).
export function beginCalibration() {
  calibSamples = [];
}
export function endCalibration() {
  if (calibSamples && calibSamples.length > 5) {
    const median = (key) => {
      const sorted = calibSamples.map((s) => s[key]).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    // Only trust a small correction; a big one means they weren't sitting or holding it straight
    pose.calib.angle = Math.max(-0.25, Math.min(0.25, median('angle')));
    pose.calib.lean = Math.max(-0.6, Math.min(0.6, median('lean')));
  }
  calibSamples = null;
}

function loop() {
  rafId = requestAnimationFrame(loop);
  const video = pose.video;
  if (!landmarker || !video || video.readyState < 2) return;
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

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
  apply(readGesture(lm, video.videoWidth / video.videoHeight || 4 / 3));

  fpsFrames++;
  if (now - fpsT > 1000) {
    input.cvFps = Math.round((fpsFrames * 1000) / (now - fpsT));
    fpsFrames = 0;
    fpsT = now;
  }
}

function apply(g) {
  input.poseVisible = g.visible;

  // Debounce so a single bad frame never brakes or lets go of the wheel
  if (g.haltRaw) {
    haltOn++;
    haltOff = 0;
  } else {
    haltOff++;
    haltOn = 0;
  }
  if (haltOn >= 3) input.halt = true;
  if (haltOff >= 6) input.halt = false;

  if (g.held) {
    heldOn++;
    heldOff = 0;
  } else {
    heldOff++;
    heldOn = 0;
  }
  if (heldOn >= 3) input.wheelHeld = true;
  if (heldOff >= 8) input.wheelHeld = false;

  if (g.held) {
    if (calibSamples) calibSamples.push({ angle: g.angle, lean: g.lean });
    const angle = g.angle - pose.calib.angle;
    input.wheelAngle += (angle - input.wheelAngle) * 0.4;
    const target = combineSteer(angleToSteer(input.wheelAngle), g.lean - pose.calib.lean);
    input.steer += (target - input.steer) * 0.4;
    input.wheelLift += (g.lift - input.wheelLift) * 0.25;
    input.throttle += (liftToThrottle(input.wheelLift) - input.throttle) * 0.2;
  } else if (!input.wheelHeld) {
    // Hands off the wheel: straighten up and roll to a gentle stop
    input.wheelAngle *= 0.85;
    input.steer *= 0.8;
    input.throttle += (0 - input.throttle) * 0.08;
  }
}

// Skeleton connections for drawing
export const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [0, 11], [0, 12],
];
