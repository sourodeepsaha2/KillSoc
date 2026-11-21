import type { Request, Response } from 'express';
import { recommendationService } from '../services/matching/recommendation.service.js';
import { ApiError } from '../utils/apiError.js';

export async function generateRecommendations(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const recommendations = await recommendationService.generateRecommendations(userId);

  res.status(200).json({
    success: true,
    message: 'Recommendations generated successfully',
    data: recommendations
  });
}

export async function getRecommendations(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
  const perPage = req.query['perPage'] ? parseInt(req.query['perPage'] as string, 10) : 20;
  const minScore = req.query['minScore'] ? parseFloat(req.query['minScore'] as string) : 0;

  const result = await recommendationService.getUserRecommendations(userId, {
    page,
    perPage,
    minScore
  });

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
}

export async function getRecommendationById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params;

  if (!id) {
    throw ApiError.badRequest('Recommendation id parameter is required');
  }

  const recommendation = await recommendationService.getRecommendationById(userId, id);

  res.status(200).json({
    success: true,
    data: recommendation
  });
}
