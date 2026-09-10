// Concurrency and Load Test for The Codebreaker's Gauntlet
// Simulates 90 concurrent users across 70 distinct teams.

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const NUM_TEAMS = 70;
const NUM_USERS = 90;

async function runLoadTest() {
  console.log(`Starting load test against ${BASE_URL}...`);
  console.log(`Target: ${NUM_USERS} concurrent users, ${NUM_TEAMS} distinct teams\n`);

  const latencies = [];
  let errorCount = 0;
  let requestCount = 0;
  let dbErrors = 0;

  async function timedFetch(url, options) {
    const start = performance.now();
    requestCount++;
    try {
      const res = await fetch(url, options);
      const latency = performance.now() - start;
      latencies.push(latency);
      if (!res.ok) {
        errorCount++;
        const text = await res.text().catch(() => "");
        if (text.includes("DATABASE") || text.includes("connection")) dbErrors++;
        return { ok: false, status: res.status, text };
      }
      const data = await res.json().catch(() => null);
      return { ok: true, status: res.status, data };
    } catch (err) {
      latencies.push(performance.now() - start);
      errorCount++;
      return { ok: false, error: err.message };
    }
  }

  // Phase 1: Team Registration & Login (70 teams)
  console.log("Phase 1: Registering 70 teams...");
  const teamPromises = [];
  for (let i = 1; i <= NUM_TEAMS; i++) {
    const teamName = `LOAD_TEST_TEAM_${String(i).padStart(2, "0")}`;
    teamPromises.push(
      timedFetch(`${BASE_URL}/api/game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: teamName, start: true }),
      })
    );
  }
  await Promise.all(teamPromises);

  // Phase 2: Concurrent Polling & Status (90 users)
  console.log("Phase 2: 90 users polling sync & leaderboard simultaneously...");
  const pollPromises = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const teamName = `LOAD_TEST_TEAM_${String((i % NUM_TEAMS) + 1).padStart(2, "0")}`;
    pollPromises.push(
      timedFetch(`${BASE_URL}/api/game/sync?team=${encodeURIComponent(teamName)}`)
    );
    pollPromises.push(
      timedFetch(`${BASE_URL}/api/leaderboard?round=1&team=${encodeURIComponent(teamName)}`)
    );
  }
  await Promise.all(pollPromises);

  // Phase 3: Concurrent Door Solves & Duplicate Submissions (Race Condition Test)
  console.log("Phase 3: Testing duplicate door submissions (idempotency)...");
  const solvePromises = [];
  for (let i = 1; i <= 20; i++) {
    const teamName = `LOAD_TEST_TEAM_${String(i).padStart(2, "0")}`;
    // Fire 2 simultaneous identical solves for Door 1
    solvePromises.push(
      timedFetch(`${BASE_URL}/api/game/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: teamName, door: 1, fragment: "SUN" }),
      })
    );
    solvePromises.push(
      timedFetch(`${BASE_URL}/api/game/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: teamName, door: 1, fragment: "SUN" }),
      })
    );
  }
  await Promise.all(solvePromises);

  // Phase 4: Compute Metrics
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const errorRate = ((errorCount / requestCount) * 100).toFixed(2);

  console.log("\n============================================================");
  console.log("LOAD TEST RESULTS");
  console.log("============================================================");
  console.log(`Total Requests:  ${requestCount}`);
  console.log(`Median (p50):    ${p50.toFixed(2)} ms`);
  console.log(`p95 Latency:     ${p95.toFixed(2)} ms`);
  console.log(`p99 Latency:     ${p99.toFixed(2)} ms`);
  console.log(`Error Count:     ${errorCount}`);
  console.log(`DB Errors:       ${dbErrors}`);
  console.log(`Error Rate:      ${errorRate}%`);
  console.log("============================================================\n");
}

runLoadTest().catch(console.error);
