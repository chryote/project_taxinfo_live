import amqplib from 'amqplib';
import { config } from '../config/index.js';
import { DatabaseService } from './database.service.js';

export type MessageHandler = (data: any) => Promise<void>;

export class RabbitMqService {
  private static connection: amqplib.ChannelModel | null = null;
  private static channel: amqplib.Channel | null = null;
  private static isConnected = false;
  private static inMemoryHandlers: Map<string, MessageHandler[]> = new Map();

  /**
   * Initialize RabbitMQ connection and setup queues
   */
  public static async initialize(): Promise<void> {
    const url = `amqp://${config.rabbitmq.user}:${config.rabbitmq.password}@${config.rabbitmq.host}:${config.rabbitmq.port}`;

    try {
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();

      // Assert queues
      await this.channel.assertQueue(config.rabbitmq.queues.assessment, { durable: true });
      await this.channel.assertQueue(config.rabbitmq.queues.payment, { durable: true });
      await this.channel.assertQueue(config.rabbitmq.queues.audit, { durable: true });

      this.isConnected = true;
      console.log('[INFO] Connected to RabbitMQ Message Broker');

      // Start consumer for payment processing
      await this.setupPaymentConsumer();
    } catch (err: unknown) {
      this.isConnected = false;
      console.warn(
        '[WARN] RabbitMQ not reachable, operating with resilient in-memory async message bus:',
        err instanceof Error ? err.message : String(err)
      );
      this.setupInMemoryPaymentConsumer();
    }
  }

  public static isBrokerConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Publish a message to a queue
   */
  public static async publish(queue: string, message: any): Promise<boolean> {
    const payload = Buffer.from(JSON.stringify(message));

    if (this.isConnected && this.channel) {
      try {
        return this.channel.sendToQueue(queue, payload, { persistent: true });
      } catch (err) {
        console.error(`Failed to publish message to queue ${queue}:`, err);
      }
    }

    // In-memory async dispatch (non-blocking)
    const handlers = this.inMemoryHandlers.get(queue) || [];
    setImmediate(async () => {
      for (const handler of handlers) {
        try {
          await handler(message);
        } catch (handlerErr) {
          console.error(`In-memory message handler failed for ${queue}:`, handlerErr);
        }
      }
    });

    return true;
  }

  /**
   * Register a consumer handler
   */
  public static async subscribe(queue: string, handler: MessageHandler): Promise<void> {
    if (this.isConnected && this.channel) {
      await this.channel.assertQueue(queue, { durable: true });
      await this.channel.consume(queue, async (msg) => {
        if (msg) {
          try {
            const data = JSON.parse(msg.content.toString());
            await handler(data);
            this.channel?.ack(msg);
          } catch (err) {
            console.error(`Error processing message from ${queue}:`, err);
            this.channel?.nack(msg, false, false); // Send to dead-letter or drop
          }
        }
      });
    } else {
      if (!this.inMemoryHandlers.has(queue)) {
        this.inMemoryHandlers.set(queue, []);
      }
      this.inMemoryHandlers.get(queue)!.push(handler);
    }
  }

  /**
   * Worker logic: process asynchronous tax payment
   */
  private static async processPaymentEvent(paymentData: {
    paymentId: string;
    assessmentId: string;
    plateNumber: string;
    amount: number;
    paymentMethod: string;
  }): Promise<void> {
    const timestamp = new Date().toISOString();

    // 1. Mark assessment as settled/paid
    await DatabaseService.updateAssessmentPaid(paymentData.assessmentId, timestamp);

    // 2. Mark vehicle status as LUNAS
    await DatabaseService.updateVehicleStatus(paymentData.plateNumber, 'LUNAS');

    // 3. Emit audit event
    await this.publish(config.rabbitmq.queues.audit, {
      eventType: 'TAX_PAYMENT_SETTLED',
      entityId: paymentData.paymentId,
      timestamp,
      payload: {
        assessmentId: paymentData.assessmentId,
        plateNumber: paymentData.plateNumber,
        amount: paymentData.amount,
        status: 'LUNAS',
      },
    });
  }

  private static async setupPaymentConsumer(): Promise<void> {
    await this.subscribe(config.rabbitmq.queues.payment, async (data) => {
      await this.processPaymentEvent(data);
    });
  }

  private static setupInMemoryPaymentConsumer(): void {
    if (!this.inMemoryHandlers.has(config.rabbitmq.queues.payment)) {
      this.inMemoryHandlers.set(config.rabbitmq.queues.payment, []);
    }
    this.inMemoryHandlers.get(config.rabbitmq.queues.payment)!.push(async (data) => {
      await this.processPaymentEvent(data);
    });
  }

  public static async close(): Promise<void> {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // Ignore close errors
    } finally {
      this.channel = null;
      this.connection = null;
      this.isConnected = false;
    }
  }
}
