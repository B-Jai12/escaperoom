"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Puzzle } from "../../puzzleData";
import CodeExtraction from "../CodeExtraction";

type Props = {
  puzzle: Puzzle;
  index: number;
  timeLeft: number;
  onSolve: (index: number) => void;
  onExit: () => void;
  onAttempt: (index: number) => void;
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MechanicalWall({ puzzle, index, timeLeft, onSolve, onExit, onAttempt }: Props) {
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<null | "granted" | "denied">(null);
  const [boot, setBoot] = useState(true);
  const [bootFade, setBootFade] = useState(false);
  const [bootText, setBootText] = useState("");
  const [gearSpin, setGearSpin] = useState(0);
  const [extractionPhase, setExtractionPhase] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const full = `BUNKER ${String(puzzle.doorNumber || index + 1).padStart(2, "0")} SECURED — MECHANICAL VAULT`;
    let i = 0;
    const iv = window.setInterval(() => {
      i++;
      setBootText(full.slice(0, i));
      if (i >= full.length) {
        window.clearInterval(iv);
        window.setTimeout(() => setBootFade(true), 300);
        window.setTimeout(() => setBoot(false), 600);
      }
    }, 18);
    return () => window.clearInterval(iv);
  }, [index]);

  useEffect(() => {
    if (boot) return;
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, [boot]);

  useEffect(() => {
    const iv = setInterval(() => setGearSpin((g) => g + 1), 80);
    return () => clearInterval(iv);
  }, []);

  const submit = () => {
    const val = answer.trim().toUpperCase();
    if (!val) return;
    if (val === puzzle.answer.toUpperCase()) {
      setResult("granted");
      setExtractionPhase(true);
      inputRef.current?.blur();
    } else {
      setResult("denied");
      onAttempt(index);
      setAnswer("");
      inputRef.current?.focus();
    }
  };

  const tenMinRemaining = 35 * 60;
  const hintLocked = timeLeft > tenMinRemaining;
  const hintUnlockCountdown = timeLeft - tenMinRemaining;
  const handleExtractionDone = useCallback(() => setExtractionPhase(false), []);

  return (
    <div className="er-screen er-screen-vault">
      <button className="er-back" onClick={onExit}>&lt; ABORT MISSION</button>

      {/* mechanical environment */}
      <div className="pm-env">
        <div className="pm-plate pm-plate-tl" />
        <div className="pm-plate pm-plate-tr" />
        <div className="pm-plate pm-plate-bl" />
        <div className="pm-plate pm-plate-br" />
        <div className="pm-gear pm-gear-1" style={{ transform: `rotate(${gearSpin * 3}deg)` }} />
        <div className="pm-gear pm-gear-2" style={{ transform: `rotate(${-gearSpin * 2.4}deg)` }} />
        <div className="pm-gear pm-gear-3" style={{ transform: `rotate(${gearSpin * 1.8}deg)` }} />
        <div className="pm-rivet pm-rivet-1" />
        <div className="pm-rivet pm-rivet-2" />
        <div className="pm-rivet pm-rivet-3" />
        <div className="pm-rivet pm-rivet-4" />
        <div className="pm-chain pm-chain-l" />
        <div className="pm-chain pm-chain-r" />
        <div className="pm-pipe pm-pipe-top" />
        <div className="pm-pipe pm-pipe-bot" />
        <div className="pm-indicator pm-indicator-1" />
        <div className="pm-indicator pm-indicator-2" />
        <div className="pm-shadow-overlay" />
      </div>

      {/* vault panel */}
      <div className="pm-monitor-outer">
        <div className="pm-vault-frame">
          <div className="pm-vault-label">PATTERN RECOGNITION VAULT — NODE {String(index + 1).padStart(2, "0")}</div>
          <div className="pm-vault-screen">
            <div className="pm-scanlines" />
            <div className="pm-crt-content">
              <div className="pm-header">
                <span className="pm-type-badge">⚡ {puzzle.type}</span>
                <span className={`pm-timer ${timeLeft <= 300 ? "pm-timer-low" : ""}`}>TIME {fmt(timeLeft)}</span>
              </div>

              <div className="pm-title">{puzzle.title}</div>
              <div className="pm-desc">{puzzle.desc}</div>
              <div className="er-divider" />
              <div className="pm-pcontent" dangerouslySetInnerHTML={{ __html: puzzle.content }} />

              <div className="pm-anslabel">&gt; DECODE THE SEQUENCE:</div>
              <div className="pm-ansrow">
                <input
                  ref={inputRef}
                  className="pm-answer"
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value); if (result === "denied") setResult(null); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="ENTER THE NEXT VALUE..."
                  autoComplete="off"
                  spellCheck={false}
                  disabled={result === "granted"}
                />
                <button className="pm-submit" onClick={submit} disabled={result === "granted"}>DECODE</button>
              </div>

              {result !== "granted" && (
                <>
                  {!showHint && !hintLocked && (
                    <button className="pm-hintbtn" onClick={() => setShowHint(true)}>◈ REQUEST INTEL BRIEF</button>
                  )}
                  {!showHint && hintLocked && (
                    <button className="pm-hintbtn locked" disabled>◈ INTEL BRIEF LOCKED ({fmt(hintUnlockCountdown)})</button>
                  )}
                  {showHint && <div className="pm-hinttext">⚠ INTEL BRIEF: {puzzle.hint}</div>}
                </>
              )}

              {result === "granted" && !extractionPhase && (
                <>
                  <div className="pm-result granted">
                    <div className="rt">VAULT DECODED.</div>
                    <div className="rs">DOOR CODE ACQUIRED.</div>
                    <div className="rf">DOOR {String(puzzle.doorNumber || index + 1).padStart(2, "0")} CODE: {puzzle.fragment}</div>
                  </div>
                  <button className="pm-continue" onClick={() => onSolve(index)}>PROCEED TO CORRIDOR</button>
                </>
              )}

              {result === "denied" && (
                <div className="pm-result denied">
                  <div className="rt">DECODE FAILED.</div>
                  <div className="rs">INCORRECT VALUE. TRY AGAIN.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {result === "granted" && extractionPhase && (
        <CodeExtraction fragment={puzzle.fragment} doorNumber={index + 1} onComplete={handleExtractionDone} />
      )}

      {boot && (
        <div className={`pm-boot ${bootFade ? "fade" : ""}`}>
          <div className="pm-boot-line">
            <span className="pm-boot-caret">&gt;</span> {bootText}
            <span className="pm-boot-cursor" />
          </div>
        </div>
      )}
    </div>
  );
}
