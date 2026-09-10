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

const allLatencies = [];
const dbLatencies = [];
let totalRequests = 0;
let successRequests = 0;
let failedRequests = 0;
let timeoutRequests = 0;

async function trackReq(url, opts = {}, timeoutMs = 30000) {
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

  // Initial connection jitter: stagger client arrivals across 0-6 seconds
  await sleep(Math.random() * 6000);

  // 1. Join / Connect
  await trackReq(`${BASE}/api/game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team: teamName, start: true }),
  });

  const stopAt = Date.now() + DURATION_SEC * 1000;
  let nextSync = Date.now() + Math.random() * 1000;
  let nextLb = Date.now() + 2000 + Math.random() * 3000;
  let solvedCount = 0;

  while (Date.now() < stopAt) {
    const now = Date.now();

    // Regular gameplay sync polling every 4-5 seconds
    if (now >= nextSync) {
      await trackReq(`${BASE}/api/game/sync?team=${teamName}`);
      nextSync = now + 4000 + Math.random() * 1500;
    }

    // Leaderboard check every 8-12 seconds
    if (now >= nextLb) {
      await trackReq(`${BASE}/api/leaderboard?round=1&team=${teamName}`);
      nextLb = now + 8000 + Math.random() * 4000;
    }

    // Progress solving doors 1 to 6
    if (solvedCount < 6 && Math.random() < 0.35) {
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
    await sleep(500 + Math.random() * 500);
  }
}

async function run() {
  console.log("============================================================");
  console.log("REALISTIC PRODUCTION EVENT SIMULATION (70 TEAMS, 90 CLIENTS)");
  console.log("============================================================");
  console.log(`Target: ${NUM_TEAMS} Teams, ${NUM_CLIENTS} Connected Users`);
  console.log(`Duration: ${DURATION_SEC}s active sustained event traffic`);
  console.log(`Base URL: ${BASE}`);

  // Step 1: Set event clock to active Round 1 using admin credentials
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

  // Step 2: Spawn 90 concurrent client loops
  console.log(`\n--> 2. Launching ${NUM_CLIENTS} clients across ${NUM_TEAMS} teams with natural arrival jitter...`);
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

  console.log("\n============================================================");
  console.log("SIMULATION SUMMARY & LATENCY PROFILE");
  console.log("============================================================");
  console.log(`Total Requests Sent:    ${totalRequests}`);
  console.log(`Successful (HTTP 200):  ${successRequests} (${((successRequests / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`Failed Requests:        ${failedRequests}`);
  console.log(`Timeouts:               ${timeoutRequests}`);
  console.log(`Request Throughput:     ${(totalRequests / DURATION_SEC).toFixed(1)} req/sec sustained`);

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

  // Step 3: Verify leaderboard after simulation
  console.log("\n--> 3. Checking official Leaderboard after finishes...");
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
