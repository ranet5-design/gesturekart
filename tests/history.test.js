import { describe, it, expect, beforeEach } from 'vitest';
import { recordDrive, loadHistory, bestPerPlayer } from '../src/game/history.js';
import { recordProgress, getProgress, rankFor, streakOf, licenceProgress, unlockedUpTo } from '../src/game/progress.js';
import { LEVELS, evaluate } from '../src/game/levels.js';

const report = (player, score, extra = {}) => ({
  player, score, grade: 'A', label: '', reason: 'finish', mode: 'keyboard', view: 'cockpit', car: 'kart',
  distance: 900, time: 80, avgKmh: 40, redsRun: 0, properStops: 2, counts: { goodStop: 2 },
  date: new Date(), routeLength: 900, ...extra,
});

beforeEach(() => localStorage.clear());

describe('history and leaderboard', () => {
  it('saves drives with date/time and ranks them', () => {
    recordDrive(report('Ali', 70));
    const second = recordDrive(report('Ali', 90));
    recordDrive(report('Sara', 95));
    expect(loadHistory()).toHaveLength(3);
    expect(second.rank.personal).toBe(1);
    expect(second.rank.isPersonalBest).toBe(true);
    const board = bestPerPlayer();
    expect(board.map((e) => e.player)).toEqual(['Sara', 'Ali']);
  });
  it('treats names case-insensitively', () => {
    recordDrive(report('ali', 50));
    const r = recordDrive(report('ALI ', 40));
    expect(r.rank.personalOf).toBe(2);
    expect(r.rank.prevBest).toBe(50);
  });
});

describe('progress, XP, levels and streaks', () => {
  it('clearing a level unlocks the next one and gives XP', () => {
    const lvl = LEVELS[1];
    const r = report('Ali', 96, { properStops: 2, redsRun: 0, counts: { goodStop: 2 } });
    const res = evaluate(lvl, r);
    expect(res.passed).toBe(true);
    const p = recordProgress('Ali', r, res);
    expect(p.newlyCleared).toBe(true);
    expect(p.unlocked).toBe(3);
    expect(p.earned).toBeGreaterThan(150);
    expect(unlockedUpTo(getProgress('Ali'))).toBe(3);
  });
  it('licence progress starts at 10% and reaches 100% after all 8 levels', () => {
    expect(licenceProgress(getProgress('New'))).toBeCloseTo(0.1);
    const levels = Object.fromEntries(LEVELS.map((l) => [l.id, { stars: 1 }]));
    expect(licenceProgress({ levels })).toBeCloseTo(1);
  });
  it('rank titles grow with XP', () => {
    expect(rankFor(0).name).toBe('Learner');
    expect(rankFor(900).name).toBe('Driver');
    expect(rankFor(9999).name).toBe('Civic Hero');
  });
  it('counts a daily streak', () => {
    expect(streakOf(['2026-10-21', '2026-10-22', '2026-10-23'], '2026-10-23')).toBe(3);
    expect(streakOf(['2026-10-21', '2026-10-22'], '2026-10-23')).toBe(2);
    expect(streakOf(['2026-10-20'], '2026-10-23')).toBe(0);
  });
});
