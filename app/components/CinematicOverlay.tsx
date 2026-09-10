"use client";

import { useEffect, useState } from "react";
import type { FxStore, Stage } from "../cinematic/engine";

const STAGE_TEXT: Record<Stage, { main: string; sub?: string }> = {
  idle: { main: "" },
  approach: { main: "INITIATING BREACH PROTOCOL", sub: "NODE 01 · PERIMETER AUTH" },
  scan: { main: "SECURITY CHECKPOINT DETECTED", sub: "IDENTITY ASSESSMENT" },
  denied: { main: "ACCESS DENIED", sub: "AUTHORIZATION REFUSED — REVOKED" },
  override: { main: "OVERRIDE DETECTED", sub: "DISENGAGING LOCKDOWN" },
  unlock: { main: "SECURITY LOCKS RELEASING", sub: "LATCH SEQUENCE IN PROGRESS" },
  release: { main: "ALL LOCKS DISENGAGED", sub: "DOOR STRUCTURE UNLOCKED" },
  preshape: { main: "UNSEALING DOOR ASSEMBLY", sub: "MECHANICAL LIFT ENGAGED" },
  opening: { main: "DOOR ASSEMBLY IN OPERATION", sub: "RESPECT CLEARANCE DISTANCE" },
  hold: { main: "NODE 01 OPEN", sub: "AUTO-NAVIGATION ENGAGED" },
  enter: { main: "ENTERING NODE 01", sub: "SIGNAL DEGRADATION EXPECTED" },
  slam: { main: "DOOR SEALING BEHIND YOU", sub: "WELCOME TO THE GAUNTLET" },
  done: { main: "", sub: "" },
};

export default function CinematicOverlay({ fx }: { fx: FxStore }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick((v) => v + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { stage } = fx;
  const msg = STAGE_TEXT[stage];
  const engaged = fx.engaged;
  const pct = Math.round(fx.progress);
  const unlocked = stage === "hold" || stage === "enter" || stage === "slam" || stage === "done";

  return (
    <div className={`er-cine ${engaged ? "on" : ""}`} aria-hidden>
      {/* red warning flash */}
      <div className="er-cine-flash" style={{ opacity: fx.redFlash * 0.85 }} />
      {/* glitch bands */}
      <div className="er-cine-glitch" style={{ opacity: Math.min(1, fx.glitch * 1.4) }} />
      {/* global blackout (slam entry / done) */}
      <div className="er-cine-black" style={{ opacity: fx.blackout }} />

      {/* stage text */}
      {engaged && msg.main && (
        <div className="er-cine-text">
          <div className={`er-cine-main ${stage === "denied" ? "denied" : ""}`}>{msg.main}</div>
          {msg.sub && <div className="er-cine-sub">{msg.sub}</div>}
        </div>
      )}

      {/* objective marker once open */}
      {engaged && unlocked && stage !== "done" && (
        <div className="er-cine-marker">
          <div className="er-cine-marker-ring" />
          <div className="er-cine-marker-core" />
          <div className="er-cine-marker-lbl">NODE 01</div>
        </div>
      )}

      {/* system progress bar */}
      {engaged && (
        <div className="er-cine-progress">
          <div className="er-cine-progress-track">
            <div
              className={`er-cine-progress-fill ${stage === "denied" ? "denied" : ""}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="er-cine-progress-lbl">
            <span>SYSTEM INTEGRITY</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}