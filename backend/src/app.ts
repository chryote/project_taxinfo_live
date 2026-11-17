import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import fs from 'node:fs';
import path from 'node:path';
import { apiRoutes } from './routes/api.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveFrontendDistDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), 'public'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }
  return null;
}

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: false, // Keep logging minimal/green, logs are piped to RabbitMQ/ELK
    disableRequestLogging: true,
  });

  // Green web practices: Enable gzip/deflate compression for reduced network bandwidth and energy
  app.register(compress, {
    threshold: 512, // Compress payloads > 512 bytes
    encodings: ['gzip', 'deflate'],
  });

  // Enable CORS
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Register API routes with /api/v1 prefix
  app.register(apiRoutes, { prefix: '/api/v1' });

  const frontendDist = resolveFrontendDistDir();

  // Serve built Vue SPA if dist exists (Cloud Run / Single-Port Unified Mode), otherwise API info
  app.get('/*', async (req, reply) => {
    if (!frontendDist) {
      return {
        message: 'Pajak Kendaraan Bermotor (PKB) Engine API',
        version: '1.0.0',
        documentation: '/api/v1/health',
      };
    }

    const reqPath = (req.url.split('?')[0] || '/').replace(/^\/+/, '');
    const safePath = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
    let targetFile = path.join(frontendDist, safePath);

    if (!safePath || !fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
      targetFile = path.join(frontendDist, 'index.html');
    }

    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    if (ext && ext !== '.html') {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    }
    reply.type(contentType);
    return fs.createReadStream(targetFile);
  });

  return app;
}
