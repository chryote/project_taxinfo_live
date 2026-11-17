import { FastifyRequest, FastifyReply } from 'fastify';
import { ElasticsearchService } from '../services/elasticsearch.service.js';

export class AnalyticsController {
  public static async getSummary(_req: FastifyRequest, reply: FastifyReply) {
    const summary = await ElasticsearchService.getAnalytics();
    return reply.status(200).send({
      success: true,
      data: summary,
    });
  }

  public static async getLogs(
    req: FastifyRequest<{ Querystring: { q?: string; limit?: string } }>,
    reply: FastifyReply
  ) {
    const query = req.query.q;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 25;
    const logs = await ElasticsearchService.searchAuditLogs(query, limit);

    return reply.status(200).send({
      success: true,
      count: logs.length,
      data: logs,
    });
  }
}
