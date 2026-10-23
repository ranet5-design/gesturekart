import { useState } from 'react';

const GESTURES = [
  { icon: '↔', title: 'Lean to steer', text: 'Tilt your upper body left or right to change lanes.' },
  { icon: '✋', title: 'Right hand up = STOP', text: 'Raise your right hand above your head at red lights.' },
  { icon: '🫲🫱', title: 'Hands apart = speed', text: 'Hold an invisible wheel. Wider grip goes faster.' },
];

const RULES = [
  ['Run a red light', '−25'],
  ['Hit a pedestrian', '−30'],
  ['Collision', '−20'],
  ['Over 60 km/h', '−5'],
  ['Stop at red, wait for green', '+8'],
  ['Clean lane change', '+4'],
];

export default function StartScreen({ onStart, error, defaultName }) {
  const [name, setName] = useState(defaultName || '');
  return (
    <div className="screen start">
      <div className="start-card">
        <div className="brand">
          <span className="lights" aria-hidden="true">
            <i className="r" />
            <i className="y" />
            <i className="g" />
          </span>
          <div>
            <h1>GestureKart</h1>
            <p className="tag">Drive Lahore's Canal Road with your body. Learn the rules, earn your Civic Driving Score.</p>
          </div>
        </div>

        <div className="gestures">
          {GESTURES.map((g) => (
            <div key={g.title} className="gesture">
              <div className="g-icon">{g.icon}</div>
              <div>
                <b>{g.title}</b>
                <p>{g.text}</p>
              </div>
            </div>
          ))}
        </div>

        <details className="rules">
          <summary>How scoring works</summary>
          <ul>
            {RULES.map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <b className={v.startsWith('+') ? 'good' : 'bad'}>{v}</b>
              </li>
            ))}
          </ul>
          <p>You start at 100. Tailgating, straddling lanes and unsafe lane changes also cost points. Reach Dharampura (1.8 km) to finish.</p>
        </details>

        <form
          className="start-form"
          onSubmit={(e) => {
            e.preventDefault();
            onStart(name, 'camera');
          }}
        >
          <label htmlFor="name">Driver name (printed on your score card)</label>
          <input
            id="name"
            value={name}
            maxLength={24}
            placeholder="e.g. Ayesha"
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <div className="start-buttons">
            <button type="submit" className="primary">
              🎥 Start with webcam
            </button>
            <button type="button" className="secondary" onClick={() => onStart(name, 'keyboard')}>
              ⌨ Play with keyboard
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          <p className="hint">
            Stand or sit about 1.5 m from the camera with your upper body and hands in view. Good light helps. Your video
            never leaves your device.
          </p>
        </form>
      </div>
    </div>
  );
}
