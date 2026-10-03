import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private config: ConfigService) {
    /*
     * Rozdzielenie od xdtv.fans — DWIE WARSTWY, bo jedna nie wystarcza.
     *
     * Redis stoi na tej maszynie jeden i obsługuje oba serwisy. Konfiguracja
     * przeniesiona z xdtv ustawiała wyłącznie host i port, więc undernet
     * pisałby do db0 — tej samej bazy co xdtv — i tymi samymi kluczami:
     * `posts:list:1:20:…`, `feed:v2:u5:…`. Post o identyfikatorze 5
     * w undernecie odczytywałby wtedy z cache post 5 z xdtv.
     *
     * `db` oddziela przestrzenie numerycznie, `keyPrefix` dokłada drugą
     * barierę na wypadek, gdyby ktoś kiedyś zmienił numer bazy i zapomniał
     * o prefiksie. Dwie niezależne pomyłki muszą się zejść, żeby doszło
     * do zmieszania danych.
     */
    this.client = new Redis({
      host: this.config.get('REDIS_HOST', '127.0.0.1'),
      port: this.config.get('REDIS_PORT', 6379),
      db: Number(this.config.get('REDIS_DB', 2)),
      keyPrefix: this.config.get('REDIS_PREFIX', 'undernet:'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    this.client.connect().catch((err) => {
      console.warn('[Redis] Connection failed, caching disabled:', err.message);
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (e) {
      this.logger.warn(`Redis GET failed for ${key}: ${(e as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (e) {
      this.logger.warn(`Redis SET failed for ${key}: ${(e as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (e) {
      this.logger.warn(`Redis DEL failed for ${key}: ${(e as Error).message}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor, 'MATCH', pattern, 'COUNT', 200,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (e) {
      this.logger.warn(`Redis DEL pattern failed for ${pattern}: ${(e as Error).message}`);
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => {});
  }
}
