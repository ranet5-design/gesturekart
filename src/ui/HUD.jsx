import { useEffect, useRef, useState } from 'react';
import { game, gradeFor, VIEWS, limitAt, skipReplay } from '../game/state.js';
import { input } from '../cv/input.js';
import { CAR_LEN } from '../game/config.js';
import { settings } from '../game/settings.js';
import { RULES } from '../game/rules.js';
import { onCaption } from '../audio/voice.js';
import CameraPanel from './CameraPanel.jsx';
import { Wheel, SpeedGauge } from './Widgets.jsx';

const SPEED_HELP = {
  auto: ['Auto speed is on', 'Lower the wheel = slower', 'Right hand up = stop'],
  lift: ['Lift wheel = faster', 'Lower wheel = slower', 'Right hand up = stop'],
  distance: ['Hands wide = faster', 'Hands close = slower', 'Right hand up = stop'],
  lean: ['Lean forward = faster', 'Sit back = slower', 'Right hand up = stop'],
};

function snapshot() {
  const front = game.s + CAR_LEN / 2;
  const next = game.signals.find((g) => g.s > front - 0.5);
  const zone = limitAt(game.s);
  return {
    kmh: Math.round(game.v * 3.6),
    score: Math.round(game.score),
    dist: game.s,
    length: game.length,
    angle: input.wheelAngle,
    held: input.wheelHeld,
    lift: input.wheelLift,
    halt: input.halt,
    lean: input.steerSource === 'lean',
    resting: input.resting,
    lock: input.lock,
    cvFps: input.cvFps,
    source: input.source,
    signal: next ? { state: next.state, d: Math.max(0, Math.round(next.s - front)) } : null,
    events: game.events.slice(-4),
    eventCount: game.events.length,
    limit: zone.limit,
    zone: zone.label,
    indicator: game.indicator?.dir && game.t - game.indicator.at < 6 ? game.indicator.dir : null,
    seatbelt: game.seatbelt,
    xp: game.xp,
    combo: game.combo,
    popup: game.popup && game.t - game.popup.t < 2.2 ? game.popup : null,
    rule: game.ruleCard && game.t - game.ruleCard.t < 6 ? game.ruleCard : null,
    focusBanner: game.focus.banner && game.t - game.focus.banner.t < 4 ? game.focus.banner : null,
    pulse: game.focus.pulse > 0,
    faceOn: input.faceReady && settings.focusCheck && input.source === 'camera',
    attentive: input.attentive,
    fcw: game.fcw && game.t - game.fcw < 1.2,
    replay: game.replay ? { type: game.replay.type, pct: game.replay.i / Math.max(1, game.replay.frames.length - 1) } : null,
    level: game.level,
    t: game.t,
  };
}

export default function HUD({ onPause, paused, muted, onMute, view, onView, onSettings }) {
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
      if (e.points) setFlash({ bad: e.points < 0, key: s.eventCount });
    }
    lastCount.current = s.eventCount;
  }, [s.eventCount]);

  // Space or the brake gesture skips a replay
  useEffect(() => {
    if (!s.replay) return;
    const onKey = (e) => e.key === 'Enter' && skipReplay();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.replay]);

  const g = gradeFor(s.score);
  const progress = Math.min(1, s.dist / s.length);
  const tone = s.score >= 85 ? 'good' : s.score >= 55 ? 'warn' : 'bad';
  const camera = s.source === 'camera';
  const status = s.halt
    ? { cls: 'halt', icon: '✋', text: 'BRAKING' }
    : s.resting
      ? { cls: 'rest', icon: '🛋', text: 'ARM REST: CRUISE' }
      : s.lean
        ? { cls: 'lean', icon: '↔', text: 'LEAN STEERING' }
        : !s.held
          ? { cls: 'off', icon: '🙌', text: 'HOLD THE WHEEL' }
          : { cls: 'drive', icon: '●', text: 'DRIVING' };
  const help = camera ? SPEED_HELP[settings.speedMode] || SPEED_HELP.auto : null;
  const rule = s.rule && RULES[s.rule.type];

  return (
    <div className={`hud ${s.replay ? 'replaying' : ''}`}>
      {flash && <div key={flash.key} className={`flash ${flash.bad ? 'bad' : 'good'}`} />}
      {s.pulse && (settings.flash === 'soft' ? <div className="white-pulse short" /> : <div className="focus-glow" />)}
      {s.fcw && <div className="fcw">⚠ BRAKE!</div>}

      <section className="hud-score panel">
        <div className={`score-ring ${tone}`} style={{ '--p': s.score }}>
          <span>{s.score}</span>
        </div>
        <div className="score-meta">
          <span className="eyebrow">
            {s.level.id ? `Level ${s.level.id} · ${s.level.name}` : 'Free Drive'} · Civic Score
          </span>
          <b>
            {g.grade} · {g.label}
          </b>
          <div className="route-bar" aria-label={`${Math.round(progress * 100)}% of the route`}>
            <div className="route-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="route-text">
            {((s.length - s.dist) / 1000).toFixed(2)} km to {s.level.route.to} · ⭐ {s.xp} XP
            {s.combo > 1 ? ` · 🔥 combo x${s.combo}` : ''}
          </span>
        </div>
      </section>

      {s.focusBanner && (
        <div className={`focus-banner l${Math.min(3, s.focusBanner.level)}`} role="alert">
          <span>⚠</span>
          <div>
            <b>FOCUS!</b> {s.focusBanner.text}
            {s.focusBanner.level >= 2 && <small> Warning {s.focusBanner.level} of 3: one more and the drive pauses.</small>}
          </div>
        </div>
      )}

      {!s.focusBanner && s.signal && s.signal.d < 160 && (
        <section className={`hud-signal panel ${s.signal.state}`}>
          <div className="mini-light">
            <i className={s.signal.state === 'red' ? 'on r' : ''} />
            <i className={s.signal.state === 'yellow' ? 'on y' : ''} />
            <i className={s.signal.state === 'green' ? 'on g' : ''} />
          </div>
          <div>
            <div className="sig-d">
              {s.signal.d} m {settings.colorblind && <small className="cb">{s.signal.state === 'red' ? 'STOP' : s.signal.state === 'yellow' ? 'WAIT' : 'GO'}</small>}
            </div>
            <div className="sig-hint">
              {s.signal.state === 'green' ? 'Green: keep going' : camera ? '✋ Right hand up to stop' : 'Press Space to stop'}
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
              {s.faceOn && <span className={s.attentive ? 'b good' : 'b bad'}>{s.attentive ? '👁 focused' : '👁 focus!'}</span>}
              <span className="b">{s.cvFps} fps</span>
            </div>
          </div>
        )}
        <ul className="feed">
          {s.events
            .slice()
            .reverse()
            .filter((e) => e.points !== 0)
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

      {s.popup && !s.replay && (
        <div key={s.popup.t} className={`popup ${s.popup.kind}`} aria-live="polite">
          <b>{s.popup.text}</b>
          <small>{s.popup.sub}</small>
        </div>
      )}

      {rule && !s.replay && (
        <div className="rule-card" role="note">
          <span className="eyebrow">Traffic rule</span>
          <b>{rule.title}</b>
          <p>{rule.en}</p>
          <p className="ur">{rule.ur}</p>
        </div>
      )}

      {s.replay && (
        <div className="replay-overlay">
          <div className="rec">● REPLAY · slow motion</div>
          {RULES[s.replay.type] && (
            <div className="rule-card big">
              <span className="eyebrow">What went wrong</span>
              <b>{RULES[s.replay.type].title}</b>
              <p>{RULES[s.replay.type].en}</p>
              <p className="ur">{RULES[s.replay.type].ur}</p>
            </div>
          )}
          <div className="replay-bar">
            <i style={{ width: `${s.replay.pct * 100}%` }} />
          </div>
          <button className="ghost" onClick={skipReplay}>
            Skip replay <kbd>Enter</kbd>
          </button>
        </div>
      )}

      {caption && (
        <div className="caption" role="status">
          <span className="coach-dot" /> {caption}
        </div>
      )}

      <section className={`dash panel ${view === 'cockpit' ? 'no-wheel' : ''}`}>
        <div className="dash-gauge">
          <SpeedGauge kmh={s.kmh} limit={s.limit} />
          {s.zone && <div className="zone-chip">{s.zone}</div>}
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
          <div className="indicators" aria-label={s.indicator ? `${s.indicator} indicator on` : 'indicators off'}>
            <span className={s.indicator === 'left' ? 'on' : ''}>◀</span>
            <span className={s.seatbelt ? 'belt on' : 'belt'} title={s.seatbelt ? 'Seatbelt on' : 'No seatbelt'}>
              🔒
            </span>
            <span className={s.indicator === 'right' ? 'on' : ''}>▶</span>
          </div>
          <div className="dash-help">
            {camera ? (
              help.map((h) => <span key={h}>{h}</span>)
            ) : (
              <>
                <span>
                  <kbd>←</kbd>
                  <kbd>→</kbd> steer · <kbd>↑</kbd>
                  <kbd>↓</kbd> speed
                </span>
                <span>
                  <kbd>Space</kbd> brake · <kbd>Q</kbd>
                  <kbd>E</kbd> indicator
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="hud-buttons">
        <button className="ghost" onClick={onView} title="Change camera view">
          🎥 {VIEWS.find((v) => v.id === view)?.name} <kbd>C</kbd>
        </button>
        <button className="ghost" onClick={onSettings} aria-label="Settings">
          ⚙
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
