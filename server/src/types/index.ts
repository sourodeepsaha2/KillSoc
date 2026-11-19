export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
    details?: unknown;
  };
  timestamp: string;
}

export type Environment = 'development' | 'production' | 'test';

export interface EnvConfig {
  PORT: number;
  NODE_ENV: Environment;
  CLIENT_URL: string;
  DATABASE_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_CALLBACK_URL?: string;
  REDIS_URL?: string;
  LLM_API_KEY?: string;
}
