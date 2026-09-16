"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Props = {
  teamName: string;
  completionTime: number;
};

type GameTab = "memory" | "scramble" | "click";

/* ══════════════════════════════════════════════════════════════════════════════
   1. CIPHER MATRIX (Memory Match Redesign)
   Tactical 12-node security alignment with SVG glyphs & hardware-accelerated 3D flips.
   ══════════════════════════════════════════════════════════════════════════════ */

type GlyphKey = "cipher" | "node" | "quantum" | "signal" | "laser" | "vault";

const GLYPHS: { key: GlyphKey; name: string; icon: React.ReactNode }[] = [
  {
    key: "cipher",
    name: "CIPHER",
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1.5" />
      </svg>
    ),
  },
  {
    key: "node",
    name: "NODE",
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    key: "quantum",
    name: "QUANTUM",
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(30 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-30 12 12)" />
      </svg>
    ),
  },
  {
    key: "signal",
    name: "SIGNAL",
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.93 4.93a10 10 0 0 1 14.14 0" />
        <path d="M7.76 7.76a6 6 0 0 1 8.48 0" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 14v7" />
        <path d="M9 21h6" />
      </svg>
    ),
  },
  {
    key: "laser",
    name: "LASER",
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="22" y1="12" x2="18" y2="12" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="12" y1="22" x2="12" y2="18" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    key: "vault",
    name: "VAULT",
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="12" x2="15" y2="14" />
      </svg>
    ),
  },
];

type Card = {
  id: number;
  glyphKey: GlyphKey;
  flipped: boolean;
  matched: boolean;
};

function buildDeck(): Card[] {
  const pairs: GlyphKey[] = [];
  GLYPHS.forEach((g) => {
    pairs.push(g.key, g.key);
  });
  // Deterministic Fisher-Yates shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs.map((glyphKey, id) => ({
    id,
    glyphKey,
    flipped: false,
    matched: false,
  }));
}

function CipherMatrix() {
  const [cards, setCards] = useState<Card[]>(() => buildDeck());
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);

  // Synchronous interaction guards to prevent double-click / rapid multi-click desyncs
  const isLockedRef = useRef(false);
  const activeFlippedRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flipBackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length, [cards]);
  const isComplete = matchedCount === 12;

  // Timer lifecycle
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (flipBackTimeoutRef.current) clearTimeout(flipBackTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isComplete && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isComplete]);

  const handleCardClick = useCallback((id: number) => {
    // Synchronous guard check
    if (isLockedRef.current) return;
    if (activeFlippedRef.current.includes(id)) return;

    setCards((prev) => {
      const target = prev.find((c) => c.id === id);
      if (!target || target.matched || target.flipped) return prev;

      // Start timer on first move
      if (!startedRef.current) {
        startedRef.current = true;
        timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
      }

      const nextFlipped = [...activeFlippedRef.current, id];
      activeFlippedRef.current = nextFlipped;

      // Flip the target card
      const updated = prev.map((c) => (c.id === id ? { ...c, flipped: true } : c));

      if (nextFlipped.length === 2) {
        setMoves((m) => m + 1);
        const [firstId, secondId] = nextFlipped;
        const cardA = updated.find((c) => c.id === firstId);
        const cardB = updated.find((c) => c.id === secondId);

        if (cardA && cardB && cardA.glyphKey === cardB.glyphKey) {
          // MATCH
          activeFlippedRef.current = [];
          return updated.map((c) =>
            c.id === firstId || c.id === secondId ? { ...c, matched: true, flipped: true } : c
          );
        } else {
          // MISMATCH - Synchronously lock interactions until cards flip back
          isLockedRef.current = true;
          flipBackTimeoutRef.current = setTimeout(() => {
            setCards((curr) =>
              curr.map((c) =>
                c.id === firstId || c.id === secondId ? { ...c, flipped: false } : c
              )
            );
            activeFlippedRef.current = [];
            isLockedRef.current = false;
          }, 650);
          return updated;
        }
      }

      return updated;
    });
  }, []);

  const handleReset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (flipBackTimeoutRef.current) clearTimeout(flipBackTimeoutRef.current);
    timerRef.current = null;
    flipBackTimeoutRef.current = null;
    startedRef.current = false;
    isLockedRef.current = false;
    activeFlippedRef.current = [];
    setMoves(0);
    setTime(0);
    setCards(buildDeck());
  }, []);

  return (
    <div className="mg-cipher-container">
      {/* Telemetry Header */}
      <div className="mg-hud-bar">
        <div className="mg-hud-stat">
          <span className="mg-hud-label">MOVES</span>
          <span className="mg-hud-val">{moves}</span>
        </div>
        <div className="mg-hud-stat">
          <span className="mg-hud-label">ELAPSED</span>
          <span className="mg-hud-val">{time}s</span>
        </div>
        <div className="mg-hud-stat">
          <span className="mg-hud-label">ALIGNED</span>
          <span className="mg-hud-val">{matchedCount / 2} / 6</span>
        </div>
      </div>

      {isComplete && (
        <div className="mg-complete-banner">
          <span className="mg-complete-tag">SECURITY OVERRIDE CONFIRMED</span>
          <span className="mg-complete-detail">
            ALL 6 CIPHER NODES ALIGNED IN {moves} MOVES ({time}s)
          </span>
        </div>
      )}

      {/* 4x3 Tactical Card Matrix */}
      <div className="mg-card-grid">
        {cards.map((card) => {
          const glyph = GLYPHS.find((g) => g.key === card.glyphKey);
          return (
            <div
              key={card.id}
              className={`mg-card-wrapper ${card.flipped ? "is-flipped" : ""} ${card.matched ? "is-matched" : ""}`}
              onClick={() => handleCardClick(card.id)}
            >
              <div className="mg-card-inner">
                {/* Face Down (Card Back) */}
                <div className="mg-card-face mg-card-front">
                  <span className="mg-card-num">0{card.id + 1}</span>
                  <div className="mg-card-center-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                  <span className="mg-card-bracket bl" />
                  <span className="mg-card-bracket tr" />
                </div>

                {/* Face Up (Card Front / Symbol) */}
                <div className={`mg-card-face mg-card-back ${card.matched ? "matched" : ""}`}>
                  <div className="mg-glyph-icon">{glyph?.icon}</div>
                  <span className="mg-glyph-name">{glyph?.name}</span>
                  {card.matched && (
                    <div className="mg-matched-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mg-footer-actions">
        <button className="mg-btn secondary" onClick={handleReset}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          RE-INITIALIZE MATRIX
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   2. SIGNAL DECRYPT (Word Scramble Redesign)
   Tactile letter tile terminal with dual-mode input & double-submit protection.
   ══════════════════════════════════════════════════════════════════════════════ */

const WORDS: { answer: string; hint: string; sector: string }[] = [
  { answer: "BREACH", hint: "Unauthorized perimeter compromise", sector: "SECTOR-01" },
  { answer: "SIGNAL", hint: "Carrier frequency transmitted through antenna", sector: "SECTOR-02" },
  { answer: "CIPHER", hint: "Algorithmic transformation of plaintext", sector: "SECTOR-03" },
  { answer: "VAULT", hint: "Armored chamber guarding access codes", sector: "SECTOR-04" },
  { answer: "ESCAPE", hint: "Execution of emergency facility egress", sector: "SECTOR-05" },
  { answer: "DECODE", hint: "Translation of encrypted hex stream", sector: "SECTOR-06" },
  { answer: "MASTER", hint: "Root supervisory key controlling nodes", sector: "SECTOR-07" },
  { answer: "LAUNCH", hint: "Initiation sequence for protocol override", sector: "SECTOR-08" },
  { answer: "PHOTON", hint: "Laser optic transmission packet", sector: "SECTOR-09" },
  { answer: "MATRIX", hint: "Relational grid of interconnected nodes", sector: "SECTOR-10" },
];

function scramble(word: string): string[] {
  const arr = word.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (arr.join("") === word && word.length > 2) {
    [arr[0], arr[1]] = [arr[1], arr[0]];
  }
  return arr;
}

function SignalDecrypt() {
  const [wordIdx, setWordIdx] = useState(() => Math.floor(Math.random() * WORDS.length));
  const currentWord = WORDS[wordIdx];

  const [scrambledTiles, setScrambledTiles] = useState<string[]>(() => scramble(WORDS[wordIdx].answer));
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [evalState, setEvalState] = useState<"idle" | "correct" | "wrong">("idle");
  const [solvedCount, setSolvedCount] = useState(0);

  // Synchronous guard to eliminate double-submits
  const isSubmittingRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const reconstructedGuess = useMemo(() => {
    return selectedIndices.map((idx) => scrambledTiles[idx]).join("");
  }, [selectedIndices, scrambledTiles]);

  const advanceWord = useCallback(
    (wasCorrect: boolean) => {
      const nextIdx = (wordIdx + 1) % WORDS.length;
      setWordIdx(nextIdx);
      setScrambledTiles(scramble(WORDS[nextIdx].answer));
      setSelectedIndices([]);
      setEvalState("idle");
      isSubmittingRef.current = false;
    },
    [wordIdx]
  );

  const handleTileClick = useCallback((tileIndex: number) => {
    if (isSubmittingRef.current) return;
    setSelectedIndices((prev) => {
      if (prev.includes(tileIndex)) {
        return prev.filter((i) => i !== tileIndex);
      } else {
        return [...prev, tileIndex];
      }
    });
  }, []);

  const handleClearGuess = useCallback(() => {
    if (isSubmittingRef.current) return;
    setSelectedIndices([]);
  }, []);

  const handleSubmit = useCallback(() => {
    if (isSubmittingRef.current) return;
    if (reconstructedGuess.length === 0) return;

    isSubmittingRef.current = true;

    if (reconstructedGuess === currentWord.answer) {
      const pts = 100 + streak * 25;
      setScore((s) => s + pts);
      setStreak((s) => s + 1);
      setSolvedCount((c) => c + 1);
      setEvalState("correct");

      advanceTimerRef.current = setTimeout(() => {
        advanceWord(true);
      }, 700);
    } else {
      setStreak(0);
      setEvalState("wrong");

      advanceTimerRef.current = setTimeout(() => {
        setEvalState("idle");
        setSelectedIndices([]);
        isSubmittingRef.current = false;
      }, 750);
    }
  }, [reconstructedGuess, currentWord.answer, streak, advanceWord]);

  const handleSkip = useCallback(() => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setStreak(0);
    advanceWord(false);
  }, [advanceWord]);

  // Handle keyboard events (letters, backspace, enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmittingRef.current) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toUpperCase();
      if (key === "ENTER") {
        e.preventDefault();
        handleSubmit();
      } else if (key === "BACKSPACE") {
        e.preventDefault();
        setSelectedIndices((prev) => prev.slice(0, -1));
      } else if (/^[A-Z]$/.test(key)) {
        const matchIdx = scrambledTiles.findIndex(
          (char, idx) => char === key && !selectedIndices.includes(idx)
        );
        if (matchIdx !== -1) {
          setSelectedIndices((prev) => [...prev, matchIdx]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scrambledTiles, selectedIndices, handleSubmit]);

  return (
    <div className="mg-scramble-container">
      {/* Telemetry Header */}
      <div className="mg-hud-bar">
        <div className="mg-hud-stat">
          <span className="mg-hud-label">SIGNAL RATING</span>
          <span className="mg-hud-val highlight">{score} PTS</span>
        </div>
        <div className="mg-hud-stat">
          <span className="mg-hud-label">STREAK</span>
          <span className="mg-hud-val">{streak}x</span>
        </div>
        <div className="mg-hud-stat">
          <span className="mg-hud-label">DECRYPTED</span>
          <span className="mg-hud-val">{solvedCount}</span>
        </div>
      </div>

      {/* Origin Telemetry & Sector */}
      <div className="mg-telemetry-badge">
        <span className="pulse-dot" />
        <span>INCOMING INTERCEPT: {currentWord.sector}</span>
      </div>

      {/* Target Word Length Slots & Reconstructed Guess */}
      <div className={`mg-slots-wrapper ${evalState}`}>
        {Array.from({ length: currentWord.answer.length }).map((_, slotIdx) => {
          const char = reconstructedGuess[slotIdx] || "";
          return (
            <div
              key={slotIdx}
              className={`mg-slot ${char ? "filled" : "empty"} ${evalState}`}
              onClick={handleClearGuess}
            >
              {char}
            </div>
          );
        })}
      </div>

      {/* Hint Telemetry */}
      <div className="mg-hint-box">
        <span className="mg-hint-prefix">DECRYPTION HINT:</span>
        <span className="mg-hint-text">{currentWord.hint}</span>
      </div>

      {/* Interactive Letter Tiles Bank */}
      <div className="mg-tile-bank">
        {scrambledTiles.map((letter, idx) => {
          const isUsed = selectedIndices.includes(idx);
          return (
            <button
              key={idx}
              className={`mg-letter-tile ${isUsed ? "used" : ""}`}
              onClick={() => handleTileClick(idx)}
              disabled={isUsed || evalState !== "idle"}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Action Controls */}
      <div className="mg-action-row">
        <button
          className="mg-btn primary"
          onClick={handleSubmit}
          disabled={reconstructedGuess.length === 0 || evalState !== "idle"}
        >
          TRANSMIT DECRYPTION
        </button>
        <button
          className="mg-btn secondary"
          onClick={handleClearGuess}
          disabled={selectedIndices.length === 0 || evalState !== "idle"}
        >
          CLEAR
        </button>
        <button className="mg-btn subtle" onClick={handleSkip} disabled={evalState !== "idle"}>
          BYPASS
        </button>
      </div>

      <div className="mg-keyboard-tip">
        <span>TIP: CLICK TILES OR USE PHYSICAL KEYBOARD (TYPE TO SELECT, BACKSPACE TO UNDO, ENTER TO TRANSMIT)</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. NODE DEFENSE (Quick Click Redesign)
   Tactical sector radar with normalized percentage coordinates (0 layout calls).
   ══════════════════════════════════════════════════════════════════════════════ */

type DefenseTarget = {
  id: number;
  xPct: number; // 8% to 88%
  yPct: number; // 12% to 82%
  createdAt: number;
};

type DisruptFx = {
  id: number;
  xPct: number;
  yPct: number;
};

function NodeDefense() {
  const [targets, setTargets] = useState<DefenseTarget[]>([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [disrupts, setDisrupts] = useState<DisruptFx[]>([]);

  const targetIdRef = useRef(0);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTargetClickRef = useRef(false);

  const cleanupTimers = useCallback(() => {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    tickTimerRef.current = null;
    spawnTimerRef.current = null;
  }, []);

  useEffect(() => {
    return cleanupTimers;
  }, [cleanupTimers]);

  const spawnSingleTarget = useCallback(() => {
    const id = targetIdRef.current++;
    const xPct = 10 + Math.random() * 80;
    const yPct = 12 + Math.random() * 72;
    const newTarget: DefenseTarget = { id, xPct, yPct, createdAt: Date.now() };

    setTargets((prev) => {
      const cleaned = prev.filter((t) => Date.now() - t.createdAt < 2200);
      return [...cleaned, newTarget];
    });
  }, []);

  const handleStart = useCallback(() => {
    cleanupTimers();
    targetIdRef.current = 0;
    setTargets([]);
    setDisrupts([]);
    setHits(0);
    setMisses(0);
    setTimeLeft(25);
    setGameOver(false);
    setGameActive(true);

    spawnSingleTarget();

    tickTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          cleanupTimers();
          setGameActive(false);
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    spawnTimerRef.current = setInterval(() => {
      spawnSingleTarget();
    }, 650);
  }, [cleanupTimers, spawnSingleTarget]);

  const handleTargetClick = useCallback((e: React.MouseEvent, id: number, xPct: number, yPct: number) => {
    e.stopPropagation();
    isTargetClickRef.current = true;

    setTargets((prev) => prev.filter((t) => t.id !== id));
    setHits((h) => h + 1);

    const fxId = targetIdRef.current++;
    setDisrupts((prev) => [...prev, { id: fxId, xPct, yPct }]);
    setTimeout(() => {
      setDisrupts((curr) => curr.filter((fx) => fx.id !== fxId));
    }, 450);

    setTimeout(() => {
      isTargetClickRef.current = false;
    }, 50);
  }, []);

  const handleRadarAreaClick = useCallback(() => {
    if (!gameActive || isTargetClickRef.current) return;
    setMisses((m) => m + 1);
  }, [gameActive]);

  const accuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 100;

  return (
    <div className="mg-defense-container">
      {/* Telemetry Bar */}
      <div className="mg-hud-bar">
        <div className="mg-hud-stat">
          <span className="mg-hud-label">INTERCEPTED</span>
          <span className="mg-hud-val highlight">{hits}</span>
        </div>
        <div className="mg-hud-stat">
          <span className="mg-hud-label">ACCURACY</span>
          <span className="mg-hud-val">{accuracy}%</span>
        </div>
        <div className="mg-hud-stat">
          <span className="mg-hud-label">REMAINING</span>
          <span className="mg-hud-val alert">{timeLeft}s</span>
        </div>
      </div>

      {/* Tactical Radar Display Canvas */}
      <div className="mg-radar-field" onClick={handleRadarAreaClick}>
        <div className="mg-radar-grid" />
        <div className="mg-radar-ring outer" />
        <div className="mg-radar-ring middle" />
        <div className="mg-radar-ring inner" />
        <div className="mg-radar-sweep" />

        {!gameActive && !gameOver && (
          <div className="mg-radar-overlay">
            <div className="mg-radar-center-dialog">
              <span className="mg-dialog-title">SECTOR NODE DEFENSE</span>
              <span className="mg-dialog-desc">INTERCEPT ANOMALOUS CORE SPIKES BEFORE TIMEOUT</span>
              <button className="mg-btn primary" onClick={handleStart}>
                ENGAGE DEFENSE PROTOCOL
              </button>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="mg-radar-overlay">
            <div className="mg-radar-center-dialog">
              <span className="mg-dialog-title complete">PROTOCOL CONCLUDED</span>
              <div className="mg-debrief-stats">
                <div className="debrief-item">
                  <span className="label">NODES NEUTRALIZED:</span>
                  <span className="val">{hits}</span>
                </div>
                <div className="debrief-item">
                  <span className="label">INTERCEPT ACCURACY:</span>
                  <span className="val">{accuracy}%</span>
                </div>
                <div className="debrief-item">
                  <span className="label">DEFENSE SCORE:</span>
                  <span className="val highlight">{hits * 120 + accuracy * 5} PTS</span>
                </div>
              </div>
              <button className="mg-btn primary" onClick={handleStart}>
                RE-ENGAGE DEFENSE
              </button>
            </div>
          </div>
        )}

        {gameActive &&
          targets.map((t) => (
            <div
              key={t.id}
              className="mg-target-node"
              style={{ left: `${t.xPct}%`, top: `${t.yPct}%` }}
              onClick={(e) => handleTargetClick(e, t.id, t.xPct, t.yPct)}
            >
              <div className="mg-target-reticle" />
              <div className="mg-target-crosshair" />
              <div className="mg-target-ring" />
              <div className="mg-target-core" />
            </div>
          ))}

        {disrupts.map((fx) => (
          <div
            key={fx.id}
            className="mg-disrupt-pulse"
            style={{ left: `${fx.xPct}%`, top: `${fx.yPct}%` }}
          />
        ))}
      </div>

      <div className="mg-radar-legend">
        <span>SECTOR: 07-OMEGA</span>
        <span>RADAR FREQUENCY: 1420.4 MHZ</span>
        <span>STATUS: {gameActive ? "ENGAGED" : gameOver ? "STANDBY" : "READY"}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   4. ROOT MINI-GAMES HUB CONTAINER
   Matches exact interface <MiniGames teamName={teamName} completionTime={completionTimeSec} />
   ══════════════════════════════════════════════════════════════════════════════ */

const TABS: { key: GameTab; label: string; badge: string }[] = [
  { key: "memory", label: "CIPHER MATRIX", badge: "PROTOCOL-A" },
  { key: "scramble", label: "SIGNAL DECRYPT", badge: "PROTOCOL-B" },
  { key: "click", label: "NODE DEFENSE", badge: "PROTOCOL-C" },
];

export default function MiniGames({ teamName, completionTime }: Props) {
  const [activeTab, setActiveTab] = useState<GameTab>("memory");

  return (
    <div className="mg-root-screen">
      <style>{`
        .mg-root-screen {
          min-height: 100vh;
          width: 100%;
          background: #080706;
          color: #E8E3D8;
          font-family: var(--font-mono, "JetBrains Mono", monospace);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 16px 64px 16px;
          box-sizing: border-box;
          position: relative;
        }

        .mg-header-banner {
          text-align: center;
          margin-bottom: 24px;
          max-width: 680px;
          width: 100%;
        }

        .mg-header-title {
          font-family: var(--font-orbitron, "Orbitron", sans-serif);
          font-size: 16px;
          letter-spacing: 4px;
          color: #D69A45;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .mg-header-sub {
          font-size: 12px;
          color: #9B9488;
          letter-spacing: 2px;
          line-height: 1.6;
        }

        .mg-header-accent {
          color: #72D08A;
          font-weight: bold;
        }

        .mg-tabs-bar {
          display: flex;
          gap: 6px;
          background: #0d0c0a;
          border: 1px solid rgba(214, 154, 69, 0.25);
          border-radius: 6px;
          padding: 4px;
          margin-bottom: 24px;
          max-width: 680px;
          width: 100%;
        }

        .mg-tab-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 4px;
          color: #9B9488;
          cursor: pointer;
          transition: transform 0.12s ease, opacity 0.12s ease, background 0.12s ease;
          user-select: none;
        }

        .mg-tab-btn:hover {
          color: #E8E3D8;
          background: rgba(255, 255, 255, 0.03);
        }

        .mg-tab-btn.active {
          background: rgba(214, 154, 69, 0.12);
          border-color: rgba(214, 154, 69, 0.4);
          color: #D69A45;
        }

        .mg-tab-badge {
          font-size: 9px;
          letter-spacing: 1px;
          opacity: 0.7;
          margin-bottom: 2px;
        }

        .mg-tab-title {
          font-family: var(--font-orbitron, "Orbitron", sans-serif);
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: 700;
        }

        .mg-terminal-frame {
          max-width: 680px;
          width: 100%;
          min-height: 480px;
          background: #0d0c0a;
          border: 1px solid rgba(214, 154, 69, 0.3);
          border-radius: 8px;
          padding: 24px;
          box-sizing: border-box;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .mg-hud-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 16px;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          width: 100%;
        }

        .mg-hud-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .mg-hud-label {
          font-size: 10px;
          color: #9B9488;
          letter-spacing: 1.5px;
        }

        .mg-hud-val {
          font-family: var(--font-orbitron, "Orbitron", sans-serif);
          font-size: 15px;
          color: #E8E3D8;
          letter-spacing: 1.5px;
          font-weight: 700;
        }

        .mg-hud-val.highlight {
          color: #D69A45;
        }

        .mg-hud-val.alert {
          color: #ff5c4d;
        }

        .mg-btn {
          font-family: var(--font-orbitron, "Orbitron", sans-serif);
          font-size: 11px;
          letter-spacing: 2px;
          padding: 10px 18px;
          border-radius: 4px;
          cursor: pointer;
          transition: transform 0.12s ease, opacity 0.12s ease, background 0.12s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          outline: none;
        }

        .mg-btn:active {
          transform: scale(0.97);
        }

        .mg-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
        }

        .mg-btn.primary {
          background: rgba(214, 154, 69, 0.18);
          border: 1px solid rgba(214, 154, 69, 0.6);
          color: #D69A45;
        }

        .mg-btn.primary:hover:not(:disabled) {
          background: rgba(214, 154, 69, 0.28);
          border-color: #D69A45;
          color: #fff;
        }

        .mg-btn.secondary {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #9B9488;
        }

        .mg-btn.secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: #E8E3D8;
          border-color: rgba(255, 255, 255, 0.25);
        }

        .mg-btn.subtle {
          background: transparent;
          border: 1px dashed rgba(255, 255, 255, 0.1);
          color: #726b60;
        }

        .mg-btn.subtle:hover:not(:disabled) {
          color: #9B9488;
          border-color: rgba(255, 255, 255, 0.2);
        }

        /* Cipher Matrix Styles */
        .mg-cipher-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        .mg-complete-banner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: rgba(114, 208, 138, 0.08);
          border: 1px solid rgba(114, 208, 138, 0.3);
          border-radius: 4px;
          padding: 8px 16px;
          margin-bottom: 16px;
          width: 100%;
          box-sizing: border-box;
          animation: mg-banner-pop 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }

        @keyframes mg-banner-pop {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .mg-complete-tag {
          font-family: var(--font-orbitron, "Orbitron", sans-serif);
          font-size: 13px;
          color: #72D08A;
          letter-spacing: 2px;
          font-weight: 700;
        }

        .mg-complete-detail {
          font-size: 11px;
          color: #A3D8B3;
          letter-spacing: 1px;
        }

        .mg-card-grid {
          display: grid;
          grid-template-columns: repeat(4, 96px);
          grid-template-rows: repeat(3, 96px);
          gap: 12px;
          justify-content: center;
        }

        @media (max-width: 520px) {
          .mg-card-grid {
            grid-template-columns: repeat(4, 72px);
            grid-template-rows: repeat(3, 72px);
            gap: 8px;
          }
        }

        .mg-card-wrapper {
          width: 100%;
          height: 100%;
          perspective: 800px;
          cursor: pointer;
          user-select: none;
        }

        .mg-card-wrapper.is-matched {
          cursor: default;
        }

        .mg-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mg-card-wrapper.is-flipped .mg-card-inner {
          transform: rotateY(180deg);
        }

        .mg-card-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }

        .mg-card-front {
          background: #12100e;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #7a7368;
          position: relative;
          overflow: hidden;
          transition: border-color 0.15s ease;
        }

        .mg-card-wrapper:hover:not(.is-flipped):not(.is-matched) .mg-card-front {
          border-color: rgba(214, 154, 69, 0.5);
          color: #D69A45;
        }

        .mg-card-num {
          position: absolute;
          top: 6px;
          left: 8px;
          font-size: 9px;
          letter-spacing: 1px;
          opacity: 0.45;
        }

        .mg-card-center-icon {
          opacity: 0.35;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }

        .mg-card-wrapper:hover .mg-card-center-icon {
          opacity: 0.8;
          transform: scale(1.08);
        }

        .mg-card-bracket {
          position: absolute;
          width: 6px;
          height: 6px;
          border-color: rgba(214, 154, 69, 0.4);
          pointer-events: none;
        }
        .mg-card-bracket.bl {
          bottom: 4px;
          left: 4px;
          border-bottom: 1px solid;
          border-left: 1px solid;
        }
        .mg-card-bracket.tr {
          top: 4px;
          right: 4px;
          border-top: 1px solid;
          border-right: 1px solid;
        }

        .mg-card-back {
          transform: rotateY(180deg);
          background: #181512;
          border: 1px solid rgba(214, 154, 69, 0.5);
          color: #E8E3D8;
          position: relative;
        }

        .mg-card-back.matched {
          background: rgba(114, 208, 138, 0.07);
          border-color: rgba(114, 208, 138, 0.45);
          color: #72D08A;
        }

        .mg-glyph-icon {
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mg-glyph-name {
          font-size: 8px;
          letter-spacing: 1.5px;
          font-family: var(--font-orbitron, "Orbitron", sans-serif);
          opacity: 0.8;
        }

        .mg-matched-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 14px;
          height: 14px;
          background: rgba(114, 208, 138, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #72D08A;
        }

        .mg-footer-actions {
          margin-top: 24px;
        }

        /* Signal Decrypt Styles */
        .mg-scramble-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        .mg-telemetry-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: #9B9488;
          letter-spacing: 2px;
          margin-bottom: 20px;
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #72D08A;
          animation: mg-dot-pulse 1.2s infinite ease-in-out;
        }

        @keyframes mg-dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        .mg-slots-wrapper {
          display: flex;
          gap: 8px;
          margin-bottom: 18px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .mg-slot {
          width: 46px;
          height: 52px;
          background: #13110e;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-orbitron, "Orbitron", sans-serif);
          font-size: 22px;
          color: #E8E3D8;
          letter-spacing: 1px;
          cursor: pointer;
          transition: border-color 0.15s ease, transform 0.1s ease;
        }

        .mg-slot.filled {
          border-color: rgba(214, 154, 69, 0.6);
          color: #D69A45;
          background: rgba(214, 154, 69, 0.05);
        }

        .mg-slots-wrapper.correct .mg-slot {
          border-color: #72D08A;
          color: #72D08A;
          background: rgba(114, 208, 138, 0.12);
          transform: scale(1.04);
        }

        .mg-slots-wrapper.wrong .mg-slot {
          border-color: #ff5c4d;
          color: #ff5c4d;
          background: rgba(255, 92, 77, 0.1);
          animation: mg-slot-shake 0.35s ease;
        }

        @keyframes mg-slot-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }

        .mg-hint-box {
          display: flex;
          gap: 8px;
          font-size: 12px;
          color: #9B9488;
          margin-bottom: 24px;
          text-align: center;
          max-width: 480px;
        }

        .mg-hint-prefix {
          color: #D69A45;
          font-weight: bold;
          letter-spacing: 1px;
          white-space: nowrap;
        }

        .mg-hint-text {
          letter-spacing: 0.5px;
          line-height: 1.4;
        }

        .mg-tile-bank {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .mg-letter-tile {
          width: 44px;
          height: 48px;
          background: #181512;
          border: 1px solid rgba(214, 154, 69, 0.35);
          border-radius: 4px;
          color: #E8E3D8;
          font-family: var(--font-orbitron, "Orbitron", sans-serif);
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s ease, opacity 0.15s ease, background 0.15s ease;
          user-select: none;
        }

        .mg-letter-tile:hover:not(:disabled) {
          border-color: #D69A45;
          background: rgba(214, 154, 69, 0.15);
          transform: translateY(-2px);
        }

        .mg-letter-tile:active:not(:disabled) {
          transform: translateY(1px);
        }

        .mg-letter-tile.used {
          opacity: 0.2;
          cursor: not-allowed;
          border-color: rgba(255, 255, 255, 0.08);
          transform: none;
        }

        .mg-action-row {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }

        .mg-keyboard-tip {
          font-size: 9px;
          color: rgba(155, 148, 136, 0.5);
          letter-spacing: 1px;
          text-align: center;
          max-width: 440px;
        }

        /* Node Defense Styles */
        .mg-defense-container {
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        .mg-radar-field {
          width: 100%;
          height: 340px;
          background: #090807;
          border: 1px solid rgba(214, 154, 69, 0.25);
          border-radius: 6px;
          position: relative;
          overflow: hidden;
          cursor: crosshair;
          user-select: none;
        }

        .mg-radar-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(214, 154, 69, 0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(214, 154, 69, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .mg-radar-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          border: 1px dashed rgba(214, 154, 69, 0.12);
          pointer-events: none;
        }

        .mg-radar-ring.outer { width: 300px; height: 300px; }
        .mg-radar-ring.middle { width: 190px; height: 190px; }
        .mg-radar-ring.inner { width: 90px; height: 90px; }

        .mg-radar-sweep {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 320px;
          height: 320px;
          margin-top: -160px;
          margin-left: -160px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(214, 154, 69, 0.08) 0deg, transparent 60deg, transparent 360deg);
          animation: mg-radar-rot 4s linear infinite;
          pointer-events: none;
        }

        @keyframes mg-radar-rot {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .mg-radar-overlay {
          position: absolute;
          inset: 0;
          background: rgba(9, 8, 7, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .mg-radar-center-dialog {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          padding: 24px;
        }

        .mg-dialog-title {
          font-family: var(--font-orbitron, "Orbitron", sans-serif);
          font-size: 16px;
          letter-spacing: 3px;
          color: #D69A45;
          font-weight: 700;
        }

        .mg-dialog-title.complete {
          color: #72D08A;
        }

        .mg-dialog-desc {
          font-size: 11px;
          color: #9B9488;
          letter-spacing: 1.5px;
          max-width: 300px;
        }

        .mg-debrief-stats {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin: 8px 0;
          width: 240px;
        }

        .debrief-item {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          letter-spacing: 1px;
        }

        .debrief-item .label { color: #9B9488; }
        .debrief-item .val { color: #E8E3D8; font-weight: bold; }
        .debrief-item .val.highlight { color: #72D08A; }

        .mg-target-node {
          position: absolute;
          width: 48px;
          height: 48px;
          margin-left: -24px;
          margin-top: -24px;
          cursor: crosshair;
          z-index: 5;
          animation: mg-target-spawn 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }

        @keyframes mg-target-spawn {
          from { transform: scale(0.4); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .mg-target-reticle {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(255, 92, 77, 0.8);
          border-radius: 50%;
          animation: mg-reticle-pulse 0.7s infinite alternate ease-in-out;
        }

        @keyframes mg-reticle-pulse {
          from { transform: scale(0.92); border-color: rgba(255, 92, 77, 0.6); }
          to { transform: scale(1.08); border-color: rgba(255, 92, 77, 1); }
        }

        .mg-target-ring {
          position: absolute;
          inset: 4px;
          border: 1px dashed rgba(214, 154, 69, 0.7);
          border-radius: 50%;
          animation: mg-ring-rot 2.2s linear infinite;
        }

        @keyframes mg-ring-rot {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .mg-target-crosshair {
          position: absolute;
          inset: 0;
        }
        .mg-target-crosshair::before,
        .mg-target-crosshair::after {
          content: "";
          position: absolute;
          background: rgba(255, 92, 77, 0.7);
        }
        .mg-target-crosshair::before {
          left: 50%;
          top: 0;
          bottom: 0;
          width: 1px;
          transform: translateX(-50%);
        }
        .mg-target-crosshair::after {
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          transform: translateY(-50%);
        }

        .mg-target-core {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          margin-top: -4px;
          margin-left: -4px;
          background: #ff5c4d;
          border-radius: 50%;
          box-shadow: 0 0 6px #ff5c4d;
        }

        .mg-disrupt-pulse {
          position: absolute;
          width: 54px;
          height: 54px;
          margin-left: -27px;
          margin-top: -27px;
          border-radius: 50%;
          border: 2px solid #72D08A;
          pointer-events: none;
          animation: mg-disrupt-anim 0.4s ease-out forwards;
        }

        @keyframes mg-disrupt-anim {
          from { transform: scale(0.6); opacity: 1; }
          to { transform: scale(1.6); opacity: 0; }
        }

        .mg-radar-legend {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: rgba(155, 148, 136, 0.5);
          letter-spacing: 1px;
          margin-top: 8px;
        }

        .mg-system-footer {
          margin-top: 24px;
          font-size: 10px;
          color: rgba(155, 148, 136, 0.4);
          letter-spacing: 2px;
          text-align: center;
        }
      `}</style>

      {/* Terminal Title & Completion Telemetry */}
      <div className="mg-header-banner">
        <div className="mg-header-title">THE CODEBREAKER&apos;S GAUNTLET // INTERMISSION</div>
        <div className="mg-header-sub">
          TEAM: <span className="mg-header-accent">{teamName.toUpperCase()}</span> // TIME LOGGED:{" "}
          <span className="mg-header-accent">{completionTime}s</span>
          <br />
          SECTOR STANDBY // RECREATIONAL OVERRIDE CONSOLE
        </div>
      </div>

      {/* Navigation Protocols Bar */}
      <div className="mg-tabs-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`mg-tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="mg-tab-badge">{tab.badge}</span>
            <span className="mg-tab-title">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Terminal Frame */}
      <div className="mg-terminal-frame">
        {activeTab === "memory" && <CipherMatrix />}
        {activeTab === "scramble" && <SignalDecrypt />}
        {activeTab === "click" && <NodeDefense />}
      </div>

      <div className="mg-system-footer">
        FACILITY PROTOCOL RECURSION // AWAITING SUBSEQUENT SECTOR CLEARANCE
      </div>
    </div>
  );
}
