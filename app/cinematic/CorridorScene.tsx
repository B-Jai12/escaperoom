import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import MechanicalDoor from "./MechanicalDoor";
import { FxStore, DOOR_X, DOOR_Z, DOOR_HEIGHT, DOOR_WIDTH, CORRIDOR_HALF, CAM_Y } from "./engine";

const BACK_WALL_Z = -7.5;
const CORRIDOR_TOTAL_LEN = 28;

// Procedural textures for corridor
function makeCorridorWallTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#221e19";
  ctx.fillRect(0, 0, 512, 512);

  // vertical seams
  for (let i = 0; i <= 512; i += 128) {
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
  }
  // horizontal bands
  for (let i = 0; i <= 512; i += 96) {
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  // stains and industrial weathering
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 10 + Math.random() * 45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${30 + Math.random() * 30},${22 + Math.random() * 20},${15 + Math.random() * 15},${0.12 + Math.random() * 0.25})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // scratches
  for (let i = 0; i < 45; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.2})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 512);
    for (let k = 0; k < 5; k++) {
      ctx.lineTo(Math.random() * 512, Math.random() * 512);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.anisotropy = 4;
  return t;
}

function makeCeilingTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#12100e";
  ctx.fillRect(0, 0, 512, 512);

  // panel grid
  ctx.strokeStyle = "rgba(60,52,40,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  // subtle variation
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 20 + Math.random() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${15 + Math.random() * 20},${12 + Math.random() * 15},${8 + Math.random() * 10},${0.08 + Math.random() * 0.12})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 4);
  t.anisotropy = 4;
  return t;
}

function makePipeTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#383532";
  ctx.fillRect(0, 0, 256, 256);
  // circumferential highlights
  for (let i = 0; i < 8; i++) {
    const y = i * 32 + 16;
    const g = ctx.createLinearGradient(0, y - 16, 0, y + 16);
    g.addColorStop(0, "rgba(80,75,65,0.3)");
    g.addColorStop(0.5, "rgba(40,38,34,0.5)");
    g.addColorStop(1, "rgba(80,75,65,0.3)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 16, 256, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 4);
  t.anisotropy = 4;
  return t;
}

function makeVentTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#221d18";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#38322b";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(16, 16 + i * 12);
    ctx.lineTo(112, 16 + i * 12);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function makeFloorTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#26211c";
  ctx.fillRect(0, 0, 512, 512);

  // floor tile plates
  ctx.strokeStyle = "rgba(10,8,6,0.6)";
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  // diamond tread / grid dots
  ctx.fillStyle = "rgba(214,154,69,0.06)";
  for (let x = 8; x < 512; x += 16) {
    for (let y = 8; y < 512; y += 16) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
  // surface scuffs
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(180,150,110,${0.03 + Math.random() * 0.05})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 512);
    ctx.lineTo(Math.random() * 512, Math.random() * 512);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 12);
  t.anisotropy = 4;
  return t;
}

// Emergency red light with realistic random flicker
function FlickerLight({ position, color, baseIntensity }: { position: [number, number, number]; color: string; baseIntensity: number }) {
  const light = useRef<THREE.PointLight>(null!);
  const state = useRef({ next: 0, cur: baseIntensity });
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.getElapsedTime();
    if (t > state.current.next) {
      const flicker = Math.random() > 0.85;
      state.current.cur = flicker
        ? baseIntensity * (0.15 + Math.random() * 0.3)
        : baseIntensity * (0.75 + Math.random() * 0.35);
      state.current.next = t + 0.05 + Math.random() * 0.4;
    }
    light.current.intensity = THREE.MathUtils.damp(light.current.intensity, state.current.cur, 12, 0.016);
  });
  return <pointLight ref={light} position={position} intensity={baseIntensity} distance={7} color={color} decay={2} />;
}

// Camera rig with organic sway and shake
function CameraRig({ fx }: { fx: FxStore }) {
  const { camera } = useThree();
  const biasRef = useRef({ x: 0, y: 0 });

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();

    if (!fx.engaged) {
      const hovered = fx.hovered;
      fx.camPos.y = CAM_Y + Math.sin(t * 0.85) * 0.008;
      const lookTargetX = hovered >= 0 ? DOOR_X[hovered] * 0.28 : 0;
      biasRef.current.x = THREE.MathUtils.damp(biasRef.current.x, lookTargetX, 2.5, dt);
      fx.camBias.x = biasRef.current.x;
    } else {
      fx.camBias.x = THREE.MathUtils.damp(fx.camBias.x, 0, 4, dt);
    }

    const shake = fx.shake;
    const ox = (Math.random() - 0.5) * 0.22 * shake;
    const oy = (Math.random() - 0.5) * 0.18 * shake;
    const oz = (Math.random() - 0.5) * 0.12 * shake;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, fx.camPos.x + fx.camBias.x + ox, 7, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, fx.camPos.y + oy, 7, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, fx.camPos.z + oz, 7, dt);

    camera.lookAt(fx.camLook.x, fx.camLook.y, fx.camLook.z);
  });

  return null;
}

// Spark burst
const MAX_PARTICLES = 220;
function SparkBurst({ fx, doorX, doorIdx }: { fx: FxStore; doorX: number; doorIdx: number }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const lastTick = useRef(-1);
  const geom = useMemo(() => new THREE.BufferGeometry(), []);
  const particles = useMemo(() => {
    const arr = new Float32Array(MAX_PARTICLES * 3);
    const pos = new THREE.BufferAttribute(arr, 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute("position", pos);
    return {
      pos,
      data: Array.from({ length: MAX_PARTICLES }, () => ({
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 0.3, on: false,
      })),
    };
  }, [geom]);

  useFrame((_, dt) => {
    const { pos, data } = particles;
    const arr = pos.array as Float32Array;
    const burst = fx.doors[doorIdx]?.burstTick ?? 0;

    if (burst !== lastTick.current) {
      lastTick.current = burst;
      let spawned = 0;
      for (let i = 0; i < MAX_PARTICLES && spawned < 16; i++) {
        const p = data[i];
        if (p.on) continue;
        p.on = true;
        p.x = (Math.random() - 0.5) * 0.06;
        p.y = (Math.random() - 0.5) * 0.06 + 0.06;
        p.z = 0.2;
        p.vx = (Math.random() - 0.5) * 1.6;
        p.vy = Math.random() * 1.9 + 0.4;
        p.vz = (Math.random() - 0.5) * 0.8;
        p.max = 0.4 + Math.random() * 0.5;
        p.life = p.max;
        spawned++;
      }
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = data[i];
      if (!p.on) {
        arr[i * 3] = arr[i * 3 + 1] = arr[i * 3 + 2] = -99;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.on = false;
        arr[i * 3] = arr[i * 3 + 1] = arr[i * 3 + 2] = -99;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 3.2 * dt;
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    pos.needsUpdate = true;
  });

  return (
    <group position={[doorX, DOOR_HEIGHT / 2, DOOR_Z[doorIdx] + 0.1]}>
      <points ref={pointsRef} geometry={geom}>
        <pointsMaterial color="#ffb454" size={0.03} transparent opacity={0.9} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}

// Floating atmospheric dust
function Dust() {
  const seed = useMemo(
    () =>
      Array.from({ length: 110 }, () => ({
        x: (Math.random() - 0.5) * 11,
        y: 0.2 + Math.random() * 2.5,
        z: -6.5 + Math.random() * 15,
        sway: Math.random() * Math.PI * 2,
        spd: 0.25 + Math.random() * 0.4,
        drift: 0.4 + Math.random() * 1.1,
      })),
    []
  );
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(seed.length * 3);
    seed.forEach((s, i) => {
      arr[i * 3] = s.x;
      arr[i * 3 + 1] = s.y;
      arr[i * 3 + 2] = s.z;
    });
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, [seed]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const arr = geom.attributes.position.array as Float32Array;
    for (let i = 0; i < seed.length; i++) {
      const s = seed[i];
      let z = s.z + t * s.drift;
      if (z > 9.0) z = -6.5;
      arr[i * 3] = s.x + Math.sin(t * s.spd + s.sway) * 0.18;
      arr[i * 3 + 1] = s.y + Math.sin(t * s.spd * 1.7 + s.sway * 2) * 0.1;
      arr[i * 3 + 2] = z;
    }
    geom.attributes.position.needsUpdate = true;
  });

  return (
    <points geometry={geom}>
      <pointsMaterial color="#ffd49c" size={0.022} transparent opacity={0.55} depthWrite={false} sizeAttenuation />
    </points>
  );
}

// Interior light per door - wakes as the door opens
function InteriorLight({ x, doorIdx, fx, breached }: { x: number; doorIdx: number; fx: FxStore; breached: boolean }) {
  const light = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    if (!light.current) return;
    const g = Math.max(fx.doors[doorIdx]?.interiorGlow ?? 0, breached ? 1 : 0);
    light.current.intensity = THREE.MathUtils.damp(light.current.intensity, g * 8, 3, 0.05);
  });
  return <pointLight ref={light} position={[x, 1.3, DOOR_Z[doorIdx] - 1.5]} intensity={0} distance={6} color="#ffd49c" decay={1.6} />;
}

// Ground-hugging smoke / fog layer
function FogLayer() {
  const smTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    g.addColorStop(0, "rgba(255,230,190,0.18)");
    g.addColorStop(0.5, "rgba(180,160,130,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  return (
    <group position={[0, 0.18, 1.0]}>
      {[-4, 0, 4].map((x, xi) =>
        [-3, 1, 5].map((z, zi) => (
          <mesh key={`${xi}-${zi}`} position={[x + (zi % 2) * 0.5, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.2, 3.2]} />
            <meshBasicMaterial map={smTex} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
          </mesh>
        ))
      )}
    </group>
  );
}

type Props = {
  round?: 1 | 2 | 3;
  fx: FxStore;
  breached: boolean[];
  onPick: (index: number) => void;
  onHover: (index: number) => void;
  onUnhover: (index: number) => void;
};

export default function CorridorScene({ round = 1, fx, breached, onPick, onHover, onUnhover }: Props) {
  const isRound2 = round === 2;
  const isRound3 = round === 3;
  const lightColorPrimary = isRound3 ? "#ff5533" : isRound2 ? "#4db8ff" : "#ffbe6a";
  const lightColorSecondary = isRound3 ? "#ff8844" : isRound2 ? "#70d2ff" : "#ffc67a";
  const deepFillColor = isRound3 ? "#801200" : isRound2 ? "#003b66" : "#356685";
  const fogColor = isRound3 ? "#100604" : isRound2 ? "#040910" : "#080a0d";
  const floorTex = useMemo(() => makeFloorTexture(), []);
  const wallTex = useMemo(() => makeCorridorWallTexture(), []);
  const ceilingTex = useMemo(() => makeCeilingTexture(), []);
  const pipeTex = useMemo(() => makePipeTexture(), []);
  const ventTex = useMemo(() => makeVentTexture(), []);

  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: wallTex,
        color: "#28231c",
        roughness: 0.85,
        metalness: 0.18,
      }),
    [wallTex]
  );
  const ceilingMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: ceilingTex,
        color: "#181512",
        roughness: 0.88,
        metalness: 0.1,
      }),
    [ceilingTex]
  );
  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: floorTex,
        color: "#746755",
        roughness: 0.62,
        metalness: 0.18,
      }),
    [floorTex]
  );
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#060504", roughness: 0.9, metalness: 0.1 }), []);
  const pipeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: pipeTex,
        color: "#403c37",
        roughness: 0.52,
        metalness: 0.65,
      }),
    [pipeTex]
  );
  const ventMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: ventTex,
        color: "#302b25",
        roughness: 0.8,
        metalness: 0.3,
      }),
    [ventTex]
  );
  const pillarMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#24211c",
        roughness: 0.75,
        metalness: 0.35,
      }),
    []
  );

  return (
    <>
      {/* Crisp foreground, moody atmospheric depth */}
      <fog attach="fog" args={[fogColor, 7.5, 24]} />

      {/* Ambient & Key directional lighting */}
      <ambientLight intensity={0.42} color="#607282" />
      <directionalLight position={[0, 6, 9]} intensity={0.8} color="#eaf2f8" castShadow />

      {/* Primary overhead warm light pools along corridor */}
      <pointLight position={[-2.2, 2.7, 5]} intensity={4.5} distance={10} color={lightColorPrimary} />
      <pointLight position={[2.2, 2.7, 2]} intensity={4.2} distance={9} color={lightColorSecondary} />
      <pointLight position={[-1.5, 2.7, -1]} intensity={4.0} distance={8} color={lightColorPrimary} />
      <pointLight position={[2.5, 2.7, -3.5]} intensity={3.6} distance={8} color="#ffa845" />

      {/* Floor bounce illumination for tangible ground surface */}
      <pointLight position={[-2, 0.4, 3.5]} intensity={1.8} distance={8} color="#c88b32" />
      <pointLight position={[2, 0.4, 0]} intensity={1.5} distance={7} color="#c88b32" />
      <pointLight position={[0, 0.4, -3]} intensity={1.4} distance={7} color="#b07828" />

      {/* Deep end cold/blue contrast fill */}
      <pointLight position={[0, 1.8, -6.5]} intensity={2.2} distance={12} color={deepFillColor} />
      <pointLight position={[0, 2.1, -2]} intensity={0.8} distance={8} color="#2b4e66" />

      {/* Emergency flicker beacons */}
      <FlickerLight position={[-CORRIDOR_HALF + 0.3, 2.4, -3.5]} color="#ff2200" baseIntensity={1.2} />
      <FlickerLight position={[CORRIDOR_HALF - 0.3, 2.4, 2.0]} color="#ff2200" baseIntensity={0.9} />

      {/* Per-door interior reveal lights */}
      {DOOR_X.map((x, i) => (
        <InteriorLight key={i} x={x} doorIdx={i} fx={fx} breached={breached[i]} />
      ))}

      {/* MAIN FLOOR - Encloses camera and entire hallway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[CORRIDOR_HALF * 2, CORRIDOR_TOTAL_LEN]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* CEILING */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 2.9, 0]}>
        <planeGeometry args={[CORRIDOR_HALF * 2, CORRIDOR_TOTAL_LEN]} />
        <primitive object={ceilingMat} attach="material" />
      </mesh>

      {/* SIDE WALLS */}
      <mesh material={wallMat} position={[-CORRIDOR_HALF, 1.45, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[CORRIDOR_TOTAL_LEN, 3.1]} />
      </mesh>
      <mesh material={wallMat} position={[CORRIDOR_HALF, 1.45, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[CORRIDOR_TOTAL_LEN, 3.1]} />
      </mesh>

      {/* BACK WALL */}
      <mesh position={[0, 1.45, BACK_WALL_Z]}>
        <planeGeometry args={[CORRIDOR_HALF * 2 + 1, 3.2]} />
        <meshStandardMaterial color="#1a1714" roughness={0.9} />
      </mesh>

      {/* REAR ENTRANCE WALL (Behind camera at z = 11.5) */}
      <mesh position={[0, 1.45, 11.5]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CORRIDOR_HALF * 2 + 1, 3.2]} />
        <meshStandardMaterial color="#141210" roughness={0.92} />
      </mesh>

      {/* Ceiling vents */}
      <mesh material={ventMat} position={[-2, 2.88, 4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
      </mesh>
      <mesh material={ventMat} position={[2, 2.88, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
      </mesh>
      <mesh material={ventMat} position={[0, 2.88, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
      </mesh>
      <mesh material={ventMat} position={[-3, 2.88, -4.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
      </mesh>

      {/* Wall-mounted junction boxes & status lights */}
      {[-4.5, -1.5, 1.5, 4.5].map((z, i) => (
        <group key={`panel-l${i}`} position={[-CORRIDOR_HALF + 0.02, 1.2, z]} rotation={[0, Math.PI / 2, 0]}>
          <mesh>
            <boxGeometry args={[0.4, 0.3, 0.08]} />
            <meshStandardMaterial color="#28241f" roughness={0.7} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[0.3, 0.2]} />
            <meshStandardMaterial color="#100e0c" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.1, 0.06]}>
            <boxGeometry args={[0.02, 0.02, 0.01]} />
            <meshStandardMaterial color="#ff2a1e" emissive="#ff2a1e" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {[-3.5, -0.5, 2.5, 5.5].map((z, i) => (
        <group key={`panel-r${i}`} position={[CORRIDOR_HALF - 0.02, 1.0, z]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh>
            <boxGeometry args={[0.35, 0.4, 0.08]} />
            <meshStandardMaterial color="#28241f" roughness={0.7} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[0.25, 0.3]} />
            <meshStandardMaterial color="#100e0c" roughness={0.95} />
          </mesh>
          <mesh position={[0, -0.12, 0.06]}>
            <boxGeometry args={[0.03, 0.03, 0.01]} />
            <meshStandardMaterial color="#4a4238" roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Ceiling strip lights */}
      {[-5, -3, -1, 1, 3, 5].map((x, i) => (
        <group key={`light${i}`} position={[x, 2.86, 1 - i * 0.8]}>
          <mesh>
            <boxGeometry args={[0.1, 0.02, 1.2]} />
            <meshStandardMaterial color="#ffe1b8" emissive="#ffb454" emissiveIntensity={1.8} />
          </mesh>
          <pointLight intensity={1.8} distance={4.0} color="#ffb060" />
        </group>
      ))}

      {/* Additional ceiling fixture near each door */}
      {DOOR_X.map((x, i) => (
        <group key={`door-light${i}`} position={[x, 2.86, DOOR_Z[i] + 0.5]}>
          <mesh>
            <boxGeometry args={[0.14, 0.03, 0.45]} />
            <meshStandardMaterial color="#ffe1b8" emissive="#ffb454" emissiveIntensity={2.0} />
          </mesh>
          <pointLight intensity={2.0} distance={3.4} color="#ffb86c" />
        </group>
      ))}

      {/* Architectural support pillars */}
      {[-5.0, -2.5, 0.0, 2.5, 5.0, 7.5].map((z, i) => (
        <group key={`pil${i}`}>
          <mesh material={pillarMat} position={[-CORRIDOR_HALF + 0.2, 1.45, z]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.22, 3.0, 8]} />
          </mesh>
          <mesh material={pillarMat} position={[CORRIDOR_HALF - 0.2, 1.45, z]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.22, 3.0, 8]} />
          </mesh>
          <mesh material={pillarMat} position={[-CORRIDOR_HALF + 0.2, 0.05, z]} receiveShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.1, 8]} />
          </mesh>
          <mesh material={pillarMat} position={[CORRIDOR_HALF - 0.2, 0.05, z]} receiveShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.1, 8]} />
          </mesh>
        </group>
      ))}

      {/* Cable conduits along ceiling */}
      {[-CORRIDOR_HALF + 0.4, CORRIDOR_HALF - 0.4].map((x, i) => (
        <group key={`cable${i}`}>
          {[-4.5, -2, 0.5, 3, 5.5].map((z, k) => (
            <mesh key={k} material={darkMat} position={[x, 2.82, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 2.5, 8]} />
            </mesh>
          ))}
          <mesh material={darkMat} position={[x, 2.82, -0.2]}>
            <boxGeometry args={[0.1, 0.1, 0.08]} />
          </mesh>
        </group>
      ))}

      {/* The six mechanical doors */}
      {DOOR_X.map((x, i) => (
        <group key={`doorwrap${i}`}>
          <MechanicalDoor
            index={i}
            doorNumber={(round - 1) * 6 + i + 1}
            x={x}
            fx={fx}
            onPick={onPick}
            onHover={onHover}
            onUnhover={onUnhover}
          />
          <SparkBurst fx={fx} doorX={x} doorIdx={i} />
          {/* Door floor track */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, DOOR_Z[i] + 0.1]} receiveShadow>
            <planeGeometry args={[DOOR_WIDTH + 0.24, 0.16]} />
            <meshStandardMaterial color="#221e1a" roughness={0.75} metalness={0.5} />
          </mesh>
          {/* Entrance grate */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, DOOR_Z[i] + 0.55]} receiveShadow>
            <planeGeometry args={[DOOR_WIDTH * 1.3, 0.65]} />
            <meshStandardMaterial color="#181512" roughness={0.88} metalness={0.35} transparent opacity={0.92} />
          </mesh>
        </group>
      ))}

      {/* Emergency lights along corridor */}
      {[-4.5, -1.5, 1.5, 4.5].map((z, i) => (
        <group key={`emerg${i}`} position={[-CORRIDOR_HALF + 0.3, 2.65, z]}>
          <mesh>
            <boxGeometry args={[0.15, 0.08, 0.12]} />
            <meshStandardMaterial color="#221d18" roughness={0.8} metalness={0.3} />
          </mesh>
          <mesh position={[0, -0.04, 0.07]}>
            <boxGeometry args={[0.1, 0.03, 0.02]} />
            <meshStandardMaterial color="#ff2a1e" emissive="#ff2a1e" emissiveIntensity={0.6} />
          </mesh>
          <pointLight position={[0, -0.1, 0.12]} intensity={1.6} distance={5} color="#ff2200" decay={2} />
        </group>
      ))}

      {/* Floating dust */}
      <Dust />

      {/* Ground smoke / fog layer */}
      <FogLayer />

      <CameraRig fx={fx} />
    </>
  );
}