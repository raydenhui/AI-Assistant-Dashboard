import { Router } from 'express';
import {
  initiateGoogleAuth,
  handleGoogleOAuthCallback,
  getAuthStatus,
  getCurrentUser,
  updateSettings,
  logout,
  deleteAccount,
} from '../controllers/auth.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

// =============================================================================
// Public Routes (no authentication required)
// =============================================================================

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth flow - returns auth URL
 * @access  Public
 */
router.get('/google', initiateGoogleAuth);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public (callback from Google)
 */
router.get('/google/callback', handleGoogleOAuthCallback);

// =============================================================================
// Semi-Protected Routes (returns different data based on auth status)
// =============================================================================

/**
 * @route   GET /api/auth/status
 * @desc    Check authentication status
 * @access  Public (but returns user data if authenticated)
 */
router.get('/status', optionalAuth, getAuthStatus);

// =============================================================================
// Protected Routes (authentication required)
// =============================================================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', requireAuth, getCurrentUser);

/**
 * @route   PATCH /api/auth/settings
 * @desc    Update user settings (LLM provider, theme, etc.)
 * @access  Private
 * @body    { llmProvider?, llmSettings?, theme?, timezone? }
 */
router.patch('/settings', requireAuth, updateSettings);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and revoke Google tokens
 * @access  Private
 */
router.post('/logout', requireAuth, logout);

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account and all associated data
 * @access  Private
 * @body    { confirm: "DELETE" }
 */
router.delete('/account', requireAuth, deleteAccount);

export default router;
