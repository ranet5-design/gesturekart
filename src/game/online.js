// Talks to the shared online leaderboard (/api/leaderboard). Everything fails soft: if the
// database isn't connected, or you're offline, or running `npm run dev`, the game just keeps
// using the local history.

const API = '/api/leaderboard';

async function call(url, opts = {}, ms = 6000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const body = isJson ? await res.json() : null;
    if (!res.ok || !body) return { ok: false, status: res.status, error: body?.error || 'Leaderboard unavailable' };
    return { ok: true, ...body };
  } catch {
    return { ok: false, status: 0, error: 'You seem to be offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** Only the name and drive results go online, never age or CNIC. */
export function submitOnline(r) {
  return call(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player: r.player,
      score: r.score,
      grade: r.grade,
      levelId: r.levelId || 0,
      distance: Math.round(r.distance),
      time: Math.round(r.time),
      car: r.car,
      reason: r.reason,
    }),
  });
}

export const fetchOnline = (levelId = 0) => call(`${API}?level=${levelId}`);
