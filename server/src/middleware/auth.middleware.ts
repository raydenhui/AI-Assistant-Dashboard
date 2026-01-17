import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { verifyJwtToken, getUserById, JwtPayload } from '../services/auth.service.js';
import { UnauthorizedError } from './error.middleware.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
      jwtPayload?: JwtPayload;
    }
  }
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and just "<token>"
  const parts = authHeader.split(' ');
  
  if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer') {
    return parts[1] || null;
  }
  
  if (parts.length === 1) {
    return parts[0] || null;
  }

  return null;
}

/**
 * Authentication middleware - requires valid JWT token
 * Attaches user info to request object
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('No authentication token provided', 'NO_TOKEN');
    }

    // Verify JWT token
    const payload = verifyJwtToken(token);
    req.jwtPayload = payload;
    req.userId = payload.userId;

    // Optionally load full user (can be skipped for performance)
    // Uncomment if you need full user object in every request
    // const user = await getUserById(payload.userId);
    // req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authentication middleware - requires valid JWT and loads full user
 * Use when you need full user object including Google tokens
 */
export async function requireAuthWithUser(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('No authentication token provided', 'NO_TOKEN');
    }

    // Verify JWT token
    const payload = verifyJwtToken(token);
    req.jwtPayload = payload;
    req.userId = payload.userId;

    // Load full user from database
    const user = await getUserById(payload.userId);
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 * Attaches user info if token is provided, but doesn't fail if not
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (token) {
      const payload = verifyJwtToken(token);
      req.jwtPayload = payload;
      req.userId = payload.userId;
    }

    next();
  } catch {
    // Token is invalid, but we continue without auth
    next();
  }
}

/**
 * Verify Google authentication middleware
 * Ensures user has valid Google OAuth tokens
 */
export async function requireGoogleAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // First ensure user is authenticated
    if (!req.userId) {
      throw new UnauthorizedError('Authentication required', 'AUTH_REQUIRED');
    }

    // Load user if not already loaded
    if (!req.user) {
      req.user = await getUserById(req.userId);
    }

    // Check if user has Google tokens
    if (!req.user.googleAccessToken || !req.user.googleRefreshToken) {
      throw new UnauthorizedError(
        'Google authentication required. Please reconnect your Google account.',
        'GOOGLE_AUTH_REQUIRED'
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}

export default {
  requireAuth,
  requireAuthWithUser,
  optionalAuth,
  requireGoogleAuth,
};
