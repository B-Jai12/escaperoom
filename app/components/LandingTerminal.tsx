"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useSpring } from "framer-motion";
import { clamp01, easeInOutCubic } from "../cinematic/engine";

type Props = {
  onEnter: (teamName: string) => void;
  exiting: boolean;
};

/* ══════════════════════════════════════════════════════════════
   STATE MACHINE
   ══════════════════════════════════════════════════════════════ */
type LandingPhase =
  | "room"
  | "tv_zoom"
  | "tv_focus"
  | "tv_auth"
  | "room_return"
  | "lever_ready"
  | "transition"
  | "done";

const CAM = { tvZoomDur: 1.8, roomReturnDur: 1.4 };

const T = {
  glitch: 0.7, black0: 1.2, black1: 1.7,
  turn0: 1.9, turn1: 3.1, move: 3.15,
  unlock: 3.4, open: 3.7, openFull: 5.0,
  through: 5.1, darkFull: 6.0, done: 6.4,
};

/* ══════════════════════════════════════════════════════════════
   ROOM GEOMETRY
   ══════════════════════════════════════════════════════════════ */
const ROOM = {
  bulbAnchor: { x: -0.35, y: 2.96, z: 1.45 },
  ropeLen: 1.35,
  tableTop: 0.92,
  crt: { x: -0.45, y: 1.18, z: 1.05, w: 0.46, h: 0.35 },
  switchBase: { x: 0.55, y: 1.0, z: 1.32 },
  door: { x: 1.5, y: 1.15, z: -4.45, w: 1.0, h: 2.3 },
  pipes: [
    { x: 0, y: 2.94, z: 1.7 }, { x: 0, y: 2.94, z: 0.9 },
    { x: 0, y: 2.94, z: 0.1 }, { x: 0, y: 2.94, z: -0.7 },
    { x: 0, y: 2.94, z: -1.5 }, { x: 0, y: 2.94, z: -2.3 },
  ],
  cableRuns: [
    { from: [-1.9, 2.98, 2.1] as const, to: [2.4, 2.98, 1.68] as const },
    { from: [-1.9, 2.98, 1.3] as const, to: [2.4, 2.98, 1.04] as const },
    { from: [-1.9, 2.98, 0.5] as const, to: [2.4, 2.98, 0.4] as const },
    { from: [-1.9, 2.98, -0.3] as const, to: [2.4, 2.98, -0.24] as const },
    { from: [-1.9, 2.98, -1.1] as const, to: [2.4, 2.98, -0.88] as const },
    { from: [-1.9, 2.98, -1.9] as const, to: [2.4, 2.98, -1.52] as const },
  ],
};

const CAM_START = { x: 0.0, y: 1.62, z: 6.8 };
const CAM_TV = { x: ROOM.crt.x + 0.05, y: ROOM.crt.y + 0.05, z: ROOM.crt.z + 0.7 };
const CAM_TV_LOOK = { x: ROOM.crt.x, y: ROOM.crt.y, z: ROOM.crt.z };

const now = () => performance.now() / 1000;

/* ══════════════════════════════════════════════════════════════
   TEXTURE FACTORIES
   ══════════════════════════════════════════════════════════════ */
function makeCanvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function mixColor(a: string, b: string, t: number): string {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}
function makeWoodFloor(): THREE.CanvasTexture {
  return makeCanvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#221708"; ctx.fillRect(0, 0, 512, 512);
    for (let p = 0; p < 8; p++) {
      const g = ctx.createLinearGradient(p * 64, 0, p * 64 + 64, 0);
      g.addColorStop(0, mixColor("#3a2a18", "#221707", 0.2));
      g.addColorStop(0.5, "#2c1f11"); g.addColorStop(1, "#1c1307");
      ctx.fillStyle = g; ctx.fillRect(p * 64, 0, 64, 512);
    }
  });
}
function makeConcreteWall(hue: number): THREE.CanvasTexture {
  return makeCanvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = `hsl(${hue},10%,${12}%)`; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 110; i++) {
      ctx.fillStyle = `rgba(${10 + Math.random() * 16},${9 + Math.random() * 12},${8 + Math.random() * 6},${0.03 + Math.random() * 0.1})`;
      ctx.beginPath(); ctx.arc(Math.random() * 512, Math.random() * 512, 6 + Math.random() * 30, 0, Math.PI * 2); ctx.fill();
    }
  });
}
function makeGlow(): THREE.CanvasTexture {
  return makeCanvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, "rgba(255,214,150,1)"); g.addColorStop(0.3, "rgba(255,170,70,0.5)");
    g.addColorStop(0.65, "rgba(255,140,40,0.12)"); g.addColorStop(1, "rgba(255,120,30,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
}
function makeSmoke(): THREE.CanvasTexture {
  return makeCanvasTexture(256, 256, (ctx) => {
    for (let i = 0; i < 80; i++) {
      const g = ctx.createRadialGradient(128, 128, 2, 128, 128, 60 + Math.random() * 70);
      g.addColorStop(0, `rgba(160,150,140,${0.05 + Math.random() * 0.06})`);
      g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    }
  });
}
function makeStripeTex(): THREE.CanvasTexture {
  return makeCanvasTexture(128, 32, (ctx) => {
    for (let x = 0; x < 128; x += 16) { ctx.fillStyle = x % 32 === 0 ? "#c9a24b" : "#151210"; ctx.fillRect(x, 0, 16, 32); }
  });
}
function makeStainedFloor(): THREE.CanvasTexture {
  return makeCanvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#1a140a"; ctx.fillRect(0, 0, 512, 512);
    for (let p = 0; p < 8; p++) {
      const g = ctx.createLinearGradient(p * 64, 0, p * 64 + 64, 0);
      g.addColorStop(0, "#2a1f10"); g.addColorStop(0.5, "#1e160c"); g.addColorStop(1, "#141008");
      ctx.fillStyle = g; ctx.fillRect(p * 64, 0, 64, 512);
    }
  });
}
function makeRustedMetal(): THREE.CanvasTexture {
  return makeCanvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#3a2818"; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 5 + Math.random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${180 + Math.random() * 40},${60 + Math.random() * 50},${20 + Math.random() * 30},${0.15 + Math.random() * 0.2})`);
      g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}
function makeChalkboard(): THREE.CanvasTexture {
  return makeCanvasTexture(512, 384, (ctx) => {
    ctx.fillStyle = "#1a2a1a"; ctx.fillRect(0, 0, 512, 384);
    ctx.fillStyle = "#e8b877"; ctx.font = "bold 20px 'Courier New', monospace";
    ["PERIMETER BREACH TIMELINE", "NODE 03: 02:59 - BREACHED", "OPERATOR: E. VANCE", "STATUS: MISSING"].forEach((l, i) => ctx.fillText(l, 30, 50 + i * 28));
  });
}
function makeMapTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#1a1812"; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#e8b877"; ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillText("FACILITY 07 - PERIMETER MAP", 20, 30);
  });
}
function makeEvidencePhoto(): THREE.CanvasTexture {
  return makeCanvasTexture(240, 300, (ctx) => {
    ctx.fillStyle = "#080808"; ctx.fillRect(0, 0, 240, 300);
    ctx.strokeStyle = "rgba(200,60,40,0.7)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(120, 140, 50, 70, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#c0b8b0"; ctx.font = "italic 10px 'Segoe Print', cursive";
    ctx.fillText("SUBJECT: E. VANCE", 160, 80);
  });
}
function makeVentTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#1a1612"; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#3a3028"; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(16, 16 + i * 12); ctx.lineTo(112, 16 + i * 12); ctx.stroke(); }
  });
}
function makeLabelTex(): THREE.CanvasTexture {
  return makeCanvasTexture(256, 32, (ctx) => {
    ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0, 0, 256, 32);
    ctx.fillStyle = "#e8b877"; ctx.font = "bold 15px 'Courier New', monospace"; ctx.textAlign = "center"; ctx.fillText("BEGIN ESCAPE", 128, 22);
  });
}
function makeGlassOverlay(): THREE.CanvasTexture {
  return makeCanvasTexture(256, 160, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 256, 160);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(190,200,210,0.1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 160);
  });
}
function makePaper(variant: number): THREE.CanvasTexture {
  return makeCanvasTexture(320, 220, (ctx) => {
    const bases = ["#e0d1ac", "#d6c69f", "#e6d8b6", "#cfbf97"];
    const g = ctx.createLinearGradient(0, 0, 320, 220);
    g.addColorStop(0, mixColor(bases[variant % 4], "#c2a070", 0.1));
    g.addColorStop(1, mixColor(bases[variant % 4], "#8a6a42", 0.35));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 220);
  });
}
function makeFolder(): THREE.CanvasTexture {
  return makeCanvasTexture(256, 340, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, "#b08a52"); g.addColorStop(1, "#7d5c33");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 340);
    ctx.font = "bold 20px 'Courier New', monospace"; ctx.fillStyle = "#1c1206"; ctx.fillText("PERIMETER", 30, 160);
  });
}

/* ══════════════════════════════════════════════════════════════
   CRT SCREEN TEXTURE — 4 modes
   ══════════════════════════════════════════════════════════════ */
type CRTMode = "idle" | "auth" | "ready" | "accessing";

function drawCRT(ctx: CanvasRenderingContext2D, o: { name: string; cursorOn: boolean; mode: CRTMode; authLines?: string[] }) {
  ctx.fillStyle = "#030202"; ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = "rgba(255,150,60,0.04)"; ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  for (let y = 0; y < 384; y += 3) ctx.fillRect(0, y, 512, 1);
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(255,200,120,${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 384, 2, 2);
  }
  const cx = 256;
  ctx.textAlign = "center";
  ctx.fillStyle = "#e8b877"; ctx.font = "bold 25px 'Courier New', monospace";
  ctx.shadowColor = "rgba(255,180,84,0.55)"; ctx.shadowBlur = 7;
  ctx.fillText("THE CODEBREAKER'S", cx, 52); ctx.fillText("GAUNTLET", cx, 84);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#b08a52"; ctx.font = "12px 'Courier New', monospace";
  ctx.fillText("ROUND 01 - THE PERIMETER BREACH", cx, 112);
  ctx.fillStyle = "#7aa75a"; ctx.fillText("FACILITY STATUS: LOCKDOWN", cx, 136);
  ctx.strokeStyle = "rgba(232,184,119,0.4)"; ctx.beginPath(); ctx.moveTo(90, 158); ctx.lineTo(422, 158); ctx.stroke();

  if (o.mode === "idle") {
    ctx.fillStyle = "#a08a62"; ctx.font = "11px 'Courier New', monospace";
    ctx.fillText("> CLICK TO IDENTIFY TEAM", cx, 210);
    if (o.cursorOn) { ctx.fillStyle = "#e8b877"; ctx.font = "bold 13px 'Courier New', monospace"; ctx.fillText("[ ]", cx, 248); }
    ctx.fillStyle = "#5a4a38"; ctx.font = "9px 'Courier New', monospace";
    ctx.fillText("SYS: FACILITY-07 // NODE: PERIMETER", cx, 310);
  } else if (o.mode === "auth") {
    ctx.fillStyle = "#e8b877"; ctx.font = "bold 14px 'Courier New', monospace"; ctx.fillText("IDENTIFY YOUR TEAM", cx, 202);
    ctx.fillStyle = "#a08a62"; ctx.font = "11px 'Courier New', monospace"; ctx.fillText("> TEAM DESIGNATION:", cx, 234);
    const nm = o.name.toUpperCase().slice(0, 20) || "............";
    ctx.fillStyle = "#ffd9a0"; ctx.font = "bold 17px 'Courier New', monospace"; ctx.fillText(nm, cx - 6, 268);
    if (o.cursorOn) ctx.fillRect(cx + 92, 254, 9, 17);
    ctx.strokeStyle = "rgba(232,184,119,0.5)"; ctx.strokeRect(cx - 88, 246, 176, 34);
    ctx.fillStyle = "rgba(40,26,10,0.6)"; ctx.fillRect(cx - 112, 310, 224, 34);
    ctx.strokeStyle = "rgba(232,184,119,0.65)"; ctx.strokeRect(cx - 112, 310, 224, 34);
    ctx.fillStyle = "#e8b877"; ctx.font = "bold 13px 'Courier New', monospace"; ctx.fillText("[ CONFIRM IDENTITY ]", cx, 331);
  } else if (o.mode === "accessing") {
    ctx.fillStyle = "#e8b877"; ctx.font = "bold 15px 'Courier New', monospace"; ctx.fillText("AUTHENTICATING...", cx, 200);
    const lines = o.authLines || [];
    ctx.fillStyle = "#a08a62"; ctx.font = "10px 'Courier New', monospace";
    lines.forEach((l, i) => ctx.fillText(l, cx, 232 + i * 20));
    ctx.fillStyle = "rgba(60,40,15,0.5)"; ctx.fillRect(cx - 90, 356, 180, 8);
    ctx.fillStyle = "#e8b877"; ctx.fillRect(cx - 90, 356, Math.floor(Math.min(1, lines.length / 5) * 180), 8);
  } else if (o.mode === "ready") {
    ctx.fillStyle = "#e8b877"; ctx.font = "bold 14px 'Courier New', monospace"; ctx.fillText("TEAM VERIFIED.", cx, 200);
    ctx.fillStyle = "#7aa75a"; ctx.font = "bold 12px 'Courier New', monospace"; ctx.fillText("ACCESS GRANTED", cx, 222);
    ctx.fillStyle = "#a08a62"; ctx.font = "11px 'Courier New', monospace"; ctx.fillText("TEAM:", cx, 268);
    ctx.fillStyle = "#ffd9a0"; ctx.font = "bold 16px 'Courier New', monospace"; ctx.fillText(o.name.toUpperCase().slice(0, 20), cx, 294);
    ctx.fillStyle = "#a08a62"; ctx.font = "11px 'Courier New', monospace"; ctx.fillText("STATUS:", cx, 322);
    ctx.fillStyle = "#7aa75a"; ctx.font = "bold 13px 'Courier New', monospace"; ctx.fillText("READY", cx, 344);
  }
  const v = ctx.createRadialGradient(cx, 192, 120, cx, 192, 340);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(6,4,2,0.75)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, 512, 384);
}

/* ══════════════════════════════════════════════════════════════
   HANGING BULB
   ══════════════════════════════════════════════════════════════ */
function HangingBulb({ triggerRef }: { triggerRef: MutableRefObject<number> }) {
  const swing = useSpring(0, { stiffness: 42, damping: 6.2, mass: 1.6 });
  const group = useRef<THREE.Group>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const glowMat = useRef<THREE.SpriteMaterial>(null!);
  const coneMat = useRef<THREE.MeshBasicMaterial>(null!);
  const glowTex = useMemo(() => makeGlow(), []);
  const fl = useMemo(() => Array.from({ length: 24 }, () => Math.random()), []);

  useFrame(() => {
    const t = now();
    const transition = triggerRef.current >= 0 ? t - triggerRef.current : 0;
    swing.set(Math.sin(t * 0.9) * 0.058 + Math.sin(t * 1.7 + 1.4) * 0.014);
    if (group.current) group.current.rotation.z = swing.get();
    const cut = transition > 0 ? clamp01((T.black1 - transition) / 0.4) : 1;
    const f = fl[Math.floor(t * 30) % fl.length] ?? 0.5;
    let base = 30 * cut;
    if (transition > T.glitch && transition < T.black1) base *= 0.35 + f * 0.65;
    if (light.current) light.current.intensity = THREE.MathUtils.damp(light.current.intensity, base * (0.94 + (f - 0.5) * 0.22), 16, 0.02);
    if (glowMat.current) glowMat.current.opacity = cut;
    if (coneMat.current) coneMat.current.opacity = 0.1 * cut;
  });

  return (
    <group position={[ROOM.bulbAnchor.x, ROOM.bulbAnchor.y, ROOM.bulbAnchor.z]}>
      <group ref={group}>
        <mesh position={[0, -ROOM.ropeLen * 0.26, 0]}><cylinderGeometry args={[0.011, 0.014, ROOM.ropeLen * 0.52, 8]} /><meshStandardMaterial color="#4a3822" roughness={0.95} /></mesh>
        <mesh position={[0, -ROOM.ropeLen * 0.74, 0]}><cylinderGeometry args={[0.014, 0.018, ROOM.ropeLen * 0.48, 8]} /><meshStandardMaterial color="#3f301f" roughness={0.95} /></mesh>
        <mesh position={[0, -ROOM.ropeLen, 0]}><cylinderGeometry args={[0.03, 0.04, 0.05, 12]} /><meshStandardMaterial color="#5a4630" metalness={0.7} roughness={0.4} /></mesh>
        <mesh position={[0, -ROOM.ropeLen - 0.07, 0]} castShadow><sphereGeometry args={[0.065, 20, 16]} /><meshStandardMaterial color="#3a2410" emissive="#ffb454" emissiveIntensity={2.2} roughness={0.25} metalness={0.1} /></mesh>
        <pointLight ref={light} position={[0, -ROOM.ropeLen - 0.05, 0]} intensity={30} color="#ffb469" distance={9} decay={1.6} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.0004} />
        <sprite position={[0, -ROOM.ropeLen - 0.07, 0]} scale={[0.5, 0.5, 1]}><spriteMaterial ref={glowMat} map={glowTex} transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
        <mesh position={[0, -ROOM.ropeLen - 0.3, 0]}><cylinderGeometry args={[0.64, 0.1, 1.5, 20, 1, true]} /><meshBasicMaterial ref={coneMat} color="#ffb469" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} fog={false} /></mesh>
      </group>
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   CRT MONITOR — renders screen + has 3D hitbox
   ══════════════════════════════════════════════════════════════ */
function CRTMonitor({ nameRef, landingPhaseRef, authLinesRef, hoveredRef, cursorTickRef, onCrtClick }: {
  nameRef: MutableRefObject<string>;
  landingPhaseRef: MutableRefObject<LandingPhase>;
  authLinesRef: MutableRefObject<string[]>;
  hoveredRef: MutableRefObject<boolean>;
  cursorTickRef: MutableRefObject<boolean>;
  onCrtClick: () => void;
}) {
  const screenMat = useRef<THREE.MeshBasicMaterial>(null!);
  const crt = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 384;
    return { canvas: c, tex: new THREE.CanvasTexture(c) };
  }, []);
  const glassTex = useMemo(() => makeGlassOverlay(), []);
  const lastKey = useRef("");

  useEffect(() => {
    const id = setInterval(() => {
      cursorTickRef.current = !cursorTickRef.current;
      const phase = landingPhaseRef.current;
      let mode: CRTMode = "idle";
      if (phase === "tv_focus") mode = "auth";
      else if (phase === "tv_auth") mode = "accessing";
      else if (phase === "room_return" || phase === "lever_ready") mode = "ready";
      const key = `${nameRef.current}|${mode}|${cursorTickRef.current}|${authLinesRef.current.length}`;
      if (key !== lastKey.current) {
        lastKey.current = key;
        drawCRT(crt.canvas.getContext("2d")!, { name: nameRef.current, cursorOn: cursorTickRef.current, mode, authLines: authLinesRef.current });
        crt.tex.needsUpdate = true;
      }
    }, 520);
    return () => clearInterval(id);
  }, [crt, cursorTickRef, nameRef, landingPhaseRef, authLinesRef]);

  useFrame(() => {
    if (!screenMat.current) return;
    screenMat.current.opacity = THREE.MathUtils.damp(screenMat.current.opacity, hoveredRef.current ? 1 : 0.86 + Math.sin(now() * 13) * 0.06, 3, 0.03);
  });

  return (
    <group position={[ROOM.crt.x, ROOM.crt.y, ROOM.crt.z]} rotation={[0, 0.08, 0]}>
      <RoundedBox args={[ROOM.crt.w + 0.09, ROOM.crt.h + 0.11, 0.34]} radius={0.035} smoothness={4}>
        <meshStandardMaterial color="#2a2520" roughness={0.55} metalness={0.35} />
      </RoundedBox>
      <RoundedBox args={[ROOM.crt.w + 0.045, ROOM.crt.h + 0.065, 0.02]} radius={0.015} smoothness={3} position={[0, 0, 0.17]}>
        <meshStandardMaterial color="#1c1814" roughness={0.6} metalness={0.4} />
      </RoundedBox>
      <mesh position={[0, 0, 0.185]}><planeGeometry args={[ROOM.crt.w, ROOM.crt.h]} /><meshBasicMaterial ref={screenMat} map={crt.tex} toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.194]}><planeGeometry args={[ROOM.crt.w, ROOM.crt.h]} /><meshBasicMaterial map={glassTex} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>

      {/* 3D CLICK HITBOX — larger than the screen, transparent */}
      <mesh
        position={[0, 0, 0.25]}
        onClick={(e) => {
          e.stopPropagation();
          if (landingPhaseRef.current === "room") {
            console.log("[ESCAPE] TV CLICKED — 3D hitbox");
            onCrtClick();
          } else if (landingPhaseRef.current === "tv_focus") {
            console.log("[ESCAPE] TV CLICKED during focus");
          }
        }}
        onPointerOver={() => {
          if (landingPhaseRef.current === "room") {
            document.body.style.cursor = "pointer";
            hoveredRef.current = true;
          }
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
          hoveredRef.current = false;
        }}
      >
        <boxGeometry args={[ROOM.crt.w + 0.15, ROOM.crt.h + 0.15, 0.1]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {[-0.11, -0.06, -0.01].map((bx, i) => (
        <mesh key={i} position={[bx, -ROOM.crt.h / 2 - 0.035, 0.185]}><cylinderGeometry args={[0.018, 0.018, 0.022, 12]} /><meshStandardMaterial color="#3a332b" metalness={0.5} roughness={0.5} /></mesh>
      ))}
      <mesh position={[0.08, -ROOM.crt.h / 2 - 0.035, 0.185]}><cylinderGeometry args={[0.022, 0.022, 0.024, 12]} /><meshStandardMaterial color="#4a4036" metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[ROOM.crt.w / 2 + 0.02, ROOM.crt.h / 2 - 0.02, 0.185]}><boxGeometry args={[0.03, 0.05, 0.02]} /><meshStandardMaterial color="#6e5b41" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[ROOM.crt.w / 2 + 0.02, ROOM.crt.h / 2 + 0.035, 0.19]}><boxGeometry args={[0.012, 0.012, 0.006]} /><meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1.6} /></mesh>
      <Cable from={[0, 0, -0.18]} to={[-0.35, 0, -0.6]} drop={0.35} r={0.014} color="#1a1512" />
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   CABLE
   ══════════════════════════════════════════════════════════════ */
function Cable({ from, to, drop, r, color }: { from: readonly [number, number, number]; to: readonly [number, number, number]; drop: number; r: number; color: string }) {
  const geo = useMemo(() => {
    const toV3 = (a: readonly [number, number, number]) => new THREE.Vector3(a[0], a[1], a[2]);
    const pts: THREE.Vector3[] = [
      toV3(from),
      new THREE.Vector3(from[0] + (to[0] - from[0]) * 0.35, (from[1] + to[1]) * 0.5 + drop, from[2] + (to[2] - from[2]) * 0.35),
      new THREE.Vector3(from[0] + (to[0] - from[0]) * 0.7, (from[1] + to[1]) * 0.5 + drop * 0.4, from[2] + (to[2] - from[2]) * 0.7),
      toV3(to),
    ];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 6, false);
  }, [from, to, drop, r]);
  return <mesh geometry={geo}><meshStandardMaterial color={color} roughness={0.9} metalness={0.2} /></mesh>;
}

/* ══════════════════════════════════════════════════════════════
   ESCAPE SWITCH — with large 3D hitbox
   ══════════════════════════════════════════════════════════════ */
function EscapeSwitch({ onFlip, landingPhaseRef }: { onFlip: () => void; landingPhaseRef: MutableRefObject<LandingPhase> }) {
  const leverSpring = useSpring(0, { stiffness: 260, damping: 24, mass: 0.9 });
  const lever = useRef<THREE.Group>(null!);
  const lampMat = useRef<THREE.MeshStandardMaterial>(null!);
  const hovered = useRef(false);
  const flipped = useRef(false);
  const glowTex = useMemo(() => makeGlow(), []);
  const labelTex = useMemo(() => makeLabelTex(), []);
  const sparkMat = useRef<THREE.SpriteMaterial>(null!);
  const sparkRef = useRef<THREE.Sprite>(null!);

  useFrame(() => {
    if (flipped.current) leverSpring.set(1);
    if (lever.current) lever.current.rotation.x = -leverSpring.get() * 1.25;
    const t = now();
    const ready = landingPhaseRef.current === "lever_ready";
    if (lampMat.current) {
      lampMat.current.emissiveIntensity = ready
        ? (hovered.current ? 1.6 + Math.sin(t * 40) * 0.5 : 0.8 + Math.sin(t * 3) * 0.3)
        : 0.15 + Math.sin(t * 1.5) * 0.05;
    }
    if (sparkMat.current) sparkMat.current.opacity = ready && hovered.current && !flipped.current ? 0.4 + Math.random() * 0.3 : 0;
    if (sparkRef.current) sparkRef.current.scale.setScalar(ready && hovered.current && !flipped.current ? 0.3 + Math.random() * 0.05 : 0.01);
  });

  return (
    <group position={[ROOM.switchBase.x, ROOM.switchBase.y, ROOM.switchBase.z]}>
      <RoundedBox args={[0.2, 0.14, 0.16]} radius={0.02} smoothness={3}>
        <meshStandardMaterial color="#3a332b" roughness={0.5} metalness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0.1, 0.085]}><planeGeometry args={[0.02, 0.02]} /><meshBasicMaterial color="#ff2a1e" toneMapped={false} /></mesh>
      <group position={[0, 0.02, 0.08]}>
        <mesh position={[0, -0.015, 0]}><cylinderGeometry args={[0.024, 0.03, 0.05, 12]} /><meshStandardMaterial color="#5a4630" metalness={0.65} roughness={0.4} /></mesh>
        <group ref={lever}>
          <mesh position={[0, 0.075, 0]} castShadow><cylinderGeometry args={[0.02, 0.02, 0.17, 12]} /><meshStandardMaterial color="#b08434" metalness={0.8} roughness={0.35} /></mesh>
          <mesh position={[0, 0.165, 0]} castShadow><sphereGeometry args={[0.036, 16, 12]} /><meshStandardMaterial color="#c99a45" metalness={0.85} roughness={0.3} /></mesh>
        </group>
      </group>
      <mesh position={[0, -0.052, 0.05]}><sphereGeometry args={[0.011, 12, 12]} /><meshStandardMaterial ref={lampMat} color="#ff3a2a" emissive="#ff3a2a" emissiveIntensity={0.15} /></mesh>

      {/* LARGE 3D HITBOX for lever click */}
      <mesh
        position={[0, 0.08, 0.1]}
        onClick={(e) => {
          e.stopPropagation();
          if (landingPhaseRef.current === "lever_ready" && !flipped.current) {
            console.log("[ESCAPE] LEVER CLICKED — phase:", landingPhaseRef.current);
            flipped.current = true;
            onFlip();
          } else {
            console.log("[ESCAPE] LEVER CLICKED but phase is:", landingPhaseRef.current, "flipped:", flipped.current);
          }
        }}
        onPointerOver={() => {
          if (landingPhaseRef.current === "lever_ready" && !flipped.current) {
            hovered.current = true;
            document.body.style.cursor = "pointer";
          }
        }}
        onPointerOut={() => { hovered.current = false; document.body.style.cursor = ""; }}
      >
        <boxGeometry args={[0.35, 0.35, 0.3]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <sprite ref={sparkRef} position={[0, 0.18, 0.14]} scale={[0.01, 0.01, 1]}>
        <spriteMaterial ref={sparkMat} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh position={[0, 0.16, 0.0]}><planeGeometry args={[0.3, 0.04]} /><meshStandardMaterial color="#050403" transparent opacity={0.9} /></mesh>
      <mesh position={[0, 0.16, 0.005]}><planeGeometry args={[0.28, 0.028]} /><meshBasicMaterial map={labelTex} toneMapped={false} transparent opacity={0.8} /></mesh>
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   DIRECTOR — deterministic camera animation
   ══════════════════════════════════════════════════════════════ */
function Director({ fxRef, darkRef, triggerRef, landingPhaseRef, phaseStartRef }: {
  fxRef: MutableRefObject<{ pointerX: number; pointerY: number; phase: "idle" | "transition"; done?: () => void }>;
  darkRef: MutableRefObject<HTMLDivElement | null>;
  triggerRef: MutableRefObject<number>;
  landingPhaseRef: MutableRefObject<LandingPhase>;
  phaseStartRef: MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const doneGuard = useRef(false);
  const camLook = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const t = now();
    const f = fxRef.current;
    const transition = triggerRef.current >= 0 ? t - triggerRef.current : 0;
    const phase = landingPhaseRef.current;
    const elapsed = t - phaseStartRef.current;


    // ── ROOM: gentle parallax ──
    if (phase === "room" || phase === "lever_ready") {
      const bx = Math.sin(t * 0.31) * 0.035 + f.pointerX * 0.06;
      const by = Math.sin(t * 0.23 + 1.2) * 0.018 + f.pointerY * 0.035;
      const bz = Math.sin(t * 0.16) * 0.03 + f.pointerX * 0.05;
      const tx = CAM_START.x + bx, ty = CAM_START.y + by, tz = CAM_START.z + bz;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 2, 0.03);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 2, 0.03);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, tz, 2, 0.03);
      camLook.set(ROOM.bulbAnchor.x * 0.6 + f.pointerX * 0.16, 1.45 + f.pointerY * 0.08, 1.1);
      camera.lookAt(camLook);
      return;
    }

    // ── TV ZOOM: deterministic lerp to CRT ──
    if (phase === "tv_zoom") {
      const k = easeInOutCubic(clamp01(elapsed / CAM.tvZoomDur));
      camera.position.set(
        THREE.MathUtils.lerp(CAM_START.x, CAM_TV.x, k),
        THREE.MathUtils.lerp(CAM_START.y, CAM_TV.y, k),
        THREE.MathUtils.lerp(CAM_START.z, CAM_TV.z, k),
      );
      camLook.set(
        THREE.MathUtils.lerp(ROOM.bulbAnchor.x * 0.6, CAM_TV_LOOK.x, k),
        THREE.MathUtils.lerp(1.45, CAM_TV_LOOK.y, k),
        THREE.MathUtils.lerp(1.1, CAM_TV_LOOK.z, k),
      );
      camera.lookAt(camLook);
      return;
    }

    // ── TV FOCUS / AUTH: hold at CRT ──
    if (phase === "tv_focus" || phase === "tv_auth") {
      camera.position.set(CAM_TV.x + Math.sin(t * 0.7) * 0.003, CAM_TV.y + Math.sin(t * 0.5) * 0.002, CAM_TV.z);
      camera.lookAt(CAM_TV_LOOK.x, CAM_TV_LOOK.y, CAM_TV_LOOK.z);
      return;
    }

    // ── ROOM RETURN: deterministic lerp back to room ──
    if (phase === "room_return") {
      const k = easeInOutCubic(clamp01(elapsed / CAM.roomReturnDur));
      camera.position.set(
        THREE.MathUtils.lerp(CAM_TV.x, CAM_START.x, k),
        THREE.MathUtils.lerp(CAM_TV.y, CAM_START.y, k),
        THREE.MathUtils.lerp(CAM_TV.z, CAM_START.z, k),
      );
      camLook.set(
        THREE.MathUtils.lerp(CAM_TV_LOOK.x, ROOM.bulbAnchor.x * 0.6, k),
        THREE.MathUtils.lerp(CAM_TV_LOOK.y, 1.45, k),
        THREE.MathUtils.lerp(CAM_TV_LOOK.z, 1.1, k),
      );
      camera.lookAt(camLook);
      return;
    }

    // ── TRANSITION: escape sequence ──
    if (phase === "transition") {
      const u = clamp01;
      const c = transition;
      let dark = c > T.black0 ? easeInOutCubic(u((c - T.black0) / 0.5)) : 0;
      dark = Math.min(1, dark);
      if (darkRef.current) darkRef.current.style.opacity = dark.toFixed(3);

      let px: number, py: number, pz: number, lx: number, ly: number, lz: number;
      if (c < T.move) {
        const k = easeInOutCubic(u((c - T.turn0) / (T.turn1 - T.turn0)));
        px = THREE.MathUtils.lerp(CAM_START.x, ROOM.door.x * 0.55, k);
        py = THREE.MathUtils.lerp(CAM_START.y, 1.5, k);
        pz = THREE.MathUtils.lerp(CAM_START.z, 2.4, k);
        lx = THREE.MathUtils.lerp(ROOM.bulbAnchor.x * 0.6, ROOM.door.x, k);
        ly = THREE.MathUtils.lerp(1.45, 1.5, k);
        lz = THREE.MathUtils.lerp(1.1, -3.4, k);
      } else {
        const k = easeInOutCubic(u((c - T.move) / (T.through - T.move)));
        px = THREE.MathUtils.lerp(ROOM.door.x * 0.55, ROOM.door.x, k);
        py = THREE.MathUtils.lerp(1.5, 1.45, k);
        pz = THREE.MathUtils.lerp(2.4, -6.2, k);
        lx = ROOM.door.x;
        ly = THREE.MathUtils.lerp(1.5, 1.45, k);
        lz = THREE.MathUtils.lerp(-3.4, -7.4, k);
      }
      const trem = c > 0.1 && c < T.darkFull ? 0.05 : 0;
      camera.position.set(px + (Math.sin(c * 37) + Math.sin(c * 71)) * 0.16 * trem, py + Math.cos(c * 43) * 0.14 * trem, pz);
      camera.lookAt(lx, ly, lz);

      if (c >= T.done && !doneGuard.current) {
        doneGuard.current = true;
        console.log("[ESCAPE] TIMELINE COMPLETE — calling onEnter");
        f.done?.();
      }
    }
  });

  return null;
}

/* ══════════════════════════════════════════════════════════════
   ROOM SHELL + EXIT DOOR
   ══════════════════════════════════════════════════════════════ */
function TheRoom({ triggerRef }: { triggerRef: MutableRefObject<number> }) {
  const floorTex = useMemo(() => makeStainedFloor(), []);
  const wallTex = useMemo(() => makeConcreteWall(18), []);
  const wall2 = useMemo(() => makeConcreteWall(24), []);
  const ventTex = useMemo(() => makeVentTexture(), []);
  const rustTex = useMemo(() => makeRustedMetal(), []);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ map: floorTex, color: "#6a5230", roughness: 0.95, metalness: 0.03 }), [floorTex]);
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ map: wallTex, color: "#4a3d2e", roughness: 0.98, metalness: 0 }), [wallTex]);
  const ventMat = useMemo(() => new THREE.MeshStandardMaterial({ map: ventTex, color: "#2a2520", roughness: 0.9, metalness: 0.2 }), [ventTex]);

  return (
    <group>
      <mesh material={wood} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1]} receiveShadow><planeGeometry args={[10, 12]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3, 1]}><planeGeometry args={[10, 12]} /><meshStandardMaterial map={wall2} color="#1a1612" roughness={1} /></mesh>
      <mesh material={ventMat} position={[0, 2.98, -1.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.2, 1.2]} /></mesh>
      <mesh material={ventMat} position={[2.5, 2.98, 1.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.8, 0.8]} /></mesh>
      <mesh material={ventMat} position={[-2.5, 2.98, 0.5]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.8, 0.8]} /></mesh>
      <BackWall mat={wall} />
      <mesh material={wall} rotation={[0, Math.PI / 2, 0]} position={[-5, 1.5, 1]}><planeGeometry args={[12, 3]} /></mesh>
      <mesh material={wall} rotation={[0, -Math.PI / 2, 0]} position={[5, 1.5, 1]}><planeGeometry args={[12, 3]} /></mesh>
      <group position={[-4.8, 1.2, 1.5]}><mesh><planeGeometry args={[0.8, 0.6]} /><meshStandardMaterial map={makeMapTexture()} roughness={0.9} /></mesh></group>
      <group position={[-4.8, 0.6, 0.5]}><mesh><planeGeometry args={[0.6, 0.8]} /><meshStandardMaterial map={makeChalkboard()} roughness={0.95} /></mesh></group>
      <group position={[4.8, 1.5, -1.5]} rotation={[0, -Math.PI / 2, 0]}><mesh><planeGeometry args={[0.6, 0.4]} /><meshStandardMaterial map={makeEvidencePhoto()} roughness={0.9} /></mesh></group>
      {ROOM.pipes.map((p, i) => (
        <mesh key={`pipe${i}`} position={[p.x, p.y, p.z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 10, 10]} /><meshStandardMaterial color="#2c2a28" roughness={0.6} metalness={0.65} /></mesh>
      ))}
      {ROOM.cableRuns.map((c, i) => (
        <Cable key={`cable${i}`} from={c.from} to={c.to} drop={0.18} r={0.012} color="#141210" />
      ))}
      <group position={[-4.8, 0.9, -0.5]}>
        <mesh><boxGeometry args={[0.3, 0.4, 0.15]} /><meshStandardMaterial map={rustTex} color="#2a241a" roughness={0.8} metalness={0.5} /></mesh>
        <mesh position={[0, 0.12, 0.09]}><boxGeometry args={[0.02, 0.02, 0.01]} /><meshStandardMaterial color="#ff2a1e" emissive="#ff2a1e" emissiveIntensity={0.5} /></mesh>
      </group>
      <group position={[-4.5, 0.3, 2.5]}><mesh><cylinderGeometry args={[0.06, 0.06, 0.5, 12]} /><meshStandardMaterial color="#cc2211" roughness={0.4} metalness={0.2} /></mesh></group>
      <group position={[3.5, 2.9, -2.0]}>
        <mesh><boxGeometry args={[0.2, 0.1, 0.15]} /><meshStandardMaterial color="#1a1612" roughness={0.8} metalness={0.2} /></mesh>
        <mesh position={[0, -0.05, 0.08]}><boxGeometry args={[0.12, 0.04, 0.02]} /><meshStandardMaterial color="#ff2a1e" emissive="#ff2a1e" emissiveIntensity={0.3} /></mesh>
      </group>
      <ExitDoor triggerRef={triggerRef} />
    </group>
  );
}

declare global { var __erTransition: boolean | undefined; }

function BackWall({ mat }: { mat: THREE.Material }) {
  const { door } = ROOM;
  const panels: [number, number, number, number][] = [
    [-((3 - door.w) / 4 + door.w / 2), 1.5, (3 - door.w) / 2, 3],
    [(3 - door.w) / 4 + door.w / 2, 1.5, (3 - door.w) / 2, 3],
    [door.x, 3 - door.h / 2, door.w, (3 - door.h) / 2],
  ];
  return (
    <group>
      {panels.map(([px, py, pw, ph], i) => (<mesh key={`bp${i}`} material={mat} position={[px - 0.4, py, door.z]}><planeGeometry args={[pw, ph]} /></mesh>))}
      <mesh position={[door.x, door.h / 2, door.z + 0.05]}><planeGeometry args={[door.w - 0.12, door.h - 0.1]} /><meshStandardMaterial color="#040302" roughness={1} /></mesh>
      <mesh material={mat} position={[door.x - door.w / 2 + 0.045, door.h / 2, door.z]}><boxGeometry args={[0.1, door.h, 0.12]} /></mesh>
      <mesh material={mat} position={[door.x + door.w / 2 - 0.045, door.h / 2, door.z]}><boxGeometry args={[0.1, door.h, 0.12]} /></mesh>
      <ExitBeacon x={door.x} y={door.h + 0.12} z={door.z - 0.1} />
    </group>
  );
}

function ExitBeacon({ x, y, z }: { x: number; y: number; z: number }) {
  const light = useRef<THREE.PointLight>(null!);
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const on = globalThis.__erTransition === true;
    if (light.current) light.current.intensity = THREE.MathUtils.damp(light.current.intensity, on ? 4 : 0, 6, 0.02);
    if (mat.current) mat.current.emissiveIntensity = THREE.MathUtils.damp(mat.current.emissiveIntensity, on ? 3 : 0, 6, 0.02);
  });
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.22, 0.09, 0.16]} /><meshStandardMaterial color="#1c1412" roughness={0.6} metalness={0.5} /></mesh>
      <mesh position={[0, 0.03, 0.09]}><boxGeometry args={[0.16, 0.03, 0.02]} /><meshStandardMaterial ref={mat} color="#ff2a1e" emissive="#ff2a1e" emissiveIntensity={0} /></mesh>
      <pointLight ref={light} position={[0, 0, 0.3]} intensity={0} distance={7} color="#ff2418" decay={1.8} />
    </group>
  );
}

function ExitDoor({ triggerRef }: { triggerRef: MutableRefObject<number> }) {
  const leaf = useRef<THREE.Group>(null!);
  const bolt = useRef<THREE.Mesh>(null!);
  const spill = useRef<THREE.PointLight>(null!);
  const metal = useMemo(() => ({ color: "#3a332b", roughness: 0.55, metalness: 0.6 }), []);
  const doorTex = useMemo(() => makeConcreteWall(10), []);
  useFrame(() => {
    if (!leaf.current) return;
    const c = triggerRef.current >= 0 ? now() - triggerRef.current : 0;
    const open = clamp01((c - T.open) / (T.openFull - T.open));
    leaf.current.rotation.y = -open * 2.3;
    if (bolt.current) bolt.current.position.x = open * 0.12;
    if (spill.current) spill.current.intensity = clamp01((c - T.unlock) / 1.2) * 5;
  });
  return (
    <group position={[ROOM.door.x, 0, ROOM.door.z]}>
      <pointLight ref={spill} position={[0, 2, -0.4]} intensity={0} distance={8} color="#ffcf8a" decay={1.6} />
      <mesh position={[-ROOM.door.w / 2 + 0.03, 1.2, 0.02]}><boxGeometry args={[0.05, 0.05, 0.08]} /><meshStandardMaterial {...metal} /></mesh>
      <group ref={leaf} position={[-ROOM.door.w / 2 + 0.15, 0, -0.02]} castShadow>
        <mesh position={[0, ROOM.door.h / 2, -0.055]} castShadow><boxGeometry args={[ROOM.door.w - 0.08, ROOM.door.h, 0.1]} /><meshStandardMaterial color="#2f2924" roughness={0.7} metalness={0.5} map={doorTex} /></mesh>
        <mesh position={[0, ROOM.door.h / 2, 0.02]} ref={bolt}><boxGeometry args={[0.05, 0.06, 0.005]} /><meshStandardMaterial color="#b08434" metalness={0.8} roughness={0.3} /></mesh>
      </group>
      <mesh position={[0, 0.025, 0.09]}><planeGeometry args={[ROOM.door.w, 0.08]} /><meshBasicMaterial map={makeStripeTex()} toneMapped={false} transparent opacity={0.7} /></mesh>
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   TABLE + PROPS
   ══════════════════════════════════════════════════════════════ */
function TableAndProps() {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ map: makeStainedFloor(), color: "#5a442a", roughness: 0.9, metalness: 0.05 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1e1610", roughness: 0.95, metalness: 0.05 }), []);
  const paperTexs = useMemo(() => [makePaper(0), makePaper(1), makePaper(2), makePaper(3)], []);
  const folderTex = useMemo(() => makeFolder(), []);
  const evidenceTex = useMemo(() => makeEvidencePhoto(), []);
  const geigerTex = useMemo(() => makeRustedMetal(), []);

  return (
    <group>
      <group position={[-2.2, 0, 2.8]} rotation={[0, 1.1, 0.15]}>
        <mesh material={dark} position={[0, 0.48, -0.18]}><boxGeometry args={[0.05, 0.75, 0.45]} /></mesh>
        <mesh material={dark} position={[0, 0.3, 0.12]}><boxGeometry args={[0.35, 0.04, 0.28]} /></mesh>
        <mesh material={dark} position={[-0.14, 0.14, 0.1]}><cylinderGeometry args={[0.022, 0.022, 0.3, 8]} /></mesh>
        <mesh material={dark} position={[0.14, 0.14, 0.1]}><cylinderGeometry args={[0.022, 0.022, 0.3, 8]} /></mesh>
        <mesh material={dark} position={[-0.14, 0.14, -0.15]}><cylinderGeometry args={[0.022, 0.022, 0.3, 8]} /></mesh>
        <mesh material={dark} position={[0.14, 0.14, -0.15]}><cylinderGeometry args={[0.022, 0.022, 0.3, 8]} /></mesh>
      </group>
      <group position={[0, 0, 1.45]}>
        <mesh position={[0, ROOM.tableTop, 0]} castShadow receiveShadow><boxGeometry args={[2.4, 0.1, 1.25]} /><primitive object={wood} attach="material" /></mesh>
        {[[-1.04, 0.44, 0.5], [1.04, 0.44, 0.5], [-1.04, 0.44, -0.5], [1.04, 0.44, -0.5]].map(([x, y, z], i) => (<mesh key={`leg${i}`} material={dark} position={[x, y, z]} castShadow><boxGeometry args={[0.12, 0.86, 0.12]} /></mesh>))}
        <mesh material={dark} position={[0, 0.14, 0]}><boxGeometry args={[2.2, 0.05, 1.05]} /></mesh>
        <group position={[-1.05, ROOM.tableTop + 0.012, 0.28]} rotation={[0, 0.18, 0.04]}>
          {paperTexs.map((tex, i) => <PaperPlane key={i} tex={tex} w={0.4 - i * 0.01} h={0.28 - i * 0.01} pos={[i * 0.02, 0, i * 0.015]} rot={[0, (i - 1) * 0.01, (i - 1) * 0.01]} />)}
        </group>
        <PaperPlane tex={evidenceTex} w={0.32} h={0.4} pos={[-1.25, ROOM.tableTop + 0.012, -0.35]} rot={[0, -0.35, 0.05]} />
        <group position={[-0.42, 0, -0.35]} rotation={[0, -0.55, 0.04]}>
          <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.3, 0.4]} /><meshStandardMaterial map={folderTex} side={THREE.DoubleSide} roughness={0.9} /></mesh>
        </group>
        <PaperPlane tex={paperTexs[3]} w={0.3} h={0.22} pos={[-0.3, ROOM.tableTop + 0.012, -0.1]} rot={[0, 0.15, -0.03]} />
        <group position={[0.75, ROOM.tableTop + 0.02, 0.35]} rotation={[0, -0.2, 0]}>
          <mesh><boxGeometry args={[0.14, 0.08, 0.07]} /><meshStandardMaterial map={geigerTex} roughness={0.7} metalness={0.3} /></mesh>
          <mesh position={[0.02, 0.05, 0.02]}><sphereGeometry args={[0.015, 8, 8]} /><meshStandardMaterial color="#ff2a1e" emissive="#ff2a1e" emissiveIntensity={0.8} /></mesh>
        </group>
        <group position={[0.9, ROOM.tableTop + 0.03, -0.2]} rotation={[0, 0.3, 0]}>
          <mesh><cylinderGeometry args={[0.045, 0.045, 0.09, 16]} /><meshStandardMaterial color="#1a1510" roughness={0.8} metalness={0.1} /></mesh>
        </group>
        <group position={[1.05, ROOM.tableTop + 0.02, 0.1]} rotation={[0, -0.5, 0]}>
          <mesh><cylinderGeometry args={[0.055, 0.055, 0.025, 20]} /><meshStandardMaterial color="#181410" roughness={0.8} metalness={0.2} /></mesh>
        </group>
        <group position={[0.22, ROOM.tableTop + 0.012, -0.3]} rotation={[0, 0.6, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.022, 0.004, 8, 14]} /><meshStandardMaterial color="#8f6a2f" metalness={0.85} roughness={0.35} /></mesh>
        </group>
        <group position={[-0.8, ROOM.tableTop + 0.02, 0.4]} rotation={[0, 0.8, 0]}>
          <mesh><boxGeometry args={[0.05, 0.07, 0.035]} /><meshStandardMaterial color="#3a2818" roughness={0.8} metalness={0.6} /></mesh>
        </group>
        <group position={[-0.9, ROOM.tableTop + 0.025, 0.45]} rotation={[0, 0.2, 0]}>
          <mesh><boxGeometry args={[0.12, 0.05, 0.08]} /><meshStandardMaterial color="#1a1612" roughness={0.8} metalness={0.3} /></mesh>
        </group>
        <group position={[-1.1, ROOM.tableTop + 0.02, 0.2]} rotation={[0, -0.3, 0.1]}>
          <mesh><cylinderGeometry args={[0.03, 0.03, 0.18, 12]} /><meshStandardMaterial color="#2a241a" roughness={0.6} metalness={0.7} /></mesh>
        </group>
      </group>
    </group>
  );
}

const PaperPlane = memo(function PaperPlane({ tex, w, h, pos, rot }: { tex: THREE.Texture; w: number; h: number; pos: [number, number, number]; rot: [number, number, number]; }) {
  return <mesh position={pos} rotation={rot} receiveShadow><planeGeometry args={[w, h]} /><meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.95} /></mesh>;
});

/* ══════════════════════════════════════════════════════════════
   DUST + SMOKE
   ══════════════════════════════════════════════════════════════ */
function DustField() {
  const seed = useMemo(() => Array.from({ length: 130 }, () => ({
    x: (Math.random() - 0.5) * 2.6 - 0.3, y: 0.5 + Math.random() * 2.2, z: 0.4 + Math.random() * 2.6,
    ph: Math.random() * Math.PI * 2, spd: 0.14 + Math.random() * 0.3,
  })), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry(); const arr = new Float32Array(seed.length * 3);
    seed.forEach((s, i) => { arr[i * 3] = s.x; arr[i * 3 + 1] = s.y; arr[i * 3 + 2] = s.z; });
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3)); return g;
  }, [seed]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + 100; const arr = geom.attributes.position.array as Float32Array;
    for (let i = 0; i < seed.length; i++) {
      const s = seed[i]; arr[i * 3] = s.x + Math.sin(t * s.spd * 2 + s.ph) * 0.07;
      arr[i * 3 + 1] = s.y + Math.sin(t * s.spd + s.ph * 1.7) * 0.08;
      arr[i * 3 + 2] = s.z + Math.sin(t * s.spd * 0.6 + s.ph) * 0.05;
    }
    geom.attributes.position.needsUpdate = true;
  });
  return <points geometry={geom}><pointsMaterial color="#ffc276" size={0.011} transparent opacity={0.55} depthWrite={false} sizeAttenuation /></points>;
}

function Smoke() {
  const smTex = useMemo(() => makeSmoke(), []);
  const group = useRef<THREE.Group>(null!);
  useFrame(() => { if (group.current) group.current.rotation.y = Math.sin(now() * 0.05) * 0.12; });
  return (
    <group ref={group}>
      {[[-0.4, 1.5, 1.7], [0.7, 1.2, 2.2], [0.1, 0.9, 1.1]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, -0.2]}>
          <planeGeometry args={[4.4, 3.4]} />
          <meshBasicMaterial map={smTex} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   SCENE ROOT
   ══════════════════════════════════════════════════════════════ */
const Scene = memo(function Scene({
  triggerRef, nameRef, landingPhaseRef, authLinesRef, hoveredRef, cursorTickRef,
  onCrtClick, onFlip, fxRef, darkRef, phaseStartRef,
}: {
  triggerRef: MutableRefObject<number>;
  nameRef: MutableRefObject<string>;
  landingPhaseRef: MutableRefObject<LandingPhase>;
  authLinesRef: MutableRefObject<string[]>;
  hoveredRef: MutableRefObject<boolean>;
  cursorTickRef: MutableRefObject<boolean>;
  onCrtClick: () => void;
  onFlip: () => void;
  fxRef: MutableRefObject<{ pointerX: number; pointerY: number; phase: "idle" | "transition"; done?: () => void }>;
  darkRef: MutableRefObject<HTMLDivElement | null>;
  phaseStartRef: MutableRefObject<number>;
}) {
  return (
    <>
      <color attach="background" args={["#050302"]} />
      <fog attach="fog" args={["#0a0603", 5, 19]} />
      <ambientLight intensity={0.05} color="#ffd9a8" />
      <hemisphereLight args={["#2a1c10", "#0a0704", 0.24]} />
      <HangingBulb triggerRef={triggerRef} />
      <TheRoom triggerRef={triggerRef} />
      <TableAndProps />
      <CRTMonitor nameRef={nameRef} landingPhaseRef={landingPhaseRef} authLinesRef={authLinesRef} hoveredRef={hoveredRef} cursorTickRef={cursorTickRef} onCrtClick={onCrtClick} />
      <EscapeSwitch onFlip={onFlip} landingPhaseRef={landingPhaseRef} />
      <DustField />
      <Smoke />
      <Director fxRef={fxRef} darkRef={darkRef} triggerRef={triggerRef} landingPhaseRef={landingPhaseRef} phaseStartRef={phaseStartRef} />
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   EXPORTED LANDING
   ══════════════════════════════════════════════════════════════ */
export default function LandingTerminal({ onEnter }: Props) {
  const [name, setName] = useState("");
  const [landingPhase, setLandingPhase] = useState<LandingPhase>("room");
  const landingPhaseRef = useRef<LandingPhase>("room");
  const phaseStartRef = useRef(now());
  const nameRef = useRef("");
  const authLinesRef = useRef<string[]>([]);
  const cursorTickRef = useRef(false);
  const hoveredRef = useRef(false);
  const darkRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<{ ctx: AudioContext; drone?: OscillatorNode } | null>(null);
  const triggerAt = useRef(-1);
  const pointerRef = useRef({ pointerX: 0, pointerY: 0, phase: "idle" as "idle" | "transition", done: undefined as (() => void) | undefined });
  const authTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhase = useCallback((p: LandingPhase) => {
    console.log(`[ESCAPE] PHASE: ${landingPhaseRef.current} -> ${p}`);
    landingPhaseRef.current = p;
    phaseStartRef.current = now();
    setLandingPhase(p);
  }, []);

  const bootAudio = useCallback(() => {
    try {
      if (audioRef.current) return;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createGain(); master.gain.value = 0.4; master.connect(ctx.destination);
      const drone = ctx.createOscillator(); drone.type = "sine"; drone.frequency.value = 47;
      const droneGain = ctx.createGain(); droneGain.gain.value = 0;
      drone.connect(droneGain); droneGain.connect(master); drone.start();
      audioRef.current = { ctx, drone };
      droneGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);
    } catch { /* audio optional */ }
  }, []);

  const playClick = useCallback(() => {
    try {
      const a = audioRef.current; if (!a) return;
      const ctx = a.ctx;
      const o = ctx.createOscillator(); o.type = "square";
      o.frequency.setValueAtTime(140, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.12);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.22);
    } catch { /* audio optional */ }
  }, []);

  // STEP 1: CRT clicked → start zoom
  const handleCrtClick = useCallback(() => {
    if (landingPhaseRef.current !== "room") { console.log("[ESCAPE] TV CLICK BLOCKED — phase:", landingPhaseRef.current); return; }
    console.log("[ESCAPE] TV CLICKED — starting zoom");
    bootAudio();
    playClick();
    setPhase("tv_zoom");
    setTimeout(() => {
      if (landingPhaseRef.current === "tv_zoom") {
        console.log("[ESCAPE] TV FOCUS REACHED");
        setPhase("tv_focus");
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }, CAM.tvZoomDur * 1000);
  }, [bootAudio, playClick, setPhase]);

  // STEP 3: Auth
  const startAuth = useCallback(() => {
    if (landingPhaseRef.current !== "tv_focus") { console.log("[ESCAPE] AUTH BLOCKED — phase:", landingPhaseRef.current); return; }
    const val = nameRef.current.trim().toUpperCase();
    if (!val) { console.log("[ESCAPE] AUTH BLOCKED — no name"); return; }
    console.log("[ESCAPE] AUTH STARTING for:", val);
    bootAudio();
    playClick();
    setPhase("tv_auth");
    const lines = ["> IDENTIFYING TEAM...", "> VERIFYING ACCESS...", "> ESTABLISHING SESSION...", "> TEAM VERIFIED.", "> ACCESS GRANTED."];
    authLinesRef.current = [];
    let i = 0;
    const iv = setInterval(() => {
      if (i >= lines.length) {
        clearInterval(iv);
        authLinesRef.current = lines;
        cursorTickRef.current = !cursorTickRef.current;
        authTimerRef.current = setTimeout(() => {
          console.log("[ESCAPE] AUTH COMPLETE — setting room_return");
          setPhase("room_return");
          authTimerRef.current = setTimeout(() => {
            console.log("[ESCAPE] LEVER READY — phase:", landingPhaseRef.current);
            if (landingPhaseRef.current === "room_return") {
              setPhase("lever_ready");
            }
          }, CAM.roomReturnDur * 1000);
        }, 1200);
        return;
      }
      authLinesRef.current = [...authLinesRef.current, lines[i]];
      cursorTickRef.current = !cursorTickRef.current;
      i++;
    }, 400);
  }, [bootAudio, playClick, setPhase]);

  // STEP 5: Lever
  const flip = useCallback(() => {
    console.log("[ESCAPE] LEVER FLIP — starting escape timeline");
    bootAudio();
    playClick();
    triggerAt.current = now();
    globalThis.__erTransition = true;
    pointerRef.current.phase = "transition";
    setPhase("transition");
  }, [bootAudio, playClick, setPhase]);

  useEffect(() => { pointerRef.current.done = () => { onEnter(nameRef.current.trim() || "UNKNOWN"); }; }, [onEnter]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerRef.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => () => { if (authTimerRef.current) clearTimeout(authTimerRef.current); }, []);

  useEffect(() => {
    if (landingPhase === "tv_focus") {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [landingPhase]);

  const isTvFocused = landingPhase === "tv_focus";

  return (
    <div className="er-landing er-landing--cinema">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 42, near: 0.05, far: 40, position: [CAM_START.x, CAM_START.y, CAM_START.z] }}
        style={{ position: "absolute", inset: 0, pointerEvents: isTvFocused ? "none" : "auto" }}
      >
        <Scene
          triggerRef={triggerAt}
          nameRef={nameRef}
          landingPhaseRef={landingPhaseRef}
          authLinesRef={authLinesRef}
          hoveredRef={hoveredRef}
          cursorTickRef={cursorTickRef}
          onCrtClick={handleCrtClick}
          onFlip={flip}
          fxRef={pointerRef}
          darkRef={darkRef}
          phaseStartRef={phaseStartRef}
        />
      </Canvas>

      {/* Blackout layer */}
      <div ref={darkRef} className="er-landing-dark" style={{ opacity: 0 }} />

      {/* CRT DOM overlay — interactive terminal during tv_focus */}
      {isTvFocused && (
        <div
          className="er-crt-overlay"
          onPointerDown={(e) => { e.stopPropagation(); inputRef.current?.focus(); }}
        >
          <div className="er-crt-terminal">
            <div className="er-crt-header">THE CODEBREAKER'S GAUNTLET</div>
            <div className="er-crt-sub">ROUND 01 — THE PERIMETER BREACH</div>
            <div className="er-crt-status">FACILITY STATUS: LOCKDOWN</div>
            <div className="er-crt-divider" />
            <div className="er-crt-prompt">IDENTIFY YOUR TEAM</div>
            <div className="er-crt-label">&gt; TEAM DESIGNATION:</div>
            <div className="er-crt-input-row">
              <span className="er-crt-bracket">[</span>
              <input
                ref={inputRef}
                className="er-crt-input"
                value={name}
                maxLength={20}
                onChange={(e) => { const v = e.target.value.toUpperCase(); setName(v); nameRef.current = v; }}
                onKeyDown={(e) => { if (e.key === "Enter") startAuth(); }}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                placeholder="............"
              />
              <span className="er-crt-bracket">]</span>
            </div>
            <button
              className="er-crt-confirm"
              onClick={() => { if (nameRef.current.trim()) startAuth(); }}
              disabled={!name.trim()}
            >
              [ CONFIRM IDENTITY ]
            </button>
            <div className="er-crt-footer">SYS: FACILITY-07 // NODE: PERIMETER</div>
          </div>
        </div>
      )}
    </div>
  );
}
