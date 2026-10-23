// Shared online leaderboard: a Vercel serverless function backed by Upstash Redis (free, added from the
// Vercel dashboard: Storage → Upstash for Redis → Connect to project). No extra packages: Upstash speaks HTTP.
//
// GET  /api/leaderboard?level=0..8      → top players (each player's best) + totals
// POST /api/leaderboard  { player, score, grade, levelId, distance, time, car, reason }
//                                        → saves it if it's the player's best, returns their rank
//
// Only the name and drive results are stored online: never age or CNIC.

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F'];
const CARS = ['kart', 'hatch', 'sedan', 'rickshaw', 'pickup'];
const REASONS = ['finish', 'failed', 'suspended', 'quit'];
const TOP = 50;

function redisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redis(cfg, commands, fetchImpl = fetch) {
  const res = await fetchImpl(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

export const playerKey = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 24);

/** Clean and check a submitted drive. Returns { ok, entry } or { ok: false, error }. */
export function validate(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Missing body' };
  // Names: letters (any language), digits, spaces and a few symbols. No control characters or HTML.
  const player = String(body.player || '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  const num = (v, lo, hi) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : NaN);
  const score = num(body.score, 0, 100);
  const levelId = num(body.levelId ?? 0, 0, 8);
  const distance = num(body.distance, 0, 2000);
  const time = num(body.time, 0, 1800);
  if (player.length < 2) return { ok: false, error: 'Name too short' };
  if ([score, levelId, distance, time].some(Number.isNaN)) return { ok: false, error: 'Bad numbers' };
  if (!GRADES.includes(body.grade)) return { ok: false, error: 'Bad grade' };
  // A drive can't be faster than ~100 km/h on average
  if (time > 0 && distance / time > 28) return { ok: false, error: 'Impossible speed' };
  return {
    ok: true,
    entry: {
      player,
      score,
      grade: body.grade,
      levelId,
      distance,
      time,
      car: CARS.includes(body.car) ? body.car : 'kart',
      reason: REASONS.includes(body.reason) ? body.reason : 'quit',
      date: new Date().toISOString(),
    },
  };
}

// Higher score first, then further distance, then faster time
export const rankValue = (e) => e.score * 1e7 + e.distance * 1e3 + (999 - Math.min(999, e.time));

const boardKey = (levelId) => `gk:lb:${levelId}`;
const entryKey = (levelId) => `gk:entries:${levelId}`;

export async function readBoard(cfg, levelId, fetchImpl) {
  const [members, total, drives] = await redis(
    cfg,
    [
      ['ZREVRANGE', boardKey(levelId), '0', String(TOP - 1)],
      ['ZCARD', boardKey(levelId)],
      ['GET', 'gk:drives'],
    ],
    fetchImpl,
  );
  let entries = [];
  if (members.length) {
    const [rows] = await redis(cfg, [['HMGET', entryKey(levelId), ...members]], fetchImpl);
    entries = rows.map((r) => (r ? JSON.parse(r) : null)).filter(Boolean);
  }
  return { levelId, total: Number(total) || 0, drives: Number(drives) || 0, entries };
}

export async function submit(cfg, entry, ip, fetchImpl) {
  // Rate limit: 12 submissions per minute per address
  const [count] = await redis(cfg, [['INCR', `gk:rl:${ip}`], ['EXPIRE', `gk:rl:${ip}`, '60']], fetchImpl);
  if (Number(count) > 12) return { status: 429, body: { error: 'Too many submissions, try again in a minute' } };

  const key = playerKey(entry.player);
  const value = rankValue(entry);
  const [prev] = await redis(cfg, [['ZSCORE', boardKey(entry.levelId), key]], fetchImpl);
  const isBest = prev == null || value > Number(prev);
  const cmds = [['INCR', 'gk:drives']];
  if (isBest) {
    cmds.push(['ZADD', boardKey(entry.levelId), String(value), key]);
    cmds.push(['HSET', entryKey(entry.levelId), key, JSON.stringify(entry)]);
  }
  await redis(cfg, cmds, fetchImpl);
  const [rank, total] = await redis(
    cfg,
    [
      ['ZREVRANK', boardKey(entry.levelId), key],
      ['ZCARD', boardKey(entry.levelId)],
    ],
    fetchImpl,
  );
  return { status: 200, body: { saved: true, isBest, rank: Number(rank) + 1, total: Number(total) } };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = redisConfig();
  if (!cfg) {
    res.status(503).json({ error: 'Online leaderboard is not set up yet (no database connected).' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const levelId = Math.min(8, Math.max(0, parseInt(req.query?.level ?? '0', 10) || 0));
      res.status(200).json(await readBoard(cfg, levelId));
      return;
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const v = validate(body);
      if (!v.ok) {
        res.status(400).json({ error: v.error });
        return;
      }
      const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
      const out = await submit(cfg, v.entry, ip);
      res.status(out.status).json(out.body);
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Leaderboard error', detail: String(e.message || e) });
  }
}
