import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { developerSkillService } from '../matching/developer-skill.service.js';
import { repositorySkillExtractor } from '../matching/repository-skill-extractor.service.js';
import { matchingEngineService } from '../matching/matching-engine.service.js';
import { normalizeSkillName } from '../matching/skill-taxonomy.js';
import type {
  DiscoveredOrganizationDTO,
  DiscoveredRepoDTO,
  PaginatedResult,
  PaginationMeta,
  DeveloperSkillDTO
} from '../../types/index.js';

export class OrganizationDiscoveryService {
  /**
   * Retrieves paginated GSoC organizations with search, year filtering, technology filtering, and sorting.
   */
  async getOrganizations(params: {
    search?: string;
    year?: number;
    technology?: string;
    category?: string;
    page?: number;
    perPage?: number;
    sort?: string;
  }): Promise<PaginatedResult<DiscoveredOrganizationDTO>> {
    const {
      search,
      year,
      technology,
      category,
      page = 1,
      perPage = 20,
      sort = 'default'
    } = params;

    const safePage = Math.max(1, page);
    const safePerPage = Math.min(Math.max(1, perPage), 100);

    const where: any = {};

    // 1. Text Search across name, description, and slug
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term.toLowerCase() } }
      ];
    }

    // 2. GSoC Year Filter
    if (year && Number.isInteger(year)) {
      where.years = {
        some: { year }
      };
    }

    // 3. Category Filter
    if (category && category.trim()) {
      where.category = {
        equals: category.trim(),
        mode: 'insensitive'
      };
    }

    // 4. Technology or Programming Language Filter
    if (technology && technology.trim()) {
      const tech = technology.trim();
      const normalized = normalizeSkillName(tech);
      const lower = tech.toLowerCase();

      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { topics: { has: lower } },
            {
              repositories: {
                some: {
                  OR: [
                    { language: { equals: tech, mode: 'insensitive' } },
                    { extractedSkills: { has: normalized } }
                  ]
                }
              }
            }
          ]
        }
      ];
    }

    // 5. Sorting
    let orderBy: any = [{ name: 'asc' }];
    if (sort === 'name_desc') {
      orderBy = [{ name: 'desc' }];
    } else if (sort === 'name_asc') {
      orderBy = [{ name: 'asc' }];
    } else if (sort === 'createdAt_desc') {
      orderBy = [{ createdAt: 'desc' }];
    }

    const [total, rawOrgs] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        orderBy,
        skip: (safePage - 1) * safePerPage,
        take: safePerPage,
        include: {
          years: {
            select: { year: true }
          },
          repositories: {
            select: {
              id: true,
              analysis: {
                select: { overallScore: true }
              }
            }
          }
        }
      })
    ]);

    const data: DiscoveredOrganizationDTO[] = rawOrgs.map(org => {
      const years = org.years.map(y => y.year).sort((a, b) => b - a);
      const repoCount = org.repositories.length;

      let qualitySum = 0;
      let analyzedCount = 0;
      for (const repo of org.repositories) {
        if (repo.analysis?.overallScore !== undefined) {
          qualitySum += repo.analysis.overallScore;
          analyzedCount++;
        }
      }

      const averageQualityScore =
        analyzedCount > 0 ? Math.round((qualitySum / analyzedCount) * 10) / 10 : null;

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        website: org.website,
        githubUrl: org.githubUrl,
        category: org.category,
        topics: org.topics,
        imageUrl: org.imageUrl,
        years,
        repositoryCount: repoCount,
        averageQualityScore,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString()
      };
    });

    // In-memory sorting for computed aggregates if requested
    if (sort === 'repos_count') {
      data.sort((a, b) => b.repositoryCount - a.repositoryCount);
    } else if (sort === 'latest_year') {
      data.sort((a, b) => (b.years[0] || 0) - (a.years[0] || 0));
    }

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
   * Retrieves single organization profile by slug, including years and repository summaries.
   */
  async getOrganizationBySlug(slug: string) {
    if (!slug || !slug.trim()) {
      throw ApiError.badRequest('Organization slug is required');
    }

    const cleanSlug = slug.toLowerCase().trim();
    const org = await prisma.organization.findUnique({
      where: { slug: cleanSlug },
      include: {
        years: {
          select: { year: true, projectsUrl: true, ideasUrl: true, topics: true },
          orderBy: { year: 'desc' }
        },
        repositories: {
          select: {
            id: true,
            name: true,
            fullName: true,
            stars: true,
            forks: true,
            openIssues: true,
            language: true,
            extractedSkills: true,
            analysis: {
              select: { overallScore: true, beginnerScore: true }
            }
          },
          orderBy: { stars: 'desc' }
        }
      }
    });

    if (!org) {
      throw ApiError.notFound(`Organization with slug "${slug}" not found`);
    }

    const years = org.years.map(y => y.year);
    let qualitySum = 0;
    let analyzedCount = 0;

    const repositoriesSummary = org.repositories.map(r => {
      const qScore = r.analysis?.overallScore ?? null;
      if (qScore !== null) {
        qualitySum += qScore;
        analyzedCount++;
      }
      return {
        id: r.id,
        name: r.name,
        fullName: r.fullName,
        stars: r.stars,
        forks: r.forks,
        openIssues: r.openIssues,
        language: r.language,
        extractedSkills: r.extractedSkills,
        qualityScore: qScore,
        beginnerScore: r.analysis?.beginnerScore ?? null
      };
    });

    const averageQualityScore =
      analyzedCount > 0 ? Math.round((qualitySum / analyzedCount) * 10) / 10 : null;

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      website: org.website,
      githubUrl: org.githubUrl,
      category: org.category,
      topics: org.topics,
      imageUrl: org.imageUrl,
      years,
      yearsDetails: org.years,
      repositoryCount: org.repositories.length,
      averageQualityScore,
      repositoriesSummary,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString()
    };
  }

  /**
   * Retrieves public repositories for an organization with intelligence scores,
   * extracted skills, and personal developer match scores if authenticated.
   */
  async getOrganizationRepositories(
    slug: string,
    userId?: string
  ): Promise<{
    organization: { name: string; slug: string; githubUrl: string | null };
    repositories: DiscoveredRepoDTO[];
  }> {
    const cleanSlug = slug.toLowerCase().trim();
    const org = await prisma.organization.findUnique({
      where: { slug: cleanSlug },
      include: {
        repositories: {
          include: {
            analysis: true
          },
          orderBy: { stars: 'desc' }
        }
      }
    });

    if (!org) {
      throw ApiError.notFound(`Organization with slug "${slug}" not found`);
    }

    // Retrieve developer skills if authenticated to attach personalized match scores
    let developerSkills: DeveloperSkillDTO[] = [];
    if (userId) {
      try {
        developerSkills = await developerSkillService.getUserSkills(userId);
      } catch {
        // Continue without personal match if skill retrieval fails
      }
    }

    const repositories: DiscoveredRepoDTO[] = [];

    for (const repo of org.repositories) {
      let extractedSkills = repo.extractedSkills;

      // Extract skills if not yet stored
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

        // Persist lazily
        await prisma.repository.update({
          where: { id: repo.id },
          data: { extractedSkills }
        });
      }

      let intelligence: DiscoveredRepoDTO['intelligence'] = undefined;
      if (repo.analysis) {
        intelligence = {
          overallScore: repo.analysis.overallScore,
          activityScore: repo.analysis.activityScore,
          communityScore: repo.analysis.communityScore,
          documentationScore: repo.analysis.documentationScore,
          beginnerScore: repo.analysis.beginnerScore,
          maintenanceScore: repo.analysis.maintenanceScore
        };
      }

      let userMatch: DiscoveredRepoDTO['userMatch'] = undefined;
      if (developerSkills.length > 0) {
        const matchResult = matchingEngineService.calculateMatch(developerSkills, {
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
          analysis: repo.analysis
            ? {
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
              }
            : null
        });

        userMatch = {
          matchScore: matchResult.matchScore,
          skillCoverage: matchResult.breakdown.skillCoverage,
          proficiencyFit: matchResult.breakdown.proficiencyFit,
          matchedSkills: matchResult.breakdown.matchedSkills,
          missingSkills: matchResult.breakdown.missingSkills,
          explanations: matchResult.breakdown.explanations
        };
      }

      repositories.push({
        id: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        htmlUrl: `https://github.com/${repo.fullName}`,
        language: repo.language,
        stars: repo.stars,
        forks: repo.forks,
        openIssues: repo.openIssues,
        topics: repo.topics,
        extractedSkills,
        lastUpdatedAt: repo.lastUpdatedAt ? repo.lastUpdatedAt.toISOString() : null,
        intelligence,
        userMatch
      });
    }

    return {
      organization: {
        name: org.name,
        slug: org.slug,
        githubUrl: org.githubUrl
      },
      repositories
    };
  }
}

export const organizationDiscoveryService = new OrganizationDiscoveryService();
