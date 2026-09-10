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
    const clientTotalMs = performance.now() - t0;
    const timingHdr = res.headers.get("Server-Timing") || "";

    let connMs = null;
    let sqlMs = null;
    let appMs = null;
    let serverTotalMs = null;

    const mConn = timingHdr.match(/conn;dur=([\d.]+)/);
    if (mConn) connMs = parseFloat(mConn[1]);

    const mSql = timingHdr.match(/sql;dur=([\d.]+)/);
    if (mSql) sqlMs = parseFloat(mSql[1]);

    const mApp = timingHdr.match(/app;dur=([\d.]+)/);
    if (mApp) appMs = parseFloat(mApp[1]);

    const mTot = timingHdr.match(/total;dur=([\d.]+)/);
    if (mTot) serverTotalMs = parseFloat(mTot[1]);

    const netAndColdMs = serverTotalMs !== null ? Math.max(0, clientTotalMs - serverTotalMs) : null;

    return {
      status: res.status,
      ok: res.ok,
      clientTotalMs,
      serverTotalMs,
      connMs,
      sqlMs,
      appMs,
      netAndColdMs,
      timingHdr,
      size: text.length,
      url,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: 0,
      ok: false,
      clientTotalMs: performance.now() - t0,
      serverTotalMs: null,
      connMs: null,
      sqlMs: null,
      appMs: null,
      netAndColdMs: null,
      error: err.message,
      url,
    };
  }
}

async function runProfiles() {
  console.log("============================================================");
  console.log("LATENCY & CONCURRENCY BENCHMARK (4-PART TIMING BREAKDOWN)");
  console.log("============================================================");

  // Setup: Pre-seed test teams
  console.log("--> Setting up test teams...");
  const seedPromises = [];
  for (let t = 1; t <= 70; t++) {
    const tNum = String(t).padStart(2, "0");
    seedPromises.push(
      req(`${BASE}/api/game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: `GAUNTLET_T${tNum}`, start: true }),
      })
    );
  }
  await Promise.all(seedPromises);
  console.log("    Test teams initialized.");

  // 1. Cold Request
  console.log("\n--> 1. Testing COLD Request...");
  const coldRes = await req(`${BASE}/api/game/sync?team=GAUNTLET_T01&_cold=${Date.now()}`);
  console.log(
    `    Status: ${coldRes.status} | Client Total: ${coldRes.clientTotalMs.toFixed(1)} ms | Server: ${coldRes.serverTotalMs} ms [ConnWait: ${coldRes.connMs} ms | SqlExec: ${coldRes.sqlMs} ms | App: ${coldRes.appMs} ms | Net/ColdBoot: ${coldRes.netAndColdMs?.toFixed(1)} ms]`
  );

  // 2. Warm Request
  console.log("\n--> 2. Testing WARM Request (immediate repeat)...");
  const warmRes = await req(`${BASE}/api/game/sync?team=GAUNTLET_T01`);
  console.log(
    `    Status: ${warmRes.status} | Client Total: ${warmRes.clientTotalMs.toFixed(1)} ms | Server: ${warmRes.serverTotalMs} ms [ConnWait: ${warmRes.connMs} ms | SqlExec: ${warmRes.sqlMs} ms | App: ${warmRes.appMs} ms | Net: ${warmRes.netAndColdMs?.toFixed(1)} ms]`
  );

  // 3. Second Request
  console.log("\n--> 3. Testing SECOND Request...");
  const secRes = await req(`${BASE}/api/game/sync?team=GAUNTLET_T01`);
  console.log(
    `    Status: ${secRes.status} | Client Total: ${secRes.clientTotalMs.toFixed(1)} ms | Server: ${secRes.serverTotalMs} ms [ConnWait: ${secRes.connMs} ms | SqlExec: ${secRes.sqlMs} ms | App: ${secRes.appMs} ms]`
  );

  // 4. 10 Sequential Requests
  console.log("\n--> 4. Testing 10 SEQUENTIAL Requests...");
  const seqLatencies = [];
  const seqConn = [];
  const seqSql = [];
  for (let i = 1; i <= 10; i++) {
    const r = await req(`${BASE}/api/game/sync?team=GAUNTLET_T01`);
    seqLatencies.push(r.clientTotalMs);
    if (r.connMs !== null) seqConn.push(r.connMs);
    if (r.sqlMs !== null) seqSql.push(r.sqlMs);
    process.stdout.write(`    [#${i}] ${r.clientTotalMs.toFixed(0)}ms (sql: ${r.sqlMs}ms, conn: ${r.connMs}ms) | `);
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
  console.log("\n--> 5. Testing 90 CONCURRENT Requests (simulating 90 concurrent users across 70 teams)...");
  const promises = [];
  for (let i = 1; i <= 90; i++) {
    const teamNum = String(((i - 1) % 70) + 1).padStart(2, "0");
    // Mix: 60 sync, 20 leaderboard, 10 game GET
    let url = `${BASE}/api/game/sync?team=GAUNTLET_T${teamNum}`;
    if (i % 4 === 0) url = `${BASE}/api/leaderboard?round=1`;
    else if (i % 9 === 0) url = `${BASE}/api/game?team=GAUNTLET_T${teamNum}`;
    promises.push(req(url));
  }

  const concurrentResults = await Promise.all(promises);
  const concLatencies = concurrentResults.map((r) => r.clientTotalMs);
  const concConn = concurrentResults.map((r) => r.connMs).filter((x) => x !== null);
  const concSql = concurrentResults.map((r) => r.sqlMs).filter((x) => x !== null);
  const concCold = concurrentResults.map((r) => r.netAndColdMs).filter((x) => x !== null);
  const failed = concurrentResults.filter((r) => !r.ok);

  console.log(`    90 Concurrent Requests Results:`);
  console.log(`      Total requests: ${concurrentResults.length}`);
  console.log(`      Successful: ${concurrentResults.length - failed.length}`);
  console.log(`      Failed / Timed out (>15s): ${failed.length}`);
  console.log(`      Min Client Latency: ${Math.min(...concLatencies).toFixed(1)} ms`);
  console.log(`      Max Client Latency: ${Math.max(...concLatencies).toFixed(1)} ms`);
  console.log(`      p50 Client Latency: ${pct(concLatencies, 50).toFixed(1)} ms`);
  console.log(`      p95 Client Latency: ${pct(concLatencies, 95).toFixed(1)} ms`);
  console.log(`      p99 Client Latency: ${pct(concLatencies, 99).toFixed(1)} ms`);

  if (failed.length > 0) {
    console.log(`\n    Failure breakdown:`);
    const statusCounts = {};
    for (const f of failed) {
      const key = f.status === 0 ? `Timeout/Network Error: ${f.error}` : `HTTP ${f.status}`;
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    }
    for (const [k, v] of Object.entries(statusCounts)) {
      console.log(`      - ${k}: ${v} requests`);
    }
  }

  console.log(`\n    Detailed 4-Part Component Breakdown for 90 Concurrent Requests:`);
  if (concConn.length > 0) {
    console.log(`      Connection Wait (PgBouncer queueing):`);
    console.log(
      `        p50: ${pct(concConn, 50).toFixed(1)} ms | p95: ${pct(concConn, 95).toFixed(1)} ms | Max: ${Math.max(...concConn).toFixed(1)} ms`
    );
  }
  if (concSql.length > 0) {
    console.log(`      Actual PostgreSQL Query Execution:`);
    console.log(
      `        p50: ${pct(concSql, 50).toFixed(1)} ms | p95: ${pct(concSql, 95).toFixed(1)} ms | Max: ${Math.max(...concSql).toFixed(1)} ms`
    );
  }
  if (concCold.length > 0) {
    console.log(`      Network RTT + Vercel Container Cold Boot:`);
    console.log(
      `        p50: ${pct(concCold, 50).toFixed(1)} ms | p95: ${pct(concCold, 95).toFixed(1)} ms`
    );
  }
}

runProfiles().catch(console.error);
