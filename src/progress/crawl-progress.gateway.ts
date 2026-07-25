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
import {
  SEARCH_JOB_PROGRESS_CHANNEL,
  SearchJobProgressEvent,
} from '@/modules/search-job/search-job-progress.types';

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

    await this.subscriber.subscribe(
      CRAWL_PROGRESS_CHANNEL,
      SEARCH_JOB_PROGRESS_CHANNEL,
    );
    this.subscriber.on('message', (channel, message) => {
      try {
        if (channel === CRAWL_PROGRESS_CHANNEL) {
          const event = JSON.parse(message) as CrawlProgressEvent;
          this.server
            .to(this.searchRoom(event.searchId))
            .emit('progress', event);
          this.server.emit('progress:broadcast', event);
          return;
        }
        if (channel === SEARCH_JOB_PROGRESS_CHANNEL) {
          const event = JSON.parse(message) as SearchJobProgressEvent;
          this.server
            .to(this.jobRoom(event.jobId))
            .emit('job:progress', event);
          this.server.emit('job:progress:broadcast', event);
        }
      } catch (error) {
        this.logger.warn(
          `Invalid progress payload: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    this.logger.log(
      `Subscribed Redis channels ${CRAWL_PROGRESS_CHANNEL}, ${SEARCH_JOB_PROGRESS_CHANNEL}`,
    );
  }

  async onModuleDestroy() {
    if (!this.subscriber) return;
    try {
      await this.subscriber.unsubscribe(
        CRAWL_PROGRESS_CHANNEL,
        SEARCH_JOB_PROGRESS_CHANNEL,
      );
      await this.subscriber.quit();
    } catch {
      this.subscriber.disconnect();
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    client: Socket,
    @MessageBody() body: { searchId?: string; jobId?: string },
  ) {
    if (body?.jobId) {
      void client.join(this.jobRoom(body.jobId));
      return { ok: true, jobId: body.jobId };
    }
    const searchId = body?.searchId;
    if (!searchId) return { ok: false };
    void client.join(this.searchRoom(searchId));
    return { ok: true, searchId };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    client: Socket,
    @MessageBody() body: { searchId?: string; jobId?: string },
  ) {
    if (body?.jobId) {
      void client.leave(this.jobRoom(body.jobId));
      return { ok: true, jobId: body.jobId };
    }
    const searchId = body?.searchId;
    if (!searchId) return { ok: false };
    void client.leave(this.searchRoom(searchId));
    return { ok: true, searchId };
  }

  private searchRoom(searchId: string) {
    return `search:${searchId}`;
  }

  private jobRoom(jobId: string) {
    return `job:${jobId}`;
  }
}
