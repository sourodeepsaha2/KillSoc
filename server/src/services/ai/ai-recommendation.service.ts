import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { AI_CONFIG, GSOC_RECOMMENDATION_DISCLAIMER } from './ai.config.js';
import { AiProviderFactory } from './ai-provider.factory.js';
import { AiSafetyService } from './ai-safety.js';
import { developerSkillService } from '../matching/developer-skill.service.js';
import { repositorySkillExtractor } from '../matching/repository-skill-extractor.service.js';
import { matchingEngineService } from '../matching/matching-engine.service.js';
import type {
  AiRecommendationDTO,
  AiRecommendationDetailDTO,
  AiGenerationOptions,
  AiProviderStatusDTO,
  AiRecommendationType,
  AiRecommendationSource,
  PaginatedResult,
  PaginationMeta,
  DeveloperSkillDTO,
  RepositoryAnalysisDTO
} from '../../types/index.js';
import type {
  AiProvider,
  AiRepoRecommendationContext,
  AiIssueRecommendationContext
} from './ai-provider.interface.js';

export class AiRecommendationService {
  /**
   * Helper to compute future expiration date based on cache TTL.
   */
  private getExpirationDate(): Date {
    const hours = AI_CONFIG.cacheTtlHours;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private formatAnalysisDTO(
    analysis: any,
    fullName: string
  ): RepositoryAnalysisDTO | null {
    if (!analysis) return null;
    return {
      id: analysis.id,
      repositoryId: analysis.repositoryId,
      fullName,
      scores: {
        overall: analysis.overallScore,
        activity: analysis.activityScore,
        community: analysis.communityScore,
        documentation: analysis.documentationScore,
        beginner: analysis.beginnerScore,
        maintenance: analysis.maintenanceScore
      },
      explanations: analysis.explanations as any,
      metricsSummary: analysis.metricsSummary as any,
      isComplete: analysis.isComplete,
      lastAnalyzedAt:
        analysis.lastAnalyzedAt instanceof Date
          ? analysis.lastAnalyzedAt.toISOString()
          : String(analysis.lastAnalyzedAt)
    };
  }

  /**
   * Returns AI provider status and readiness without exposing private keys.
   */
  getProviderStatus(): AiProviderStatusDTO {
    const provider = AiProviderFactory.getProvider();
    const isConfigured = AiProviderFactory.isConfigured();

    return {
      configured: isConfigured,
      provider: provider.name,
      model: provider.model,
      healthy: true, // System is healthy either with direct LLM or deterministic fallback
      fallbackEnabled: true,
      cacheTtlHours: AI_CONFIG.cacheTtlHours
    };
  }

  /**
   * Generates personalized repository and contribution recommendations
   * for the authenticated developer.
   */
  async generateRecommendations(
    userId: string,
    options: AiGenerationOptions = {}
  ): Promise<AiRecommendationDTO[]> {
    const {
      maxRepositories = 5,
      minScore = 20,
      difficulty = 'all',
      includeGSoC = true,
      type = 'ALL',
      forceRefresh = false
    } = options;

    // 1. Check for valid cached recommendations if not forcing refresh
    if (!forceRefresh) {
      const existingCached = await prisma.aiRecommendation.findMany({
        where: {
          userId,
          expiresAt: {
            gt: new Date()
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
                select: { name: true }
              }
            }
          },
          issue: {
            select: {
              id: true,
              number: true,
              title: true,
              url: true,
              state: true,
              isBeginnerFriendly: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: maxRepositories * 2
      });

      if (existingCached.length > 0) {
        return existingCached.map((item) => this.mapToDTO(item));
      }
    }

    // 2. Fetch Developer Profile and registered technical skills
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw ApiError.unauthorized('Authenticated user not found');
    }

    const developerSkills: DeveloperSkillDTO[] = await developerSkillService.getUserSkills(userId);

    if (developerSkills.length === 0) {
      throw ApiError.badRequest(
        'No developer skills found. Please register at least one technical skill before generating recommendations.'
      );
    }

    // 3. Query candidate repositories from PostgreSQL
    const repositories = await prisma.repository.findMany({
      include: {
        analysis: true,
        organization: {
          include: {
            years: true
          }
        },
        issues: {
          where: {
            state: 'open' // NEVER recommend closed issues
          },
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (repositories.length === 0) {
      return [];
    }

    // 4. Calculate deterministic matching scores to find top candidate repositories
    const candidateMatches = [];

    for (const repo of repositories) {
      // Ensure skills are extracted
      let extractedSkills = repo.extractedSkills;
      if (!extractedSkills || extractedSkills.length === 0) {
        const extracted = repositorySkillExtractor.extractRepositorySkills(
          {
            language: repo.language,
            description: repo.description,
            topics: repo.topics
          },
          null,
          []
        );
        extractedSkills = extracted.allSkills;
        await prisma.repository.update({
          where: { id: repo.id },
          data: { extractedSkills }
        });
      }

      // Calculate deterministic match score
      const matchResult = matchingEngineService.calculateMatch(developerSkills, {
        id: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        extractedSkills: {
          primarySkills: extractedSkills.slice(0, 3),
          secondarySkills: extractedSkills.slice(3),
          allSkills: extractedSkills
        },
        analysis: this.formatAnalysisDTO(repo.analysis, repo.fullName)
      });

      // Filter by minimum score and optional GSoC requirement
      const hasGSoC = Boolean(repo.organization?.years && repo.organization.years.length > 0);
      if (includeGSoC === false && hasGSoC) {
        continue;
      }

      if (matchResult.matchScore >= minScore) {
        candidateMatches.push({
          repository: repo,
          matchResult,
          hasGSoC
        });
      }
    }

    // Sort candidates by matchScore descending and take top N
    candidateMatches.sort((a, b) => b.matchResult.matchScore - a.matchResult.matchScore);
    const topCandidates = candidateMatches.slice(0, maxRepositories);

    const provider: AiProvider = AiProviderFactory.getProvider();
    const generatedRecommendations: AiRecommendationDTO[] = [];
    const expiresAt = this.getExpirationDate();

    // 5. Generate Repository Recommendations
    if (type === 'ALL' || type === 'REPOSITORY') {
      for (const candidate of topCandidates) {
        const repo = candidate.repository;
        const match = candidate.matchResult;
        const gsocYears = repo.organization?.years?.map((y) => y.year) || [];

        const repoContext: AiRepoRecommendationContext = {
          developer: {
            username: user.githubUsername,
            skills: developerSkills
          },
          repository: {
            id: repo.id,
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description,
            language: repo.language,
            stars: repo.stars,
            forks: repo.forks,
            openIssues: repo.openIssues,
            extractedSkills: repo.extractedSkills,
            htmlUrl: `https://github.com/${repo.fullName}`
          },
          intelligence: this.formatAnalysisDTO(repo.analysis, repo.fullName),
          match: {
            matchScore: match.matchScore,
            skillCoverage: match.breakdown.skillCoverage,
            proficiencyFit: match.breakdown.proficiencyFit,
            matchedSkills: match.breakdown.matchedSkills,
            missingSkills: match.breakdown.missingSkills,
            breakdown: match.breakdown
          },
          gsoc: {
            isGSoCOrg: candidate.hasGSoC,
            organizationName: repo.organization?.name,
            years: gsocYears
          }
        };

        let repoGuidance;
        let isFallback = false;

        try {
          if (provider.isAvailable()) {
            repoGuidance = await provider.generateRepositoryRecommendation(repoContext);
          } else {
            repoGuidance = AiSafetyService.generateDeterministicRepoFallback(repoContext);
            isFallback = true;
          }
        } catch (err) {
          // Graceful fallback to deterministic recommendation
          repoGuidance = AiSafetyService.generateDeterministicRepoFallback(repoContext);
          isFallback = true;
        }

        const sources: AiRecommendationSource = {
          repositoryId: repo.id,
          repositoryName: repo.name,
          repositoryFullName: repo.fullName,
          repositoryUrl: `https://github.com/${repo.fullName}`,
          organizationName: repo.organization?.name,
          organizationSlug: repo.organization?.slug,
          isGSoCOrg: candidate.hasGSoC,
          gsocYears,
          matchScore: match.matchScore,
          citations: [
            `Verified GitHub Repository: ${repo.fullName} (Stars: ${repo.stars})`,
            `Deterministic Match Score: ${match.matchScore}% (Skill Coverage: ${match.breakdown.skillCoverage}%)`,
            ...(candidate.hasGSoC ? [`GSoC Organization: ${repo.organization?.name} (${gsocYears.join(', ')})`] : [])
          ]
        };

        const persisted = await prisma.aiRecommendation.create({
          data: {
            userId,
            recommendationType: 'REPOSITORY',
            repositoryId: repo.id,
            summary: repoGuidance.summary,
            reasoning: repoGuidance.reasoning,
            matchedSkills: repoGuidance.matchedSkills,
            missingSkills: repoGuidance.missingSkills,
            learningCurve: `${repoGuidance.learningCurve}: ${repoGuidance.learningCurveExplanation}`,
            strengths: repoGuidance.strengths,
            concerns: repoGuidance.concerns,
            checklist: [],
            maintainerQuestions: [],
            nextSteps: repoGuidance.nextSteps,
            sources: sources as any,
            provider: isFallback ? 'deterministic-fallback' : provider.name,
            model: isFallback ? 'rule-engine-v1' : provider.model,
            isFallback,
            isComplete: true,
            expiresAt
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
                  select: { name: true }
                }
              }
            }
          }
        });

        generatedRecommendations.push(this.mapToDTO(persisted));
      }
    }

    // 6. Generate Contribution Recommendations from verified open issues
    if (type === 'ALL' || type === 'CONTRIBUTION') {
      for (const candidate of topCandidates) {
        const repo = candidate.repository;
        const openIssues = repo.issues || [];

        // Filter issues matching criteria
        const eligibleIssues = openIssues.filter((issue) => {
          if (issue.state !== 'open') return false; // Strictly open issues
          if (difficulty === 'beginner') return issue.isBeginnerFriendly;
          if (difficulty === 'intermediate' || difficulty === 'advanced') {
            return !issue.isBeginnerFriendly;
          }
          return true;
        });

        // Pick top 1-2 open issues per candidate repository
        for (const issue of eligibleIssues.slice(0, 2)) {
          const issueContext: AiIssueRecommendationContext = {
            developer: {
              username: user.githubUsername,
              skills: developerSkills
            },
            repository: {
              id: repo.id,
              name: repo.name,
              fullName: repo.fullName,
              language: repo.language,
              htmlUrl: `https://github.com/${repo.fullName}`,
              stars: repo.stars
            },
            issue: {
              id: issue.id,
              number: issue.number || 0,
              title: issue.title,
              body: issue.description,
              url: issue.url,
              state: issue.state,
              labels: issue.labels,
              isBeginnerFriendly: issue.isBeginnerFriendly,
              commentsCount: issue.commentsCount
            },
            gsoc: {
              isGSoCOrg: candidate.hasGSoC,
              organizationName: repo.organization?.name,
              years: repo.organization?.years?.map((y) => y.year) || []
            }
          };

          let issueGuidance;
          let isFallback = false;

          try {
            if (provider.isAvailable()) {
              issueGuidance = await provider.generateContributionRecommendation(issueContext);
            } else {
              issueGuidance = AiSafetyService.generateDeterministicIssueFallback(issueContext);
              isFallback = true;
            }
          } catch (err) {
            issueGuidance = AiSafetyService.generateDeterministicIssueFallback(issueContext);
            isFallback = true;
          }

          const sources: AiRecommendationSource = {
            repositoryId: repo.id,
            repositoryName: repo.name,
            repositoryFullName: repo.fullName,
            repositoryUrl: `https://github.com/${repo.fullName}`,
            issueId: issue.id,
            issueNumber: issue.number || undefined,
            issueTitle: issue.title,
            issueUrl: issue.url,
            organizationName: repo.organization?.name,
            organizationSlug: repo.organization?.slug,
            isGSoCOrg: candidate.hasGSoC,
            gsocYears: repo.organization?.years?.map((y) => y.year) || [],
            citations: [
              `Verified GitHub Issue #${issue.number || 'N/A'}: ${issue.title}`,
              `Repository: ${repo.fullName}`,
              `Issue URL: ${issue.url}`,
              `Disclaimer: ${GSOC_RECOMMENDATION_DISCLAIMER}`
            ]
          };

          const persisted = await prisma.aiRecommendation.create({
            data: {
              userId,
              recommendationType: 'CONTRIBUTION',
              repositoryId: repo.id,
              issueId: issue.id,
              summary: issueGuidance.summary,
              reasoning: issueGuidance.reasoning,
              matchedSkills: issueGuidance.matchedSkills,
              missingSkills: issueGuidance.missingSkills,
              learningCurve: issueGuidance.learningCurve,
              strengths: issueGuidance.requirements,
              concerns: issueGuidance.pitfallsToAvoid,
              checklist: issueGuidance.checklist,
              maintainerQuestions: issueGuidance.maintainerQuestions,
              nextSteps: issueGuidance.nextSteps,
              sources: sources as any,
              provider: isFallback ? 'deterministic-fallback' : provider.name,
              model: isFallback ? 'rule-engine-v1' : provider.model,
              isFallback,
              isComplete: true,
              expiresAt
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
                    select: { name: true }
                  }
                }
              },
              issue: {
                select: {
                  id: true,
                  number: true,
                  title: true,
                  url: true,
                  state: true,
                  isBeginnerFriendly: true
                }
              }
            }
          });

          generatedRecommendations.push(this.mapToDTO(persisted));
        }
      }
    }

    return generatedRecommendations;
  }

  /**
   * Retrieves existing stored recommendations for the authenticated user
   * with pagination, type filtering, and freshness validation.
   */
  async getUserRecommendations(
    userId: string,
    params: {
      page?: number;
      perPage?: number;
      type?: 'REPOSITORY' | 'CONTRIBUTION';
      repositoryId?: string;
    } = {}
  ): Promise<PaginatedResult<AiRecommendationDTO>> {
    const { page = 1, perPage = 20, type, repositoryId } = params;

    const safePage = Math.max(1, page);
    const safePerPage = Math.min(Math.max(1, perPage), 100);
    const skip = (safePage - 1) * safePerPage;

    const where: any = {
      userId
    };

    if (type) {
      where.recommendationType = type;
    }

    if (repositoryId) {
      where.repositoryId = repositoryId;
    }

    const [total, items] = await Promise.all([
      prisma.aiRecommendation.count({ where }),
      prisma.aiRecommendation.findMany({
        where,
        skip,
        take: safePerPage,
        orderBy: { createdAt: 'desc' },
        include: {
          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
              language: true,
              stars: true,
              organization: {
                select: { name: true }
              }
            }
          },
          issue: {
            select: {
              id: true,
              number: true,
              title: true,
              url: true,
              state: true,
              isBeginnerFriendly: true
            }
          }
        }
      })
    ]);

    const totalPages = Math.ceil(total / safePerPage);
    const pagination: PaginationMeta = {
      page: safePage,
      perPage: safePerPage,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1
    };

    return {
      data: items.map((item) => this.mapToDTO(item)),
      pagination
    };
  }

  /**
   * Retrieves a single recommendation by ID, enforcing strict user ownership.
   */
  async getRecommendationById(
    userId: string,
    id: string
  ): Promise<AiRecommendationDetailDTO> {
    const item = await prisma.aiRecommendation.findUnique({
      where: { id },
      include: {
        repository: {
          include: {
            analysis: true,
            organization: {
              include: {
                years: true
              }
            }
          }
        },
        issue: true
      }
    });

    if (!item || item.userId !== userId) {
      throw ApiError.notFound('Recommendation not found');
    }

    const dto = this.mapToDTO(item);

    let analysisDTO = null;
    if (item.repository?.analysis) {
      analysisDTO = this.formatAnalysisDTO(
        item.repository.analysis,
        item.repository.fullName
      );
    }

    let organizationDTO = null;
    if (item.repository?.organization) {
      const org = item.repository.organization;
      organizationDTO = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        website: org.website,
        githubUrl: org.githubUrl,
        category: org.category,
        topics: org.topics,
        imageUrl: org.imageUrl,
        years: org.years?.map((y) => y.year) || [],
        repositoryCount: 1,
        averageQualityScore: item.repository.analysis?.overallScore ?? null,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString()
      };
    }

    return {
      ...dto,
      analysis: analysisDTO,
      organization: organizationDTO
    };
  }

  /**
   * Refreshes a single recommendation by regenerating it with the AI provider.
   */
  async refreshRecommendation(
    userId: string,
    id: string
  ): Promise<AiRecommendationDTO> {
    const existing = await prisma.aiRecommendation.findUnique({
      where: { id },
      include: {
        repository: {
          include: {
            analysis: true,
            organization: {
              include: {
                years: true
              }
            }
          }
        },
        issue: true
      }
    });

    if (!existing || existing.userId !== userId) {
      throw ApiError.notFound('Recommendation not found');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.unauthorized('User not found');

    const developerSkills: DeveloperSkillDTO[] = await developerSkillService.getUserSkills(userId);
    const provider = AiProviderFactory.getProvider();
    const expiresAt = this.getExpirationDate();

    if (existing.recommendationType === 'REPOSITORY' && existing.repository) {
      const repo = existing.repository;
      const gsocYears = repo.organization?.years?.map((y) => y.year) || [];

      const repoContext: AiRepoRecommendationContext = {
        developer: {
          username: user.githubUsername,
          skills: developerSkills
        },
        repository: {
          id: repo.id,
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description,
          language: repo.language,
          stars: repo.stars,
          forks: repo.forks,
          openIssues: repo.openIssues,
          extractedSkills: repo.extractedSkills,
          htmlUrl: `https://github.com/${repo.fullName}`
        },
        intelligence: this.formatAnalysisDTO(repo.analysis, repo.fullName),
        gsoc: {
          isGSoCOrg: gsocYears.length > 0,
          organizationName: repo.organization?.name,
          years: gsocYears
        }
      };

      let repoGuidance;
      let isFallback = false;

      try {
        if (provider.isAvailable()) {
          repoGuidance = await provider.generateRepositoryRecommendation(repoContext);
        } else {
          repoGuidance = AiSafetyService.generateDeterministicRepoFallback(repoContext);
          isFallback = true;
        }
      } catch (err) {
        repoGuidance = AiSafetyService.generateDeterministicRepoFallback(repoContext);
        isFallback = true;
      }

      const updated = await prisma.aiRecommendation.update({
        where: { id },
        data: {
          summary: repoGuidance.summary,
          reasoning: repoGuidance.reasoning,
          matchedSkills: repoGuidance.matchedSkills,
          missingSkills: repoGuidance.missingSkills,
          learningCurve: `${repoGuidance.learningCurve}: ${repoGuidance.learningCurveExplanation}`,
          strengths: repoGuidance.strengths,
          concerns: repoGuidance.concerns,
          nextSteps: repoGuidance.nextSteps,
          provider: isFallback ? 'deterministic-fallback' : provider.name,
          model: isFallback ? 'rule-engine-v1' : provider.model,
          isFallback,
          expiresAt
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
                select: { name: true }
              }
            }
          }
        }
      });

      return this.mapToDTO(updated);
    } else if (existing.recommendationType === 'CONTRIBUTION' && existing.issue && existing.repository) {
      const issue = existing.issue;
      const repo = existing.repository;
      const gsocYears = repo.organization?.years?.map((y) => y.year) || [];

      // If issue is now closed, reject refresh with clear error
      if (issue.state !== 'open') {
        throw ApiError.badRequest('Cannot refresh recommendation: underlying issue has been closed.');
      }

      const issueContext: AiIssueRecommendationContext = {
        developer: {
          username: user.githubUsername,
          skills: developerSkills
        },
        repository: {
          id: repo.id,
          name: repo.name,
          fullName: repo.fullName,
          language: repo.language,
          htmlUrl: `https://github.com/${repo.fullName}`,
          stars: repo.stars
        },
        issue: {
          id: issue.id,
          number: issue.number || 0,
          title: issue.title,
          body: issue.description,
          url: issue.url,
          state: issue.state,
          labels: issue.labels,
          isBeginnerFriendly: issue.isBeginnerFriendly,
          commentsCount: issue.commentsCount
        },
        gsoc: {
          isGSoCOrg: gsocYears.length > 0,
          organizationName: repo.organization?.name,
          years: gsocYears
        }
      };

      let issueGuidance;
      let isFallback = false;

      try {
        if (provider.isAvailable()) {
          issueGuidance = await provider.generateContributionRecommendation(issueContext);
        } else {
          issueGuidance = AiSafetyService.generateDeterministicIssueFallback(issueContext);
          isFallback = true;
        }
      } catch (err) {
        issueGuidance = AiSafetyService.generateDeterministicIssueFallback(issueContext);
        isFallback = true;
      }

      const updated = await prisma.aiRecommendation.update({
        where: { id },
        data: {
          summary: issueGuidance.summary,
          reasoning: issueGuidance.reasoning,
          matchedSkills: issueGuidance.matchedSkills,
          missingSkills: issueGuidance.missingSkills,
          learningCurve: issueGuidance.learningCurve,
          strengths: issueGuidance.requirements,
          concerns: issueGuidance.pitfallsToAvoid,
          checklist: issueGuidance.checklist,
          maintainerQuestions: issueGuidance.maintainerQuestions,
          nextSteps: issueGuidance.nextSteps,
          provider: isFallback ? 'deterministic-fallback' : provider.name,
          model: isFallback ? 'rule-engine-v1' : provider.model,
          isFallback,
          expiresAt
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
                select: { name: true }
              }
            }
          },
          issue: {
            select: {
              id: true,
              number: true,
              title: true,
              url: true,
              state: true,
              isBeginnerFriendly: true
            }
          }
        }
      });

      return this.mapToDTO(updated);
    }

    throw ApiError.badRequest('Unable to refresh recommendation due to missing repository or issue link.');
  }

  /**
   * Transforms Prisma DB model to API DTO.
   */
  private mapToDTO(item: any): AiRecommendationDTO {
    const isExpired = new Date() > new Date(item.expiresAt);

    return {
      id: item.id,
      userId: item.userId,
      recommendationType: item.recommendationType as AiRecommendationType,
      repositoryId: item.repositoryId,
      issueId: item.issueId,
      summary: item.summary,
      reasoning: item.reasoning,
      matchedSkills: item.matchedSkills || [],
      missingSkills: item.missingSkills || [],
      learningCurve: item.learningCurve,
      strengths: item.strengths || [],
      concerns: item.concerns || [],
      checklist: item.checklist || [],
      maintainerQuestions: item.maintainerQuestions || [],
      nextSteps: item.nextSteps || [],
      sources: item.sources as AiRecommendationSource,
      provider: item.provider,
      model: item.model,
      isFallback: item.isFallback,
      isComplete: item.isComplete,
      isExpired,
      expiresAt: item.expiresAt instanceof Date ? item.expiresAt.toISOString() : String(item.expiresAt),
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt),
      repository: item.repository
        ? {
            id: item.repository.id,
            name: item.repository.name,
            fullName: item.repository.fullName,
            htmlUrl: `https://github.com/${item.repository.fullName}`,
            language: item.repository.language,
            stars: item.repository.stars,
            organizationName: item.repository.organization?.name
          }
        : undefined,
      issue: item.issue
        ? {
            id: item.issue.id,
            number: item.issue.number,
            title: item.issue.title,
            url: item.issue.url,
            state: item.issue.state,
            isBeginnerFriendly: item.issue.isBeginnerFriendly
          }
        : undefined
    };
  }
}

export const aiRecommendationService = new AiRecommendationService();
