/**
 * High-performance benchmark runner matching K6 scenario metrics & thresholds
 */
import http from 'http';

const scenario = process.argv[2] || 'smoke';
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

console.log(`\n============================================================`);
console.log(`[BENCHMARK] SAMSAT PKB Benchmark Suite: [${scenario.toUpperCase()}]`);
console.log(`Target: ${baseUrl}`);
console.log(`============================================================\n`);

async function makeRequest(options, postData) {
  const start = performance.now();
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({
          statusCode: res.statusCode,
          duration,
          data,
          success: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
    });

    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        statusCode: 0,
        duration,
        error: err.message,
        success: false,
      });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getP = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    min: sorted[0].toFixed(2),
    avg: (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
    p50: getP(50).toFixed(2),
    p90: getP(90).toFixed(2),
    p95: getP(95).toFixed(2),
    p99: getP(99).toFixed(2),
    max: sorted[sorted.length - 1].toFixed(2),
  };
}

async function runScenario() {
  let concurrency = 5;
  let totalRequests = 100;
  let targetEndpoint = '/api/v1/health';
  let method = 'GET';
  let postBody = null;

  if (scenario === 'smoke') {
    concurrency = 2;
    totalRequests = 50;
    targetEndpoint = '/api/v1/tax/calculate/B%201234%20ABC';
  } else if (scenario === 'load') {
    concurrency = 15;
    totalRequests = 300;
    targetEndpoint = '/api/v1/tax/calculate/B%205678%20DEF';
  } else if (scenario === 'vector') {
    concurrency = 20;
    totalRequests = 250;
    targetEndpoint = '/api/v1/vehicles/similarity';
    method = 'POST';
    postBody = JSON.stringify({ queryText: 'mobil listrik keluarga', limit: 5 });
  } else if (scenario === 'payment') {
    concurrency = 20;
    totalRequests = 200;
    targetEndpoint = '/api/v1/tax/pay';
    method = 'POST';
    postBody = JSON.stringify({
      assessmentId: 'bench-assessment-123',
      plateNumber: 'B 1234 ABC',
      amount: 475000,
      paymentMethod: 'QRIS',
    });
  }

  const urlObj = new URL(baseUrl);
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: targetEndpoint,
    method,
    headers: {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
    },
  };

  const startTime = performance.now();
  const latencies = [];
  let successful = 0;
  let failed = 0;

  let requestIndex = 0;
  async function worker() {
    while (requestIndex < totalRequests) {
      requestIndex++;
      const res = await makeRequest(options, postBody);
      latencies.push(res.duration);
      if (res.success) successful++;
      else failed++;
    }
  }

  console.log(`[START] Dispatching ${totalRequests} requests (concurrency: ${concurrency})...`);
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTimeSec = (performance.now() - startTime) / 1000;
  const stats = calculatePercentiles(latencies);
  const rps = (totalRequests / totalTimeSec).toFixed(1);
  const errorRate = ((failed / totalRequests) * 100).toFixed(2);

  console.log(`\n------------------------------------------------------------`);
  console.log(`BENCHMARK EXECUTION RESULTS`);
  console.log(`------------------------------------------------------------`);
  console.log(`Endpoint          : ${method} ${targetEndpoint}`);
  console.log(`Total Requests    : ${totalRequests}`);
  console.log(`Duration          : ${totalTimeSec.toFixed(2)}s`);
  console.log(`Throughput        : ${rps} req/sec`);
  console.log(`Error Rate        : ${errorRate}% (${failed} failed)`);
  console.log(`\nLatency Percentiles:`);
  console.log(`  Min             : ${stats.min} ms`);
  console.log(`  Avg             : ${stats.avg} ms`);
  console.log(`  p50 (Median)    : ${stats.p50} ms`);
  console.log(`  p90             : ${stats.p90} ms`);
  console.log(`  p95 (Threshold) : ${stats.p95} ms (K6 Threshold: < 200 ms)`);
  console.log(`  p99             : ${stats.p99} ms`);
  console.log(`  Max             : ${stats.max} ms`);

  const passedThresholds = parseFloat(stats.p95) < 200 && parseFloat(errorRate) < 1.0;
  console.log(`\nThreshold Assessment:`);
  if (passedThresholds) {
    console.log(`[PASSED] p(95) < 200ms and error_rate < 1.0%`);
  } else {
    console.log(`[FAILED] Exceeded target latency or error rate.`);
    process.exit(1);
  }
}

runScenario().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
