import { Router } from 'express';
import { jobController } from '../controllers/job.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

// All background job endpoints require authenticated sessions
router.post(
  '/organizations/:slug/sync',
  requireAuth,
  asyncHandler(jobController.syncOrganization.bind(jobController))
);

router.post(
  '/repos/:owner/:repo/analyze',
  requireAuth,
  asyncHandler(jobController.analyzeRepository.bind(jobController))
);

router.post(
  '/recommendations/generate',
  requireAuth,
  asyncHandler(jobController.generateRecommendations.bind(jobController))
);

router.get(
  '/:jobId',
  requireAuth,
  asyncHandler(jobController.getJobStatus.bind(jobController))
);

export default router;
