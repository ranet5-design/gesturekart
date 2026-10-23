import { describe, it, expect } from 'vitest';
import { readGesture } from '../src/cv/gestures.js';
import { createControls, applyGesture } from '../src/cv/controls.js';
import { createLandmarkFilter } from '../src/cv/filter.js';
import { body } from './helpers.js';

const A = 4 / 3;
const calib = { angle: 0, lean: 0, sw: 0 };
const freshInput = () => ({ steer: 0, throttle: 0, halt: false, wheelHeld: false, wheelAngle: 0, wheelLift: 0.5, steerSource: 'wheel', seatbelt: false });

// The player's right wrist is landmark 16 (raw camera frame: smaller x). Move it up to brake.
function brakeSequence() {
  const frames = [];
  for (let i = 0; i < 30; i++) frames.push(body());
  for (let i = 0; i <= 20; i++) {
    const y = 0.62 - (0.62 - 0.1) * (i / 20);
    const ey = 0.6 - (0.6 - 0.3) * (i / 20);
    // as the hand rises the right shoulder lifts a little too (this used to fake a left lean)
    const lm = body({ rw: [0.4, y], re: [0.38, ey] });
    lm[12] = { ...lm[12], y: 0.45 - 0.03 * (i / 20) };
    frames.push(lm);
  }
  for (let i = 0; i < 40; i++) {
    const lm = body({ rw: [0.4, 0.1], re: [0.38, 0.3] });
    lm[12] = { ...lm[12], y: 0.42 };
    frames.push(lm);
  }
  for (let i = 0; i <= 20; i++) {
    const y = 0.1 + (0.62 - 0.1) * (i / 20);
    frames.push(body({ rw: [0.4, y], re: [0.38, 0.3 + 0.3 * (i / 20)] }));
  }
  for (let i = 0; i < 30; i++) frames.push(body());
  return frames;
}

describe('braking with the right hand', () => {
  it('never steers the car while the hand goes up, stays up and comes back down', () => {
    const S = createControls();
    const input = freshInput();
    let maxSteer = 0;
    let braked = false;
    brakeSequence().forEach((lm, i) => {
      applyGesture(S, input, readGesture(lm, A), null, calib, { speedMode: 'auto' }, i * 33);
      if (i > 30) maxSteer = Math.max(maxSteer, Math.abs(input.steer));
      if (input.halt) braked = true;
    });
    expect(braked).toBe(true);
    expect(maxSteer).toBeLessThan(0.05);
    expect(input.halt).toBe(false); // released again at the end
  });

  it('still steers normally once the hands are back on the wheel', () => {
    const S = createControls();
    const input = freshInput();
    brakeSequence().forEach((lm, i) => applyGesture(S, input, readGesture(lm, A), null, calib, {}, i * 33));
    for (let i = 0; i < 30; i++) {
      applyGesture(S, input, readGesture(body({ lw: [0.6, 0.52], rw: [0.4, 0.72] }), A), null, calib, {}, 5000 + i * 33);
    }
    expect(input.steer).toBeGreaterThan(0.5);
  });

  it('lean steering only takes over when the hands are really out of view', () => {
    const S = createControls();
    const input = freshInput();
    const lean = body({ visHands: 0.1 });
    lean[12] = { ...lean[12], y: 0.53 }; // leaning right
    for (let i = 0; i < 10; i++) applyGesture(S, input, readGesture(lean, A), null, calib, {}, i * 33);
    expect(Math.abs(input.steer)).toBeLessThan(0.05); // a short tracking gap doesn't steer
    for (let i = 10; i < 60; i++) applyGesture(S, input, readGesture(lean, A), null, calib, {}, i * 33);
    expect(input.steer).toBeGreaterThan(0.3);
    expect(input.steerSource).toBe('lean');
  });
});

describe('landmark smoothing (One Euro filter)', () => {
  it('removes most of the jitter from a hand that is holding still', () => {
    const f = createLandmarkFilter();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.06;
    const raw = [];
    const smooth = [];
    for (let i = 0; i < 120; i++) {
      const lm = body();
      lm[16] = { ...lm[16], x: 0.4 + rnd(), y: 0.62 + rnd() };
      raw.push(lm[16].x);
      smooth.push(f.step(lm, 1 / 30)[16].x);
    }
    const sd = (a) => {
      const s = a.slice(30);
      const m = s.reduce((p, c) => p + c, 0) / s.length;
      return Math.sqrt(s.reduce((p, c) => p + (c - m) ** 2, 0) / s.length);
    };
    expect(sd(smooth)).toBeLessThan(sd(raw) / 3);
  });

  it('ignores a one-frame glitch where a wrist teleports across the screen', () => {
    const f = createLandmarkFilter();
    for (let i = 0; i < 20; i++) f.step(body(), 1 / 30);
    const glitch = body();
    glitch[16] = { x: 0.95, y: 0.05, visibility: 0.6 };
    const out = f.step(glitch, 1 / 30);
    expect(Math.abs(out[16].x - 0.4)).toBeLessThan(0.02);
  });

  it('still follows a real, fast movement', () => {
    const f = createLandmarkFilter();
    for (let i = 0; i < 20; i++) f.step(body(), 1 / 30);
    let out;
    for (let i = 0; i < 8; i++) out = f.step(body({ rw: [0.4, 0.2] }), 1 / 30);
    expect(out[16].y).toBeLessThan(0.3);
  });
});
