import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import World from './game/World.jsx';
import { game, resetGame, setPhase, onPhase, buildReport, endDrive } from './game/state.js';
import { input, initKeyboard, resetInput } from './cv/input.js';
import { pose, startPose, stopPose } from './cv/pose.js';
import { initAudio, setMuted, beep, go } from './audio/sound.js';
import { say, resetVoice, setVoiceEnabled } from './audio/voice.js';
import StartScreen from './ui/StartScreen.jsx';
import HUD from './ui/HUD.jsx';
import ScoreCard from './ui/ScoreCard.jsx';
import CameraPanel from './ui/CameraPanel.jsx';
import Practice from './ui/Practice.jsx';
import { LockRing } from './ui/Widgets.jsx';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Flow: menu → (loading webcam) → practice (100% body lock + gesture practice) → countdown → playing → over.
   With the webcam the drive only runs while the body is locked; losing it pauses the game. */
export default function App() {
  const [phase, setPhaseState] = useState(game.phase);
  const [runId, setRunId] = useState(() => {
    resetGame();
    return game.runId;
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);
  const [report, setReport] = useState(null);
  const [muted, setMutedState] = useState(false);
  const [pauseReason, setPauseReason] = useState('user');
  const [practised, setPractised] = useState(false);
  const [lockView, setLockView] = useState({ lock: 0, locked: false, issue: '' });
  const last = useRef({ name: '', mode: 'camera' });
  const busy = useRef(false);

  useEffect(
    () =>
      onPhase((p) => {
        setPhaseState(p);
        if (p === 'over') setReport(buildReport());
      }),
    [],
  );
  useEffect(() => initKeyboard(), []);

  const countdownThenDrive = useCallback(async (resume = false) => {
    setPhase('countdown');
    for (const n of [3, 2, 1]) {
      // Never start (or resume) without a full body lock
      if (input.source === 'camera' && !input.locked) {
        say('Body lock lost. Come back into the frame.', { urgent: true });
        if (resume) {
          setPauseReason('lock');
          setPhase('paused');
        } else setPhase('practice');
        return;
      }
      setCount(n);
      beep();
      await wait(800);
    }
    go();
    setPhase('playing');
    if (!resume) {
      say(
        input.source === 'camera'
          ? 'Go! Turn the wheel to steer, lift it to speed up, raise your right hand to brake.'
          : 'Go! Arrow keys to steer and change speed. Space bar to brake.',
        { urgent: true },
      );
    }
  }, []);

  const start = useCallback(async (name, mode) => {
    if (busy.current) return;
    busy.current = true;
    try {
      last.current = { name, mode };
      initAudio();
      resetVoice();
      setError('');
      setReport(null);
      resetGame(name, mode);
      setRunId(game.runId);
      resetInput(mode);

      if (mode === 'camera') {
        if (!pose.ready) {
          setPhase('loading');
          try {
            await startPose(setStatus);
          } catch (e) {
            const denied = e?.name === 'NotAllowedError';
            setError(
              denied
                ? 'Camera permission was blocked. Allow the camera in your browser (lock icon in the address bar), or play with the keyboard.'
                : `Could not start the webcam: ${e?.message || e}. You can play with the keyboard instead.`,
            );
            stopPose();
            setPhase('menu');
            return;
          }
        }
        input.source = 'camera';
      } else {
        stopPose();
      }
      setPhase('practice');
    } finally {
      busy.current = false;
    }
  }, []);

  // Watch the body lock: pause the drive the moment it is lost, resume once it is back at 100%.
  useEffect(() => {
    if (input.source !== 'camera' || !['playing', 'paused'].includes(phase)) return;
    const id = setInterval(() => {
      setLockView({ lock: input.lock, locked: input.locked, issue: input.lockIssue });
      if (game.phase === 'playing' && !input.locked) {
        setPauseReason('lock');
        setPhase('paused');
        say('Body lock lost. Game paused. Come back into the frame.', { urgent: true });
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'paused' && pauseReason === 'lock' && lockView.locked) {
      say('Locked again. Resuming.', { urgent: true });
      countdownThenDrive(true);
    }
  }, [phase, pauseReason, lockView.locked, countdownThenDrive]);

  const togglePause = useCallback(() => {
    if (game.phase === 'playing') {
      setPauseReason('user');
      setPhase('paused');
    } else if (game.phase === 'paused') {
      if (input.source === 'camera' && !input.locked) return; // must relock first
      countdownThenDrive(true);
    }
  }, [countdownThenDrive]);

  const [view, setView] = useState(game.view);
  const toggleView = useCallback(() => {
    game.view = game.view === 'cockpit' ? 'chase' : 'cockpit';
    setView(game.view);
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      setMuted(!m);
      setVoiceEnabled(m);
      return !m;
    });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'p' || k === 'escape') togglePause();
      if (k === 'm') toggleMute();
      if (k === 'c') toggleView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause, toggleMute, toggleView]);

  const toMenu = () => {
    stopPose();
    resetGame(last.current.name);
    setRunId(game.runId);
    setReport(null);
    setPractised(false);
    setPhase('menu');
  };

  const inGame = ['countdown', 'playing', 'paused'].includes(phase);
  const camera = input.source === 'camera';

  return (
    <div className="app">
      <Canvas
        className="scene"
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 60, position: [0, 4.5, 9.5], near: 0.1, far: 700 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <World runId={runId} />
      </Canvas>

      {phase === 'menu' && <StartScreen onStart={start} error={error} defaultName={last.current.name} />}

      {phase === 'loading' && (
        <div className="screen center dim">
          <div className="panel loading">
            <div className="spinner" />
            <p>{status || 'Starting…'}</p>
            <small>First time can take 10–20 seconds.</small>
          </div>
        </div>
      )}

      {phase === 'practice' && (
        <Practice
          key={game.runId}
          mode={last.current.mode}
          short={practised}
          onDone={() => {
            setPractised(true);
            countdownThenDrive(false);
          }}
          onBack={toMenu}
        />
      )}

      {inGame && (
        <HUD
          onPause={togglePause}
          paused={phase === 'paused'}
          muted={muted}
          onMute={toggleMute}
          view={view}
          onView={toggleView}
        />
      )}

      {phase === 'countdown' && (
        <div className="screen center pointer-none">
          <div key={count} className="countdown">
            {count}
          </div>
        </div>
      )}

      {phase === 'paused' && pauseReason === 'lock' && camera && (
        <div className="screen center dim">
          <div className="panel relock">
            <div className="cam-stage">
              <CameraPanel big />
              <div className="lock-overlay">
                <LockRing value={lockView.lock} locked={lockView.locked} size={96} />
                <div className="lock-text">
                  <b>{lockView.issue || 'Hold still…'}</b>
                  <span>Game resumes by itself at 100% body lock</span>
                </div>
              </div>
            </div>
            <h2>Body lock lost: game paused</h2>
            <p>Sit back in front of the camera with your head, shoulders and both hands visible.</p>
            <button className="secondary" onClick={endDrive}>
              End drive &amp; see score
            </button>
          </div>
        </div>
      )}

      {phase === 'paused' && (pauseReason === 'user' || !camera) && (
        <div className="screen center dim">
          <div className="panel pause">
            <h2>Paused</h2>
            <div className="start-buttons">
              <button className="primary" onClick={togglePause}>
                Resume
              </button>
              <button className="secondary" onClick={endDrive}>
                End drive &amp; see score
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'over' && report && (
        <ScoreCard
          report={report}
          onAgain={() => start(last.current.name, last.current.mode)}
          onMenu={toMenu}
        />
      )}
    </div>
  );
}
