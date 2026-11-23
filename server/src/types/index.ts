export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
    details?: unknown;
  };
  timestamp: string;
}

export type Environment = 'development' | 'production' | 'test';

export interface EnvConfig {
  PORT: number;
  NODE_ENV: Environment;
  CLIENT_URL: string;
  DATABASE_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_CALLBACK_URL?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  TOKEN_ENCRYPTION_KEY: string;
  REDIS_URL?: string;
  LLM_API_KEY?: string;
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  AI_API_KEY?: string;
  AI_MAX_TOKENS?: number;
  AI_TIMEOUT_MS?: number;
  AI_CACHE_TTL_HOURS?: number;
}

export interface AuthUserPayload {
  userId: string;
  githubId: string;
  username: string;
}

export interface AuthenticatedUserResponse {
  id: string;
  githubId: string;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitHubUserProfile {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
  name: string | null;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface GitHubOrgDTO {
  login: string;
  name: string;
  description: string | null;
  website: string | null;
  avatarUrl: string;
  publicRepos: number;
  publicMembers?: number;
  location: string | null;
  githubUrl: string;
}

export interface GitHubRepoDTO {
  githubRepoId: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  createdAt: string;
  lastUpdatedAt: string | null;
  isArchived: boolean;
  isFork: boolean;
}

export interface GitHubContributorDTO {
  username: string;
  avatarUrl: string;
  profileUrl: string;
  contributionCount: number;
}

export interface GitHubCommitDTO {
  sha: string;
  message: string;
  authorName: string;
  authorUsername: string | null;
  commitDate: string;
  commitUrl: string;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage?: number;
  prevPage?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used?: number;
  resetTime: string;
}

export interface DocumentationSignals {
  hasReadme: boolean;
  hasDescription: boolean;
  hasContributing: boolean;
  hasLicense: boolean;
  hasCodeOfConduct: boolean;
  hasIssueTemplates: boolean;
}

export interface MetricsSummary {
  commitsCountLast90Days: number;
  commitsCountLast30Days: number;
  daysSinceLastCommit: number | null;
  daysSinceLastPush: number | null;
  contributorsCount: number;
  openIssuesCount: number;
  closedIssuesCount: number;
  beginnerIssuesCount: number;
  starsCount: number;
  forksCount: number;
  isArchived: boolean;
  isFork: boolean;
  documentation: DocumentationSignals;
}

export interface IntelligenceScores {
  overall: number;
  activity: number;
  community: number;
  documentation: number;
  beginner: number;
  maintenance: number;
}

export interface IntelligenceExplanations {
  overall: string[];
  activity: string[];
  community: string[];
  documentation: string[];
  beginner: string[];
  maintenance: string[];
}

export interface RepositoryAnalysisDTO {
  id?: string;
  repositoryId?: string;
  fullName: string;
  scores: IntelligenceScores;
  explanations: IntelligenceExplanations;
  metricsSummary: MetricsSummary;
  isComplete: boolean;
  lastAnalyzedAt: string;
}

export interface GitHubIssueDTO {
  githubIssueId: string;
  number: number;
  title: string;
  url: string;
  state: string;
  labels: string[];
  body?: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  isBeginnerFriendly: boolean;
  matchingLabels: string[];
}

export interface CommunityProfileDTO {
  healthPercentage: number;
  hasReadme: boolean;
  hasContributing: boolean;
  hasLicense: boolean;
  hasCodeOfConduct: boolean;
  hasIssueTemplates: boolean;
  hasPullRequestTemplates: boolean;
}

export type ProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface DeveloperSkillDTO {
  id: string;
  userId: string;
  skillName: string;
  proficiency: ProficiencyLevel;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedRepoSkills {
  primarySkills: string[];
  secondarySkills: string[];
  allSkills: string[];
}

export interface MatchBreakdown {
  skillCoverage: number;
  proficiencyFit: number;
  repoQualityScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  explanations: string[];
}

export interface MatchCalculationResult {
  matchScore: number;
  breakdown: MatchBreakdown;
  isComplete: boolean;
}

export interface RecommendationDTO {
  id: string;
  userId: string;
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string;
  matchScore: number;
  skillCoverage: number;
  proficiencyFit: number;
  repoQualityScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  explanation: string | null;
  details?: unknown;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationDetailDTO extends RecommendationDTO {
  repository: {
    id: string;
    name: string;
    fullName: string;
    description: string | null;
    htmlUrl: string;
    language: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    topics: string[];
    extractedSkills: string[];
    intelligence?: IntelligenceScores;
  };
}

export interface GSoCOrgImportInput {
  name: string;
  year: number;
  slug?: string;
  description?: string;
  website?: string;
  githubUrl?: string;
  category?: string;
  topics?: string[] | string;
  imageUrl?: string;
  sourceUrl?: string;
  projectsUrl?: string;
  ideasUrl?: string;
}

export interface GSoCImportResult {
  totalProcessed: number;
  organizationsCreated: number;
  organizationsUpdated: number;
  yearsAdded: number;
  errors: Array<{ item: string; error: string }>;
}

export interface DiscoveredOrganizationDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  githubUrl: string | null;
  category: string | null;
  topics: string[];
  imageUrl: string | null;
  years: number[];
  repositoryCount: number;
  averageQualityScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredRepoDTO {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  extractedSkills: string[];
  lastUpdatedAt: string | null;
  intelligence?: {
    overallScore: number;
    activityScore: number;
    communityScore: number;
    documentationScore: number;
    beginnerScore: number;
    maintenanceScore: number;
  };
  userMatch?: {
    matchScore: number;
    skillCoverage: number;
    proficiencyFit: number;
    matchedSkills: string[];
    missingSkills: string[];
    explanations: string[];
  };
}

export interface DiscoveredIssueDTO {
  id: string;
  githubIssueId: string;
  number: number;
  title: string;
  description: string | null;
  url: string;
  state: string;
  labels: string[];
  isBeginnerFriendly: boolean;
  matchingLabels: string[];
  assignee: string | null;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  repository: {
    id: string;
    name: string;
    fullName: string;
    language: string | null;
    stars: number;
    organizationName?: string;
    organizationSlug?: string;
  };
  gsocSuitabilityDisclaimer: string;
}

export type AiRecommendationType = 'REPOSITORY' | 'CONTRIBUTION';

export interface AiRecommendationSource {
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string;
  repositoryUrl: string;
  issueId?: string;
  issueNumber?: number;
  issueTitle?: string;
  issueUrl?: string;
  organizationName?: string;
  organizationSlug?: string;
  isGSoCOrg?: boolean;
  gsocYears?: number[];
  matchScore?: number;
  citations: string[];
}

export interface AiRecommendationDTO {
  id: string;
  userId: string;
  recommendationType: AiRecommendationType;
  repositoryId: string | null;
  issueId: string | null;
  summary: string;
  reasoning: string;
  matchedSkills: string[];
  missingSkills: string[];
  learningCurve: string | null;
  strengths: string[];
  concerns: string[];
  checklist: string[];
  maintainerQuestions: string[];
  nextSteps: string[];
  sources: AiRecommendationSource;
  provider: string;
  model: string;
  isFallback: boolean;
  isComplete: boolean;
  isExpired: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  repository?: {
    id: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    language: string | null;
    stars: number;
    organizationName?: string;
  };
  issue?: {
    id: string;
    number: number;
    title: string;
    url: string;
    state: string;
    isBeginnerFriendly: boolean;
  };
}

export interface AiRecommendationDetailDTO extends AiRecommendationDTO {
  analysis?: RepositoryAnalysisDTO | null;
  organization?: DiscoveredOrganizationDTO | null;
}

export interface AiGenerationOptions {
  maxRepositories?: number;
  minScore?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'all';
  includeGSoC?: boolean;
  type?: 'REPOSITORY' | 'CONTRIBUTION' | 'ALL';
  forceRefresh?: boolean;
}

export interface AiProviderStatusDTO {
  configured: boolean;
  provider: string;
  model: string;
  healthy: boolean;
  fallbackEnabled: boolean;
  cacheTtlHours: number;
}

export interface AiRepositoryGuidance {
  summary: string;
  reasoning: string;
  matchedSkills: string[];
  missingSkills: string[];
  learningCurve: 'Low' | 'Moderate' | 'High';
  learningCurveExplanation: string;
  strengths: string[];
  concerns: string[];
  nextSteps: string[];
}

export interface AiContributionGuidance {
  summary: string;
  reasoning: string;
  matchedSkills: string[];
  missingSkills: string[];
  learningCurve: 'Low' | 'Moderate' | 'High';
  requirements: string[];
  checklist: string[];
  maintainerQuestions: string[];
  pitfallsToAvoid: string[];
  nextSteps: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
