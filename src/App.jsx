import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import World from './game/World.jsx';
import { game, resetGame, setPhase, onPhase, buildReport, endDrive, nextView, setView as setGameView } from './game/state.js';
import { recordDrive, loadHistory, sameName } from './game/history.js';
import { submitOnline } from './game/online.js';
import { recordProgress, getProgress, unlockedUpTo } from './game/progress.js';
import { levelById, evaluate, LEVELS } from './game/levels.js';
import { settings, onSettings } from './game/settings.js';
import { CARS } from './game/config.js';
import History from './ui/History.jsx';
import { input, initKeyboard, resetInput } from './cv/input.js';
import { pose, startPose, stopPose } from './cv/pose.js';
import * as sfx from './audio/sound.js';
import { say, resetVoice, setVoiceEnabled } from './audio/voice.js';
import StartScreen from './ui/StartScreen.jsx';
import HUD from './ui/HUD.jsx';
import ScoreCard from './ui/ScoreCard.jsx';
import CameraPanel from './ui/CameraPanel.jsx';
import Practice from './ui/Practice.jsx';
import SettingsPanel from './ui/SettingsPanel.jsx';
import { LockRing } from './ui/Widgets.jsx';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Remember name, age and car between visits (CNIC is never stored).
const PROFILE_KEY = 'gesturekart.profile';
const CAR_KEY = 'gesturekart.car';
function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    return { name: typeof p.name === 'string' ? p.name : '', age: Number(p.age) || null };
  } catch {
    return { name: '', age: null };
  }
}
function saveProfile(p) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: p.name, age: p.age }));
  } catch {
    /* not remembered */
  }
}
function loadCar() {
  try {
    const id = localStorage.getItem(CAR_KEY);
    return CARS.some((c) => c.id === id) ? id : 'kart';
  } catch {
    return 'kart';
  }
}
function saveCar(id) {
  try {
    localStorage.setItem(CAR_KEY, id);
  } catch {
    /* not remembered */
  }
}

/* Flow: menu (driver → level → car → view → learn) → loading webcam → practice (100% body lock,
   gestures, seatbelt) → countdown → playing → over (score card, XP, level result).
   With the webcam the drive only runs while the body is locked and the driver is focused. */
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
  const [lockView, setLockView] = useState({ lock: 0, locked: false, issue: '', focus: 1 });
  const [showSettings, setShowSettings] = useState(false);
  const last = useRef({ profile: loadProfile(), mode: 'camera' });
  const busy = useRef(false);
  const [car, setCarState] = useState(loadCar);
  const carRef = useRef(car);
  const [levelId, setLevelId] = useState(() => Math.min(unlockedUpTo(getProgress(loadProfile().name)), LEVELS.length));
  const levelRef = useRef(levelId);
  const chooseLevel = useCallback((id) => {
    levelRef.current = id;
    setLevelId(id);
    game.level = levelById(id);
  }, []);
  const chooseCar = useCallback((id) => {
    carRef.current = id;
    setCarState(id);
    saveCar(id);
  }, []);

  useEffect(
    () =>
      onPhase((p) => {
        setPhaseState(p);
        input.focusArmed = p === 'playing';
        if (p === 'over') {
          sfx.rain(false);
          sfx.music(false);
          const r = buildReport();
          // How did this compare with the last time on the same level? (mastery feedback)
          const prev = loadHistory()
            .filter((e) => sameName(e.player, r.player) && (e.levelId ?? 0) === r.levelId)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
          const level = levelById(r.levelId);
          const levelResult = r.levelId > 0 ? evaluate(level, r) : null;
          const progress = recordProgress(r.player, r, levelResult);
          const saved = recordDrive({ ...r, xpEarned: progress.earned });
          setReport({
            ...r,
            historyId: saved.entry.id,
            rank: saved.rank,
            saved: saved.saved && progress.saved,
            levelResult,
            progress,
            prevScore: prev ? prev.score : null,
            online: { pending: true },
          });
          // Send to the shared online leaderboard in the background
          submitOnline(r).then((online) => setReport((cur) => (cur && cur.historyId === saved.entry.id ? { ...cur, online } : cur)));
        }
      }),
    [],
  );
  useEffect(() => initKeyboard(), []);
  useEffect(() => onSettings((k, v) => k === 'music' && game.phase === 'playing' && sfx.music(v)), []);

  // Ambient sound: rain, music and distant city horns while driving
  useEffect(() => {
    if (phase !== 'playing') {
      sfx.rain(false);
      return;
    }
    sfx.rain(game.level.env?.weather === 'rain');
    const id = setInterval(() => Math.random() < 0.35 && sfx.distantHorn(), 4000);
    return () => clearInterval(id);
  }, [phase]);

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
      sfx.beep();
      await wait(800);
    }
    sfx.go();
    setPhase('playing');
    if (!resume) {
      if (settings.music) sfx.music(true);
      const lvl = game.level;
      say(
        lvl.id
          ? `Level ${lvl.id}. ${lvl.name}. ${lvl.goal}`
          : input.source === 'camera'
            ? settings.steerMode === 'lean'
              ? 'Go! Lean to steer, spread your hands to go faster, raise your right hand to stop.'
              : 'Go! Turn the wheel to steer, raise your right hand to brake.'
            : 'Go! Arrow keys to steer and change speed. Space bar to brake.',
        { urgent: true },
      );
      if (lvl.env?.weather === 'rain') setTimeout(() => say('Roads are wet. Brake early.', { key: 'wet' }), 6000);
      if (lvl.env?.time === 'night') setTimeout(() => say('It is night. Watch for pedestrians.', { key: 'night' }), 9000);
      if (lvl.env?.weather === 'fog') setTimeout(() => say('Thick fog. Slow down and look far ahead.', { key: 'fog' }), 6000);
    }
  }, []);

  const start = useCallback(async (profile, mode) => {
    const name = profile.name;
    if (busy.current) return;
    busy.current = true;
    try {
      last.current = { profile, mode };
      saveProfile(profile);
      sfx.initAudio();
      resetVoice();
      setError('');
      setReport(null);
      resetGame(name, mode, levelById(levelRef.current));
      game.car = carRef.current;
      game.profile = { age: profile.age, cnicMasked: profile.cnicMasked };
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

  // Watch body lock and focus: pause the drive the moment either is lost.
  useEffect(() => {
    if (input.source !== 'camera' || !['playing', 'paused'].includes(phase)) return;
    const id = setInterval(() => {
      setLockView({ lock: input.lock, locked: input.locked, issue: input.lockIssue, focus: input.focusMeter });
      if (game.phase !== 'playing') return;
      if (!input.locked) {
        setPauseReason('lock');
        setPhase('paused');
        say('Body lock lost. Game paused. Come back into the frame.', { urgent: true });
      } else if (game.focus.pause) {
        setPauseReason('focus');
        setPhase('paused');
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'paused') return;
    if (pauseReason === 'lock' && lockView.locked) {
      say('Locked again. Resuming.', { urgent: true });
      countdownThenDrive(true);
    } else if (pauseReason === 'focus' && lockView.focus >= 1 && lockView.locked) {
      game.focus.pause = false;
      game.focus.alerts = [];
      game.focus.pulse = 0;
      say('You are fully alert again. Resuming.', { urgent: true });
      countdownThenDrive(true);
    }
  }, [phase, pauseReason, lockView.locked, lockView.focus, countdownThenDrive]);

  const togglePause = useCallback(() => {
    if (game.phase === 'playing') {
      setPauseReason('user');
      setPhase('paused');
    } else if (game.phase === 'paused') {
      if (input.source === 'camera' && (!input.locked || game.focus.pause)) return; // must relock / refocus first
      countdownThenDrive(true);
    }
  }, [countdownThenDrive]);

  const [view, setViewState] = useState(game.view);
  const toggleView = useCallback(() => setViewState(nextView()), []);
  const chooseView = useCallback((id) => {
    setGameView(id);
    setViewState(game.view);
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      sfx.setMuted(!m);
      setVoiceEnabled(m);
      return !m;
    });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'p' || (k === 'escape' && !showSettings)) togglePause();
      if (k === 'm') toggleMute();
      if (k === 'c' && ['countdown', 'playing', 'paused', 'practice'].includes(game.phase)) toggleView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause, toggleMute, toggleView, showSettings]);

  const toMenu = () => {
    stopPose();
    sfx.music(false);
    sfx.siren(false);
    resetGame(last.current.profile.name || 'Driver', 'keyboard', levelById(levelRef.current));
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
        <World runId={runId} car={car} />
      </Canvas>

      {phase === 'menu' && (
        <StartScreen
          onStart={start}
          error={error}
          profile={last.current.profile}
          initialStep={error ? 4 : 0}
          view={view}
          onView={chooseView}
          car={car}
          onCar={chooseCar}
          level={levelId}
          onLevel={chooseLevel}
          onSettings={() => setShowSettings(true)}
          onHistory={(name) => {
            last.current.profile = { ...last.current.profile, name };
            setPhase('history');
          }}
        />
      )}

      {phase === 'history' && (
        <div className="screen over">
          <History player={last.current.profile.name} onClose={() => setPhase('menu')} />
        </div>
      )}

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
          level={game.level}
          onDone={() => {
            setPractised(true);
            game.seatbelt = input.seatbelt;
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
          onSettings={() => setShowSettings(true)}
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

      {phase === 'paused' && pauseReason === 'focus' && camera && (
        <div className="screen center focus-pause">
          {settings.flash === 'soft' ? <div className="white-pulse" aria-hidden="true" /> : <div className="focus-glow" aria-hidden="true" />}
          <div className="panel relock">
            <div className="cam-stage">
              <CameraPanel big />
              <div className="lock-overlay">
                <LockRing value={lockView.focus} locked={lockView.focus >= 1} size={96} label="Focus" />
                <div className="lock-text">
                  <b>{lockView.focus >= 1 ? 'Fully alert ✓' : 'Eyes open, look straight at the road'}</b>
                  <span>Hold it for 3 seconds. The drive resumes at 100% focus.</span>
                </div>
              </div>
            </div>
            <h2>😴 Too many focus warnings</h2>
            <p>
              Drowsy or distracted driving causes serious accidents. Take a deep breath, sit up straight and look at the
              screen. Feeling sleepy? Take a short break.
            </p>
            <p className="ur">Aankhen kholein, seedha road ko dekhein. 100% hone par game khud chalegi.</p>
            <button className="secondary" onClick={endDrive}>
              Take a break: end drive
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
              <button className="secondary" onClick={() => setShowSettings(true)}>
                ⚙ Settings
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
          onAgain={() => start(last.current.profile, last.current.mode)}
          onNext={(id) => {
            chooseLevel(id);
            start(last.current.profile, last.current.mode);
          }}
          onMenu={toMenu}
        />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
