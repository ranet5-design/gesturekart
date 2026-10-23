import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { input } from './input.js';
import { CRUISE_THROTTLE } from '../game/config.js';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// MediaPipe Pose landmark indexes
const NOSE = 0;
const L_SHOULDER = 11; // the person's own left
const R_SHOULDER = 12;
const L_WRIST = 15;
const R_WRIST = 16;
const L_HIP = 23;
const R_HIP = 24;

export const pose = {
  video: null,
  ready: false,
  calib: { lean: 0 },
};

let landmarker = null;
let stream = null;
let rafId = 0;
let lastVideoTime = -1;
let haltOn = 0;
let haltOff = 0;
let fpsFrames = 0;
let fpsT = 0;
let calibSamples = null;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const vis = (p) => (p ? p.visibility ?? 1 : 0);

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

  onStatus('Loading the MediaPipe Pose model…');
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
}

// Collect the neutral lean for a moment so a slightly tilted webcam doesn't steer the car.
export function beginCalibration() {
  calibSamples = [];
}
export function endCalibration() {
  if (calibSamples && calibSamples.length > 5) {
    const sorted = [...calibSamples].sort((a, b) => a - b);
    pose.calib.lean = sorted[Math.floor(sorted.length / 2)];
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
  process(lm, video.videoWidth / video.videoHeight || 4 / 3);

  fpsFrames++;
  if (now - fpsT > 1000) {
    input.cvFps = Math.round((fpsFrames * 1000) / (now - fpsT));
    fpsFrames = 0;
    fpsT = now;
  }
}

function process(lm, aspect) {
  if (!lm) {
    input.poseVisible = false;
    input.handsVisible = false;
    // Ease off steering and hold cruise speed while the player is out of frame.
    input.steer *= 0.8;
    input.throttle += (CRUISE_THROTTLE - input.throttle) * 0.1;
    return;
  }
  const ls = lm[L_SHOULDER];
  const rs = lm[R_SHOULDER];
  const shouldersOk = vis(ls) > 0.5 && vis(rs) > 0.5;
  input.poseVisible = shouldersOk;
  if (!shouldersOk) return;

  // x is scaled by aspect so distances are in the same units as y.
  const dx = (ls.x - rs.x) * aspect;
  const dy = ls.y - rs.y;
  const shoulderW = Math.hypot(dx, dy) || 0.2;

  // ---- Steering: lateral torso lean ----
  // Raw camera frame is not mirrored: the person's left side is on the image's right (larger x).
  // Leaning to your left moves the shoulders toward larger x and drops the left shoulder.
  const tilt = Math.atan2(dy, dx); // + when left shoulder is lower
  let lean = tilt / 0.35;
  const lh = lm[L_HIP];
  const rh = lm[R_HIP];
  if (vis(lh) > 0.5 && vis(rh) > 0.5) {
    const midSx = (ls.x + rs.x) / 2;
    const midHx = (lh.x + rh.x) / 2;
    const torsoLen = Math.abs((ls.y + rs.y) / 2 - (lh.y + rh.y) / 2) || 0.3;
    const offset = ((midSx - midHx) * aspect) / torsoLen / 0.25;
    lean = 0.5 * lean + 0.5 * offset;
  }
  if (calibSamples) calibSamples.push(lean);
  input.rawLean = lean;
  let steer = -(lean - pose.calib.lean); // lean left -> negative steer (left)
  const DEAD = 0.18;
  steer = Math.abs(steer) < DEAD ? 0 : (steer - Math.sign(steer) * DEAD) / (1 - DEAD);
  steer = clamp(steer, -1, 1);
  input.steer += (steer - input.steer) * 0.35;

  // ---- Halt: right hand above head ----
  const nose = lm[NOSE];
  const rw = lm[R_WRIST];
  const raw = vis(rw) > 0.5 && vis(nose) > 0.5 && rw.y < nose.y - shoulderW * 0.15;
  if (raw) {
    haltOn++;
    haltOff = 0;
  } else {
    haltOff++;
    haltOn = 0;
  }
  if (haltOn >= 3) input.halt = true;
  if (haltOff >= 6) input.halt = false;

  // ---- Speed: distance between the hands, like gripping a wide or narrow steering wheel ----
  const lw = lm[L_WRIST];
  const handsOk = vis(lw) > 0.5 && vis(rw) > 0.5 && !input.halt;
  input.handsVisible = handsOk;
  if (handsOk) {
    const span = Math.hypot((lw.x - rw.x) * aspect, lw.y - rw.y) / shoulderW;
    input.handSpan = span;
    const t = clamp((span - 0.8) / (2.6 - 0.8), 0, 1);
    input.throttle += (t - input.throttle) * 0.2;
  } else if (!input.halt) {
    input.throttle += (CRUISE_THROTTLE - input.throttle) * 0.05;
  }
}

// Skeleton connections for drawing
export const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [0, 11], [0, 12],
];
