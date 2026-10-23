// One shared input object. The pose tracker or the keyboard writes to it; the game reads it every frame.
export const input = {
  source: 'keyboard', // 'keyboard' | 'camera'
  steer: 0, // -1 (left) .. 1 (right)
  throttle: 0, // 0..1, how much "gas"
  halt: false, // brake
  wheelHeld: false, // both hands on the virtual steering wheel
  wheelAngle: 0, // radians, for drawing the wheel (+ = turned right)
  wheelLift: 0.5, // 0 (low, slow) .. 1 (high, fast), for the HUD
  steerSource: 'wheel', // 'wheel' | 'lean' (hands out of view: torso lean steers)
  resting: false, // arm-rest cruise is holding the speed
  indicator: null, // 'left' | 'right' — one-shot, consumed by the game
  seatbelt: false, // seatbelt gesture done (camera) or B pressed (keyboard)
  // camera-only details, used by the HUD and the camera panel
  poseVisible: false,
  lock: 0, // body-lock meter 0..1
  locked: false, // true once the lock reaches 100%; game only runs while locked
  lockIssue: '', // hint like "Move back a little"
  lockParts: 0, // upper-body points clearly seen, out of 7
  landmarks: null,
  cvFps: 0,
  // focus (face) tracking
  faceReady: false,
  faceSeen: false,
  eyesClosed: false,
  attentive: true,
  focusMeter: 1, // 0..1, must reach 1 to resume after a focus pause
  focusArmed: false, // only queue focus warnings while actually driving
  focusEvents: [], // queue of 'eyes' | 'drowsy' | 'yawn' | 'away' | 'down' | 'noface'
  faceLandmarks: null,
};

const GAME_KEYS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'a', 'd', 'w', 's', 'q', 'e', 'b'];
const keys = new Set();
let kbGas = 0.55;

// Typing in a text box (like the driver name) must never be swallowed by the game controls.
const isTyping = (e) => {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

function onKey(e, down) {
  if (isTyping(e)) return;
  const k = e.key.toLowerCase();
  if (GAME_KEYS.includes(k)) e.preventDefault();
  if (down && !keys.has(k)) {
    if (k === 'q') input.indicator = 'left';
    if (k === 'e') input.indicator = 'right';
    if (k === 'b') input.seatbelt = true;
  }
  if (down) keys.add(k);
  else keys.delete(k);
}

export function initKeyboard() {
  const down = (e) => onKey(e, true);
  const up = (e) => onKey(e, false);
  const clear = () => keys.clear();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', clear);
  };
}

export const keyDown = (k) => keys.has(k);

// Called every frame (game and practice screen). Keyboard always works as a backup brake.
export function updateKeyboard(dt) {
  const left = keys.has('arrowleft') || keys.has('a');
  const right = keys.has('arrowright') || keys.has('d');
  const up = keys.has('arrowup') || keys.has('w');
  const downK = keys.has('arrowdown') || keys.has('s');
  const space = keys.has(' ');

  if (input.source === 'keyboard') {
    // Ease the wheel toward the key direction so it turns like a real wheel, not a switch
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    input.steer += (target - input.steer) * Math.min(1, dt * 8);
    if (Math.abs(input.steer) < 0.02) input.steer = 0;
    if (up) kbGas = Math.min(1, kbGas + dt * 0.6);
    if (downK) kbGas = Math.max(0.15, kbGas - dt * 0.6);
    input.throttle = kbGas;
    input.wheelLift = kbGas;
    input.halt = space;
    input.wheelHeld = true;
    input.wheelAngle = input.steer * 0.8;
  } else if (space) {
    input.halt = true; // emergency brake even in camera mode
  }
}

export function resetInput(source) {
  input.source = source;
  input.steer = 0;
  input.halt = false;
  input.throttle = source === 'keyboard' ? 0.55 : 0;
  input.wheelHeld = source === 'keyboard';
  input.wheelAngle = 0;
  input.wheelLift = 0.5;
  input.indicator = null;
  input.resting = false;
  input.focusEvents.length = 0;
  input.focusMeter = 1;
  kbGas = 0.55;
}
