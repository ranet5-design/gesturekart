import { useEffect, useRef, useState } from 'react';
import { input, updateKeyboard, keyDown } from '../cv/input.js';
import { beginCalibration, endCalibration } from '../cv/pose.js';
import { chime } from '../audio/sound.js';
import { say } from '../audio/voice.js';
import CameraPanel from './CameraPanel.jsx';
import { Wheel, LockRing } from './Widgets.jsx';

const CAM_STEPS = [
  {
    id: 'hold',
    title: 'Hold the wheel straight',
    ur: 'Dono haath seene ke saamne rakhein, jaise steering pakri ho',
    test: () => input.wheelHeld && Math.abs(input.wheelAngle) < 0.2,
    need: 1.2,
  },
  {
    id: 'left',
    title: 'Turn the wheel left',
    ur: 'Steering ko baayein (left) ghumayein: left haath neeche, right haath upar',
    test: () => input.wheelHeld && input.steer < -0.6,
    need: 0.4,
  },
  {
    id: 'right',
    title: 'Turn the wheel right',
    ur: 'Steering ko daayein (right) ghumayein: right haath neeche, left haath upar',
    test: () => input.wheelHeld && input.steer > 0.6,
    need: 0.4,
  },
  {
    id: 'lift',
    title: 'Lift the wheel up to go faster',
    ur: 'Wheel upar = tez, neeche = aahista',
    test: () => input.wheelHeld && input.wheelLift > 0.72,
    need: 0.4,
  },
  {
    id: 'brake',
    title: 'Raise your right hand to brake',
    ur: 'Right haath sar se upar = gaari rukegi',
    test: () => input.halt,
    need: 0.5,
  },
];

const KEY_STEPS = [
  { id: 'left', title: 'Steer left', ur: '← arrow dabaayein', keys: ['←'], test: () => keyDown('arrowleft') || keyDown('a'), need: 0.3 },
  { id: 'right', title: 'Steer right', ur: '→ arrow dabaayein', keys: ['→'], test: () => keyDown('arrowright') || keyDown('d'), need: 0.3 },
  { id: 'lift', title: 'Speed up', ur: '↑ arrow dabaayein (↓ se aahista)', keys: ['↑'], test: () => keyDown('arrowup') || keyDown('w'), need: 0.3 },
  { id: 'brake', title: 'Brake', ur: 'Space bar dabaayein', keys: ['Space'], test: () => keyDown(' '), need: 0.3 },
];

/**
 * Guided practice before every drive. With the webcam, nothing can start until the body lock is at 100%.
 * `short` skips straight to the "hold the wheel" check for players who already practised this session.
 */
export default function Practice({ mode, short = false, onDone, onBack }) {
  const camera = mode === 'camera';
  const steps = camera ? (short ? CAM_STEPS.slice(0, 1) : CAM_STEPS) : KEY_STEPS;
  const st = useRef({ idx: 0, hold: 0, calib: false, finished: false, wasLocked: false });
  const [v, setV] = useState({ idx: 0, prog: 0, lock: 0, locked: false, issue: '', parts: 0 });

  useEffect(() => {
    let raf;
    let last = performance.now();
    let lastUi = 0;
    say(
      camera
        ? 'Sit facing the camera with your head, shoulders and both hands in view.'
        : 'Quick practice. Press each key shown on screen.',
      { urgent: true },
    );
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      updateKeyboard(dt);
      const s = st.current;
      const lockOk = !camera || input.locked;

      if (camera && input.locked && !s.wasLocked) {
        s.wasLocked = true;
        chime();
        say(`Body locked. ${steps[s.idx]?.title || ''}.`, { key: 'locked', cooldown: 3000, urgent: true });
      }
      if (camera && !input.locked) s.wasLocked = false;

      if (lockOk && s.idx < steps.length) {
        const step = steps[s.idx];
        if (step.id === 'hold' && !s.calib && input.wheelHeld) {
          beginCalibration();
          s.calib = true;
        }
        s.hold = step.test() ? s.hold + dt : Math.max(0, s.hold - dt * 2);
        if (s.hold >= step.need) {
          if (step.id === 'hold') endCalibration();
          s.idx++;
          s.hold = 0;
          chime();
          const nextStep = steps[s.idx];
          if (nextStep) say(nextStep.title, { key: 'step', cooldown: 500, urgent: true });
        }
      }
      if (s.idx >= steps.length && lockOk && !s.finished) {
        s.finished = true;
        say('Well done! Starting the drive.', { urgent: true });
        setTimeout(onDone, 1000);
      }
      if (now - lastUi > 60) {
        lastUi = now;
        const step = steps[Math.min(s.idx, steps.length - 1)];
        setV({
          idx: s.idx,
          prog: Math.min(1, s.hold / step.need),
          lock: input.lock,
          locked: input.locked,
          issue: input.lockIssue,
          parts: input.lockParts,
          angle: input.wheelAngle,
          held: input.wheelHeld,
          halt: input.halt,
          lift: input.wheelLift,
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // steps/onDone are fixed for the life of this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waitingLock = camera && !v.locked;
  const done = v.idx >= steps.length;

  return (
    <div className="screen practice">
      <div className="practice-card">
        <header className="practice-head">
          <div>
            <div className="eyebrow">{camera ? 'Step 1 · Body lock  →  Step 2 · Practice' : 'Quick practice'}</div>
            <h2>{waitingLock ? 'Locking on to your body…' : done ? 'Ready to drive!' : 'Practice the controls'}</h2>
          </div>
          <div className="practice-actions">
            <button className="ghost" onClick={onBack}>
              ← Back
            </button>
            {camera && !short && v.locked && v.idx >= 1 && !done && (
              <button className="secondary" onClick={onDone}>
                Skip practice
              </button>
            )}
          </div>
        </header>

        <div className="practice-body">
          <div className="practice-view">
            {camera ? (
              <div className={`cam-stage ${v.locked ? 'is-locked' : ''}`}>
                <CameraPanel big />
                <div className="frame-guide" aria-hidden="true">
                  <i className="c tl" />
                  <i className="c tr" />
                  <i className="c bl" />
                  <i className="c br" />
                </div>
                <div className="lock-overlay">
                  <LockRing value={v.lock} locked={v.locked} size={96} />
                  <div className="lock-text">
                    {v.locked ? (
                      <b className="good">Body locked ✓</b>
                    ) : (
                      <>
                        <b>{v.issue || 'Hold still…'}</b>
                        <span>
                          Upper body seen: {v.parts}/7 · game starts only at 100%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="kb-stage">
                <Wheel angle={v.angle} held halt={v.halt} size={220} />
              </div>
            )}
          </div>

          <ol className="steps">
            {camera && (
              <li className={v.locked ? 'done' : 'active'}>
                <span className="dot">{v.locked ? '✓' : '1'}</span>
                <div>
                  <b>100% body lock</b>
                  <p>Sar, dono kandhe aur dono haath camera mein saaf nazar aayein. Beech mein baithein, 1 se 1.5 meter door.</p>
                  {!v.locked && (
                    <div className="mini-bar">
                      <i style={{ width: `${v.lock * 100}%` }} />
                    </div>
                  )}
                </div>
              </li>
            )}
            {steps.map((s, i) => {
              const state = i < v.idx ? 'done' : i === v.idx && !waitingLock ? 'active' : 'todo';
              return (
                <li key={s.id} className={state}>
                  <span className="dot">{state === 'done' ? '✓' : i + (camera ? 2 : 1)}</span>
                  <div>
                    <b>
                      {s.title}
                      {s.keys && s.keys.map((k) => <kbd key={k}>{k}</kbd>)}
                    </b>
                    <p>{s.ur}</p>
                    {state === 'active' && (
                      <div className="mini-bar">
                        <i style={{ width: `${v.prog * 100}%` }} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {camera && (
            <div className="live-wheel">
              <Wheel angle={v.angle} held={v.held} halt={v.halt} size={150} />
              <div className="live-state">
                {v.halt ? (
                  <b className="bad">✋ Brake</b>
                ) : v.held ? (
                  <b className="good">Wheel held</b>
                ) : (
                  <b className="muted">Hands off the wheel</b>
                )}
                {v.held && !v.halt && (
                  <span>
                    {Math.abs(v.angle) < 0.12 ? 'Straight' : v.angle < 0 ? '◀ Turning left' : 'Turning right ▶'} ·{' '}
                    {v.lift > 0.72 ? 'Fast' : v.lift < 0.3 ? 'Slow' : 'Normal speed'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
