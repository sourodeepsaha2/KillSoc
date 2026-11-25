import { ApiError } from '../utils/apiError.js';
import type { PaginatedResult, PaginationMeta, RateLimitInfo } from '../types/index.js';

export interface GitHubRequestOptions {
  accessToken?: string;
  queryParams?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

export class GitHubApiClient {
  private readonly baseUrl = 'https://api.github.com';
  private readonly defaultTimeoutMs = 10000;
  private readonly apiVersion = '2022-11-28';

  /**
   * Parses rate limit information from GitHub response headers.
   */
  private parseRateLimitHeaders(headers: Headers): RateLimitInfo {
    const limit = parseInt(headers.get('x-ratelimit-limit') || '0', 10);
    const remaining = parseInt(headers.get('x-ratelimit-remaining') || '0', 10);
    const reset = parseInt(headers.get('x-ratelimit-reset') || '0', 10);
    const used = headers.has('x-ratelimit-used')
      ? parseInt(headers.get('x-ratelimit-used') || '0', 10)
      : undefined;

    const resetDate = reset > 0 ? new Date(reset * 1000).toISOString() : new Date().toISOString();

    return {
      limit,
      remaining,
      reset,
      used,
      resetTime: resetDate
    };
  }

  /**
   * Parses GitHub Link header to determine pagination state.
   */
  private parseLinkHeader(linkHeader?: string | null): Record<string, string> {
    if (!linkHeader) return {};
    const links: Record<string, string> = {};
    const parts = linkHeader.split(',');

    for (const part of parts) {
      const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
      if (match && match[1] && match[2]) {
        links[match[2]] = match[1];
      }
    }

    return links;
  }

  /**
   * Executes a GET request against the GitHub REST API.
   */
  async get<T>(
    path: string,
    options: GitHubRequestOptions = {}
  ): Promise<{ data: T; headers: Headers; rateLimit: RateLimitInfo }> {
    const { accessToken, queryParams, timeoutMs = this.defaultTimeoutMs } = options;

    const url = new URL(path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': this.apiVersion,
      'User-Agent': 'AceSoc-App'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw ApiError.badRequest('GitHub API request timed out');
      }
      throw ApiError.internal('Failed to connect to GitHub API');
    }

    const rateLimit = this.parseRateLimitHeaders(response.headers);

    // Handle Rate Limiting & Secondary Limits
    if (response.status === 403 || response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        throw new ApiError(
          429,
          `GitHub API secondary rate limit reached. Please retry after ${retryAfter} seconds.`
        );
      }

      if (rateLimit.remaining === 0) {
        throw new ApiError(
          429,
          `GitHub API rate limit exceeded. Reset expected at ${rateLimit.resetTime}.`
        );
      }

      const errorBody = (await response.json().catch(() => ({}))) as { message?: string };
      throw ApiError.forbidden(errorBody.message || 'GitHub API access forbidden');
    }

    // Handle Not Found
    if (response.status === 404) {
      throw ApiError.notFound('Requested resource was not found on GitHub');
    }

    // Handle other non-2xx status codes
    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as { message?: string };
      throw new ApiError(
        response.status,
        errorBody.message || `GitHub API error (Status ${response.status})`
      );
    }

    const data = (await response.json()) as T;
    return { data, headers: response.headers, rateLimit };
  }

  /**
   * Executes a paginated GET request and normalizes pagination metadata.
   */
  async getPaginated<T>(
    path: string,
    page: number = 1,
    perPage: number = 30,
    options: Omit<GitHubRequestOptions, 'queryParams'> & {
      queryParams?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<PaginatedResult<T>> {
    const safePerPage = Math.min(Math.max(1, perPage), 100);
    const safePage = Math.max(1, page);

    const queryParams = {
      ...options.queryParams,
      page: safePage,
      per_page: safePerPage
    };

    const { data, headers } = await this.get<T[]>(path, {
      ...options,
      queryParams
    });

    const links = this.parseLinkHeader(headers.get('link'));

    const hasNextPage = Boolean(links['next']) || (Array.isArray(data) && data.length === safePerPage);
    const hasPrevPage = Boolean(links['prev']) || safePage > 1;

    const pagination: PaginationMeta = {
      page: safePage,
      perPage: safePerPage,
      hasNextPage,
      hasPrevPage,
      ...(hasNextPage ? { nextPage: safePage + 1 } : {}),
      ...(hasPrevPage ? { prevPage: safePage - 1 } : {})
    };

    return {
      data,
      pagination
    };
  }
}

export const githubApiClient = new GitHubApiClient();
