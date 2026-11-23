export interface AuthenticatedUser {
  id: string;
  githubId: string;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  role: 'DEVELOPER' | 'ADMIN';
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface DiscoveredOrganization {
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

export interface DiscoveredRepository {
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
  organizationName?: string;
  organizationSlug?: string;
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

export interface IntelligenceScores {
  overall: number;
  activity: number;
  community: number;
  documentation: number;
  beginner: number;
  maintenance: number;
}

export interface RepositoryAnalysis {
  id?: string;
  repositoryId?: string;
  fullName: string;
  scores: IntelligenceScores;
  explanations: {
    overall: string[];
    activity: string[];
    community: string[];
    documentation: string[];
    beginner: string[];
    maintenance: string[];
  };
  metricsSummary: {
    commitFrequency?: number;
    openIssuesCount?: number;
    closedIssuesCount?: number;
    issueResolutionRate?: number;
    contributorCount?: number;
    hasReadme?: boolean;
    hasContributing?: boolean;
    hasCodeOfConduct?: boolean;
    hasLicense?: boolean;
  };
  isComplete: boolean;
  lastAnalyzedAt: string;
}

export interface DiscoveredIssue {
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

export type SkillProficiency = 'Beginner' | 'Intermediate' | 'Advanced';

export interface DeveloperSkill {
  id: string;
  userId: string;
  skillName: string;
  proficiency: SkillProficiency;
  createdAt: string;
  updatedAt: string;
}

export interface SkillCategoryGroup {
  category: string;
  skills: string[];
}

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

export interface AiRecommendation {
  id: string;
  userId: string;
  recommendationType: 'REPOSITORY' | 'CONTRIBUTION';
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

export interface AiProviderStatus {
  configured: boolean;
  provider: string;
  model: string;
  healthy: boolean;
  fallbackEnabled: boolean;
  cacheTtlHours: number;
}

export type JobType =
  | 'org-sync'
  | 'repo-analysis'
  | 'skill-extraction'
  | 'ai-recommendations'
  | 'issue-sync';

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

export interface DeterministicRecommendation {
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
  details?: any;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
  repository?: {
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

export interface JobStatusResponse {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  createdAt: string;
  processedAt?: string | null;
  completedAt?: string | null;
  failedReason?: string | null;
  result?: any;
}
