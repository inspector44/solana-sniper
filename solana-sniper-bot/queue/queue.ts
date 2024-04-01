import * as amqp from 'amqplib';
import { TradeEvent } from '../types';

export class RabbitMQService {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  private readonly username: string = 'username';
  private readonly password: string = 'password';
  private readonly host: string = 'rabbitmq';

  private static instance: RabbitMQService;

  public static getInstance(): RabbitMQService {
    if (!RabbitMQService.instance) {
      RabbitMQService.instance = new RabbitMQService();
    }
    return RabbitMQService.instance;
  }

  public async connect(): Promise<void> {
    const connectionString = `amqp://${this.username}:${this.password}@${this.host}:5672`;
    try {
      this.connection = await amqp.connect(connectionString);
      this.channel = await this.connection.createChannel();
      console.log('Connected to RabbitMQ');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
    }
  }

  public async createQueue(queue: string, options: amqp.Options.AssertQueue = { durable: true }): Promise<amqp.Replies.AssertQueue> {
    if (!this.channel) {
      throw new Error('Queue creation failed. Channel not initialized.');
    }
    return await this.channel.assertQueue(queue, options);
  }

  public async sendQueueMessage(queue: string, message: TradeEvent): Promise<boolean> {
    if (!this.channel) {
      console.error('Message publishing failed. Channel not initialized.');
      return false;
    }
    await this.channel.assertQueue(queue, { durable: true });
    return this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
  }

  public async consumeQueueMessages(queue: string, onMessage: (msg: amqp.ConsumeMessage | null) => void): Promise<void> {
    if (!this.channel) {
      console.error('Message consumption failed. Channel not initialized.');
      return;
    }
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.consume(queue, (msg) => {
      onMessage(msg);
      if (msg) this.channel?.ack(msg);
    });
  }
}
