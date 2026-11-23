import type {
  AuthenticatedUser,
  DiscoveredOrganization,
  DiscoveredRepository,
  DiscoveredIssue,
  RepositoryAnalysis,
  DeveloperSkill,
  AiRecommendation,
  AiProviderStatus,
  JobStatusResponse,
  PaginatedResult,
  SkillProficiency,
  DeterministicRecommendation
} from './types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include' // Send secure cookies on all requests
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: any) {
    throw new ApiError(
      err.message || 'Unable to connect to server. Please check your connection.',
      0
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(
        `Server responded with HTTP ${response.status}`,
        response.status
      );
    }
    return {} as T;
  }

  if (!response.ok) {
    const message =
      json?.error?.message ||
      json?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, json?.error?.details);
  }

  return json;
}

// ============================================================================
// TYPED API MODULES
// ============================================================================

export const authApi = {
  getLoginUrl: () => `${API_BASE_URL}/auth/github`,

  getMe: async (): Promise<AuthenticatedUser | null> => {
    try {
      const res = await request<{ success: boolean; data: AuthenticatedUser }>('/auth/me');
      return res.data;
    } catch (err: any) {
      if (err.statusCode === 401) {
        return null;
      }
      throw err;
    }
  },

  logout: async (): Promise<void> => {
    await request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  }
};

export const discoveryApi = {
  getOrganizations: async (params?: {
    search?: string;
    year?: number;
    technology?: string;
    category?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResult<DiscoveredOrganization>> => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.year) q.set('year', String(params.year));
    if (params?.technology) q.set('technology', params.technology);
    if (params?.category) q.set('category', params.category);
    if (params?.page) q.set('page', String(params.page));
    if (params?.perPage) q.set('perPage', String(params.perPage));

    const res = await request<{
      success: boolean;
      data: DiscoveredOrganization[];
      pagination: any;
    }>(`/discovery/organizations?${q.toString()}`);

    return {
      data: res.data,
      pagination: res.pagination
    };
  },

  getOrganization: async (slug: string): Promise<DiscoveredOrganization> => {
    const res = await request<{ success: boolean; data: DiscoveredOrganization }>(
      `/discovery/organizations/${encodeURIComponent(slug)}`
    );
    return res.data;
  },

  getOrganizationRepos: async (
    slug: string,
    params?: { search?: string; language?: string; sort?: string; page?: number; perPage?: number }
  ): Promise<PaginatedResult<DiscoveredRepository>> => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.language) q.set('language', params.language);
    if (params?.sort) q.set('sort', params.sort);
    if (params?.page) q.set('page', String(params.page));
    if (params?.perPage) q.set('perPage', String(params.perPage));

    const res = await request<{
      success: boolean;
      data: DiscoveredRepository[];
      pagination: any;
    }>(`/discovery/organizations/${encodeURIComponent(slug)}/repos?${q.toString()}`);

    return {
      data: res.data,
      pagination: res.pagination
    };
  },

  getIssues: async (params?: {
    organization?: string;
    repository?: string;
    language?: string;
    beginnerOnly?: boolean;
    label?: string;
    year?: number;
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResult<DiscoveredIssue>> => {
    const q = new URLSearchParams();
    if (params?.organization) q.set('organization', params.organization);
    if (params?.repository) q.set('repository', params.repository);
    if (params?.language) q.set('language', params.language);
    if (params?.beginnerOnly) q.set('beginnerOnly', 'true');
    if (params?.label) q.set('label', params.label);
    if (params?.year) q.set('year', String(params.year));
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.perPage) q.set('perPage', String(params.perPage));

    const res = await request<{
      success: boolean;
      data: DiscoveredIssue[];
      pagination: any;
    }>(`/discovery/issues?${q.toString()}`);

    return {
      data: res.data,
      pagination: res.pagination
    };
  },

  getIssue: async (
    owner: string,
    repo: string,
    issueNumber: number | string
  ): Promise<DiscoveredIssue> => {
    const res = await request<{ success: boolean; data: DiscoveredIssue }>(
      `/discovery/issues/${encodeURIComponent(owner)}/${encodeURIComponent(
        repo
      )}/${encodeURIComponent(issueNumber)}`
    );
    return res.data;
  }
};

export const intelligenceApi = {
  getAnalysis: async (
    owner: string,
    repo: string,
    force: boolean = false
  ): Promise<RepositoryAnalysis> => {
    const q = force ? '?force=true' : '';
    const res = await request<{ success: boolean; data: RepositoryAnalysis }>(
      `/intelligence/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${q}`
    );
    return res.data;
  },

  getBreakdown: async (owner: string, repo: string): Promise<any> => {
    const res = await request<{ success: boolean; data: any }>(
      `/intelligence/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/breakdown`
    );
    return res.data;
  },

  refreshAnalysis: async (owner: string, repo: string): Promise<RepositoryAnalysis> => {
    const res = await request<{ success: boolean; data: RepositoryAnalysis }>(
      `/intelligence/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/refresh`,
      { method: 'POST' }
    );
    return res.data;
  }
};

export const skillsApi = {
  getSkills: async (): Promise<DeveloperSkill[]> => {
    const res = await request<{ success: boolean; data: DeveloperSkill[] }>('/skills');
    return res.data;
  },

  addSkill: async (
    skillName: string,
    proficiency: SkillProficiency = 'Intermediate'
  ): Promise<DeveloperSkill> => {
    const res = await request<{ success: boolean; data: DeveloperSkill }>('/skills', {
      method: 'POST',
      body: JSON.stringify({ skillName, proficiency })
    });
    return res.data;
  },

  updateSkill: async (
    id: string,
    proficiency: SkillProficiency
  ): Promise<DeveloperSkill> => {
    const res = await request<{ success: boolean; data: DeveloperSkill }>(
      `/skills/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ proficiency })
      }
    );
    return res.data;
  },

  deleteSkill: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`/skills/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  bulkUpdate: async (
    skills: Array<{ skillName: string; proficiency: SkillProficiency }>
  ): Promise<DeveloperSkill[]> => {
    const res = await request<{ success: boolean; data: DeveloperSkill[] }>('/skills/bulk', {
      method: 'PUT',
      body: JSON.stringify({ skills })
    });
    return res.data;
  }
};

export const matchingApi = {
  generateRecommendations: async (): Promise<DeterministicRecommendation[]> => {
    const res = await request<{
      success: boolean;
      message: string;
      data: DeterministicRecommendation[];
    }>('/matching/generate', { method: 'POST' });
    return res.data;
  },

  getRecommendations: async (params?: {
    page?: number;
    perPage?: number;
    minScore?: number;
  }): Promise<PaginatedResult<DeterministicRecommendation>> => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.perPage) q.set('perPage', String(params.perPage));
    if (params?.minScore) q.set('minScore', String(params.minScore));

    const res = await request<{
      success: boolean;
      data: DeterministicRecommendation[];
      pagination: any;
    }>(`/matching/recommendations?${q.toString()}`);

    return {
      data: res.data,
      pagination: res.pagination
    };
  },

  getRecommendationById: async (id: string): Promise<DeterministicRecommendation> => {
    const res = await request<{ success: boolean; data: DeterministicRecommendation }>(
      `/matching/recommendations/${encodeURIComponent(id)}`
    );
    return res.data;
  }
};

export const aiApi = {
  getStatus: async (): Promise<AiProviderStatus> => {
    const res = await request<{ success: boolean; data: AiProviderStatus }>('/ai/status');
    return res.data;
  },

  generateRecommendations: async (options?: {
    maxRepositories?: number;
    minScore?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'all';
    includeGSoC?: boolean;
    type?: 'REPOSITORY' | 'CONTRIBUTION' | 'ALL';
    forceRefresh?: boolean;
  }): Promise<AiRecommendation[]> => {
    const res = await request<{ success: boolean; count: number; data: AiRecommendation[] }>(
      '/ai/recommendations/generate',
      {
        method: 'POST',
        body: JSON.stringify(options || {})
      }
    );
    return res.data;
  },

  getRecommendations: async (params?: {
    page?: number;
    perPage?: number;
    type?: 'REPOSITORY' | 'CONTRIBUTION';
    repositoryId?: string;
  }): Promise<PaginatedResult<AiRecommendation>> => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.perPage) q.set('perPage', String(params.perPage));
    if (params?.type) q.set('type', params.type);
    if (params?.repositoryId) q.set('repositoryId', params.repositoryId);

    const res = await request<{
      success: boolean;
      data: AiRecommendation[];
      pagination: any;
    }>(`/ai/recommendations?${q.toString()}`);

    return {
      data: res.data,
      pagination: res.pagination
    };
  },

  getRecommendation: async (id: string): Promise<AiRecommendation> => {
    const res = await request<{ success: boolean; data: AiRecommendation }>(
      `/ai/recommendations/${encodeURIComponent(id)}`
    );
    return res.data;
  },

  refreshRecommendation: async (id: string): Promise<AiRecommendation> => {
    const res = await request<{ success: boolean; data: AiRecommendation }>(
      `/ai/recommendations/${encodeURIComponent(id)}/refresh`,
      { method: 'POST' }
    );
    return res.data;
  }
};

export const jobsApi = {
  syncOrg: async (
    slug: string,
    force: boolean = false
  ): Promise<{ jobId: string; jobType: string; status: string }> => {
    const res = await request<{ success: boolean; data: any }>(
      `/jobs/organizations/${encodeURIComponent(slug)}/sync`,
      {
        method: 'POST',
        body: JSON.stringify({ force })
      }
    );
    return res.data;
  },

  analyzeRepo: async (
    owner: string,
    repo: string,
    forceRefresh: boolean = false
  ): Promise<{ jobId: string; jobType: string; status: string }> => {
    const res = await request<{ success: boolean; data: any }>(
      `/jobs/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/analyze`,
      {
        method: 'POST',
        body: JSON.stringify({ forceRefresh })
      }
    );
    return res.data;
  },

  generateAiRecommendations: async (options?: any): Promise<{
    jobId: string;
    jobType: string;
    status: string;
  }> => {
    const res = await request<{ success: boolean; data: any }>(
      '/jobs/recommendations/generate',
      {
        method: 'POST',
        body: JSON.stringify({ options: options || {} })
      }
    );
    return res.data;
  },

  getJobStatus: async (jobId: string): Promise<JobStatusResponse> => {
    const res = await request<{ success: boolean; data: JobStatusResponse }>(
      `/jobs/${encodeURIComponent(jobId)}`
    );
    return res.data;
  }
};
