"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  teamName: string;
  completionTime: number;
};

type GameTab = "memory" | "scramble" | "click";

/* ══════════════════════════════════════════════════════════════
   WORD LIST
   ══════════════════════════════════════════════════════════════ */
const WORDS: { answer: string; hint: string }[] = [
  { answer: "BREACH", hint: "Unauthorized access point" },
  { answer: "SIGNAL", hint: "Transmitted frequency" },
  { answer: "CIPHER", hint: "Code algorithm" },
  { answer: "VAULT", hint: "Secure chamber" },
  { answer: "ESCAPE", hint: "Break free" },
  { answer: "DECODE", hint: "Decrypt a message" },
  { answer: "MASTER", hint: "One in control" },
  { answer: "LAUNCH", hint: "Initiate sequence" },
  { answer: "PHOTON", hint: "Particle of light" },
  { answer: "MATRIX", hint: "Data grid" },
];

function scramble(word: string): string {
  const arr = [...word];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

/* ══════════════════════════════════════════════════════════════
   MEMORY MATCH
   ══════════════════════════════════════════════════════════════ */
const SYMBOLS = ["◈", "▲", "■", "◆", "★", "▣"];

type Card = { id: number; symbol: string; flipped: boolean; matched: boolean };

function buildDeck(): Card[] {
  const pairs = [...SYMBOLS, ...SYMBOLS];
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs.map((symbol, id) => ({ id, symbol, flipped: false, matched: false }));
}

function MemoryMatch() {
  const [cards, setCards] = useState<Card[]>(() => buildDeck());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length, [cards]);
  const isComplete = matchedCount === 12;

  useEffect(() => {
    if (!startedRef.current && flipped.length > 0) {
      startedRef.current = true;
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [flipped]);

  useEffect(() => {
    if (isComplete && timerRef.current) clearInterval(timerRef.current);
  }, [isComplete]);

  const handleClick = useCallback((id: number) => {
    if (locked) return;
    setCards((prev) => {
      const card = prev.find((c) => c.id === id);
      if (!card || card.flipped || card.matched) return prev;
      const next = prev.map((c) => (c.id === id ? { ...c, flipped: true } : c));
      const newFlipped = flipped.length === 0 ? [id] : [flipped[0], id];

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1);
        const [a, b] = newFlipped;
        const cardA = next.find((c) => c.id === a)!;
        const cardB = next.find((c) => c.id === b)!;
        if (cardA.symbol === cardB.symbol) {
          return next.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c));
        }
        setLocked(true);
        setTimeout(() => {
          setCards((p) => p.map((c) => (c.id === a || c.id === b ? { ...c, flipped: false } : c)));
          setLocked(false);
        }, 800);
      }
      setFlipped(newFlipped);
      return next;
    });
  }, [flipped, locked]);

  const reset = () => {
    setCards(buildDeck());
    setFlipped([]);
    setMoves(0);
    setTime(0);
    setLocked(false);
    startedRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div style={{ display: "flex", gap: 32, fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: "#D69A45" }}>
        <span>MOVES: {moves}</span>
        <span>TIME: {time}s</span>
        <span>MATCHED: {matchedCount}/12</span>
      </div>
      {isComplete && (
        <div style={{ color: "#72D08A", fontFamily: "Orbitron, sans-serif", fontSize: 18, letterSpacing: 2 }}>
          COMPLETE IN {moves} MOVES — {time} SECONDS
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 80px)",
          gridTemplateRows: "repeat(3, 80px)",
          gap: 10,
        }}
      >
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleClick(card.id)}
            style={{
              width: 80,
              height: 80,
              border: card.matched ? "1px solid rgba(114,208,138,0.4)" : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 4,
              background: card.matched
                ? "rgba(114,208,138,0.08)"
                : card.flipped
                ? "rgba(214,154,69,0.12)"
                : "#0d0c0a",
              color: card.flipped || card.matched ? "#E8E3D8" : "transparent",
              fontSize: 28,
              cursor: card.matched ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              opacity: card.matched ? 0.5 : 1,
            }}
          >
            {card.flipped || card.matched ? card.symbol : "?"}
          </button>
        ))}
      </div>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: "8px 24px",
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 4,
          color: "#9B9488",
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 13,
          cursor: "pointer",
          letterSpacing: 1,
        }}
      >
        RESET
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   WORD SCRAMBLE
   ══════════════════════════════════════════════════════════════ */
function WordScramble() {
  const [wordIndex, setWordIndex] = useState(() => Math.floor(Math.random() * WORDS.length));
  const [scrambled, setScrambled] = useState(() => scramble(WORDS[wordIndex].answer));
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [message, setMessage] = useState<"correct" | "wrong" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const word = WORDS[wordIndex];

  useEffect(() => {
    inputRef.current?.focus();
  }, [wordIndex]);

  const submit = () => {
    if (!guess.trim()) return;
    if (guess.trim().toUpperCase() === word.answer) {
      setScore((s) => s + 10 + streak * 2);
      setStreak((s) => s + 1);
      setMessage("correct");
    } else {
      setStreak(0);
      setMessage("wrong");
    }
    setTimeout(() => {
      setMessage(null);
      const next = (wordIndex + 1) % WORDS.length;
      setWordIndex(next);
      setScrambled(scramble(WORDS[next].answer));
      setGuess("");
    }, 1000);
  };

  const skip = () => {
    setStreak(0);
    const next = (wordIndex + 1) % WORDS.length;
    setWordIndex(next);
    setScrambled(scramble(WORDS[next].answer));
    setGuess("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
      <div style={{ display: "flex", gap: 32, fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: "#D69A45" }}>
        <span>SCORE: {score}</span>
        <span>STREAK: {streak}</span>
      </div>
      <div
        style={{
          fontFamily: "Orbitron, sans-serif",
          fontSize: 42,
          letterSpacing: 8,
          color: "#E8E3D8",
          textAlign: "center",
          padding: "20px 0",
        }}
      >
        {scrambled}
      </div>
      <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 14, color: "#9B9488" }}>
        HINT: {word.hint}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          ref={inputRef}
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={10}
          placeholder="YOUR ANSWER"
          style={{
            width: 200,
            padding: "10px 16px",
            background: "#0d0c0a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4,
            color: "#E8E3D8",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 16,
            letterSpacing: 2,
            outline: "none",
          }}
        />
        <button
          onClick={submit}
          style={{
            padding: "10px 20px",
            background: "rgba(214,154,69,0.15)",
            border: "1px solid rgba(214,154,69,0.3)",
            borderRadius: 4,
            color: "#D69A45",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            cursor: "pointer",
            letterSpacing: 1,
          }}
        >
          SUBMIT
        </button>
        <button
          onClick={skip}
          style={{
            padding: "10px 20px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 4,
            color: "#9B9488",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            cursor: "pointer",
            letterSpacing: 1,
          }}
        >
          SKIP
        </button>
      </div>
      {message && (
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: 16,
            letterSpacing: 2,
            color: message === "correct" ? "#72D08A" : "#c0504d",
          }}
        >
          {message === "correct" ? `CORRECT +${10 + (streak - 1) * 2}` : `WRONG — IT WAS "${word.answer}"`}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   QUICK CLICK
   ══════════════════════════════════════════════════════════════ */
type Target = { id: number; x: number; y: number; spawnedAt: number; size: number };

function QuickClick() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const decayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextIdRef = useRef(0);

  const spawnTarget = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const size = 40 + Math.random() * 30;
    const x = Math.random() * (rect.width - size);
    const y = Math.random() * (rect.height - size);
    const id = nextIdRef.current++;
    setTargets((prev) => [...prev, { id, x, y, spawnedAt: Date.now(), size }]);
  }, []);

  const cleanup = useCallback(() => {
    if (spawnRef.current) clearInterval(spawnRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    if (decayRef.current) clearInterval(decayRef.current);
  }, []);

  const startGame = () => {
    cleanup();
    nextIdRef.current = 0;
    setTargets([]);
    setHits(0);
    setMisses(0);
    setTimeLeft(30);
    setGameOver(false);
    setStarted(true);

    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          cleanup();
          setGameOver(true);
          setStarted(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    spawnRef.current = setInterval(spawnTarget, 700);

    decayRef.current = setInterval(() => {
      const now = Date.now();
      setTargets((prev) => {
        const remaining = prev.filter((t) => now - t.spawnedAt < 2000);
        const removed = prev.length - remaining.length;
        if (removed > 0) setMisses((m) => m + removed);
        return remaining;
      });
    }, 300);
  };

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleClickTarget = (id: number) => {
    setTargets((prev) => prev.filter((t) => t.id !== id));
    setHits((h) => h + 1);
  };

  const clickMiss = () => {
    if (gameOver || !started) return;
    setMisses((m) => m + 1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, width: "100%" }}>
      <div style={{ display: "flex", gap: 32, fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: "#D69A45" }}>
        <span>HITS: {hits}</span>
        <span>MISSES: {misses}</span>
        <span>TIME: {timeLeft}s</span>
        {!started && !gameOver && <span>CLICK TO START</span>}
      </div>
      {gameOver && (
        <div style={{ fontFamily: "Orbitron, sans-serif", fontSize: 18, letterSpacing: 2, color: "#72D08A" }}>
          ROUND OVER — {hits} HITS / {hits + misses} TOTAL
        </div>
      )}
      <div
        ref={containerRef}
        onClick={clickMiss}
        style={{
          width: "100%",
          height: 340,
          background: "#080706",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 4,
          position: "relative",
          overflow: "hidden",
          cursor: "crosshair",
        }}
      >
        {!started && !gameOver && (
          <div
            onClick={(e) => { e.stopPropagation(); startGame(); }}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Orbitron, sans-serif",
              fontSize: 20,
              letterSpacing: 3,
              color: "#D69A45",
              cursor: "pointer",
            }}
          >
            CLICK TO BEGIN
          </div>
        )}
        {targets.map((t) => (
          <button
            key={t.id}
            onClick={(e) => {
              e.stopPropagation();
              handleClickTarget(t.id);
            }}
            style={{
              position: "absolute",
              left: t.x,
              top: t.y,
              width: t.size,
              height: t.size,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(214,154,69,0.7) 0%, rgba(214,154,69,0.2) 70%, transparent 100%)",
              border: "2px solid rgba(214,154,69,0.5)",
              cursor: "crosshair",
              animation: "target-pulse 0.3s ease-in-out infinite alternate",
            }}
          />
        ))}
        {targets.length === 0 && started && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: 14,
              color: "#9B9488",
            }}
          >
            WAITING FOR TARGETS...
          </div>
        )}
      </div>
      {!started && (
        <button
          onClick={startGame}
          style={{
            padding: "8px 24px",
            background: "rgba(214,154,69,0.12)",
            border: "1px solid rgba(214,154,69,0.3)",
            borderRadius: 4,
            color: "#D69A45",
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 13,
            cursor: "pointer",
            letterSpacing: 1,
          }}
        >
          {gameOver ? "PLAY AGAIN" : "START"}
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
const TABS: { key: GameTab; label: string }[] = [
  { key: "memory", label: "MEMORY MATCH" },
  { key: "scramble", label: "WORD SCRAMBLE" },
  { key: "click", label: "QUICK CLICK" },
];

export default function MiniGames({ teamName, completionTime }: Props) {
  const [activeTab, setActiveTab] = useState<GameTab>("memory");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080706",
        color: "#E8E3D8",
        fontFamily: "Space Grotesk, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 20px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@400;700&family=Space+Grotesk:wght@400;600&display=swap');
        @keyframes target-pulse {
          from { transform: scale(1); opacity: 0.8; }
          to { transform: scale(1.08); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          fontFamily: "Orbitron, sans-serif",
          fontSize: 14,
          letterSpacing: 3,
          color: "#9B9488",
          textAlign: "center",
          lineHeight: 2,
        }}
      >
        ROUND 01 COMPLETE — {teamName.toUpperCase()}
        <br />
        <span style={{ color: "#D69A45" }}>
          COMPLETION TIME: {completionTime} SECONDS
        </span>
        <br />
        FILL TIME WHILE OTHER TEAMS WORK...
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 560,
          height: 1,
          background: "rgba(255,255,255,0.06)",
          margin: "28px 0",
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 32,
          background: "#0d0c0a",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 4,
          padding: 4,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 20px",
              background: activeTab === tab.key ? "rgba(214,154,69,0.12)" : "transparent",
              border: activeTab === tab.key ? "1px solid rgba(214,154,69,0.3)" : "1px solid transparent",
              borderRadius: 4,
              color: activeTab === tab.key ? "#D69A45" : "#9B9488",
              fontFamily: "Orbitron, sans-serif",
              fontSize: 11,
              letterSpacing: 2,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 560,
          minHeight: 400,
          background: "#0d0c0a",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 4,
          padding: 32,
          display: "flex",
          alignItems: activeTab === "click" ? "stretch" : "center",
          justifyContent: "center",
        }}
      >
        {activeTab === "memory" && <MemoryMatch />}
        {activeTab === "scramble" && <WordScramble />}
        {activeTab === "click" && <QuickClick />}
      </div>

      <div
        style={{
          marginTop: 32,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
          color: "rgba(155,148,136,0.4)",
          letterSpacing: 1,
        }}
      >
        SYSTEM IDLE — AWAITING OTHER TEAMS
      </div>
    </div>
  );
}
