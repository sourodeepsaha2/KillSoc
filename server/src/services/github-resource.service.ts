import { githubApiClient, GitHubApiClient } from './github-api.client.js';
import type {
  GitHubOrgDTO,
  GitHubRepoDTO,
  GitHubContributorDTO,
  GitHubCommitDTO,
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
}

export const githubResourceService = new GitHubResourceService();
