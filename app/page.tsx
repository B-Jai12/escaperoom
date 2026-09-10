"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles/escaperoom.css";
import LandingTerminal from "./components/LandingTerminal";
import Corridor from "./components/Corridor";
import InvestigationOffice from "./components/puzzles/InvestigationOffice";
import MechanicalWall from "./components/puzzles/MechanicalWall";
import ProgrammerWorkstation from "./components/puzzles/ProgrammerWorkstation";
import MasterKey from "./components/MasterKey";
import CompletionScreen from "./components/CompletionScreen";
import TimeUpScreen from "./components/TimeUpScreen";
import RoundTransitionOverlay from "./components/RoundTransitionOverlay";
import { Grain, Vignette, Ambient, TransitionFlash } from "./components/Effects";
import { ALL_PUZZLES, ROUNDS_CONFIG, type Puzzle } from "./puzzleData";

type Screen = "landing" | "corridor" | "puzzle" | "master" | "complete" | "timeup";

const LS_KEY = "er_session";

type Session = {
  team: string;
  sessionId: string;
};

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(LS_KEY, JSON.stringify(s));
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* noop */
  }
}

export default function EscapeRoomPage() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [teamName, setTeamName] = useState("");
  const [sessionId, setSessionId] = useState("");

  // Global Multi-Round State
  const [activeRound, setActiveRound] = useState<1 | 2 | 3>(1);
  const [roundTimeLeft, setRoundTimeLeft] = useState(45 * 60);
  const [isEventComplete, setIsEventComplete] = useState(false);

  // Per-round doors (6 doors per round)
  const [breached, setBreached] = useState<boolean[]>([false, false, false, false, false, false]);
  const [currentPuzzle, setCurrentPuzzle] = useState(-1);
  const [clearCine, setClearCine] = useState(0);
  const [flash, setFlash] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Transition overlay state
  const [transitionActive, setTransitionActive] = useState(false);
  const [transitionFrom, setTransitionFrom] = useState<1 | 2>(1);

  // Completion data for frozen time and breakdown
  const [completedData, setCompletedData] = useState<{
    finishedAt: number | null;
    doors: Array<{ solved: boolean; fragment: string; solvedAt: number | null; attempts: number }>;
  } | null>(null);

  const activeRoundRef = useRef<1 | 2 | 3>(1);
  activeRoundRef.current = activeRound;
  const teamNameRef = useRef("");
  teamNameRef.current = teamName;

  const flashDone = useCallback(() => setFlash(false), []);

  const goTo = useCallback((target: Screen, revealAt = 160) => {
    setFlash(true);
    setTimeout(() => setScreen(target), revealAt);
  }, []);

  // Puzzles for current active round
  const currentRoundPuzzles = useMemo(() => {
    const offset = (activeRound - 1) * 6;
    return ALL_PUZZLES.slice(offset, offset + 6);
  }, [activeRound]);

  // Sync team state for a given round
  const syncTeamRoundData = useCallback((t: any, round: 1 | 2 | 3) => {
    if (!t) return;
    const roundState = t.rounds?.[round] || t;
    const doorsSolved = roundState.doors ? roundState.doors.map((d: any) => !!d.solved) : [false, false, false, false, false, false];
    setBreached(doorsSolved);
    setStartedAt(roundState.startedAt || t.startedAt || Date.now());

    const solvedCount = doorsSolved.filter(Boolean).length;
    if (roundState.status === "complete") {
      setCompletedData({
        finishedAt: roundState.finishedAt || Date.now(),
        doors: roundState.doors,
      });
      setScreen("complete");
    } else if (roundState.status === "timeup") {
      setScreen("timeup");
    } else if (solvedCount >= 6 && !roundState.masterKey) {
      setScreen("master");
    } else {
      setScreen("corridor");
    }
  }, []);

  // Resume persisted session on initial load
  useEffect(() => {
    const sess = readSession();
    if (!sess) {
      setRestoring(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/game?team=${encodeURIComponent(sess.team)}`);
        const data = await res.json();
        if (data && !data.error) {
          setTeamName(data.team);
          setSessionId(data.sessionId || sess.sessionId);

          const sched = data.schedule;
          if (sched) {
            const curRound = sched.activeRound || 1;
            setActiveRound(curRound);
            setRoundTimeLeft(sched.roundTimeLeft);
            if (sched.eventStatus === "complete") {
              setIsEventComplete(true);
            }
            syncTeamRoundData(data, curRound);
          } else {
            syncTeamRoundData(data, 1);
          }
        }
      } catch {
        /* offline fallback */
      } finally {
        setRestoring(false);
      }
    })();
  }, [syncTeamRoundData]);

  // Periodic lightweight server sync (every 4 seconds)
  useEffect(() => {
    if (!teamName) return;

    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/game/sync?team=${encodeURIComponent(teamName)}`);
        if (!res.ok) return;
        const { schedule, team } = await res.json();

        if (schedule) {
          setRoundTimeLeft(schedule.roundTimeLeft);

          if (schedule.eventStatus === "complete") {
            setIsEventComplete(true);
          }

          const serverRound = schedule.activeRound as 1 | 2 | 3 | null;
          if (serverRound && serverRound !== activeRoundRef.current) {
            // Global Round Transition triggered by server schedule!
            const fromR = activeRoundRef.current as 1 | 2;
            setActiveRound(serverRound);
            setTransitionFrom(fromR);
            setTransitionActive(true);
            setClearCine((c) => c + 1);

            // Fetch updated team state for the new round
            const teamRes = await fetch(`/api/game?team=${encodeURIComponent(teamName)}`);
            const fullTeam = await teamRes.json();
            syncTeamRoundData(fullTeam, serverRound);
          }
        }

        if (team) {
          const curDoors = team.doors.map((d: any) => !!d.solved);
          setBreached(curDoors);
        }
      } catch {
        /* network jitter noop */
      }
    }, 4000);

    return () => clearInterval(iv);
  }, [teamName, syncTeamRoundData]);

  // Local smooth countdown timer (1Hz)
  useEffect(() => {
    const iv = setInterval(() => {
      setRoundTimeLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(iv);
  }, []);

  // Landing -> Corridor (Team Login)
  const handleEnter = useCallback(
    async (name: string) => {
      const clean = name.trim().toUpperCase().slice(0, 24);
      if (!clean) return;
      setTeamName(clean);

      try {
        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team: clean, start: true }),
        });
        const data = await res.json();
        const t = data.session ?? data;
        writeSession({ team: clean, sessionId: t.sessionId });
        setSessionId(t.sessionId);

        const sched = data.schedule || t.schedule;
        const curRound = sched?.activeRound || 1;
        setActiveRound(curRound);
        setRoundTimeLeft(sched?.roundTimeLeft || 45 * 60);
        syncTeamRoundData(t, curRound);
      } catch {
        goTo("corridor");
      }
    },
    [goTo, syncTeamRoundData]
  );

  // Door click -> open puzzle
  const handleOpened = useCallback(
    (index: number) => {
      setCurrentPuzzle(index);
      setClearCine((c) => c + 1);
      goTo("puzzle", 60);
    },
    [goTo]
  );

  // Puzzle solved -> award fragment and return to corridor or master key
  const handleSolve = useCallback(
    async (index: number) => {
      const next = [...breached];
      next[index] = true;
      const isAllSolved = next.every(Boolean);
      setBreached(next);
      setClearCine((c) => c + 1);

      if (teamName) {
        const targetPuzzle = currentRoundPuzzles[index];
        if (targetPuzzle) {
          fetch("/api/game/solve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              team: teamName,
              door: targetPuzzle.doorNumber,
              fragment: targetPuzzle.fragment,
            }),
          }).catch(() => {});
        }
      }

      goTo(isAllSolved ? "master" : "corridor");
    },
    [breached, currentRoundPuzzles, goTo, teamName]
  );

  const recordAttempt = useCallback(
    (index: number) => {
      if (!teamName) return;
      const targetPuzzle = currentRoundPuzzles[index];
      if (targetPuzzle) {
        fetch("/api/game/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team: teamName, door: targetPuzzle.doorNumber }),
        }).catch(() => {});
      }
    },
    [teamName, currentRoundPuzzles]
  );

  const handleExitPuzzle = useCallback(() => {
    setClearCine((c) => c + 1);
    goTo("corridor");
  }, [goTo]);

  // Master Key solved -> log completion
  // NOTE: Master key was already validated by MasterKey.tsx before onComplete() fired.
  // We only need to call /api/game/finish to stamp the final time on the server.
  const handleMasterDone = useCallback(async () => {
    // Set provisional completedData immediately so the clock is frozen from the start
    const now = Date.now();
    const provisionalDoors = breached.map((b, i) => ({
      solved: b,
      fragment: b ? currentRoundPuzzles[i].fragment : "",
      solvedAt: now,
      attempts: 1,
    }));
    setCompletedData({ finishedAt: now, doors: provisionalDoors });

    // Navigate to complete screen immediately (clock is already frozen above)
    goTo("complete", 240);

    // Fire-and-forget: persist final status on server and update with accurate door data
    if (teamName) {
      try {
        const res = await fetch("/api/game/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team: teamName, round: activeRound, status: "complete" }),
        });
        const teamData = await res.json();
        if (teamData && teamData.finishedAt) {
          setCompletedData({
            finishedAt: teamData.finishedAt,
            doors: teamData.doors ?? provisionalDoors,
          });
        }
      } catch {
        /* network error — provisional data already shown, safe to ignore */
      }
    }
  }, [activeRound, breached, currentRoundPuzzles, goTo, teamName]);

  const handleRetry = useCallback(() => {
    writeSession(null);
    setBreached([false, false, false, false, false, false]);
    setCurrentPuzzle(-1);
    setClearCine((c) => c + 1);
    setTeamName("");
    goTo("landing");
  }, [goTo]);

  if (restoring) {
    return (
      <div className="er-root">
        <Grain />
        <Vignette />
        <Ambient />
        <div className="er-resume">RESTORING BUNKER SESSION...</div>
      </div>
    );
  }

  return (
    <div className="er-root">
      <Grain />
      <Vignette />
      <Ambient />

      {screen === "landing" && <LandingTerminal onEnter={handleEnter} exiting={false} />}

      {(screen === "corridor" || screen === "puzzle") && (
        <Corridor
          round={activeRound}
          teamName={teamName}
          breached={breached}
          fragments={breached.map((b, i) => (b ? currentRoundPuzzles[i]?.fragment || "" : ""))}
          clearCine={clearCine}
          timeLeft={roundTimeLeft}
          onOpenPortal={handleOpened}
        />
      )}

      {screen === "puzzle" && currentPuzzle >= 0 && !breached[currentPuzzle] && (
        <PuzzleRouter
          puzzle={currentRoundPuzzles[currentPuzzle]}
          index={currentPuzzle}
          timeLeft={roundTimeLeft}
          onSolve={handleSolve}
          onExit={handleExitPuzzle}
          onAttempt={recordAttempt}
        />
      )}

      {screen === "master" && (
        <MasterKey
          round={activeRound}
          teamName={teamName}
          doors={currentRoundPuzzles.map((p, i) => ({
            doorNumber: p.doorNumber,
            solved: breached[i],
            fragment: breached[i] ? p.fragment : "",
          }))}
          fragments={breached.map((b, i) => (b ? currentRoundPuzzles[i]?.fragment || "" : ""))}
          onComplete={handleMasterDone}
        />
      )}

      {screen === "complete" && (
        <CompletionScreen
          round={activeRound}
          teamName={teamName}
          completionTimeSec={
            completedData?.finishedAt && startedAt
              ? Math.max(0, Math.floor((completedData.finishedAt - startedAt) / 1000))
              : startedAt
              ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
              : 0
          }
          startedAt={startedAt}
          doors={
            completedData?.doors ??
            breached.map((b, i) => ({
              solved: b,
              fragment: b ? currentRoundPuzzles[i]?.fragment || "" : "",
              solvedAt: null,
              attempts: 0,
            }))
          }
          nextRoundTimeLeft={roundTimeLeft}
          isEventComplete={isEventComplete}
        />
      )}

      {screen === "timeup" && <TimeUpScreen teamName={teamName} onRetry={handleRetry} />}

      {/* Global Round Termination Warning (< 10 seconds before round close) */}
      {roundTimeLeft <= 10 && roundTimeLeft > 0 && screen !== "landing" && screen !== "complete" && (
        <div className="er-alarm">
          <span className="er-alarm-tick">
            âš ï¸ ROUND 0{activeRound} TERMINATING IN {roundTimeLeft} SECONDS â€” PREPARE FOR SECTOR LOCK âš ï¸
          </span>
        </div>
      )}

      {/* Automated Cinematic Round Transition Overlay */}
      <RoundTransitionOverlay
        active={transitionActive}
        fromRound={transitionFrom}
        onDone={() => setTransitionActive(false)}
      />

      <TransitionFlash fired={flash} onDone={flashDone} />
    </div>
  );
}

function PuzzleRouter({
  puzzle,
  index,
  timeLeft,
  onSolve,
  onExit,
  onAttempt,
}: {
  puzzle: Puzzle;
  index: number;
  timeLeft: number;
  onSolve: (index: number) => void;
  onExit: () => void;
  onAttempt: (index: number) => void;
}) {
  if (!puzzle) return null;

  switch (puzzle.type) {
    case "GENERAL":
      return (
        <InvestigationOffice
          puzzle={puzzle}
          index={index}
          timeLeft={timeLeft}
          onSolve={onSolve}
          onExit={onExit}
          onAttempt={onAttempt}
        />
      );
    case "PATTERN":
      return (
        <MechanicalWall
          puzzle={puzzle}
          index={index}
          timeLeft={timeLeft}
          onSolve={onSolve}
          onExit={onExit}
          onAttempt={onAttempt}
        />
      );
    case "CODE":
      return (
        <ProgrammerWorkstation
          puzzle={puzzle}
          index={index}
          timeLeft={timeLeft}
          onSolve={onSolve}
          onExit={onExit}
          onAttempt={onAttempt}
        />
      );
    default:
      return (
        <InvestigationOffice
          puzzle={puzzle}
          index={index}
          timeLeft={timeLeft}
          onSolve={onSolve}
          onExit={onExit}
          onAttempt={onAttempt}
        />
      );
  }
}