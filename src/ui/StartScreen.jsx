import { useState } from 'react';
import { Wheel } from './Widgets.jsx';
import { VIEWS } from '../game/state.js';
import { CARS, POINTS, SPEED_LIMIT_KMH } from '../game/config.js';
import { loadHistory, sameName, statsFor, bestPerPlayer, fmtDate } from '../game/history.js';

// This is a demo build: only the published test CNIC is accepted, and it is never stored in full.
export const DEMO_CNIC = '123456789';
const STEPS = ['Driver', 'Car', 'View', 'Learn & start'];

/* ---------- small illustrations ---------- */

function ViewIcon({ id }) {
  if (id === 'cockpit')
    return (
      <svg viewBox="0 0 64 40" aria-hidden="true">
        <path d="M0 40 L26 8 L38 8 L64 40 Z" className="vi-road" />
        <circle cx="32" cy="34" r="11" className="vi-wheel" />
        <circle cx="32" cy="34" r="3" className="vi-hub" />
      </svg>
    );
  if (id === 'chase')
    return (
      <svg viewBox="0 0 64 40" aria-hidden="true">
        <path d="M4 40 L27 6 L37 6 L60 40 Z" className="vi-road" />
        <rect x="24" y="22" width="16" height="11" rx="3" className="vi-car" />
      </svg>
    );
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true">
      <path d="M12 40 L28 2 L36 2 L52 40 Z" className="vi-road" />
      <rect x="28" y="28" width="8" height="7" rx="2" className="vi-car" />
      <rect x="30" y="12" width="5" height="4" rx="1" className="vi-car other" />
      <rect x="42" y="6" width="3" height="7" className="vi-sig" />
    </svg>
  );
}

// Side-view silhouettes of the five cars
function CarArt({ id, color }) {
  const wheel = (cx, r = 7) => <circle cx={cx} cy={44 - r} r={r} className="ca-wheel" />;
  const shapes = {
    kart: (
      <>
        <path d="M10 34 L22 30 L62 30 L76 26 L90 30 L92 36 L10 38 Z" fill={color} />
        <circle cx="52" cy="22" r="7" fill="#f1faee" />
        <rect x="80" y="18" width="12" height="3" fill="#222" />
        {wheel(24, 8)}
        {wheel(78, 9)}
      </>
    ),
    hatch: (
      <>
        <path d="M10 36 L12 26 L30 24 L40 12 L74 12 L86 24 L92 26 L92 36 Z" fill={color} stroke="#94a3b8" />
        <path d="M43 15 L56 15 L56 24 L35 24 Z M59 15 L72 15 L80 24 L59 24 Z" className="ca-glass" />
        {wheel(28)}
        {wheel(76)}
      </>
    ),
    sedan: (
      <>
        <path d="M6 36 L8 27 L28 24 L40 14 L68 14 L80 24 L96 27 L96 36 Z" fill={color} />
        <path d="M43 17 L54 17 L54 24 L35 24 Z M57 17 L67 17 L76 24 L57 24 Z" className="ca-glass" />
        {wheel(26)}
        {wheel(80)}
      </>
    ),
    rickshaw: (
      <>
        <path d="M18 36 L18 22 L28 14 L84 14 L84 36 Z" fill={color} />
        <rect x="18" y="8" width="70" height="6" rx="2" fill="#111" />
        <rect x="18" y="26" width="66" height="4" fill="#ffd166" />
        {wheel(30, 7)}
        {wheel(74, 7)}
      </>
    ),
    pickup: (
      <>
        <path d="M6 36 L8 24 L24 22 L32 10 L56 10 L58 22 L96 22 L96 36 Z" fill={color} />
        <path d="M35 13 L54 13 L54 21 L29 21 Z" className="ca-glass" />
        <rect x="64" y="16" width="16" height="6" fill="#a98467" />
        {wheel(24, 8)}
        {wheel(80, 8)}
      </>
    ),
  };
  return (
    <svg viewBox="0 0 100 46" className="car-art" aria-hidden="true">
      <rect x="0" y="43" width="100" height="3" className="ca-ground" />
      {shapes[id]}
    </svg>
  );
}

function Stat({ label, value }) {
  return (
    <div className="cstat">
      <span>{label}</span>
      <i>
        <b style={{ width: `${Math.round(value * 100)}%` }} />
      </i>
    </div>
  );
}

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

const HOW = [
  { art: 'turn', title: 'Turn the wheel', text: 'Hold both hands in front of your chest like a steering wheel. Turn it, and the car goes that way.', ur: 'Steering ghumayein, gaari usi taraf jayegi' },
  { art: 'lift', title: 'Lift = faster', text: 'Raise the wheel toward your shoulders to speed up, lower it to slow down. Let go to roll to a stop.', ur: 'Wheel upar = tez, neeche = aahista' },
  { art: 'brake', title: 'Right hand up = brake', text: 'At a red light, raise your right hand above your head. Wait for green, then hold the wheel again.', ur: 'Laal batti par right haath upar' },
];

const LOSE = [
  ['🚶', 'Hit a pedestrian on the zebra', POINTS.pedestrian],
  ['🚦', 'Run a red light', POINTS.redLight],
  ['💥', 'Crash into a vehicle', POINTS.crash],
  ['⚡', `Drive over ${SPEED_LIMIT_KMH} km/h for 2+ seconds`, POINTS.overspeed],
  ['↔', 'Cut in close, weave, or change lanes at a crossing', POINTS.unsafeLane],
  ['🚗', 'Tailgate (too close to the car ahead)', POINTS.tailgate],
  ['〰', 'Sit between two lanes for 2+ seconds', POINTS.straddle],
];
const EARN = [
  ['✋', 'Stop before the line at red and wait for green', POINTS.goodStop],
  ['✓', 'Clean lane change (smooth, with space)', POINTS.cleanLane],
];
const GRADES = [
  ['A+', 95, 'Model Citizen'],
  ['A', 85, 'Responsible'],
  ['B', 70, 'Mostly Civic'],
  ['C', 55, 'Needs Practice'],
  ['D', 40, 'Risky'],
  ['F', 0, 'Suspended'],
];

/* ---------- the wizard ---------- */

export default function StartScreen({ onStart, error, profile: saved, view, onView, car, onCar, onHistory, initialStep = 0 }) {
  const [step, setStep] = useState(initialStep);
  const [name, setName] = useState(saved?.name || '');
  const [age, setAge] = useState(saved?.age ? String(saved.age) : '');
  const [cnic, setCnic] = useState(saved?.cnicOk ? DEMO_CNIC : '');
  const [touched, setTouched] = useState(false);
  const [learnTab, setLearnTab] = useState('drive');

  const all = loadHistory();
  const mine = name.trim() ? all.filter((e) => sameName(e.player, name)) : [];
  const myStats = statsFor(mine);
  const boardPos = myStats ? bestPerPlayer(all).findIndex((e) => sameName(e.player, name)) + 1 : 0;

  const ageNum = Number(age);
  const errors = {
    name: name.trim().length < 2 ? 'Enter your name (at least 2 letters).' : '',
    age: !/^\d{1,3}$/.test(age) || ageNum < 8 || ageNum > 100 ? 'Enter an age between 8 and 100.' : '',
    cnic: cnic !== DEMO_CNIC ? `This demo only accepts the test CNIC ${DEMO_CNIC}.` : '',
  };
  const driverOk = !errors.name && !errors.age && !errors.cnic;
  const profile = { name: name.trim(), age: ageNum, cnicMasked: `•••••${cnic.slice(-4)}`, cnicOk: !errors.cnic };
  const carObj = CARS.find((c) => c.id === car) || CARS[0];

  const next = () => {
    if (step === 0 && !driverOk) {
      setTouched(true);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  return (
    <div className="screen start">
      <div className="wizard">
        <header className="wiz-head">
          <div className="brand">
            <span className="lights" aria-hidden="true">
              <i className="r" />
              <i className="y" />
              <i className="g" />
            </span>
            <div>
              <h1>GestureKart</h1>
              <p className="tag">Drive Lahore's Canal Road with an invisible steering wheel.</p>
            </div>
          </div>
          <button type="button" className="secondary" onClick={() => onHistory(name)}>
            🏆 History &amp; leaderboard{all.length ? ` (${all.length})` : ''}
          </button>
        </header>

        <ol className="stepper" aria-label="Setup steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
              <button
                type="button"
                disabled={i > step && !(i > 0 && driverOk)}
                onClick={() => (i <= step || driverOk ? setStep(i) : null)}
              >
                <span>{i < step ? '✓' : i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>

        <section className="wiz-body panel">
          {step === 0 && (
            <form
              className="driver-form"
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
              noValidate
            >
              <h2>Who's driving?</h2>
              <p className="sub">Your details are printed on your Civic Driving Score Card.</p>
              <div className="fields">
                <label className={touched && errors.name ? 'invalid' : ''}>
                  <span>Full name</span>
                  <input value={name} maxLength={24} placeholder="e.g. Ayesha Khan" onChange={(e) => setName(e.target.value)} autoComplete="off" spellCheck={false} />
                  {touched && errors.name && <small>{errors.name}</small>}
                </label>
                <label className={touched && errors.age ? 'invalid' : ''}>
                  <span>Age</span>
                  <input value={age} inputMode="numeric" maxLength={3} placeholder="e.g. 19" onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} autoComplete="off" />
                  {touched && errors.age && <small>{errors.age}</small>}
                </label>
                <label className={`wide ${touched && errors.cnic ? 'invalid' : ''}`}>
                  <span>CNIC number</span>
                  <input value={cnic} inputMode="numeric" maxLength={13} placeholder={DEMO_CNIC} onChange={(e) => setCnic(e.target.value.replace(/\D/g, ''))} autoComplete="off" />
                  <em className="demo-note">
                    Demo version: enter <b>{DEMO_CNIC}</b>. Only the last 4 digits are shown on your score card.
                  </em>
                  {touched && errors.cnic && <small>{errors.cnic}</small>}
                </label>
              </div>
              {ageNum > 0 && ageNum < 18 && !errors.age && (
                <p className="note">Under 18: you can practise here, but you need to be 18 to get a real driving licence in Pakistan.</p>
              )}
              {myStats && (
                <div className="me-strip">
                  <span>
                    Welcome back! Best score <b>{myStats.best}</b> · {myStats.drives} drive{myStats.drives > 1 ? 's' : ''} · #{boardPos} on the leaderboard
                  </span>
                  <span className="muted">Last played {fmtDate(myStats.last)}</span>
                </div>
              )}
              <button type="submit" hidden />
            </form>
          )}

          {step === 1 && (
            <div>
              <h2>Choose your car</h2>
              <p className="sub">Every car handles differently. The traffic rules are the same for all of them.</p>
              <div className="car-grid" role="radiogroup" aria-label="Car">
                {CARS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={car === c.id}
                    className={`car-card ${car === c.id ? 'on' : ''}`}
                    onClick={() => onCar(c.id)}
                  >
                    <CarArt id={c.id} color={c.color} />
                    <b>{c.name}</b>
                    <small className="ur">{c.ur}</small>
                    <Stat label="Top speed" value={c.top / 95} />
                    <Stat label="Pickup" value={c.accel / 6.5} />
                    <Stat label="Brakes" value={c.brake / 12} />
                    <Stat label="Turning" value={c.steer / 1.25} />
                    <p>{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2>How do you want to see the road?</h2>
              <p className="sub">You can switch any time during the drive with the C key.</p>
              <div className="view-grid" role="radiogroup" aria-label="Camera view">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={view === v.id}
                    className={`view-card ${view === v.id ? 'on' : ''}`}
                    onClick={() => onView(v.id)}
                  >
                    <ViewIcon id={v.id} />
                    <b>{v.name}</b>
                    <small className="ur">{v.ur}</small>
                    <p>{v.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="tabs" role="tablist">
                <button role="tab" aria-selected={learnTab === 'drive'} className={learnTab === 'drive' ? 'on' : ''} onClick={() => setLearnTab('drive')}>
                  🎮 How to drive
                </button>
                <button role="tab" aria-selected={learnTab === 'score'} className={learnTab === 'score' ? 'on' : ''} onClick={() => setLearnTab('score')}>
                  🏁 How scoring works
                </button>
              </div>

              {learnTab === 'drive' ? (
                <>
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
                  <ul className="setup">
                    <li><b>1–1.5 m</b> from the laptop, sitting or standing</li>
                    <li><b>Head, shoulders &amp; both hands</b> in the camera; the drive starts only at <b>100% body lock</b></li>
                    <li><b>Good light</b> in front of you, not behind</li>
                  </ul>
                </>
              ) : (
                <div className="scoring">
                  <div className="score-start">
                    <div className="big100">100</div>
                    <p>
                      You start with <b>100 points</b>. Mistakes take points away, good habits win some back (up to 100). Reach
                      <b> Dharampura (1.8 km)</b> to finish. At <b>0</b> your licence is suspended and the drive ends.
                    </p>
                  </div>
                  <div className="score-cols">
                    <div>
                      <h3 className="bad">Lose points</h3>
                      <ul className="pts">
                        {LOSE.map(([icon, text, pts]) => (
                          <li key={text}>
                            <span className="ic">{icon}</span>
                            <span>{text}</span>
                            <b className="bad">{pts}</b>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="good">Earn points</h3>
                      <ul className="pts">
                        {EARN.map(([icon, text, pts]) => (
                          <li key={text}>
                            <span className="ic">{icon}</span>
                            <span>{text}</span>
                            <b className="good">+{pts}</b>
                          </li>
                        ))}
                      </ul>
                      <h3>Your grade</h3>
                      <div className="grade-ladder">
                        {GRADES.map(([g, min, label]) => (
                          <div key={g} className={`gl g-${g === 'A+' ? 'ap' : g.toLowerCase()}`}>
                            <b>{g}</b>
                            <span>{min ? `${min}+` : '<40'}</span>
                            <small>{label}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="tip">
                    💡 Tip: running a red light while people are on the zebra costs <b>−55</b> at once. When the signal turns
                    yellow, raise your right hand early.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="wiz-foot">
          {step > 0 ? (
            <button type="button" className="ghost" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          <div className="summary">
            {step > 0 && driverOk && (
              <span>
                {profile.name} · {carObj.name} · {VIEWS.find((v) => v.id === view)?.name}
              </span>
            )}
          </div>
          {step < STEPS.length - 1 ? (
            <button type="button" className="primary" onClick={next}>
              Next: {STEPS[step + 1]} →
            </button>
          ) : (
            <div className="go-buttons">
              <button type="button" className="link" onClick={() => onStart(profile, 'keyboard')}>
                No webcam? Use keyboard
              </button>
              <button type="button" className="primary big" onClick={() => onStart(profile, 'camera')}>
                🎥 Start with webcam
              </button>
            </div>
          )}
        </footer>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
