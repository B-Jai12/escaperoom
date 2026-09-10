"use client";

type Props = {
  teamName: string;
  onRetry: () => void;
};

export default function TimeUpScreen({ teamName, onRetry }: Props) {
  return (
    <div className="er-complete er-timeup">
      <div className="ct">TIME'S UP.</div>
      <div className="cs">LOCKDOWN ENGAGED — THE BUNKER HAS SEALED.</div>
      <div className="er-divider" style={{ width: 300, margin: "30px auto" }} />
      <div className="info">
        TEAM: {teamName}
        <br />
        STATUS: FAILED TO BREACH ALL NODES
        <br />
        ROUND 01 — PERIMETER BREACH: UNRESOLVED
      </div>
      <button className="er-return" onClick={onRetry} style={{ marginTop: 34 }}>
        RETRY ROUND 01 →
      </button>
      <div className="end">THE FLOOR IS YOURS. THE CLOCK ISN'T.</div>
    </div>
  );
}