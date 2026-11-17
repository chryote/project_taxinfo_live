import pg from 'pg';
import { config } from '../config/index.js';
import { Vehicle, TaxAssessment, VectorSearchResult } from '../domain/types.js';
import { EmbeddingService } from './embedding.service.js';

const { Pool } = pg;

export class DatabaseService {
  private static pool: pg.Pool | null = null;
  private static isConnected = false;
  private static inMemoryVehicles: Vehicle[] = [];
  private static inMemoryAssessments: Map<string, TaxAssessment> = new Map();

  /**
   * Initialize PostgreSQL connection pool and in-memory fallback
   */
  public static async initialize(): Promise<void> {
    this.seedInMemoryVehicles();

    try {
      const timeout = process.env.NODE_ENV === 'test' ? 250 : 3000;
      this.pool = new Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        database: config.postgres.database,
        user: config.postgres.user,
        password: config.postgres.password,
        max: config.postgres.max,
        idleTimeoutMillis: config.postgres.idleTimeoutMillis,
        connectionTimeoutMillis: timeout,
      });

      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.isConnected = true;
      console.log('[INFO] Connected to PostgreSQL with pgvector');
    } catch (err: unknown) {
      this.isConnected = false;
      console.warn(
        '[WARN] PostgreSQL not reachable, running with resilient in-memory data engine:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  public static isDbConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Find vehicle by plate number
   */
  public static async getVehicleByPlate(plate: string): Promise<Vehicle | null> {
    const formattedPlate = plate.toUpperCase().trim();

    if (this.isConnected && this.pool) {
      try {
        const query = `
          SELECT id, plate_number as "plateNumber", owner_nik as "ownerNik", owner_name as "ownerName",
                 vehicle_type as "vehicleType", brand, model, manufacture_year as "manufactureYear",
                 engine_capacity_cc as "engineCapacityCc", njkb::numeric, weight_coefficient::numeric as "weightCoefficient",
                 fuel_type as "fuelType", ownership_sequence as "ownershipSequence",
                 tax_due_date::text as "taxDueDate", status, embedding
          FROM vehicles
          WHERE UPPER(plate_number) = $1
        `;
        const res = await this.pool.query(query, [formattedPlate]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            ...row,
            njkb: Number(row.njkb),
            weightCoefficient: Number(row.weightCoefficient),
          };
        }
      } catch (err) {
        console.error('Postgres error querying vehicle:', err);
      }
    }

    // In-memory fallback
    const match = this.inMemoryVehicles.find(
      (v) => v.plateNumber.toUpperCase().replace(/\s+/g, '') === formattedPlate.replace(/\s+/g, '')
    );
    return match ? { ...match } : null;
  }

  /**
   * Perform pgvector Cosine Similarity search (<=> operator)
   */
  public static async searchSimilarVehicles(
    queryVector: number[],
    limit = 5
  ): Promise<VectorSearchResult[]> {
    if (this.isConnected && this.pool) {
      try {
        const vectorStr = `[${queryVector.join(',')}]`;
        const query = `
          SELECT plate_number as "plateNumber", brand, model, vehicle_type as "vehicleType",
                 manufacture_year as "manufactureYear", njkb::numeric,
                 (1 - (embedding <=> $1::vector)) as similarity
          FROM vehicles
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> $1::vector ASC
          LIMIT $2;
        `;
        const res = await this.pool.query(query, [vectorStr, limit]);
        return res.rows.map((row) => ({
          plateNumber: row.plateNumber,
          brand: row.brand,
          model: row.model,
          vehicleType: row.vehicleType,
          manufactureYear: row.manufactureYear,
          njkb: Number(row.njkb),
          similarity: Number(Math.max(0, Math.min(1, row.similarity)).toFixed(4)),
          estimatedPkb: Math.round(Number(row.njkb) * 0.02),
        }));
      } catch (err) {
        console.error('Postgres pgvector query failed, using in-memory vector search:', err);
      }
    }

    // In-memory pgvector emulation using exact Cosine Similarity
    const scored = this.inMemoryVehicles
      .filter((v) => v.embedding && v.embedding.length > 0)
      .map((v) => {
        const similarity = EmbeddingService.cosineSimilarity(queryVector, v.embedding!);
        return {
          plateNumber: v.plateNumber,
          brand: v.brand,
          model: v.model,
          vehicleType: v.vehicleType,
          manufactureYear: v.manufactureYear,
          njkb: v.njkb,
          similarity: Number(similarity.toFixed(4)),
          estimatedPkb: Math.round(v.njkb * 0.02),
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  }

  /**
   * Save tax assessment
   */
  public static async saveAssessment(assessment: TaxAssessment): Promise<void> {
    if (this.isConnected && this.pool) {
      try {
        const query = `
          INSERT INTO tax_assessments (
            id, plate_number, assessment_year, njkb, weight_coefficient, tax_base, tax_rate,
            pkb_principal, swdkllj, stnk_admin_fee, tnkb_fee, late_months, pkb_penalty,
            swdkllj_penalty, total_tax, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
        `;
        const b = assessment.breakdown;
        await this.pool.query(query, [
          assessment.id,
          assessment.plateNumber,
          assessment.assessmentYear,
          b.njkb,
          b.weightCoefficient,
          b.taxBase,
          b.taxRate,
          b.pkbPrincipal,
          b.swdkllj,
          b.stnkAdminFee,
          b.tnkbFee,
          b.lateMonths,
          b.pkbPenalty,
          b.swdklljPenalty,
          b.totalTax,
          assessment.status,
        ]);
        return;
      } catch (err) {
        console.error('Postgres error saving assessment:', err);
      }
    }

    this.inMemoryAssessments.set(assessment.id, assessment);
  }

  /**
   * Get tax assessment by ID
   */
  public static async getAssessmentById(id: string): Promise<TaxAssessment | null> {
    if (this.isConnected && this.pool) {
      try {
        const query = `
          SELECT id, plate_number as "plateNumber", assessment_year as "assessmentYear",
                 njkb, weight_coefficient as "weightCoefficient", tax_base as "taxBase",
                 tax_rate as "taxRate", pkb_principal as "pkbPrincipal", swdkllj,
                 stnk_admin_fee as "stnkAdminFee", tnkb_fee as "tnkbFee", late_months as "lateMonths",
                 pkb_penalty as "pkbPenalty", swdkllj_penalty as "swdklljPenalty",
                 total_tax as "totalTax", status, created_at as "createdAt", paid_at as "paidAt"
          FROM tax_assessments
          WHERE id = $1;
        `;
        const res = await this.pool.query(query, [id]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            id: row.id,
            plateNumber: row.plateNumber,
            assessmentYear: row.assessmentYear,
            status: row.status,
            createdAt: row.createdAt,
            paidAt: row.paidAt,
            breakdown: {
              njkb: Number(row.njkb),
              weightCoefficient: Number(row.weightCoefficient),
              taxBase: Number(row.taxBase),
              taxRate: Number(row.taxRate),
              pkbPrincipal: Number(row.pkbPrincipal),
              swdkllj: Number(row.swdkllj),
              stnkAdminFee: Number(row.stnkAdminFee),
              tnkbFee: Number(row.tnkbFee),
              lateMonths: Number(row.lateMonths),
              pkbPenalty: Number(row.pkbPenalty),
              swdklljPenalty: Number(row.swdklljPenalty),
              totalTax: Number(row.totalTax),
              isElectricExempt: Number(row.taxRate) === 0,
              progressiveTier: 1,
            },
          };
        }
      } catch (err) {
        console.error('Postgres error reading assessment:', err);
      }
    }

    return this.inMemoryAssessments.get(id) || null;
  }

  /**
   * Update assessment status to LUNAS upon payment settlement
   */
  public static async updateAssessmentPaid(
    assessmentId: string,
    paidAt = new Date().toISOString()
  ): Promise<void> {
    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `UPDATE tax_assessments SET status = 'LUNAS', paid_at = $1 WHERE id = $2`,
          [paidAt, assessmentId]
        );
        return;
      } catch (err) {
        console.error('Postgres error updating assessment status:', err);
      }
    }

    const item = this.inMemoryAssessments.get(assessmentId);
    if (item) {
      item.status = 'LUNAS';
      item.paidAt = paidAt;
    }
  }

  /**
   * Update vehicle status
   */
  public static async updateVehicleStatus(plate: string, status: string): Promise<void> {
    if (this.isConnected && this.pool) {
      try {
        await this.pool.query('UPDATE vehicles SET status = $1 WHERE UPPER(plate_number) = $2', [
          status,
          plate.toUpperCase().trim(),
        ]);
        return;
      } catch (err) {
        console.error('Postgres error updating vehicle status:', err);
      }
    }

    const v = this.inMemoryVehicles.find(
      (item) => item.plateNumber.toUpperCase().replace(/\s+/g, '') === plate.toUpperCase().replace(/\s+/g, '')
    );
    if (v) {
      v.status = status as any;
    }
  }

  /**
   * Reset vehicle payment status back to unpaid (MENUNGGU_PEMBAYARAN) for demo testing
   */
  public static async resetDemoStatus(plate?: string): Promise<void> {
    if (plate && plate.trim().length > 0) {
      await this.updateVehicleStatus(plate, 'MENUNGGU_PEMBAYARAN');
      return;
    }
    this.seedInMemoryVehicles();
    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(`UPDATE vehicles SET status = 'MENUNGGU_PEMBAYARAN' WHERE status = 'LUNAS'`);
      } catch (err) {
        console.error('Postgres error resetting demo vehicle status:', err);
      }
    }
  }

  /**
   * Seed realistic in-memory vehicles with embeddings for zero-friction local tests
   */
  private static seedInMemoryVehicles(): void {
    const rawVehicles: Omit<Vehicle, 'embedding'>[] = [
      {
        plateNumber: 'B 1234 ABC',
        ownerNik: '3171012345670001',
        ownerName: 'Budi Santoso',
        vehicleType: 'RODA_2',
        brand: 'Honda',
        model: 'Vario 160 CBS',
        manufactureYear: 2023,
        engineCapacityCc: 157,
        njkb: 22000000,
        weightCoefficient: 1.0,
        fuelType: 'BENSIN',
        ownershipSequence: 1,
        taxDueDate: '2026-12-15',
        status: 'MENUNGGU_PEMBAYARAN',
      },
      {
        plateNumber: 'B 5678 DEF',
        ownerNik: '3171012345670001',
        ownerName: 'Budi Santoso',
        vehicleType: 'RODA_4',
        brand: 'Toyota',
        model: 'Avanza 1.5 G CVT',
        manufactureYear: 2022,
        engineCapacityCc: 1496,
        njkb: 175000000,
        weightCoefficient: 1.0,
        fuelType: 'BENSIN',
        ownershipSequence: 2,
        taxDueDate: '2026-11-20',
        status: 'MENUNGGU_PEMBAYARAN',
      },
      {
        plateNumber: 'D 9999 EV',
        ownerNik: '3273019876540002',
        ownerName: 'Siti Rahma',
        vehicleType: 'EV_RODA_4',
        brand: 'Hyundai',
        model: 'Ioniq 5 Signature Long Range',
        manufactureYear: 2023,
        engineCapacityCc: 0,
        njkb: 580000000,
        weightCoefficient: 1.0,
        fuelType: 'ELECTRIC',
        ownershipSequence: 1,
        taxDueDate: '2027-01-10',
        status: 'MENUNGGU_PEMBAYARAN',
      },
      {
        plateNumber: 'B 3321 JKT',
        ownerNik: '3172023456780003',
        ownerName: 'Ahmad Dahlan',
        vehicleType: 'RODA_2',
        brand: 'Yamaha',
        model: 'NMAX 155 Connected',
        manufactureYear: 2022,
        engineCapacityCc: 155,
        njkb: 24500000,
        weightCoefficient: 1.0,
        fuelType: 'BENSIN',
        ownershipSequence: 1,
        taxDueDate: '2026-08-10',
        status: 'TERLAMBAT',
      },
      {
        plateNumber: 'L 8888 WUL',
        ownerNik: '3578034567890004',
        ownerName: 'Lina Marlina',
        vehicleType: 'EV_RODA_4',
        brand: 'Wuling',
        model: 'Air EV Long Range',
        manufactureYear: 2023,
        engineCapacityCc: 0,
        njkb: 190000000,
        weightCoefficient: 1.0,
        fuelType: 'ELECTRIC',
        ownershipSequence: 1,
        taxDueDate: '2026-10-05',
        status: 'LUNAS',
      },
      {
        plateNumber: 'B 7777 TRK',
        ownerNik: '3174045678900005',
        ownerName: 'PT Logistik Mandiri',
        vehicleType: 'BUS_TRUK',
        brand: 'Isuzu',
        model: 'Giga FVR 285 PS',
        manufactureYear: 2021,
        engineCapacityCc: 7790,
        njkb: 450000000,
        weightCoefficient: 1.3,
        fuelType: 'DIESEL',
        ownershipSequence: 1,
        taxDueDate: '2026-09-01',
        status: 'TERLAMBAT',
      },
      {
        plateNumber: 'B 2468 XYZ',
        ownerNik: '3171012345670001',
        ownerName: 'Budi Santoso',
        vehicleType: 'RODA_4',
        brand: 'Honda',
        model: 'HR-V 1.5 SE',
        manufactureYear: 2023,
        engineCapacityCc: 1498,
        njkb: 295000000,
        weightCoefficient: 1.0,
        fuelType: 'BENSIN',
        ownershipSequence: 3,
        taxDueDate: '2026-12-01',
        status: 'MENUNGGU_PEMBAYARAN',
      },
    ];

    this.inMemoryVehicles = rawVehicles.map((v) => ({
      ...v,
      embedding: EmbeddingService.generateVehicleEmbedding({
        vehicleType: v.vehicleType,
        fuelType: v.fuelType,
        engineCapacityCc: v.engineCapacityCc,
        njkb: v.njkb,
        brand: v.brand,
        model: v.model,
        manufactureYear: v.manufactureYear,
      }),
    }));
  }

  public static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }
}
