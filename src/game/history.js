// Drive history and rankings, saved in this browser (localStorage).
// Every read/write is guarded: private windows or blocked storage just mean "no history", never a crash.

const KEY = 'gesturekart.history.v1';
const MAX = 300;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((e) => e && typeof e.score === 'number' && e.date) : [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    return true;
  } catch {
    return false;
  }
}

export const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

// Best first: higher score, then further distance, then faster time, then earlier date.
export const rankSort = (a, b) =>
  b.score - a.score || b.distance - a.distance || a.time - b.time || String(a.date).localeCompare(String(b.date));

/** Where does this drive rank, among your own drives and among everyone on this device? */
export function rankOf(entry, list = loadHistory()) {
  const all = [...list].sort(rankSort);
  const mine = list.filter((e) => sameName(e.player, entry.player)).sort(rankSort);
  const earlierMine = mine.filter((e) => e.id !== entry.id);
  const prevBest = earlierMine.length ? Math.max(...earlierMine.map((e) => e.score)) : null;
  // Leaderboard = each player's best drive
  const board = bestPerPlayer(list);
  return {
    personal: mine.findIndex((e) => e.id === entry.id) + 1,
    personalOf: mine.length,
    overall: all.findIndex((e) => e.id === entry.id) + 1,
    overallOf: all.length,
    boardPos: board.findIndex((e) => sameName(e.player, entry.player)) + 1,
    boardOf: board.length,
    prevBest,
    isPersonalBest: prevBest === null || entry.score > prevBest,
    firstDrive: earlierMine.length === 0,
  };
}

export function bestPerPlayer(list = loadHistory()) {
  const best = new Map();
  for (const e of list) {
    const k = (e.player || '').trim().toLowerCase();
    const cur = best.get(k);
    if (!cur || rankSort(e, cur) < 0) best.set(k, e);
  }
  return [...best.values()].sort(rankSort);
}

/** Save a finished drive. Returns the saved entry and its ranking. */
export function recordDrive(r) {
  const entry = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    player: r.player,
    date: r.date.toISOString(),
    score: r.score,
    grade: r.grade,
    label: r.label,
    reason: r.reason,
    mode: r.mode,
    view: r.view,
    car: r.car,
    age: r.age || null,
    levelId: r.levelId ?? 0,
    levelName: r.levelName || 'Free Drive',
    attention: r.attention ?? null,
    skills: r.skills || null,
    xp: r.xpEarned || 0,
    distance: Math.round(r.distance),
    time: Math.round(r.time),
    avgKmh: Math.round(r.avgKmh),
    redsRun: r.redsRun,
    properStops: r.properStops,
    crashes: r.counts.crash || 0,
    pedestrians: r.counts.pedestrian || 0,
    cleanLanes: r.counts.cleanLane || 0,
  };
  const list = loadHistory();
  list.push(entry);
  const saved = save(list);
  return { entry, saved, rank: rankOf(entry, list) };
}

export function deleteDrives(predicate) {
  const list = loadHistory().filter((e) => !predicate(e));
  save(list);
  return list;
}

export function statsFor(list) {
  if (!list.length) return null;
  const scores = list.map((e) => e.score);
  const byDate = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return {
    drives: list.length,
    best: Math.max(...scores),
    avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    finished: list.filter((e) => e.reason === 'finish').length,
    last: byDate[byDate.length - 1].date,
    first: byDate[0].date,
    trend: byDate.slice(-20).map((e) => e.score),
  };
}

export const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
