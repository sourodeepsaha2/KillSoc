import type { Request, Response } from 'express';
import { ApiError } from '../utils/apiError.js';
import { githubTokenService } from '../services/github-token.service.js';
import { githubResourceService } from '../services/github-resource.service.js';
import { githubSyncService } from '../services/github-sync.service.js';

// Parameter validation helpers
const isValidIdentifier = (value?: string): boolean => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  // Validates standard GitHub login or repository naming conventions
  return /^[a-zA-Z0-9_.-]{1,100}$/.test(trimmed);
};

const parsePaginationParams = (req: Request) => {
  const page = parseInt(req.query['page'] as string, 10);
  const perPage = parseInt(req.query['per_page'] as string, 10);

  return {
    page: isNaN(page) || page < 1 ? 1 : page,
    perPage: isNaN(perPage) || perPage < 1 ? 30 : Math.min(perPage, 100)
  };
};

export const getOrganization = async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;

  if (!isValidIdentifier(name)) {
    throw ApiError.badRequest('Invalid organization name parameter');
  }

  const token = await githubTokenService.resolveOptionalAccessToken(req.user?.userId);
  const org = await githubResourceService.getOrganization(name!, token);

  res.status(200).json({
    success: true,
    data: org
  });
};

export const getOrganizationRepos = async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;

  if (!isValidIdentifier(name)) {
    throw ApiError.badRequest('Invalid organization name parameter');
  }

  const { page, perPage } = parsePaginationParams(req);
  const sort = (req.query['sort'] as string) || 'updated';
  const direction = (req.query['direction'] as string) || 'desc';
  const language = req.query['language'] as string | undefined;

  const validSorts = ['stars', 'updated', 'created', 'full_name'];
  const validDirections = ['asc', 'desc'];

  if (!validSorts.includes(sort)) {
    throw ApiError.badRequest(`Invalid sort parameter. Allowed: ${validSorts.join(', ')}`);
  }

  if (!validDirections.includes(direction)) {
    throw ApiError.badRequest('Invalid direction parameter. Allowed: asc, desc');
  }

  const token = await githubTokenService.resolveOptionalAccessToken(req.user?.userId);
  const result = await githubResourceService.getOrganizationRepos(
    name!,
    {
      page,
      perPage,
      sort: sort as 'stars' | 'updated' | 'created' | 'full_name',
      direction: direction as 'asc' | 'desc',
      language
    },
    token
  );

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
};

export const syncOrganization = async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;

  if (!isValidIdentifier(name)) {
    throw ApiError.badRequest('Invalid organization name parameter');
  }

  if (!req.user?.userId) {
    throw ApiError.unauthorized('Authentication required to synchronize organization');
  }

  const token = await githubTokenService.getUserAccessToken(req.user.userId);
  const syncResult = await githubSyncService.syncOrganization(name!, token);

  res.status(200).json({
    success: true,
    message: 'Organization and repositories synchronized successfully',
    data: syncResult
  });
};

export const getRepository = async (req: Request, res: Response): Promise<void> => {
  const { owner, repo } = req.params;

  if (!isValidIdentifier(owner) || !isValidIdentifier(repo)) {
    throw ApiError.badRequest('Invalid owner or repository name parameter');
  }

  const token = await githubTokenService.resolveOptionalAccessToken(req.user?.userId);
  const repository = await githubResourceService.getRepository(owner!, repo!, token);

  res.status(200).json({
    success: true,
    data: repository
  });
};

export const getRepositoryContributors = async (req: Request, res: Response): Promise<void> => {
  const { owner, repo } = req.params;

  if (!isValidIdentifier(owner) || !isValidIdentifier(repo)) {
    throw ApiError.badRequest('Invalid owner or repository name parameter');
  }

  const { page, perPage } = parsePaginationParams(req);
  const token = await githubTokenService.resolveOptionalAccessToken(req.user?.userId);
  const result = await githubResourceService.getRepositoryContributors(
    owner!,
    repo!,
    page,
    perPage,
    token
  );

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
};

export const getRepositoryCommits = async (req: Request, res: Response): Promise<void> => {
  const { owner, repo } = req.params;

  if (!isValidIdentifier(owner) || !isValidIdentifier(repo)) {
    throw ApiError.badRequest('Invalid owner or repository name parameter');
  }

  const { page, perPage } = parsePaginationParams(req);
  const token = await githubTokenService.resolveOptionalAccessToken(req.user?.userId);
  const result = await githubResourceService.getRepositoryCommits(
    owner!,
    repo!,
    page,
    perPage,
    token
  );

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
};

export const syncRepository = async (req: Request, res: Response): Promise<void> => {
  const { owner, repo } = req.params;

  if (!isValidIdentifier(owner) || !isValidIdentifier(repo)) {
    throw ApiError.badRequest('Invalid owner or repository name parameter');
  }

  if (!req.user?.userId) {
    throw ApiError.unauthorized('Authentication required to synchronize repository');
  }

  const token = await githubTokenService.getUserAccessToken(req.user.userId);
  const syncedRepo = await githubSyncService.syncRepository(owner!, repo!, token);

  res.status(200).json({
    success: true,
    message: 'Repository synchronized successfully',
    data: syncedRepo
  });
};
