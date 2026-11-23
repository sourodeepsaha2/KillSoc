import type { Request, Response } from 'express';
import { organizationDiscoveryService } from '../services/discovery/organization-discovery.service.js';
import { organizationSyncService } from '../services/discovery/organization-sync.service.js';
import { contributionDiscoveryService } from '../services/discovery/contribution-discovery.service.js';
import { gsocIngestionService } from '../services/discovery/gsoc-ingestion.service.js';
import { ApiError } from '../utils/apiError.js';

export async function getOrganizations(req: Request, res: Response): Promise<void> {
  const search = req.query['search'] as string | undefined;
  const year = req.query['year'] ? parseInt(req.query['year'] as string, 10) : undefined;
  const technology = (req.query['technology'] || req.query['language']) as string | undefined;
  const category = req.query['category'] as string | undefined;
  const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
  const perPage = req.query['perPage'] ? parseInt(req.query['perPage'] as string, 10) : 20;
  const sort = (req.query['sort'] as string) || 'default';

  const result = await organizationDiscoveryService.getOrganizations({
    search,
    year,
    technology,
    category,
    page,
    perPage,
    sort
  });

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
}

export async function getOrganizationBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  if (!slug) {
    throw ApiError.badRequest('Organization slug is required');
  }

  const organization = await organizationDiscoveryService.getOrganizationBySlug(slug);

  res.status(200).json({
    success: true,
    data: organization
  });
}

export async function getOrganizationRepos(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  if (!slug) {
    throw ApiError.badRequest('Organization slug is required');
  }

  const userId = req.user?.userId;
  const result = await organizationDiscoveryService.getOrganizationRepositories(slug, userId);

  res.status(200).json({
    success: true,
    data: result
  });
}

export async function getIssues(req: Request, res: Response): Promise<void> {
  const organization = req.query['organization'] as string | undefined;
  const repository = req.query['repository'] as string | undefined;
  const language = req.query['language'] as string | undefined;
  const beginnerOnly =
    req.query['beginnerOnly'] === 'true' || req.query['beginnerOnly'] === '1';
  const label = req.query['label'] as string | undefined;
  const year = req.query['year'] ? parseInt(req.query['year'] as string, 10) : undefined;
  const search = req.query['search'] as string | undefined;
  const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
  const perPage = req.query['perPage'] ? parseInt(req.query['perPage'] as string, 10) : 20;

  const userId = req.user?.userId;
  const result = await contributionDiscoveryService.getIssues(
    {
      organization,
      repository,
      language,
      beginnerOnly,
      label,
      year,
      search,
      page,
      perPage
    },
    userId
  );

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
}

export async function getIssueDetail(req: Request, res: Response): Promise<void> {
  const { owner, repo, issueNumber } = req.params;

  if (!owner || !repo || !issueNumber) {
    throw ApiError.badRequest('Owner, repository, and issueNumber parameters are required');
  }

  const parsedNumber = parseInt(issueNumber, 10);
  if (isNaN(parsedNumber) || parsedNumber <= 0) {
    throw ApiError.badRequest('issueNumber must be a positive integer');
  }

  const userId = req.user?.userId;
  const issue = await contributionDiscoveryService.getIssueDetail(
    owner,
    repo,
    parsedNumber,
    userId
  );

  res.status(200).json({
    success: true,
    data: issue
  });
}

export async function importOrganizations(req: Request, res: Response): Promise<void> {
  const { url, organizations } = req.body;
  const importedBy = req.user?.userId;

  let result;
  if (url) {
    result = await gsocIngestionService.importFromRemoteUrl(url, importedBy);
  } else if (Array.isArray(organizations)) {
    result = await gsocIngestionService.ingestOrganizations(organizations, {
      importedBy
    });
  } else if (Array.isArray(req.body)) {
    result = await gsocIngestionService.ingestOrganizations(req.body, {
      importedBy
    });
  } else {
    throw ApiError.badRequest(
      'Request body must contain either an array of organizations or a remote "url"'
    );
  }

  res.status(200).json({
    success: true,
    message: 'GSoC organization data import processed',
    data: result
  });
}

export async function syncOrganization(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  if (!slug) {
    throw ApiError.badRequest('Organization slug is required');
  }

  const userId = req.user?.userId;
  const result = await organizationSyncService.syncOrganizationRepositories(slug, userId);

  res.status(200).json({
    success: true,
    message: `Synchronized repositories for organization ${slug}`,
    data: result
  });
}
