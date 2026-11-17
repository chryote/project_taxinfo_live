import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseService } from '../src/services/database.service.js';
import { VehicleService } from '../src/services/vehicle.service.js';

describe('VehicleService - Plate Lookup and pgvector Similarity Search', () => {
  beforeAll(async () => {
    await DatabaseService.initialize();
  });

  it('should find vehicle by exact plate number', async () => {
    const v = await VehicleService.findByPlate('B 1234 ABC');
    expect(v).not.toBeNull();
    expect(v?.brand).toBe('Honda');
    expect(v?.model).toContain('Vario');
  });

  it('should find vehicle ignoring case and whitespace differences', async () => {
    const v = await VehicleService.findByPlate('b1234abc');
    expect(v).not.toBeNull();
    expect(v?.plateNumber).toBe('B 1234 ABC');
  });

  it('should return null for non-existent plate', async () => {
    const v = await VehicleService.findByPlate('Z 9999 NONEXISTENT');
    expect(v).toBeNull();
  });

  it('should perform semantic similarity search matching electric vehicles', async () => {
    const results = await VehicleService.searchSimilarVehicles({
      queryText: 'mobil listrik keluarga',
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    // Should match Ioniq 5 or Wuling Air EV with high similarity
    const evFound = results.some(
      (r) => r.model.includes('Ioniq') || r.model.includes('Air EV')
    );
    expect(evFound).toBe(true);
    expect(results[0].similarity).toBeGreaterThan(0.5);
  });

  it('should perform similarity search for motorcycle queries', async () => {
    const results = await VehicleService.searchSimilarVehicles({
      queryText: 'motor matic vario nmax',
      limit: 2,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].vehicleType).toBe('RODA_2');
  });
});
