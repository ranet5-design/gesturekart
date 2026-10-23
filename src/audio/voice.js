// Spoken driving coach, using the browser's built-in speech synthesis.
// Each cue has a key and a cooldown so the coach never nags.
const lastSaid = {};
let enabled = true;
let voice = null;
const listeners = new Set();

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  voice =
    voices.find((v) => /en-(GB|IN|PK)/i.test(v.lang) && /female|zira|hazel|heera|google/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function setVoiceEnabled(on) {
  enabled = on;
  if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
export const isVoiceEnabled = () => enabled;

// Subscribe to captions (the HUD shows what the coach says, like subtitles).
export function onCaption(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * @param {string} text   what to say
 * @param {object} opts   key (cooldown group), cooldown ms, urgent (interrupts current speech)
 */
export function say(text, { key = text, cooldown = 5000, urgent = false } = {}) {
  const now = performance.now();
  if (lastSaid[key] && now - lastSaid[key] < cooldown) return;
  lastSaid[key] = now;
  listeners.forEach((fn) => fn(text));
  if (!enabled || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (urgent) synth.cancel();
  else if (synth.pending) return; // don't pile up a queue of stale cues
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 1.1;
  u.pitch = 1;
  synth.speak(u);
}

export function resetVoice() {
  Object.keys(lastSaid).forEach((k) => delete lastSaid[k]);
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
