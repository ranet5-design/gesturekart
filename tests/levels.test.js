import { describe, it, expect } from 'vitest';
import * as state from '../src/game/state.js';
import * as input from '../src/cv/input.js';
import * as config from '../src/game/config.js';
import { LEVELS, FREE_DRIVE, evaluate } from '../src/game/levels.js';
import { setSetting } from '../src/game/settings.js';
import { drive } from './helpers.js';

const mods = { state, input, config };

// Seeded random numbers so traffic is the same on every run (no flaky tests)
const realRandom = Math.random;
function seedRandom(seed) {
  let s = seed >>> 0;
  Math.random = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const restoreRandom = () => (Math.random = realRandom);
setSetting('replays', false); // replays pause the sim; tested separately below

describe('licence levels with a careful driver', () => {
  for (const level of LEVELS) {
    it(`passes level ${level.id}: ${level.name} (within 4 tries; seeded random traffic)`, () => {
      let res;
      for (let attempt = 0; attempt < 4; attempt++) {
        seedRandom(level.id * 1000 + attempt + 1);
        res = evaluate(level, drive(mods, level, 'good'));
        if (res.passed) break;
      }
      restoreRandom();
      expect(res.failed.map((c) => `${c.text} (${c.have})`)).toEqual([]);
      expect(res.passed).toBe(true);
      expect(res.stars).toBeGreaterThanOrEqual(1);
    });
  }
});

describe('a reckless driver', () => {
  it('fails the signals level', () => {
    const level = LEVELS[1];
    expect(evaluate(level, drive(mods, level, 'bad')).passed).toBe(false);
  });
  it('is stopped by the examiner in the final test', () => {
    const r = drive(mods, LEVELS[7], 'bad');
    expect(r.reason).toBe('failed');
  });
  it('gets one second chance in free drive, then is suspended', () => {
    const r = drive(mods, FREE_DRIVE, 'bad');
    expect(r.secondChanceUsed).toBe(true);
    expect(r.reason).toBe('suspended');
  });
});

describe('game rules', () => {
  it('a lane change without the indicator is penalised in indicator levels', () => {
    const { game, resetGame, setPhase, stepFrame } = state;
    resetGame('t', 'keyboard', LEVELS[4]);
    input.resetInput('keyboard');
    setPhase('playing');
    input.input.source = 'camera';
    input.input.wheelHeld = true;
    game.npcs.forEach((n) => (n.active = false));
    game.level = { ...LEVELS[4], hazards: [], traffic: 0 };
    for (let i = 0; i < 60 * 8; i++) {
      input.input.throttle = 0.5;
      input.input.steer = i > 120 && game.x < config.LANES[2] - 0.2 ? 1 : 0;
      stepFrame(1 / 60);
    }
    expect(game.counts.noIndicator).toBe(1);
  });
  it('speed zones lower the limit', () => {
    state.resetGame('t', 'keyboard', LEVELS[3]);
    expect(state.limitAt(300).limit).toBe(30);
    expect(state.limitAt(600).limit).toBe(60);
  });
  it('records a slow-motion replay after a serious mistake', () => {
    setSetting('replays', true);
    const { game, resetGame, setPhase, stepFrame } = state;
    resetGame('t', 'keyboard', LEVELS[1]);
    input.resetInput('keyboard');
    setPhase('playing');
    input.input.source = 'camera';
    input.input.wheelHeld = true;
    let sawReplay = false;
    for (let i = 0; i < 60 * 40 && game.phase === 'playing'; i++) {
      input.input.throttle = 0.7;
      input.input.halt = false;
      stepFrame(1 / 60);
      if (game.replay) sawReplay = true;
    }
    setSetting('replays', false);
    expect(sawReplay).toBe(true);
  });
  it('computes skills for the score card radar', () => {
    const r = drive(mods, LEVELS[1], 'good');
    expect(r.skills.signals).toBeGreaterThanOrEqual(90);
    expect(r.skills.people).toBe(100);
  });
});
