import * as THREE from "three";

// ── World layout (shared by the director, the scene, and the camera rig) ──
export const CORRIDOR_HALF = 6.2; // corridor half-width
export const CORRIDOR_DEPTH = 14; // from camera start to back wall (extended)
export const DOOR_SPACING = 1.86;
export const DOOR_START_X = -4.65;
// Doors at varying depths for natural corridor perspective
export const DOOR_X = Array.from({ length: 6 }, (_, i) => DOOR_START_X + i * DOOR_SPACING);
export const DOOR_Z = Array.from({ length: 6 }, (_, i) => {
  // Stagger doors: left side slightly forward, right side slightly back
  if (i < 3) return -0.5 + i * 0.3; // NODE 01-03: -0.5, -0.2, 0.1
  return 0.8 + (i - 3) * 0.4;       // NODE 04-06: 0.8, 1.2, 1.6
});
export const DOOR_WIDTH = 1.24;
export const DOOR_HEIGHT = 2.34;
export const DOOR_FRAME_THICK = 0.16;
export const DOOR_LEAF_THICK = 0.12;
export const CAM_Y = 1.58;

// camera pathway per door (uses individual door Z)
export const approachPos = (i: number) => ({ x: DOOR_X[i] * 0.45, y: CAM_Y, z: 2.35 });
export const approachLook = (i: number) => ({ x: DOOR_X[i], y: 1.32, z: DOOR_Z[i] - 0.5 });
export const enterPosEnd = (i: number) => ({ x: DOOR_X[i], y: CAM_Y * 0.96, z: DOOR_Z[i] - 2.8 });
export const enterLookEnd = (i: number) => ({ x: DOOR_X[i], y: 1.18, z: DOOR_Z[i] - 3.6 });

export type Vec3 = { x: number; y: number; z: number };

export const v = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);

// ── Stages ──────────────────────────────────────────────────────
export type Stage =
  | "idle"
  | "approach"
  | "scan"
  | "denied"
  | "override"
  | "unlock"
  | "release"
  | "preshape"
  | "opening"
  | "hold"
  | "enter"
  | "slam"
  | "done";

export type DoorFx = {
  rotationY: number; // open angle (radians), positive = inward
  interiorGlow: number; // inner room light 0..1
  breachGlow: number; // sustained glow once breached 0..1
  lampLevel: number; // 0 red · 1 amber · 2 green
  boltOut: [number, number, number, number]; // 0 seated · 1 retracted
  beamY: number; // scan beam position -1..1
  scanOn: boolean;
  shake: number; // per-door mechanical shake 0..1
  fogEscape: number; // fog spilling out of this door 0..1
  burstTick: number; // increments to trigger a spark burst
  burstPoint: Vec3; // last burst origin (door-local)
};

export type FxStore = {
  stage: Stage;
  doorIndex: number;
  engaged: boolean; // a sequence is running (input disabled)
  hovered: number; // -1 none
  doors: DoorFx[];
  camPos: Vec3;
  camLook: Vec3;
  camBias: Vec3; // hover-based micro camera offset
  shake: number; // global camera shake 0..1
  fogOpacity: number; // global fog volume 0..1
  blackout: number; // 0..1 blackness overlay
  redFlash: number; // 0..1 decaying red warning flash
  glitch: number; // 0..1 glitch intensity (DOM overlay)
  roomDark: number; // darkness ramp while entering 0..1
  progress: number; // 0..100 system progress for the HUD bar
};

const freshDoor = (): DoorFx => ({
  rotationY: 0,
  interiorGlow: 0,
  breachGlow: 0,
  lampLevel: 0,
  boltOut: [0, 0, 0, 0],
  beamY: -1,
  scanOn: false,
  shake: 0,
  fogEscape: 0,
  burstTick: 0,
  burstPoint: { x: 0, y: 1, z: 0.1 },
});

export function makeStore(breached: boolean[]): FxStore {
  return {
    stage: "idle",
    doorIndex: -1,
    engaged: false,
    hovered: -1,
    doors: breached.map((b) => {
      const d = freshDoor();
      if (b) {
        d.rotationY = 1.5;
        d.interiorGlow = 1;
        d.breachGlow = 1;
        d.lampLevel = 2;
        d.boltOut = [1, 1, 1, 1];
      }
      return d;
    }),
    camPos: { x: 0, y: CAM_Y, z: 6.6 },
    camLook: { x: 0, y: 1.32, z: 0 },
    camBias: { x: 0, y: 0, z: 0 },
    shake: 0,
    fogOpacity: 0,
    blackout: 0,
    redFlash: 0,
    glitch: 0,
    roomDark: 0,
    progress: 0,
  };
}

// ── Easing ──────────────────────────────────────────────────────
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInQuad = (t: number) => t * t;
export const easeOutQuad = (t: number) => t * (2 - t);

// "heavy door" opening curve: very slow start, hard mid acceleration,
// then deceleration as it swings to rest. Time-based so it feels physical.
export const heavyOpenCurve = (t: number) => {
  const T = clamp01(t);
  // slow start (first 25%: barely crawls), fast swing (25–75%), heavy settle (>75%)
  if (T < 0.25) return 0.055 * easeOutCubic(T / 0.25);
  if (T < 0.78) {
    const u = (T - 0.25) / 0.53;
    return 0.055 + 0.88 * easeInOutCubic(u);
  }
  const u = (T - 0.78) / 0.22;
  return 0.935 + 0.065 * (1 - Math.pow(1 - u, 3));
};

export function lerpV3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

export function catmull(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z: 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
}

// procedural scratch/wear canvas texture for the doors
export function makeMetalTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0, 0, 512, 512);
  // subtle vertical brushed-metal streaks
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512;
    const y0 = Math.random() * 512;
    const len = 40 + Math.random() * 200;
    ctx.strokeStyle = `rgba(${30 + Math.random() * 40},${28 + Math.random() * 30},${24 + Math.random() * 20},${0.04 + Math.random() * 0.08})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, Math.min(512, y0 + len));
    ctx.stroke();
  }
  // scratches
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 512);
    ctx.lineTo(Math.random() * 512, Math.random() * 512);
    ctx.stroke();
  }
  // worn patches (bottom-heavy)
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "rgba(255,255,255,0.02)");
  grad.addColorStop(0.72, "rgba(255,255,255,0.03)");
  grad.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 2);
  t.anisotropy = 4;
  return t;
}

// riveted "NODE nn" identification plate for each bunker door
export function makePlateTexture(node: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  // brushed plate
  ctx.fillStyle = "#241f18";
  ctx.fillRect(0, 0, 256, 64);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(255,255,255,0.10)");
  g.addColorStop(0.5, "rgba(255,255,255,0.02)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 64);
  // rivets
  ctx.fillStyle = "#4a4438";
  [[10, 10], [10, 54], [246, 10], [246, 54]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  });
  // amber border
  ctx.strokeStyle = "rgba(255,180,84,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, 250, 58);
  // stencilled designation
  ctx.fillStyle = "#e8b877";
  ctx.font = "700 26px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = String(node + 1).padStart(2, "0");
  ctx.fillText("NODE", 78, 31);
  ctx.fillText(label, 178, 31);
  ctx.strokeStyle = "rgba(255,180,84,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(118, 14);
  ctx.lineTo(118, 50);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}