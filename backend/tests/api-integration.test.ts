import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { DatabaseService } from '../src/services/database.service.js';
import { RabbitMqService } from '../src/services/rabbitmq.service.js';
import { ElasticsearchService } from '../src/services/elasticsearch.service.js';
import { FastifyInstance } from 'fastify';

describe('API Integration Tests (Fastify Injection)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await DatabaseService.initialize();
    await RabbitMqService.initialize();
    await ElasticsearchService.initialize();
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health should return 200 OK and green sustainability telemetry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.sustainability).toBeDefined();
    expect(body.sustainability.memoryUsage.heapUsedMb).toBeGreaterThan(0);
    expect(body.sustainability.greenPractices.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/tax/calculate/:plate should return 200 with tax breakdown for valid vehicle', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tax/calculate/B%201234%20ABC',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.assessment.breakdown.totalTax).toBeGreaterThan(0);
  });

  it('GET /api/v1/tax/calculate/:plate should return 404 for invalid plate', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tax/calculate/UNKNOWN123',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
  });

  it('POST /api/v1/tax/simulate should return 200 for valid simulation payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tax/simulate',
      payload: {
        njkb: 150000000,
        vehicleType: 'RODA_4',
        engineCapacityCc: 1500,
        ownershipSequence: 1,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.taxRate).toBe(0.02);
  });

  it('POST /api/v1/tax/simulate should return 400 for invalid inputs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tax/simulate',
      payload: {
        njkb: -500, // Invalid negative NJKB
        vehicleType: 'INVALID_TYPE',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/vehicles/similarity should return ranked similar vehicles using pgvector', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/vehicles/similarity',
      payload: {
        queryText: 'Toyota Avanza MPV',
        limit: 3,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].similarity).toBeGreaterThan(0);
  });

  it('POST /api/v1/tax/pay should return 202 Accepted with queued payment job', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tax/pay',
      payload: {
        assessmentId: 'test-uuid-1234',
        plateNumber: 'B 5678 DEF',
        amount: 4518000,
        paymentMethod: 'QRIS',
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.paymentReference).toContain('PAY-PKB-');
    expect(body.data.status).toBe('PROCESSING');
  });

  it('GET /api/v1/analytics/summary should return 200 with telemetry metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.recentLogs).toBeDefined();
  });

  it('POST /api/v1/auth/login should authenticate valid demo credentials and reject invalid ones', async () => {
    const validRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'demo_petugas',
        password: 'jmc2026',
      },
    });
    expect(validRes.statusCode).toBe(200);
    const validBody = JSON.parse(validRes.body);
    expect(validBody.success).toBe(true);
    expect(validBody.data.user.username).toBe('demo_petugas');

    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: 'demo_petugas',
        password: 'wrongpassword',
      },
    });
    expect(invalidRes.statusCode).toBe(401);
  });
});
