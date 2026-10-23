// Player progress: XP, rank title, cleared levels and stars, daily streak and daily challenge.
// Saved per player name in this browser.
import { LEVELS } from './levels.js';

const KEY = 'gesturekart.progress.v1';

export const RANKS = [
  { xp: 0, name: 'Learner', ur: 'Naya seekhne wala' },
  { xp: 300, name: 'Novice', ur: 'Shuruati driver' },
  { xp: 800, name: 'Driver', ur: 'Driver' },
  { xp: 1600, name: 'Skilled Driver', ur: 'Mahir driver' },
  { xp: 3000, name: 'Expert', ur: 'Ustad' },
  { xp: 5000, name: 'Civic Hero', ur: 'Shehar ka hero' },
];

export const CHALLENGES = [
  { id: 'stops3', text: 'Make 3 proper stops at red lights', test: (r) => r.properStops >= 3 },
  { id: 'nospeed', text: 'Finish a drive without over-speeding', test: (r) => r.reason === 'finish' && !r.counts.overspeed },
  { id: 'lanes4', text: 'Make 4 clean lane changes in one drive', test: (r) => (r.counts.cleanLane || 0) >= 4 },
  { id: 'nocrash', text: 'Finish a drive with no crash and no tailgating', test: (r) => r.reason === 'finish' && !r.counts.crash && !r.counts.tailgate },
  { id: 'combo5', text: 'Reach a combo of x5', test: (r) => (r.maxCombo || 0) >= 5 },
  { id: 'score90', text: 'Score 90 or more', test: (r) => r.score >= 90 },
];

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayKey = () => dayKey();
const keyOf = (name) => (name || 'driver').trim().toLowerCase();

function loadAll() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
}
function saveAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

const blank = () => ({ xp: 0, levels: {}, days: [], challenges: {}, licence: null });

export function getProgress(name) {
  const p = loadAll()[keyOf(name)];
  return p ? { ...blank(), ...p } : blank();
}

export function rankFor(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i];
  const next = RANKS[i + 1] || null;
  return { ...cur, index: i, next, toNext: next ? next.xp - xp : 0, pct: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}

/** Highest level the player may play (always at least level 1). */
export const unlockedUpTo = (p) => {
  let u = 1;
  for (const l of LEVELS) if (p.levels[l.id]?.stars > 0) u = Math.max(u, l.id + 1);
  return Math.min(u, LEVELS.length);
};

/** Licence progress 0..1. Starts at 10% because holding a learner permit is already a step. */
export const licenceProgress = (p) => 0.1 + 0.9 * (LEVELS.filter((l) => p.levels[l.id]?.stars > 0).length / LEVELS.length);

export function streakOf(days, today = dayKey()) {
  const set = new Set(days);
  let d = new Date(`${today}T12:00:00`);
  if (!set.has(today)) d.setDate(d.getDate() - 1); // yesterday still keeps the streak alive today
  let n = 0;
  while (set.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function dailyChallenge(date = dayKey()) {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CHALLENGES[h % CHALLENGES.length];
}

/** Save a finished drive into the player's progress and work out the XP earned. */
export function recordProgress(name, r, levelResult) {
  const all = loadAll();
  const k = keyOf(name);
  const p = { ...blank(), ...(all[k] || {}) };
  const today = dayKey();
  const before = rankFor(p.xp);
  const xp = [];

  xp.push({ label: 'Distance driven', xp: Math.round(r.distance / 10) });
  if (r.drivingXp) xp.push({ label: 'Good habits & combos', xp: r.drivingXp });
  if (r.reason === 'finish') xp.push({ label: 'Finished the route', xp: 50 });

  let newlyCleared = false;
  let unlocked = null;
  if (levelResult && levelResult.levelId > 0) {
    const prev = p.levels[levelResult.levelId] || { stars: 0, best: 0 };
    if (levelResult.passed) {
      if (prev.stars === 0) {
        newlyCleared = true;
        xp.push({ label: `Cleared level ${levelResult.levelId}`, xp: 150 });
        if (levelResult.levelId < LEVELS.length) unlocked = levelResult.levelId + 1;
      }
      const extraStars = Math.max(0, levelResult.stars - prev.stars);
      if (extraStars) xp.push({ label: `${extraStars} new star${extraStars > 1 ? 's' : ''}`, xp: extraStars * 60 });
    }
    p.levels[levelResult.levelId] = {
      stars: Math.max(prev.stars, levelResult.stars),
      best: Math.max(prev.best || 0, r.score),
      passedAt: prev.passedAt || (levelResult.passed ? new Date().toISOString() : null),
      tries: (prev.tries || 0) + 1,
    };
  }

  const challenge = dailyChallenge(today);
  let challengeDone = false;
  if (!p.challenges[today] && challenge.test(r)) {
    p.challenges[today] = challenge.id;
    challengeDone = true;
    xp.push({ label: 'Daily challenge', xp: 120 });
  }

  const firstToday = !p.days.includes(today);
  if (firstToday) p.days = [...p.days, today].slice(-60);
  const streak = streakOf(p.days, today);
  if (firstToday && streak > 1) xp.push({ label: `${streak}-day streak 🔥`, xp: Math.min(100, streak * 10) });

  const earned = xp.reduce((a, b) => a + b.xp, 0);
  p.xp += earned;

  const licenceNow = LEVELS.every((l) => p.levels[l.id]?.stars > 0);
  const licenceEarned = licenceNow && !p.licence;
  if (licenceEarned) p.licence = new Date().toISOString();

  all[k] = p;
  const saved = saveAll(all);
  const after = rankFor(p.xp);
  return {
    saved,
    xp,
    earned,
    totalXp: p.xp,
    rank: after,
    rankUp: after.index > before.index,
    streak,
    challenge,
    challengeDone,
    newlyCleared,
    unlocked,
    licenceEarned,
    licence: p.licence,
    progress: p,
  };
}
