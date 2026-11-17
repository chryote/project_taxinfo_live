import { FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseService } from '../services/database.service.js';
import { RabbitMqService } from '../services/rabbitmq.service.js';
import { ElasticsearchService } from '../services/elasticsearch.service.js';
import { config } from '../config/index.js';

export class HealthController {
  public static async check(_req: FastifyRequest, reply: FastifyReply) {
    const memory = process.memoryUsage();
    const heapUsedMb = Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100;
    const rssMb = Math.round((memory.rss / 1024 / 1024) * 100) / 100;

    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      components: {
        postgres_pgvector: {
          connected: DatabaseService.isDbConnected(),
          mode: DatabaseService.isDbConnected() ? 'native_pgvector_hnsw' : 'resilient_in_memory_hnsw',
        },
        rabbitmq: {
          connected: RabbitMqService.isBrokerConnected(),
          mode: RabbitMqService.isBrokerConnected() ? 'amqp_cluster' : 'resilient_event_bus',
        },
        elasticsearch: {
          connected: ElasticsearchService.isEsConnected(),
          mode: ElasticsearchService.isEsConnected() ? 'cluster_telemetry' : 'in_memory_telemetry',
        },
      },
      sustainability: {
        ecoMode: config.eco.enableEcoMode,
        memoryUsage: {
          heapUsedMb,
          rssMb,
          maxBudgetMb: config.eco.maxMemoryMb,
          utilizationPercent: Math.round((rssMb / config.eco.maxMemoryMb) * 100),
        },
        greenPractices: [
          'HNSW Vector Indexing (Sub-millisecond query complexity)',
          'Asynchronous RabbitMQ payment queue (Throttled DB writes)',
          'Gzip payload compression enabled',
          'Strict container memory & CPU limits',
          'Electric Vehicle (BEV) 0% PKB tax incentive rule enforced',
        ],
      },
    });
  }
}
