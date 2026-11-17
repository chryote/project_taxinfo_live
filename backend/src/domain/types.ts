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
  ownershipSequence: number; // 1 = 1st vehicle, 2 = 2nd vehicle (progressive)
  taxDueDate: string; // YYYY-MM-DD
  status: VehicleStatus;
  embedding?: number[];
  createdAt?: string;
}

export interface TaxCalculationParams {
  njkb: number;
  vehicleType: VehicleType;
  engineCapacityCc: number;
  ownershipSequence: number; // 1, 2, 3...
  weightCoefficient?: number;
  isElectric?: boolean;
  isPublicTransport?: boolean;
  lateMonths?: number;
  isFiveYearRenewal?: boolean; // STNK 5-year plate renewal vs annual validation
}

export interface TaxBreakdown {
  njkb: number;
  weightCoefficient: number;
  taxBase: number; // DP PKB = NJKB * Bobot
  taxRate: number; // e.g. 0.02 (2.0%) or 0.00 (EV)
  pkbPrincipal: number; // Pokok PKB
  swdkllj: number; // SWDKLLJ Pokok
  stnkAdminFee: number; // PNBP STNK
  tnkbFee: number; // PNBP Plat Nomor (TNKB)
  lateMonths: number;
  pkbPenalty: number; // Sanksi Denda PKB
  swdklljPenalty: number; // Sanksi Denda SWDKLLJ
  totalTax: number; // Total Tagihan PKB
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

export interface PaymentRequest {
  assessmentId: string;
  plateNumber: string;
  amount: number;
  paymentMethod: 'QRIS' | 'VIRTUAL_ACCOUNT' | 'TRANSFER_BANK';
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
  settledAt?: string;
  eStnkQrToken?: string;
}

export interface VectorSearchResult {
  plateNumber: string;
  brand: string;
  model: string;
  vehicleType: VehicleType;
  manufactureYear: number;
  njkb: number;
  similarity: number; // Cosine similarity 0.0 to 1.0
  estimatedPkb: number;
}

export interface AuditLogEntry {
  id?: number;
  eventType: string;
  entityId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  durationMs?: number;
}
