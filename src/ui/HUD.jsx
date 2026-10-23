import { useEffect, useRef, useState } from 'react';
import { game, gradeFor } from '../game/state.js';
import { input } from '../cv/input.js';
import { ROUTE_LENGTH, SPEED_LIMIT_KMH, CAR_LEN } from '../game/config.js';
import { onCaption } from '../audio/voice.js';
import CameraPanel from './CameraPanel.jsx';

function snapshot() {
  const front = game.s + CAR_LEN / 2;
  const next = game.signals.find((g) => g.s > front - 0.5);
  return {
    kmh: Math.round(game.v * 3.6),
    score: Math.round(game.score),
    dist: game.s,
    t: game.t,
    steer: input.steer,
    throttle: input.throttle,
    halt: input.halt,
    poseVisible: input.poseVisible,
    cvFps: input.cvFps,
    source: input.source,
    signal: next ? { state: next.state, d: Math.max(0, Math.round(next.s - front)) } : null,
    events: game.events.slice(-5),
    eventCount: game.events.length,
  };
}

export default function HUD({ onPause, paused, muted, onMute }) {
  const [s, setS] = useState(snapshot);
  const [caption, setCaption] = useState('');
  const [flash, setFlash] = useState(null);
  const lastCount = useRef(0);
  const capTimer = useRef();

  useEffect(() => {
    const id = setInterval(() => setS(snapshot()), 80);
    return () => clearInterval(id);
  }, []);

  useEffect(
    () =>
      onCaption((text) => {
        setCaption(text);
        clearTimeout(capTimer.current);
        capTimer.current = setTimeout(() => setCaption(''), 3500);
      }),
    [],
  );

  useEffect(() => {
    if (s.eventCount > lastCount.current) {
      const e = game.events[game.events.length - 1];
      setFlash({ bad: e.points < 0, key: s.eventCount });
    }
    lastCount.current = s.eventCount;
  }, [s.eventCount]);

  const g = gradeFor(s.score);
  const over = s.kmh > SPEED_LIMIT_KMH;
  const progress = Math.min(1, s.dist / ROUTE_LENGTH);
  const scoreTone = s.score >= 85 ? 'good' : s.score >= 55 ? 'warn' : 'bad';

  return (
    <div className="hud">
      {flash && <div key={flash.key} className={`flash ${flash.bad ? 'bad' : 'good'}`} />}

      <section className="hud-score panel">
        <div className={`score-num ${scoreTone}`}>{s.score}</div>
        <div className="score-meta">
          <span className="eyebrow">Civic Score</span>
          <span className="grade">
            {g.grade} · {g.label}
          </span>
        </div>
        <div className="route">
          <div className="route-bar">
            <div className="route-fill" style={{ width: `${progress * 100}%` }} />
            <div className="route-kart" style={{ left: `${progress * 100}%` }} />
          </div>
          <div className="route-labels">
            <span>Thokar</span>
            <span>{((ROUTE_LENGTH - s.dist) / 1000).toFixed(2)} km left</span>
            <span>Dharampura</span>
          </div>
        </div>
      </section>

      {s.signal && s.signal.d < 160 && (
        <section className={`hud-signal panel ${s.signal.state}`}>
          <div className="mini-light">
            <i className={s.signal.state === 'red' ? 'on r' : ''} />
            <i className={s.signal.state === 'yellow' ? 'on y' : ''} />
            <i className={s.signal.state === 'green' ? 'on g' : ''} />
          </div>
          <div>
            <div className="eyebrow">Signal ahead</div>
            <div className="sig-d">{s.signal.d} m</div>
            {s.signal.state !== 'green' && <div className="sig-hint">✋ Raise right hand to stop</div>}
          </div>
        </section>
      )}

      <aside className="hud-right">
        {s.source === 'camera' ? (
          <div className="panel cam-wrap">
            <CameraPanel />
            {!s.poseVisible && <div className="cam-lost">Step into the frame</div>}
            <div className="cam-fps">{s.cvFps} fps</div>
          </div>
        ) : (
          <div className="panel keys">
            <div className="eyebrow">Keyboard</div>
            <div><kbd>←</kbd><kbd>→</kbd> steer</div>
            <div><kbd>↑</kbd><kbd>↓</kbd> speed</div>
            <div><kbd>Space</kbd> stop</div>
          </div>
        )}
        <div className="panel meters">
          <Meter label="Steer" value={s.steer} centered />
          <Meter label="Throttle" value={s.throttle} />
          <div className={`halt ${s.halt ? 'on' : ''}`}>{s.halt ? '✋ HALT' : 'Halt: right hand up'}</div>
        </div>
        <ul className="feed">
          {s.events
            .slice()
            .reverse()
            .map((e) => (
              <li key={`${e.t}-${e.type}`} className={e.points < 0 ? 'bad' : 'good'}>
                <span>{e.label}</span>
                <b>
                  {e.points > 0 ? '+' : ''}
                  {e.points}
                </b>
              </li>
            ))}
        </ul>
      </aside>

      <section className={`hud-speed panel ${over ? 'over' : ''}`}>
        <div className="speed-num">{s.kmh}</div>
        <div className="speed-unit">km/h</div>
        <div className="limit" title="Speed limit">
          {SPEED_LIMIT_KMH}
        </div>
      </section>

      {caption && (
        <div className="caption" role="status">
          <span className="coach-dot" /> {caption}
        </div>
      )}

      <div className="hud-buttons">
        <button className="ghost" onClick={onMute} aria-label="Toggle sound">
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="ghost" onClick={onPause}>
          {paused ? 'Resume' : 'Pause'} <kbd>P</kbd>
        </button>
      </div>
    </div>
  );
}

function Meter({ label, value, centered }) {
  const pct = centered ? 50 + value * 50 : value * 100;
  return (
    <div className="meter">
      <span>{label}</span>
      <div className={`bar ${centered ? 'centered' : ''}`}>
        {centered ? (
          <div
            className="fill"
            style={{ left: `${Math.min(50, pct)}%`, width: `${Math.abs(pct - 50)}%` }}
          />
        ) : (
          <div className="fill" style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}
