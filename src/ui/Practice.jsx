import { useEffect, useRef, useState } from 'react';
import { input, updateKeyboard, keyDown } from '../cv/input.js';
import { beginCalibration, endCalibration, resetSeatbelt } from '../cv/pose.js';
import { settings, setSetting } from '../game/settings.js';
import { chime } from '../audio/sound.js';
import { say } from '../audio/voice.js';
import CameraPanel from './CameraPanel.jsx';
import { Wheel, LockRing } from './Widgets.jsx';

const CAM_STEPS = [
  // --- Brief controls (default): lean to steer, hand distance = speed ---
  {
    id: 'hold',
    title: 'Sit up straight, both hands up in front of you',
    ur: 'Seedha baithein, dono haath seene ke saamne (peele dabbe mein). Haath camera ki taraf na barhayein.',
    test: () => input.wheelHeld && Math.abs(input.steer) < 0.1,
    need: 1.2,
    steer: ['lean'],
  },
  {
    id: 'left',
    title: 'Lean your body to the LEFT',
    ur: 'Apna jism baayein (left) taraf jhukayein, gaari left jayegi',
    test: () => input.steer < -0.6,
    need: 0.4,
    steer: ['lean'],
  },
  {
    id: 'right',
    title: 'Lean your body to the RIGHT',
    ur: 'Apna jism daayein (right) taraf jhukayein, gaari right jayegi',
    test: () => input.steer > 0.6,
    need: 0.4,
    steer: ['lean'],
  },
  {
    id: 'wide',
    title: 'Hands WIDE apart = faster',
    ur: 'Dono haath door door = tez speed',
    test: () => input.wheelHeld && input.throttle > 0.7,
    need: 0.4,
    speed: ['distance'],
  },
  {
    id: 'close',
    title: 'Hands CLOSE together = slower',
    ur: 'Dono haath qareeb = aahista speed',
    test: () => input.wheelHeld && input.throttle < 0.3,
    need: 0.4,
    speed: ['distance'],
  },
  // --- Optional steering-wheel controls (Settings) ---
  {
    id: 'hold',
    title: 'Hold the wheel straight',
    ur: 'Dono haath seene ke saamne, kohniyan mudi hui (peele dabbe mein). Haath camera ki taraf na barhayein.',
    test: () => input.wheelHeld && Math.abs(input.wheelAngle) < 0.2,
    need: 1.2,
    steer: ['wheel'],
  },
  {
    id: 'left',
    title: 'Turn the wheel left',
    ur: 'Steering ko baayein (left) ghumayein: left haath neeche, right haath upar',
    test: () => input.wheelHeld && input.steer < -0.6,
    need: 0.4,
    steer: ['wheel'],
  },
  {
    id: 'right',
    title: 'Turn the wheel right',
    ur: 'Steering ko daayein (right) ghumayein: right haath neeche, left haath upar',
    test: () => input.wheelHeld && input.steer > 0.6,
    need: 0.4,
    steer: ['wheel'],
  },
  {
    id: 'lift',
    title: 'Lower the wheel to slow down',
    ur: 'Wheel neeche (pait ki taraf) = aahista',
    test: () => input.wheelHeld && input.wheelLift < 0.3,
    need: 0.4,
    speed: ['auto'],
    steer: ['wheel'],
  },
  {
    id: 'lift-up',
    title: 'Lift the wheel up to go faster',
    ur: 'Wheel upar = tez, neeche = aahista',
    test: () => input.wheelHeld && input.wheelLift > 0.72,
    need: 0.4,
    speed: ['lift'],
  },
  {
    id: 'brake',
    title: 'Raise your right hand to brake',
    ur: 'Right haath sar se upar = gaari rukegi',
    test: () => input.halt,
    need: 0.5,
  },
];

const CAM_INDICATORS = [
  {
    id: 'ind-left',
    title: 'Left indicator: left arm straight out',
    ur: 'Baayan baazu side mein seedha bahar',
    test: () => lastIndicator === 'left',
    need: 0.01,
  },
  {
    id: 'ind-right',
    title: 'Right indicator: right arm straight out',
    ur: 'Daayan baazu side mein seedha bahar',
    test: () => lastIndicator === 'right',
    need: 0.01,
  },
];
const CAM_BELT = {
  id: 'belt',
  title: 'Fasten your seatbelt',
  ur: 'Daayan haath baayen kandhe par, phir neeche daayen kulhe tak kheenchein',
  test: () => input.seatbelt,
  need: 0.01,
};

const KEY_STEPS = [
  { id: 'belt', title: 'Fasten your seatbelt', ur: 'B dabaayein', keys: ['B'], test: () => input.seatbelt, need: 0.01 },
  { id: 'left', title: 'Steer left', ur: '← arrow dabaayein', keys: ['←'], test: () => keyDown('arrowleft') || keyDown('a'), need: 0.3 },
  { id: 'right', title: 'Steer right', ur: '→ arrow dabaayein', keys: ['→'], test: () => keyDown('arrowright') || keyDown('d'), need: 0.3 },
  { id: 'lift', title: 'Speed up', ur: '↑ arrow dabaayein (↓ se aahista)', keys: ['↑'], test: () => keyDown('arrowup') || keyDown('w'), need: 0.3 },
  { id: 'brake', title: 'Brake', ur: 'Space bar dabaayein', keys: ['Space'], test: () => keyDown(' '), need: 0.3 },
];
const KEY_INDICATORS = [
  { id: 'ind-left', title: 'Left indicator', ur: 'Q dabaayein', keys: ['Q'], test: () => lastIndicator === 'left', need: 0.01 },
  { id: 'ind-right', title: 'Right indicator', ur: 'E dabaayein', keys: ['E'], test: () => lastIndicator === 'right', need: 0.01 },
];

// The indicator is a one-shot signal; remember the last one seen during practice
let lastIndicator = null;

function buildSteps(camera, short, level) {
  if (!camera) return [...KEY_STEPS, ...(level?.indicators ? KEY_INDICATORS : [])];
  const steerOk = (s) => !s.steer || s.steer.includes(settings.oneHand ? 'wheel' : settings.steerMode);
  const speedOk = (s) => !s.speed || s.speed.includes(settings.speedMode);
  const fitting = CAM_STEPS.filter((s) => steerOk(s) && speedOk(s));
  if (short) return [fitting[0], CAM_BELT];
  return [...fitting, ...(level?.indicators ? CAM_INDICATORS : []), CAM_BELT];
}

/**
 * Guided practice before every drive. With the webcam, nothing can start until the body lock is at 100%.
 * `short` skips straight to "hold the wheel" + seatbelt for players who already practised this session.
 */
export default function Practice({ mode, short = false, level, onDone, onBack }) {
  const camera = mode === 'camera';
  const [privacy, setPrivacy] = useState(settings.privacy);
  const [steps] = useState(() => {
    lastIndicator = null;
    input.seatbelt = false;
    resetSeatbelt();
    return buildSteps(camera, short, level);
  });
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
      if (input.indicator) {
        lastIndicator = input.indicator;
        input.indicator = null;
      }
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
          tooClose: input.handsTooClose,
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
            {camera && (
              <button
                className={privacy ? 'secondary on' : 'secondary'}
                aria-pressed={privacy}
                onClick={() => {
                  setSetting('privacy', !privacy);
                  setPrivacy(!privacy);
                }}
              >
                {privacy ? '🙈 Face hidden' : '🙈 Hide my face'}
              </button>
            )}
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
                      v.tooClose ? (
                        <>
                          <b className="warn">Hands too close to the camera</b>
                          <span>Bring your hands back to your chest, elbows bent. Haath seene ke paas rakhein.</span>
                        </>
                      ) : (
                        <b className="good">Body locked ✓</b>
                      )
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
