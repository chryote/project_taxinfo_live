import { Client } from '@elastic/elasticsearch';
import { config } from '../config/index.js';
import { AuditLogEntry } from '../domain/types.js';

export class ElasticsearchService {
  private static client: Client | null = null;
  private static isConnected = false;
  private static inMemoryLogs: AuditLogEntry[] = [];

  /**
   * Initialize Elasticsearch client and create index template if needed
   */
  public static async initialize(): Promise<void> {
    try {
      this.client = new Client({
        node: config.elasticsearch.node,
        maxRetries: 2,
        requestTimeout: 3000,
      });

      const ping = await this.client.ping();
      if (ping) {
        this.isConnected = true;
        console.log('[INFO] Connected to Elasticsearch');
        await this.ensureIndex();
      }
    } catch (err: unknown) {
      this.isConnected = false;
      console.warn(
        '[WARN] Elasticsearch not reachable, operating with in-memory telemetry buffer:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  public static isEsConnected(): boolean {
    return this.isConnected;
  }

  private static async ensureIndex(): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      const exists = await this.client.indices.exists({ index: config.elasticsearch.index });
      if (!exists) {
        await this.client.indices.create({
          index: config.elasticsearch.index,
          body: {
            mappings: {
              properties: {
                eventType: { type: 'keyword' },
                entityId: { type: 'keyword' },
                timestamp: { type: 'date' },
                durationMs: { type: 'float' },
                payload: { type: 'object' },
              },
            },
          },
        });
      }
    } catch {
      // Ignore if exists or creation races
    }
  }

  /**
   * Index audit log entry to Elasticsearch
   */
  public static async indexAuditLog(entry: AuditLogEntry): Promise<void> {
    const enriched: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    };

    if (this.isConnected && this.client) {
      try {
        await this.client.index({
          index: config.elasticsearch.index,
          document: enriched,
        });
        return;
      } catch (err) {
        console.error('Failed to index document in Elasticsearch:', err);
      }
    }

    // In-memory fallback
    this.inMemoryLogs.unshift(enriched);
    if (this.inMemoryLogs.length > 500) {
      this.inMemoryLogs.pop(); // Keep bounded memory
    }
  }

  /**
   * Search audit logs
   */
  public static async searchAuditLogs(
    query?: string,
    limit = 20
  ): Promise<AuditLogEntry[]> {
    if (this.isConnected && this.client) {
      try {
        const esQuery = query
          ? {
              query_string: {
                query: `*${query}*`,
                fields: ['eventType', 'entityId', 'payload.*'],
              },
            }
          : { match_all: {} };

        const response = await this.client.search({
          index: config.elasticsearch.index,
          size: limit,
          sort: [{ timestamp: { order: 'desc' } }],
          query: esQuery,
        });

        return response.hits.hits.map((hit) => hit._source as AuditLogEntry);
      } catch (err) {
        console.error('Elasticsearch search error:', err);
      }
    }

    // In-memory filter
    if (!query) {
      return this.inMemoryLogs.slice(0, limit);
    }
    const qLower = query.toLowerCase();
    return this.inMemoryLogs
      .filter(
        (log) =>
          log.eventType.toLowerCase().includes(qLower) ||
          log.entityId.toLowerCase().includes(qLower) ||
          JSON.stringify(log.payload).toLowerCase().includes(qLower)
      )
      .slice(0, limit);
  }

  /**
   * Get tax analytics metrics (total assessed, total collected, average latency)
   */
  public static async getAnalytics(): Promise<{
    totalAssessments: number;
    totalPayments: number;
    totalAmountCollected: number;
    recentLogs: AuditLogEntry[];
  }> {
    const logs = await this.searchAuditLogs(undefined, 50);

    let totalAssessments = 0;
    let totalPayments = 0;
    let totalAmountCollected = 0;

    for (const log of logs) {
      if (log.eventType === 'TAX_ASSESSMENT_CREATED') {
        totalAssessments += 1;
      } else if (log.eventType === 'TAX_PAYMENT_SETTLED') {
        totalPayments += 1;
        if (log.payload && typeof log.payload.amount === 'number') {
          totalAmountCollected += log.payload.amount;
        }
      }
    }

    return {
      totalAssessments,
      totalPayments,
      totalAmountCollected,
      recentLogs: logs.slice(0, 10),
    };
  }
}
