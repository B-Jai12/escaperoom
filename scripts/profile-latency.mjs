const BASE = "https://escaperoom-gamma-drab.vercel.app";

function pct(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function req(url, opts = {}, timeoutMs = 15000) {
  const t0 = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    const text = await res.text();
    const totalMs = performance.now() - t0;
    const timingHdr = res.headers.get("Server-Timing");
    let dbMs = null;
    if (timingHdr) {
      const m = timingHdr.match(/db;dur=([\d.]+)/);
      if (m) dbMs = parseFloat(m[1]);
    }
    return {
      status: res.status,
      ok: res.ok,
      totalMs,
      dbMs,
      size: text.length,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: 0,
      ok: false,
      totalMs: performance.now() - t0,
      dbMs: null,
      error: err.message,
    };
  }
}

async function runProfiles() {
  console.log("============================================================");
  console.log("LATENCY BENCHMARK: COLD vs WARM vs SEQUENTIAL vs CONCURRENT");
  console.log("============================================================");

  // Setup: Ensure GAUNTLET_T01 exists
  await req(`${BASE}/api/game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team: "GAUNTLET_T01", start: true }),
  });

  // 1. Cold Request (hit with cache-buster)
  console.log("\n--> 1. Testing COLD Request...");
  const coldRes = await req(`${BASE}/api/game/sync?team=GAUNTLET_T01&_cold=${Date.now()}`);
  console.log(`    Status: ${coldRes.status} | Total: ${coldRes.totalMs.toFixed(1)} ms | DB: ${coldRes.dbMs} ms`);

  // 2. Warm Request (immediately after on the same route)
  console.log("\n--> 2. Testing WARM Request (immediate repeat)...");
  const warmRes = await req(`${BASE}/api/game/sync?team=GAUNTLET_T01`);
  console.log(`    Status: ${warmRes.status} | Total: ${warmRes.totalMs.toFixed(1)} ms | DB: ${warmRes.dbMs} ms`);

  // 3. Second Request
  console.log("\n--> 3. Testing SECOND Request...");
  const secRes = await req(`${BASE}/api/game/sync?team=GAUNTLET_T01`);
  console.log(`    Status: ${secRes.status} | Total: ${secRes.totalMs.toFixed(1)} ms | DB: ${secRes.dbMs} ms`);

  // 4. 10 Sequential Requests
  console.log("\n--> 4. Testing 10 SEQUENTIAL Requests...");
  const seqLatencies = [];
  const seqDbLatencies = [];
  for (let i = 1; i <= 10; i++) {
    const r = await req(`${BASE}/api/game/sync?team=GAUNTLET_T01`);
    seqLatencies.push(r.totalMs);
    if (r.dbMs != null) seqDbLatencies.push(r.dbMs);
    process.stdout.write(`    [#${i}] ${r.totalMs.toFixed(0)}ms (db: ${r.dbMs}ms) | `);
    if (i % 5 === 0) console.log("");
  }
  const seqAvg = seqLatencies.reduce((a, b) => a + b, 0) / seqLatencies.length;
  console.log(`    Sequential 10 Stats:`);
  console.log(`      Min: ${Math.min(...seqLatencies).toFixed(1)} ms`);
  console.log(`      Max: ${Math.max(...seqLatencies).toFixed(1)} ms`);
  console.log(`      Avg: ${seqAvg.toFixed(1)} ms`);
  console.log(`      p50: ${pct(seqLatencies, 50).toFixed(1)} ms`);
  console.log(`      p95: ${pct(seqLatencies, 95).toFixed(1)} ms`);

  // 5. 90 Concurrent Requests
  console.log("\n--> 5. Testing 90 CONCURRENT Requests (simulating 90 concurrent users)...");
  const promises = [];
  for (let i = 1; i <= 90; i++) {
    const teamNum = String(((i - 1) % 70) + 1).padStart(2, "0");
    // Mix of endpoints: 60 sync, 20 leaderboard, 10 game GET
    let url = `${BASE}/api/game/sync?team=GAUNTLET_T${teamNum}`;
    if (i % 4 === 0) url = `${BASE}/api/leaderboard?round=1`;
    else if (i % 9 === 0) url = `${BASE}/api/game?team=GAUNTLET_T${teamNum}`;
    promises.push(req(url));
  }

  const concurrentResults = await Promise.all(promises);
  const concLatencies = concurrentResults.map((r) => r.totalMs);
  const concDbLatencies = concurrentResults.map((r) => r.dbMs).filter((x) => x !== null);
  const failed = concurrentResults.filter((r) => !r.ok);

  console.log(`    90 Concurrent Requests Results:`);
  console.log(`      Total requests: ${concurrentResults.length}`);
  console.log(`      Successful: ${concurrentResults.length - failed.length}`);
  console.log(`      Failed: ${failed.length}`);
  console.log(`      Min: ${Math.min(...concLatencies).toFixed(1)} ms`);
  console.log(`      Max: ${Math.max(...concLatencies).toFixed(1)} ms`);
  console.log(`      p50: ${pct(concLatencies, 50).toFixed(1)} ms`);
  console.log(`      p95: ${pct(concLatencies, 95).toFixed(1)} ms`);
  console.log(`      p99: ${pct(concLatencies, 99).toFixed(1)} ms`);

  if (concDbLatencies.length > 0) {
    console.log(`    DB Query Durations:`);
    console.log(`      DB Min: ${Math.min(...concDbLatencies).toFixed(1)} ms`);
    console.log(`      DB Max: ${Math.max(...concDbLatencies).toFixed(1)} ms`);
    console.log(`      DB p50: ${pct(concDbLatencies, 50).toFixed(1)} ms`);
    console.log(`      DB p95: ${pct(concDbLatencies, 95).toFixed(1)} ms`);
    console.log(`      DB p99: ${pct(concDbLatencies, 99).toFixed(1)} ms`);
  }
}

runProfiles().catch(console.error);
