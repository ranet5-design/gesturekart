import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game, stepFrame } from './state.js';
import { LANE_W, ROAD_HALF, NPC_TYPES, carById } from './config.js';
import { settings } from './settings.js';
import PlayerCar from './PlayerCar.jsx';
import * as tex from './textures.js';

/* The player's kart always sits at z = 0. The world slides past it:
   anything at road distance `s` is drawn at z = -(s - game.s). */

const STRIP_LEN = 600;
const STRIP_Z = -250;
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const zOf = (s) => -(s - game.s);

// Sky, fog and light for each time of day / weather
const ENV = {
  'day-clear': { sky: '#efdcbc', fogNear: 70, fogFar: 340, hemi: 0.9, sun: 1.7, lamps: 0.25 },
  'day-fog': { sky: '#d9d6cf', fogNear: 15, fogFar: 120, hemi: 1.0, sun: 0.7, lamps: 0.6 },
  'night-rain': { sky: '#0d1424', fogNear: 25, fogFar: 170, hemi: 0.22, sun: 0.12, lamps: 3 },
  'night-clear': { sky: '#0b1222', fogNear: 40, fogFar: 260, hemi: 0.25, sun: 0.15, lamps: 3 },
  'day-rain': { sky: '#9aa3ad', fogNear: 30, fogFar: 180, hemi: 0.7, sun: 0.6, lamps: 0.8 },
};
export const envKey = () => `${game.level.env?.time || 'day'}-${game.level.env?.weather || 'clear'}`;
const envOf = () => ENV[envKey()] || ENV['day-clear'];

export default function World({ runId, car = 'kart' }) {
  const env = envOf();
  return (
    <>
      <color attach="background" args={[env.sky]} />
      <fog attach="fog" args={[env.sky, env.fogNear, env.fogFar]} />
      <Lights />
      <GameLoop />
      <CameraRig />
      <Ground />
      <LaneDashes />
      <Trees />
      <Buildings />
      <Lamps />
      <Billboards />
      <group key={runId}>
        {game.signals.map((sig) => (
          <Signal key={sig.id} sig={sig} />
        ))}
        {game.npcs.map((n) => (
          <Npc key={n.id} npc={n} />
        ))}
        {game.peds.map((p) => (
          <Pedestrian key={p.id} ped={p} />
        ))}
        {(game.level.zones || []).map((z) => (
          <ZoneSigns key={z.from} zone={z} />
        ))}
        <Arch atS={game.length} lines={['FINISH', `${game.level.route.to} · Civic Score ahead`]} bg="#7a1f2b" />
        <Arch atS={-2} lines={[game.level.id ? `LEVEL ${game.level.id}` : 'START', `${game.level.route.from} · ${game.level.route.name}`]} bg="#0f5132" />
        {game.level.env?.weather === 'rain' && <Rain />}
      </group>
      <PlayerCar car={car} color={carById(car).color} />
    </>
  );
}

function Lights() {
  const hemi = useRef();
  const sun = useRef();
  const head = useRef();
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const env = envOf();
    hemi.current.intensity = env.hemi;
    sun.current.intensity = env.sun;
    // Headlights at night, in fog and in rain
    const needLights = env.lamps > 0.5;
    head.current.intensity = needLights ? 40 : 0;
    head.current.position.set(game.x, 1.1, -1.8);
    target.position.set(game.x - game.yaw * 20, 0, -25);
    target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={['#fff6e5', '#5d7a3c', 0.9]} />
      <directionalLight
        ref={sun}
        castShadow
        position={[-14, 26, 10]}
        intensity={1.7}
        color="#fff0d2"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
      />
      <primitive object={target} />
      <spotLight ref={head} target={target} angle={0.55} penumbra={0.6} distance={70} decay={1.2} color="#fff4d6" />
    </>
  );
}

function Rain() {
  const ref = useRef();
  const N = 1800;
  const pos = useMemo(() => {
    const a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      a[i * 3] = (Math.random() - 0.5) * 40;
      a[i * 3 + 1] = Math.random() * 14;
      a[i * 3 + 2] = -Math.random() * 60 + 8;
    }
    return a;
  }, []);
  useFrame((_, dt) => {
    const p = ref.current.geometry.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = p.array[i * 3 + 1] - dt * 18;
      let z = p.array[i * 3 + 2] + dt * game.v;
      if (y < 0) y += 14;
      if (z > 8) z -= 60;
      p.array[i * 3 + 1] = y;
      p.array[i * 3 + 2] = z;
    }
    p.needsUpdate = true;
    ref.current.position.x = game.x;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={pos} count={N} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#aac4e8" size={0.07} transparent opacity={0.7} />
    </points>
  );
}

// Speed-zone signs: a round limit sign plus a yellow "SCHOOL ZONE" board at the start, "END" at the end
function ZoneSigns({ zone }) {
  const startRef = useRef();
  const endRef = useRef();
  const mats = useMemo(() => {
    const limit = tex.makeSign([String(zone.limit), 'km/h'], { bg: '#ffffff', fg: '#111111', accent: '#d62828', w: 256, h: 256 });
    const board = tex.makeSign([zone.label, 'Slow down · Aahista'], { bg: '#ffd60a', fg: '#111111', accent: '#111111', w: 512, h: 256 });
    const end = tex.makeSign([`END ${zone.label}`, 'Limit 60'], { bg: '#e9ecef', fg: '#111111', accent: '#495057', w: 512, h: 256 });
    const road = tex.makeSign([zone.label.split(' ')[0]], { bg: '#3b3d42', fg: '#ffd60a', accent: '#3b3d42', w: 512, h: 128 });
    return {
      limit: new THREE.MeshBasicMaterial({ map: limit, toneMapped: false }),
      board: new THREE.MeshBasicMaterial({ map: board, toneMapped: false }),
      end: new THREE.MeshBasicMaterial({ map: end, toneMapped: false }),
      road: new THREE.MeshBasicMaterial({ map: road, transparent: true, opacity: 0.9 }),
    };
  }, [zone]);
  useFrame(() => {
    const zs = zOf(zone.from);
    const ze = zOf(zone.to);
    startRef.current.position.z = zs;
    startRef.current.visible = zs < 30 && zs > -320;
    endRef.current.position.z = ze;
    endRef.current.visible = ze < 30 && ze > -320;
  });
  const x = ROAD_HALF + 1.4;
  return (
    <>
      <group ref={startRef}>
        <mesh position={[x, 1.6, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 3.2, 6]} />
          <meshStandardMaterial color="#666" />
        </mesh>
        <mesh position={[x, 3.4, 0.05]} material={mats.limit}>
          <circleGeometry args={[0.55, 32]} />
        </mesh>
        <mesh position={[x, 2.35, 0.05]} material={mats.board}>
          <planeGeometry args={[1.8, 0.9]} />
        </mesh>
        <mesh position={[LANE_W, 0.02, -6]} rotation-x={-Math.PI / 2} material={mats.road}>
          <planeGeometry args={[3, 1.2]} />
        </mesh>
        <mesh position={[0, 0.02, -6]} rotation-x={-Math.PI / 2} material={mats.road}>
          <planeGeometry args={[3, 1.2]} />
        </mesh>
        <mesh position={[-LANE_W, 0.02, -6]} rotation-x={-Math.PI / 2} material={mats.road}>
          <planeGeometry args={[3, 1.2]} />
        </mesh>
      </group>
      <group ref={endRef}>
        <mesh position={[x, 1.4, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.8, 6]} />
          <meshStandardMaterial color="#666" />
        </mesh>
        <mesh position={[x, 2.6, 0.05]} material={mats.end}>
          <planeGeometry args={[1.8, 0.9]} />
        </mesh>
      </group>
    </>
  );
}

function GameLoop() {
  useFrame((_, dt) => stepFrame(Math.min(dt, 0.05)));
  return null;
}

function CameraRig() {
  useFrame((state, dt) => {
    const cam = state.camera;
    const menu = ['menu', 'levels', 'history'].includes(game.phase);
    const t = state.clock.elapsedTime;

    // Replay: a slow cinematic orbit from above and to the side, so you can see what happened
    if (game.replay) {
      const a = 0.6 + game.replay.i * 0.004;
      const k = Math.min(1, dt * 3);
      cam.position.x += (game.x + Math.sin(a) * 11 - cam.position.x) * k;
      cam.position.y += (7 - cam.position.y) * k;
      cam.position.z += (Math.cos(a) * 11 - 2 - cam.position.z) * k;
      cam.lookAt(game.x, 0.6, -7);
      if (Math.abs(cam.fov - 55) > 0.05) {
        cam.fov = 55;
        cam.updateProjectionMatrix();
      }
      return;
    }

    // Driver's seat: eyes just behind the steering wheel, looking down the road
    if (!menu && game.view === 'cockpit') {
      cam.position.set(game.x, 1.3, 0.5);
      if (game.shake > 0) {
        cam.position.x += (Math.random() - 0.5) * game.shake * 0.15;
        cam.position.y += (Math.random() - 0.5) * game.shake * 0.1;
      }
      cam.lookAt(game.x - game.yaw * 18, 1.0, -20);
      cam.rotateZ(game.roll * 0.6);
      const fov = 70 + game.v * 0.35;
      if (Math.abs(cam.fov - fov) > 0.05) {
        cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
        cam.updateProjectionMatrix();
      }
      return;
    }

    const wide = !menu && game.view === 'wide';
    const tx = wide ? game.x * 0.35 : game.x * 0.6 + (menu ? Math.sin(t * 0.25) * 3 : 0);
    const ty = menu ? 4.6 : wide ? 9.5 + game.v * 0.05 : 3.0 + game.v * 0.025;
    const tz = menu ? 9.5 : wide ? 13 + game.v * 0.08 : 6.8 + game.v * 0.06;
    const k = Math.min(1, dt * 4);
    cam.position.x += (tx - cam.position.x) * k;
    cam.position.y += (ty - cam.position.y) * k;
    cam.position.z += (tz - cam.position.z) * k;
    if (game.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * game.shake * 0.6;
      cam.position.y += (Math.random() - 0.5) * game.shake * 0.4;
    }
    if (wide) cam.lookAt(game.x * 0.5, -1.5, -13);
    else cam.lookAt(game.x * 0.8, 1.0, -16);
    const fov = wide ? 62 + game.v * 0.3 : 58 + game.v * 0.6;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * k;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/* ---------------- Ground, road and canal ---------------- */

function Strip({ x, width, y = 0, material }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, STRIP_Z]} receiveShadow material={material}>
      <planeGeometry args={[width, STRIP_LEN]} />
    </mesh>
  );
}

function Ground() {
  const m = useMemo(() => {
    const asphalt = tex.makeAsphalt(STRIP_LEN / 12);
    const asphalt2 = tex.makeAsphalt(STRIP_LEN / 12);
    const grass = tex.makeGrass(20, STRIP_LEN / 10);
    const grass2 = tex.makeGrass(3, STRIP_LEN / 10);
    const water = tex.makeWater(STRIP_LEN / 14);
    const pave = tex.makePavement(STRIP_LEN / 3);
    const curb = tex.makeSign([''], { bg: '#f2c230', w: 8, h: 8 });
    return {
      asphalt,
      asphalt2,
      grass,
      grass2,
      water,
      pave,
      road: new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 }),
      farRoad: new THREE.MeshStandardMaterial({ map: asphalt2, roughness: 0.95 }),
      grassM: new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }),
      bankM: new THREE.MeshStandardMaterial({ map: grass2, roughness: 1 }),
      waterM: new THREE.MeshStandardMaterial({ map: water, roughness: 0.25, metalness: 0.1, color: '#cfe8e2' }),
      paveM: new THREE.MeshStandardMaterial({ map: pave, roughness: 0.9 }),
      wallM: new THREE.MeshStandardMaterial({ color: '#9b8b78', roughness: 0.9 }),
      line: new THREE.MeshBasicMaterial({ color: '#f4f1e8' }),
      yellow: new THREE.MeshBasicMaterial({ color: '#f2c230' }),
      curb: new THREE.MeshStandardMaterial({ map: curb, roughness: 0.8 }),
    };
  }, []);

  useFrame((state) => {
    const s = game.s;
    m.asphalt.offset.y = s / 12;
    m.asphalt2.offset.y = s / 12;
    m.grass.offset.y = s / 10;
    m.grass2.offset.y = s / 10;
    m.pave.offset.y = s / 3;
    m.water.offset.y = s / 14 + state.clock.elapsedTime * 0.02;
  });

  const half = ROAD_HALF;
  return (
    <group>
      {/* main carriageway */}
      <Strip x={0} width={half * 2} material={m.road} />
      <Strip x={half - 0.25} width={0.15} y={0.012} material={m.line} />
      <Strip x={-half + 0.25} width={0.15} y={0.012} material={m.yellow} />
      {/* right sidewalk with painted curb */}
      <mesh position={[half + 1.75, 0, STRIP_Z]} receiveShadow material={m.paveM}>
        <boxGeometry args={[3.3, 0.3, STRIP_LEN]} />
      </mesh>
      <mesh position={[half + 0.08, 0.02, STRIP_Z]} material={m.curb}>
        <boxGeometry args={[0.18, 0.34, STRIP_LEN]} />
      </mesh>
      <Strip x={half + 3.4 + 40} width={80} y={0.0} material={m.grassM} />
      {/* median green belt with trees, then the canal */}
      <Strip x={-7.6} width={4.8} y={0.05} material={m.bankM} />
      <mesh position={[-half - 0.08, 0.05, STRIP_Z]} material={m.curb}>
        <boxGeometry args={[0.18, 0.3, STRIP_LEN]} />
      </mesh>
      <Strip x={-14} width={8} y={-0.75} material={m.waterM} />
      <mesh position={[-10.05, -0.35, STRIP_Z]} material={m.wallM}>
        <boxGeometry args={[0.3, 0.9, STRIP_LEN]} />
      </mesh>
      <mesh position={[-17.95, -0.35, STRIP_Z]} material={m.wallM}>
        <boxGeometry args={[0.3, 0.9, STRIP_LEN]} />
      </mesh>
      {/* far bank and the opposite carriageway */}
      <Strip x={-20.5} width={5} y={0.05} material={m.bankM} />
      <Strip x={-28.25} width={10.5} y={0.01} material={m.farRoad} />
      <Strip x={-33.5 - 40} width={80} y={0} material={m.grassM} />
    </group>
  );
}

function LaneDashes() {
  const ref = useRef();
  const SP = 9;
  const N = 44;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const xs = [-LANE_W / 2, LANE_W / 2, -28.25 - LANE_W / 2, -28.25 + LANE_W / 2];
  useFrame(() => {
    if (!ref.current) return;
    const off = game.s % SP;
    let k = 0;
    for (const x of xs)
      for (let i = -2; i < N - 2; i++) {
        dummy.position.set(x, 0.013, -i * SP + off);
        dummy.updateMatrix();
        ref.current.setMatrixAt(k++, dummy.matrix);
      }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, xs.length * N]} frustumCulled={false}>
      <boxGeometry args={[0.16, 0.01, 3.2]} />
      <meshBasicMaterial color="#f4f1e8" />
    </instancedMesh>
  );
}

/* ---------------- Scenery (instanced, recycled as you drive) ---------------- */

const TREE_ROWS = [-7.4, -20.4, 10.6, -38];
const TREE_SP = 8;
const TREE_N = 46;
const GREENS = ['#4f7a35', '#3f6b2f', '#5f8a3a', '#6b8f3c', '#46723a', '#7a9a48'].map((c) => new THREE.Color(c));

function Trees() {
  const trunks = useRef();
  const crowns = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const total = TREE_N * TREE_ROWS.length;
  useFrame(() => {
    if (!trunks.current || !crowns.current) return;
    const base = Math.floor(game.s / TREE_SP) - 3;
    let k = 0;
    for (let i = 0; i < TREE_N; i++) {
      const g = base + i;
      const z = -(g * TREE_SP - game.s);
      TREE_ROWS.forEach((rx, r) => {
        const h = hash(g * 7 + r * 131);
        const skip = r === 2 ? h < 0.5 : h < 0.1;
        const sc = skip ? 0.0001 : 0.8 + hash(g * 3 + r * 17) * 0.75;
        const x = rx + (hash(g * 11 + r * 5) - 0.5) * 1.4;
        const zz = z + (hash(g * 13 + r) - 0.5) * 3;
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(sc, sc, sc);
        dummy.position.set(x, 1.4 * sc, zz);
        dummy.updateMatrix();
        trunks.current.setMatrixAt(k, dummy.matrix);
        dummy.position.set(x, 3.7 * sc, zz);
        dummy.rotation.y = h * 6;
        dummy.scale.set(sc, sc * (0.85 + hash(g + r) * 0.4), sc);
        dummy.updateMatrix();
        crowns.current.setMatrixAt(k, dummy.matrix);
        crowns.current.setColorAt(k, GREENS[Math.floor(hash(g * 5 + r * 3) * GREENS.length)]);
        k++;
      });
    }
    trunks.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceMatrix.needsUpdate = true;
    if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={trunks} args={[null, null, total]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 2.8, 6]} />
        <meshStandardMaterial color="#6b4a2f" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[null, null, total]} frustumCulled={false} castShadow>
        <icosahedronGeometry args={[1.9, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
      </instancedMesh>
    </>
  );
}

const BUILD_SP = 15;
const BUILD_N = 26;
const BUILD_COLS = ['#d9b48f', '#c98b6b', '#e8d8b0', '#a9b8a0', '#d4a373', '#bfb6a8', '#b5654a', '#e3c9a8', '#cfd8dc'].map(
  (c) => new THREE.Color(c),
);

function Buildings() {
  const blocks = useRef();
  const tanks = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const total = BUILD_N * 2;
  useFrame(() => {
    if (!blocks.current || !tanks.current) return;
    const base = Math.floor(game.s / BUILD_SP) - 2;
    let k = 0;
    for (let i = 0; i < BUILD_N; i++) {
      const g = base + i;
      const z = -(g * BUILD_SP - game.s);
      for (let side = 0; side < 2; side++) {
        const seed = g * 31 + side * 977;
        const w = 7 + hash(seed) * 6;
        const d = 8 + hash(seed + 1) * 5;
        const hgt = 5 + Math.pow(hash(seed + 2), 1.6) * 20;
        const x = side === 0 ? 15 + w / 2 + hash(seed + 3) * 6 : -44 - w / 2 - hash(seed + 3) * 8;
        dummy.rotation.set(0, 0, 0);
        dummy.position.set(x, hgt / 2, z);
        dummy.scale.set(w, hgt, d);
        dummy.updateMatrix();
        blocks.current.setMatrixAt(k, dummy.matrix);
        blocks.current.setColorAt(k, BUILD_COLS[Math.floor(hash(seed + 4) * BUILD_COLS.length)]);
        // Rooftop water tanks, a familiar Lahore skyline detail
        const hasTank = hash(seed + 5) < 0.65;
        dummy.position.set(x + (hash(seed + 6) - 0.5) * w * 0.5, hgt + 0.7, z);
        dummy.scale.set(hasTank ? 1 : 0.0001, hasTank ? 1 : 0.0001, hasTank ? 1 : 0.0001);
        dummy.updateMatrix();
        tanks.current.setMatrixAt(k, dummy.matrix);
        k++;
      }
    }
    blocks.current.instanceMatrix.needsUpdate = true;
    tanks.current.instanceMatrix.needsUpdate = true;
    if (blocks.current.instanceColor) blocks.current.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={blocks} args={[null, null, total]} frustumCulled={false} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={tanks} args={[null, null, total]} frustumCulled={false}>
        <cylinderGeometry args={[0.6, 0.6, 1.4, 10]} />
        <meshStandardMaterial color="#1d3557" roughness={0.6} />
      </instancedMesh>
    </>
  );
}

const LAMP_SP = 30;
const LAMP_N = 14;
function Lamps() {
  const lampMat = useRef();
  useFrame(() => {
    if (lampMat.current) lampMat.current.emissiveIntensity = envOf().lamps;
  });
  const poles = useRef();
  const heads = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const sides = [
    { x: ROAD_HALF + 0.7, dir: -1 },
    { x: -ROAD_HALF - 0.9, dir: 1 },
  ];
  useFrame(() => {
    if (!poles.current || !heads.current) return;
    const off = game.s % LAMP_SP;
    let k = 0;
    for (let i = -1; i < LAMP_N - 1; i++)
      for (const sd of sides) {
        const z = -i * LAMP_SP + off + (sd.dir > 0 ? LAMP_SP / 2 : 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.position.set(sd.x, 3.5, z);
        dummy.updateMatrix();
        poles.current.setMatrixAt(k, dummy.matrix);
        dummy.position.set(sd.x + sd.dir * 1.3, 6.9, z);
        dummy.updateMatrix();
        heads.current.setMatrixAt(k, dummy.matrix);
        k++;
      }
    poles.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
  });
  const total = LAMP_N * 2;
  return (
    <>
      <instancedMesh ref={poles} args={[null, null, total]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 7, 6]} />
        <meshStandardMaterial color="#5c6670" metalness={0.4} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[null, null, total]} frustumCulled={false}>
        <boxGeometry args={[2.6, 0.18, 0.4]} />
        <meshStandardMaterial ref={lampMat} color="#5c6670" emissive="#fff3c4" emissiveIntensity={0.25} />
      </instancedMesh>
    </>
  );
}

const MESSAGES = [
  ['ZEBRA PE RUKIYE', 'Stop for people on the zebra'],
  ['SPEED LIMIT 60', 'Canal Road'],
  ['LANE MEIN RAHEIN', 'Stay in your lane'],
  ['LAAL BATTI = RUKO', 'Red light means stop'],
  ['FASLA RAKHEIN', 'Keep a safe distance'],
];
const BB_SP = 120;
function Billboards() {
  const refs = useRef([]);
  const mats = useMemo(
    () =>
      MESSAGES.map(
        (lines, i) =>
          new THREE.MeshBasicMaterial({
            map: tex.makeSign(lines, { bg: ['#0f5132', '#7a1f2b', '#1d3557', '#3d2c8d', '#7c4a03'][i] }),
            toneMapped: false,
          }),
      ),
    [],
  );
  useFrame(() => {
    const base = Math.floor(game.s / BB_SP);
    refs.current.forEach((grp, i) => {
      if (!grp) return;
      const g = base + i;
      grp.position.z = -(g * BB_SP + 60 - game.s);
      grp.children[0].material = mats[Math.floor(hash(g * 3.3) * mats.length)];
    });
  });
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} position={[12.5, 0, 0]} rotation-y={-0.35}>
          <mesh position={[0, 6, 0]}>
            <planeGeometry args={[9, 4.5]} />
          </mesh>
          <mesh position={[0, 6, -0.12]}>
            <boxGeometry args={[9.3, 4.8, 0.2]} />
            <meshStandardMaterial color="#2b2d42" />
          </mesh>
          <mesh position={[-2.5, 2, -0.2]}>
            <boxGeometry args={[0.3, 4, 0.3]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          <mesh position={[2.5, 2, -0.2]}>
            <boxGeometry args={[0.3, 4, 0.3]} />
            <meshStandardMaterial color="#555" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Arch({ atS, lines, bg }) {
  const ref = useRef();
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex.makeSign(lines, { bg, w: 1024, h: 256 }), toneMapped: false }),
    [lines, bg],
  );
  const checker = useMemo(() => new THREE.MeshBasicMaterial({ map: tex.makeChecker() }), []);
  useFrame(() => {
    const z = zOf(atS);
    ref.current.position.z = z;
    ref.current.visible = z < 20 && z > -380;
  });
  const px = ROAD_HALF + 0.6;
  return (
    <group ref={ref}>
      <mesh position={[0, 0.014, 0]} rotation-x={-Math.PI / 2} material={checker}>
        <planeGeometry args={[ROAD_HALF * 2, 1.4]} />
      </mesh>
      {[-px, px].map((x) => (
        <mesh key={x} position={[x, 3.6, 0]} castShadow>
          <boxGeometry args={[0.6, 7.2, 0.6]} />
          <meshStandardMaterial color="#e9e4d8" />
        </mesh>
      ))}
      <mesh position={[0, 6.4, 0.05]} material={mat}>
        <planeGeometry args={[px * 2 + 0.6, 2.2]} />
      </mesh>
    </group>
  );
}

/* ---------------- Junctions with signals and zebra crossings ---------------- */

function Signal({ sig }) {
  const ref = useRef();
  const mats = useMemo(
    () => ({
      red: new THREE.MeshStandardMaterial({ color: '#3a0d0d', emissive: '#ff2a2a', emissiveIntensity: 0 }),
      yellow: new THREE.MeshStandardMaterial({ color: '#3a2e0d', emissive: '#ffbf1f', emissiveIntensity: 0 }),
      green: new THREE.MeshStandardMaterial({ color: '#0d3a1a', emissive: '#22e06a', emissiveIntensity: 0 }),
    }),
    [],
  );
  // Colour-blind friendly: a STOP / WAIT / GO word board under the main signal
  const words = useMemo(
    () => ({
      red: new THREE.MeshBasicMaterial({ map: tex.makeSign(['STOP'], { bg: '#d62828', fg: '#fff', accent: '#fff', w: 256, h: 128 }), toneMapped: false }),
      yellow: new THREE.MeshBasicMaterial({ map: tex.makeSign(['WAIT'], { bg: '#ffb703', fg: '#111', accent: '#111', w: 256, h: 128 }), toneMapped: false }),
      green: new THREE.MeshBasicMaterial({ map: tex.makeSign(['GO'], { bg: '#2a9d4a', fg: '#fff', accent: '#fff', w: 256, h: 128 }), toneMapped: false }),
    }),
    [],
  );
  const word = useRef();
  useFrame(() => {
    const z = zOf(sig.s);
    ref.current.position.z = z;
    ref.current.visible = z < 40 && z > -360;
    mats.red.emissiveIntensity = sig.state === 'red' ? 3 : 0.02;
    mats.yellow.emissiveIntensity = sig.state === 'yellow' ? 3 : 0.02;
    mats.green.emissiveIntensity = sig.state === 'green' ? 2.6 : 0.02;
    word.current.visible = settings.colorblind;
    word.current.material = words[sig.state];
  });

  const zebra = [];
  for (let x = -ROAD_HALF + 0.55; x < ROAD_HALF - 0.3; x += 1.05) zebra.push(x);
  const head = (pos, scale = 1) => (
    <group position={pos} scale={scale}>
      <mesh>
        <boxGeometry args={[0.55, 1.5, 0.35]} />
        <meshStandardMaterial color="#1b1b1b" />
      </mesh>
      <mesh position={[0, 0.45, 0.19]} material={mats.red}>
        <sphereGeometry args={[0.17, 16, 12]} />
      </mesh>
      <mesh position={[0, 0, 0.19]} material={mats.yellow}>
        <sphereGeometry args={[0.17, 16, 12]} />
      </mesh>
      <mesh position={[0, -0.45, 0.19]} material={mats.green}>
        <sphereGeometry args={[0.17, 16, 12]} />
      </mesh>
    </group>
  );

  const poleX = ROAD_HALF + 1.0;
  return (
    <group ref={ref}>
      {/* stop line */}
      <mesh position={[0, 0.016, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ROAD_HALF * 2, 0.5]} />
        <meshBasicMaterial color="#f4f1e8" />
      </mesh>
      {/* zebra crossing, 1 m to 5 m past the stop line */}
      {zebra.map((x) => (
        <mesh key={x} position={[x, 0.016, -3]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.55, 4]} />
          <meshBasicMaterial color="#f4f1e8" />
        </mesh>
      ))}
      {/* cross road: over the sidewalk on the right, and a bridge over the canal on the left */}
      <mesh position={[poleX + 22, 0.17, -10]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[44, 9]} />
        <meshStandardMaterial color="#45474d" roughness={0.95} />
      </mesh>
      <mesh position={[-19.5, 0.12, -10]} receiveShadow>
        <boxGeometry args={[28.5, 0.25, 9]} />
        <meshStandardMaterial color="#8d8478" roughness={0.9} />
      </mesh>
      {[-5.4, -14.6].map((z) => (
        <mesh key={z} position={[-14, 0.7, z]}>
          <boxGeometry args={[8.4, 0.9, 0.2]} />
          <meshStandardMaterial color="#c9bfb0" />
        </mesh>
      ))}
      {/* signal pole with an overhead arm */}
      <mesh position={[poleX, 3, 0.4]} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 6, 8]} />
        <meshStandardMaterial color="#3c4a57" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[poleX - 2.8, 5.85, 0.4]} castShadow>
        <boxGeometry args={[5.6, 0.16, 0.16]} />
        <meshStandardMaterial color="#3c4a57" metalness={0.4} roughness={0.5} />
      </mesh>
      {head([1.2, 5.0, 0.4])}
      <mesh ref={word} position={[1.2, 3.85, 0.45]}>
        <planeGeometry args={[1.3, 0.62]} />
      </mesh>
      {head([poleX - 0.35, 3.1, 0.4], 0.8)}
      {/* a second signal on the median for the left lane */}
      <mesh position={[-ROAD_HALF - 0.9, 1.6, 0.4]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 3.2, 8]} />
        <meshStandardMaterial color="#3c4a57" />
      </mesh>
      {head([-ROAD_HALF - 0.9, 3.6, 0.4], 0.8)}
    </group>
  );
}

/* ---------------- Traffic ---------------- */

const CAR_COLORS = ['#f1faee', '#a8dadc', '#264653', '#e9c46a', '#adb5bd', '#1d3557', '#9d0208', '#c0c0c0'];

function Wheel({ position, r = 0.36, w = 0.3 }) {
  return (
    <mesh position={position} rotation-z={Math.PI / 2} castShadow>
      <cylinderGeometry args={[r, r, w, 14]} />
      <meshStandardMaterial color="#141414" roughness={0.8} />
    </mesh>
  );
}

function Npc({ npc }) {
  const ref = useRef();
  const tail = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5a0000', emissive: '#ff1a1a', emissiveIntensity: 0.3 }),
    [],
  );
  const color = useMemo(() => CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], []);
  const beacon = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2020', emissiveIntensity: 0 }),
      new THREE.MeshStandardMaterial({ color: '#004', emissive: '#2060ff', emissiveIntensity: 0 }),
    ],
    [],
  );
  const cross = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex.makeSign(['+', 'AMBULANCE · 1122'], { bg: '#ffffff', fg: '#d62828', accent: '#d62828', w: 256, h: 256 }) }),
    [],
  );
  const legs = useRef();
  useFrame((state) => {
    const g = ref.current;
    g.visible = npc.active;
    if (!npc.active) return;
    g.position.set(npc.x, 0, zOf(npc.s));
    tail.emissiveIntensity = npc.braking || npc.v < 0.3 ? 2.2 : 0.3;
    if (npc.type === 'ambulance') {
      const on = Math.floor(state.clock.elapsedTime * 6) % 2;
      beacon[0].emissiveIntensity = on ? 4 : 0.1;
      beacon[1].emissiveIntensity = on ? 0.1 : 4;
    }
    if (npc.type === 'cart' && legs.current) legs.current.rotation.x = Math.sin(state.clock.elapsedTime * 6) * 0.3;
  });
  const spec = NPC_TYPES[npc.type];
  const rear = spec.len / 2;

  let body;
  if (npc.type === 'bus') {
    body = (
      <>
        <mesh position={[0, 1.65, 0]} castShadow>
          <boxGeometry args={[2.5, 2.7, 9]} />
          <meshStandardMaterial color="#c1121f" roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.1, 0]}>
          <boxGeometry args={[2.54, 0.9, 8.4]} />
          <meshStandardMaterial color="#1b263b" roughness={0.2} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[2.54, 0.25, 9.02]} />
          <meshStandardMaterial color="#f1faee" />
        </mesh>
        {[-3.2, 3.2].map((z) => (
          <group key={z}>
            <Wheel position={[-1.15, 0.5, z]} r={0.5} />
            <Wheel position={[1.15, 0.5, z]} r={0.5} />
          </group>
        ))}
      </>
    );
  } else if (npc.type === 'rickshaw') {
    body = (
      <>
        <mesh position={[0, 0.75, 0.1]} castShadow>
          <boxGeometry args={[1.35, 0.8, 2.4]} />
          <meshStandardMaterial color="#2a9d4a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.55, 0.2]} castShadow>
          <boxGeometry args={[1.4, 0.12, 2.2]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, 1.15, 1.25]}>
          <boxGeometry args={[1.3, 0.8, 0.05]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, 0.95, -0.9]}>
          <boxGeometry args={[1.37, 0.12, 0.6]} />
          <meshStandardMaterial color="#ffd166" />
        </mesh>
        <Wheel position={[0, 0.28, -1.05]} r={0.28} w={0.18} />
        <Wheel position={[-0.62, 0.28, 0.85]} r={0.28} w={0.18} />
        <Wheel position={[0.62, 0.28, 0.85]} r={0.28} w={0.18} />
      </>
    );
  } else if (npc.type === 'ambulance') {
    body = (
      <>
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[2, 1.9, 5.2]} />
          <meshStandardMaterial color="#f8f9fa" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[2.02, 0.25, 5.22]} />
          <meshStandardMaterial color="#d62828" />
        </mesh>
        <mesh position={[0, 1.6, -2.0]}>
          <boxGeometry args={[1.9, 0.6, 1.2]} />
          <meshStandardMaterial color="#1b263b" roughness={0.15} metalness={0.5} />
        </mesh>
        <mesh position={[-0.45, 2.22, -1.6]} material={beacon[0]}>
          <boxGeometry args={[0.7, 0.18, 0.35]} />
        </mesh>
        <mesh position={[0.45, 2.22, -1.6]} material={beacon[1]}>
          <boxGeometry args={[0.7, 0.18, 0.35]} />
        </mesh>
        <mesh position={[0, 1.4, 2.61]} material={cross}>
          <planeGeometry args={[1.3, 1.3]} />
        </mesh>
        {[-1.7, 1.7].map((z) => (
          <group key={z}>
            <Wheel position={[-0.95, 0.38, z]} r={0.38} />
            <Wheel position={[0.95, 0.38, z]} r={0.38} />
          </group>
        ))}
      </>
    );
  } else if (npc.type === 'bike') {
    // Coming toward the player, so it faces +z
    body = (
      <group rotation-y={Math.PI}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.3, 0.35, 1.5]} />
          <meshStandardMaterial color="#9d0208" />
        </mesh>
        <Wheel position={[0, 0.32, -0.7]} r={0.32} w={0.12} />
        <Wheel position={[0, 0.32, 0.7]} r={0.32} w={0.12} />
        <mesh position={[0, 1.15, 0.1]} castShadow>
          <cylinderGeometry args={[0.2, 0.24, 0.8, 10]} />
          <meshStandardMaterial color="#457b9d" />
        </mesh>
        <mesh position={[0, 1.7, 0.05]} castShadow>
          <sphereGeometry args={[0.19, 12, 10]} />
          <meshStandardMaterial color="#a0704f" />
        </mesh>
        <mesh position={[0, 0.85, -0.8]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <meshStandardMaterial color="#fff" emissive="#fff6c4" emissiveIntensity={3} />
        </mesh>
      </group>
    );
  } else if (npc.type === 'cart') {
    body = (
      <>
        {/* donkey in front (-z), cart behind */}
        <mesh position={[0, 0.95, -1.25]} castShadow>
          <boxGeometry args={[0.5, 0.55, 1.1]} />
          <meshStandardMaterial color="#8d7966" />
        </mesh>
        <mesh position={[0, 1.35, -1.85]} rotation-x={0.5} castShadow>
          <boxGeometry args={[0.28, 0.32, 0.55]} />
          <meshStandardMaterial color="#7a6855" />
        </mesh>
        <group ref={legs} position={[0, 0.65, -1.25]}>
          {[-0.4, 0.4].map((z) => (
            <mesh key={z} position={[0, -0.3, z]}>
              <boxGeometry args={[0.4, 0.6, 0.1]} />
              <meshStandardMaterial color="#5e503f" />
            </mesh>
          ))}
        </group>
        <mesh position={[0, 0.85, 0.55]} castShadow>
          <boxGeometry args={[1.4, 0.35, 1.8]} />
          <meshStandardMaterial color="#a0522d" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.15, 0.6]}>
          <boxGeometry args={[1.2, 0.3, 1.4]} />
          <meshStandardMaterial color="#e9c46a" roughness={1} />
        </mesh>
        <Wheel position={[-0.75, 0.5, 0.55]} r={0.5} w={0.1} />
        <Wheel position={[0.75, 0.5, 0.55]} r={0.5} w={0.1} />
      </>
    );
  } else {
    body = (
      <>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[1.8, 0.7, 4.2]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.3} />
        </mesh>
        <mesh position={[0, 1.18, 0.2]} castShadow>
          <boxGeometry args={[1.6, 0.55, 2.2]} />
          <meshStandardMaterial color="#1b263b" roughness={0.15} metalness={0.5} />
        </mesh>
        {[-1.35, 1.35].map((z) => (
          <group key={z}>
            <Wheel position={[-0.85, 0.34, z]} />
            <Wheel position={[0.85, 0.34, z]} />
          </group>
        ))}
      </>
    );
  }
  return (
    <group ref={ref} visible={false}>
      {body}
      {/* tail lights face the player (who is behind, at +z) */}
      {npc.type !== 'bike' && npc.type !== 'cart' && (
        <>
          <mesh position={[-spec.w / 2 + 0.25, npc.type === 'bus' ? 1.1 : 0.75, rear + 0.01]} material={tail}>
            <boxGeometry args={[0.35, 0.18, 0.04]} />
          </mesh>
          <mesh position={[spec.w / 2 - 0.25, npc.type === 'bus' ? 1.1 : 0.75, rear + 0.01]} material={tail}>
            <boxGeometry args={[0.35, 0.18, 0.04]} />
          </mesh>
        </>
      )}
    </group>
  );
}

const KURTAS = ['#e76f51', '#2a9d8f', '#e9c46a', '#8338ec', '#f4a261', '#3a86ff', '#ff006e', '#6d597a'];
function Pedestrian({ ped }) {
  const ref = useRef();
  const legL = useRef();
  const legR = useRef();
  const color = KURTAS[ped.id % KURTAS.length];
  useFrame(() => {
    const g = ref.current;
    g.visible = ped.active && ped.delay <= 0;
    if (!g.visible) return;
    g.position.set(ped.x, ped.hit ? 0.25 : 0, zOf(ped.s));
    g.rotation.set(0, ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2, ped.hit ? Math.PI / 2 : 0);
    const swing = ped.hit ? 0 : Math.sin(ped.phase) * 0.5;
    legL.current.rotation.x = swing;
    legR.current.rotation.x = -swing;
  });
  return (
    <group ref={ref} visible={false}>
      <group ref={legL} position={[-0.12, 0.85, 0]}>
        <mesh position={[0, -0.42, 0]}>
          <boxGeometry args={[0.16, 0.85, 0.16]} />
          <meshStandardMaterial color="#e9e4d8" />
        </mesh>
      </group>
      <group ref={legR} position={[0.12, 0.85, 0]}>
        <mesh position={[0, -0.42, 0]}>
          <boxGeometry args={[0.16, 0.85, 0.16]} />
          <meshStandardMaterial color="#e9e4d8" />
        </mesh>
      </group>
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 0.95, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.88, 0]} castShadow>
        <sphereGeometry args={[0.2, 14, 12]} />
        <meshStandardMaterial color="#a0704f" />
      </mesh>
    </group>
  );
}

