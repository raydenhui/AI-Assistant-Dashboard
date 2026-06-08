# AI Personal Productivity Dashboard – API Reference

**Base URL:** `http://localhost:3001`  
**API Prefix:** `/api`  
**Version:** 1.0.0

All API responses follow the structure:
```json
{ "success": true|false, "data": {...} | [...], "message": "..." }
```
Error responses include a `message` field and, in development, a `stack` field.

---

## Table of Contents

1. [Health Checks](#1-health-checks)
2. [Authentication](#2-authentication-apiauthroutes)
3. [Chat / AI Agent](#3-chat--ai-agent-apichat)
4. [Emails](#4-emails-apiemails)
5. [Calendar](#5-calendar-apicalendar)
6. [Tasks](#6-tasks-apitasks)
7. [Settings](#7-settings-apisettings)
8. [Error Codes](#8-error-codes)

---

## 1. Health Checks

### `GET /health`
Quick liveness probe. No authentication required.

**Response `200`**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-06-08T08:00:00.000Z",
  "environment": "production"
}
```

---

### `GET /health/detailed`
Full health check including database and LLM provider connectivity.

**Response `200` – All healthy**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-06-08T08:00:00.000Z",
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "openrouter": "healthy",
    "ollama": "unhealthy"
  }
}
```

**Response `503` – Degraded** (same shape, `status` = `"degraded"`)

| `services.*` value | Meaning |
|---|---|
| `"healthy"` | Service reachable and responding |
| `"unhealthy"` | Service down or returning errors |
| `"not_configured"` | API key not set (OpenRouter only) |
| `"unknown"` | Not yet checked |

---

## 2. Authentication (`/api/auth/*`)

### `GET /api/auth/google`
Initiates Google OAuth 2.0 login flow. Redirects to Google's consent screen.

**Query params:** none  
**Response:** `302 Redirect → Google`

---

### `GET /api/auth/google/callback`
OAuth callback. Receives the authorization code from Google, exchanges it for tokens, creates/updates the user record, and returns a JWT.

**Query params (set by Google):**
| Param | Type | Description |
|---|---|---|
| `code` | string | Authorization code |
| `state` | string | CSRF state token |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "cuid...",
      "email": "user@example.com",
      "name": "Jane Doe",
      "picture": "https://..."
    }
  }
}
```

---

### `POST /api/auth/refresh`
Exchange a valid (non-expired) JWT for a new one with a refreshed expiry.

**Headers:** `Authorization: Bearer <token>`  
**Response `200`**
```json
{
  "success": true,
  "data": { "token": "<new-jwt>" }
}
```

---

### `GET /api/auth/me`
Returns the authenticated user's profile.

**Auth:** Required  
**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "cuid...",
    "email": "user@example.com",
    "name": "Jane Doe",
    "picture": "https://...",
    "llmProvider": "OPENROUTER",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### `POST /api/auth/logout`
Invalidates the current session server-side (clears tokens).

**Auth:** Required  
**Response `200`**
```json
{ "success": true, "message": "Logged out successfully" }
```

---

## 3. Chat / AI Agent (`/api/chat`)

All chat endpoints require authentication.

### `GET /api/chat/conversations`
Returns all conversation sessions for the authenticated user, newest first.

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "cuid...",
      "title": "Morning summary",
      "createdAt": "2026-06-08T07:00:00.000Z",
      "updatedAt": "2026-06-08T08:30:00.000Z",
      "messageCount": 12
    }
  ]
}
```

---

### `POST /api/chat/conversations`
Create a new conversation.

**Body (optional)**
```json
{ "title": "Optional title" }
```

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "cuid...",
    "title": "New Conversation",
    "createdAt": "2026-06-08T08:00:00.000Z"
  }
}
```

---

### `GET /api/chat/conversations/:id`
Get full conversation including messages.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "cuid...",
    "title": "...",
    "messages": [
      { "id": "cuid...", "role": "user", "content": "Hi", "createdAt": "..." },
      { "id": "cuid...", "role": "assistant", "content": "Hello!", "createdAt": "..." }
    ]
  }
}
```

---

### `DELETE /api/chat/conversations/:id`
Delete a conversation and all its messages.

**Response `200`**
```json
{ "success": true, "message": "Conversation deleted" }
```

---

### `POST /api/chat/conversations/:id/messages`
Send a message to an existing conversation. The AI agent processes it using the user's configured LLM provider and may use tools (email, calendar, tasks).

**Body**
```json
{
  "content": "Summarise my emails from today"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "cuid...",
      "role": "assistant",
      "content": "You have 5 unread emails...",
      "createdAt": "..."
    },
    "conversationId": "cuid...",
    "toolsUsed": ["get_emails"],
    "tokensUsed": 512
  }
}
```

---

### `GET /api/chat/llm/health`
Check LLM provider availability.

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "provider": "openrouter",
      "available": true,
      "model": "google/gemini-flash-1.5",
      "latencyMs": 320
    },
    {
      "provider": "ollama",
      "available": true,
      "model": "llama3.2",
      "latencyMs": 45
    }
  ]
}
```

---

### `GET /api/chat/llm/models`
List all available models across configured providers.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "openrouter": [
      { "id": "google/gemini-flash-1.5", "name": "Gemini Flash 1.5", "provider": "openrouter" }
    ],
    "ollama": [
      { "id": "llama3.2", "name": "llama3.2", "provider": "ollama", "size": 2000000000 }
    ]
  }
}
```

---

## 4. Emails (`/api/emails`)

All endpoints require authentication and a valid Google OAuth token on file.

### `GET /api/emails`
Fetch recent emails (from Gmail, cached in DB).

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `maxResults` | number | 20 | Max emails to return |
| `pageToken` | string | – | Pagination token from previous response |
| `q` | string | – | Gmail search query (e.g. `from:boss@company.com`) |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "emails": [
      {
        "id": "gmail-msg-id",
        "threadId": "...",
        "subject": "Q2 Report",
        "from": "boss@company.com",
        "to": ["me@example.com"],
        "date": "2026-06-08T07:00:00.000Z",
        "snippet": "Please review the attached...",
        "isRead": false,
        "hasAttachments": true,
        "labels": ["INBOX"]
      }
    ],
    "nextPageToken": "...",
    "total": 142
  }
}
```

---

### `GET /api/emails/:id`
Fetch a single email with full body content.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "subject": "Q2 Report",
    "from": "boss@company.com",
    "body": "Please review the attached report...",
    "bodyHtml": "<p>Please review...</p>",
    "attachments": [{ "filename": "report.pdf", "mimeType": "application/pdf" }]
  }
}
```

---

### `POST /api/emails/:id/reply`
Send a reply to an email.

**Body**
```json
{
  "content": "Thanks, I'll review it today.",
  "sendAsHtml": false
}
```

**Response `200`**
```json
{ "success": true, "message": "Reply sent" }
```

---

### `PATCH /api/emails/:id/read`
Mark an email as read.

**Response `200`**
```json
{ "success": true, "message": "Marked as read" }
```

---

## 5. Calendar (`/api/calendar`)

### `GET /api/calendar/events`
Fetch calendar events from Google Calendar.

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `timeMin` | ISO string | today 00:00 | Events on or after this time |
| `timeMax` | ISO string | today+7 days | Events before this time |
| `maxResults` | number | 50 | Max events |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "google-event-id",
        "title": "Team Standup",
        "description": "Daily sync",
        "start": "2026-06-08T09:00:00+08:00",
        "end": "2026-06-08T09:30:00+08:00",
        "location": "Zoom",
        "attendees": [
          { "email": "colleague@company.com", "responseStatus": "accepted" }
        ],
        "isAllDay": false,
        "htmlLink": "https://calendar.google.com/..."
      }
    ]
  }
}
```

---

### `POST /api/calendar/events`
Create a new calendar event.

**Body**
```json
{
  "title": "Product Review",
  "description": "Review Q2 roadmap",
  "start": "2026-06-09T14:00:00+08:00",
  "end": "2026-06-09T15:00:00+08:00",
  "attendees": ["colleague@company.com"],
  "location": "Conference Room A"
}
```

**Response `201`**
```json
{
  "success": true,
  "data": { "id": "google-event-id", "htmlLink": "..." }
}
```

---

## 6. Tasks (`/api/tasks`)

Tasks are stored in the application database (not a third-party service).

### `GET /api/tasks`
List tasks for the authenticated user.

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `status` | `pending` \| `in_progress` \| `done` \| `all` | `all` | Filter by status |
| `priority` | `low` \| `medium` \| `high` | – | Filter by priority |

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "cuid...",
      "title": "Prepare Q2 report",
      "description": "Include revenue breakdown",
      "status": "pending",
      "priority": "high",
      "dueDate": "2026-06-10T00:00:00.000Z",
      "createdAt": "2026-06-08T08:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/tasks`
Create a new task.

**Body**
```json
{
  "title": "Prepare Q2 report",
  "description": "Include revenue breakdown",
  "priority": "high",
  "dueDate": "2026-06-10T00:00:00.000Z"
}
```

**Response `201`** – Returns the created task object.

---

### `GET /api/tasks/:id`
Get a single task by ID.

---

### `PUT /api/tasks/:id`
Replace a task (full update).

**Body** – Same fields as `POST /api/tasks`.

---

### `PATCH /api/tasks/:id`
Partial update (e.g. change status only).

**Body**
```json
{ "status": "done" }
```

**Response `200`** – Returns updated task.

---

### `DELETE /api/tasks/:id`
Delete a task.

**Response `200`**
```json
{ "success": true, "message": "Task deleted" }
```

---

## 7. Settings (`/api/settings`)

### `GET /api/settings`
Get the authenticated user's settings.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "llmProvider": "OPENROUTER",
    "llmSettings": {
      "model": "google/gemini-flash-1.5",
      "temperature": 0.7,
      "maxTokens": 4096
    },
    "hasOpenRouterKey": true,
    "hasGoogleTokens": true
  }
}
```

---

### `PUT /api/settings`
Update user settings.

**Body**
```json
{
  "llmProvider": "OLLAMA",
  "llmSettings": {
    "model": "llama3.2",
    "temperature": 0.5
  }
}
```

**Response `200`** – Returns updated settings.

---

### `PUT /api/settings/openrouter-key`
Store a personal OpenRouter API key (encrypted at rest).

**Body**
```json
{ "apiKey": "sk-or-v1-..." }
```

**Response `200`**
```json
{ "success": true, "message": "API key saved" }
```

---

### `DELETE /api/settings/openrouter-key`
Remove the stored personal OpenRouter API key (reverts to server default).

**Response `200`**
```json
{ "success": true, "message": "API key removed" }
```

---

## 8. Error Codes

| HTTP Status | Code | Description |
|---|---|---|
| `400` | `BAD_REQUEST` | Invalid request body or parameters |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT token |
| `403` | `FORBIDDEN` | Token valid but insufficient permissions |
| `404` | `NOT_FOUND` | Resource does not exist |
| `409` | `CONFLICT` | Resource already exists |
| `422` | `UNPROCESSABLE_ENTITY` | Validation failed |
| `429` | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server error |
| `503` | `SERVICE_UNAVAILABLE` | Downstream service (LLM, DB) unavailable |

**Error response shape**
```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { "field": "error detail" }
}
```

---

## Authentication

All endpoints except `/health`, `/health/detailed`, and `/api/auth/google*` require a valid JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are issued by `POST /api/auth/google/callback` and expire per the `JWT_EXPIRES_IN` environment variable (default: `7d`).
