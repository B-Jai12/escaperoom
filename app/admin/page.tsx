"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type EventSchedule = {
  serverTime: number;
  eventStartTime: number;
  activeRound: 1 | 2 | 3 | null;
  roundTimeLeft: number;
  roundElapsed: number;
  round1Start: number;
  round1End: number;
  round2Start: number;
  round2End: number;
  round3Start: number;
  round3End: number;
  eventEnd: number;
  eventStatus: "not_started" | "active" | "complete";
};

type RoundInfo = {
  status: "active" | "complete" | "timeup";
  elapsedSec: number | null;
  masterKey: boolean;
  masterKeyAttempts: number;
  doors: { solved: boolean; attempts: number }[];
};

type TeamData = {
  team: string;
  created: number;
  lastSync: number;
  currentRound: 1 | 2 | 3;
  rounds: { 1: RoundInfo; 2: RoundInfo; 3: RoundInfo };
};

function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtTs(ms: number): string {
  if (!ms) return "--:--";
  return new Date(ms).toLocaleTimeString("en-IN", { hour12: false });
}

function statusColor(s: string) {
  return s === "complete" ? "#22d3a0" : s === "timeup" ? "#ef4444" : "#d6a030";
}

function statusLabel(s: string) {
  return s === "complete" ? "DONE" : s === "timeup" ? "TIME UP" : "ACTIVE";
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "16px 20px",
  marginBottom: 16,
};
const cardHead: React.CSSProperties = {
  fontSize: 10, color: "#d6a030", fontFamily: "monospace",
  letterSpacing: 3, fontWeight: "bold", marginBottom: 12,
};
const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "6px 10px", fontFamily: "monospace",
  fontSize: 10, letterSpacing: 1, color: "#64748b",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const tdStyle: React.CSSProperties = {
  padding: "6px 10px", fontFamily: "monospace", fontSize: 11,
  borderBottom: "1px solid rgba(255,255,255,0.03)",
};

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 17, color, fontFamily: "monospace", fontWeight: "bold", letterSpacing: 2 }}>{value}</div>
    </div>
  );
}

function ClockCard({ sched }: { sched: EventSchedule }) {
  const [left, setLeft] = useState(sched.roundTimeLeft);
  useEffect(() => {
    setLeft(sched.roundTimeLeft);
    const iv = setInterval(() => setLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(iv);
  }, [sched.roundTimeLeft]);

  return (
    <div style={card}>
      <div style={cardHead}>EVENT CLOCK</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
        <Stat label="STATUS" value={sched.eventStatus.toUpperCase()} color={sched.eventStatus === "active" ? "#22d3a0" : "#ef4444"} />
        <Stat label="ACTIVE ROUND" value={sched.activeRound ? `ROUND 0${sched.activeRound}` : "OVER"} color="#a78bfa" />
        <Stat label="TIME LEFT" value={fmtSec(left)} color={left < 120 ? "#ef4444" : "#22d3a0"} />
        <Stat label="ELAPSED" value={fmtSec(sched.roundElapsed)} color="#94a3b8" />
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: "#475569", fontFamily: "monospace", lineHeight: 1.8 }}>
        <b style={{ color: "#64748b" }}>R1:</b> {fmtTs(sched.round1Start)} - {fmtTs(sched.round1End)}&emsp;
        <b style={{ color: "#64748b" }}>R2:</b> {fmtTs(sched.round2Start)} - {fmtTs(sched.round2End)}&emsp;
        <b style={{ color: "#64748b" }}>R3:</b> {fmtTs(sched.round3Start)} - {fmtTs(sched.round3End)}
        <br />Event start: {fmtTs(sched.eventStartTime)} &nbsp;|&nbsp; End: {fmtTs(sched.eventEnd)}
      </div>
    </div>
  );
}

function ClockControls({ adminKey, onDone }: { adminKey: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const act = async (payload: object) => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/clock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(`ERROR ${r.status}: ${d.error || "Action failed"}`);
      } else {
        setMsg(d.error ? `ERROR: ${d.error}` : `OK - Round ${d.activeRound ?? "none"} active, left: ${fmtSec(d.roundTimeLeft)}`);
        onDone();
      }
    } catch (e: any) { setMsg(`FAIL: ${e?.message}`); }
    finally { setBusy(false); }
  };

  const Btn = ({ label, payload, danger = false }: { label: string; payload: object; danger?: boolean }) => (
    <button onClick={() => act(payload)} disabled={busy} style={{
      padding: "7px 14px", borderRadius: 4, cursor: busy ? "not-allowed" : "pointer",
      background: danger ? "rgba(239,68,68,0.15)" : "rgba(214,160,48,0.1)",
      border: `1px solid ${danger ? "rgba(239,68,68,0.45)" : "rgba(214,160,48,0.35)"}`,
      color: danger ? "#ef4444" : "#d6a030", fontFamily: "monospace", fontSize: 11,
      letterSpacing: 1, opacity: busy ? 0.6 : 1, transition: "opacity 0.1s",
    }}>{busy ? "..." : label}</button>
  );

  return (
    <div style={card}>
      <div style={cardHead}>CLOCK CONTROLS (AUTHENTICATED)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Btn label="START NOW" payload={{ action: "startNow" }} danger />
        <Btn label="ROUND 1 START" payload={{ action: "jumpRound", setRound: 1 }} />
        <Btn label="ROUND 2 START" payload={{ action: "jumpRound", setRound: 2 }} />
        <Btn label="ROUND 3 START" payload={{ action: "jumpRound", setRound: 3 }} />
        <Btn label="R1 NEAR-END" payload={{ action: "jumpNearEnd", setRound: 1 }} />
        <Btn label="R2 NEAR-END" payload={{ action: "jumpNearEnd", setRound: 2 }} />
        <Btn label="R3 NEAR-END" payload={{ action: "jumpNearEnd", setRound: 3 }} />
        <Btn label="RESET (NOT STARTED)" payload={{ action: "resetNotStarted" }} danger />
      </div>
      {msg && <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 11, color: msg.startsWith("OK") ? "#22d3a0" : "#ef4444" }}>{msg}</div>}
    </div>
  );
}

function RoundBoard({ teams, round }: { teams: TeamData[]; round: 1 | 2 | 3 }) {
  const entries = teams
    .map(t => {
      const r = t.rounds[round];
      if (!r || r.status !== "complete" || r.elapsedSec == null) return null;
      return {
        team: t.team,
        elapsedSec: r.elapsedSec,
        doors: r.doors.filter(d => d.solved).length,
        attempts: r.doors.reduce((s, d) => s + d.attempts, 0),
        mkAttempts: r.masterKeyAttempts,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.elapsedSec - b!.elapsedSec || a!.mkAttempts - b!.mkAttempts);

  return (
    <div style={{ ...card, flex: 1, minWidth: 280 }}>
      <div style={cardHead}>ROUND 0{round} FINISHERS ({entries.length})</div>
      {entries.length === 0
        ? <div style={{ color: "#334155", fontFamily: "monospace", fontSize: 11 }}>No completions yet.</div>
        : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>TEAM</th>
                <th style={thStyle}>TIME</th>
                <th style={thStyle}>MK</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e!.team}>
                  <td style={{ ...tdStyle, color: i === 0 ? "#f59e0b" : "#475569" }}>
                    {i === 0 ? "#1" : i === 1 ? "#2" : i === 2 ? "#3" : `#${i + 1}`}
                  </td>
                  <td style={{ ...tdStyle, color: "#e2e8f0" }}>{e!.team}</td>
                  <td style={{ ...tdStyle, color: "#22d3a0", fontWeight: "bold" }}>{fmtSec(e!.elapsedSec)}</td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>{e!.mkAttempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );
}

function TeamsTable({ teams, sched }: { teams: TeamData[]; sched: EventSchedule }) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<"team" | "created" | "r1" | "r2" | "r3">("r1");
  const [asc, setAsc] = useState(true);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setAsc(!asc);
    else { setSortKey(k); setAsc(true); }
  };

  const rows = [...teams]
    .filter(t => !filter || t.team.includes(filter.toUpperCase()))
    .sort((a, b) => {
      const dir = asc ? 1 : -1;
      if (sortKey === "team") return dir * a.team.localeCompare(b.team);
      if (sortKey === "created") return dir * (a.created - b.created);
      const ridx = sortKey === "r1" ? 1 : sortKey === "r2" ? 2 : 3;
      const va = a.rounds[ridx as 1|2|3]?.elapsedSec ?? 99999;
      const vb = b.rounds[ridx as 1|2|3]?.elapsedSec ?? 99999;
      return dir * (va - vb);
    });

  const r1Done = teams.filter(t => t.rounds[1]?.status === "complete").length;
  const r2Done = teams.filter(t => t.rounds[2]?.status === "complete").length;
  const r3Done = teams.filter(t => t.rounds[3]?.status === "complete").length;

  const Th = ({ label, k }: { label: string; k: typeof sortKey }) => (
    <th onClick={() => toggleSort(k)} style={{ ...thStyle, cursor: "pointer", color: sortKey === k ? "#d6a030" : "#64748b" }}>
      {label}{sortKey === k ? (asc ? " ^" : " v") : ""}
    </th>
  );

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
        <div style={cardHead}>ALL TEAMS ({teams.length})</div>
        <div style={{ display: "flex", gap: 16, fontFamily: "monospace", fontSize: 10, color: "#64748b" }}>
          <span>R1 done: <b style={{ color: "#22d3a0" }}>{r1Done}</b></span>
          <span>R2 done: <b style={{ color: "#38bdf8" }}>{r2Done}</b></span>
          <span>R3 done: <b style={{ color: "#a78bfa" }}>{r3Done}</b></span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <input value={filter} onChange={e => setFilter(e.target.value.toUpperCase())} placeholder="FILTER..." style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4, color: "#e2e8f0", fontFamily: "monospace", fontSize: 11,
            padding: "4px 10px", outline: "none", width: 160,
          }} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr>
              <Th label="TEAM" k="team" />
              <Th label="JOINED" k="created" />
              <th style={thStyle}>SYNC</th>
              <Th label="ROUND 01" k="r1" />
              <Th label="ROUND 02" k="r2" />
              <Th label="ROUND 03" k="r3" />
              <th style={thStyle}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => {
              const totalSolved = ([1, 2, 3] as const).reduce(
                (s, r) => s + (t.rounds[r]?.doors?.filter(d => d.solved).length ?? 0), 0
              );
              return (
                <tr key={t.team} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ ...tdStyle, color: "#e2e8f0", fontWeight: "bold" }}>{t.team}</td>
                  <td style={{ ...tdStyle, color: "#475569" }}>{fmtTs(t.created)}</td>
                  <td style={{ ...tdStyle, color: "#334155" }}>{fmtTs(t.lastSync)}</td>
                  {([1, 2, 3] as const).map(rn => {
                    const rr = t.rounds[rn];
                    const col = statusColor(rr?.status ?? "active");
                    const doorsStr = `${rr?.doors?.filter(d => d.solved).length ?? 0}/6`;
                    const timeStr = rr?.status === "complete" && rr.elapsedSec != null ? fmtSec(rr.elapsedSec) : "";
                    return (
                      <td key={rn} style={tdStyle}>
                        <span style={{ color: col }}>{statusLabel(rr?.status ?? "active")}</span>
                        {timeStr && <span style={{ color: "#22d3a0", marginLeft: 6 }}>{timeStr}</span>}
                        <span style={{ color: "#334155", marginLeft: 6 }}>{doorsStr}</span>
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle, color: "#64748b" }}>{totalSolved}/18</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...tdStyle, color: "#334155", textAlign: "center", padding: 20 }}>No teams found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string>("");
  const [inputKey, setInputKey] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [isAuthed, setIsAuthed] = useState<boolean>(false);

  const [sched, setSched] = useState<EventSchedule | null>(null);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lastAt, setLastAt] = useState(0);

  // Initialize from session storage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem("gauntlet_admin_key") : null;
    if (saved) {
      setAdminKey(saved);
      setIsAuthed(true);
    }
  }, []);

  const load = useCallback(async (keyToUse?: string) => {
    const key = keyToUse || adminKey;
    if (!key) return;

    setLoading(true);
    try {
      const r = await fetch("/api/admin/teams", {
        headers: { "x-admin-key": key },
      });
      if (r.status === 401) {
        setIsAuthed(false);
        setAdminKey("");
        if (typeof window !== "undefined") sessionStorage.removeItem("gauntlet_admin_key");
        setAuthError("Invalid Administrator Key. Access Denied.");
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setSched(d.schedule);
      setTeams(d.teams || []);
      setLastAt(Date.now());
      setErr("");
      setIsAuthed(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (isAuthed && adminKey) {
      load(adminKey);
      const iv = setInterval(() => load(adminKey), 5000);
      return () => clearInterval(iv);
    }
  }, [isAuthed, adminKey, load]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    const key = inputKey.trim();
    setAuthError("");
    load(key).then(() => {
      setAdminKey(key);
      if (typeof window !== "undefined") sessionStorage.setItem("gauntlet_admin_key", key);
    });
  };

  const handleLogout = () => {
    setAdminKey("");
    setIsAuthed(false);
    setInputKey("");
    if (typeof window !== "undefined") sessionStorage.removeItem("gauntlet_admin_key");
  };

  if (!isAuthed) {
    return (
      <div style={{
        minHeight: "100vh", background: "#060604", color: "#cbd5e1",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "monospace", padding: 20,
      }}>
        <div style={{
          maxWidth: 420, width: "100%", background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(214,160,48,0.3)", borderRadius: 8, padding: "28px 24px",
          boxShadow: "0 0 30px rgba(0,0,0,0.8)",
        }}>
          <div style={{ fontSize: 13, color: "#d6a030", letterSpacing: 3, fontWeight: "bold", marginBottom: 6, textAlign: "center" }}>
            GAUNTLET ADMIN CONSOLE
          </div>
          <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 2, marginBottom: 20, textAlign: "center" }}>
            SECURITY CLEARANCE REQUIRED
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 10, color: "#94a3b8", marginBottom: 6, letterSpacing: 1 }}>
                ADMINISTRATOR ACCESS KEY:
              </label>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Enter secret key..."
                style={{
                  width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4,
                  color: "#f8fafc", fontFamily: "monospace", fontSize: 13, outline: "none",
                  boxSizing: "border-box",
                }}
                autoFocus
              />
            </div>

            {authError && (
              <div style={{
                background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444", fontSize: 11, padding: "8px 12px", borderRadius: 4, marginBottom: 16,
              }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "10px", background: "rgba(214,160,48,0.15)",
                border: "1px solid rgba(214,160,48,0.5)", borderRadius: 4,
                color: "#d6a030", fontFamily: "monospace", fontSize: 12,
                letterSpacing: 2, fontWeight: "bold", cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "VERIFYING..." : "AUTHENTICATE"}
            </button>
          </form>

          <div style={{ fontSize: 9, color: "#334155", textAlign: "center", marginTop: 20, letterSpacing: 1 }}>
            UNAUTHORIZED ACCESS ATTEMPTS ARE LOGGED AND REJECTED (HTTP 401)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#060604", color: "#cbd5e1", padding: "24px 28px", fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: "bold", letterSpacing: 4, color: "#d6a030" }}>
            CODEBREAKER ADMIN
          </div>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginTop: 2 }}>
            THE CODEBREAKER&apos;S GAUNTLET - AUTHORIZED EVENT CONTROL CENTER
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastAt > 0 && <span style={{ fontSize: 10, color: "#334155" }}>Updated {fmtTs(lastAt)}</span>}
          <button onClick={() => load(adminKey)} style={{
            padding: "6px 12px", background: "rgba(214,160,48,0.1)",
            border: "1px solid rgba(214,160,48,0.35)", borderRadius: 4,
            color: "#d6a030", fontSize: 10, cursor: "pointer", letterSpacing: 1,
          }}>REFRESH</button>
          <button onClick={handleLogout} style={{
            padding: "6px 12px", background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.35)", borderRadius: 4,
            color: "#ef4444", fontSize: 10, cursor: "pointer", letterSpacing: 1,
          }}>LOCK CONSOLE</button>
        </div>
      </div>

      {err && (
        <div style={{
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 6, padding: "10px 16px", color: "#ef4444", fontSize: 12, marginBottom: 16,
        }}>ERROR: {err}</div>
      )}

      {loading && !sched ? (
        <div style={{ color: "#334155", fontSize: 13 }}>LOADING EVENT DATA...</div>
      ) : (
        <>
          {sched && <ClockCard sched={sched} />}
          <ClockControls adminKey={adminKey} onDone={() => load(adminKey)} />
          {sched && teams.length > 0 && <TeamsTable teams={teams} sched={sched} />}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <RoundBoard teams={teams} round={1} />
            <RoundBoard teams={teams} round={2} />
            <RoundBoard teams={teams} round={3} />
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: "#1e293b", marginTop: 12 }}>
            AUTO-REFRESHES EVERY 5s - SUPABASE POSTGRESQL CONNECTED - AUTHENTICATED
          </div>
        </>
      )}
    </div>
  );
}
