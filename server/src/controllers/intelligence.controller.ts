import type { Request, Response } from 'express';
import { repositoryIntelligenceService } from '../services/intelligence/repository-intelligence.service.js';
import { ApiError } from '../utils/apiError.js';

export async function getRepositoryAnalysis(req: Request, res: Response): Promise<void> {
  const { owner, repo } = req.params;

  if (!owner || !repo) {
    throw ApiError.badRequest('Repository owner and name are required');
  }

  const force = req.query['force'] === 'true' || req.query['force'] === '1';
  const userId = req.user?.userId;

  const analysis = await repositoryIntelligenceService.getOrCalculateAnalysis(
    owner,
    repo,
    { force, userId }
  );

  res.status(200).json({
    success: true,
    data: analysis
  });
}

export async function triggerRepositoryAnalysis(req: Request, res: Response): Promise<void> {
  const { owner, repo } = req.params;

  if (!owner || !repo) {
    throw ApiError.badRequest('Repository owner and name are required');
  }

  const userId = req.user?.userId;

  const analysis = await repositoryIntelligenceService.analyzeAndPersist(
    owner,
    repo,
    userId
  );

  res.status(200).json({
    success: true,
    message: 'Repository analysis updated successfully',
    data: analysis
  });
}

export async function getRepositoryIssues(req: Request, res: Response): Promise<void> {
  const { owner, repo } = req.params;

  if (!owner || !repo) {
    throw ApiError.badRequest('Repository owner and name are required');
  }

  const userId = req.user?.userId;

  const result = await repositoryIntelligenceService.getBeginnerIssues(
    owner,
    repo,
    userId
  );

  res.status(200).json({
    success: true,
    data: result
  });
}
