import { DatabaseService } from './database.service.js';
import { EmbeddingService } from './embedding.service.js';
import { Vehicle, VectorSearchResult, VehicleType, FuelType } from '../domain/types.js';

export class VehicleService {
  /**
   * Find vehicle by plate number
   */
  public static async findByPlate(plate: string): Promise<Vehicle | null> {
    return DatabaseService.getVehicleByPlate(plate);
  }

  /**
   * Vector similarity search using pgvector
   */
  public static async searchSimilarVehicles(params: {
    vehicleType?: VehicleType;
    fuelType?: FuelType;
    engineCapacityCc?: number;
    njkb?: number;
    brand?: string;
    model?: string;
    queryText?: string;
    limit?: number;
  }): Promise<VectorSearchResult[]> {
    const limit = params.limit || 5;

    // Generate query embedding
    let queryVector: number[];

    if (params.queryText) {
      // Heuristic parsing for text-based semantic search
      const q = params.queryText.toLowerCase();
      let vType: VehicleType = 'RODA_4';
      if (q.includes('motor') || q.includes('vario') || q.includes('nmax') || q.includes('beat')) {
        vType = q.includes('listrik') || q.includes('ev') ? 'EV_RODA_2' : 'RODA_2';
      } else if (q.includes('listrik') || q.includes('ev') || q.includes('ioniq') || q.includes('wuling')) {
        vType = 'EV_RODA_4';
      } else if (q.includes('truk') || q.includes('bus') || q.includes('isuzu') || q.includes('giga')) {
        vType = 'BUS_TRUK';
      }

      let fuel: FuelType = 'BENSIN';
      if (vType === 'EV_RODA_2' || vType === 'EV_RODA_4') fuel = 'ELECTRIC';
      else if (q.includes('diesel') || q.includes('truk')) fuel = 'DIESEL';
      else if (q.includes('hybrid')) fuel = 'HYBRID';

      queryVector = EmbeddingService.generateVehicleEmbedding({
        vehicleType: vType,
        fuelType: fuel,
        engineCapacityCc: vType === 'RODA_2' ? 150 : 1500,
        njkb: vType === 'RODA_2' ? 25000000 : 250000000,
        brand: params.brand || (q.includes('honda') ? 'Honda' : q.includes('toyota') ? 'Toyota' : 'General'),
        model: params.queryText,
        manufactureYear: 2023,
      });
    } else {
      queryVector = EmbeddingService.generateVehicleEmbedding({
        vehicleType: params.vehicleType || 'RODA_4',
        fuelType: params.fuelType || 'BENSIN',
        engineCapacityCc: params.engineCapacityCc || 1500,
        njkb: params.njkb || 200000000,
        brand: params.brand || 'Toyota',
        model: params.model || 'Avanza',
        manufactureYear: 2023,
      });
    }

    return DatabaseService.searchSimilarVehicles(queryVector, limit);
  }
}
