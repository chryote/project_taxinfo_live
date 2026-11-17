import { describe, it, expect } from 'vitest';
import { EmbeddingService } from '../src/services/embedding.service.js';

describe('EmbeddingService - pgvector Vector Space Generator', () => {
  it('should generate vectors of exactly 128 dimensions', () => {
    const vec = EmbeddingService.generateVehicleEmbedding({
      vehicleType: 'RODA_4',
      fuelType: 'BENSIN',
      engineCapacityCc: 1500,
      njkb: 200000000,
      brand: 'Toyota',
      model: 'Avanza',
      manufactureYear: 2022,
    });

    expect(vec.length).toBe(128);
    expect(vec.every((v) => typeof v === 'number' && !isNaN(v))).toBe(true);
  });

  it('should produce unit-length vectors (L2 norm = 1.0)', () => {
    const vec = EmbeddingService.generateVehicleEmbedding({
      vehicleType: 'RODA_2',
      fuelType: 'BENSIN',
      engineCapacityCc: 157,
      njkb: 22000000,
      brand: 'Honda',
      model: 'Vario 160',
      manufactureYear: 2023,
    });

    const sumSq = vec.reduce((acc, val) => acc + val * val, 0);
    expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 3);
  });

  it('should compute high cosine similarity between identical vehicles', () => {
    const vecA = EmbeddingService.generateVehicleEmbedding({
      vehicleType: 'RODA_4',
      fuelType: 'BENSIN',
      engineCapacityCc: 1500,
      njkb: 200000000,
      brand: 'Toyota',
      model: 'Avanza',
      manufactureYear: 2022,
    });

    const vecB = EmbeddingService.generateVehicleEmbedding({
      vehicleType: 'RODA_4',
      fuelType: 'BENSIN',
      engineCapacityCc: 1500,
      njkb: 200000000,
      brand: 'Toyota',
      model: 'Avanza',
      manufactureYear: 2022,
    });

    const sim = EmbeddingService.cosineSimilarity(vecA, vecB);
    expect(sim).toBeCloseTo(1.0, 4);
  });

  it('should distinguish between motorcycle and heavy truck', () => {
    const bike = EmbeddingService.generateVehicleEmbedding({
      vehicleType: 'RODA_2',
      fuelType: 'BENSIN',
      engineCapacityCc: 110,
      njkb: 15000000,
      brand: 'Honda',
      model: 'Beat',
      manufactureYear: 2023,
    });

    const truck = EmbeddingService.generateVehicleEmbedding({
      vehicleType: 'BUS_TRUK',
      fuelType: 'DIESEL',
      engineCapacityCc: 7790,
      njkb: 450000000,
      brand: 'Isuzu',
      model: 'Giga',
      manufactureYear: 2021,
    });

    const sim = EmbeddingService.cosineSimilarity(bike, truck);
    expect(sim).toBeLessThan(0.45); // Highly distinct in 128-dim space
  });
});
