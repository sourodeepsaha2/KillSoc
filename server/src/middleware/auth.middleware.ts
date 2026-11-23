import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/apiError.js';
import { verifyAuthToken, JWT_COOKIE_NAME } from '../utils/jwt.js';

/**
 * Extracts JWT token from HttpOnly cookie or Authorization Bearer header.
 */
const extractToken = (req: Request): string | undefined => {
  let token = req.cookies?.[JWT_COOKIE_NAME];

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  return token;
};

/**
 * Middleware that strictly requires authentication.
 * Returns HTTP 401 if unauthenticated or token is invalid.
 */
export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token = extractToken(req);

  if (!token) {
    next(ApiError.unauthorized('Authentication required'));
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = payload;
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired authentication token'));
  }
};

/**
 * Middleware that optionally authenticates the user.
 * If valid token is present, sets req.user.
 * If no token or invalid token, proceeds without error.
 */
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = payload;
  } catch {
    // Gracefully ignore invalid tokens on optional routes
  }

  next();
};

/**
 * Middleware that requires administrative privileges.
 * Returns HTTP 401 if unauthenticated, or HTTP 403 if authenticated user is not an admin.
 */
export const requireAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);

  if (!token) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = payload;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true, isAdmin: true, githubUsername: true }
    });

    if (!user || (!user.isAdmin && user.role !== 'ADMIN')) {
      return next(
        ApiError.forbidden('Administrative permission required to perform this action')
      );
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    next(ApiError.unauthorized('Invalid or expired authentication token'));
  }
};
