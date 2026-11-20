import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/apiError.js';
import { encryptToken } from '../utils/crypto.js';
import { signAuthToken } from '../utils/jwt.js';
import { githubService, GitHubService } from './github.service.js';
import type { AuthenticatedUserResponse } from '../types/index.js';

export class AuthService {
  constructor(private readonly github: GitHubService = githubService) {}

  /**
   * Constructs the GitHub OAuth authorization URL.
   */
  getAuthorizationUrl(state: string): string {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CALLBACK_URL) {
      throw ApiError.internal('GitHub OAuth configuration is missing');
    }

    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: env.GITHUB_CALLBACK_URL,
      scope: 'read:user user:email',
      state
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Processes the OAuth code exchange, fetches profile/email, encrypts token,
   * creates/updates the User in PostgreSQL, and generates an auth JWT.
   */
  async handleOAuthCallback(code: string): Promise<{
    user: AuthenticatedUserResponse;
    jwtToken: string;
  }> {
    // 1. Exchange code for GitHub access token
    const accessToken = await this.github.exchangeCodeForToken(code);

    // 2. Fetch GitHub profile and emails in parallel
    const [profile, emails] = await Promise.all([
      this.github.fetchUserProfile(accessToken),
      this.github.fetchUserEmails(accessToken)
    ]);

    const primaryEmail = this.github.resolvePrimaryEmail(profile, emails);

    // 3. Encrypt access token using AES-256-GCM before database storage
    const encrypted = encryptToken(accessToken, env.TOKEN_ENCRYPTION_KEY);

    const githubIdStr = String(profile.id);

    // 4. Create or update user in PostgreSQL
    const user = await prisma.user.upsert({
      where: { githubId: githubIdStr },
      update: {
        githubUsername: profile.login,
        email: primaryEmail,
        avatarUrl: profile.avatar_url,
        encryptedAccessToken: encrypted.ciphertext,
        tokenIv: encrypted.iv,
        tokenTag: encrypted.tag
      },
      create: {
        githubId: githubIdStr,
        githubUsername: profile.login,
        email: primaryEmail,
        avatarUrl: profile.avatar_url,
        encryptedAccessToken: encrypted.ciphertext,
        tokenIv: encrypted.iv,
        tokenTag: encrypted.tag
      },
      select: {
        id: true,
        githubId: true,
        githubUsername: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // 5. Issue JWT session token
    const jwtToken = signAuthToken({
      userId: user.id,
      githubId: user.githubId,
      username: user.githubUsername
    });

    return { user, jwtToken };
  }

  /**
   * Retrieves an authenticated user's public profile (never exposes tokens).
   */
  async getUserProfile(userId: string): Promise<AuthenticatedUserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        githubId: true,
        githubUsername: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw ApiError.notFound('User account not found');
    }

    return user;
  }
}

export const authService = new AuthService();
