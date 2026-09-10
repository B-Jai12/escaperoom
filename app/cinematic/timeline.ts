import {
  FxStore,
  Stage,
  Vec3,
  easeInOutCubic,
  easeOutCubic,
  heavyOpenCurve,
  lerp,
  lerpV3,
  catmull,
  approachPos,
  approachLook,
  enterPosEnd,
  enterLookEnd,
  DOOR_X,
  DOOR_WIDTH,
  DOOR_HEIGHT,
} from "./engine";

// ── Full choreography (ms) — compressed to ~8s for per-door pacing ──
const T_APPROACH = 700;
const T_SCAN = 1800;
const T_DENIED = 2100;
const T_OVERRIDE = 2500;
const T_LOCK_1 = 2500;
const T_LOCK_2 = 2800;
const T_LOCK_3 = 3100;
const T_LOCK_4 = 3400;
const T_UNLOCK = 3500;
const T_RELEASE = 3700;
const T_PRESHAPE = 4100;
const T_OPENING = 5800;
const T_HOLD = 6200;
const T_ENTER = 7000;
const T_SLAM = 7400;
const T_DONE = 7700;

const MAX_OPEN = 1.5;

const BOLT_POINTS: Vec3[] = [
  { x: -0.05, y: DOOR_HEIGHT / 2 - 0.22, z: 0.1 },
  { x: -0.5, y: -DOOR_HEIGHT / 2 + 0.24, z: 0.1 },
  { x: DOOR_WIDTH / 2 - 0.06, y: 0.0, z: 0.1 },
  { x: DOOR_WIDTH / 2 - 0.06, y: DOOR_HEIGHT / 2 - 0.4, z: 0.1 },
];

const idleCam = { x: 0, y: 1.58, z: 6.6 };
const idleLook = { x: 0, y: 1.32, z: 0 };

export function stageAt(clock: number): Stage {
  if (clock < T_APPROACH) return "approach";
  if (clock < T_SCAN) return "scan";
  if (clock < T_DENIED) return "denied";
  if (clock < T_OVERRIDE) return "override";
  if (clock < T_UNLOCK) return "unlock";
  if (clock < T_RELEASE) return "release";
  if (clock < T_PRESHAPE) return "preshape";
  if (clock < T_OPENING) return "opening";
  if (clock < T_HOLD) return "hold";
  if (clock < T_ENTER) return "enter";
  if (clock < T_SLAM) return "slam";
  return "done";
}

export function locksReleasedAt(clock: number): number {
  let n = 0;
  if (clock > T_LOCK_1) n = 1;
  if (clock > T_LOCK_2) n = 2;
  if (clock > T_LOCK_3) n = 3;
  if (clock > T_LOCK_4) n = 4;
  return n;
}

export function directorTick(fx: FxStore, clock: number, doorIdx: number, dt: number) {
  const door = fx.doors[doorIdx];
  const stage = stageAt(clock);
  const t = clock;

  fx.stage = stage;

  // ── decayable global values ──
  fx.shake *= Math.pow(0.0016, dt / 1000);
  fx.redFlash *= Math.pow(0.0006, dt / 1000);
  fx.glitch *= Math.pow(0.02, dt / 1000);

  const setBolt = (n: number) => (door.boltOut = [n > 0 ? 1 : 0, n > 1 ? 1 : 0, n > 2 ? 1 : 0, n > 3 ? 1 : 0]);
  const burstAt = (boltIdx: number, point?: Vec3) => {
    door.burstTick++;
    door.burstPoint = point ?? BOLT_POINTS[boltIdx % BOLT_POINTS.length];
  };

  switch (stage) {
    case "approach": {
      const p = easeInOutCubic(Math.min(1, t / T_APPROACH));
      fx.camPos = lerpV3(idleCam, approachPos(doorIdx), p);
      fx.camLook = lerpV3(idleLook, approachLook(doorIdx), p);
      break;
    }
    case "scan": {
      const lt = t - T_APPROACH;
      const span = 1000;
      const cyc = (lt % span) / span;
      const y = cyc < 0.5 ? -1 + (cyc / 0.5) * 2 : 1 - ((cyc - 0.5) / 0.5) * 2;
      door.beamY = y;
      door.scanOn = true;
      door.lampLevel = 0;
      break;
    }
    case "denied": {
      door.scanOn = false;
      door.lampLevel = 0;
      fx.redFlash = 1;
      fx.glitch = 0.9;
      fx.shake = Math.max(fx.shake, 0.15);
      break;
    }
    case "override": {
      door.lampLevel = 1;
      fx.glitch = Math.max(fx.glitch, 0.25);
      break;
    }
    case "unlock": {
      const n = locksReleasedAt(t);
      setBolt(n);
      door.lampLevel = n >= 3 ? 1 : 0.5;
      const clicks = [
        { at: T_LOCK_1, idx: 0 },
        { at: T_LOCK_2, idx: 1 },
        { at: T_LOCK_3, idx: 2 },
        { at: T_LOCK_4, idx: 3 },
      ];
      for (const c of clicks) {
        if (t >= c.at && t - dt * 0.5 < c.at) {
          burstAt(c.idx);
          fx.shake = Math.max(fx.shake, 0.12);
        }
      }
      break;
    }
    case "release": {
      door.boltOut = [1, 1, 1, 1];
      door.lampLevel = 1;
      break;
    }
    case "preshape": {
      const lt = t - T_PRESHAPE;
      const p = Math.min(1, lt / (T_OPENING - T_PRESHAPE));
      door.shake = 0.4;
      fx.shake = Math.max(fx.shake, 0.06);
      door.interiorGlow = Math.max(door.interiorGlow, p * 0.28);
      door.fogEscape = Math.max(door.fogEscape, p * 0.3);
      door.rotationY = 0.015;
      break;
    }
    case "opening": {
      const lt = t - T_PRESHAPE;
      const dur = T_OPENING - T_PRESHAPE;
      const p = heavyOpenCurve(lt / dur);
      door.rotationY = p * MAX_OPEN;
      door.shake = p < 0.3 ? 0.35 : Math.max(0, 0.25 - p * 0.3);
      door.interiorGlow = Math.min(1, p * 1.5);
      door.fogEscape = Math.min(1, 0.3 + p * 0.8);
      door.lampLevel = 2;
      const back = 0.35 * easeInOutCubic(p);
      fx.camPos = lerpV3(approachPos(doorIdx), { ...approachPos(doorIdx), z: approachPos(doorIdx).z + back }, p);
      break;
    }
    case "hold": {
      door.shake = 0;
      door.interiorGlow = 1;
      door.fogEscape = 1;
      door.lampLevel = 2;
      break;
    }
    case "enter": {
      const lt = t - T_HOLD;
      const dur = T_ENTER - T_HOLD;
      const p = easeInOutCubic(Math.min(1, lt / dur));
      const p0 = approachPos(doorIdx);
      const p2 = enterPosEnd(doorIdx);
      const p1 = { x: lerp(p0.x, p2.x, 0.28), y: p0.y, z: lerp(p0.z, p2.z, 0.32) };
      const p3 = { ...p2, x: p2.x + 0.2, z: p2.z + 2.0 };
      fx.camPos = catmull(p0, p1, p2, p3, p);
      fx.camLook = lerpV3(approachLook(doorIdx), enterLookEnd(doorIdx), p);
      fx.roomDark = p > 0.3 ? (p - 0.3) / 0.7 : 0;
      fx.shake = Math.max(fx.shake, 0.05);
      break;
    }
    case "slam": {
      const lt = t - T_ENTER;
      const dur = T_SLAM - T_ENTER;
      const p = Math.min(1, lt / dur);
      door.rotationY = Math.max(0.02, door.rotationY - p * MAX_OPEN);
      door.shake = 1;
      fx.shake = 1;
      fx.camLook = lerpV3(enterLookEnd(doorIdx), { x: DOOR_X[doorIdx], y: 1.55, z: 1.4 }, easeOutCubic(p));
      if (p < 0.25) fx.redFlash = Math.max(fx.redFlash, 0.55);
      fx.blackout = Math.min(1, Math.max(0, (p - 0.55) / 0.45));
      fx.roomDark = 1;
      fx.glitch = Math.max(fx.glitch, 0.4);
      break;
    }
    case "done": {
      fx.blackout = 1;
      break;
    }
    default:
      break;
  }

  door.shake *= Math.pow(0.02, dt / 1000);
  if (door.shake < 0.001) door.shake = 0;
}

export function lockPercentAt(clock: number): number {
  return locksReleasedAt(clock) * 25;
}

export const MAX_OPEN_RAD = MAX_OPEN;
