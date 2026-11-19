import type { Request, Response } from 'express';
import type { HealthResponse } from '../types/index.js';

export const getHealth = (_req: Request, res: Response<HealthResponse>): void => {
  res.status(200).json({
    success: true,
    message: 'KillSoc API is running',
    timestamp: new Date().toISOString()
  });
};
