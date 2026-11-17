import { FastifyRequest, FastifyReply } from 'fastify';
import { VehicleService } from '../services/vehicle.service.js';
import { VehicleType, FuelType } from '../domain/types.js';

export class VehicleController {
  public static async getByPlate(
    req: FastifyRequest<{ Params: { plate: string } }>,
    reply: FastifyReply
  ) {
    const { plate } = req.params;
    const vehicle = await VehicleService.findByPlate(plate);
    if (!vehicle) {
      return reply.status(404).send({ error: `Vehicle ${plate} not found` });
    }
    return reply.status(200).send({
      success: true,
      data: vehicle,
    });
  }

  public static async searchSimilarity(
    req: FastifyRequest<{
      Body: {
        queryText?: string;
        vehicleType?: VehicleType;
        fuelType?: FuelType;
        engineCapacityCc?: number;
        njkb?: number;
        brand?: string;
        model?: string;
        limit?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    const results = await VehicleService.searchSimilarVehicles(req.body || {});
    return reply.status(200).send({
      success: true,
      count: results.length,
      data: results,
    });
  }
}
