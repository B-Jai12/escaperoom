"use client";

type Props = {
  index: number;
  breached: boolean;
  flaring: boolean;
  onOpen: (index: number) => void;
};

export default function Portal({ index, breached, flaring, onOpen }: Props) {
  const num = String(index + 1).padStart(2, "0");

  return (
    <div
      className={`er-portal ${breached ? "breached" : ""} ${flaring ? "flaring" : ""}`}
      onClick={() => !breached && onOpen(index)}
      title={breached ? `PORTAL ${num} — BREACHED` : `PORTAL ${num}`}
    >
      <div className="er-portal-halo" />
      <div className="er-portal-light" />
      <div className="er-portal-frame">
        <div className="er-portal-corners" />
        <div className="er-portal-void" />
      </div>
      {/* doorway glow that spills across the floor */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -46,
          width: 300,
          height: 70,
          transform: "translateX(-50%)",
          background: breached
            ? "radial-gradient(ellipse at center, rgba(255,180,84,0.5), transparent 70%)"
            : "radial-gradient(ellipse at center, rgba(255,180,84,0.18), transparent 70%)",
          filter: "blur(6px)",
          pointerEvents: "none",
          zIndex: 4,
          transition: "opacity .5s",
          opacity: breached ? 1 : 0.4,
        }}
      />
      <div className="er-portal-status">{breached ? "BREACHED" : `NODE ${num}`}</div>
      <div className="er-portal-label">PORTAL {num}</div>
    </div>
  );
}