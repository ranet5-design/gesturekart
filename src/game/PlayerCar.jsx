import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game } from './state.js';
import { input } from '../cv/input.js';

/* The player's vehicle. Five bodies share the same cockpit (dashboard + steering wheel),
   so the virtual-wheel controls look and feel the same in every car. Front of the car is -z. */

const M = ({ color, rough = 0.4, metal = 0.2 }) => (
  <meshStandardMaterial color={color} roughness={rough} metalness={metal} />
);
const GLASS = '#1b263b';

function Box({ p, s, c, glass, shadow = true }) {
  return (
    <mesh position={p} castShadow={shadow}>
      <boxGeometry args={s} />
      {glass ? <meshStandardMaterial color={GLASS} roughness={0.1} metalness={0.5} /> : <M color={c} />}
    </mesh>
  );
}

// Each car: body parts, wheels [x, y, z, radius, width], brake-light height/z, whether a driver figure shows
const BODIES = {
  kart: {
    wheels: [[-0.95, 0.34, -1.25, 0.34, 0.3], [0.95, 0.34, -1.25, 0.34, 0.3], [-0.98, 0.4, 1.25, 0.4, 0.42], [0.98, 0.4, 1.25, 0.4, 0.42]],
    brake: [0.48, 1.82],
    driver: true,
    parts: (c) => (
      <>
        <Box p={[0, 0.42, 0.1]} s={[1.5, 0.32, 3.4]} c={c} />
        <Box p={[0, 0.38, -1.95]} s={[1.1, 0.22, 0.9]} c={c} />
        <Box p={[0, 0.28, -2.4]} s={[1.9, 0.08, 0.35]} c="#1d1d1d" />
        <Box p={[-0.82, 0.45, 0.2]} s={[0.3, 0.3, 1.4]} c="#f1faee" />
        <Box p={[0.82, 0.45, 0.2]} s={[0.3, 0.3, 1.4]} c="#f1faee" />
        <Box p={[0, 1.05, 1.75]} s={[1.8, 0.07, 0.45]} c="#1d1d1d" />
        <Box p={[-0.6, 0.78, 1.75]} s={[0.06, 0.5, 0.2]} c="#1d1d1d" />
        <Box p={[0.6, 0.78, 1.75]} s={[0.06, 0.5, 0.2]} c="#1d1d1d" />
      </>
    ),
  },
  hatch: {
    wheels: [[-0.82, 0.32, -1.2, 0.32, 0.24], [0.82, 0.32, -1.2, 0.32, 0.24], [-0.82, 0.32, 1.2, 0.32, 0.24], [0.82, 0.32, 1.2, 0.32, 0.24]],
    brake: [0.75, 1.86],
    driver: false,
    cabin: (c) => (
      <>
        <Box p={[0, 1.2, 0.55]} s={[1.5, 0.62, 2.1]} glass />
        <Box p={[0, 1.53, 0.55]} s={[1.52, 0.06, 2.05]} c={c} />
      </>
    ),
    parts: (c) => (
      <>
        <Box p={[0, 0.6, 0]} s={[1.6, 0.6, 3.7]} c={c} />
        <Box p={[0, 0.45, -1.87]} s={[1.62, 0.18, 0.1]} c="#adb5bd" />
        <Box p={[-0.55, 0.7, -1.86]} s={[0.3, 0.14, 0.04]} c="#fff8d6" />
        <Box p={[0.55, 0.7, -1.86]} s={[0.3, 0.14, 0.04]} c="#fff8d6" />
      </>
    ),
  },
  sedan: {
    wheels: [[-0.88, 0.34, -1.35, 0.34, 0.26], [0.88, 0.34, -1.35, 0.34, 0.26], [-0.88, 0.34, 1.35, 0.34, 0.26], [0.88, 0.34, 1.35, 0.34, 0.26]],
    brake: [0.72, 2.11],
    driver: false,
    cabin: (c) => (
      <>
        <Box p={[0, 1.08, 0.35]} s={[1.6, 0.5, 2.0]} glass />
        <Box p={[0, 1.35, 0.35]} s={[1.62, 0.05, 1.9]} c={c} />
      </>
    ),
    parts: (c) => (
      <>
        <Box p={[0, 0.58, 0]} s={[1.75, 0.55, 4.2]} c={c} />
        <Box p={[0, 0.88, 1.75]} s={[1.6, 0.06, 0.4]} c="#111" />
        <Box p={[-0.6, 0.66, -2.11]} s={[0.36, 0.12, 0.04]} c="#fff8d6" />
        <Box p={[0.6, 0.66, -2.11]} s={[0.36, 0.12, 0.04]} c="#fff8d6" />
      </>
    ),
  },
  rickshaw: {
    wheels: [[0, 0.3, -1.05, 0.3, 0.18], [-0.66, 0.3, 0.85, 0.3, 0.18], [0.66, 0.3, 0.85, 0.3, 0.18]],
    brake: [0.75, 1.3],
    driver: true,
    cabin: () => (
      <>
        <Box p={[0, 1.62, 0.15]} s={[1.5, 0.12, 2.5]} c="#111" />
        <Box p={[-0.7, 1.2, 1.3]} s={[0.06, 0.8, 0.06]} c="#111" />
        <Box p={[0.7, 1.2, 1.3]} s={[0.06, 0.8, 0.06]} c="#111" />
        <Box p={[-0.7, 1.2, -1.05]} s={[0.06, 0.8, 0.06]} c="#111" />
        <Box p={[0.7, 1.2, -1.05]} s={[0.06, 0.8, 0.06]} c="#111" />
        <Box p={[0, 1.15, 1.31]} s={[1.3, 0.55, 0.04]} c="#ffd166" />
      </>
    ),
    parts: (c) => (
      <>
        <Box p={[0, 0.75, 0.1]} s={[1.4, 0.8, 2.4]} c={c} />
        <Box p={[0, 0.95, -0.95]} s={[1.42, 0.14, 0.5]} c="#ffd166" />
      </>
    ),
  },
  pickup: {
    wheels: [[-0.95, 0.4, -1.45, 0.4, 0.3], [0.95, 0.4, -1.45, 0.4, 0.3], [-0.95, 0.4, 1.35, 0.4, 0.3], [0.95, 0.4, 1.35, 0.4, 0.3]],
    brake: [0.85, 2.31],
    driver: false,
    cabin: (c) => (
      <>
        <Box p={[0, 1.35, -0.55]} s={[1.8, 0.6, 1.4]} glass />
        <Box p={[0, 1.68, -0.55]} s={[1.82, 0.06, 1.42]} c={c} />
      </>
    ),
    parts: (c) => (
      <>
        <Box p={[0, 0.72, -0.9]} s={[1.9, 0.7, 2.6]} c={c} />
        <Box p={[0, 0.55, 1.3]} s={[1.9, 0.4, 2.0]} c="#6b705c" />
        <Box p={[-0.92, 0.92, 1.3]} s={[0.06, 0.4, 2.0]} c={c} />
        <Box p={[0.92, 0.92, 1.3]} s={[0.06, 0.4, 2.0]} c={c} />
        <Box p={[0, 0.92, 2.28]} s={[1.9, 0.4, 0.06]} c={c} />
        <Box p={[0, 0.82, 1.1]} s={[1.0, 0.5, 0.9]} c="#a98467" />
      </>
    ),
  },
};

export default function PlayerCar({ car, color }) {
  const spec = BODIES[car] || BODIES.kart;
  const ref = useRef();
  const wheels = useRef([]);
  const driver = useRef();
  const steering = useRef();
  const gloves = useRef();
  const cabin = useRef();
  const brake = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5a0000', emissive: '#ff1a1a', emissiveIntensity: 0.4 }),
    [],
  );
  const blinkers = useMemo(
    () => ({
      left: new THREE.MeshStandardMaterial({ color: '#4a3000', emissive: '#ffa200', emissiveIntensity: 0 }),
      right: new THREE.MeshStandardMaterial({ color: '#4a3000', emissive: '#ffa200', emissiveIntensity: 0 }),
    }),
    [],
  );
  useFrame((state, dt) => {
    const g = ref.current;
    g.position.x = game.x;
    g.rotation.y = game.yaw;
    g.rotation.z = -game.roll;
    g.visible = !(game.invuln > 0 && Math.floor(state.clock.elapsedTime * 12) % 2 === 0);
    wheels.current.forEach((w, i) => w && (w.rotation.x -= (game.v * dt) / (spec.wheels[i]?.[3] || 0.35)));
    brake.emissiveIntensity = game.braking || game.v < 0.3 ? 2.5 : 0.4;
    const cockpit = game.view === 'cockpit' && !['menu', 'levels', 'history'].includes(game.phase) && !game.replay;
    if (driver.current) driver.current.visible = spec.driver && !cockpit;
    // From the driver's seat, roof / pillars / glass would block the view, so hide them
    if (cabin.current) cabin.current.visible = !cockpit;
    const on = Math.floor(state.clock.elapsedTime * 3) % 2 === 0;
    blinkers.left.emissiveIntensity = game.indicator?.dir === 'left' && on ? 3 : 0;
    blinkers.right.emissiveIntensity = game.indicator?.dir === 'right' && on ? 3 : 0;
    // The 3D steering wheel copies the player's real hands (clockwise from the driver = turn right)
    steering.current.rotation.z = -input.wheelAngle;
    gloves.current.visible = input.wheelHeld && !input.halt;
  });

  const [by, bz] = spec.brake;
  return (
    <group ref={ref}>
      {spec.parts(color)}
      {spec.cabin && <group ref={cabin}>{spec.cabin(color)}</group>}
      {/* indicators: front corners (seen from the cockpit) and rear corners */}
      {[
        ['left', -0.7, -1.9],
        ['right', 0.7, -1.9],
        ['left', -0.75, bz - 0.02],
        ['right', 0.75, bz - 0.02],
      ].map(([side, x, z], i) => (
        <mesh key={i} position={[x, by + 0.12, z]} material={blinkers[side]}>
          <boxGeometry args={[0.22, 0.1, 0.08]} />
        </mesh>
      ))}

      <group ref={driver}>
        <mesh position={[0, 0.85, 0.35]} castShadow>
          <cylinderGeometry args={[0.28, 0.34, 0.6, 12]} />
          <meshStandardMaterial color="#1d3557" />
        </mesh>
        <mesh position={[0, 1.32, 0.3]} castShadow>
          <sphereGeometry args={[0.3, 18, 14]} />
          <meshStandardMaterial color="#f1faee" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.33, 0.05]}>
          <boxGeometry args={[0.42, 0.14, 0.12]} />
          <meshStandardMaterial color="#0b0b0b" roughness={0.1} metalness={0.6} />
        </mesh>
      </group>

      {/* dashboard */}
      <mesh position={[0, 0.84, -0.66]}>
        <boxGeometry args={[1.3, 0.2, 0.34]} />
        <meshStandardMaterial color="#1b1f2a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.95, -0.5]} rotation-x={-0.5}>
        <planeGeometry args={[0.5, 0.12]} />
        <meshBasicMaterial color="#22c55e" toneMapped={false} />
      </mesh>

      {/* steering wheel, tilted toward the driver */}
      <group position={[0, 1.04, -0.36]} rotation-x={-0.45}>
        <group ref={steering}>
          <mesh>
            <torusGeometry args={[0.22, 0.032, 12, 40]} />
            <meshStandardMaterial color="#111" roughness={0.5} />
          </mesh>
          {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
            <mesh key={a} rotation-z={a} position={[Math.sin(a) * 0.11, -Math.cos(a) * 0.11, 0]}>
              <boxGeometry args={[0.035, 0.22, 0.02]} />
              <meshStandardMaterial color="#2b2f3a" />
            </mesh>
          ))}
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 20]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.22, 0.01]}>
            <boxGeometry args={[0.04, 0.05, 0.05]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} />
          </mesh>
          <group ref={gloves}>
            {[-0.22, 0.22].map((x) => (
              <mesh key={x} position={[x, 0, 0.02]}>
                <sphereGeometry args={[0.055, 14, 10]} />
                <meshStandardMaterial color="#fbbf24" roughness={0.7} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      <mesh position={[-0.5, by, bz]} material={brake}>
        <boxGeometry args={[0.36, 0.14, 0.04]} />
      </mesh>
      <mesh position={[0.5, by, bz]} material={brake}>
        <boxGeometry args={[0.36, 0.14, 0.04]} />
      </mesh>

      {spec.wheels.map(([x, y, z, r, w], i) => (
        <group key={`${car}-${i}`} position={[x, y, z]}>
          <group ref={(el) => (wheels.current[i] = el)}>
            <mesh rotation-z={Math.PI / 2} castShadow>
              <cylinderGeometry args={[r, r, w, 16]} />
              <meshStandardMaterial color="#141414" roughness={0.85} />
            </mesh>
            <mesh rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[r * 0.45, r * 0.45, w + 0.02, 8]} />
              <meshStandardMaterial color="#adb5bd" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
