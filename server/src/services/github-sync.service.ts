import { prisma } from '../config/prisma.js';
import { githubResourceService, GitHubResourceService } from './github-resource.service.js';
import type { GitHubOrgDTO, GitHubRepoDTO } from '../types/index.js';

export interface SyncOrgResult {
  organization: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    website: string | null;
    githubUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  syncedRepositories: number;
}

export class GitHubSyncService {
  constructor(private readonly resources: GitHubResourceService = githubResourceService) {}

  /**
   * Synchronizes an organization and its public repositories from GitHub into PostgreSQL.
   */
  async syncOrganization(name: string, accessToken?: string): Promise<SyncOrgResult> {
    // 1. Fetch organization details and repositories from GitHub
    const orgData: GitHubOrgDTO = await this.resources.getOrganization(name, accessToken);
    const reposResult = await this.resources.getOrganizationRepos(name, { perPage: 100 }, accessToken);

    // 2. Execute atomic database synchronization inside a Prisma transaction
    return await prisma.$transaction(async tx => {
      // Upsert organization record
      const org = await tx.organization.upsert({
        where: { slug: orgData.login.toLowerCase() },
        update: {
          name: orgData.name,
          description: orgData.description,
          website: orgData.website,
          githubUrl: orgData.githubUrl
        },
        create: {
          slug: orgData.login.toLowerCase(),
          name: orgData.name,
          description: orgData.description,
          website: orgData.website,
          githubUrl: orgData.githubUrl
        }
      });

      // Upsert all fetched repositories connected to this organization
      for (const repo of reposResult.data) {
        await tx.repository.upsert({
          where: { githubRepoId: repo.githubRepoId },
          update: {
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description,
            language: repo.language,
            stars: repo.stars,
            forks: repo.forks,
            openIssues: repo.openIssues,
            lastUpdatedAt: repo.lastUpdatedAt ? new Date(repo.lastUpdatedAt) : null,
            organizationId: org.id
          },
          create: {
            githubRepoId: repo.githubRepoId,
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description,
            language: repo.language,
            stars: repo.stars,
            forks: repo.forks,
            openIssues: repo.openIssues,
            lastUpdatedAt: repo.lastUpdatedAt ? new Date(repo.lastUpdatedAt) : null,
            organizationId: org.id
          }
        });
      }

      return {
        organization: org,
        syncedRepositories: reposResult.data.length
      };
    });
  }

  /**
   * Synchronizes a single repository from GitHub into PostgreSQL.
   */
  async syncRepository(owner: string, repoName: string, accessToken?: string) {
    const repoData: GitHubRepoDTO = await this.resources.getRepository(owner, repoName, accessToken);

    // Check if the owner organization exists in our database
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: owner.toLowerCase() }
    });

    let organizationId: string | undefined = existingOrg?.id;

    // If org does not exist in DB, attempt to fetch and create it if owner is an organization
    if (!organizationId) {
      try {
        const orgInfo = await this.resources.getOrganization(owner, accessToken);
        const newOrg = await prisma.organization.upsert({
          where: { slug: orgInfo.login.toLowerCase() },
          update: {
            name: orgInfo.name,
            description: orgInfo.description,
            website: orgInfo.website,
            githubUrl: orgInfo.githubUrl
          },
          create: {
            slug: orgInfo.login.toLowerCase(),
            name: orgInfo.name,
            description: orgInfo.description,
            website: orgInfo.website,
            githubUrl: orgInfo.githubUrl
          }
        });
        organizationId = newOrg.id;
      } catch {
        // Owner might be an individual user rather than an organization, proceed without organizationId
      }
    }

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
        ...(organizationId ? { organizationId } : {})
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
        ...(organizationId ? { organizationId } : {})
      }
    });

    return repository;
  }
}

export const githubSyncService = new GitHubSyncService();
