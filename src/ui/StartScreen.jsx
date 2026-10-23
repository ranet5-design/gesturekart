import { useState } from 'react';
import { Wheel } from './Widgets.jsx';

const HOW = [
  {
    art: 'turn',
    title: 'Turn the wheel',
    text: 'Hold both hands in front of your chest like a steering wheel. Turn it left or right, and the car goes that way.',
    ur: 'Steering ghumayein, gaari usi taraf jayegi',
  },
  {
    art: 'lift',
    title: 'Lift = faster',
    text: 'Raise the wheel toward your shoulders to speed up. Lower it to slow down. Let go and the car rolls to a stop.',
    ur: 'Wheel upar = tez, neeche = aahista',
  },
  {
    art: 'brake',
    title: 'Right hand up = brake',
    text: 'At a red light, raise your right hand above your head. Wait for green, then hold the wheel again.',
    ur: 'Laal batti par right haath upar',
  },
];

const RULES = [
  ['Run a red light', '−25'],
  ['Hit a pedestrian', '−30'],
  ['Crash into a vehicle', '−20'],
  ['Drive over 60 km/h', '−5'],
  ['Stop at red, wait for green', '+8'],
  ['Clean lane change', '+4'],
];

function Art({ kind }) {
  if (kind === 'turn')
    return (
      <div className="art art-turn" aria-hidden="true">
        <Wheel angle={0.5} size={84} />
        <span className="arr l">↺</span>
        <span className="arr r">↻</span>
      </div>
    );
  if (kind === 'lift')
    return (
      <div className="art art-lift" aria-hidden="true">
        <Wheel angle={0} size={70} />
        <span className="arr up">▲</span>
        <span className="arr down">▼</span>
      </div>
    );
  return (
    <div className="art art-brake" aria-hidden="true">
      <span className="hand">✋</span>
      <span className="head" />
      <span className="stop">STOP</span>
    </div>
  );
}

export default function StartScreen({ onStart, error, defaultName }) {
  const [name, setName] = useState(defaultName || '');
  return (
    <div className="screen start">
      <div className="start-wrap">
        <section className="hero">
          <div className="brand">
            <span className="lights" aria-hidden="true">
              <i className="r" />
              <i className="y" />
              <i className="g" />
            </span>
            <div>
              <h1>GestureKart</h1>
              <p className="tag">Drive Lahore's Canal Road with an invisible steering wheel. Obey the signals, earn your Civic Driving Score.</p>
            </div>
          </div>

          <form
            className="start-form panel"
            onSubmit={(e) => {
              e.preventDefault();
              onStart(name, 'camera');
            }}
          >
            <label htmlFor="name">Your name (printed on the score card)</label>
            <input
              id="name"
              value={name}
              maxLength={24}
              placeholder="e.g. Ayesha"
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="primary big">
              🎥 Start with webcam
            </button>
            <button type="button" className="link" onClick={() => onStart(name, 'keyboard')}>
              No webcam? Play with the keyboard →
            </button>
            {error && <p className="error">{error}</p>}
          </form>

          <ul className="setup">
            <li>
              <b>1–1.5 m</b> away from the laptop, sitting or standing
            </li>
            <li>
              <b>Head, shoulders &amp; both hands</b> in the camera
            </li>
            <li>
              <b>Good light</b> in front of you, not behind
            </li>
          </ul>
        </section>

        <section className="how">
          <h2>How to drive</h2>
          <p className="how-sub">The game first locks on to your body (100%), then you practise each move before the drive starts.</p>
          <div className="how-cards">
            {HOW.map((h, i) => (
              <article key={h.title} className="how-card">
                <span className="num">{i + 1}</span>
                <Art kind={h.art} />
                <h3>{h.title}</h3>
                <p>{h.text}</p>
                <p className="ur">{h.ur}</p>
              </article>
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
            <p>
              You start at 100. Tailgating, sitting between lanes and unsafe lane changes also cost points. Reach Dharampura
              (1.8 km) to finish. Your video never leaves your device.
            </p>
          </details>
        </section>
      </div>
    </div>
  );
}
