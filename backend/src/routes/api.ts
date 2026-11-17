import { FastifyInstance } from 'fastify';
import { TaxController } from '../controllers/tax.controller.js';
import { VehicleController } from '../controllers/vehicle.controller.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { HealthController } from '../controllers/health.controller.js';
import { AuthController } from '../controllers/auth.controller.js';

export async function apiRoutes(fastify: FastifyInstance) {
  // Authentication & Demo Credentials
  fastify.post('/auth/login', AuthController.login);
  fastify.get('/auth/demo-accounts', AuthController.getDemoAccounts);

  // Health & Sustainability
  fastify.get('/health', HealthController.check);

  // Tax Assessment & Simulation
  fastify.get('/tax/calculate/:plate', TaxController.calculateByPlate);
  fastify.post('/tax/simulate', TaxController.simulate);
  fastify.post('/tax/pay', TaxController.pay);

  // Vehicles & pgvector Similarity
  fastify.get('/vehicles/:plate', VehicleController.getByPlate);
  fastify.post('/vehicles/similarity', VehicleController.searchSimilarity);

  // ELK Analytics & Audit Logs
  fastify.get('/analytics/summary', AnalyticsController.getSummary);
  fastify.get('/analytics/logs', AnalyticsController.getLogs);
}
