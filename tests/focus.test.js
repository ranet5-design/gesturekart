import { describe, it, expect } from 'vitest';
import { newFocusState, stepFocus, beginFocusCalibration, endFocusCalibration } from '../src/cv/focus.js';

const open = { seen: true, blink: 0.08, jaw: 0.05, yaw: 0, pitch: 0 };
const run = (S, obs, seconds, dt = 1 / 15) => {
  const events = [];
  let out;
  for (let t = 0; t < seconds; t += dt) {
    out = stepFocus(S, typeof obs === 'function' ? obs(t) : obs, dt);
    events.push(...out.events);
  }
  return { events, out };
};

describe('focus / drowsiness detection', () => {
  it('normal blinking is not an alert', () => {
    const S = newFocusState();
    const { events } = run(S, (t) => (t % 4 < 0.25 ? { ...open, blink: 0.9 } : open), 30);
    expect(events).toEqual([]);
  });
  it('eyes closed for more than ~1.3 s raises an alert', () => {
    const S = newFocusState();
    run(S, open, 3);
    const { events } = run(S, { ...open, blink: 0.95 }, 2);
    expect(events).toContain('eyes');
  });
  it('looking down (phone) for 2+ seconds is caught', () => {
    const S = newFocusState();
    const { events } = run(S, { ...open, pitch: 0.6 }, 3);
    expect(events).toContain('down');
  });
  it('turning the head away is caught', () => {
    const S = newFocusState();
    expect(run(S, { ...open, yaw: 0.7 }, 3).events).toContain('away');
  });
  it('no face in view is caught', () => {
    const S = newFocusState();
    expect(run(S, { seen: false, blink: 0, jaw: 0, yaw: 0, pitch: 0 }, 4).events).toContain('noface');
  });
  it('a long yawn is caught', () => {
    const S = newFocusState();
    expect(run(S, { ...open, jaw: 0.8 }, 2).events).toContain('yawn');
  });
  it('lots of slow, heavy blinks over a minute = drowsy (PERCLOS)', () => {
    const S = newFocusState();
    const { events } = run(S, (t) => (t % 3 < 0.9 ? { ...open, blink: 0.9 } : open), 40);
    expect(events).toContain('drowsy');
  });
  it('alerts are rate-limited', () => {
    const S = newFocusState();
    const { events } = run(S, { ...open, blink: 0.95 }, 3.5);
    expect(events.filter((e) => e === 'eyes').length).toBe(1);
  });
  it('the focus meter needs ~3 s of steady attention to reach 100%', () => {
    const S = newFocusState();
    run(S, { ...open, blink: 0.95 }, 2);
    expect(S.meter).toBe(0);
    const { out } = run(S, open, 2);
    expect(out.meter).toBeLessThan(1);
    expect(run(S, open, 1.2).out.meter).toBe(1);
  });
  it('calibration adapts to a player whose head is naturally tilted', () => {
    const S = newFocusState();
    beginFocusCalibration(S);
    run(S, { ...open, pitch: 0.3 }, 2);
    endFocusCalibration(S);
    expect(run(S, { ...open, pitch: 0.3 }, 3).events).not.toContain('down');
  });
});
