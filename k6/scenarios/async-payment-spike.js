import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '3s', target: 20 },
    { duration: '10s', target: 50 }, // 50 concurrent payment spikes into RabbitMQ
    { duration: '3s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const payload = JSON.stringify({
    assessmentId: `bench-${Math.random().toString(36).substring(2, 9)}`,
    plateNumber: 'B 1234 ABC',
    amount: 475000,
    paymentMethod: 'QRIS',
  });

  const res = http.post(`${BASE_URL}/api/v1/tax/pay`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'payment queued 202': (r) => r.status === 202,
    'has payment reference': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.paymentReference.includes('PAY-PKB-');
      } catch {
        return false;
      }
    },
  });

  sleep(0.05);
}
