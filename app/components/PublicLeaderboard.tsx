"use client";

import { useEffect, useState } from "react";

type LeaderboardEntry = {
  rank: number;
  team: string;
  round: 1 | 2 | 3;
  elapsedSec: number;
  formattedTime: string;
  finishedAt: number;
  solvedDoors: number;
  totalAttempts: number;
  masterKeyAttempts: number;
};

type Props = {
  initialRound?: 1 | 2 | 3;
  currentTeamName?: string;
};

export default function PublicLeaderboard({ initialRound = 1, currentTeamName }: Props) {
  const [selectedRound, setSelectedRound] = useState<1 | 2 | 3>(initialRound);
  const [top10, setTop10] = useState<LeaderboardEntry[]>([]);
  const [currentTeam, setCurrentTeam] = useState<LeaderboardEntry | null>(null);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async (round: 1 | 2 | 3) => {
    try {
      const q = new URLSearchParams({ round: String(round) });
      if (currentTeamName) q.set("team", currentTeamName);
      const res = await fetch(`/api/leaderboard?${q.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setTop10(data.top10 || []);
      setCurrentTeam(data.currentTeam || null);
      setTotalCompleted(data.totalCompleted || 0);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(selectedRound);
    const iv = setInterval(() => fetchLeaderboard(selectedRound), 10000);
    return () => clearInterval(iv);
  }, [selectedRound, currentTeamName]);

  return (
    <div className="ec-leaderboard-container">
      <div className="ec-lb-header">
        <span className="ec-lb-title">GLOBAL EVENT LEADERBOARD</span>
        <div className="ec-lb-tabs">
          {([1, 2, 3] as const).map((r) => (
            <button
              key={r}
              className={`ec-lb-tab ${selectedRound === r ? "active" : ""}`}
              onClick={() => {
                setSelectedRound(r);
                setLoading(true);
              }}
            >
              ROUND 0{r}
            </button>
          ))}
        </div>
      </div>

      {loading && top10.length === 0 ? (
        <div className="ec-lb-loading">RETRIEVING TELEMETRY...</div>
      ) : top10.length === 0 ? (
        <div className="ec-lb-empty">NO TEAMS HAVE BREACHED ROUND 0{selectedRound} YET.</div>
      ) : (
        <div className="ec-lb-table">
          <div className="ec-lb-row header">
            <span>RANK</span>
            <span>TEAM</span>
            <span>NODES</span>
            <span>TIME</span>
          </div>
          {top10.map((entry) => {
            const isMe = currentTeamName && entry.team.toUpperCase() === currentTeamName.toUpperCase();
            return (
              <div key={entry.team} className={`ec-lb-row ${isMe ? "highlight" : ""}`}>
                <span className="rank-num">#{String(entry.rank).padStart(2, "0")}</span>
                <span className="team-name">
                  {entry.team} {isMe ? " ★" : ""}
                </span>
                <span className="nodes-count">{entry.solvedDoors}/6</span>
                <span className="time-val">{entry.formattedTime}</span>
              </div>
            );
          })}
        </div>
      )}

      {currentTeam && currentTeam.rank > 10 && (
        <div className="ec-lb-current-rank">
          <span>YOUR STANDING:</span>
          <span className="highlight-text">
            RANK #{currentTeam.rank} — {currentTeam.formattedTime} ({currentTeam.solvedDoors}/6 NODES)
          </span>
        </div>
      )}
    </div>
  );
}