import { randomUUID } from 'crypto';
import { PkbCalculator } from '../domain/pkb-calculator.js';
import { DatabaseService } from './database.service.js';
import { RabbitMqService } from './rabbitmq.service.js';
import { ElasticsearchService } from './elasticsearch.service.js';
import { config } from '../config/index.js';
import {
  TaxCalculationParams,
  TaxAssessment,
  PaymentRequest,
  PaymentTransaction,
} from '../domain/types.js';

export class TaxService {
  /**
   * Calculate tax assessment for a registered vehicle by plate number
   */
  public static async calculateForPlate(
    plate: string,
    isFiveYearRenewal = false
  ): Promise<{ vehicle: any; assessment: TaxAssessment } | null> {
    const vehicle = await DatabaseService.getVehicleByPlate(plate);
    if (!vehicle) return null;

    const lateMonths = PkbCalculator.calculateMonthsOverdue(vehicle.taxDueDate);
    const isElectric =
      vehicle.vehicleType === 'EV_RODA_2' || vehicle.vehicleType === 'EV_RODA_4' || vehicle.fuelType === 'ELECTRIC';

    const breakdown = PkbCalculator.calculate({
      njkb: vehicle.njkb,
      vehicleType: vehicle.vehicleType,
      engineCapacityCc: vehicle.engineCapacityCc,
      ownershipSequence: vehicle.ownershipSequence,
      weightCoefficient: vehicle.weightCoefficient,
      isElectric,
      lateMonths,
      isFiveYearRenewal,
    });

    const assessment: TaxAssessment = {
      id: randomUUID(),
      plateNumber: vehicle.plateNumber,
      assessmentYear: new Date().getFullYear(),
      breakdown,
      status: 'TERBIT',
      createdAt: new Date().toISOString(),
    };

    // Save assessment to Database
    await DatabaseService.saveAssessment(assessment);

    // Asynchronously publish event to RabbitMQ
    await RabbitMqService.publish(config.rabbitmq.queues.assessment, {
      eventType: 'TAX_ASSESSMENT_CREATED',
      assessmentId: assessment.id,
      plateNumber: vehicle.plateNumber,
      totalTax: breakdown.totalTax,
      timestamp: assessment.createdAt,
    });

    // Telemetry log to Elasticsearch
    await ElasticsearchService.indexAuditLog({
      eventType: 'TAX_ASSESSMENT_CREATED',
      entityId: assessment.id,
      payload: {
        plateNumber: vehicle.plateNumber,
        totalTax: breakdown.totalTax,
        lateMonths,
        isElectric,
      },
      timestamp: assessment.createdAt,
    });

    return { vehicle, assessment };
  }

  /**
   * Calculate custom simulation tax without saving to database
   */
  public static calculateCustom(params: TaxCalculationParams) {
    return PkbCalculator.calculate(params);
  }

  /**
   * Initiate asynchronous tax payment via RabbitMQ
   */
  public static async initiatePayment(request: PaymentRequest): Promise<PaymentTransaction> {
    const paymentId = randomUUID();
    const paymentReference = `PAY-PKB-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;
    const transactionTime = new Date().toISOString();

    const transaction: PaymentTransaction = {
      id: paymentId,
      assessmentId: request.assessmentId,
      plateNumber: request.plateNumber,
      paymentReference,
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      status: 'PROCESSING',
      transactionTime,
      eStnkQrToken: `ESTNK-${request.plateNumber.replace(/\s+/g, '')}-${paymentReference}`,
    };

    // Publish payment job to RabbitMQ queue for asynchronous settlement
    await RabbitMqService.publish(config.rabbitmq.queues.payment, {
      paymentId,
      assessmentId: request.assessmentId,
      plateNumber: request.plateNumber,
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      paymentReference,
      timestamp: transactionTime,
    });

    // Audit log
    await ElasticsearchService.indexAuditLog({
      eventType: 'TAX_PAYMENT_INITIATED',
      entityId: paymentId,
      payload: {
        paymentReference,
        plateNumber: request.plateNumber,
        amount: request.amount,
        paymentMethod: request.paymentMethod,
      },
      timestamp: transactionTime,
    });

    return transaction;
  }
}
