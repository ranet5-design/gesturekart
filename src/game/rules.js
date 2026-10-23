// The traffic rule behind every mistake, shown as a card (and in the replay) so players learn *why*.
export const RULES = {
  redLight: {
    title: 'Red means stop',
    en: 'Stop behind the white line on red and wait for green, even if the road looks empty.',
    ur: 'Laal batti par safed line se pehle rukein aur hari batti ka intezaar karein.',
  },
  pedestrian: {
    title: 'Pedestrians first',
    en: 'People on a zebra crossing always have the right of way. Stop well before it.',
    ur: 'Zebra crossing par paidal chalne walon ka haq pehle hai. Pehle hi ruk jayein.',
  },
  crash: {
    title: 'Keep a safe gap',
    en: 'Stay at least two seconds behind the vehicle ahead. Rickshaws and buses stop suddenly.',
    ur: 'Aage wali gaari se kam az kam 2 second ka fasla rakhein.',
  },
  overspeed: {
    title: 'Respect the speed limit',
    en: 'Speed limits protect people. Near schools and hospitals they are much lower.',
    ur: 'Speed ki hadd ka khayal rakhein. School aur hospital ke paas speed kam karein.',
  },
  tailgate: {
    title: 'Too close',
    en: 'Tailgating leaves you no time to brake. Ease off until the gap grows.',
    ur: 'Itna qareeb na chalein. Fasla barhayein.',
  },
  straddle: {
    title: 'Drive inside your lane',
    en: 'Sitting across two lanes blocks other drivers and causes crashes.',
    ur: 'Do lanes ke beech mein na chalein. Apni lane mein rahein.',
  },
  unsafeLane: {
    title: 'Change lanes safely',
    en: 'Check for space, never cut in close, never weave, and never change lanes at a crossing.',
    ur: 'Lane badalne se pehle jagah dekhein. Crossing par lane na badlein.',
  },
  noIndicator: {
    title: 'Use your indicator',
    en: 'Signal before every lane change so others know what you are about to do.',
    ur: 'Lane badalne se pehle indicator dein, taa ke doosron ko pata chale.',
  },
  noYield: {
    title: 'Make way for emergencies',
    en: 'When you hear a siren, move out of the lane and let the ambulance pass.',
    ur: 'Ambulance ki awaaz sun kar rasta dein. Kisi ki jaan bach sakti hai.',
  },
  focus: {
    title: 'Eyes on the road',
    en: 'Drowsy or distracted driving is as dangerous as drunk driving. Rest when you are tired, and never use your phone.',
    ur: 'Neend mein ya phone dekhte hue gaari na chalayein. Thak jayein to aaraam karein.',
  },
  wrongWay: {
    title: 'Expect the unexpected',
    en: 'Wrong-way bikers are common on Lahore roads. Scan far ahead and leave room to react.',
    ur: 'Ulti taraf se aane walon ka khayal rakhein. Door tak dekhte rahein.',
  },
};

/** Six skills, 0–100 each (null if the drive never tested that skill). */
export function computeSkills(r) {
  const c = r.counts;
  const n = (k) => c[k] || 0;
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  return {
    signals: r.redsFaced || n('redLight') ? clamp(100 - 45 * n('redLight') + 5 * n('goodStop')) : null,
    lanes: clamp(100 - 15 * n('straddle') - 12 * n('unsafeLane') - 10 * n('noIndicator') + 3 * n('cleanLane')),
    speed: clamp(100 - 20 * n('overspeed')),
    distance: clamp(100 - 30 * n('crash') - 15 * n('tailgate') - 15 * n('noYield')),
    people: clamp(100 - 60 * n('pedestrian')),
    focus: r.attention == null ? null : clamp(r.attention - 8 * n('focus')),
  };
}

export const SKILL_NAMES = {
  signals: 'Signals',
  lanes: 'Lanes',
  speed: 'Speed',
  distance: 'Distance',
  people: 'Pedestrians',
  focus: 'Focus',
};
