import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { authService } from '../services/auth.service.js';
import { ApiError } from '../utils/apiError.js';
import {
  generateOAuthState,
  validateOAuthState
} from '../utils/crypto.js';
import {
  getAuthCookieOptions,
  getOAuthStateCookieOptions,
  JWT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME
} from '../utils/jwt.js';

export const initiateGitHubAuth = (_req: Request, res: Response): void => {
  const state = generateOAuthState();

  // Store state in an HttpOnly cookie for CSRF validation during callback
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, getOAuthStateCookieOptions());

  const authUrl = authService.getAuthorizationUrl(state);
  res.redirect(authUrl);
};

export const handleGitHubCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { code, state } = req.query;
  const storedState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];

  // Clean up state cookie regardless of outcome
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/' });

  // 1. Validate state parameter (timing-safe check against CSRF)
  if (!state || typeof state !== 'string' || !validateOAuthState(storedState, state)) {
    throw ApiError.badRequest('Invalid OAuth state parameter. Request rejected for security.');
  }

  // 2. Validate authorization code
  if (!code || typeof code !== 'string') {
    throw ApiError.badRequest('Authorization code is required');
  }

  // 3. Complete authentication flow
  const { jwtToken } = await authService.handleOAuthCallback(code);

  // 4. Attach session token in HttpOnly cookie
  res.cookie(JWT_COOKIE_NAME, jwtToken, getAuthCookieOptions());

  // 5. Redirect user to the frontend application
  res.redirect(env.CLIENT_URL);
};

export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!req.user?.userId) {
    throw ApiError.unauthorized('Authentication required');
  }

  const profile = await authService.getUserProfile(req.user.userId);

  res.status(200).json({
    success: true,
    data: profile
  });
};

export const logout = (_req: Request, res: Response): void => {
  // Clear the authentication cookie
  res.clearCookie(JWT_COOKIE_NAME, {
    ...getAuthCookieOptions(),
    maxAge: 0
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};
