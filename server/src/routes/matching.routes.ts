import { Router } from 'express';
import {
  generateRecommendations,
  getRecommendations,
  getRecommendationById
} from '../controllers/matching.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router: Router = Router();

// Matching & Recommendations Routes
router.post('/generate', requireAuth, asyncHandler(generateRecommendations));
router.get('/recommendations', requireAuth, asyncHandler(getRecommendations));
router.get('/recommendations/:id', requireAuth, asyncHandler(getRecommendationById));

export default router;
