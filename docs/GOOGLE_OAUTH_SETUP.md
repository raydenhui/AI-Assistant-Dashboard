# Google OAuth 2.0 Setup Guide

This guide explains how to set up Google OAuth 2.0 for the AI Personal Productivity Dashboard.

## Prerequisites

- A Google account
- Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click "New Project"
4. Enter a project name (e.g., "AI Productivity Dashboard")
5. Click "Create"
6. Wait for the project to be created and then select it

## Step 2: Enable Required APIs

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for and enable the following APIs:
   - **Gmail API** - for email access
   - **Google Calendar API** - for calendar access
3. Click on each API and click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** (unless you have a Google Workspace organization)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: AI Productivity Dashboard
   - **User support email**: Your email address
   - **Developer contact email**: Your email address
5. Click "Save and Continue"
6. On the "Scopes" page, click "Add or Remove Scopes"
7. Add the following scopes:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/calendar.readonly
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/userinfo.profile
   ```
8. Click "Update" then "Save and Continue"
9. On the "Test users" page, click "Add Users"
10. Add your email address(es) that you'll use for testing
11. Click "Save and Continue"
12. Review the summary and click "Back to Dashboard"

## Step 4: Create OAuth Client ID

1. Go to **APIs & Services** > **Credentials**
2. Click "Create Credentials" > **OAuth client ID**
3. Select **Web application** as the application type
4. Enter a name (e.g., "AI Dashboard Web Client")
5. Under "Authorized JavaScript origins", add:
   ```
   http://localhost:5173
   http://localhost:3001
   ```
6. Under "Authorized redirect URIs", add:
   ```
   http://localhost:3001/api/auth/google/callback
   ```
7. Click "Create"
8. A dialog will show your **Client ID** and **Client Secret**
9. **Copy both values** - you'll need them for the configuration

## Step 5: Configure Environment Variables

1. Navigate to your project's `server` directory
2. Create or edit the `.env` file
3. Add your Google OAuth credentials:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

Replace `your-client-id-here` and `your-client-secret-here` with the values from Step 4.

## Step 6: Test the OAuth Flow

1. Start the backend server:
   ```bash
   cd server
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd client
   npm run dev
   ```

3. Open http://localhost:5173 in your browser
4. Click "Continue with Google"
5. Select your Google account
6. Grant the requested permissions
7. You should be redirected back to the dashboard

## Troubleshooting

### "Access Blocked: This app's request is invalid"

- Verify that the redirect URI in Google Cloud Console matches exactly with `GOOGLE_REDIRECT_URI` in your `.env` file
- Make sure you're using `http://localhost:3001` not `http://127.0.0.1:3001`

### "Error 403: access_denied"

- Make sure you've added your email to the "Test users" list in the OAuth consent screen
- The app is in "Testing" mode, so only approved test users can sign in

### "This app isn't verified"

- This is normal for development. Click "Advanced" and then "Go to AI Dashboard (unsafe)" to proceed
- For production, you'll need to submit your app for verification

### "Invalid client_id or client_secret"

- Double-check that you copied the credentials correctly
- Ensure there are no extra spaces in the `.env` file
- Restart the server after updating the `.env` file

## Production Deployment Notes

When deploying to production:

1. **Update OAuth consent screen**:
   - Submit for verification if accessing sensitive scopes
   - Publish the app (move from Testing to Production)

2. **Update Authorized URIs**:
   - Add your production domain to JavaScript origins
   - Add production callback URL to redirect URIs

3. **Update Environment Variables**:
   ```env
   GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
   FRONTEND_URL=https://your-domain.com
   ```

## Security Best Practices

1. **Never commit credentials** - Keep `.env` in `.gitignore`
2. **Use environment-specific credentials** - Different OAuth clients for dev/staging/production
3. **Rotate secrets periodically** - Regenerate client secrets if compromised
4. **Limit scopes** - Only request the permissions you actually need
5. **Secure token storage** - The app stores refresh tokens encrypted in the database

## Reference Links

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Reference](https://developers.google.com/gmail/api/reference/rest)
- [Google Calendar API Reference](https://developers.google.com/calendar/api/v3/reference)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)
