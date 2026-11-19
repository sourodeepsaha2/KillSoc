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

export const env: EnvConfig = {
  PORT: getPort(),
  NODE_ENV: getEnvironment(),
  CLIENT_URL: process.env['CLIENT_URL'] || 'http://localhost:3000',
  DATABASE_URL: process.env['DATABASE_URL'],
  GITHUB_CLIENT_ID: process.env['GITHUB_CLIENT_ID'],
  GITHUB_CLIENT_SECRET: process.env['GITHUB_CLIENT_SECRET'],
  GITHUB_CALLBACK_URL: process.env['GITHUB_CALLBACK_URL'],
  REDIS_URL: process.env['REDIS_URL'],
  LLM_API_KEY: process.env['LLM_API_KEY']
};
