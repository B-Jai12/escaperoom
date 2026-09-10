"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import CorridorScene from "../cinematic/CorridorScene";
import { makeStore, CAM_Y } from "../cinematic/engine";
import { directorTick } from "../cinematic/timeline";
import CinematicOverlay from "./CinematicOverlay";

// Visible error boundary: if the 3D renderer fails we show WHY instead of a blank page.
class SceneBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[er-scene] R3F crash:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="er-cine-loading" style={{ whiteSpace: "pre-wrap", maxWidth: "92vw", lineHeight: 1.8 }}>
          3D RENDER ERROR: {String(this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

type Props = {
  round?: 1 | 2 | 3;
  teamName: string;
  breached: boolean[];
  fragments: string[]; // collected code fragments, empty string if door still sealed
  clearCine: number; // bump to drop the entry blackout / re-arm input
  timeLeft: number; // seconds
  onOpenPortal: (index: number) => void;
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Corridor({ round = 1, teamName, breached, fragments, clearCine, timeLeft, onOpenPortal }: Props) {
  const roundTitle = round === 3 ? "ROUND 03" : round === 2 ? "ROUND 02" : "ROUND 01";
  const roundSub = round === 3 ? "THE FINAL PROTOCOL" : round === 2 ? "THE CORE INFILTRATION" : "THE PERIMETER BREACH";
  const sectorName = round === 3 ? "MAINFRAME VAULT" : round === 2 ? "NETWORK CORE" : "FACILITY ACCESS";
  const fx = useMemo(() => makeStore(breached), []); // stable for the session
  const seq = useRef({ active: false, door: -1, start: 0 });
  const onOpenRef = useRef(onOpenPortal);
  onOpenRef.current = onOpenPortal;
  const breachedRef = useRef(breached);
  breachedRef.current = breached;

  // WebGL availability pre-check so a disabled-GPU browser shows a hint, not a black void
  const [glOk] = useState(() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  });

  // keep fx.doors in sync with newly breached doors + drop blackout on clearCine
  useEffect(() => {
    fx.blackout = 0;
    fx.engaged = false;
    fx.glitch = 0;
    fx.redFlash = 0;
    fx.stage = "idle";
    breachedRef.current.forEach((b, i) => {
      if (b && fx.doors[i].rotationY < 1) {
        const d = fx.doors[i];
        d.rotationY = 1.5;
        d.interiorGlow = 1;
        d.breachGlow = 1;
        d.lampLevel = 2;
        d.boltOut = [1, 1, 1, 1];
      }
    });
  }, [clearCine, fx, breached]);

  // master cinematic loop — writes to fx at 60fps, no React re-renders needed
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(64, now - last);
      last = now;
      const s = seq.current;
      if (s.active) {
        const t = now - s.start;
        directorTick(fx, t, s.door, dt);
        if (fx.stage === "done") {
          s.active = false;
          const idx = s.door;
          // blackout holds briefly so the swap feels like a hard cut
          setTimeout(() => onOpenRef.current(idx), 420);
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fx]);

  const startSequence = useCallback(
    (index: number) => {
      if (fx.engaged) return;
      if (breachedRef.current[index]) return;
      if (fx.doors[index].rotationY > 0.5) return; // already open
      document.body.style.cursor = "";
      fx.engaged = true;
      fx.doorIndex = index;
      fx.blackout = 0;
      fx.redFlash = 0;
      fx.glitch = 0;
      seq.current = { active: true, door: index, start: performance.now() };
    },
    [fx]
  );

  const handleHover = useCallback((i: number) => {
    if (fx.engaged) return;
    fx.hovered = i;
  }, [fx]);
  const handleUnhover = useCallback((i: number) => {
    fx.hovered = -1;
  }, [fx]);

  const count = breached.filter(Boolean).length;
  const lowTime = timeLeft <= 300;

  return (
    <div className="er-corridor">
      {/* HUD */}
      <div className="er-hud">
        <div className="er-hud-left">
          <span className="lbl">{roundTitle}</span>
          <span className="val" style={{ fontSize: 10, letterSpacing: 2 }}>
            {roundSub}
          </span>
        </div>
        <div className="er-hud-center">
          <div className="t">THE CODEBREAKER'S GAUNTLET</div>
          <div className="s">{sectorName}</div>
        </div>
        <div className="er-hud-right">
          <span className="lbl">NODES BREACHED</span>
          <span className="val amber">{count} / 6</span>
          <span className="lbl" style={{ marginTop: 8 }}>
            CODE FRAGMENTS
          </span>
          <span className="er-frag-row">
            {fragments.map((f, i) => (
              <span key={i} className={`er-frag ${f ? "got" : ""}`}>
                {f || "◆"}
              </span>
            ))}
          </span>
          <span className="lbl" style={{ marginTop: 8 }}>
            TIME REMAINING
          </span>
          <span className={`val ${lowTime ? "timer-low" : ""}`}>{fmt(timeLeft)}</span>
          <span className="lbl" style={{ marginTop: 8 }}>
            TEAM: {teamName}
          </span>
        </div>
      </div>

      {/* full-bleed 3D view */}
      <div className="er-corridor-canvas">
        {glOk ? (
          <SceneBoundary>
            <Canvas
              dpr={[1, 1.5]}
              gl={{ antialias: true, powerPreference: "high-performance" }}
              camera={{ fov: 58, near: 0.1, far: 60, position: [0, CAM_Y, 6.6] }}
            >
              <CorridorScene round={round}
                fx={fx}
                breached={breached}
                onPick={startSequence}
                onHover={handleHover}
                onUnhover={handleUnhover}
              />
            </Canvas>
          </SceneBoundary>
        ) : (
          <div className="er-cine-loading" style={{ maxWidth: "80vw", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            WEBGL UNAVAILABLE — ENABLE HARDWARE ACCELERATION (or a GPU driver) IN YOUR BROWSER
          </div>
        )}
      </div>

      {/* DOM cinematic overlays (stage text, flash, glitch, blackout, progress) */}
      <CinematicOverlay fx={fx} />
    </div>
  );
}