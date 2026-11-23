import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { githubResourceService } from '../github-resource.service.js';
import { githubTokenService } from '../github-token.service.js';
import { repositorySkillExtractor } from '../matching/repository-skill-extractor.service.js';
import { repositoryIntelligenceService } from '../intelligence/repository-intelligence.service.js';
import { gsocIngestionService } from './gsoc-ingestion.service.js';

export class OrganizationSyncService {
  /**
   * Synchronizes an organization's public GitHub repositories into PostgreSQL,
   * extracts skills, and triggers/caches intelligence analysis.
   */
  async syncOrganizationRepositories(
    slug: string,
    userId?: string
  ): Promise<{
    organization: string;
    slug: string;
    syncedRepositories: number;
    analyzedRepositories: number;
  }> {
    const cleanSlug = slug.toLowerCase().trim();
    const org = await prisma.organization.findUnique({
      where: { slug: cleanSlug }
    });

    if (!org) {
      throw ApiError.notFound(`Organization with slug "${slug}" not found in database`);
    }

    // Determine the GitHub organization login
    const githubLogin =
      gsocIngestionService.extractGitHubLogin(org.githubUrl) || org.slug;

    const token = await githubTokenService.resolveOptionalAccessToken(userId);

    // Fetch organization repositories from GitHub
    let reposResult;
    try {
      reposResult = await githubResourceService.getOrganizationRepos(
        githubLogin,
        { perPage: 100 },
        token
      );
    } catch (err: any) {
      if (err.statusCode === 404) {
        throw ApiError.notFound(
          `GitHub organization "${githubLogin}" was not found on GitHub REST API`
        );
      }
      throw err;
    }

    let syncedRepositories = 0;
    let analyzedRepositories = 0;

    for (const repoData of reposResult.data) {
      // Extract skills deterministically
      const extracted = repositorySkillExtractor.extractRepositorySkills(
        {
          language: repoData.language,
          description: repoData.description,
          topics: []
        },
        null,
        []
      );

      // Upsert repository linked to organization
      const repository = await prisma.repository.upsert({
        where: { githubRepoId: repoData.githubRepoId },
        update: {
          name: repoData.name,
          fullName: repoData.fullName,
          description: repoData.description,
          language: repoData.language,
          stars: repoData.stars,
          forks: repoData.forks,
          openIssues: repoData.openIssues,
          lastUpdatedAt: repoData.lastUpdatedAt ? new Date(repoData.lastUpdatedAt) : null,
          extractedSkills: extracted.allSkills,
          organizationId: org.id
        },
        create: {
          githubRepoId: repoData.githubRepoId,
          name: repoData.name,
          fullName: repoData.fullName,
          description: repoData.description,
          language: repoData.language,
          stars: repoData.stars,
          forks: repoData.forks,
          openIssues: repoData.openIssues,
          lastUpdatedAt: repoData.lastUpdatedAt ? new Date(repoData.lastUpdatedAt) : null,
          extractedSkills: extracted.allSkills,
          organizationId: org.id
        }
      });
      syncedRepositories++;

      // Check if analysis exists; run or refresh if missing or stale
      try {
        await repositoryIntelligenceService.getOrCalculateAnalysis(
          githubLogin,
          repository.name,
          { force: false, userId }
        );
        analyzedRepositories++;
      } catch {
        // Continue syncing other repositories if individual repository analysis fails or rate limits
      }
    }

    return {
      organization: org.name,
      slug: org.slug,
      syncedRepositories,
      analyzedRepositories
    };
  }
}

export const organizationSyncService = new OrganizationSyncService();
