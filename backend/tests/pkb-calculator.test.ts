import { describe, it, expect } from 'vitest';
import { PkbCalculator } from '../src/domain/pkb-calculator.js';

describe('PkbCalculator - Indonesian Motor Vehicle Tax Rules', () => {
  describe('Tax Rate Determination (UU HKPD & Permendagri 6/2023)', () => {
    it('should assign 2.0% (0.02) for first private vehicle', () => {
      const result = PkbCalculator.determineTaxRate({ ownershipSequence: 1 });
      expect(result.rate).toBe(0.02);
      expect(result.isElectricExempt).toBe(false);
      expect(result.progressiveTier).toBe(1);
    });

    it('should calculate progressive rates for subsequent vehicles (+0.5% per tier)', () => {
      expect(PkbCalculator.determineTaxRate({ ownershipSequence: 2 }).rate).toBe(0.025);
      expect(PkbCalculator.determineTaxRate({ ownershipSequence: 3 }).rate).toBe(0.03);
      expect(PkbCalculator.determineTaxRate({ ownershipSequence: 4 }).rate).toBe(0.035);
      expect(PkbCalculator.determineTaxRate({ ownershipSequence: 5 }).rate).toBe(0.04);
    });

    it('should cap progressive rate at maximum 10.0% (0.10)', () => {
      const result = PkbCalculator.determineTaxRate({ ownershipSequence: 25 });
      expect(result.rate).toBe(0.1);
    });

    it('should apply 0.5% (0.005) flat rate for public transport', () => {
      const result = PkbCalculator.determineTaxRate({
        ownershipSequence: 2,
        isPublicTransport: true,
      });
      expect(result.rate).toBe(0.005);
    });

    it('should grant 0% (0.00) PKB exemption for Electric Vehicles (BEV) under Permendagri 6/2023', () => {
      const evCar = PkbCalculator.determineTaxRate({
        ownershipSequence: 1,
        vehicleType: 'EV_RODA_4',
      });
      expect(evCar.rate).toBe(0.0);
      expect(evCar.isElectricExempt).toBe(true);

      const evBike = PkbCalculator.determineTaxRate({
        ownershipSequence: 2,
        isElectric: true,
      });
      expect(evBike.rate).toBe(0.0);
      expect(evBike.isElectricExempt).toBe(true);
    });
  });

  describe('SWDKLLJ Rates (PMK 16/2017)', () => {
    it('should charge Rp 35.000 for standard motorcycle <= 250cc (Gol C)', () => {
      expect(PkbCalculator.getSwdkllj('RODA_2', 150)).toBe(35000);
      expect(PkbCalculator.getSwdkllj('RODA_2', 250)).toBe(35000);
    });

    it('should charge Rp 83.000 for big motorcycle > 250cc (Gol C2)', () => {
      expect(PkbCalculator.getSwdkllj('RODA_2', 251)).toBe(83000);
      expect(PkbCalculator.getSwdkllj('RODA_2', 600)).toBe(83000);
    });

    it('should charge Rp 143.000 for passenger cars (Gol DP)', () => {
      expect(PkbCalculator.getSwdkllj('RODA_4', 1500)).toBe(143000);
      expect(PkbCalculator.getSwdkllj('EV_RODA_4', 0)).toBe(143000);
    });

    it('should charge appropriate rates for trucks and buses', () => {
      expect(PkbCalculator.getSwdkllj('BUS_TRUK', 4000)).toBe(153000);
      expect(PkbCalculator.getSwdkllj('BUS_TRUK', 7000)).toBe(163000);
    });

    it('should charge Rp 73.000 for public transport (Gol DU)', () => {
      expect(PkbCalculator.getSwdkllj('RODA_4', 1500, true)).toBe(73000);
    });
  });

  describe('PNBP STNK & TNKB Fees (PP 76/2020)', () => {
    it('should be 0 for standard annual validation', () => {
      const fees = PkbCalculator.getPnbpFees('RODA_4', false);
      expect(fees.stnkAdminFee).toBe(0);
      expect(fees.tnkbFee).toBe(0);
    });

    it('should charge Rp 100.000 STNK and Rp 60.000 TNKB for RODA_2 5-year renewal', () => {
      const fees = PkbCalculator.getPnbpFees('RODA_2', true);
      expect(fees.stnkAdminFee).toBe(100000);
      expect(fees.tnkbFee).toBe(60000);
    });

    it('should charge Rp 200.000 STNK and Rp 100.000 TNKB for RODA_4 5-year renewal', () => {
      const fees = PkbCalculator.getPnbpFees('RODA_4', true);
      expect(fees.stnkAdminFee).toBe(200000);
      expect(fees.tnkbFee).toBe(100000);
    });
  });

  describe('Late Penalty Calculation (Denda Keterlambatan)', () => {
    it('should return 0 penalty if not overdue', () => {
      const res = PkbCalculator.calculatePenalties(1000000, 143000, 'RODA_4', 0);
      expect(res.pkbPenalty).toBe(0);
      expect(res.swdklljPenalty).toBe(0);
    });

    it('should calculate PKB penalty according to Samsat formula (PKB * 25% * months/12)', () => {
      // 1,000,000 * 0.25 * (6 / 12) = 125,000
      const res6 = PkbCalculator.calculatePenalties(1000000, 143000, 'RODA_4', 6);
      expect(res6.pkbPenalty).toBe(125000);

      // 1,000,000 * 0.25 * (12 / 12) = 250,000
      const res12 = PkbCalculator.calculatePenalties(1000000, 143000, 'RODA_4', 12);
      expect(res12.pkbPenalty).toBe(250000);
    });

    it('should cap penalty at 24 months maximum', () => {
      const res36 = PkbCalculator.calculatePenalties(1000000, 143000, 'RODA_4', 36);
      const res24 = PkbCalculator.calculatePenalties(1000000, 143000, 'RODA_4', 24);
      expect(res36.pkbPenalty).toBe(res24.pkbPenalty);
      expect(res36.pkbPenalty).toBe(500000); // 1M * 25% * (24/12) = 500,000
    });
  });

  describe('Full Tax Assessment Calculation', () => {
    it('should calculate correct tax for Honda Vario (RODA_2, 1st ownership, NJKB 22M)', () => {
      const result = PkbCalculator.calculate({
        njkb: 22000000,
        vehicleType: 'RODA_2',
        engineCapacityCc: 157,
        ownershipSequence: 1,
      });

      expect(result.taxBase).toBe(22000000);
      expect(result.taxRate).toBe(0.02);
      expect(result.pkbPrincipal).toBe(440000); // 22,000,000 * 2%
      expect(result.swdkllj).toBe(35000);
      expect(result.stnkAdminFee).toBe(0);
      expect(result.tnkbFee).toBe(0);
      expect(result.pkbPenalty).toBe(0);
      expect(result.totalTax).toBe(440000 + 35000); // Rp 475.000
    });

    it('should calculate correct tax for Toyota Avanza 2nd progressive car (NJKB 175M)', () => {
      const result = PkbCalculator.calculate({
        njkb: 175000000,
        vehicleType: 'RODA_4',
        engineCapacityCc: 1496,
        ownershipSequence: 2, // 2nd car = 2.5%
      });

      expect(result.taxRate).toBe(0.025);
      expect(result.pkbPrincipal).toBe(4375000); // 175,000,000 * 2.5%
      expect(result.swdkllj).toBe(143000);
      expect(result.totalTax).toBe(4375000 + 143000); // Rp 4.518.000
    });

    it('should apply 0% PKB for Hyundai Ioniq 5 (EV_RODA_4, NJKB 580M)', () => {
      const result = PkbCalculator.calculate({
        njkb: 580000000,
        vehicleType: 'EV_RODA_4',
        engineCapacityCc: 0,
        ownershipSequence: 1,
        isElectric: true,
      });

      expect(result.isElectricExempt).toBe(true);
      expect(result.taxRate).toBe(0.0);
      expect(result.pkbPrincipal).toBe(0); // 0 PKB!
      expect(result.swdkllj).toBe(143000);
      expect(result.totalTax).toBe(143000); // Only SWDKLLJ payable!
    });
  });

  describe('calculateMonthsOverdue helper', () => {
    it('should return 0 for future dates', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const months = PkbCalculator.calculateMonthsOverdue(future.toISOString().split('T')[0]);
      expect(months).toBe(0);
    });

    it('should correctly compute past overdue months', () => {
      const past = new Date(2025, 0, 1);
      const ref = new Date(2025, 3, 2); // ~3 months later
      const months = PkbCalculator.calculateMonthsOverdue('2025-01-01', ref);
      expect(months).toBe(4); // Jan to Apr + day diff
    });
  });
});
