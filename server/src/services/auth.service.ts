import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import prisma from '../config/database.js';
import { config } from '../config/index.js';
import {
  createOAuth2Client,
  getAuthUrl,
  getTokensFromCode,
  getGoogleUserInfo,
  createAuthenticatedClient,
  verifyAndRefreshTokens,
  revokeTokens,
} from '../config/google.js';
import { UnauthorizedError, NotFoundError } from '../middleware/error.middleware.js';

// =============================================================================
// Types
// =============================================================================

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: number | null;
}

// =============================================================================
// JWT Functions
// =============================================================================

/**
 * Generate JWT token for authenticated user
 */
export function generateJwtToken(user: Pick<User, 'id' | 'email'>): AuthTokens {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });

  return {
    accessToken,
    expiresIn: config.jwt.expiresIn,
  };
}

/**
 * Verify and decode JWT token
 */
export function verifyJwtToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired', 'TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
    }
    throw new UnauthorizedError('Authentication failed', 'AUTH_FAILED');
  }
}

// =============================================================================
// Google OAuth Functions
// =============================================================================

/**
 * Get Google OAuth authorization URL
 */
export function getGoogleAuthUrl(): string {
  const oauth2Client = createOAuth2Client();
  return getAuthUrl(oauth2Client);
}

/**
 * Handle Google OAuth callback
 * Creates or updates user and returns JWT token
 */
export async function handleGoogleCallback(code: string): Promise<{
  user: User;
  tokens: AuthTokens;
}> {
  const oauth2Client = createOAuth2Client();

  // Exchange code for tokens
  const googleTokens = await getTokensFromCode(oauth2Client, code);

  if (!googleTokens.access_token) {
    throw new UnauthorizedError('Failed to get access token from Google');
  }

  // Set credentials to get user info
  oauth2Client.setCredentials(googleTokens);

  // Get user info from Google
  const googleUser = await getGoogleUserInfo(oauth2Client);

  if (!googleUser.email) {
    throw new UnauthorizedError('Failed to get email from Google');
  }

  // Create or update user in database
  const user = await prisma.user.upsert({
    where: { email: googleUser.email },
    update: {
      name: googleUser.name,
      picture: googleUser.picture,
      googleAccessToken: googleTokens.access_token,
      googleRefreshToken: googleTokens.refresh_token || undefined,
      googleTokenExpiry: googleTokens.expiry_date
        ? new Date(googleTokens.expiry_date)
        : null,
    },
    create: {
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      googleAccessToken: googleTokens.access_token,
      googleRefreshToken: googleTokens.refresh_token || null,
      googleTokenExpiry: googleTokens.expiry_date
        ? new Date(googleTokens.expiry_date)
        : null,
    },
  });

  // Generate JWT token
  const jwtTokens = generateJwtToken(user);

  return {
    user,
    tokens: jwtTokens,
  };
}

// =============================================================================
// User Management Functions
// =============================================================================

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email },
  });
}

/**
 * Get authenticated Google client for a user
 * Handles token refresh automatically
 */
export async function getAuthenticatedGoogleClient(
  userId: string
): Promise<ReturnType<typeof createAuthenticatedClient>> {
  const user = await getUserById(userId);

  if (!user.googleAccessToken || !user.googleRefreshToken) {
    throw new UnauthorizedError(
      'User not authenticated with Google',
      'GOOGLE_AUTH_REQUIRED'
    );
  }

  const oauth2Client = createAuthenticatedClient({
    accessToken: user.googleAccessToken,
    refreshToken: user.googleRefreshToken,
    expiryDate: user.googleTokenExpiry?.getTime(),
  });

  // Verify and refresh tokens if needed
  const newCredentials = await verifyAndRefreshTokens(oauth2Client);

  if (newCredentials && newCredentials.access_token !== user.googleAccessToken) {
    // Tokens were refreshed, update database
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: newCredentials.access_token,
        googleRefreshToken: newCredentials.refresh_token || user.googleRefreshToken,
        googleTokenExpiry: newCredentials.expiry_date
          ? new Date(newCredentials.expiry_date)
          : user.googleTokenExpiry,
      },
    });
  }

  return oauth2Client;
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  settings: {
    llmProvider?: 'OPENROUTER' | 'OLLAMA';
    llmSettings?: Record<string, unknown> | null;
    theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
    timezone?: string;
  }
): Promise<User> {
  // Build update data with proper typing
  const updateData: Parameters<typeof prisma.user.update>[0]['data'] = {};
  
  if (settings.llmProvider !== undefined) {
    updateData.llmProvider = settings.llmProvider;
  }
  if (settings.llmSettings !== undefined) {
    updateData.llmSettings = settings.llmSettings as Parameters<typeof prisma.user.update>[0]['data']['llmSettings'];
  }
  if (settings.theme !== undefined) {
    updateData.theme = settings.theme;
  }
  if (settings.timezone !== undefined) {
    updateData.timezone = settings.timezone;
  }
  
  return prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

/**
 * Logout user - revoke Google tokens
 */
export async function logoutUser(userId: string): Promise<void> {
  const user = await getUserById(userId);

  if (user.googleAccessToken && user.googleRefreshToken) {
    try {
      const oauth2Client = createAuthenticatedClient({
        accessToken: user.googleAccessToken,
        refreshToken: user.googleRefreshToken,
        expiryDate: user.googleTokenExpiry?.getTime(),
      });

      await revokeTokens(oauth2Client);
    } catch (error) {
      console.warn('Failed to revoke Google tokens:', error);
      // Continue with logout even if revocation fails
    }
  }

  // Clear Google tokens from database
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    },
  });
}

/**
 * Delete user account and all associated data
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  // Logout first to revoke tokens
  await logoutUser(userId);

  // Delete user (cascades to all related data)
  await prisma.user.delete({
    where: { id: userId },
  });
}

export default {
  generateJwtToken,
  verifyJwtToken,
  getGoogleAuthUrl,
  handleGoogleCallback,
  getUserById,
  getUserByEmail,
  getAuthenticatedGoogleClient,
  updateUserSettings,
  logoutUser,
  deleteUserAccount,
};
