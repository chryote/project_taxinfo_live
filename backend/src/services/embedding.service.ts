import { VehicleType, FuelType } from '../domain/types.js';

export class EmbeddingService {
  public static readonly VECTOR_DIM = 128;

  /**
   * Deterministically generate a normalized 128-dimensional feature vector
   * for a vehicle based on its technical specifications.
   */
  public static generateVehicleEmbedding(params: {
    vehicleType: VehicleType;
    fuelType: FuelType;
    engineCapacityCc: number;
    njkb: number;
    brand: string;
    model: string;
    manufactureYear: number;
  }): number[] {
    const vector = new Array<number>(this.VECTOR_DIM).fill(0);

    // Feature group 1: Vehicle Type one-hot & family weight (Dimensions 0-5)
    switch (params.vehicleType) {
      case 'RODA_2':
        vector[0] = 1.0;
        break;
      case 'RODA_4':
        vector[1] = 1.0;
        break;
      case 'BUS_TRUK':
        vector[2] = 1.0;
        break;
      case 'EV_RODA_2':
        vector[0] = 0.8;
        vector[3] = 1.0;
        break;
      case 'EV_RODA_4':
        vector[1] = 0.8;
        vector[4] = 1.0;
        break;
    }

    // Feature group 2: Fuel Type (Dimensions 6-9)
    switch (params.fuelType) {
      case 'BENSIN':
        vector[6] = 1.0;
        break;
      case 'DIESEL':
        vector[7] = 1.0;
        break;
      case 'ELECTRIC':
        vector[8] = 1.0;
        break;
      case 'HYBRID':
        vector[9] = 1.0;
        break;
    }

    // Feature group 3: Engine Displacement (Normalized Logarithmic, Dimension 10)
    // Range 0cc to 10000cc -> log scale
    const cc = Math.max(0, params.engineCapacityCc);
    vector[10] = cc > 0 ? Math.min(1.0, Math.log10(cc + 1) / 4.0) : 0;

    // Feature group 4: NJKB Price Bracket (Normalized Logarithmic, Dimension 11)
    // 10M to 2B -> log scale
    const price = Math.max(1, params.njkb);
    vector[11] = Math.min(1.0, Math.log10(price) / 9.5);

    // Feature group 5: Age / Model Year (Dimension 12)
    const currentYear = new Date().getFullYear();
    const age = Math.max(0, currentYear - params.manufactureYear);
    vector[12] = Math.max(0, 1.0 - age * 0.05);

    // Feature group 6: Text Hash / N-gram embeddings for Brand and Model (Dimensions 13-127)
    const text = `${params.brand.toLowerCase()} ${params.model.toLowerCase()}`;
    for (let i = 0; i < text.length - 1; i++) {
      const charCode1 = text.charCodeAt(i);
      const charCode2 = text.charCodeAt(i + 1);
      // Hash bigram to dimension index 13..127
      const dimIndex = 13 + ((charCode1 * 31 + charCode2) % (this.VECTOR_DIM - 13));
      vector[dimIndex] += 0.3;
    }

    // L2 Normalization: ensures cosine distance in pgvector (<=>) is fast & exact
    return this.l2Normalize(vector);
  }

  /**
   * Normalize vector to unit length
   */
  public static l2Normalize(vec: number[]): number[] {
    let sumSq = 0;
    for (let i = 0; i < vec.length; i++) {
      sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm === 0) return vec;
    return vec.map((v) => Number((v / norm).toFixed(6)));
  }

  /**
   * Compute cosine similarity between two vectors (returns 0.0 to 1.0)
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return Math.max(0, Math.min(1, dot / denom));
  }
}
