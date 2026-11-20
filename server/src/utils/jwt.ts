import jwt, { type SignOptions } from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import { env } from '../config/env.js';
import type { AuthUserPayload } from '../types/index.js';

const JWT_COOKIE_NAME = 'auth_token';
const OAUTH_STATE_COOKIE_NAME = 'oauth_state';

/**
 * Signs an authentication JWT for the specified user payload.
 */
export const signAuthToken = (payload: AuthUserPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
};

/**
 * Verifies and decodes an authentication JWT.
 */
export const verifyAuthToken = (token: string): AuthUserPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & AuthUserPayload;
  return {
    userId: decoded.userId,
    githubId: decoded.githubId,
    username: decoded.username
  };
};

/**
 * Returns standard cookie configuration for the authentication token.
 */
export const getAuthCookieOptions = (): CookieOptions => {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  };
};

/**
 * Returns standard cookie configuration for the OAuth state CSRF token.
 */
export const getOAuthStateCookieOptions = (): CookieOptions => {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/'
  };
};

export { JWT_COOKIE_NAME, OAUTH_STATE_COOKIE_NAME };
