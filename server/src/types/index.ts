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

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
