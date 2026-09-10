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

export default function InvestigationOffice({ puzzle, index, timeLeft, onSolve, onExit, onAttempt }: Props) {
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<null | "granted" | "denied">(null);
  const [boot, setBoot] = useState(true);
  const [bootFade, setBootFade] = useState(false);
  const [bootText, setBootText] = useState("");
  const [crtFlicker, setCrtFlicker] = useState(false);
  const [extractionPhase, setExtractionPhase] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const full = `BUNKER ${String(puzzle.doorNumber || index + 1).padStart(2, "0")} SECURED — INVESTIGATION OFFICE`;
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
    const iv = setInterval(() => {
      setCrtFlicker(true);
      setTimeout(() => setCrtFlicker(false), 60 + Math.random() * 80);
    }, 4000 + Math.random() * 3000);
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
    <div className="er-screen er-screen-office">
      <button className="er-back" onClick={onExit}>&lt; ABORT MISSION</button>

      {/* environmental layer */}
      <div className="po-env">
        <div className="po-desk" />
        <div className="po-lamp" />
        <div className="po-lamp-glow" />
        <div className="po-folder po-folder-1" />
        <div className="po-folder po-folder-2" />
        <div className="po-magnifier" />
        <div className="po-evidence po-evidence-1" />
        <div className="po-evidence po-evidence-2" />
        <div className="po-papers" />
        <div className="po-shadow-overlay" />
      </div>

      {/* CRT monitor */}
      <div className="po-monitor-outer">
        <div className="po-monitor-bezel">
          <div className="po-monitor-label">EVIDENCE TERMINAL — NODE {String(index + 1).padStart(2, "0")}</div>
          <div className={`po-crt ${crtFlicker ? "po-crt-flicker" : ""}`}>
            <div className="po-scanlines" />
            <div className="po-crt-glow" />
            <div className="po-crt-content">
              <div className="po-header">
                <span className="po-type-badge">{puzzle.type}</span>
                <span className={`po-timer ${timeLeft <= 300 ? "po-timer-low" : ""}`}>TIME {fmt(timeLeft)}</span>
              </div>

              <div className="po-title">{puzzle.title}</div>
              <div className="po-desc">{puzzle.desc}</div>
              <div className="er-divider" />
              <div className="po-pcontent" dangerouslySetInnerHTML={{ __html: puzzle.content }} />

              <div className="po-anslabel">&gt; ENTER ACCESS CODE:</div>
              <div className="po-ansrow">
                <input
                  ref={inputRef}
                  className="po-answer"
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value); if (result === "denied") setResult(null); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="DECODE AND ENTER..."
                  autoComplete="off"
                  spellCheck={false}
                  disabled={result === "granted"}
                />
                <button className="po-submit" onClick={submit} disabled={result === "granted"}>VERIFY</button>
              </div>

              {result !== "granted" && (
                <>
                  {!showHint && !hintLocked && (
                    <button className="po-hintbtn" onClick={() => setShowHint(true)}>◈ REQUEST INTEL BRIEF</button>
                  )}
                  {!showHint && hintLocked && (
                    <button className="po-hintbtn locked" disabled>◈ INTEL BRIEF LOCKED ({fmt(hintUnlockCountdown)})</button>
                  )}
                  {showHint && <div className="po-hinttext">⚠ INTEL BRIEF: {puzzle.hint}</div>}
                </>
              )}

              {result === "granted" && !extractionPhase && (
                <>
                  <div className="po-result granted">
                    <div className="rt">ACCESS GRANTED.</div>
                    <div className="rs">DOOR CODE ACQUIRED.</div>
                    <div className="rf">DOOR {String(puzzle.doorNumber || index + 1).padStart(2, "0")} CODE: {puzzle.fragment}</div>
                  </div>
                  <button className="po-continue" onClick={() => onSolve(index)}>PROCEED TO CORRIDOR</button>
                </>
              )}

              {result === "denied" && (
                <div className="po-result denied">
                  <div className="rt">ACCESS DENIED.</div>
                  <div className="rs">INCORRECT CODE. TRY AGAIN.</div>
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
        <div className={`po-boot ${bootFade ? "fade" : ""}`}>
          <div className="po-boot-line">
            <span className="po-boot-caret">&gt;</span> {bootText}
            <span className="po-boot-cursor" />
          </div>
        </div>
      )}
    </div>
  );
}
