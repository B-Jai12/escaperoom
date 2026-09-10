"use client";

import { useState } from "react";
import MiniGames from "./MiniGames";
import PublicLeaderboard from "./PublicLeaderboard";
import { ALL_PUZZLES, ROUNDS_CONFIG } from "../puzzleData";

type DoorInfo = {
  doorNumber?: number;
  solved: boolean;
  fragment: string;
  solvedAt: number | null;
  attempts: number;
};

type Props = {
  round?: 1 | 2 | 3;
  teamName: string;
  completionTimeSec: number;
  doors: DoorInfo[];
  startedAt: number | null;
  nextRoundTimeLeft?: number;
  isEventComplete?: boolean;
};

function fmtTime(ms: number | null) {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString([], { hour12: false });
}

function durSec(ms: number | null) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtCountdown(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CompletionScreen({
  round = 1,
  teamName,
  completionTimeSec,
  doors,
  startedAt,
  nextRoundTimeLeft = 0,
  isEventComplete = false,
}: Props) {
  const [showGames, setShowGames] = useState(false);
  const roundCfg = ROUNDS_CONFIG[round] || ROUNDS_CONFIG[1];
  const offset = (round - 1) * 6;
  const roundPuzzles = ALL_PUZZLES.slice(offset, offset + 6);
  const solvedCount = doors.filter((d) => d.solved).length;

  const perDoor = doors.map((d, i) => {
    const doorStart = i === 0 ? startedAt : doors[i - 1]?.solvedAt;
    const doorEnd = d.solvedAt;
    const elapsed = doorStart && doorEnd ? doorEnd - doorStart : null;
    const puzzle = roundPuzzles[i] || ALL_PUZZLES[i];
    return {
      ...d,
      index: i,
      doorNum: puzzle.doorNumber || (offset + i + 1),
      type: puzzle.type,
      elapsed,
    };
  });

  if (showGames) {
    return (
      <div>
        <button
          onClick={() => setShowGames(false)}
          style={{
            position: "fixed",
            top: 20,
            left: 20,
            zIndex: 10001,
            padding: "8px 18px",
            background: "rgba(10,8,6,0.95)",
            border: "1px solid rgba(214,154,69,0.4)",
            borderRadius: 4,
            color: "#D69A45",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
            letterSpacing: 2,
            cursor: "pointer",
          }}
        >
          &lt; BACK TO TELEMETRY
        </button>
        <MiniGames teamName={teamName} completionTime={completionTimeSec} />
      </div>
    );
  }

  return (
    <div className="er-screen" style={{ overflow: "auto", paddingBottom: 60 }}>
      <div className="er-complete">
        <div className="ct">
          {isEventComplete || round === 3 && solvedCount >= 6 ? "THE CODEBREAKER'S GAUNTLET" : `ROUND 0${round} COMPLETE`}
        </div>
        <div className="cs">
          {isEventComplete || round === 3 && solvedCount >= 6 ? "ALL PROTOCOLS COMPLETED — FACILITY OVERRIDDEN" : roundCfg.subtitle}
        </div>
        <div className="er-divider" style={{ width: 300, margin: "24px auto" }} />

        <div className="info">
          TEAM: {teamName}
          <br />
          SECURITY NODES BREACHED: {solvedCount}/6
          <br />
          CODE FRAGMENTS COLLECTED: {solvedCount}/6
          <br />
          TIME TAKEN: {Math.floor(completionTimeSec / 60)}m {completionTimeSec % 60}s
          <br />
          MASTER KEY: ACTIVATED
        </div>

        {/* Next Round Standby Notification */}
        {!isEventComplete && round < 3 && (
          <div className="ec-standby-banner">
            <div className="sb-label">GLOBAL EVENT SYNCHRONIZATION:</div>
            <div className="sb-timer">
              ROUND 0{round + 1} UNLOCKS IN: {fmtCountdown(nextRoundTimeLeft)}
            </div>
            <div className="sb-note">
              DO NOT CLOSE THIS TERMINAL. THE SECTOR WILL AUTOMATICALLY INITIALIZE AT 00:00.
            </div>
          </div>
        )}

        {/* Per-door timing breakdown */}
        <div className="ec-door-table">
          <div className="ec-door-header">
            <span>DOOR</span>
            <span>TYPE</span>
            <span>FRAGMENT</span>
            <span>ATTEMPTS</span>
            <span>SOLVED AT</span>
            <span>ELAPSED</span>
          </div>
          {perDoor.map((d) => (
            <div key={d.doorNum} className={`ec-door-row ${d.solved ? "solved" : ""}`}>
              <span>NODE {String(d.doorNum).padStart(2, "0")}</span>
              <span>{d.type}</span>
              <span className="ec-frag">{d.solved ? d.fragment : "???"}</span>
              <span>{d.attempts}</span>
              <span>{fmtTime(d.solvedAt)}</span>
              <span>{durSec(d.elapsed)}</span>
            </div>
          ))}
        </div>

        <div className="ec-divider" />

        {/* Public Top-10 Leaderboard */}
        <PublicLeaderboard initialRound={round} currentTeamName={teamName} />

        <div className="ec-divider" />

        {/* Optional waiting game */}
        {!isEventComplete && round < 3 && (
          <button className="ec-play-btn" onClick={() => setShowGames(true)}>
            PLAY MINI GAMES WHILE YOU WAIT FOR ROUND 0{round + 1}
          </button>
        )}

        <div className="end">TELEMETRY LOGGED. THE DIRECTOR SEES YOUR PROGRESS.</div>
      </div>
    </div>
  );
}