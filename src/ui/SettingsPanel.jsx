import { useEffect, useState } from 'react';
import { settings, setSetting, onSettings } from '../game/settings.js';
import { urduSupport } from '../audio/voice.js';

const SPEED = [
  ['auto', 'Auto speed (easiest)', 'The car keeps a safe speed. Lower the wheel to slow down, right hand up to stop.'],
  ['lift', 'Wheel height', 'Lift the wheel toward your shoulders to go faster, lower it to slow down.'],
  ['distance', 'Hand distance (brief)', 'Hands wide apart = faster, close together = slower.'],
  ['lean', 'Lean forward / back', 'Lean toward the camera to speed up, sit back to slow down.'],
];

function Toggle({ k, label, hint }) {
  const [v, setV] = useState(settings[k]);
  return (
    <label className="set-row">
      <span>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={v}
        onChange={(e) => {
          setSetting(k, e.target.checked);
          setV(e.target.checked);
        }}
      />
    </label>
  );
}

export default function SettingsPanel({ onClose }) {
  const [, force] = useState(0);
  useEffect(() => onSettings(() => force((n) => n + 1)), []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="screen center dim" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="panel settings">
        <header>
          <h2>⚙ Settings</h2>
          <button className="ghost" onClick={onClose}>
            Done
          </button>
        </header>

        <section>
          <h3>Voice coach language</h3>
          <div className="seg">
            {[
              ['en', 'English'],
              ['ur', 'اردو Urdu'],
            ].map(([id, name]) => (
              <button key={id} className={settings.lang === id ? 'on' : ''} onClick={() => setSetting('lang', id)}>
                {name}
              </button>
            ))}
          </div>
          <small className="muted">
            {settings.lang === 'ur'
              ? {
                  ur: '✓ An Urdu voice was found on this computer.',
                  hi: '✓ Using a Hindi voice (same spoken language). For a true Urdu voice, open the game in Microsoft Edge.',
                  captions: 'No Urdu/Hindi voice found: you will see Roman Urdu captions with an English voice. Microsoft Edge has natural Urdu voices.',
                }[urduSupport()]
              : 'Urdu needs an Urdu or Hindi voice on your computer. Microsoft Edge has natural Urdu voices built in.'}
          </small>
        </section>

        <section>
          <h3>Speed control (webcam)</h3>
          <div className="speed-modes">
            {SPEED.map(([id, name, hint]) => (
              <label key={id} className={settings.speedMode === id ? 'on' : ''}>
                <input type="radio" name="speedMode" checked={settings.speedMode === id} onChange={() => setSetting('speedMode', id)} />
                <b>{name}</b>
                <small>{hint}</small>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3>Comfort &amp; accessibility</h3>
          <Toggle k="armRest" label="Arm rest" hint="Lower your hands for a moment and the car keeps its speed for ~6 s." />
          <Toggle k="oneHand" label="One-hand mode" hint="Steer by moving one hand left/right; that hand up = brake." />
          <Toggle k="colorblind" label="Colour-blind signals" hint="Show STOP / WAIT / GO words on every traffic light." />
          <div className="set-row">
            <span>
              <b>Focus alert flash</b>
              <small>Soft white pulse when you lose focus. "Off" uses a border glow instead (safer for photosensitive players).</small>
            </span>
            <div className="seg small">
              {['soft', 'off'].map((id) => (
                <button key={id} className={settings.flash === id ? 'on' : ''} onClick={() => setSetting('flash', id)}>
                  {id === 'soft' ? 'Soft pulse' : 'Off'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h3>Game</h3>
          <Toggle k="privacy" label="Privacy mode (hide my camera image)" hint="Shows only a stick figure, never your face. Good for recording a demo video. Tracking still works the same." />
          <Toggle k="focusCheck" label="Focus & drowsiness check" hint="Uses your face to spot closed eyes, yawning or looking at a phone." />
          <Toggle k="replays" label="Mistake replays" hint="Slow-motion replay after a red light, crash or pedestrian hit." />
          <Toggle k="music" label="Background music" />
        </section>
      </div>
    </div>
  );
}
