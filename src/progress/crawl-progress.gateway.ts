import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import {
  CRAWL_PROGRESS_CHANNEL,
  CrawlProgressEvent,
} from './crawl-progress.types';

@WebSocketGateway({
  namespace: '/crawl',
  cors: {
    origin: [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:3100',
      'http://localhost:3100',
    ],
    credentials: true,
  },
})
export class CrawlProgressGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrawlProgressGateway.name);
  private subscriber: Redis | null = null;

  @WebSocketServer()
  server!: Server;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.subscriber = new Redis({
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      password: this.config.get<string>('redis.password') || undefined,
      maxRetriesPerRequest: null,
    });

    await this.subscriber.subscribe(CRAWL_PROGRESS_CHANNEL);
    this.subscriber.on('message', (channel, message) => {
      if (channel !== CRAWL_PROGRESS_CHANNEL) return;
      try {
        const event = JSON.parse(message) as CrawlProgressEvent;
        this.server
          .to(this.room(event.searchId))
          .emit('progress', event);
        this.server.emit('progress:broadcast', event);
      } catch (error) {
        this.logger.warn(
          `Invalid progress payload: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    this.logger.log(`Subscribed Redis channel ${CRAWL_PROGRESS_CHANNEL}`);
  }

  async onModuleDestroy() {
    if (!this.subscriber) return;
    try {
      await this.subscriber.unsubscribe(CRAWL_PROGRESS_CHANNEL);
      await this.subscriber.quit();
    } catch {
      this.subscriber.disconnect();
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    client: Socket,
    @MessageBody() body: { searchId?: string },
  ) {
    const searchId = body?.searchId;
    if (!searchId) return { ok: false };
    void client.join(this.room(searchId));
    return { ok: true, searchId };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    client: Socket,
    @MessageBody() body: { searchId?: string },
  ) {
    const searchId = body?.searchId;
    if (!searchId) return { ok: false };
    void client.leave(this.room(searchId));
    return { ok: true, searchId };
  }

  private room(searchId: string) {
    return `search:${searchId}`;
  }
}
