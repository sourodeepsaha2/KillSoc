import type { Request, Response, NextFunction } from 'express';
import { aiRecommendationService } from '../services/ai/ai-recommendation.service.js';
import { ApiError } from '../utils/apiError.js';
import type { AiGenerationOptions } from '../types/index.js';

export class AiRecommendationController {
  /**
   * POST /api/ai/recommendations/generate
   * Generates or retrieves cached AI recommendations for authenticated user.
   */
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const options: AiGenerationOptions = {
        maxRepositories: req.body?.maxRepositories ? Number(req.body.maxRepositories) : undefined,
        minScore: req.body?.minScore ? Number(req.body.minScore) : undefined,
        difficulty: req.body?.difficulty,
        includeGSoC: req.body?.includeGSoC !== undefined ? Boolean(req.body.includeGSoC) : undefined,
        type: req.body?.type,
        forceRefresh: req.body?.forceRefresh ? Boolean(req.body.forceRefresh) : false
      };

      const recommendations = await aiRecommendationService.generateRecommendations(
        req.user.userId,
        options
      );

      res.status(200).json({
        success: true,
        count: recommendations.length,
        data: recommendations
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/ai/recommendations
   * Retrieves paginated list of AI recommendations for authenticated user.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const perPage = req.query['perPage'] ? parseInt(req.query['perPage'] as string, 10) : 20;
      const type = req.query['type'] as 'REPOSITORY' | 'CONTRIBUTION' | undefined;
      const repositoryId = req.query['repositoryId'] as string | undefined;

      const result = await aiRecommendationService.getUserRecommendations(
        req.user.userId,
        {
          page,
          perPage,
          type,
          repositoryId
        }
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/ai/recommendations/:id
   * Retrieves recommendation details for authenticated user.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { id } = req.params;
      if (!id) {
        throw ApiError.badRequest('Recommendation ID is required');
      }

      const recommendation = await aiRecommendationService.getRecommendationById(
        req.user.userId,
        id
      );

      res.status(200).json({
        success: true,
        data: recommendation
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/ai/recommendations/:id/refresh
   * Forces regeneration of a specific recommendation.
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { id } = req.params;
      if (!id) {
        throw ApiError.badRequest('Recommendation ID is required');
      }

      const updated = await aiRecommendationService.refreshRecommendation(
        req.user.userId,
        id
      );

      res.status(200).json({
        success: true,
        message: 'Recommendation refreshed successfully',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/ai/status
   * Returns AI provider health, active model, and configuration (no secrets).
   */
  async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = aiRecommendationService.getProviderStatus();
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (err) {
      next(err);
    }
  }
}

export const aiRecommendationController = new AiRecommendationController();
