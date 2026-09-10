"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { ROUNDS_CONFIG, ALL_PUZZLES } from "../puzzleData";

type DoorItem = {
  doorNumber?: number;
  solved: boolean;
  fragment?: string;
};

type Props = {
  round?: 1 | 2 | 3;
  teamName?: string;
  doors?: DoorItem[];
  fragments?: string[];
  onComplete: () => void;
};

const ACCESS_SECTORS: Record<1 | 2 | 3, string> = {
  1: "PERIMETER ACCESS VERIFIED",
  2: "CORE ACCESS VERIFIED",
  3: "FINAL PROTOCOL VERIFIED",
};

export default function MasterKey({
  round = 1,
  teamName,
  doors,
  fragments,
  onComplete,
}: Props) {
  const roundCfg = ROUNDS_CONFIG[round] || ROUNDS_CONFIG[1];
  const offset = (round - 1) * 6;
  const roundPuzzles = useMemo(() => ALL_PUZZLES.slice(offset, offset + 6), [offset]);

  // Determine the 6 door codes
  const doorList = useMemo(() => {
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const p = roundPuzzles[i];
      const doorNum = p?.doorNumber || offset + i + 1;
      const expectedCode = roundCfg.masterKeyOrder[i];
      const isSolved = doors?.[i]?.solved ?? Boolean(fragments?.[i]);
      const code = isSolved ? (doors?.[i]?.fragment || fragments?.[i] || expectedCode) : null;
      return {
        index: i,
        doorNumber: doorNum,
        doorLabel: `DOOR ${String(doorNum).padStart(2, "0")}`,
        isSolved,
        code,
        expectedCode,
      };
    });
  }, [roundPuzzles, offset, roundCfg.masterKeyOrder, doors, fragments]);

  // Initialize input slots with acquired codes (auto-fill behavior)
  const [slots, setSlots] = useState<string[]>(() => {
    return doorList.map((d) => (d.isSolved && d.code ? d.code.slice(0, 3) : ""));
  });

  // Re-sync slots if doorList updates
  useEffect(() => {
    setSlots((prev) =>
      doorList.map((d, i) => (prev[i] || (d.isSolved && d.code ? d.code.slice(0, 3) : "")))
    );
  }, [doorList]);

  const [submitting, setSubmitting] = useState(false);
  const [statusState, setStatusState] = useState<null | "granted" | "denied">(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first empty slot or first slot on mount
  useEffect(() => {
    const firstEmpty = slots.findIndex((s) => s.length < 3);
    const targetIdx = firstEmpty !== -1 ? firstEmpty : 0;
    const t = setTimeout(() => inputRefs.current[targetIdx]?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const updateSlot = (index: number, val: string) => {
    if (submitting) return;
    const clean = val.replace(/[^0-9A-Za-z]/g, "").slice(0, 3);
    const next = [...slots];
    next[index] = clean;
    setSlots(next);
    if (statusState === "denied") setStatusState(null);

    // Auto-advance to next input when 3 digits are entered
    if (clean.length === 3 && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleUnlock();
      return;
    }
    if (e.key === "Backspace" && !slots[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted) return;

    // Check if pasted value contains hyphen/space delimiters
    let chunks: string[] = [];
    if (pasted.includes("-")) {
      chunks = pasted.split("-").map((s) => s.replace(/[^0-9A-Za-z]/g, "").slice(0, 3));
    } else if (pasted.includes(" ")) {
      chunks = pasted.split(/\s+/).map((s) => s.replace(/[^0-9A-Za-z]/g, "").slice(0, 3));
    } else if (pasted.length === 18 && /^\d{18}$/.test(pasted)) {
      for (let i = 0; i < 18; i += 3) {
        chunks.push(pasted.slice(i, i + 3));
      }
    } else {
      chunks = [pasted.replace(/[^0-9A-Za-z]/g, "").slice(0, 3)];
    }

    const next = [...slots];
    for (let i = 0; i < chunks.length && index + i < 6; i++) {
      if (chunks[i]) next[index + i] = chunks[i];
    }
    setSlots(next);
    const targetIdx = Math.min(5, index + chunks.length);
    inputRefs.current[targetIdx]?.focus();
  };

  const handleUnlock = async () => {
    if (submitting) return;

    const filled = slots.every((s) => s.length === 3);
    if (!filled) {
      setStatusState("denied");
      setErrorMessage("PLEASE ENTER ALL SIX 3-DIGIT CODES.");
      return;
    }

    setSubmitting(true);
    setStatusState(null);
    setErrorMessage("");

    const allMatch = slots.every(
      (s, i) => s.toUpperCase() === roundCfg.masterKeyOrder[i].toUpperCase()
    );

    try {
      // Direct authoritative backend validation
      const res = await fetch("/api/game/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: teamName || "TEAM",
          round,
          sequence: slots,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.accepted) {
        setStatusState("granted");
        setTimeout(() => {
          onComplete();
        }, 2200);
        return;
      }

      // If backend explicitly rejected due to wrong codes (and not a server/DB setup error)
      if (data && data.accepted === false && data.error && !data.error.includes("DATABASE") && !allMatch) {
        setStatusState("denied");
        setErrorMessage(data.error);
        setSubmitting(false);
        return;
      }

      // If the 6 entered codes match the master key exactly:
      if (allMatch) {
        setStatusState("granted");
        setTimeout(() => {
          onComplete();
        }, 2200);
        return;
      }

      setStatusState("denied");
      setErrorMessage(data?.error || "MASTER KEY INVALID\nVERIFY DOOR CODES AND THEIR ORDER.");
      setSubmitting(false);
    } catch {
      // Fallback local check if offline
      if (allMatch) {
        setStatusState("granted");
        setTimeout(() => onComplete(), 2200);
      } else {
        setStatusState("denied");
        setErrorMessage("MASTER KEY INVALID\nVERIFY DOOR CODES AND THEIR ORDER.");
        setSubmitting(false);
      }
    }
  };

  const allSolved = doorList.every((d) => d.isSolved);

  return (
    <div className="er-screen mk-screen-root">
      <div className="mk-wrap" style={{ maxWidth: 880, margin: "0 auto", padding: "30px 20px" }}>
        <div className="mk-terminal">
          {/* Header */}
          <div className="mk-header">
            <span className="mk-label">SECURITY CONSOLE // MASTER KEY PROTOCOL</span>
            <span className="mk-status">
              {allSolved ? "6/6 CODES ACQUIRED" : `${doorList.filter((d) => d.isSolved).length}/6 CODES ACQUIRED`}
            </span>
          </div>

          <div className="mk-body" style={{ padding: "28px 32px" }}>
            <div className="mk-title" style={{ letterSpacing: 4, textAlign: "center" }}>
              ROUND 0{round} MASTER KEY
            </div>
            <div className="mk-subtitle" style={{ textAlign: "center", letterSpacing: 2, marginBottom: 20 }}>
              COLLECT ALL SIX DOOR CODES
            </div>

            <div className="er-divider" style={{ margin: "16px 0 24px" }} />

            {/* Collected Door Codes Display (Door Order 01 - 06) */}
            <div className="mk-door-codes-grid">
              {doorList.map((d) => (
                <div key={d.doorNumber} className={`mk-code-card ${d.isSolved ? "solved" : "locked"}`}>
                  <div className="mk-card-door">{d.doorLabel}</div>
                  <div className="mk-card-code">
                    {d.isSolved && d.code ? (
                      <span className="mk-code-val">[ {d.code} ]</span>
                    ) : (
                      <span className="mk-code-locked">[ ??? ]</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="er-divider" style={{ margin: "24px 0" }} />

            {/* Master Key Input Section */}
            <div className="mk-input-section">
              <div className="mk-section-heading">ENTER MASTER KEY</div>
              <div className="mk-section-sub">CODES MUST BE ENTERED IN EXACT DOOR ORDER</div>

              {/* 6 separate 3-digit boxes with dash separators */}
              <div className="mk-slots-container">
                {slots.map((val, i) => {
                  const d = doorList[i];
                  return (
                    <div key={d.doorNumber} className="mk-slot-wrapper">
                      <div className="mk-slot-header">{d.doorLabel}</div>
                      <div className="mk-slot-box-row">
                        <input
                          ref={(el) => { inputRefs.current[i] = el; }}
                          type="text"
                          maxLength={3}
                          className={`mk-digit-input ${statusState === "granted" ? "granted" : ""} ${statusState === "denied" ? "denied" : ""}`}
                          value={val}
                          placeholder={d.isSolved && d.code ? d.code : "___"}
                          onChange={(e) => updateSlot(i, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(i, e)}
                          onPaste={(e) => handlePaste(i, e)}
                          disabled={submitting || statusState === "granted"}
                          autoComplete="off"
                          spellCheck={false}
                        />
                        {i < 5 && <span className="mk-dash-separator">-</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Unlock Action Button */}
              {statusState !== "granted" && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
                  <button
                    className="mk-btn mk-unlock-btn"
                    onClick={handleUnlock}
                    disabled={submitting || slots.some((s) => s.length < 3)}
                  >
                    {submitting ? "VERIFYING CODES..." : "[ UNLOCK ]"}
                  </button>
                </div>
              )}

              {/* Denial / Error feedback */}
              {statusState === "denied" && (
                <div className="mk-alert-banner denied">
                  <div className="mk-alert-title">
                    {errorMessage && !errorMessage.includes("INVALID") ? "SUBMISSION NOTICE" : "MASTER KEY INVALID"}
                  </div>
                  <div className="mk-alert-desc">
                    {errorMessage || "VERIFY DOOR CODES AND THEIR ORDER. ALL PROGRESS REMAINS INTACT."}
                  </div>
                </div>
              )}

              {/* Acceptance feedback */}
              {statusState === "granted" && (
                <div className="mk-alert-banner granted">
                  <div className="mk-alert-title">MASTER KEY ACCEPTED</div>
                  <div className="mk-alert-desc">{ACCESS_SECTORS[round]}</div>
                  <div className="mk-alert-sub">ROUND COMPLETE. ADVANCING TELEMETRY...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
