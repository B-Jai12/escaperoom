"use client";

import { useEffect, useRef, useState } from "react";
import type { Puzzle } from "../puzzleData";

type Props = {
  puzzle: Puzzle;
  index: number;
  timeLeft: number;
  onSolve: (index: number) => void;
  onExit: () => void;
  onAttempt: (index: number) => void;
};

const TYPE_LABEL: Record<Puzzle["type"], string> = {
  GENERAL: "GENERAL KNOWLEDGE",
  PATTERN: "PATTERN RECOGNITION",
  CODE: "CODE READING",
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PuzzleRoom({ puzzle, index, timeLeft, onSolve, onExit, onAttempt }: Props) {
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<null | "granted" | "denied">(null);
  const [boot, setBoot] = useState(true);
  const [bootFade, setBootFade] = useState(false);
  const [bootText, setBootText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // terminal boot reveal: type the bunker line, then fade to the puzzle UI
  useEffect(() => {
    const full = `BUNKER ${String(index + 1).padStart(2, "0")} SECURED`;
    let i = 0;
    const iv = window.setInterval(() => {
      i++;
      setBootText(full.slice(0, i));
      if (i >= full.length) {
        window.clearInterval(iv);
        window.setTimeout(() => setBootFade(true), 260);
        window.setTimeout(() => setBoot(false), 520);
      }
    }, 22);
    return () => window.clearInterval(iv);
  }, [index]);

  useEffect(() => {
    if (boot) return;
    const t = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [boot]);

  const submit = () => {
    const val = answer.trim().toUpperCase();
    if (!val) return;
    if (val === puzzle.answer.toUpperCase()) {
      setResult("granted");
      inputRef.current?.blur();
    } else {
      setResult("denied");
      onAttempt(index);
      setAnswer("");
      inputRef.current?.focus();
    }
  };

  // INTEL BRIEF is locked for the first 10 minutes of the round.
  const tenMinRemaining = 35 * 60;
  const hintLocked = timeLeft > tenMinRemaining;
  const hintUnlockCountdown = timeLeft - tenMinRemaining;

  return (
    <div className="er-screen">
      <button className="er-back" onClick={onExit}>
        &lt; ABORT MISSION
      </button>

      <div className="er-wrap">
        <div style={{ height: 58 }} />
        <div className="er-monitor">
          <div className="er-mheader">
            <span className="cur">BUNKER {String(index + 1).padStart(2, "0")} — {TYPE_LABEL[puzzle.type]}</span>
            <div className="seam" />
            <span className={`cur ${timeLeft <= 300 ? "timer-low" : ""}`}>TIME {fmt(timeLeft)}</span>
          </div>
          <div className="er-mbody">
            <div className="er-ptitle">{puzzle.title}</div>
            <div className="er-pdesc">{puzzle.desc}</div>
            <div className="er-divider" />

            <div className="er-pcontent" dangerouslySetInnerHTML={{ __html: puzzle.content }} />

            <div className="er-anslabel">&gt; ENTER ACCESS CODE:</div>
            <div className="er-ansrow">
              <input
                ref={inputRef}
                className="er-answer"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  if (result === "denied") setResult(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="DECODE AND ENTER..."
                autoComplete="off"
                spellCheck={false}
                disabled={result === "granted"}
              />
              <button className="er-submit" onClick={submit} disabled={result === "granted"}>
                VERIFY
              </button>
            </div>

{result !== "granted" && (
                <>
                  {!showHint && !hintLocked && (
                    <button className="er-hintbtn" onClick={() => setShowHint(true)}>
                      ◈ REQUEST INTEL BRIEF
                    </button>
                  )}
                  {!showHint && hintLocked && (
                    <button className="er-hintbtn locked" disabled title="Available 10 minutes into the round">
                      ◈ INTEL BRIEF LOCKED ({fmt(hintUnlockCountdown)})
                    </button>
                  )}
                  {showHint && <div className="er-hinttext">⚠ INTEL BRIEF: {puzzle.hint}</div>}
                </>
              )}

            {result === "granted" && (
              <>
                <div className="er-result granted">
                  <div className="rt">ACCESS GRANTED.</div>
                  <div className="rs">CODE FRAGMENT ACQUIRED.</div>
                  <div className="rf">FRAGMENT {String(index + 1).padStart(2, "0")}: {puzzle.fragment}</div>
                </div>
                <button className="er-continue" onClick={() => onSolve(index)}>
                  RETURN TO CORRIDOR
                </button>
              </>
            )}

            {result === "denied" && (
              <div className="er-result denied">
                <div className="rt">ACCESS DENIED.</div>
                <div className="rs">INCORRECT CODE. TRY AGAIN.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {boot && (
        <div className={`er-boot ${bootFade ? "fade" : ""}`}>
          <div className="er-boot-line">
            <span className="er-boot-caret">&gt;</span> {bootText}
            <span className="er-boot-cursor" />
          </div>
        </div>
      )}
    </div>
  );
}