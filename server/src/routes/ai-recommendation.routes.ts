import { Router } from 'express';
import { aiRecommendationController } from '../controllers/ai-recommendation.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

// AI Provider Status (No secrets exposed)
router.get('/status', asyncHandler(aiRecommendationController.getStatus.bind(aiRecommendationController)));

// AI Recommendation Generation & Listing (Protected)
router.post(
  '/recommendations/generate',
  requireAuth,
  asyncHandler(aiRecommendationController.generate.bind(aiRecommendationController))
);

router.get(
  '/recommendations',
  requireAuth,
  asyncHandler(aiRecommendationController.list.bind(aiRecommendationController))
);

router.get(
  '/recommendations/:id',
  requireAuth,
  asyncHandler(aiRecommendationController.getById.bind(aiRecommendationController))
);

router.post(
  '/recommendations/:id/refresh',
  requireAuth,
  asyncHandler(aiRecommendationController.refresh.bind(aiRecommendationController))
);

export default router;
