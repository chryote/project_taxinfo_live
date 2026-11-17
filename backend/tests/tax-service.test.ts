import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseService } from '../src/services/database.service.js';
import { RabbitMqService } from '../src/services/rabbitmq.service.js';
import { ElasticsearchService } from '../src/services/elasticsearch.service.js';
import { TaxService } from '../src/services/tax.service.js';

describe('TaxService - Assessment & Async Payment Flow', () => {
  beforeAll(async () => {
    await DatabaseService.initialize();
    await RabbitMqService.initialize();
    await ElasticsearchService.initialize();
  });

  it('should assess tax for registered plate and persist assessment', async () => {
    const res = await TaxService.calculateForPlate('B 1234 ABC');
    expect(res).not.toBeNull();
    expect(res?.assessment.id).toBeDefined();
    expect(res?.assessment.plateNumber).toBe('B 1234 ABC');
    expect(res?.assessment.breakdown.totalTax).toBeGreaterThan(0);
    expect(res?.assessment.status).toBe('TERBIT');
  });

  it('should return null when assessing tax for invalid plate', async () => {
    const res = await TaxService.calculateForPlate('NON_EXISTENT_999');
    expect(res).toBeNull();
  });

  it('should calculate custom simulation without side-effects', () => {
    const custom = TaxService.calculateCustom({
      njkb: 100000000,
      vehicleType: 'RODA_4',
      engineCapacityCc: 1200,
      ownershipSequence: 1,
    });

    expect(custom.totalTax).toBe(2000000 + 143000);
  });

  it('should initiate payment transaction and publish to RabbitMQ', async () => {
    const assessment = await TaxService.calculateForPlate('B 1234 ABC');
    expect(assessment).not.toBeNull();

    const paymentTx = await TaxService.initiatePayment({
      assessmentId: assessment!.assessment.id,
      plateNumber: 'B 1234 ABC',
      amount: assessment!.assessment.breakdown.totalTax,
      paymentMethod: 'QRIS',
    });

    expect(paymentTx.id).toBeDefined();
    expect(paymentTx.paymentReference).toContain('PAY-PKB-');
    expect(paymentTx.eStnkQrToken).toBeDefined();
    expect(paymentTx.status).toBe('PROCESSING');

    // Wait a brief tick for async RabbitMQ consumer settlement
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Vehicle status should be updated to LUNAS by RabbitMQ worker
    const v = await DatabaseService.getVehicleByPlate('B 1234 ABC');
    expect(v?.status).toBe('LUNAS');
  });
});
