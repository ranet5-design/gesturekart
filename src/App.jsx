import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import World from './game/World.jsx';
import { game, resetGame, setPhase, onPhase, buildReport, endDrive } from './game/state.js';
import { input, initKeyboard, resetInput } from './cv/input.js';
import { pose, startPose, stopPose, beginCalibration, endCalibration } from './cv/pose.js';
import { initAudio, setMuted, beep, go } from './audio/sound.js';
import { say, resetVoice, setVoiceEnabled } from './audio/voice.js';
import StartScreen from './ui/StartScreen.jsx';
import HUD from './ui/HUD.jsx';
import ScoreCard from './ui/ScoreCard.jsx';
import CameraPanel from './ui/CameraPanel.jsx';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const [calibOk, setCalibOk] = useState(false);
  const last = useRef({ name: '', mode: 'camera' });
  const starting = useRef(false);

  useEffect(
    () =>
      onPhase((p) => {
        setPhaseState(p);
        if (p === 'over') setReport(buildReport());
      }),
    [],
  );
  useEffect(() => initKeyboard(), []);

  // Re-render the calibration screen so "Step into the frame" updates live
  const [, setTick] = useState(0);
  useEffect(() => {
    if (phase !== 'calibrate') return;
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [phase]);

  const start = useCallback(async (name, mode) => {
    if (starting.current) return;
    starting.current = true;
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
                ? 'Camera permission was blocked. Allow the camera in your browser, or play with the keyboard.'
                : `Could not start the webcam: ${e?.message || e}. You can play with the keyboard instead.`,
            );
            stopPose();
            setPhase('menu');
            return;
          }
        }
        input.source = 'camera';
        setPhase('calibrate');
        setCalibOk(false);
        say('Face the camera and sit up straight. Calibrating.', { urgent: true });
        // Wait until we can see the player, then sample their neutral posture for 2 seconds.
        const t0 = performance.now();
        while (!input.poseVisible && performance.now() - t0 < 15000) await wait(100);
        beginCalibration();
        await wait(2000);
        endCalibration();
        setCalibOk(true);
        await wait(500);
      } else {
        stopPose();
      }

      setPhase('countdown');
      for (const n of [3, 2, 1]) {
        setCount(n);
        beep();
        await wait(800);
      }
      go();
      setPhase('playing');
      say(
        mode === 'camera'
          ? 'Go! Lean to steer. Spread your hands to speed up. Raise your right hand to stop.'
          : 'Go! Arrow keys to steer and change speed. Space bar to stop.',
        { urgent: true },
      );
    } finally {
      starting.current = false;
    }
  }, []);

  const togglePause = useCallback(() => {
    if (game.phase === 'playing') setPhase('paused');
    else if (game.phase === 'paused') setPhase('playing');
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause, toggleMute]);

  const toMenu = () => {
    stopPose();
    resetGame(last.current.name);
    setRunId(game.runId);
    setReport(null);
    setPhase('menu');
  };

  const inGame = ['countdown', 'playing', 'paused'].includes(phase);

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
        <div className="screen center">
          <div className="panel loading">
            <div className="spinner" />
            <p>{status || 'Starting…'}</p>
          </div>
        </div>
      )}

      {phase === 'calibrate' && (
        <div className="screen center">
          <div className="panel calibrate">
            <CameraPanel big />
            <h2>{calibOk ? 'Calibrated ✓' : input.poseVisible ? 'Hold still: calibrating…' : 'Step into the frame'}</h2>
            <p>Face the camera, sit or stand up straight, and keep your shoulders and hands visible.</p>
          </div>
        </div>
      )}

      {inGame && <HUD onPause={togglePause} paused={phase === 'paused'} muted={muted} onMute={toggleMute} />}

      {phase === 'countdown' && (
        <div className="screen center pointer-none">
          <div key={count} className="countdown">
            {count}
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="screen center">
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
