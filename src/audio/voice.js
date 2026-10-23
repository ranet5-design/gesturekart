// Spoken driving coach, using the browser's built-in speech synthesis, in English or Urdu.
// Each cue has a key and a cooldown so the coach never nags.
import { settings } from '../game/settings.js';
import { translate } from './urdu.js';

const lastSaid = {};
let enabled = true;
const voices = { en: null, ur: null, hi: null };
const listeners = new Set();
const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function pickVoices() {
  if (!hasSpeech()) return;
  const all = window.speechSynthesis.getVoices();
  voices.en =
    all.find((v) => /en-(GB|IN|PK)/i.test(v.lang) && /female|zira|hazel|heera|google/i.test(v.name)) ||
    all.find((v) => /^en/i.test(v.lang)) ||
    null;
  voices.ur = all.find((v) => /^ur/i.test(v.lang)) || null;
  voices.hi = all.find((v) => /^hi/i.test(v.lang)) || null;
}
if (hasSpeech()) {
  pickVoices();
  window.speechSynthesis.onvoiceschanged = pickVoices;
}

/** What the Urdu coach can do on this computer: 'ur' | 'hi' | 'captions' (English voice, Roman Urdu captions) */
export function urduSupport() {
  pickVoices();
  return voices.ur ? 'ur' : voices.hi ? 'hi' : 'captions';
}

export function setVoiceEnabled(on) {
  enabled = on;
  if (!on && hasSpeech()) window.speechSynthesis.cancel();
}
export const isVoiceEnabled = () => enabled;

// Subscribe to captions (the HUD shows what the coach says, like subtitles).
export function onCaption(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * @param {string} text   what to say (English; translated automatically when the coach is set to Urdu)
 * @param {object} opts   key (cooldown group), cooldown ms, urgent (interrupts current speech)
 */
export function say(text, { key = text, cooldown = 5000, urgent = false } = {}) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (lastSaid[key] && now - lastSaid[key] < cooldown) return;
  lastSaid[key] = now;

  let speak = text;
  let caption = text;
  let voice = voices.en;
  let lang = 'en-GB';
  if (settings.lang === 'ur') {
    const tr = translate(text);
    if (tr) {
      caption = tr[2];
      if (voices.ur) {
        speak = tr[0];
        voice = voices.ur;
        lang = voices.ur.lang;
      } else if (voices.hi) {
        speak = tr[1];
        voice = voices.hi;
        lang = voices.hi.lang;
      }
    }
  }
  listeners.forEach((fn) => fn(caption));
  if (!enabled || !hasSpeech()) return;
  const synth = window.speechSynthesis;
  if (urgent) synth.cancel();
  else if (synth.pending) return; // don't pile up a queue of stale cues
  const u = new SpeechSynthesisUtterance(speak);
  if (voice) u.voice = voice;
  u.lang = lang;
  u.rate = settings.lang === 'ur' ? 1.0 : 1.1;
  u.pitch = 1;
  synth.speak(u);
}

export function resetVoice() {
  Object.keys(lastSaid).forEach((k) => delete lastSaid[k]);
  if (hasSpeech()) window.speechSynthesis.cancel();
}
