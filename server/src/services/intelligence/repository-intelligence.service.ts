import { prisma } from '../../config/prisma.js';
import { githubResourceService, GitHubResourceService } from '../github-resource.service.js';
import { githubTokenService, GitHubTokenService } from '../github-token.service.js';
import { githubSyncService, GitHubSyncService } from '../github-sync.service.js';
import { intelligenceCalculationService, IntelligenceCalculationService } from './intelligence.service.js';
import { SCORING_CONFIG } from './scoring.config.js';
import type {
  RepositoryAnalysisDTO,
  GitHubIssueDTO,
  GitHubRepoDTO,
  GitHubCommitDTO,
  GitHubContributorDTO,
  CommunityProfileDTO,
  IntelligenceExplanations,
  MetricsSummary
} from '../../types/index.js';

export class RepositoryIntelligenceService {
  constructor(
    private readonly resources: GitHubResourceService = githubResourceService,
    private readonly tokenService: GitHubTokenService = githubTokenService,
    private readonly syncService: GitHubSyncService = githubSyncService,
    private readonly calculator: IntelligenceCalculationService = intelligenceCalculationService
  ) {}

  /**
   * Retrieves an existing cached analysis from PostgreSQL if fresh,
   * or triggers on-demand data collection, score calculation, and persistence.
   */
  async getOrCalculateAnalysis(
    owner: string,
    repo: string,
    options: { force?: boolean; userId?: string } = {}
  ): Promise<RepositoryAnalysisDTO> {
    const { force = false, userId } = options;
    const fullName = `${owner}/${repo}`.toLowerCase();

    // 1. Check if cached analysis exists in PostgreSQL
    if (!force) {
      const existingRepo = await prisma.repository.findFirst({
        where: {
          fullName: {
            equals: fullName,
            mode: 'insensitive'
          }
        },
        include: {
          analysis: true
        }
      });

      if (existingRepo?.analysis) {
        const analysis = existingRepo.analysis;
        const cacheAgeMs = Date.now() - new Date(analysis.lastAnalyzedAt).getTime();
        const maxCacheAgeMs = SCORING_CONFIG.cacheTtlHours * 60 * 60 * 1000;

        if (cacheAgeMs < maxCacheAgeMs) {
          return {
            id: analysis.id,
            repositoryId: analysis.repositoryId,
            fullName: existingRepo.fullName,
            scores: {
              overall: analysis.overallScore,
              activity: analysis.activityScore,
              community: analysis.communityScore,
              documentation: analysis.documentationScore,
              beginner: analysis.beginnerScore,
              maintenance: analysis.maintenanceScore
            },
            explanations: analysis.explanations as unknown as IntelligenceExplanations,
            metricsSummary: analysis.metricsSummary as unknown as MetricsSummary,
            isComplete: analysis.isComplete,
            lastAnalyzedAt: analysis.lastAnalyzedAt.toISOString()
          };
        }
      }
    }

    // 2. Fresh analysis required
    return await this.analyzeAndPersist(owner, repo, userId);
  }

  /**
   * Performs fresh data collection from GitHub, calculates scores, and persists to PostgreSQL.
   */
  async analyzeAndPersist(
    owner: string,
    repo: string,
    userId?: string
  ): Promise<RepositoryAnalysisDTO> {
    const token = await this.tokenService.resolveOptionalAccessToken(userId);

    // 1. Fetch Repository metadata
    const repoData: GitHubRepoDTO = await this.resources.getRepository(owner, repo, token);

    // 2. Collect supporting intelligence signals in parallel with error isolation
    let isDataComplete = true;

    const [commitsRes, contributorsRes, openIssuesRes, closedIssuesRes, communityRes] =
      await Promise.allSettled([
        this.resources.getRepositoryCommits(owner, repo, 1, 50, token),
        this.resources.getRepositoryContributors(owner, repo, 1, 50, token),
        this.resources.getRepositoryIssues(owner, repo, { state: 'open', perPage: 50 }, token),
        this.resources.getRepositoryIssues(owner, repo, { state: 'closed', perPage: 50 }, token),
        this.resources.getRepositoryCommunityProfile(owner, repo, token)
      ]);

    const commits: GitHubCommitDTO[] =
      commitsRes.status === 'fulfilled' ? commitsRes.value.data : [];
    if (commitsRes.status === 'rejected') isDataComplete = false;

    const contributors: GitHubContributorDTO[] =
      contributorsRes.status === 'fulfilled' ? contributorsRes.value.data : [];
    if (contributorsRes.status === 'rejected') isDataComplete = false;

    const openIssues: GitHubIssueDTO[] =
      openIssuesRes.status === 'fulfilled' ? openIssuesRes.value.data : [];
    if (openIssuesRes.status === 'rejected') isDataComplete = false;

    const closedIssues: GitHubIssueDTO[] =
      closedIssuesRes.status === 'fulfilled' ? closedIssuesRes.value.data : [];
    if (closedIssuesRes.status === 'rejected') isDataComplete = false;

    const community: CommunityProfileDTO =
      communityRes.status === 'fulfilled'
        ? communityRes.value
        : {
            healthPercentage: 0,
            hasReadme: false,
            hasContributing: false,
            hasLicense: false,
            hasCodeOfConduct: false,
            hasIssueTemplates: false,
            hasPullRequestTemplates: false
          };
    if (communityRes.status === 'rejected') isDataComplete = false;

    // 3. Compute Intelligence scores and factors
    const calculated = this.calculator.calculateReport({
      repo: repoData,
      commits,
      contributors,
      openIssues,
      closedIssues,
      community,
      isDataComplete
    });

    // 4. Ensure Repository record exists in PostgreSQL
    const dbRepo = await this.syncService.syncRepository(owner, repo, token);

    // 5. Upsert analysis in PostgreSQL
    const saved = await prisma.repositoryAnalysis.upsert({
      where: { repositoryId: dbRepo.id },
      update: {
        overallScore: calculated.scores.overall,
        activityScore: calculated.scores.activity,
        communityScore: calculated.scores.community,
        documentationScore: calculated.scores.documentation,
        beginnerScore: calculated.scores.beginner,
        maintenanceScore: calculated.scores.maintenance,
        explanations: calculated.explanations as any,
        metricsSummary: calculated.metricsSummary as any,
        isComplete: calculated.isComplete,
        lastAnalyzedAt: new Date()
      },
      create: {
        repositoryId: dbRepo.id,
        overallScore: calculated.scores.overall,
        activityScore: calculated.scores.activity,
        communityScore: calculated.scores.community,
        documentationScore: calculated.scores.documentation,
        beginnerScore: calculated.scores.beginner,
        maintenanceScore: calculated.scores.maintenance,
        explanations: calculated.explanations as any,
        metricsSummary: calculated.metricsSummary as any,
        isComplete: calculated.isComplete,
        lastAnalyzedAt: new Date()
      }
    });

    return {
      id: saved.id,
      repositoryId: saved.repositoryId,
      fullName: dbRepo.fullName,
      scores: calculated.scores,
      explanations: calculated.explanations,
      metricsSummary: calculated.metricsSummary,
      isComplete: calculated.isComplete,
      lastAnalyzedAt: saved.lastAnalyzedAt.toISOString()
    };
  }

  /**
   * Retrieves repository issues and separates beginner-friendly opportunities.
   */
  async getBeginnerIssues(
    owner: string,
    repo: string,
    userId?: string
  ): Promise<{
    repository: string;
    totalSampledIssues: number;
    beginnerFriendlyCount: number;
    beginnerIssues: GitHubIssueDTO[];
    otherOpenIssues: GitHubIssueDTO[];
  }> {
    const token = await this.tokenService.resolveOptionalAccessToken(userId);
    const issuesResult = await this.resources.getRepositoryIssues(
      owner,
      repo,
      { state: 'open', perPage: 50 },
      token
    );

    const beginnerIssues = issuesResult.data.filter(i => i.isBeginnerFriendly);
    const otherOpenIssues = issuesResult.data.filter(i => !i.isBeginnerFriendly);

    return {
      repository: `${owner}/${repo}`,
      totalSampledIssues: issuesResult.data.length,
      beginnerFriendlyCount: beginnerIssues.length,
      beginnerIssues,
      otherOpenIssues
    };
  }
}

export const repositoryIntelligenceService = new RepositoryIntelligenceService();
