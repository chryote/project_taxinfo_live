import { buildApp } from './app.js';
import { config } from './config/index.js';
import { DatabaseService } from './services/database.service.js';
import { RabbitMqService } from './services/rabbitmq.service.js';
import { ElasticsearchService } from './services/elasticsearch.service.js';

async function bootstrap() {
  console.log('[INFO] Initializing Pajak Kendaraan Bermotor (PKB) Core Engine...');

  // Initialize data stores & message broker in parallel
  await Promise.all([
    DatabaseService.initialize(),
    RabbitMqService.initialize(),
    ElasticsearchService.initialize(),
  ]);

  const app = buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[INFO] PKB Green API server listening at http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('Failed to bind server port:', err);
    process.exit(1);
  }

  // Graceful shutdown handling for container orchestrators
  const shutdown = async (signal: string) => {
    console.log(`\n[INFO] Received ${signal}, starting graceful shutdown...`);
    await app.close();
    await RabbitMqService.close();
    await DatabaseService.close();
    console.log('[INFO] All services stopped safely. Bye!');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
