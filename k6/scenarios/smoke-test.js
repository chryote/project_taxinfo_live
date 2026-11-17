import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<150'], // 95% of requests must complete below 150ms
    http_req_failed: ['rate<0.01'],    // Less than 1% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Healthcheck
  const resHealth = http.get(`${BASE_URL}/api/v1/health`);
  check(resHealth, {
    'health returns 200': (r) => r.status === 200,
    'eco mode active': (r) => JSON.parse(r.body).sustainability.ecoMode === true,
  });

  // 2. Tax Calculation for Plate
  const resTax = http.get(`${BASE_URL}/api/v1/tax/calculate/B%201234%20ABC`);
  check(resTax, {
    'tax calc returns 200': (r) => r.status === 200,
    'totalTax is positive': (r) => JSON.parse(r.body).data.assessment.breakdown.totalTax > 0,
  });

  // 3. Tax Simulation
  const payload = JSON.stringify({
    njkb: 175000000,
    vehicleType: 'RODA_4',
    engineCapacityCc: 1500,
    ownershipSequence: 1,
  });
  const resSim = http.post(`${BASE_URL}/api/v1/tax/simulate`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(resSim, {
    'simulate returns 200': (r) => r.status === 200,
    'taxRate is 2.0%': (r) => JSON.parse(r.body).data.taxRate === 0.02,
  });

  sleep(0.5);
}
