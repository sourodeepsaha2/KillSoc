import dotenv from 'dotenv';
import path from 'node:path';
import type { EnvConfig, Environment } from '../types/index.js';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const getEnvironment = (): Environment => {
  const env = process.env['NODE_ENV'];
  if (env === 'production' || env === 'test') {
    return env;
  }
  return 'development';
};

const getPort = (): number => {
  const portStr = process.env['PORT'];
  if (portStr) {
    const parsed = parseInt(portStr, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
      return parsed;
    }
  }
  return 5000;
};

const nodeEnv = getEnvironment();

const getRequiredEnv = (key: string, defaultValue: string): string => {
  const value = process.env[key];
  if (!value) {
    if (nodeEnv === 'production') {
      throw new Error(`CRITICAL: Environment variable ${key} is required in production mode`);
    }
    return defaultValue;
  }
  return value;
};

export const env: EnvConfig = {
  PORT: getPort(),
  NODE_ENV: nodeEnv,
  CLIENT_URL: process.env['CLIENT_URL'] || 'http://localhost:3000',
  DATABASE_URL: process.env['DATABASE_URL'],
  GITHUB_CLIENT_ID: process.env['GITHUB_CLIENT_ID'],
  GITHUB_CLIENT_SECRET: process.env['GITHUB_CLIENT_SECRET'],
  GITHUB_CALLBACK_URL: process.env['GITHUB_CALLBACK_URL'],
  JWT_SECRET: getRequiredEnv(
    'JWT_SECRET',
    'dev_insecure_jwt_secret_placeholder_at_least_32_characters_long'
  ),
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] || '7d',
  TOKEN_ENCRYPTION_KEY: getRequiredEnv(
    'TOKEN_ENCRYPTION_KEY',
    'dev_insecure_token_encryption_key_at_least_32_characters_long'
  ),
  REDIS_URL: process.env['REDIS_URL'],
  LLM_API_KEY: process.env['LLM_API_KEY'],
  AI_PROVIDER: process.env['AI_PROVIDER'] || 'gemini',
  AI_MODEL: process.env['AI_MODEL'] || 'gemini-1.5-flash',
  AI_API_KEY: process.env['AI_API_KEY'] || process.env['LLM_API_KEY'],
  AI_MAX_TOKENS: process.env['AI_MAX_TOKENS'] ? parseInt(process.env['AI_MAX_TOKENS'], 10) : 2048,
  AI_TIMEOUT_MS: process.env['AI_TIMEOUT_MS'] ? parseInt(process.env['AI_TIMEOUT_MS'], 10) : 15000,
  AI_CACHE_TTL_HOURS: process.env['AI_CACHE_TTL_HOURS'] ? parseInt(process.env['AI_CACHE_TTL_HOURS'], 10) : 24,
  REDIS_HOST: process.env['REDIS_HOST'] || '127.0.0.1',
  REDIS_PORT: process.env['REDIS_PORT'] ? parseInt(process.env['REDIS_PORT'], 10) : 6379,
  REDIS_PASSWORD: process.env['REDIS_PASSWORD'],
  REDIS_TLS: process.env['REDIS_TLS'] === 'true',
  BULLMQ_CONCURRENCY: process.env['BULLMQ_CONCURRENCY'] ? parseInt(process.env['BULLMQ_CONCURRENCY'], 10) : 5,
  BULLMQ_MAX_RETRIES: process.env['BULLMQ_MAX_RETRIES'] ? parseInt(process.env['BULLMQ_MAX_RETRIES'], 10) : 3,
  BULLMQ_BACKOFF_DELAY_MS: process.env['BULLMQ_BACKOFF_DELAY_MS'] ? parseInt(process.env['BULLMQ_BACKOFF_DELAY_MS'], 10) : 2000
};
