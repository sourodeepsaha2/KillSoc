import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { decryptToken } from '../utils/crypto.js';
import { ApiError } from '../utils/apiError.js';

export class GitHubTokenService {
  /**
   * Retrieves and decrypts the authenticated user's GitHub access token from PostgreSQL.
   * Throws ApiError if token is missing or corrupted.
   */
  async getUserAccessToken(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        encryptedAccessToken: true,
        tokenIv: true,
        tokenTag: true
      }
    });

    if (
      !user ||
      !user.encryptedAccessToken ||
      !user.tokenIv ||
      !user.tokenTag
    ) {
      throw ApiError.unauthorized(
        'GitHub access token not found. Please log in with GitHub again.'
      );
    }

    try {
      return decryptToken(
        {
          ciphertext: user.encryptedAccessToken,
          iv: user.tokenIv,
          tag: user.tokenTag
        },
        env.TOKEN_ENCRYPTION_KEY
      );
    } catch {
      throw ApiError.internal('Failed to decrypt GitHub access token');
    }
  }

  /**
   * Attempts to retrieve user access token if userId is provided,
   * returning undefined if no userId was supplied (allowing public fallback).
   */
  async resolveOptionalAccessToken(userId?: string): Promise<string | undefined> {
    if (!userId) {
      return undefined;
    }

    try {
      return await this.getUserAccessToken(userId);
    } catch {
      return undefined;
    }
  }
}

export const githubTokenService = new GitHubTokenService();
