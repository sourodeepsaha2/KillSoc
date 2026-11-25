import type { Request, Response } from 'express';
import type { HealthResponse } from '../types/index.js';
import { prisma } from '../config/prisma.js';

export const getHealth = (_req: Request, res: Response<HealthResponse>): void => {
  res.status(200).json({
    success: true,
    message: 'AceSoc API is running',
    timestamp: new Date().toISOString()
  });
};

export const getDbHealth = async (_req: Request, res: Response<HealthResponse>): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: 'Database is healthy and reachable',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log error internally without exposing credentials or internal database details to client
    console.error(
      '[Health Check] Database connectivity check failed:',
      error instanceof Error ? error.message : error
    );

    res.status(503).json({
      success: false,
      message: 'Database is unavailable',
      timestamp: new Date().toISOString()
    });
  }
};
