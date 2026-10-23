import { useEffect, useRef, useState } from 'react';
import { game, gradeFor } from '../game/state.js';
import { input } from '../cv/input.js';
import { ROUTE_LENGTH, SPEED_LIMIT_KMH, CAR_LEN } from '../game/config.js';
import { onCaption } from '../audio/voice.js';
import CameraPanel from './CameraPanel.jsx';
import { Wheel, SpeedGauge } from './Widgets.jsx';

function snapshot() {
  const front = game.s + CAR_LEN / 2;
  const next = game.signals.find((g) => g.s > front - 0.5);
  return {
    kmh: Math.round(game.v * 3.6),
    score: Math.round(game.score),
    dist: game.s,
    angle: input.wheelAngle,
    held: input.wheelHeld,
    lift: input.wheelLift,
    halt: input.halt,
    lock: input.lock,
    cvFps: input.cvFps,
    source: input.source,
    signal: next ? { state: next.state, d: Math.max(0, Math.round(next.s - front)) } : null,
    events: game.events.slice(-4),
    eventCount: game.events.length,
  };
}

export default function HUD({ onPause, paused, muted, onMute, view, onView }) {
  const [s, setS] = useState(snapshot);
  const [caption, setCaption] = useState('');
  const [flash, setFlash] = useState(null);
  const lastCount = useRef(0);
  const capTimer = useRef();

  useEffect(() => {
    const id = setInterval(() => setS(snapshot()), 60);
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
  const progress = Math.min(1, s.dist / ROUTE_LENGTH);
  const tone = s.score >= 85 ? 'good' : s.score >= 55 ? 'warn' : 'bad';
  const camera = s.source === 'camera';
  const status = s.halt
    ? { cls: 'halt', icon: '✋', text: 'BRAKING' }
    : !s.held
      ? { cls: 'off', icon: '🙌', text: 'HOLD THE WHEEL' }
      : { cls: 'drive', icon: '●', text: 'DRIVING' };

  return (
    <div className="hud">
      {flash && <div key={flash.key} className={`flash ${flash.bad ? 'bad' : 'good'}`} />}

      <section className="hud-score panel">
        <div className={`score-ring ${tone}`} style={{ '--p': s.score }}>
          <span>{s.score}</span>
        </div>
        <div className="score-meta">
          <span className="eyebrow">Civic Score</span>
          <b>
            {g.grade} · {g.label}
          </b>
          <div className="route-bar" aria-label={`${Math.round(progress * 100)}% of the route`}>
            <div className="route-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="route-text">{((ROUTE_LENGTH - s.dist) / 1000).toFixed(2)} km to Dharampura</span>
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
            <div className="sig-d">{s.signal.d} m</div>
            <div className="sig-hint">
              {s.signal.state === 'green'
                ? 'Green: keep going'
                : camera
                  ? '✋ Right hand up to stop'
                  : 'Press Space to stop'}
            </div>
          </div>
        </section>
      )}

      <aside className="hud-right">
        {camera && (
          <div className="panel cam-wrap">
            <CameraPanel />
            <div className="cam-badges">
              <span className={s.lock >= 1 ? 'b good' : 'b warn'}>🔒 {Math.round(s.lock * 100)}%</span>
              <span className="b">{s.cvFps} fps</span>
            </div>
          </div>
        )}
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

      {caption && (
        <div className="caption" role="status">
          <span className="coach-dot" /> {caption}
        </div>
      )}

      <section className={`dash panel ${view === 'cockpit' ? 'no-wheel' : ''}`}>
        <div className="dash-gauge">
          <SpeedGauge kmh={s.kmh} limit={SPEED_LIMIT_KMH} />
        </div>
        {view !== 'cockpit' && (
          <div className="dash-wheel">
            <Wheel angle={s.angle} held={s.held} halt={s.halt} size={132} />
          </div>
        )}
        <div className="dash-status">
          <div className={`status ${status.cls}`}>
            <span>{status.icon}</span> {status.text}
          </div>
          <div className="gas">
            <span>{camera ? 'Wheel height' : 'Gas'}</span>
            <div className="gas-bar">
              <i style={{ height: `${Math.round(s.lift * 100)}%` }} />
            </div>
            <small>{s.lift > 0.72 ? 'Fast' : s.lift < 0.3 ? 'Slow' : 'Normal'}</small>
          </div>
          <div className="dash-help">
            {camera ? (
              <>
                <span>Turn wheel = steer</span>
                <span>Lift wheel = faster</span>
                <span>Right hand up = brake</span>
              </>
            ) : (
              <>
                <span>
                  <kbd>←</kbd>
                  <kbd>→</kbd> steer
                </span>
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> speed
                </span>
                <span>
                  <kbd>Space</kbd> brake
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="hud-buttons">
        <button className="ghost" onClick={onView}>
          {view === 'cockpit' ? '🎥 Behind car' : '🪑 Driver seat'} <kbd>C</kbd>
        </button>
        <button className="ghost" onClick={onMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="ghost" onClick={onPause}>
          {paused ? 'Resume' : 'Pause'} <kbd>P</kbd>
        </button>
      </div>
    </div>
  );
}
