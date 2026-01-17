import { google, Auth } from 'googleapis';
import { config } from './index.js';

/**
 * Google OAuth 2.0 Configuration
 * Handles authentication with Google services (Gmail, Calendar)
 */

// Create OAuth2 client
export function createOAuth2Client(): Auth.OAuth2Client {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

// Get authorization URL for user consent
export function getAuthUrl(oauth2Client: Auth.OAuth2Client): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Get refresh token
    scope: config.google.scopes,
    prompt: 'consent', // Force consent screen to get refresh token
    include_granted_scopes: true,
  });
}

// Exchange authorization code for tokens
export async function getTokensFromCode(
  oauth2Client: Auth.OAuth2Client,
  code: string
): Promise<Auth.Credentials> {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Create authenticated client from stored tokens
export function createAuthenticatedClient(tokens: {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
}): Auth.OAuth2Client {
  const oauth2Client = createOAuth2Client();
  
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate,
  });

  // Handle token refresh automatically
  oauth2Client.on('tokens', (newTokens) => {
    console.log('🔄 Google OAuth tokens refreshed');
    // Note: Token updates should be handled by the calling service
    // to persist to database
  });

  return oauth2Client;
}

// Get user info from Google
export async function getGoogleUserInfo(oauth2Client: Auth.OAuth2Client): Promise<{
  id: string;
  email: string;
  name: string;
  picture: string;
}> {
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  
  return {
    id: data.id || '',
    email: data.email || '',
    name: data.name || '',
    picture: data.picture || '',
  };
}

// Verify and refresh tokens if needed
export async function verifyAndRefreshTokens(
  oauth2Client: Auth.OAuth2Client
): Promise<Auth.Credentials | null> {
  try {
    const credentials = oauth2Client.credentials;
    
    // Check if token is expired or about to expire (within 5 minutes)
    const expiryDate = credentials.expiry_date;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiryDate && expiryDate - now < fiveMinutes) {
      // Token is expired or about to expire, refresh it
      const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
      return newCredentials;
    }
    
    // Token is still valid
    return credentials;
  } catch (error) {
    console.error('Failed to verify/refresh Google tokens:', error);
    return null;
  }
}

// Revoke tokens (for logout)
export async function revokeTokens(oauth2Client: Auth.OAuth2Client): Promise<void> {
  const credentials = oauth2Client.credentials;
  
  if (credentials.access_token) {
    await oauth2Client.revokeToken(credentials.access_token);
  }
}

export default {
  createOAuth2Client,
  getAuthUrl,
  getTokensFromCode,
  createAuthenticatedClient,
  getGoogleUserInfo,
  verifyAndRefreshTokens,
  revokeTokens,
};
