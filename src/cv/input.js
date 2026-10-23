import { CRUISE_THROTTLE } from '../game/config.js';

// One shared input object. The pose tracker or the keyboard writes to it; the game reads it every frame.
export const input = {
  source: 'keyboard', // 'keyboard' | 'camera'
  steer: 0, // -1 (left) .. 1 (right)
  throttle: CRUISE_THROTTLE, // 0..1
  halt: false,
  // camera-only details, used by the HUD and the camera panel
  poseVisible: false,
  handsVisible: false,
  rawLean: 0,
  handSpan: 0,
  landmarks: null,
  cvFps: 0,
};

const keys = new Set();
let kbThrottle = CRUISE_THROTTLE;

function onKey(e, down) {
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'a', 'd', 'w', 's'].includes(k)) {
    e.preventDefault();
  }
  if (down) keys.add(k);
  else keys.delete(k);
}

export function initKeyboard() {
  const down = (e) => onKey(e, true);
  const up = (e) => onKey(e, false);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}

// Called once per game frame. Keyboard works in both modes so you can always override or test.
export function updateKeyboard(dt) {
  const left = keys.has('arrowleft') || keys.has('a');
  const right = keys.has('arrowright') || keys.has('d');
  const up = keys.has('arrowup') || keys.has('w');
  const downK = keys.has('arrowdown') || keys.has('s');
  const space = keys.has(' ');

  if (input.source === 'keyboard') {
    input.steer = (right ? 1 : 0) - (left ? 1 : 0);
    if (up) kbThrottle = Math.min(1, kbThrottle + dt * 0.6);
    if (downK) kbThrottle = Math.max(0.15, kbThrottle - dt * 0.6);
    input.throttle = kbThrottle;
    input.halt = space;
  } else if (space) {
    input.halt = true; // emergency brake even in camera mode
  }
}

export function resetInput(source) {
  input.source = source;
  input.steer = 0;
  input.halt = false;
  input.throttle = CRUISE_THROTTLE;
  kbThrottle = CRUISE_THROTTLE;
}
