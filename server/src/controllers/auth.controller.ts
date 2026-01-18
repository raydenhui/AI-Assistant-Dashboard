import { Request, Response } from 'express';
import { config } from '../config/index.js';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getUserById,
  updateUserSettings,
  logoutUser,
  deleteUserAccount,
} from '../services/auth.service.js';
import { BadRequestError } from '../middleware/error.middleware.js';

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
export async function initiateGoogleAuth(
  _req: Request,
  res: Response
): Promise<void> {
  const authUrl = getGoogleAuthUrl();
  
  // Return URL for frontend to redirect
  res.json({
    success: true,
    data: {
      authUrl,
    },
  });
}

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
export async function handleGoogleOAuthCallback(
  req: Request,
  res: Response
): Promise<void> {
  const { code, error } = req.query;

  if (error) {
    // User denied access or other OAuth error
    const errorMessage = typeof error === 'string' ? error : 'Authentication failed';
    // Redirect to frontend with error
    res.redirect(`${config.frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.redirect(`${config.frontendUrl}/auth/callback?error=${encodeURIComponent('No authorization code received')}`);
    return;
  }

  try {
    const { user, tokens } = await handleGoogleCallback(code);

    // Redirect to frontend with token
    // In production, consider using httpOnly cookies for better security
    res.redirect(
      `${config.frontendUrl}/auth/callback?token=${tokens.accessToken}&userId=${user.id}`
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
    res.redirect(`${config.frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
  }
}

/**
 * GET /api/auth/status
 * Check authentication status and get current user
 */
export async function getAuthStatus(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    res.json({
      success: true,
      data: {
        authenticated: false,
        user: null,
      },
    });
    return;
  }

  const user = await getUserById(req.userId);

  res.json({
    success: true,
    data: {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        llmProvider: user.llmProvider,
        theme: user.theme,
        timezone: user.timezone,
        hasGoogleAuth: !!(user.googleAccessToken && user.googleRefreshToken),
        createdAt: user.createdAt.toISOString(),
      },
    },
  });
}

/**
 * GET /api/auth/me
 * Get current user profile
 */
export async function getCurrentUser(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const user = await getUserById(req.userId);

  console.log(`[AuthController] Getting current user ${req.userId}:`, {
    llmProvider: user.llmProvider,
    llmSettings: user.llmSettings,
    hasOpenRouterKey: !!(user as any).openRouterKey
  });

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      llmProvider: user.llmProvider.toLowerCase(),
      llmModel: (user.llmSettings as any)?.model || null,
      openRouterKey: (user as any).openRouterKey ? '••••••••' : null,
      theme: user.theme,
      timezone: user.timezone,
      hasGoogleAuth: !!(user.googleAccessToken && user.googleRefreshToken),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  });
}

/**
 * PATCH /api/auth/settings
 * Update user settings
 */
export async function updateSettings(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { llmProvider, llmSettings, openRouterKey, theme, timezone } = req.body;
  
  console.log(`[AuthController] Updating settings for user ${req.userId}:`, {
    llmProvider,
    llmSettings,
    hasOpenRouterKey: !!openRouterKey,
    theme,
    timezone
  });

  // Validate llmProvider
  if (llmProvider && !['OPENROUTER', 'OLLAMA'].includes(llmProvider)) {
    throw new BadRequestError('Invalid LLM provider. Must be OPENROUTER or OLLAMA');
  }

  // Validate theme
  if (theme && !['LIGHT', 'DARK', 'SYSTEM'].includes(theme)) {
    throw new BadRequestError('Invalid theme. Must be LIGHT, DARK, or SYSTEM');
  }

  const updatedUser = await updateUserSettings(req.userId, {
    llmProvider,
    llmSettings,
    openRouterKey,
    theme,
    timezone,
  });
  
  console.log(`[AuthController] Settings updated successfully for user ${req.userId}`);

  res.json({
    success: true,
    data: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      llmProvider: updatedUser.llmProvider.toLowerCase(),
      llmModel: (updatedUser.llmSettings as any)?.model || null,
      openRouterKey: (updatedUser as any).openRouterKey ? '••••••••' : null,
      theme: updatedUser.theme,
      timezone: updatedUser.timezone,
      updatedAt: updatedUser.updatedAt.toISOString(),
    },
  });
}

/**
 * POST /api/auth/logout
 * Logout user and revoke tokens
 */
export async function logout(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  await logoutUser(req.userId);

  res.json({
    success: true,
    data: {
      message: 'Logged out successfully',
    },
  });
}

/**
 * DELETE /api/auth/account
 * Delete user account and all data
 */
export async function deleteAccount(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.userId) {
    throw new BadRequestError('Not authenticated');
  }

  const { confirm } = req.body;

  if (confirm !== 'DELETE') {
    throw new BadRequestError(
      'Please confirm account deletion by sending { "confirm": "DELETE" }'
    );
  }

  await deleteUserAccount(req.userId);

  res.json({
    success: true,
    data: {
      message: 'Account deleted successfully',
    },
  });
}

export default {
  initiateGoogleAuth,
  handleGoogleOAuthCallback,
  getAuthStatus,
  getCurrentUser,
  updateSettings,
  logout,
  deleteAccount,
};
