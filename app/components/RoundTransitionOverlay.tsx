"use client";

import { useEffect, useState } from "react";

type Props = {
  active: boolean;
  fromRound: 1 | 2;
  onDone: () => void;
};

const TRANSITION_DATA = {
  1: {
    closedSector: "PERIMETER BREACH",
    newRound: 2,
    newSector: "THE CORE INFILTRATION",
    initText: "NETWORK CORE INITIALIZING...",
  },
  2: {
    closedSector: "CORE INFILTRATION",
    newRound: 3,
    newSector: "THE FINAL PROTOCOL",
    initText: "MAINFRAME RECURSION PROTOCOL INITIALIZING...",
  },
};

export default function RoundTransitionOverlay({ active, fromRound, onDone }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }

    setStep(1); // FACILITY LOCK
    const t1 = setTimeout(() => setStep(2), 800);   // SECTOR SEALED
    const t2 = setTimeout(() => setStep(3), 1600);  // CORE INITIALIZING
    const t3 = setTimeout(() => setStep(4), 2500);  // ACCESS GRANTED
    const t4 = setTimeout(() => {
      setStep(5);
      onDone();
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [active, onDone]);

  if (!active) return null;

  const data = TRANSITION_DATA[fromRound] || TRANSITION_DATA[1];

  return (
    <div className="rt-overlay">
      <div className="rt-scanline" />
      <div className="rt-content">
        <div className="rt-badge">⚠️ AUTOMATED EVENT PROTOCOL</div>

        {step >= 1 && <div className="rt-line alert">FACILITY LOCK ENGAGED</div>}
        {step >= 2 && <div className="rt-line">{data.closedSector} SEALED</div>}
        {step >= 3 && <div className="rt-line tech">{data.initText}</div>}
        {step >= 4 && (
          <div className="rt-line grant">
            <div className="grant-tag">ACCESS GRANTED</div>
            <div className="grant-name">ROUND 0{data.newRound} — {data.newSector}</div>
          </div>
        )}
      </div>
    </div>
  );
}