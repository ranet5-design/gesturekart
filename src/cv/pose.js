import { FilesetResolver, PoseLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { input } from './input.js';
import { readGesture, readOneHand, bodyCheck, stepLock } from './gestures.js';
import { createControls, applyGesture } from './controls.js';
import { createLandmarkFilter } from './filter.js';
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
  calib: { angle: 0, lean: 0, bodyLean: 0, sw: 0 },
};

let landmarker = null;
let faceMarker = null;
let stream = null;
let rafId = 0;
let lastVideoTime = -1;
let frame = 0;
let fpsFrames = 0;
let fpsT = 0;
let lastDetectT = 0;
let lastFaceT = 0;
let controls = createControls();
const lmFilter = createLandmarkFilter();
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
  lmFilter.reset();
  controls = createControls();
}

// Learn the player's neutral posture and face (a tilted webcam or a slouch shouldn't steer the car).
export function beginCalibration() {
  controls.calibSamples = [];
  beginFocusCalibration(focusState);
}
export function endCalibration() {
  const samples = controls.calibSamples;
  if (samples && samples.length > 5) {
    const median = (key) => {
      const sorted = samples.map((s) => s[key]).filter((v) => v != null).sort((a, b) => a - b);
      return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    };
    pose.calib.angle = Math.max(-0.25, Math.min(0.25, median('angle')));
    pose.calib.lean = Math.max(-0.6, Math.min(0.6, median('lean')));
    pose.calib.bodyLean = Math.max(-0.6, Math.min(0.6, median('bodyLean')));
    pose.calib.sw = median('sw');
  }
  controls.calibSamples = null;
  endFocusCalibration(focusState);
}
export const resetSeatbelt = () => {
  controls.belt = { phase: 0, t: 0 };
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
  const dt = lastDetectT ? Math.min(0.2, (now - lastDetectT) / 1000) : 1 / 30;
  lastDetectT = now;
  // Smooth the raw points first: this removes the jitter that made the wheel shake
  const lm = lmFilter.step(result.landmarks?.[0] || null, dt);
  input.landmarks = lm;
  const check = bodyCheck(lm);
  const next = stepLock({ lock: input.lock, locked: input.locked }, check, dt);
  input.lock = next.lock;
  input.locked = next.locked;
  input.lockIssue = check.issue;
  input.lockParts = check.parts;
  const aspect = video.videoWidth / video.videoHeight || 4 / 3;
  const g = readGesture(lm, aspect);
  input.handsTooClose = !!g.handsTooClose;
  applyGesture(
    controls,
    input,
    g,
    settings.oneHand ? readOneHand(lm, aspect) : null,
    pose.calib,
    { speedMode: settings.speedMode, armRest: settings.armRest, steerMode: settings.steerMode },
    now,
  );

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

// Skeleton connections for drawing
export const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [0, 11], [0, 12],
];
