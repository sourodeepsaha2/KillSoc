import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import type { ApiErrorResponse } from '../types/index.js';

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`);
  next(error);
};

export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response<ApiErrorResponse>,
  _next: NextFunction
): void => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const isProduction = env.NODE_ENV === 'production';

  const message =
    isProduction && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  const errorPayload: ApiErrorResponse['error'] = {
    message,
    statusCode,
    ...(!isProduction && { stack: err.stack }),
    ...(err instanceof ApiError && err.details !== undefined ? { details: err.details } : {})
  };

  res.status(statusCode).json({
    success: false,
    error: errorPayload,
    timestamp: new Date().toISOString()
  });
};
