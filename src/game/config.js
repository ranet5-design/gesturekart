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

/* The five cars a player can pick. Handling numbers:
   top   top speed (km/h)          accel  m/s² when speeding up
   brake m/s² when braking         steer  how quickly it moves sideways (1 = normal) */
export const CARS = [
  {
    id: 'kart', name: 'GK Kart', ur: 'Halki aur tez', color: '#e63946',
    desc: 'Balanced racing kart. A good first choice.',
    top: 80, accel: 5, brake: 11, steer: 1.0,
  },
  {
    id: 'hatch', name: 'City Hatch', ur: 'Chhoti family gaari', color: '#f1faee',
    desc: 'Small and easy to stop. Slow to speed up.',
    top: 70, accel: 3.8, brake: 12, steer: 1.05,
  },
  {
    id: 'sedan', name: 'Sedan', ur: 'Tez aur aaraamdeh', color: '#1d4ed8',
    desc: 'Fast and smooth. Easy to go over the speed limit!',
    top: 95, accel: 6.5, brake: 11.5, steer: 0.9,
  },
  {
    id: 'rickshaw', name: 'Rickshaw', ur: 'Lahore ka rickshaw', color: '#16a34a',
    desc: 'Slow but nimble. Its top speed stays under the limit.',
    top: 55, accel: 4, brake: 9, steer: 1.25,
  },
  {
    id: 'pickup', name: 'Pickup', ur: 'Bhaari loader', color: '#e9c46a',
    desc: 'Heavy. Brakes late and turns slowly, so plan ahead.',
    top: 72, accel: 3.2, brake: 7.5, steer: 0.75,
  },
];
export const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];

export const NPC_TYPES = {
  car: { len: 4.2, w: 1.8 },
  rickshaw: { len: 2.8, w: 1.4 },
  bus: { len: 9, w: 2.5 },
};
