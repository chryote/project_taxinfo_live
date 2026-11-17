import { describe, it, expect, beforeAll } from 'vitest';
import { RabbitMqService } from '../src/services/rabbitmq.service.js';

describe('RabbitMqService - Asynchronous Event Broker Integration', () => {
  beforeAll(async () => {
    await RabbitMqService.initialize();
  });

  it('should successfully publish messages and trigger consumer subscriber', async () => {
    const received: any[] = [];
    const testQueue = 'test.tax.event';

    await RabbitMqService.subscribe(testQueue, async (data) => {
      received.push(data);
    });

    const testPayload = {
      event: 'INVOICE_GENERATED',
      amount: 500000,
      timestamp: Date.now(),
    };

    const published = await RabbitMqService.publish(testQueue, testPayload);
    expect(published).toBe(true);

    // Wait brief async tick
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(received.length).toBe(1);
    expect(received[0].event).toBe('INVOICE_GENERATED');
    expect(received[0].amount).toBe(500000);
  });
});
