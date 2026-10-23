import { describe, it, expect } from 'vitest';
import { validate, submit, readBoard, playerKey } from '../api/leaderboard.js';

// A tiny in-memory stand-in for Upstash Redis's HTTP pipeline API
function fakeRedis() {
  const kv = new Map();
  const zsets = new Map();
  const hashes = new Map();
  const z = (k) => zsets.get(k) || zsets.set(k, new Map()).get(k);
  const h = (k) => hashes.get(k) || hashes.set(k, new Map()).get(k);
  const desc = (k) => [...z(k).entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  const run = ([cmd, key, ...a]) => {
    switch (cmd) {
      case 'INCR': kv.set(key, (Number(kv.get(key)) || 0) + 1); return kv.get(key);
      case 'EXPIRE': return 1;
      case 'GET': return kv.get(key) ?? null;
      case 'ZADD': z(key).set(a[1], Number(a[0])); return 1;
      case 'ZSCORE': return z(key).has(a[0]) ? String(z(key).get(a[0])) : null;
      case 'ZCARD': return z(key).size;
      case 'ZREVRANK': { const i = desc(key).indexOf(a[0]); return i < 0 ? null : i; }
      case 'ZREVRANGE': return desc(key).slice(Number(a[0]), Number(a[1]) + 1);
      case 'HSET': h(key).set(a[0], a[1]); return 1;
      case 'HMGET': return a.map((f) => h(key).get(f) ?? null);
      default: throw new Error(`fake redis: ${cmd}`);
    }
  };
  const fetchImpl = async (_url, opts) => ({
    ok: true,
    json: async () => JSON.parse(opts.body).map((c) => ({ result: run(c) })),
  });
  return { fetchImpl, cfg: { url: 'https://fake', token: 't' } };
}

const drive = (player, score, extra = {}) =>
  validate({ player, score, grade: 'A', levelId: 0, distance: 1800, time: 160, car: 'kart', reason: 'finish', ...extra }).entry;

describe('online leaderboard API', () => {
  it('validates and cleans submissions', () => {
    expect(validate({ player: 'A', score: 50, grade: 'A', distance: 100, time: 20 }).ok).toBe(false);
    expect(validate({ player: 'Ali', score: 50, grade: 'Z', distance: 100, time: 20 }).ok).toBe(false);
    expect(validate({ player: 'Ali', score: 50, grade: 'A', distance: 1800, time: 10 }).error).toBe('Impossible speed');
    const ok = validate({ player: '  <b>Ayesha</b>  ', score: 140, grade: 'A+', distance: 900, time: 80, car: 'tank' });
    expect(ok.ok).toBe(true);
    expect(ok.entry.player).toBe('bAyesha/b');
    expect(ok.entry.score).toBe(100);
    expect(ok.entry.car).toBe('kart');
  });

  it('ranks players across devices by their best drive', async () => {
    const { fetchImpl, cfg } = fakeRedis();
    await submit(cfg, drive('Ali', 70), '1.1.1.1', fetchImpl);
    await submit(cfg, drive('Sara', 95), '2.2.2.2', fetchImpl);
    const r = await submit(cfg, drive('ali', 88), '3.3.3.3', fetchImpl); // same player, new laptop
    expect(r.body.isBest).toBe(true);
    expect(r.body.rank).toBe(2);
    expect(r.body.total).toBe(2);
    const worse = await submit(cfg, drive('Ali', 40), '3.3.3.3', fetchImpl);
    expect(worse.body.isBest).toBe(false);
    const board = await readBoard(cfg, 0, fetchImpl);
    expect(board.entries.map((e) => [e.player, e.score])).toEqual([['Sara', 95], ['ali', 88]]);
    expect(board.drives).toBe(4);
  });

  it('keeps a separate board per level', async () => {
    const { fetchImpl, cfg } = fakeRedis();
    await submit(cfg, drive('Ali', 80, { levelId: 3, distance: 1000, time: 90 }), 'x', fetchImpl);
    expect((await readBoard(cfg, 3, fetchImpl)).entries).toHaveLength(1);
    expect((await readBoard(cfg, 0, fetchImpl)).entries).toHaveLength(0);
  });

  it('rate-limits spam', async () => {
    const { fetchImpl, cfg } = fakeRedis();
    let last;
    for (let i = 0; i < 14; i++) last = await submit(cfg, drive(`P${i}`, 50), 'same-ip', fetchImpl);
    expect(last.status).toBe(429);
  });

  it('treats names case- and space-insensitively', () => {
    expect(playerKey('  Ali   Khan ')).toBe('ali khan');
  });
});
