import type { Request, Response, NextFunction } from 'express';
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
