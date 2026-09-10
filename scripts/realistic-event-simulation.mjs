const BASE = "https://escaperoom-gamma-drab.vercel.app";
const ADMIN_KEY = "GAUNTLET_ADMIN_2026";
const NUM_TEAMS = 70;
const NUM_CLIENTS = 90;
const DURATION_SEC = 25; // Sustained active gameplay window

const R1_MASTER_KEY = ["428", "731", "195", "604", "382", "917"];

function pct(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runWithConcurrency(items, concurrency, fn) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const allLatencies = [];
const dbLatencies = [];
let totalRequests = 0;
let successRequests = 0;
let failedRequests = 0;
let timeoutRequests = 0;

async function trackReq(url, opts = {}, timeoutMs = 25000) {
  totalRequests++;
  const t0 = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    const totalMs = performance.now() - t0;
    allLatencies.push(totalMs);

    const timingHdr = res.headers.get("server-timing");
    if (timingHdr) {
      const m = timingHdr.match(/db;dur=([\d.]+)/);
      if (m) dbLatencies.push(parseFloat(m[1]));
    }

    if (res.ok) {
      successRequests++;
      return { ok: true, status: res.status, data: await res.json().catch(() => ({})) };
    } else {
      failedRequests++;
      return { ok: false, status: res.status };
    }
  } catch (err) {
    clearTimeout(timer);
    const totalMs = performance.now() - t0;
    allLatencies.push(totalMs);
    if (err.name === "AbortError") {
      timeoutRequests++;
    } else {
      failedRequests++;
    }
    return { ok: false, error: err.message };
  }
}

async function simulateClient(clientId) {
  const teamIdx = ((clientId - 1) % NUM_TEAMS) + 1;
  const teamName = `GAUNTLET_T${String(teamIdx).padStart(2, "0")}`;

  // Initial connection jitter: stagger client arrivals across 0-3 seconds
  await sleep(Math.random() * 3000);

  const stopAt = Date.now() + DURATION_SEC * 1000;
  let nextSync = Date.now() + Math.random() * 1000;
  let nextLb = Date.now() + 1500 + Math.random() * 3000;
  let solvedCount = 0;

  while (Date.now() < stopAt) {
    const now = Date.now();

    // Regular gameplay sync polling every 4-5 seconds
    if (now >= nextSync) {
      await trackReq(`${BASE}/api/game/sync?team=${teamName}`);
      nextSync = now + 4000 + Math.random() * 1000;
    }

    // Leaderboard check every 8-12 seconds
    if (now >= nextLb) {
      await trackReq(`${BASE}/api/leaderboard?round=1&team=${teamName}`);
      nextLb = now + 8000 + Math.random() * 3000;
    }

    // Progress solving doors 1 to 6
    if (solvedCount < 6 && Math.random() < 0.4) {
      solvedCount++;
      const doorNum = solvedCount;
      const frag = R1_MASTER_KEY[solvedCount - 1];
      await trackReq(`${BASE}/api/game/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: teamName,
          door: doorNum,
          fragment: frag,
        }),
      });
    }

    // Submit Master Key once all 6 doors are solved
    if (solvedCount === 6 && Math.random() < 0.6) {
      solvedCount = 7;
      await trackReq(`${BASE}/api/game/master`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: teamName,
          sequence: R1_MASTER_KEY,
          round: 1,
        }),
      });
    }

    // Client loop tick
    await sleep(400 + Math.random() * 400);
  }
}

async function run() {
  console.log("============================================================");
  console.log("REALISTIC PRODUCTION EVENT SIMULATION (70 TEAMS, 90 CLIENTS)");
  console.log("============================================================");
  console.log(`Target: ${NUM_TEAMS} Teams, ${NUM_CLIENTS} Connected Users`);
  console.log(`Duration: ${DURATION_SEC}s active sustained event traffic`);
  console.log(`Base URL: ${BASE}`);

  // Step 1: Initialize event clock to Round 1 via Admin API
  console.log("\n--> 1. Initializing event clock to Round 1 via Admin API (Authenticated)...");
  const clockInit = await trackReq(`${BASE}/api/admin/clock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify({ action: "jumpRound", setRound: 1 }),
  });
  console.log(`    Clock setup result: HTTP ${clockInit.status} (activeRound: ${clockInit.data?.activeRound})`);

  // Step 2: Realistic team registrations (70 teams over a pooled concurrency of 10)
  console.log(`\n--> 2. Ensuring ${NUM_TEAMS} teams are registered with pooled concurrency...`);
  const teams = Array.from({ length: NUM_TEAMS }, (_, i) => `GAUNTLET_T${String(i + 1).padStart(2, "0")}`);
  const regT0 = performance.now();
  await runWithConcurrency(teams, 10, async (team) => {
    return trackReq(`${BASE}/api/game`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team, start: true }),
    });
  });
  console.log(`    ? All ${NUM_TEAMS} teams registered in ${((performance.now() - regT0) / 1000).toFixed(1)}s.`);

  // Step 3: Sustained active event traffic (90 concurrent clients)
  console.log(`\n--> 3. Launching ${NUM_CLIENTS} concurrent clients in sustained gameplay for ${DURATION_SEC}s...`);
  const gameT0 = performance.now();
  const clientPromises = [];
  for (let c = 1; c <= NUM_CLIENTS; c++) {
    clientPromises.push(simulateClient(c));
  }

  // Monitor progress every 5 seconds
  const monitorIv = setInterval(() => {
    const p50 = pct(allLatencies, 50).toFixed(0);
    const p95 = pct(allLatencies, 95).toFixed(0);
    console.log(
      `    [Progress] Req: ${totalRequests} | Success: ${successRequests} | Fail: ${failedRequests} | Timeouts: ${timeoutRequests} | p50: ${p50}ms | p95: ${p95}ms`
    );
  }, 5000);

  await Promise.all(clientPromises);
  clearInterval(monitorIv);
  const gameDurationSec = (performance.now() - gameT0) / 1000;

  console.log("\n============================================================");
  console.log("SIMULATION SUMMARY & LATENCY PROFILE");
  console.log("============================================================");
  console.log(`Total Requests Sent:    ${totalRequests}`);
  console.log(`Successful (HTTP 200):  ${successRequests} (${((successRequests / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`Failed Requests:        ${failedRequests}`);
  console.log(`Timeouts:               ${timeoutRequests}`);
  console.log(`Request Throughput:     ${(totalRequests / gameDurationSec).toFixed(1)} req/sec sustained`);

  console.log("\n--- Latency Breakdown (Client-Side Total Duration) ---");
  console.log(`Min Latency:            ${Math.min(...allLatencies).toFixed(1)} ms`);
  console.log(`Average Latency:        ${(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length).toFixed(1)} ms`);
  console.log(`p50 Latency:            ${pct(allLatencies, 50).toFixed(1)} ms`);
  console.log(`p90 Latency:            ${pct(allLatencies, 90).toFixed(1)} ms`);
  console.log(`p95 Latency:            ${pct(allLatencies, 95).toFixed(1)} ms`);
  console.log(`p99 Latency:            ${pct(allLatencies, 99).toFixed(1)} ms`);
  console.log(`Max Latency:            ${Math.max(...allLatencies).toFixed(1)} ms`);

  if (dbLatencies.length > 0) {
    console.log("\n--- Database Query Duration (Server-Side Execution) ---");
    console.log(`DB Min:                 ${Math.min(...dbLatencies).toFixed(1)} ms`);
    console.log(`DB Average:             ${(dbLatencies.reduce((a, b) => a + b, 0) / dbLatencies.length).toFixed(1)} ms`);
    console.log(`DB p50:                 ${pct(dbLatencies, 50).toFixed(1)} ms`);
    console.log(`DB p95:                 ${pct(dbLatencies, 95).toFixed(1)} ms`);
    console.log(`DB p99:                 ${pct(dbLatencies, 99).toFixed(1)} ms`);
  }

  // Step 4: Verify leaderboard after simulation
  console.log("\n--> 4. Checking official Leaderboard after finishes...");
  const lb = await trackReq(`${BASE}/api/leaderboard?round=1`);
  if (lb.ok && lb.data?.top10) {
    console.log(`    Total Completed Teams: ${lb.data.totalCompleted}`);
    console.log("    Top 5 Finishers (Millisecond Precision):");
    lb.data.top10.slice(0, 5).forEach((t) => {
      console.log(`      #${t.rank} ${t.team.padEnd(14)} Time: ${t.formattedTime} (${t.elapsedMs}ms) | MK attempts: ${t.masterKeyAttempts}`);
    });
  }

  console.log("\n============================================================");
}

run().catch(console.error);
