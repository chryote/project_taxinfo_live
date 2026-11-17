import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ElasticsearchService } from '../services/elasticsearch.service.js';

export interface DemoUser {
  username: string;
  name: string;
  role: 'PETUGAS_BAPENDA' | 'WAJIB_PAJAK';
  unit: string;
}

interface StoredAccount extends DemoUser {
  password: string;
}

const DEMO_ACCOUNTS: StoredAccount[] = [
  {
    username: 'demo_petugas',
    password: 'jmc2026',
    name: 'Budi Pratama, S.Kom',
    role: 'PETUGAS_BAPENDA',
    unit: 'UPPD SAMSAT Kota Yogyakarta (Auditor & Verifikator)',
  },
  {
    username: 'wajib_pajak',
    password: 'samsat123',
    name: 'Andi Wijaya',
    role: 'WAJIB_PAJAK',
    unit: 'Layanan Mandiri E-SAMSAT DIY',
  },
];

const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export class AuthController {
  /**
   * POST /api/v1/auth/login
   * Authenticates demo user for SAMSAT Digital portal testing
   */
  public static async login(req: FastifyRequest, reply: FastifyReply) {
    const startTime = Date.now();
    const parseResult = loginSchema.safeParse(req.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Username dan password wajib diisi',
        details: parseResult.error.errors,
      });
    }

    const { username, password } = parseResult.data;
    const normalizedUser = username.trim().toLowerCase();

    const matched = DEMO_ACCOUNTS.find(
      (acc) => acc.username.toLowerCase() === normalizedUser && acc.password === password
    );

    if (!matched) {
      await ElasticsearchService.indexAuditLog({
        eventType: 'AUTH_LOGIN_FAILED',
        entityId: normalizedUser,
        payload: { username: normalizedUser, reason: 'Invalid credentials' },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      });

      return reply.status(401).send({
        success: false,
        error: 'Kredensial tidak valid. Gunakan akun demo: demo_petugas / jmc2026',
      });
    }

    const token = Buffer.from(`${matched.username}:${matched.role}:${Date.now()}`).toString('base64');

    await ElasticsearchService.indexAuditLog({
      eventType: 'AUTH_LOGIN_SUCCESS',
      entityId: matched.username,
      payload: {
        username: matched.username,
        name: matched.name,
        role: matched.role,
        unit: matched.unit,
      },
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    });

    return reply.status(200).send({
      success: true,
      data: {
        token,
        user: {
          username: matched.username,
          name: matched.name,
          role: matched.role,
          unit: matched.unit,
        },
      },
    });
  }

  /**
   * GET /api/v1/auth/demo-accounts
   * Returns public demo account hints for testing convenience
   */
  public static async getDemoAccounts(_req: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      success: true,
      data: DEMO_ACCOUNTS.map((acc) => ({
        username: acc.username,
        password: acc.password,
        name: acc.name,
        role: acc.role,
        unit: acc.unit,
      })),
    });
  }
}
