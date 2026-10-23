import { useState } from 'react';
import { coachTips, downloadPDF, downloadPNG, fmtTime, kmhAt, breakdown, endSummary, EVENT_INFO } from '../report/card.js';
import { SPEED_LIMIT_KMH } from '../game/config.js';
import { ordinal } from '../game/history.js';
import History from './History.jsx';
import SkillRadar, { weakestSkill, PRACTICE_FOR } from './SkillRadar.jsx';
import { SKILL_NAMES } from '../game/rules.js';
import { LEVELS } from '../game/levels.js';
import { shareCard, whatsappUrl, linkedinUrl } from '../report/card.js';

const tone = (s) => (s >= 85 ? 'good' : s >= 55 ? 'warn' : 'bad');

export default function ScoreCard({ report: r, onAgain, onMenu, onNext }) {
  const [shareMsg, setShareMsg] = useState('');
  const lr = r.levelResult;
  const pg = r.progress;
  const nextLevel = lr?.passed && r.levelId < LEVELS.length ? r.levelId + 1 : null;
  const delta = r.prevScore == null ? null : r.score - r.prevScore;
  const doShare = async () => {
    const res = await shareCard(r);
    setShareMsg(res === 'shared' ? 'Shared!' : 'Choose where to share:');
  };
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('summary');
  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn(r);
    } finally {
      setBusy('');
    }
  };
  const title = lr
    ? lr.passed
      ? `Level ${r.levelId} cleared! ${'★'.repeat(lr.stars)}`
      : `Level ${r.levelId} not passed yet`
    : r.reason === 'finish'
      ? `You reached ${r.routeTo}! 🏁`
      : r.reason === 'suspended'
        ? 'Licence suspended'
        : 'Drive ended';
  const rk = r.rank;
  const lost = breakdown(r.events).filter((b) => b.points < 0);
  const won = breakdown(r.events).filter((b) => b.points > 0);
  const maxLoss = Math.max(1, ...lost.map((b) => -b.points));

  return (
    <div className="screen over">
      <div className="score-card">
        {rk && (
          <div className={`rank-banner ${rk.isPersonalBest && !rk.firstDrive ? 'pb' : ''}`}>
            {rk.firstDrive ? (
              <span>🎉 First drive saved! Play again to beat it.</span>
            ) : rk.isPersonalBest ? (
              <span>🏆 New personal best! (previous best {rk.prevBest})</span>
            ) : (
              <span>Your best is still {rk.prevBest}. Keep practising!</span>
            )}
            <span className="rank-pills">
              <b>{ordinal(rk.personal)}</b> of your {rk.personalOf} drive{rk.personalOf > 1 ? 's' : ''}
              <i />
              <b>#{rk.boardPos}</b> of {rk.boardOf} on this device
              {r.online?.ok && (
                <>
                  <i />
                  🌍 <b>#{r.online.rank}</b> of {r.online.total} online
                  {r.online.isBest ? '' : ' (your best still counts)'}
                </>
              )}
              {r.online?.pending && <span className="muted"> · 🌍 sending…</span>}
            </span>
          </div>
        )}
        {r.saved === false && <p className="note">This browser blocked saving, so this drive isn't in your history.</p>}

        <header className="sc-head">
          <div>
            <div className="eyebrow">Civic Driving Score Card</div>
            <h2>{title}</h2>
            <p className="why">{endSummary(r)}</p>
            <p className="who">
              <b>{r.player}</b>
              {r.age ? ` · Age ${r.age}` : ''}
              {r.cnic ? ` · CNIC ${r.cnic}` : ''} · {r.carName} · {fmtTime(r.time)} ·{' '}
              {r.date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <div className={`big-ring ${tone(r.score)}`} style={{ '--p': r.score }}>
            <div>
              <span className="n">{r.score}</span>
              <span className="g">Grade {r.grade}</span>
              <span className="l">{r.label}</span>
            </div>
          </div>
        </header>

        <div className="tabs light" role="tablist">
          {[
            ['summary', 'Summary'],
            ['log', `Drive log (${r.events.length})`],
            ['history', 'History & ranking'],
          ].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'summary' && (
          <>
            {pg?.licenceEarned && (
              <div className="licence-cert">
                <span className="lc-icon">🪪</span>
                <div>
                  <b>Congratulations! You earned your GestureKart Driving Licence</b>
                  <p>
                    All 8 levels cleared by {r.player}. Share it, then try to get 3 stars on every level. (A game licence, not an
                    official one: for a real licence, visit your local traffic police licensing centre.)
                  </p>
                </div>
              </div>
            )}

            <div className="progress-row">
              {lr && (
                <div className={`level-result ${lr.passed ? 'pass' : 'fail'}`}>
                  <div className="lr-head">
                    <b>{lr.passed ? '✅ Passed' : '❌ Not passed'}</b>
                    <span className="stars big">
                      {[1, 2, 3].map((i) => (
                        <i key={i} className={i <= lr.stars ? 'on' : ''}>
                          ★
                        </i>
                      ))}
                    </span>
                  </div>
                  <ul>
                    {lr.checks.map((c) => (
                      <li key={c.id} className={c.ok ? 'ok' : 'no'}>
                        {c.ok ? '✓' : '✗'} {c.text}
                        {!c.ok && c.have && <small> (you: {c.have})</small>}
                      </li>
                    ))}
                  </ul>
                  {r.failReason && <p className="exam">Examiner stopped the test: {r.failReason}.</p>}
                  {!lr.passed && <p className="tip-line">Fix the ✗ items above and try again. You've got this!</p>}
                  {lr.passed && lr.stars < 3 && <p className="tip-line">Want more stars? Score 85+ for ★★ and 95+ (fully focused) for ★★★.</p>}
                </div>
              )}
              {pg && (
                <div className="xp-box">
                  <div className="xp-total">
                    <b>+{pg.earned} XP</b>
                    <span>
                      {pg.rank.name}
                      {pg.rankUp ? ' · RANK UP! 🎉' : ''}
                    </span>
                  </div>
                  <div className="xp-bar">
                    <i style={{ width: `${Math.round(pg.rank.pct * 100)}%` }} />
                  </div>
                  <small>{pg.rank.next ? `${pg.rank.toNext} XP to ${pg.rank.next.name}` : 'Top rank reached'}</small>
                  <ul>
                    {pg.xp.map((x) => (
                      <li key={x.label}>
                        <span>{x.label}</span>
                        <b>+{x.xp}</b>
                      </li>
                    ))}
                  </ul>
                  <div className="chips">
                    <span className="chip fire">🔥 {pg.streak}-day streak</span>
                    <span className={`chip ${pg.challengeDone ? 'done' : ''}`}>
                      🎯 {pg.challenge.text} {pg.challengeDone ? '✓ done!' : ''}
                    </span>
                    {pg.unlocked && <span className="chip done">🔓 Level {pg.unlocked} unlocked</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="moments">
              {r.bestMoment && (
                <div className="moment good">
                  <span>🌟 Best moment</span>
                  <b>
                    {fmtTime(r.bestMoment.t)} · {r.bestMoment.label}
                    {r.bestMoment.combo > 1 ? ` (combo x${r.bestMoment.combo})` : ''}
                  </b>
                </div>
              )}
              {delta != null && (
                <div className={`moment ${delta >= 0 ? 'good' : 'bad'}`}>
                  <span>📈 Compared with last time</span>
                  <b>
                    {delta > 0 ? `+${delta} points better!` : delta === 0 ? 'Same score as last time' : `${delta} points. You can beat it!`}
                  </b>
                </div>
              )}
              {r.attention != null && (
                <div className={`moment ${r.attention >= 90 ? 'good' : 'bad'}`}>
                  <span>👁 Attention</span>
                  <b>
                    {r.attention}% of the drive focused{r.focusAlerts ? ` · ${r.focusAlerts} warning(s)` : ''}
                  </b>
                </div>
              )}
            </div>

            <div className="stat-grid">
              <Stat k="Distance" v={`${(r.distance / 1000).toFixed(2)} km`} sub={`of ${(r.routeLength / 1000).toFixed(1)} km`} />
              <Stat k="Avg / top speed" v={`${Math.round(r.avgKmh)} / ${Math.round(r.maxKmh)}`} sub="km/h" />
              <Stat k="Proper stops at red" v={r.properStops} good sub={`${r.redsFaced} red lights faced`} />
              <Stat k="Clean lane changes" v={r.counts.cleanLane || 0} good />
              <Stat k="Red lights run" v={r.redsRun} bad={r.redsRun > 0} />
              <Stat k="Pedestrians hit" v={r.counts.pedestrian || 0} bad={!!r.counts.pedestrian} />
              <Stat k="Collisions" v={r.counts.crash || 0} bad={!!r.counts.crash} />
              <Stat k="Over-speeding" v={r.counts.overspeed || 0} bad={!!r.counts.overspeed} />
            </div>

            <SpeedChart r={r} />

            <div className="two-col">
              <div>
                <h3>Where your points went</h3>
                {lost.length === 0 ? (
                  <p className="muted">You didn't lose a single point. Excellent!</p>
                ) : (
                  <ul className="loss">
                    {lost.map((b) => (
                      <li key={b.type}>
                        <span>
                          {EVENT_INFO[b.type]?.label || b.type} <small>× {b.count}</small>
                        </span>
                        <i>
                          <b style={{ width: `${(-b.points / maxLoss) * 100}%` }} />
                        </i>
                        <em>{b.points}</em>
                      </li>
                    ))}
                  </ul>
                )}
                {won.length > 0 && (
                  <p className="won">
                    Won back:{' '}
                    {won.map((b) => `${EVENT_INFO[b.type]?.label.toLowerCase() || b.type} × ${b.count} (+${b.points})`).join(', ')}
                  </p>
                )}
              </div>
              <div>
                <h3>Coach's notes</h3>
                <ul className="tips">
                  {coachTips(r).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="skills-row">
              <SkillRadar skills={r.skills} light />
              <div>
                <h3>Your driving skills</h3>
                {(() => {
                  const w = weakestSkill(r.skills);
                  return w ? (
                    <p>
                      Work on <b>{SKILL_NAMES[w.k]}</b> ({w.v}/100). Level {PRACTICE_FOR[w.k]} (
                      {LEVELS[PRACTICE_FOR[w.k] - 1].name}) trains exactly this.
                    </p>
                  ) : (
                    <p>Every skill tested is 85 or above. Excellent, well-rounded driving!</p>
                  );
                })()}
                <p className="muted">Skills are worked out from this drive. "–" means the drive didn't test that skill.</p>
              </div>
            </div>
          </>
        )}

        {tab === 'log' && <FullLog r={r} />}

        {tab === 'history' && <History compact player={r.player} highlightId={r.historyId} />}

        <div className="card-actions">
          <button className="primary" disabled={!!busy} onClick={() => run('pdf', downloadPDF)}>
            {busy === 'pdf' ? 'Preparing…' : '⬇ Download PDF'}
          </button>
          <button className="secondary" disabled={!!busy} onClick={() => run('png', downloadPNG)}>
            {busy === 'png' ? 'Preparing…' : '🖼 Download image'}
          </button>
          <button className="secondary" onClick={doShare}>
            📤 Share
          </button>
          <span className="spacer" />
          {nextLevel && (
            <button className="primary" onClick={() => onNext(nextLevel)}>
              Next: Level {nextLevel} →
            </button>
          )}
          <button className="secondary" onClick={onAgain}>
            ↻ {lr && !lr.passed ? 'Try again' : 'Drive again'}
          </button>
          <button className="ghost" onClick={onMenu}>
            Menu
          </button>
        </div>
        {shareMsg && (
          <div className="share-row">
            <span>{shareMsg}</span>
            {shareMsg !== 'Shared!' && (
              <>
                <a className="secondary" href={whatsappUrl(r)} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
                <a className="secondary" href={linkedinUrl()} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>
                <button className="ghost" onClick={() => run('png', downloadPNG)}>
                  Save image
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ k, v, sub, good, bad }) {
  return (
    <div className={`stat ${bad ? 'bad' : good && Number(v) > 0 ? 'good' : ''}`}>
      <span>{k}</span>
      <b>{v}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function FullLog({ r }) {
  let score = 100;
  return (
    <div className="full-log">
      {r.events.length === 0 ? (
        <p className="muted">No events recorded.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>What happened</th>
              <th>Points</th>
              <th>Score after</th>
            </tr>
          </thead>
          <tbody>
            {r.events.map((e, i) => {
              score = Math.max(0, Math.min(100, score + e.points));
              return (
                <tr key={i}>
                  <td className="t">{fmtTime(e.t)}</td>
                  <td>{e.label}</td>
                  <td className={e.points < 0 ? 'bad' : 'good'}>
                    {e.points > 0 ? '+' : ''}
                    {e.points}
                  </td>
                  <td className={tone(score)}>{score}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SpeedChart({ r }) {
  const W = 760;
  const H = 190;
  const L = 40; // room for the km/h labels
  const B = 24; // room for the time labels
  const tel = r.telemetry;
  const maxT = Math.max(1, r.time);
  const X = (t) => L + ((W - L - 10) * t) / maxT;
  const Y = (k) => H - B - ((H - B - 10) * Math.min(k, 90)) / 90;
  const path = tel.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.kmh).toFixed(1)}`).join(' ');
  const area = tel.length ? `${path} L${X(tel[tel.length - 1].t)},${Y(0)} L${X(tel[0].t)},${Y(0)} Z` : '';
  const ticksT = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxT);
  return (
    <figure className="chart">
      <figcaption>
        Speed through the drive
        <span className="legend bad">● mistake</span>
        <span className="legend good">● good habit</span>
        <span className="legend lim">- - limit {SPEED_LIMIT_KMH}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Speed over time, with mistakes and good habits marked">
        {[0, 30, 60, 90].map((k) => (
          <g key={k}>
            <line x1={L} x2={W - 10} y1={Y(k)} y2={Y(k)} className="grid" />
            <text x={L - 6} y={Y(k) + 4} textAnchor="end" className="axis">
              {k}
            </text>
          </g>
        ))}
        {ticksT.map((t) => (
          <text key={t} x={X(t)} y={H - 6} textAnchor="middle" className="axis">
            {fmtTime(t)}
          </text>
        ))}
        <line x1={L} x2={W - 10} y1={Y(SPEED_LIMIT_KMH)} y2={Y(SPEED_LIMIT_KMH)} className="limit-line" />
        <path d={area} className="speed-area" />
        <path d={path} className="speed-line" />
        {r.events.map((e, i) => (
          <circle key={i} cx={X(e.t)} cy={Y(kmhAt(tel, e.t))} r="6" className={e.points < 0 ? 'dot bad' : 'dot good'}>
            <title>
              {fmtTime(e.t)} · {e.label} ({e.points > 0 ? '+' : ''}
              {e.points})
            </title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}
