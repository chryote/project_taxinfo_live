export type VehicleType = 'RODA_2' | 'RODA_4' | 'BUS_TRUK' | 'EV_RODA_2' | 'EV_RODA_4';
export type FuelType = 'BENSIN' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
export type VehicleStatus = 'TERDAFTAR' | 'MENUNGGU_PEMBAYARAN' | 'LUNAS' | 'TERLAMBAT';

export interface Vehicle {
  id?: number;
  plateNumber: string;
  ownerNik: string;
  ownerName: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  manufactureYear: number;
  engineCapacityCc: number;
  njkb: number;
  weightCoefficient: number;
  fuelType: FuelType;
  ownershipSequence: number;
  taxDueDate: string;
  status: VehicleStatus;
}

export interface TaxBreakdown {
  njkb: number;
  weightCoefficient: number;
  taxBase: number;
  taxRate: number;
  pkbPrincipal: number;
  swdkllj: number;
  stnkAdminFee: number;
  tnkbFee: number;
  lateMonths: number;
  pkbPenalty: number;
  swdklljPenalty: number;
  totalTax: number;
  isElectricExempt: boolean;
  progressiveTier: number;
}

export interface TaxAssessment {
  id: string;
  plateNumber: string;
  assessmentYear: number;
  breakdown: TaxBreakdown;
  status: 'TERBIT' | 'PROSES_BAYAR' | 'LUNAS';
  createdAt: string;
  paidAt?: string;
}

export interface VectorSearchResult {
  plateNumber: string;
  brand: string;
  model: string;
  vehicleType: VehicleType;
  manufactureYear: number;
  njkb: number;
  similarity: number;
  estimatedPkb: number;
}

export interface PaymentTransaction {
  id: string;
  assessmentId: string;
  plateNumber: string;
  paymentReference: string;
  amount: number;
  paymentMethod: string;
  status: 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED';
  transactionTime: string;
  eStnkQrToken?: string;
}

export interface AuditLogEntry {
  id?: number;
  eventType: string;
  entityId: string;
  payload: Record<string, any>;
  timestamp: string;
  durationMs?: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  components: {
    postgres_pgvector: { connected: boolean; mode: string };
    rabbitmq: { connected: boolean; mode: string };
    elasticsearch: { connected: boolean; mode: string };
  };
  sustainability: {
    ecoMode: boolean;
    memoryUsage: {
      heapUsedMb: number;
      rssMb: number;
      maxBudgetMb: number;
      utilizationPercent: number;
    };
    greenPractices: string[];
  };
}

export interface DemoUser {
  username: string;
  name: string;
  role: 'PETUGAS_BAPENDA' | 'WAJIB_PAJAK';
  unit: string;
}

export interface AuthResponse {
  token: string;
  user: DemoUser;
}
