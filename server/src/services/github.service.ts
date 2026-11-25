import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import type { GitHubUserProfile, GitHubEmail } from '../types/index.js';

export class GitHubService {
  private readonly tokenUrl = 'https://github.com/login/oauth/access_token';
  private readonly userUrl = 'https://api.github.com/user';
  private readonly emailsUrl = 'https://api.github.com/user/emails';

  /**
   * Exchanges GitHub authorization code for an OAuth access token.
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw ApiError.internal('GitHub OAuth credentials are not properly configured');
    }

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_CALLBACK_URL
      })
    });

    if (!response.ok) {
      throw ApiError.badRequest('Failed to exchange authorization code with GitHub');
    }

    const data = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error || !data.access_token) {
      throw ApiError.badRequest(
        data.error_description || 'Invalid or expired GitHub authorization code'
      );
    }

    return data.access_token;
  }

  /**
   * Fetches the authenticated user profile from GitHub API.
   */
  async fetchUserProfile(accessToken: string): Promise<GitHubUserProfile> {
    const response = await fetch(this.userUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'AceSoc-App'
      }
    });

    if (!response.ok) {
      throw ApiError.badRequest('Failed to fetch GitHub user profile');
    }

    return (await response.json()) as GitHubUserProfile;
  }

  /**
   * Fetches the user's verified primary email from GitHub API.
   */
  async fetchUserEmails(accessToken: string): Promise<GitHubEmail[]> {
    try {
      const response = await fetch(this.emailsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AceSoc-App'
        }
      });

      if (!response.ok) {
        return [];
      }

      return (await response.json()) as GitHubEmail[];
    } catch {
      // In case email scope was denied or endpoint failed, fallback gracefully
      return [];
    }
  }

  /**
   * Resolves the primary verified email address from the profile and email list.
   */
  resolvePrimaryEmail(
    profile: GitHubUserProfile,
    emails: GitHubEmail[]
  ): string | null {
    const primaryVerified = emails.find(e => e.primary && e.verified);
    if (primaryVerified) {
      return primaryVerified.email;
    }

    const anyVerified = emails.find(e => e.verified);
    if (anyVerified) {
      return anyVerified.email;
    }

    return profile.email ?? null;
  }
}

export const githubService = new GitHubService();
