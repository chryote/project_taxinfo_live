import {
  Vehicle,
  TaxAssessment,
  TaxBreakdown,
  VectorSearchResult,
  PaymentTransaction,
  HealthResponse,
  AuditLogEntry,
  VehicleType,
  AuthResponse,
} from '../types/index.js';

const BASE_URL = '/api/v1';

export class ApiService {
  public static async login(username: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Login gagal');
    return body.data;
  }

  public static async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error('Failed to fetch system health');
    return res.json();
  }

  public static async calculateForPlate(
    plate: string,
    isFiveYear = false
  ): Promise<{ vehicle: Vehicle; assessment: TaxAssessment }> {
    const encoded = encodeURIComponent(plate.trim());
    const res = await fetch(`${BASE_URL}/tax/calculate/${encoded}?fiveYear=${isFiveYear}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to calculate tax for vehicle');
    return body.data;
  }

  public static async simulateTax(params: {
    njkb: number;
    vehicleType: VehicleType;
    engineCapacityCc: number;
    ownershipSequence: number;
    weightCoefficient?: number;
    isElectric?: boolean;
    isPublicTransport?: boolean;
    lateMonths?: number;
    isFiveYearRenewal?: boolean;
  }): Promise<TaxBreakdown> {
    const res = await fetch(`${BASE_URL}/tax/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to simulate tax');
    return body.data;
  }

  public static async searchSimilarity(params: {
    queryText?: string;
    vehicleType?: VehicleType;
    limit?: number;
  }): Promise<VectorSearchResult[]> {
    const res = await fetch(`${BASE_URL}/vehicles/similarity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Similarity search failed');
    return body.data;
  }

  public static async payTax(params: {
    assessmentId: string;
    plateNumber: string;
    amount: number;
    paymentMethod: 'QRIS' | 'VIRTUAL_ACCOUNT' | 'TRANSFER_BANK';
  }): Promise<PaymentTransaction> {
    const res = await fetch(`${BASE_URL}/tax/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Payment failed');
    return body.data;
  }

  public static async getAnalyticsSummary(): Promise<{
    totalAssessments: number;
    totalPayments: number;
    totalAmountCollected: number;
    recentLogs: AuditLogEntry[];
  }> {
    const res = await fetch(`${BASE_URL}/analytics/summary`);
    const body = await res.json();
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return body.data;
  }

  public static async getAuditLogs(query?: string): Promise<AuditLogEntry[]> {
    const qParam = query ? `?q=${encodeURIComponent(query)}` : '';
    const res = await fetch(`${BASE_URL}/analytics/logs${qParam}`);
    const body = await res.json();
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return body.data;
  }
}
