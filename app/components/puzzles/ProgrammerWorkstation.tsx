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

export default function ProgrammerWorkstation({ puzzle, index, timeLeft, onSolve, onExit, onAttempt }: Props) {
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<null | "granted" | "denied">(null);
  const [boot, setBoot] = useState(true);
  const [bootFade, setBootFade] = useState(false);
  const [bootText, setBootText] = useState("");
  const [cursorBlink, setCursorBlink] = useState(true);
  const [serverPulse, setServerPulse] = useState(0);
  const [extractionPhase, setExtractionPhase] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const full = `BUNKER ${String(puzzle.doorNumber || index + 1).padStart(2, "0")} SECURED — PROGRAMMER WORKSTATION`;
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
    const iv = setInterval(() => setCursorBlink((b) => !b), 530);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setServerPulse((p) => p + 1), 1200);
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
    <div className="er-screen er-screen-workstation">
      <button className="er-back" onClick={onExit}>&lt; ABORT MISSION</button>

      {/* workstation environment */}
      <div className="pw-env">
        <div className="pw-desk" />
        <div className="pw-monitor pw-monitor-l">
          <div className="pw-mini-screen">
            <div className="pw-mini-line" style={{ opacity: 0.3 + (serverPulse % 3) * 0.2 }} />
            <div className="pw-mini-line" style={{ opacity: 0.5 }} />
            <div className="pw-mini-line" style={{ opacity: 0.2 }} />
            <div className="pw-mini-line" style={{ opacity: 0.4 + (serverPulse % 2) * 0.3 }} />
          </div>
        </div>
        <div className="pw-monitor pw-monitor-r">
          <div className="pw-mini-screen pw-mini-green">
            <div className="pw-mini-line" style={{ opacity: 0.4 }} />
            <div className="pw-mini-line" style={{ opacity: 0.2 + (serverPulse % 4) * 0.15 }} />
            <div className="pw-mini-line" style={{ opacity: 0.6 }} />
          </div>
        </div>
        <div className="pw-keyboard" />
        <div className="pw-server pw-server-1">
          <div className="pw-server-led pw-led-on" style={{ opacity: serverPulse % 2 === 0 ? 1 : 0.3 }} />
          <div className="pw-server-led pw-led-blink" style={{ opacity: cursorBlink ? 1 : 0.2 }} />
          <div className="pw-server-led pw-led-on" />
        </div>
        <div className="pw-server pw-server-2">
          <div className="pw-server-led pw-led-blink" style={{ opacity: cursorBlink ? 0.3 : 1 }} />
          <div className="pw-server-led pw-led-on" />
          <div className="pw-server-led pw-led-blink" style={{ opacity: cursorBlink ? 1 : 0.3 }} />
        </div>
        <div className="pw-cables" />
        <div className="pw-coffee" />
        <div className="pw-shadow-overlay" />
      </div>

      {/* main terminal */}
      <div className="pw-monitor-outer">
        <div className="pw-terminal-frame">
          <div className="pw-terminal-label">CODE ANALYSIS TERMINAL — NODE {String(index + 1).padStart(2, "0")}</div>
          <div className="pw-terminal-screen">
            <div className="pw-scanlines" />
            <div className="pw-crt-content">
              <div className="pw-header">
                <span className="pw-type-badge">⌨ {puzzle.type}</span>
                <span className={`pw-timer ${timeLeft <= 300 ? "pw-timer-low" : ""}`}>TIME {fmt(timeLeft)}</span>
              </div>

              <div className="pw-title">{puzzle.title}</div>
              <div className="pw-desc">{puzzle.desc}</div>
              <div className="er-divider" />
              <div className="pw-pcontent" dangerouslySetInnerHTML={{ __html: puzzle.content }} />

              <div className="pw-anslabel">
                <span className="pw-prompt-char">$</span> ENTER OUTPUT:
              </div>
              <div className="pw-ansrow">
                <input
                  ref={inputRef}
                  className="pw-answer"
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value); if (result === "denied") setResult(null); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="type your answer here..."
                  autoComplete="off"
                  spellCheck={false}
                  disabled={result === "granted"}
                />
                <button className="pw-submit" onClick={submit} disabled={result === "granted"}>RUN</button>
              </div>

              {result !== "granted" && (
                <>
                  {!showHint && !hintLocked && (
                    <button className="pw-hintbtn" onClick={() => setShowHint(true)}>◈ REQUEST INTEL BRIEF</button>
                  )}
                  {!showHint && hintLocked && (
                    <button className="pw-hintbtn locked" disabled>◈ INTEL BRIEF LOCKED ({fmt(hintUnlockCountdown)})</button>
                  )}
                  {showHint && <div className="pw-hinttext">⚠ INTEL BRIEF: {puzzle.hint}</div>}
                </>
              )}

              {result === "granted" && !extractionPhase && (
                <>
                  <div className="pw-result granted">
                    <div className="rt">OUTPUT VERIFIED.</div>
                    <div className="rs">DOOR CODE ACQUIRED.</div>
                    <div className="rf">DOOR {String(puzzle.doorNumber || index + 1).padStart(2, "0")} CODE: {puzzle.fragment}</div>
                  </div>
                  <button className="pw-continue" onClick={() => onSolve(index)}>PROCEED TO CORRIDOR</button>
                </>
              )}

              {result === "denied" && (
                <div className="pw-result denied">
                  <div className="rt">RUNTIME ERROR.</div>
                  <div className="rs">INCORRECT OUTPUT. TRY AGAIN.</div>
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
        <div className={`pw-boot ${bootFade ? "fade" : ""}`}>
          <div className="pw-boot-line">
            <span className="pw-boot-caret">&gt;</span> {bootText}
            <span className="pw-boot-cursor" />
          </div>
        </div>
      )}
    </div>
  );
}
