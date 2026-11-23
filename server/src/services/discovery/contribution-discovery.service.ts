import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { githubResourceService } from '../github-resource.service.js';
import { githubTokenService } from '../github-token.service.js';
import { githubApiClient } from '../github-api.client.js';
import { isBeginnerLabel } from '../intelligence/scoring.config.js';
import type {
  DiscoveredIssueDTO,
  PaginatedResult,
  PaginationMeta
} from '../../types/index.js';

export const GSOC_SUITABILITY_DISCLAIMER =
  'This issue has been identified as an open-source contribution opportunity. GSoC suitability depends on official project mentors, program guidelines, and project scope.';

export class ContributionDiscoveryService {
  /**
   * Discovers and retrieves contribution opportunities across GSoC organizations
   * with multi-factor filtering, strictly excluding pull requests.
   */
  async getIssues(
    params: {
      organization?: string;
      repository?: string;
      language?: string;
      beginnerOnly?: boolean;
      label?: string;
      year?: number;
      search?: string;
      page?: number;
      perPage?: number;
    },
    userId?: string
  ): Promise<PaginatedResult<DiscoveredIssueDTO>> {
    const {
      organization,
      repository,
      language,
      beginnerOnly,
      label,
      year,
      search,
      page = 1,
      perPage = 20
    } = params;

    const safePage = Math.max(1, page);
    const safePerPage = Math.min(Math.max(1, perPage), 100);

    // Build Prisma query filters
    const where: any = {
      state: 'open'
    };

    if (beginnerOnly) {
      where.isBeginnerFriendly = true;
    }

    if (label && label.trim()) {
      where.labels = {
        has: label.trim()
      };
    }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const repoWhere: any = {};

    if (repository && repository.trim()) {
      const repoClean = repository.trim();
      repoWhere.OR = [
        { name: { equals: repoClean, mode: 'insensitive' } },
        { fullName: { contains: repoClean, mode: 'insensitive' } }
      ];
    }

    if (language && language.trim()) {
      repoWhere.language = { equals: language.trim(), mode: 'insensitive' };
    }

    if (organization && organization.trim()) {
      const orgClean = organization.trim();
      repoWhere.organization = {
        OR: [
          { slug: { equals: orgClean.toLowerCase() } },
          { name: { contains: orgClean, mode: 'insensitive' } }
        ]
      };
    }

    if (year && Number.isInteger(year)) {
      repoWhere.organization = {
        ...(repoWhere.organization || {}),
        years: {
          some: { year }
        }
      };
    }

    if (Object.keys(repoWhere).length > 0) {
      where.repository = repoWhere;
    }

    // Check count in database
    let total = await prisma.issue.count({ where });

    // Fallback: If querying a specific organization or repository that has 0 cached issues,
    // fetch live issues from GitHub and populate DB cache
    if (total === 0 && (repository || organization)) {
      try {
        await this.syncIssuesForFilter({ organization, repository }, userId);
        total = await prisma.issue.count({ where });
      } catch {
        // Continue gracefully if live fetch fails or rate limits
      }
    }

    const issues = await prisma.issue.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            fullName: true,
            language: true,
            stars: true,
            organization: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    const data: DiscoveredIssueDTO[] = issues.map(i => ({
      id: i.id,
      githubIssueId: i.githubIssueId,
      number: i.number ?? 0,
      title: i.title,
      description: i.description,
      url: i.url,
      state: i.state,
      labels: i.labels,
      isBeginnerFriendly: i.isBeginnerFriendly,
      matchingLabels: i.matchingLabels,
      assignee: i.assignee,
      commentsCount: i.commentsCount,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      repository: {
        id: i.repository.id,
        name: i.repository.name,
        fullName: i.repository.fullName,
        language: i.repository.language,
        stars: i.repository.stars,
        organizationName: i.repository.organization?.name,
        organizationSlug: i.repository.organization?.slug
      },
      gsocSuitabilityDisclaimer: GSOC_SUITABILITY_DISCLAIMER
    }));

    const hasNextPage = safePage * safePerPage < total;
    const hasPrevPage = safePage > 1;

    const pagination: PaginationMeta = {
      page: safePage,
      perPage: safePerPage,
      hasNextPage,
      hasPrevPage,
      ...(hasNextPage ? { nextPage: safePage + 1 } : {}),
      ...(hasPrevPage ? { prevPage: safePage - 1 } : {})
    };

    return { data, pagination };
  }

  /**
   * Helper to sync issues live from GitHub for a target repository or organization.
   */
  private async syncIssuesForFilter(
    filter: { organization?: string; repository?: string },
    userId?: string
  ): Promise<void> {
    const token = await githubTokenService.resolveOptionalAccessToken(userId);

    let targetRepos: Array<{ id: string; fullName: string; name: string }> = [];

    if (filter.repository) {
      targetRepos = await prisma.repository.findMany({
        where: {
          OR: [
            { fullName: { contains: filter.repository, mode: 'insensitive' } },
            { name: { equals: filter.repository, mode: 'insensitive' } }
          ]
        },
        select: { id: true, fullName: true, name: true },
        take: 3
      });
    } else if (filter.organization) {
      targetRepos = await prisma.repository.findMany({
        where: {
          organization: {
            OR: [
              { slug: filter.organization.toLowerCase() },
              { name: { contains: filter.organization, mode: 'insensitive' } }
            ]
          }
        },
        select: { id: true, fullName: true, name: true },
        take: 3
      });
    }

    for (const repo of targetRepos) {
      const parts = repo.fullName.split('/');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const owner = parts[0];
        const repoName = parts[1];
        const issuesRes = await githubResourceService.getRepositoryIssues(
          owner,
          repoName,
          { state: 'open', perPage: 30 },
          token
        );

        for (const issue of issuesRes.data) {
          await prisma.issue.upsert({
            where: { githubIssueId: issue.githubIssueId },
            update: {
              number: issue.number,
              title: issue.title,
              description: issue.body,
              url: issue.url,
              state: issue.state,
              labels: issue.labels,
              isBeginnerFriendly: issue.isBeginnerFriendly,
              matchingLabels: issue.matchingLabels,
              updatedAt: new Date(issue.updatedAt)
            },
            create: {
              repositoryId: repo.id,
              githubIssueId: issue.githubIssueId,
              number: issue.number,
              title: issue.title,
              description: issue.body,
              url: issue.url,
              state: issue.state,
              labels: issue.labels,
              isBeginnerFriendly: issue.isBeginnerFriendly,
              matchingLabels: issue.matchingLabels
            }
          });
        }
      }
    }
  }

  /**
   * Retrieves single issue details with beginner tagging, repository metadata,
   * and GSoC suitability disclaimer.
   */
  async getIssueDetail(
    owner: string,
    repo: string,
    issueNumber: number,
    userId?: string
  ): Promise<DiscoveredIssueDTO> {
    if (!owner || !repo || !issueNumber) {
      throw ApiError.badRequest('Owner, repository, and issueNumber are required');
    }

    const fullName = `${owner}/${repo}`.toLowerCase();

    // 1. Check local PostgreSQL database
    const localIssue = await prisma.issue.findFirst({
      where: {
        number: issueNumber,
        repository: {
          fullName: { equals: fullName, mode: 'insensitive' }
        }
      },
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            fullName: true,
            language: true,
            stars: true,
            organization: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        }
      }
    });

    if (localIssue) {
      return {
        id: localIssue.id,
        githubIssueId: localIssue.githubIssueId,
        number: localIssue.number ?? issueNumber,
        title: localIssue.title,
        description: localIssue.description,
        url: localIssue.url,
        state: localIssue.state,
        labels: localIssue.labels,
        isBeginnerFriendly: localIssue.isBeginnerFriendly,
        matchingLabels: localIssue.matchingLabels,
        assignee: localIssue.assignee,
        commentsCount: localIssue.commentsCount,
        createdAt: localIssue.createdAt.toISOString(),
        updatedAt: localIssue.updatedAt.toISOString(),
        repository: {
          id: localIssue.repository.id,
          name: localIssue.repository.name,
          fullName: localIssue.repository.fullName,
          language: localIssue.repository.language,
          stars: localIssue.repository.stars,
          organizationName: localIssue.repository.organization?.name,
          organizationSlug: localIssue.repository.organization?.slug
        },
        gsocSuitabilityDisclaimer: GSOC_SUITABILITY_DISCLAIMER
      };
    }

    // 2. Fetch live from GitHub API if not found in DB
    const token = await githubTokenService.resolveOptionalAccessToken(userId);
    let githubIssue: any;

    try {
      const response = await githubApiClient.get<any>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
        { accessToken: token }
      );
      githubIssue = response.data;
    } catch (err: any) {
      if (err.statusCode === 404) {
        throw ApiError.notFound(
          `Issue #${issueNumber} not found in repository ${owner}/${repo}`
        );
      }
      throw err;
    }

    // Exclude pull requests
    if (githubIssue.pull_request) {
      throw ApiError.badRequest(`Issue #${issueNumber} is a pull request, not an issue`);
    }

    const labels = (githubIssue.labels || []).map((l: any) =>
      typeof l === 'string' ? l : l.name
    );
    const matchingLabels = labels.filter(isBeginnerLabel);
    const isBeginnerFriendly = matchingLabels.length > 0;

    // Check if repository exists in DB
    const dbRepo = await prisma.repository.findFirst({
      where: { fullName: { equals: fullName, mode: 'insensitive' } },
      include: { organization: true }
    });

    return {
      id: String(githubIssue.id),
      githubIssueId: String(githubIssue.id),
      number: githubIssue.number,
      title: githubIssue.title,
      description: githubIssue.body,
      url: githubIssue.html_url,
      state: githubIssue.state,
      labels,
      isBeginnerFriendly,
      matchingLabels,
      assignee: githubIssue.assignee?.login || null,
      commentsCount: githubIssue.comments || 0,
      createdAt: githubIssue.created_at,
      updatedAt: githubIssue.updated_at,
      repository: {
        id: dbRepo?.id || '',
        name: repo,
        fullName: `${owner}/${repo}`,
        language: dbRepo?.language || null,
        stars: dbRepo?.stars || 0,
        organizationName: dbRepo?.organization?.name,
        organizationSlug: dbRepo?.organization?.slug
      },
      gsocSuitabilityDisclaimer: GSOC_SUITABILITY_DISCLAIMER
    };
  }
}

export const contributionDiscoveryService = new ContributionDiscoveryService();
