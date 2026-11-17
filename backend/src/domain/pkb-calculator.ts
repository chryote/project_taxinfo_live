import { TaxCalculationParams, TaxBreakdown, VehicleType } from './types.js';

export class PkbCalculator {
  /**
   * Determine the progressive tax rate based on ownership sequence and vehicle properties.
   * Law: UU HKPD No. 1/2022 & Permendagri No. 6/2023
   */
  public static determineTaxRate(params: {
    ownershipSequence: number;
    isElectric?: boolean;
    isPublicTransport?: boolean;
    vehicleType?: VehicleType;
  }): { rate: number; isElectricExempt: boolean; progressiveTier: number } {
    const isElectric =
      params.isElectric ||
      params.vehicleType === 'EV_RODA_2' ||
      params.vehicleType === 'EV_RODA_4';

    // Permendagri No. 6/2023 Pasal 10 ayat (1): PKB KBLBB (EV) is 0%
    if (isElectric) {
      return { rate: 0.0, isElectricExempt: true, progressiveTier: params.ownershipSequence };
    }

    if (params.isPublicTransport) {
      return { rate: 0.005, isElectricExempt: false, progressiveTier: 1 }; // 0.5% flat for public transit
    }

    const seq = Math.max(1, Math.floor(params.ownershipSequence || 1));
    // Progressive rate: 1st = 2.0%, 2nd = 2.5%, 3rd = 3.0%, 4th = 3.5%, +0.5% up to max 10.0%
    const baseRate = 0.02; // 2.0%
    const increment = (seq - 1) * 0.005; // 0.5% for each next vehicle
    const calculatedRate = Math.min(0.1, baseRate + increment);

    return {
      rate: Number(calculatedRate.toFixed(4)),
      isElectricExempt: false,
      progressiveTier: seq,
    };
  }

  /**
   * Get default road weight coefficient (Koefisien Bobot Kerusakan Jalan)
   */
  public static getDefaultWeightCoefficient(vehicleType: VehicleType): number {
    switch (vehicleType) {
      case 'RODA_2':
      case 'EV_RODA_2':
        return 1.0;
      case 'RODA_4':
      case 'EV_RODA_4':
        return 1.0;
      case 'BUS_TRUK':
        return 1.3;
      default:
        return 1.0;
    }
  }

  /**
   * Determine SWDKLLJ based on vehicle type and engine displacement
   * Law: PMK No. 16/PMK.010/2017
   */
  public static getSwdkllj(
    vehicleType: VehicleType,
    engineCc: number,
    isPublicTransport = false
  ): number {
    if (isPublicTransport) {
      return 73000; // Golongan DU (Angkutan Umum)
    }

    switch (vehicleType) {
      case 'RODA_2':
      case 'EV_RODA_2':
        // Gol C: <= 250cc is Rp 35.000; Gol C2: > 250cc is Rp 83.000
        return engineCc > 250 ? 83000 : 35000;

      case 'RODA_4':
      case 'EV_RODA_4':
        return 143000; // Golongan DP (Mobil Penumpang Pribadi)

      case 'BUS_TRUK':
        return engineCc > 5000 ? 163000 : 153000; // Golongan E

      default:
        return 143000;
    }
  }

  /**
   * Determine STNK & TNKB administration fee
   * Law: PP No. 76/2020 (PNBP)
   */
  public static getPnbpFees(
    vehicleType: VehicleType,
    isFiveYearRenewal = false
  ): { stnkAdminFee: number; tnkbFee: number } {
    if (!isFiveYearRenewal) {
      return { stnkAdminFee: 0, tnkbFee: 0 }; // Annual validation has no PNBP fee
    }

    const isTwoWheeler = vehicleType === 'RODA_2' || vehicleType === 'EV_RODA_2';
    return {
      stnkAdminFee: isTwoWheeler ? 100000 : 200000,
      tnkbFee: isTwoWheeler ? 60000 : 100000,
    };
  }

  /**
   * Calculate late penalty (Denda keterlambatan)
   */
  public static calculatePenalties(
    pkbPrincipal: number,
    swdklljPrincipal: number,
    vehicleType: VehicleType,
    lateMonths = 0
  ): { pkbPenalty: number; swdklljPenalty: number } {
    if (lateMonths <= 0) {
      return { pkbPenalty: 0, swdklljPenalty: 0 };
    }

    const cappedMonths = Math.min(24, Math.max(1, lateMonths));

    // Standard Samsat formula: (PKB * 25% * (months / 12))
    const pkbPenalty = Math.round(pkbPrincipal * 0.25 * (cappedMonths / 12));

    // Tiered SWDKLLJ penalty according to PMK 16/2017
    const isTwoWheeler = vehicleType === 'RODA_2' || vehicleType === 'EV_RODA_2';
    let swdklljPenalty = 0;

    if (isTwoWheeler) {
      if (cappedMonths <= 3) swdklljPenalty = 8000;
      else if (cappedMonths <= 6) swdklljPenalty = 16000;
      else if (cappedMonths <= 9) swdklljPenalty = 24000;
      else swdklljPenalty = 32000;
    } else {
      if (cappedMonths <= 3) swdklljPenalty = 32000;
      else if (cappedMonths <= 6) swdklljPenalty = 50000;
      else if (cappedMonths <= 9) swdklljPenalty = 75000;
      else swdklljPenalty = 100000;
    }

    return { pkbPenalty, swdklljPenalty };
  }

  /**
   * Compute full tax breakdown
   */
  public static calculate(params: TaxCalculationParams): TaxBreakdown {
    const weightCoefficient =
      params.weightCoefficient || this.getDefaultWeightCoefficient(params.vehicleType);
    const taxBase = Math.round(params.njkb * weightCoefficient);

    const { rate, isElectricExempt, progressiveTier } = this.determineTaxRate({
      ownershipSequence: params.ownershipSequence,
      isElectric: params.isElectric,
      isPublicTransport: params.isPublicTransport,
      vehicleType: params.vehicleType,
    });

    const pkbPrincipal = Math.round(taxBase * rate);
    const swdkllj = this.getSwdkllj(
      params.vehicleType,
      params.engineCapacityCc,
      params.isPublicTransport
    );
    const { stnkAdminFee, tnkbFee } = this.getPnbpFees(
      params.vehicleType,
      params.isFiveYearRenewal
    );

    const { pkbPenalty, swdklljPenalty } = this.calculatePenalties(
      pkbPrincipal,
      swdkllj,
      params.vehicleType,
      params.lateMonths || 0
    );

    const totalTax =
      pkbPrincipal + swdkllj + stnkAdminFee + tnkbFee + pkbPenalty + swdklljPenalty;

    return {
      njkb: params.njkb,
      weightCoefficient,
      taxBase,
      taxRate: rate,
      pkbPrincipal,
      swdkllj,
      stnkAdminFee,
      tnkbFee,
      lateMonths: params.lateMonths || 0,
      pkbPenalty,
      swdklljPenalty,
      totalTax,
      isElectricExempt,
      progressiveTier,
    };
  }

  /**
   * Compute months overdue from tax due date string (YYYY-MM-DD)
   */
  public static calculateMonthsOverdue(dueDateStr: string, referenceDate = new Date()): number {
    const dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) return 0;

    if (referenceDate <= dueDate) return 0;

    const yearDiff = referenceDate.getFullYear() - dueDate.getFullYear();
    const monthDiff = referenceDate.getMonth() - dueDate.getMonth();
    const dayDiff = referenceDate.getDate() - dueDate.getDate();

    let totalMonths = yearDiff * 12 + monthDiff;
    if (dayDiff > 0) {
      totalMonths += 1;
    }

    return Math.max(0, totalMonths);
  }
}
