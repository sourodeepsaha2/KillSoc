import { githubApiClient, GitHubApiClient } from './github-api.client.js';
import { isBeginnerLabel } from './intelligence/scoring.config.js';
import type {
  GitHubOrgDTO,
  GitHubRepoDTO,
  GitHubContributorDTO,
  GitHubCommitDTO,
  GitHubIssueDTO,
  CommunityProfileDTO,
  PaginatedResult
} from '../types/index.js';

interface RawGitHubOrg {
  login: string;
  name: string | null;
  description: string | null;
  blog: string | null;
  avatar_url: string;
  public_repos: number;
  public_members_count?: number;
  location: string | null;
  html_url: string;
}

interface RawGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  fork: boolean;
}

interface RawGitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

interface RawGitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    } | null;
    committer: {
      name: string;
      date: string;
    } | null;
  };
  author: {
    login: string;
  } | null;
  html_url: string;
}

interface RawGitHubLabel {
  id?: number;
  name: string;
  color?: string;
  description?: string;
}

interface RawGitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  labels: (RawGitHubLabel | string)[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: unknown;
}

interface RawCommunityProfile {
  health_percentage: number;
  files: {
    code_of_conduct?: unknown;
    code_of_conduct_file?: unknown;
    contributing?: unknown;
    issue_template?: unknown;
    pull_request_template?: unknown;
    license?: unknown;
    readme?: unknown;
  };
}

export class GitHubResourceService {
  constructor(private readonly client: GitHubApiClient = githubApiClient) {}

  /**
   * Fetches organization profile information by organization login.
   */
  async getOrganization(name: string, accessToken?: string): Promise<GitHubOrgDTO> {
    const { data } = await this.client.get<RawGitHubOrg>(`/orgs/${encodeURIComponent(name)}`, {
      accessToken
    });

    return {
      login: data.login,
      name: data.name || data.login,
      description: data.description,
      website: data.blog || null,
      avatarUrl: data.avatar_url,
      publicRepos: data.public_repos,
      publicMembers: data.public_members_count,
      location: data.location || null,
      githubUrl: data.html_url
    };
  }

  /**
   * Fetches repositories belonging to an organization with pagination, sorting, and language filtering.
   */
  async getOrganizationRepos(
    name: string,
    params: {
      page?: number;
      perPage?: number;
      sort?: 'stars' | 'updated' | 'created' | 'full_name';
      direction?: 'asc' | 'desc';
      language?: string;
    } = {},
    accessToken?: string
  ): Promise<PaginatedResult<GitHubRepoDTO>> {
    const { page = 1, perPage = 30, sort = 'updated', direction = 'desc', language } = params;

    const queryParams: Record<string, string | number | undefined> = {
      type: 'public',
      direction
    };

    // GitHub org repos endpoint supports created, updated, pushed, full_name
    if (sort === 'stars') {
      queryParams['sort'] = 'updated';
    } else {
      queryParams['sort'] = sort;
    }

    const rawResult = await this.client.getPaginated<RawGitHubRepo>(
      `/orgs/${encodeURIComponent(name)}/repos`,
      page,
      perPage,
      {
        accessToken,
        queryParams
      }
    );

    let mappedRepos: GitHubRepoDTO[] = rawResult.data.map(repo => ({
      githubRepoId: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      htmlUrl: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      defaultBranch: repo.default_branch,
      createdAt: repo.created_at,
      lastUpdatedAt: repo.updated_at,
      isArchived: repo.archived,
      isFork: repo.fork
    }));

    // Filter by language if specified
    if (language) {
      const lowerLang = language.toLowerCase();
      mappedRepos = mappedRepos.filter(
        r => r.language && r.language.toLowerCase() === lowerLang
      );
    }

    // Sort by stars in memory if stars sorting requested
    if (sort === 'stars') {
      mappedRepos.sort((a, b) => (direction === 'asc' ? a.stars - b.stars : b.stars - a.stars));
    }

    return {
      data: mappedRepos,
      pagination: rawResult.pagination
    };
  }

  /**
   * Fetches single repository information.
   */
  async getRepository(
    owner: string,
    repo: string,
    accessToken?: string
  ): Promise<GitHubRepoDTO> {
    const { data } = await this.client.get<RawGitHubRepo>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { accessToken }
    );

    return {
      githubRepoId: String(data.id),
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      htmlUrl: data.html_url,
      language: data.language,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      defaultBranch: data.default_branch,
      createdAt: data.created_at,
      lastUpdatedAt: data.updated_at,
      isArchived: data.archived,
      isFork: data.fork
    };
  }

  /**
   * Fetches repository contributors with pagination.
   */
  async getRepositoryContributors(
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 30,
    accessToken?: string
  ): Promise<PaginatedResult<GitHubContributorDTO>> {
    const rawResult = await this.client.getPaginated<RawGitHubContributor>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors`,
      page,
      perPage,
      { accessToken }
    );

    const contributors: GitHubContributorDTO[] = rawResult.data.map(c => ({
      username: c.login,
      avatarUrl: c.avatar_url,
      profileUrl: c.html_url,
      contributionCount: c.contributions
    }));

    return {
      data: contributors,
      pagination: rawResult.pagination
    };
  }

  /**
   * Fetches recent repository commits with pagination.
   */
  async getRepositoryCommits(
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 30,
    accessToken?: string
  ): Promise<PaginatedResult<GitHubCommitDTO>> {
    const rawResult = await this.client.getPaginated<RawGitHubCommit>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`,
      page,
      perPage,
      { accessToken }
    );

    const commits: GitHubCommitDTO[] = rawResult.data.map(c => ({
      sha: c.sha,
      message: c.commit.message,
      authorName: c.commit.author?.name || c.author?.login || 'Unknown',
      authorUsername: c.author?.login || null,
      commitDate: c.commit.author?.date || c.commit.committer?.date || '',
      commitUrl: c.html_url
    }));

    return {
      data: commits,
      pagination: rawResult.pagination
    };
  }

  /**
   * Checks whether the repository has a README.
   */
  async getRepositoryReadme(
    owner: string,
    repo: string,
    accessToken?: string
  ): Promise<boolean> {
    try {
      await this.client.get(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
        { accessToken }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetches community profile documentation metrics (README, CONTRIBUTING, LICENSE, CODE_OF_CONDUCT).
   */
  async getRepositoryCommunityProfile(
    owner: string,
    repo: string,
    accessToken?: string
  ): Promise<CommunityProfileDTO> {
    try {
      const { data } = await this.client.get<RawCommunityProfile>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/community/profile`,
        { accessToken }
      );

      return {
        healthPercentage: data.health_percentage ?? 0,
        hasReadme: Boolean(data.files?.readme),
        hasContributing: Boolean(data.files?.contributing),
        hasLicense: Boolean(data.files?.license),
        hasCodeOfConduct: Boolean(
          data.files?.code_of_conduct || data.files?.code_of_conduct_file
        ),
        hasIssueTemplates: Boolean(data.files?.issue_template),
        hasPullRequestTemplates: Boolean(data.files?.pull_request_template)
      };
    } catch {
      // Fallback: If community profile returns 404 or fails, test README directly
      const hasReadme = await this.getRepositoryReadme(owner, repo, accessToken);
      return {
        healthPercentage: hasReadme ? 20 : 0,
        hasReadme,
        hasContributing: false,
        hasLicense: false,
        hasCodeOfConduct: false,
        hasIssueTemplates: false,
        hasPullRequestTemplates: false
      };
    }
  }

  /**
   * Fetches repository issues with pagination, filtering out pull requests,
   * and tagging beginner-friendly issues.
   */
  async getRepositoryIssues(
    owner: string,
    repo: string,
    params: {
      state?: 'open' | 'closed' | 'all';
      page?: number;
      perPage?: number;
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      since?: string;
    } = {},
    accessToken?: string
  ): Promise<PaginatedResult<GitHubIssueDTO>> {
    const {
      state = 'open',
      page = 1,
      perPage = 30,
      sort = 'updated',
      direction = 'desc',
      since
    } = params;

    const queryParams: Record<string, string | number | undefined> = {
      state,
      sort,
      direction,
      ...(since ? { since } : {})
    };

    const rawResult = await this.client.getPaginated<RawGitHubIssue>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      page,
      perPage,
      { accessToken, queryParams }
    );

    // GitHub returns pull requests in issues endpoint as well; filter them out
    const issuesOnly = rawResult.data.filter(item => !item.pull_request);

    const mappedIssues: GitHubIssueDTO[] = issuesOnly.map(issue => {
      const labelNames = (issue.labels || []).map(l =>
        typeof l === 'string' ? l : l.name
      );
      const matchingLabels = labelNames.filter(isBeginnerLabel);

      return {
        githubIssueId: String(issue.id),
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        labels: labelNames,
        body: issue.body,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        isBeginnerFriendly: matchingLabels.length > 0,
        matchingLabels
      };
    });

    return {
      data: mappedIssues,
      pagination: rawResult.pagination
    };
  }
}

export const githubResourceService = new GitHubResourceService();
