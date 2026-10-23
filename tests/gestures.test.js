import { describe, it, expect } from 'vitest';
import * as g from '../src/cv/gestures.js';
import { body } from './helpers.js';

const A = 4 / 3;

describe('virtual steering wheel', () => {
  it('reads a level wheel as held and straight', () => {
    const r = g.readGesture(body(), A);
    expect(r.held).toBe(true);
    expect(g.angleToSteer(r.angle)).toBe(0);
  });
  it('turning clockwise (left hand up) steers right', () => {
    const r = g.readGesture(body({ lw: [0.6, 0.52], rw: [0.4, 0.72] }), A);
    expect(g.angleToSteer(r.angle)).toBeGreaterThan(0.5);
  });
  it('turning anticlockwise steers left', () => {
    const r = g.readGesture(body({ lw: [0.6, 0.72], rw: [0.4, 0.52] }), A);
    expect(g.angleToSteer(r.angle)).toBeLessThan(-0.5);
  });
  it('a higher wheel gives more gas', () => {
    const low = g.readGesture(body({ lw: [0.6, 0.75], rw: [0.4, 0.75] }), A).lift;
    const high = g.readGesture(body({ lw: [0.6, 0.46], rw: [0.4, 0.46] }), A).lift;
    expect(high).toBeGreaterThan(low + 0.4);
  });
  it('a hand dropped into the lap means the wheel is not held', () => {
    const lm = body();
    lm[15] = { ...lm[15], y: 0.9 };
    expect(g.readGesture(lm, A).held).toBe(false);
  });
});

describe('brake, indicator and seatbelt gestures', () => {
  it('right hand above the head brakes', () => {
    const r = g.readGesture(body({ rw: [0.38, 0.15] }), A);
    expect(r.haltRaw).toBe(true);
    expect(r.held).toBe(false);
  });
  it('a raised elbow still brakes when the hand leaves the frame', () => {
    const lm = body({ re: [0.37, 0.25] });
    lm[16] = { ...lm[16], visibility: 0.2 };
    expect(g.readGesture(lm, A).haltRaw).toBe(true);
  });
  it('left arm stretched out sideways = left indicator', () => {
    // player's left side is at larger raw x
    const r = g.readGesture(body({ lw: [0.95, 0.46], le: [0.8, 0.46] }), A);
    expect(r.indicator).toBe('left');
  });
  it('right arm stretched out sideways = right indicator', () => {
    const r = g.readGesture(body({ rw: [0.05, 0.46], re: [0.2, 0.46] }), A);
    expect(r.indicator).toBe('right');
  });
  it('detects the two halves of the seatbelt motion', () => {
    expect(g.readGesture(body({ rw: [0.6, 0.47] }), A).beltReach).toBe(true);
    expect(g.readGesture(body({ rw: [0.38, 0.75] }), A).beltDown).toBe(true);
  });
});

describe('lean steering (from the brief) and speed modes', () => {
  it('sitting upright adds no steering', () => {
    expect(g.combineSteer(0, g.readGesture(body(), A).lean)).toBe(0);
  });
  it('leaning right steers right even with hands out of view', () => {
    const lm = body({ visHands: 0.1 });
    lm[12] = { ...lm[12], y: 0.53 };
    expect(g.readGesture(lm, A).lean).toBeGreaterThan(0.5);
  });
  it('hand distance mode maps a wide grip to more gas', () => {
    expect(g.spanToThrottle(2.6)).toBe(1);
    expect(g.spanToThrottle(1)).toBeLessThan(0.3);
  });
  it('leaning toward the camera speeds up, sitting back slows down', () => {
    expect(g.leanFwdToThrottle(0.3, 0.25)).toBeGreaterThan(0.8);
    expect(g.leanFwdToThrottle(0.22, 0.25)).toBeLessThan(0.35);
  });
  it('one-hand mode steers by moving the hand sideways', () => {
    const right = g.readOneHand(body({ rw: [0.2, 0.62], visHands: 1 }).map((p, i) => (i === 15 ? { ...p, visibility: 0 } : p)), A);
    expect(right.held).toBe(true);
    expect(right.steer).toBeGreaterThan(0.3);
  });
});

describe('100% body lock', () => {
  it('locks after 1.5 s of good frames', () => {
    let st = { lock: 0, locked: false };
    let t = 0;
    while (!st.locked && t < 5) {
      st = g.stepLock(st, g.bodyCheck(body()), 1 / 30);
      t += 1 / 30;
    }
    expect(st.locked).toBe(true);
    expect(t).toBeGreaterThan(1.4);
    expect(t).toBeLessThan(1.7);
  });
  it('never locks on shaky tracking', () => {
    let st = { lock: 0, locked: false };
    for (let i = 0; i < 300; i++) st = g.stepLock(st, g.bodyCheck(i % 10 < 3 ? null : body()), 1 / 30);
    expect(st.locked).toBe(false);
  });
  it('gives plain hints', () => {
    expect(g.bodyCheck(body({ scale: 3 })).issue).toBe('Move back a little');
    expect(g.bodyCheck(body({ scale: 0.5 })).issue).toBe('Move closer to the camera');
    expect(g.bodyCheck(body({ visHands: 0.2 })).issue).toMatch(/hands/);
  });
  it('keeps the lock while braking with hands hidden, drops it when you leave', () => {
    let st = { lock: 1, locked: true };
    for (let i = 0; i < 30; i++) st = g.stepLock(st, g.bodyCheck(body({ visHands: 0.2 })), 1 / 30);
    expect(st.locked).toBe(true);
    let t = 0;
    while (st.locked && t < 3) {
      st = g.stepLock(st, g.bodyCheck(null), 1 / 30);
      t += 1 / 30;
    }
    expect(st.locked).toBe(false);
    expect(t).toBeLessThan(0.8);
  });
});
