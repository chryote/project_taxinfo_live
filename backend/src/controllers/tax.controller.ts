import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { TaxService } from '../services/tax.service.js';

export class TaxController {
  public static async calculateByPlate(
    req: FastifyRequest<{ Params: { plate: string }; Querystring: { fiveYear?: string } }>,
    reply: FastifyReply
  ) {
    const { plate } = req.params;
    const isFiveYear = req.query.fiveYear === 'true';

    if (!plate || plate.trim().length === 0) {
      return reply.status(400).send({ error: 'Plate number is required' });
    }

    const result = await TaxService.calculateForPlate(plate, isFiveYear);
    if (!result) {
      return reply.status(404).send({ error: `Vehicle with plate ${plate} not found in database` });
    }

    return reply.status(200).send({
      success: true,
      data: result,
    });
  }

  public static async simulate(
    req: FastifyRequest<{
      Body: {
        njkb: number;
        vehicleType: 'RODA_2' | 'RODA_4' | 'BUS_TRUK' | 'EV_RODA_2' | 'EV_RODA_4';
        engineCapacityCc: number;
        ownershipSequence: number;
        weightCoefficient?: number;
        isElectric?: boolean;
        isPublicTransport?: boolean;
        lateMonths?: number;
        isFiveYearRenewal?: boolean;
      };
    }>,
    reply: FastifyReply
  ) {
    const schema = z.object({
      njkb: z.number().positive(),
      vehicleType: z.enum(['RODA_2', 'RODA_4', 'BUS_TRUK', 'EV_RODA_2', 'EV_RODA_4']),
      engineCapacityCc: z.number().nonnegative(),
      ownershipSequence: z.number().int().min(1),
      weightCoefficient: z.number().positive().optional(),
      isElectric: z.boolean().optional(),
      isPublicTransport: z.boolean().optional(),
      lateMonths: z.number().int().min(0).optional(),
      isFiveYearRenewal: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input parameters', details: parsed.error });
    }

    const breakdown = TaxService.calculateCustom(parsed.data);
    return reply.status(200).send({
      success: true,
      data: breakdown,
    });
  }

  public static async pay(
    req: FastifyRequest<{
      Body: {
        assessmentId: string;
        plateNumber: string;
        amount: number;
        paymentMethod: 'QRIS' | 'VIRTUAL_ACCOUNT' | 'TRANSFER_BANK';
      };
    }>,
    reply: FastifyReply
  ) {
    const schema = z.object({
      assessmentId: z.string().min(1),
      plateNumber: z.string().min(1),
      amount: z.number().positive(),
      paymentMethod: z.enum(['QRIS', 'VIRTUAL_ACCOUNT', 'TRANSFER_BANK']),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payment payload', details: parsed.error });
    }

    const transaction = await TaxService.initiatePayment(parsed.data);
    return reply.status(202).send({
      success: true,
      message: 'Payment job successfully queued to RabbitMQ for asynchronous settlement',
      data: transaction,
    });
  }
}
