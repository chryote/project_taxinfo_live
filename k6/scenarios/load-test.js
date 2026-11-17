import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 10 },  // Ramp-up to 10 VUs
    { duration: '15s', target: 20 }, // Sustain peak load at 20 VUs
    { duration: '5s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<350'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PLATES = ['B%201234%20ABC', 'B%205678%20DEF', 'D%209999%20EV', 'B%203321%20JKT'];

export default function () {
  const plate = PLATES[Math.floor(Math.random() * PLATES.length)];

  // Concurrent plate inquiry & tax assessment
  const res = http.get(`${BASE_URL}/api/v1/tax/calculate/${plate}`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has valid total tax': (r) => {
      try {
        return JSON.parse(r.body).data.assessment.breakdown.totalTax > 0;
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}
