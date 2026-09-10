import { NextResponse } from "next/server";
import { getTeam, getOrCreateTeam, setMasterKey } from "@/lib/store";
import { getActiveRound } from "@/lib/eventClock";
import { ROUNDS_CONFIG } from "@/app/puzzleData";
import getSql from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const t0 = performance.now();
  let dbMs = 0;

  try {
    const body = await req.json();
    const { team, sequence, key, round: roundArg } = body ?? {};

    if (typeof team !== "string" || !team.trim()) {
      return NextResponse.json({ error: "team required" }, { status: 400 });
    }

    const teamKey = team.trim().toUpperCase();
    const tDb0 = performance.now();
    let t = await getTeam(teamKey);
    if (!t) {
      const created = await getOrCreateTeam(teamKey);
      t = created.team;
    }

    const activeRound = (await getActiveRound()) || 1;
    const targetRound: 1 | 2 | 3 =
      roundArg === 1 || roundArg === 2 || roundArg === 3 ? roundArg : activeRound;

    const roundState = t.rounds[targetRound];
    if (!roundState) {
      return NextResponse.json({ error: "Round state not found" }, { status: 500 });
    }

    const expectedOrder = ROUNDS_CONFIG[targetRound].masterKeyOrder;

    // Parse submitted codes
    let submittedCodes: string[] = [];

    if (Array.isArray(sequence)) {
      submittedCodes = sequence.map((s) => String(s || "").trim().toUpperCase());
    } else if (typeof sequence === "string" && sequence.trim()) {
      const clean = sequence.trim().toUpperCase();
      if (clean.includes("-")) {
        submittedCodes = clean.split("-").map((s) => s.trim());
      } else if (clean.includes(" ")) {
        submittedCodes = clean.split(/\s+/).map((s) => s.trim());
      } else if (clean.length === 18 && /^\d{18}$/.test(clean)) {
        for (let i = 0; i < 18; i += 3) {
          submittedCodes.push(clean.slice(i, i + 3));
        }
      }
    } else if (typeof key === "string" && key.trim()) {
      const clean = key.trim().toUpperCase();
      if (clean.includes("-")) {
        submittedCodes = clean.split("-").map((s) => s.trim());
      } else if (clean.includes(" ")) {
        submittedCodes = clean.split(/\s+/).map((s) => s.trim());
      } else if (clean.length === 18 && /^\d{18}$/.test(clean)) {
        for (let i = 0; i < 18; i += 3) {
          submittedCodes.push(clean.slice(i, i + 3));
        }
      }
    }

    if (submittedCodes.length !== 6 || submittedCodes.some((c) => c.length !== 3)) {
      return NextResponse.json(
        {
          accepted: false,
          error: "MASTER KEY REQUIRES EXACTLY SIX 3-DIGIT CODES IN DOOR ORDER",
        },
        { status: 400 }
      );
    }

    const isCorrect = submittedCodes.every(
      (code, i) => code === expectedOrder[i].toUpperCase()
    );

    if (isCorrect) {
      try {
        const sql = getSql();
        const startDoor = (targetRound - 1) * 6 + 1;
        for (let i = 0; i < 6; i++) {
          const dNum = startDoor + i;
          const frag = expectedOrder[i];
          await sql`
            UPDATE door_states 
            SET solved = TRUE, fragment = ${frag}, solved_at = COALESCE(solved_at, ${Date.now()})
            WHERE team_name = ${teamKey} AND door_number = ${dNum}
          `;
        }
      } catch {
        /* proceed to master key update */
      }

      const res = await setMasterKey(teamKey, true, targetRound);
      dbMs = performance.now() - tDb0;
      const totalMs = performance.now() - t0;

      if (!res) return NextResponse.json({ error: "Team update failed" }, { status: 500 });
      if (res.error) return NextResponse.json({ error: res.error }, { status: 403 });

      const resp = NextResponse.json({
        accepted: true,
        round: targetRound,
        elapsedMs: res.team.rounds[targetRound].elapsedMs,
        elapsedSec: res.team.rounds[targetRound].elapsedSec,
        message: "MASTER KEY ACCEPTED. PERIMETER ACCESS VERIFIED. ROUND COMPLETE.",
        team: res.team,
        _timing: { totalMs: Number(totalMs.toFixed(1)), dbMs: Number(dbMs.toFixed(1)) },
      });
      resp.headers.set("Server-Timing", `db;dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`);
      return resp;
    } else {
      const res = await setMasterKey(teamKey, false, targetRound);
      dbMs = performance.now() - tDb0;
      const totalMs = performance.now() - t0;
      const attempts = res?.team?.rounds[targetRound]?.masterKeyAttempts || (roundState.masterKeyAttempts + 1);

      const resp = NextResponse.json({
        accepted: false,
        error: "MASTER KEY INVALID. VERIFY DOOR CODES AND THEIR ORDER.",
        attempts,
        team: res?.team || t,
        _timing: { totalMs: Number(totalMs.toFixed(1)), dbMs: Number(dbMs.toFixed(1)) },
      });
      resp.headers.set("Server-Timing", `db;dur=${dbMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`);
      return resp;
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
