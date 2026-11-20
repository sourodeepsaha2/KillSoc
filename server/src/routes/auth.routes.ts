import { Router } from 'express';
import {
  initiateGitHubAuth,
  handleGitHubCallback,
  getCurrentUser,
  logout
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

router.get('/github', initiateGitHubAuth);
router.get('/github/callback', asyncHandler(handleGitHubCallback));
router.get('/me', requireAuth, asyncHandler(getCurrentUser));
router.post('/logout', logout);

export default router;
