import type {
  AiRepositoryGuidance,
  AiContributionGuidance,
  DeveloperSkillDTO,
  RepositoryAnalysisDTO,
  MatchBreakdown
} from '../../types/index.js';

export interface AiRepoRecommendationContext {
  developer: {
    username: string;
    skills: DeveloperSkillDTO[];
  };
  repository: {
    id: string;
    name: string;
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    extractedSkills: string[];
    htmlUrl: string;
  };
  intelligence?: RepositoryAnalysisDTO | null;
  match?: {
    matchScore: number;
    skillCoverage: number;
    proficiencyFit: number;
    matchedSkills: string[];
    missingSkills: string[];
    breakdown?: MatchBreakdown;
  };
  gsoc?: {
    isGSoCOrg: boolean;
    organizationName?: string;
    years: number[];
  };
}

export interface AiIssueRecommendationContext {
  developer: {
    username: string;
    skills: DeveloperSkillDTO[];
  };
  repository: {
    id: string;
    name: string;
    fullName: string;
    language: string | null;
    htmlUrl: string;
    stars: number;
  };
  issue: {
    id: string;
    number: number;
    title: string;
    body: string | null;
    url: string;
    state: string;
    labels: string[];
    isBeginnerFriendly: boolean;
    commentsCount: number;
  };
  gsoc?: {
    isGSoCOrg: boolean;
    organizationName?: string;
    years: number[];
  };
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Checks if provider credentials and network endpoints are available.
   */
  isAvailable(): Promise<boolean> | boolean;

  /**
   * Generates a grounded, structured repository recommendation.
   */
  generateRepositoryRecommendation(
    context: AiRepoRecommendationContext
  ): Promise<AiRepositoryGuidance>;

  /**
   * Generates a grounded, structured contribution opportunity recommendation.
   */
  generateContributionRecommendation(
    context: AiIssueRecommendationContext
  ): Promise<AiContributionGuidance>;
}
