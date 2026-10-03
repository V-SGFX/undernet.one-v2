import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', '127.0.0.1'),
          port: config.get('REDIS_PORT', 6379),
          db: Number(config.get('REDIS_DB', 2)),
        },
        // BullMQ buduje nazwy kluczy sam, więc `keyPrefix` z ioredis ich
        // NIE obejmuje. Bez własnego prefiksu zadania obu serwisów
        // wylądowałyby w jednej kolejce `bull:mail`.
        prefix: `${config.get('REDIS_PREFIX', 'undernet:')}bull`,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 3600 * 24, // 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 3600 * 24 * 7, // 7 days
          },
        },
      }),
    }),
  ],
  providers: [],
  exports: [BullModule, ],
})
export class QueueModule {}
