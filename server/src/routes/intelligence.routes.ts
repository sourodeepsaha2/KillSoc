import { Router } from 'express';
import {
  getRepositoryAnalysis,
  triggerRepositoryAnalysis,
  getRepositoryIssues
} from '../controllers/intelligence.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

// Intelligence Analysis Routes
router.get('/repos/:owner/:repo', optionalAuth, asyncHandler(getRepositoryAnalysis));
router.post('/repos/:owner/:repo/analyze', optionalAuth, asyncHandler(triggerRepositoryAnalysis));
router.post('/repos/:owner/:repo/refresh', optionalAuth, asyncHandler(triggerRepositoryAnalysis));
router.get('/repos/:owner/:repo/issues', optionalAuth, asyncHandler(getRepositoryIssues));

export default router;
