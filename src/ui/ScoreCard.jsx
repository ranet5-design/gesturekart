import { useState } from 'react';
import { coachTips, downloadPDF, downloadPNG, fmtTime } from '../report/card.js';
import { SPEED_LIMIT_KMH } from '../game/config.js';

export default function ScoreCard({ report: r, onAgain, onMenu }) {
  const [busy, setBusy] = useState('');
  const tone = r.score >= 85 ? 'good' : r.score >= 55 ? 'warn' : 'bad';
  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn(r);
    } finally {
      setBusy('');
    }
  };
  const title =
    r.reason === 'finish' ? 'You reached Dharampura!' : r.reason === 'suspended' ? 'Licence suspended' : 'Drive ended';

  return (
    <div className="screen over">
      <div className="score-card">
        <header>
          <div>
            <div className="eyebrow">Civic Driving Score Card</div>
            <h2>{title}</h2>
            <p className="muted">
              {r.player} · {r.route} · {fmtTime(r.time)}
            </p>
          </div>
          <div className={`big-score ${tone}`}>
            <span className="n">{r.score}</span>
            <span className="g">{r.grade}</span>
            <span className="l">{r.label}</span>
          </div>
        </header>

        <div className="stat-grid">
          <Stat k="Distance" v={`${(r.distance / 1000).toFixed(2)} km`} />
          <Stat k="Avg speed" v={`${Math.round(r.avgKmh)} km/h`} />
          <Stat k="Proper stops" v={r.properStops} good />
          <Stat k="Red lights run" v={r.redsRun} bad={r.redsRun > 0} />
          <Stat k="Clean lane changes" v={r.counts.cleanLane || 0} good />
          <Stat k="Collisions" v={r.counts.crash || 0} bad={!!r.counts.crash} />
          <Stat k="Over-speeding" v={r.counts.overspeed || 0} bad={!!r.counts.overspeed} />
          <Stat k="Pedestrians" v={r.counts.pedestrian || 0} bad={!!r.counts.pedestrian} />
        </div>

        <SpeedChart r={r} />

        <div className="two-col">
          <div>
            <h3>Drive log</h3>
            <ul className="log">
              {r.events.length === 0 && <li className="muted">No events recorded.</li>}
              {r.events.slice(-8).map((e, i) => (
                <li key={i}>
                  <span className="t">{fmtTime(e.t)}</span>
                  <span>{e.label}</span>
                  <b className={e.points < 0 ? 'bad' : 'good'}>
                    {e.points > 0 ? '+' : ''}
                    {e.points}
                  </b>
                </li>
              ))}
            </ul>
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

        <div className="card-actions">
          <button className="primary" disabled={!!busy} onClick={() => run('pdf', downloadPDF)}>
            {busy === 'pdf' ? 'Preparing…' : '⬇ Download PDF'}
          </button>
          <button className="secondary" disabled={!!busy} onClick={() => run('png', downloadPNG)}>
            {busy === 'png' ? 'Preparing…' : '🖼 Download image'}
          </button>
          <span className="spacer" />
          <button className="secondary" onClick={onAgain}>
            ↻ Drive again
          </button>
          <button className="ghost" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, good, bad }) {
  return (
    <div className={`stat ${bad ? 'bad' : good && v > 0 ? 'good' : ''}`}>
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

function SpeedChart({ r }) {
  const W = 640;
  const H = 150;
  const tel = r.telemetry;
  const maxT = Math.max(1, r.time);
  const X = (t) => 8 + ((W - 16) * t) / maxT;
  const Y = (k) => H - 10 - ((H - 20) * Math.min(k, 90)) / 90;
  const path = tel.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.kmh).toFixed(1)}`).join(' ');
  return (
    <figure className="chart">
      <figcaption>
        Speed through the drive <span className="legend bad">● violation</span>
        <span className="legend good">● good habit</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Speed over time">
        <line x1="8" x2={W - 8} y1={Y(SPEED_LIMIT_KMH)} y2={Y(SPEED_LIMIT_KMH)} className="limit-line" />
        <path d={path} className="speed-line" />
        {r.events.map((e, i) => {
          const k = tel.find((p) => p.t >= e.t)?.kmh ?? 0;
          return <circle key={i} cx={X(e.t)} cy={Y(k)} r="5" className={e.points < 0 ? 'dot bad' : 'dot good'} />;
        })}
      </svg>
    </figure>
  );
}
