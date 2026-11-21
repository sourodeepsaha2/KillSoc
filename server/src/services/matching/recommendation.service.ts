import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { developerSkillService, DeveloperSkillService } from './developer-skill.service.js';
import { repositorySkillExtractor, RepositorySkillExtractor } from './repository-skill-extractor.service.js';
import { matchingEngineService, MatchingEngineService } from './matching-engine.service.js';
import type {
  RecommendationDTO,
  RecommendationDetailDTO,
  PaginatedResult,
  PaginationMeta,
  RepositoryAnalysisDTO,
  IntelligenceScores
} from '../../types/index.js';

export class RecommendationService {
  constructor(
    private readonly skillService: DeveloperSkillService = developerSkillService,
    private readonly extractor: RepositorySkillExtractor = repositorySkillExtractor,
    private readonly matcher: MatchingEngineService = matchingEngineService
  ) {}

  /**
   * Generates or refreshes recommendations for the authenticated developer
   * across candidate repositories in PostgreSQL.
   */
  async generateRecommendations(userId: string): Promise<RecommendationDTO[]> {
    const developerSkills = await this.skillService.getUserSkills(userId);

    // If developer has no skills registered, return early
    if (developerSkills.length === 0) {
      return [];
    }

    // Retrieve candidate repositories with their analyses
    const repositories = await prisma.repository.findMany({
      include: {
        analysis: true
      }
    });

    if (repositories.length === 0) {
      return [];
    }

    for (const repo of repositories) {
      let extractedSkills = repo.extractedSkills;

      // Extract and cache repository skills if not already populated
      if (!extractedSkills || extractedSkills.length === 0) {
        const extracted = this.extractor.extractRepositorySkills(
          {
            language: repo.language,
            description: repo.description,
            topics: repo.topics
          },
          null,
          []
        );
        extractedSkills = extracted.allSkills;

        // Persist extracted skills to repository record
        await prisma.repository.update({
          where: { id: repo.id },
          data: { extractedSkills }
        });
      }

      // Format analysis if present
      let analysisDTO: RepositoryAnalysisDTO | null = null;
      if (repo.analysis) {
        analysisDTO = {
          id: repo.analysis.id,
          repositoryId: repo.analysis.repositoryId,
          fullName: repo.fullName,
          scores: {
            overall: repo.analysis.overallScore,
            activity: repo.analysis.activityScore,
            community: repo.analysis.communityScore,
            documentation: repo.analysis.documentationScore,
            beginner: repo.analysis.beginnerScore,
            maintenance: repo.analysis.maintenanceScore
          },
          explanations: repo.analysis.explanations as any,
          metricsSummary: repo.analysis.metricsSummary as any,
          isComplete: repo.analysis.isComplete,
          lastAnalyzedAt: repo.analysis.lastAnalyzedAt.toISOString()
        };
      }

      const matchResult = this.matcher.calculateMatch(developerSkills, {
        id: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        extractedSkills: {
          primarySkills: extractedSkills.filter(s =>
            repo.language?.toLowerCase() === s.toLowerCase()
          ),
          secondarySkills: extractedSkills.filter(
            s => repo.language?.toLowerCase() !== s.toLowerCase()
          ),
          allSkills: extractedSkills
        },
        analysis: analysisDTO
      });

      // Upsert recommendation record to prevent duplicates
      await prisma.recommendation.upsert({
        where: {
          userId_repositoryId: {
            userId,
            repositoryId: repo.id
          }
        },
        update: {
          matchScore: matchResult.matchScore,
          skillCoverage: matchResult.breakdown.skillCoverage,
          proficiencyFit: matchResult.breakdown.proficiencyFit,
          repoQualityScore: matchResult.breakdown.repoQualityScore,
          matchedSkills: matchResult.breakdown.matchedSkills,
          missingSkills: matchResult.breakdown.missingSkills,
          explanation: matchResult.breakdown.explanations[0] || null,
          details: matchResult.breakdown.explanations as any,
          isComplete: matchResult.isComplete,
          organizationId: repo.organizationId,
          updatedAt: new Date()
        },
        create: {
          userId,
          repositoryId: repo.id,
          organizationId: repo.organizationId,
          matchScore: matchResult.matchScore,
          skillCoverage: matchResult.breakdown.skillCoverage,
          proficiencyFit: matchResult.breakdown.proficiencyFit,
          repoQualityScore: matchResult.breakdown.repoQualityScore,
          matchedSkills: matchResult.breakdown.matchedSkills,
          missingSkills: matchResult.breakdown.missingSkills,
          explanation: matchResult.breakdown.explanations[0] || null,
          details: matchResult.breakdown.explanations as any,
          isComplete: matchResult.isComplete
        }
      });
    }

    const result = await this.getUserRecommendations(userId, { perPage: 100 });
    return result.data;
  }

  /**
   * Retrieves paginated recommendations for an authenticated developer ordered by match score.
   */
  async getUserRecommendations(
    userId: string,
    options: { page?: number; perPage?: number; minScore?: number } = {}
  ): Promise<PaginatedResult<RecommendationDTO>> {
    const { page = 1, perPage = 20, minScore = 0 } = options;
    const safePage = Math.max(1, page);
    const safePerPage = Math.min(Math.max(1, perPage), 100);

    const where = {
      userId,
      ...(minScore > 0 ? { matchScore: { gte: minScore } } : {})
    };

    const [total, recommendations] = await Promise.all([
      prisma.recommendation.count({ where }),
      prisma.recommendation.findMany({
        where,
        orderBy: [{ matchScore: 'desc' }, { createdAt: 'desc' }],
        skip: (safePage - 1) * safePerPage,
        take: safePerPage,
        include: {
          repository: {
            select: {
              name: true,
              fullName: true
            }
          }
        }
      })
    ]);

    const data: RecommendationDTO[] = recommendations.map(r => ({
      id: r.id,
      userId: r.userId,
      repositoryId: r.repositoryId,
      repositoryName: r.repository.name,
      repositoryFullName: r.repository.fullName,
      matchScore: r.matchScore,
      skillCoverage: r.skillCoverage,
      proficiencyFit: r.proficiencyFit,
      repoQualityScore: r.repoQualityScore,
      matchedSkills: r.matchedSkills,
      missingSkills: r.missingSkills,
      explanation: r.explanation,
      details: r.details,
      isComplete: r.isComplete,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
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
   * Retrieves single recommendation detail with repository and intelligence metadata,
   * enforcing strict user data isolation.
   */
  async getRecommendationById(
    userId: string,
    recommendationId: string
  ): Promise<RecommendationDetailDTO> {
    const rec = await prisma.recommendation.findFirst({
      where: {
        id: recommendationId,
        userId
      },
      include: {
        repository: {
          include: {
            analysis: true
          }
        }
      }
    });

    if (!rec) {
      throw ApiError.notFound('Recommendation not found');
    }

    let intelligence: IntelligenceScores | undefined = undefined;
    if (rec.repository.analysis) {
      intelligence = {
        overall: rec.repository.analysis.overallScore,
        activity: rec.repository.analysis.activityScore,
        community: rec.repository.analysis.communityScore,
        documentation: rec.repository.analysis.documentationScore,
        beginner: rec.repository.analysis.beginnerScore,
        maintenance: rec.repository.analysis.maintenanceScore
      };
    }

    return {
      id: rec.id,
      userId: rec.userId,
      repositoryId: rec.repositoryId,
      repositoryName: rec.repository.name,
      repositoryFullName: rec.repository.fullName,
      matchScore: rec.matchScore,
      skillCoverage: rec.skillCoverage,
      proficiencyFit: rec.proficiencyFit,
      repoQualityScore: rec.repoQualityScore,
      matchedSkills: rec.matchedSkills,
      missingSkills: rec.missingSkills,
      explanation: rec.explanation,
      details: rec.details,
      isComplete: rec.isComplete,
      createdAt: rec.createdAt.toISOString(),
      updatedAt: rec.updatedAt.toISOString(),
      repository: {
        id: rec.repository.id,
        name: rec.repository.name,
        fullName: rec.repository.fullName,
        description: rec.repository.description,
        htmlUrl: `https://github.com/${rec.repository.fullName}`,
        language: rec.repository.language,
        stars: rec.repository.stars,
        forks: rec.repository.forks,
        openIssues: rec.repository.openIssues,
        topics: rec.repository.topics,
        extractedSkills: rec.repository.extractedSkills,
        intelligence
      }
    };
  }
}

export const recommendationService = new RecommendationService();
