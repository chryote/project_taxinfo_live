import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'pajak_kendaraan',
    user: process.env.POSTGRES_USER || 'samsat_user',
    password: process.env.POSTGRES_PASSWORD || 'samsat_secure_pass',
    max: parseInt(process.env.MAX_CONNECTION_POOL_SIZE || '10', 10),
    idleTimeoutMillis: parseInt(process.env.IDLE_CONNECTION_TIMEOUT_MS || '10000', 10),
  },

  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    user: process.env.RABBITMQ_USER || 'samsat_mq',
    password: process.env.RABBITMQ_PASSWORD || 'samsat_mq_pass',
    queues: {
      assessment: 'samsat.tax.assessment',
      payment: 'samsat.tax.payment',
      audit: 'samsat.audit.log',
    },
  },

  elasticsearch: {
    node: `http://${process.env.ELASTICSEARCH_HOST || 'localhost'}:${process.env.ELASTICSEARCH_PORT || '9200'}`,
    index: 'pajak-kendaraan-logs',
  },

  eco: {
    enableEcoMode: process.env.ENABLE_ECO_MODE === 'true',
    maxMemoryMb: 384,
  },
};
