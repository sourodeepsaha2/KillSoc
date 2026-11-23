import { Redis, RedisOptions } from 'ioredis';
import { env } from '../config/env.js';

let redisInstance: Redis | null = null;

export const calculateBackoffDelay = (times: number): number => {
  return Math.min(times * 200, 2000);
};

export const getRedisOptions = (): RedisOptions => {
  if (env.REDIS_URL && env.REDIS_URL.trim()) {
    return {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        // In test mode, don't loop retrying offline Redis
        if (process.env['NODE_ENV'] === 'test' || env.NODE_ENV === 'test') {
          return null;
        }
        return calculateBackoffDelay(times);
      }
    };
  }

  const options: RedisOptions = {
    host: env.REDIS_HOST || '127.0.0.1',
    port: env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times: number) => {
      if (process.env['NODE_ENV'] === 'test' || env.NODE_ENV === 'test') {
        return null;
      }
      return calculateBackoffDelay(times);
    }
  };

  if (env.REDIS_PASSWORD && env.REDIS_PASSWORD.trim()) {
    options.password = env.REDIS_PASSWORD;
  }

  if (env.REDIS_TLS) {
    options.tls = {};
  }

  return options;
};

export const getRedisConnection = (): Redis => {
  if (redisInstance) {
    return redisInstance;
  }

  const options = getRedisOptions();

  if (env.REDIS_URL && env.REDIS_URL.trim()) {
    redisInstance = new Redis(env.REDIS_URL, options);
  } else {
    redisInstance = new Redis(options);
  }

  redisInstance.on('error', (err: any) => {
    // Log as warning to prevent unhandled rejection / crashes when Redis is offline
    if (process.env['NODE_ENV'] !== 'test' && env.NODE_ENV !== 'test') {
      console.warn(`[Redis Connection Warning]: ${err.message || err}`);
    }
  });

  return redisInstance;
};

export const isRedisHealthy = async (client?: Redis): Promise<boolean> => {
  const redis = client || getRedisConnection();
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting' && redis.status !== 'connect') {
      await redis.connect().catch(() => {});
    }
    const pong = await Promise.race([
      redis.ping(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timed out')), 2000)
      )
    ]);
    return pong === 'PONG';
  } catch {
    return false;
  }
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redisInstance) {
    try {
      redisInstance.disconnect(false);
    } catch {
      // ignore
    } finally {
      redisInstance = null;
    }
  }
};
