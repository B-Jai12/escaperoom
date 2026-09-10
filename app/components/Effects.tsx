"use client";

import { useEffect, useState } from "react";

// Subtle, cohesive atmosphere — no code rain, no harsh scanlines, no RGB glitch.

export function Grain() {
  return <div className="er-grain" />;
}

export function Vignette() {
  return <div className="er-vignette" />;
}

export function Ambient() {
  return <div className="er-ambient" />;
}

// Soft cinematic flash used at transitions (landing→corridor, portal→puzzle, etc).
// A gentle warm bloom that fades to reveal the next screen.
export function TransitionFlash({ fired, onDone }: { fired: boolean; onDone: () => void }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0 idle, 1 bloom held, 2 fading out

  useEffect(() => {
    if (!fired) return;
    setStage(1);
    const t = setTimeout(() => {
      setStage(2);
      setTimeout(onDone, 700);
    }, 620);
    return () => clearTimeout(t);
  }, [fired, onDone]);

  if (!fired) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9900,
        pointerEvents: "none",
        background:
          stage === 1
            ? "radial-gradient(ellipse at center, rgba(255,200,120,0.95), rgba(255,160,60,0.35) 45%, rgba(50,25,5,0.9) 100%)"
            : "rgba(5,3,1,1)",
        opacity: stage === 1 ? 1 : 0,
        transition: stage === 2 ? "opacity 0.7s ease" : "opacity 0.4s ease",
      }}
    />
  );
}