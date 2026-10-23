import { useEffect, useMemo, useState } from 'react';
import { fetchOnline } from '../game/online.js';
import { LEVELS } from '../game/levels.js';
import { loadHistory, bestPerPlayer, rankSort, sameName, statsFor, fmtDate, deleteDrives, ordinal } from '../game/history.js';
import { carById } from '../game/config.js';
import { fmtTime } from '../report/card.js';

const tone = (s) => (s >= 85 ? 'good' : s >= 55 ? 'warn' : 'bad');
const reasonText = { finish: 'Finished', suspended: 'Suspended', quit: 'Ended early' };

function Trend({ scores }) {
  if (scores.length < 2) return null;
  const W = 220;
  const H = 54;
  const X = (i) => 4 + ((W - 8) * i) / (scores.length - 1);
  const Y = (s) => H - 4 - ((H - 8) * s) / 100;
  const d = scores.map((s, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(s).toFixed(1)}`).join(' ');
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Last ${scores.length} scores`}>
      <line x1="4" x2={W - 4} y1={Y(85)} y2={Y(85)} className="t-ref" />
      <path d={d} className="t-line" />
      {scores.map((s, i) => (
        <circle key={i} cx={X(i)} cy={Y(s)} r={i === scores.length - 1 ? 4 : 2.5} className={`t-dot ${tone(s)}`} />
      ))}
    </svg>
  );
}

function Medal({ n }) {
  return <span className={`medal m${n <= 3 ? n : 0}`}>{n <= 3 ? ['🥇', '🥈', '🥉'][n - 1] : `#${n}`}</span>;
}

/** Shared leaderboard across every laptop and phone, per level. */
function OnlineBoard({ player }) {
  const [level, setLevel] = useState(0);
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    fetchOnline(level).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [level]);

  return (
    <div className="online">
      <div className="online-head">
        <label>
          Board:{' '}
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            <option value={0}>Free Drive (full Canal Road)</option>
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                Level {l.id}: {l.name}
              </option>
            ))}
          </select>
        </label>
        {data?.ok && (
          <span className="muted">
            {data.total} player{data.total === 1 ? '' : 's'} · {data.drives} drives worldwide
          </span>
        )}
      </div>
      {!data ? (
        <p className="h-empty">Loading the online leaderboard…</p>
      ) : !data.ok ? (
        <p className="h-empty">
          🌍 Online leaderboard unavailable: {data.error}
          {data.status === 503 && <><br />The game owner needs to connect the free database in Vercel (see README).</>}
        </p>
      ) : data.entries.length === 0 ? (
        <p className="h-empty">No one is on this board yet. Finish a drive to be number 1!</p>
      ) : (
        <div className="h-table-wrap">
          <table className="h-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Driver</th>
                <th>Best score</th>
                <th>Distance</th>
                <th>Car</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e, i) => {
                const me = sameName(e.player, player);
                return (
                  <tr key={`${e.player}-${i}`} className={me ? 'me' : ''}>
                    <td>
                      <Medal n={i + 1} />
                    </td>
                    <td className="who">
                      {e.player}
                      {me && <em>you</em>}
                    </td>
                    <td>
                      <b className={`sc ${tone(e.score)}`}>{e.score}</b> <small>{e.grade}</small>
                    </td>
                    <td>
                      {(e.distance / 1000).toFixed(2)} km <small>· {fmtTime(e.time)}</small>
                    </td>
                    <td>{carById(e.car).name}</td>
                    <td className="dt">{fmtDate(e.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * History & leaderboard. Used full-screen from the menu, and as a tab inside the score card
 * (`compact`, with the drive that just finished highlighted).
 */
export default function History({ player = '', highlightId, compact = false, onClose }) {
  const [list, setList] = useState(loadHistory);
  const [tab, setTab] = useState(compact ? 'mine' : 'board');
  const [confirm, setConfirm] = useState(false);

  const board = useMemo(() => bestPerPlayer(list), [list]);
  const ranked = useMemo(() => [...list].sort(rankSort), [list]);
  const mine = useMemo(
    () => list.filter((e) => sameName(e.player, player)).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [list, player],
  );
  const mineRanked = useMemo(() => [...mine].sort(rankSort), [mine]);
  const myStats = statsFor(mine);
  const myBoard = board.findIndex((e) => sameName(e.player, player)) + 1;

  const rows = tab === 'board' ? board : tab === 'all' ? ranked : mine;

  const clearMine = () => {
    setList(deleteDrives((e) => sameName(e.player, player)));
    setConfirm(false);
  };

  return (
    <div className={`history ${compact ? 'compact' : 'full'}`}>
      {!compact && (
        <header className="h-head">
          <div>
            <div className="eyebrow">Saved on this device</div>
            <h2>🏆 History &amp; leaderboard</h2>
          </div>
          <button className="ghost" onClick={onClose}>
            ← Back to menu
          </button>
        </header>
      )}

      {player && myStats && (
        <div className="h-me">
          <div className="h-tile">
            <span>Leaderboard</span>
            <b>{myBoard ? ordinal(myBoard) : '–'}</b>
            <small>of {board.length} players</small>
          </div>
          <div className="h-tile">
            <span>Best score</span>
            <b className={tone(myStats.best)}>{myStats.best}</b>
            <small>avg {myStats.avg}</small>
          </div>
          <div className="h-tile">
            <span>Drives</span>
            <b>{myStats.drives}</b>
            <small>{myStats.finished} finished</small>
          </div>
          <div className="h-tile wide">
            <span>Score trend</span>
            <Trend scores={myStats.trend} />
            <small>Last played {fmtDate(myStats.last)}</small>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'board'} className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>
          Leaderboard
        </button>
        {player && (
          <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
            My drives ({mine.length})
          </button>
        )}
        <button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
          All drives ({list.length})
        </button>
        <button role="tab" aria-selected={tab === 'online'} className={tab === 'online' ? 'on' : ''} onClick={() => setTab('online')}>
          🌍 Online
        </button>
      </div>

      {tab === 'online' ? (
        <OnlineBoard player={player} />
      ) : rows.length === 0 ? (
        <p className="h-empty">No drives saved yet. Finish a drive and it will show up here with its date and time.</p>
      ) : (
        <div className="h-table-wrap">
          <table className="h-table">
            <thead>
              <tr>
                <th>{tab === 'mine' ? 'Your rank' : 'Rank'}</th>
                {tab !== 'mine' && <th>Driver</th>}
                <th>Score</th>
                <th>Distance</th>
                <th>Car</th>
                <th>Result</th>
                <th>Date &amp; time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const rank = tab === 'mine' ? mineRanked.findIndex((x) => x.id === e.id) + 1 : i + 1;
                const me = sameName(e.player, player);
                return (
                  <tr key={e.id} className={`${e.id === highlightId ? 'just' : ''} ${me && tab !== 'mine' ? 'me' : ''}`}>
                    <td>
                      <Medal n={rank} />
                    </td>
                    {tab !== 'mine' && (
                      <td className="who">
                        {e.player}
                        {me && <em>you</em>}
                      </td>
                    )}
                    <td>
                      <b className={`sc ${tone(e.score)}`}>{e.score}</b> <small>{e.grade}</small>
                    </td>
                    <td>
                      {(e.distance / 1000).toFixed(2)} km <small>· {fmtTime(e.time)}</small>
                    </td>
                    <td>{carById(e.car).name}</td>
                    <td>
                      <span className={`res ${e.reason}`}>{reasonText[e.reason] || e.reason}</span>
                    </td>
                    <td className="dt">
                      {fmtDate(e.date)}
                      {e.id === highlightId && <em>this drive</em>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!compact && player && mine.length > 0 && tab !== 'online' && (
        <div className="h-foot">
          {confirm ? (
            <>
              <span>Delete all {mine.length} of {player}'s saved drives? This can't be undone.</span>
              <button className="secondary danger" onClick={clearMine}>
                Yes, delete
              </button>
              <button className="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="ghost" onClick={() => setConfirm(true)}>
              Clear my history
            </button>
          )}
        </div>
      )}
    </div>
  );
}
