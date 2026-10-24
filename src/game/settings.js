// Player settings, remembered in this browser. Every storage call is guarded.
const KEY = 'gesturekart.settings.v1';

export const DEFAULTS = {
  lang: 'en', // 'en' | 'ur' voice coach + captions
  flash: 'soft', // 'soft' white pulse for focus alerts | 'off' (border glow only, photosensitivity-safe)
  // Defaults follow the hackathon brief exactly: lean the torso to steer, hand distance = speed,
  // right hand above the head = stop. Everything else is an optional improvement.
  // steerMode: 'lean' torso lean (brief) | 'wheel' turn a virtual steering wheel with both hands
  steerMode: 'lean',
  // speedMode: 'distance' hand distance (brief) | 'auto' car keeps a safe speed
  //            | 'lift' wheel height | 'lean' lean toward the camera = faster
  speedMode: 'distance',
  controlsVersion: 2, // bumped when the default controls changed; older saved choices are reset
  oneHand: false, // steer, speed and brake with a single hand
  colorblind: false, // STOP / WAIT / GO words on every signal
  armRest: true, // lower your hands briefly and the car holds its speed (cruise) for a few seconds
  replays: true, // slow-motion replay after a serious mistake
  music: true,
  focusCheck: true, // eyes / sleepiness / distraction detection
  privacy: false, // never draw the camera image: only a stick figure (handy for recording a demo)
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    // Saved before the brief controls became the default: start from the brief's controls
    if (s.controlsVersion !== DEFAULTS.controlsVersion) {
      delete s.speedMode;
      delete s.steerMode;
      s.controlsVersion = DEFAULTS.controlsVersion;
    }
    const out = {};
    for (const k of Object.keys(DEFAULTS)) if (typeof s[k] === typeof DEFAULTS[k]) out[k] = s[k];
    return out;
  } catch {
    return {};
  }
}

export const settings = { ...DEFAULTS, ...load() };
const listeners = new Set();

export function setSetting(key, value) {
  if (!(key in DEFAULTS)) return;
  settings[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* not remembered */
  }
  listeners.forEach((fn) => fn(key, value));
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
