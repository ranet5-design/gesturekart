// World units are metres. The road runs along -z; "s" is distance travelled along the road.
export const LANE_W = 3.5;
export const LANES = [-LANE_W, 0, LANE_W]; // left, middle, right lane centres (x)
export const ROAD_HALF = LANE_W * 1.5; // 5.25 m from centre to road edge
export const CAR_LEN = 4;
export const CAR_W = 1.8;

export const SPEED_LIMIT_KMH = 60;
export const MAX_SPEED = 80 / 3.6; // full throttle, m/s
export const CRUISE_THROTTLE = 0.55; // used when hands are not visible

export const ROUTE_LENGTH = 1800; // metres from Thokar Niaz Baig to the finish arch
export const ROUTE_NAME = 'Canal Road, Lahore';

// Scoring. The Civic Score starts at 100; penalties drop it, good habits win some back (capped at 100).
export const POINTS = {
  redLight: -25,
  pedestrian: -30,
  crash: -20,
  overspeed: -5,
  straddle: -3,
  unsafeLane: -4,
  tailgate: -3,
  goodStop: 8,
  cleanLane: 4,
};

export const NPC_TYPES = {
  car: { len: 4.2, w: 1.8 },
  rickshaw: { len: 2.8, w: 1.4 },
  bus: { len: 9, w: 2.5 },
};
