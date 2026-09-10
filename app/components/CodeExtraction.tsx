"use client";

import { useState, useEffect } from "react";

type Props = {
  fragment: string;
  doorNumber: number;
  onComplete: () => void;
};

export default function CodeExtraction({ fragment, doorNumber, onComplete }: Props) {
  const [phase, setPhase] = useState(-1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => setPhase(0), 100));
    timers.push(setTimeout(() => setPhase(1), 600));
    timers.push(setTimeout(() => setPhase(2), 1200));
    timers.push(setTimeout(() => setPhase(3), 2200));
    timers.push(setTimeout(() => setPhase(4), 2800));
    timers.push(setTimeout(() => setPhase(5), 3500));
    timers.push(setTimeout(() => onComplete(), 4200));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  useEffect(() => {
    if (phase < 2) return;
    const start = Date.now();
    const duration = 1000;
    let raf: number;

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(1, elapsed / duration);
      setProgress(pct);
      if (pct < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(5,5,5,0.95)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    letterSpacing: "0.05em",
  };

  const contentStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "18px",
    maxWidth: "600px",
    width: "90%",
  };

  const lineStyle = (visible: boolean): React.CSSProperties => ({
    color: "#E8E3D8",
    fontSize: "14px",
    fontWeight: 500,
    textTransform: "uppercase",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(6px)",
    transition: "opacity 0.4s ease, transform 0.4s ease",
    textAlign: "center",
    width: "100%",
  });

  const progressBarTrackStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "420px",
    height: "3px",
    background: "#1a1a1a",
    borderRadius: "2px",
    overflow: "hidden",
    opacity: phase >= 2 ? 1 : 0,
    transition: "opacity 0.3s ease",
  };

  const progressBarFillStyle: React.CSSProperties = {
    height: "100%",
    width: `${progress * 100}%`,
    background: "linear-gradient(90deg, #8B6914, #D69A45, #8B6914)",
    borderRadius: "2px",
    boxShadow: "0 0 8px rgba(214,154,69,0.4)",
    transition: "width 0.05s linear",
  };

  const fragmentStyle: React.CSSProperties = {
    color: "#D69A45",
    fontSize: "clamp(42px, 8vw, 72px)",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontWeight: 700,
    letterSpacing: "0.15em",
    textShadow:
      "0 0 20px rgba(214,154,69,0.5), 0 0 40px rgba(214,154,69,0.2), 0 0 80px rgba(214,154,69,0.1)",
    opacity: phase >= 4 ? 1 : 0,
    transform: phase >= 4 ? "scale(1)" : "scale(0.85)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
    textAlign: "center",
    padding: "12px 0",
  };

  const securedStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    opacity: phase >= 5 ? 1 : 0,
    transition: "opacity 0.4s ease",
  };

  const greenDotStyle: React.CSSProperties = {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#72D08A",
    boxShadow: "0 0 8px rgba(114,208,138,0.6), 0 0 16px rgba(114,208,138,0.3)",
    animation: phase >= 5 ? "ce-pulse 1.5s ease-in-out infinite" : "none",
  };

  return (
    <>
      <style>{`
        @keyframes ce-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
        @keyframes ce-scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
      <div className="ce-overlay" style={overlayStyle}>
        <div className="ce-content" style={contentStyle}>
          <div className="ce-line" style={lineStyle(phase >= 0)}>
            ANSWER ACCEPTED
          </div>

          <div className="ce-line" style={lineStyle(phase >= 1)}>
            SECURITY NODE VERIFIED
          </div>

          <div className="ce-line" style={lineStyle(phase >= 2)}>
            EXTRACTING DOOR CODE...
          </div>

          <div className="ce-progress" style={progressBarTrackStyle}>
            <div style={progressBarFillStyle} />
          </div>

          <div className="ce-line" style={lineStyle(phase >= 3)}>
            EXTRACTION COMPLETE
          </div>

          <div className="ce-fragment" style={fragmentStyle}>
            {fragment}
          </div>

          <div className="ce-secured" style={securedStyle}>
            <div style={greenDotStyle} />
            <span style={{ color: "#72D08A", fontSize: "13px", fontWeight: 600, textTransform: "uppercase" }}>
              DOOR CODE SECURED
            </span>
          </div>

          <div
            style={{
              opacity: phase >= 1 ? 0.3 : 0,
              transition: "opacity 0.5s ease",
              fontSize: "11px",
              color: "#E8E3D8",
              marginTop: "8px",
            }}
          >
            DOOR {doorNumber} &middot; NODE ACTIVE
          </div>
        </div>
      </div>
    </>
  );
}
