/* Licence levels, Gran-Turismo style: each one teaches one skill, has clear pass rules,
   and 1–3 stars. Clearing all 8 earns the GestureKart driving licence.
   A level config also drives the world: route length, signals, traffic, hazards, weather. */

const CRITICAL = ['redLight', 'pedestrian', 'crash'];
const n = (r, k) => r.counts[k] || 0;

const finish = { id: 'finish', text: 'Reach the finish line', test: (r) => r.reason === 'finish' };
const noCrash = { id: 'crash', text: 'No collisions', test: (r) => n(r, 'crash') === 0, have: (r) => `${n(r, 'crash')} crash(es)` };

export const LEVELS = [
  {
    id: 1,
    name: 'Learner Permit',
    ur: 'Seekhne ka permit',
    goal: 'Get the feel of the wheel on a quiet road. Stay inside your lane.',
    route: { name: 'Canal Road', from: 'Thokar', to: 'Jail Road' },
    length: 600,
    env: { time: 'day', weather: 'clear' },
    signals: null,
    traffic: 0,
    zones: [],
    hazards: [],
    indicators: false,
    checks: [
      finish,
      { id: 'lane', text: 'Never sit between two lanes', test: (r) => n(r, 'straddle') === 0, have: (r) => `${n(r, 'straddle')} time(s)` },
      noCrash,
    ],
  },
  {
    id: 2,
    name: 'Signals & Zebra',
    ur: 'Signal aur zebra crossing',
    goal: 'Every signal turns red. Stop before the line and let people cross.',
    route: { name: 'Canal Road', from: 'Jail Road', to: 'Mall Road' },
    length: 900,
    env: { time: 'day', weather: 'clear' },
    signals: { first: 150, gap: [200, 240], p: 1 },
    traffic: 0,
    zones: [],
    hazards: [],
    indicators: false,
    checks: [
      finish,
      { id: 'red', text: 'Run zero red lights', test: (r) => r.redsRun === 0, have: (r) => `${r.redsRun} run` },
      { id: 'ped', text: 'Hit zero pedestrians', test: (r) => n(r, 'pedestrian') === 0, have: (r) => `${n(r, 'pedestrian')} hit` },
      { id: 'stops', text: 'Make at least 2 proper stops', test: (r) => r.properStops >= 2, have: (r) => `${r.properStops} stop(s)` },
    ],
  },
  {
    id: 3,
    name: 'City Traffic',
    ur: 'Shehar ka traffic',
    goal: 'Share the road with rickshaws, buses and a slow donkey cart. Keep your distance.',
    route: { name: 'Canal Road', from: 'Mall Road', to: 'Dharampura' },
    length: 1000,
    env: { time: 'day', weather: 'clear' },
    signals: { first: 220, gap: [260, 320], p: 0.5 },
    traffic: 6,
    zones: [],
    hazards: [{ type: 'cart', at: 120 }],
    indicators: false,
    checks: [
      finish,
      noCrash,
      { id: 'tail', text: 'Tailgate at most once', test: (r) => n(r, 'tailgate') <= 1, have: (r) => `${n(r, 'tailgate')} time(s)` },
      { id: 'red', text: 'Run zero red lights', test: (r) => r.redsRun === 0, have: (r) => `${r.redsRun} run` },
    ],
  },
  {
    id: 4,
    name: 'Speed Zones',
    ur: 'Speed ki hadd',
    goal: 'Watch the signs: 30 km/h at the school, 40 at the hospital, 60 elsewhere.',
    route: { name: 'Jail Road', from: 'Shadman', to: 'Services Hospital' },
    length: 1100,
    env: { time: 'day', weather: 'clear' },
    signals: { first: 560, gap: [300, 360], p: 0.5 },
    traffic: 4,
    zones: [
      { from: 200, to: 420, limit: 30, label: 'SCHOOL ZONE' },
      { from: 720, to: 920, limit: 40, label: 'HOSPITAL ZONE' },
    ],
    hazards: [],
    indicators: false,
    checks: [
      finish,
      { id: 'speed', text: 'Never go over the limit', test: (r) => n(r, 'overspeed') === 0, have: (r) => `${n(r, 'overspeed')} time(s)` },
      noCrash,
    ],
  },
  {
    id: 5,
    name: 'Indicators',
    ur: 'Indicator dena',
    goal: 'Slow carts block the lanes. Signal with your arm before every lane change.',
    route: { name: 'Ferozepur Road', from: 'Ichhra', to: 'Kalma Chowk' },
    length: 1000,
    env: { time: 'day', weather: 'clear' },
    signals: { first: 480, gap: [320, 380], p: 0.4 },
    traffic: 5,
    zones: [],
    hazards: [
      { type: 'cart', at: 60 },
      { type: 'cart', at: 480 },
    ],
    indicators: true,
    checks: [
      finish,
      { id: 'ind', text: 'Use the indicator for every lane change', test: (r) => n(r, 'noIndicator') === 0, have: (r) => `${n(r, 'noIndicator')} without` },
      { id: 'clean', text: 'Make at least 2 clean lane changes', test: (r) => n(r, 'cleanLane') >= 2, have: (r) => `${n(r, 'cleanLane')} clean` },
      noCrash,
    ],
  },
  {
    id: 6,
    name: 'Night & Rain',
    ur: 'Raat aur barish',
    goal: 'Wet roads take longer to stop on, and people are harder to see. Slow down early.',
    route: { name: 'Canal Road', from: 'Thokar', to: 'Mall Road' },
    length: 1200,
    env: { time: 'night', weather: 'rain' },
    signals: { first: 200, gap: [250, 300], p: 0.7 },
    traffic: 5,
    zones: [],
    hazards: [],
    indicators: false,
    checks: [
      finish,
      { id: 'score', text: 'Score 75 or more', test: (r) => r.score >= 75, have: (r) => `scored ${r.score}` },
      { id: 'ped', text: 'Hit zero pedestrians', test: (r) => n(r, 'pedestrian') === 0, have: (r) => `${n(r, 'pedestrian')} hit` },
    ],
  },
  {
    id: 7,
    name: 'Rush Hour',
    ur: 'Rush hour ka imtihaan',
    goal: 'Heavy traffic, an ambulance behind you and a wrong-way biker. Stay calm.',
    route: { name: 'Mall Road', from: 'Charing Cross', to: 'GPO Chowk' },
    length: 1500,
    env: { time: 'day', weather: 'clear' },
    signals: { first: 200, gap: [240, 300], p: 0.75 },
    traffic: 8,
    zones: [{ from: 1000, to: 1180, limit: 30, label: 'SCHOOL ZONE' }],
    hazards: [
      { type: 'cart', at: 100 },
      { type: 'ambulance', at: 380 },
      { type: 'bike', at: 760 },
    ],
    indicators: true,
    checks: [
      finish,
      { id: 'score', text: 'Score 80 or more', test: (r) => r.score >= 80, have: (r) => `scored ${r.score}` },
      { id: 'amb', text: 'Give way to the ambulance', test: (r) => n(r, 'gaveWay') >= 1, have: () => 'not given' },
    ],
  },
  {
    id: 8,
    name: 'Final Driving Test',
    ur: 'Aakhri driving test',
    goal: 'The examiner is watching. One red light, crash or pedestrian hit and you fail.',
    route: { name: 'Canal Road', from: 'Thokar Niaz Baig', to: 'Dharampura' },
    length: 1800,
    env: { time: 'day', weather: 'fog' },
    signals: { first: 170, gap: [230, 300], p: 0.72 },
    traffic: 7,
    zones: [{ from: 620, to: 820, limit: 30, label: 'SCHOOL ZONE' }],
    hazards: [
      { type: 'cart', at: 200 },
      { type: 'ambulance', at: 950 },
      { type: 'bike', at: 1350 },
    ],
    indicators: true,
    examiner: true,
    checks: [
      finish,
      { id: 'critical', text: 'Zero critical errors (red light, crash, pedestrian)', test: (r) => CRITICAL.every((k) => n(r, k) === 0), have: (r) => `${CRITICAL.reduce((a, k) => a + n(r, k), 0)} error(s)` },
      { id: 'score', text: 'Score 85 or more', test: (r) => r.score >= 85, have: (r) => `scored ${r.score}` },
    ],
  },
];

// Free drive = the original full Canal Road with everything switched on
export const FREE_DRIVE = {
  id: 0,
  name: 'Free Drive',
  ur: 'Azaad drive',
  goal: 'The full Canal Road with every rule and hazard. Go for a high score.',
  route: { name: 'Canal Road', from: 'Thokar Niaz Baig', to: 'Dharampura' },
  length: 1800,
  env: { time: 'day', weather: 'clear' },
  signals: { first: 170, gap: [230, 300], p: 0.72 },
  traffic: 6,
  zones: [{ from: 620, to: 820, limit: 30, label: 'SCHOOL ZONE' }],
  hazards: [
    { type: 'cart', at: 300 },
    { type: 'ambulance', at: 900 },
    { type: 'bike', at: 1300 },
  ],
  indicators: true,
  secondChance: true,
  checks: [finish],
};

export const levelById = (id) => (id === 0 ? FREE_DRIVE : LEVELS.find((l) => l.id === id) || FREE_DRIVE);

/** Did the drive pass the level? Returns each check, stars (0–3) and what to improve. */
export function evaluate(level, r) {
  const checks = level.checks.map((c) => ({ id: c.id, text: c.text, ok: !!c.test(r), have: c.have ? c.have(r) : '' }));
  const passed = checks.every((c) => c.ok);
  let stars = 0;
  if (passed) {
    stars = 1;
    if (r.score >= 85) stars = 2;
    if (r.score >= 95 && (r.attention == null || r.attention >= 90)) stars = 3;
  }
  return { levelId: level.id, passed, stars, checks, failed: checks.filter((c) => !c.ok) };
}
