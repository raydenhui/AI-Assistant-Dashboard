# AI Personal Productivity Dashboard - Implementation Plan

## Project Overview

This document outlines the implementation plan for the AI Personal Productivity Dashboard, a web application that synthesizes digital communications and schedules using AI while ensuring user privacy through flexible LLM provider options.

### Key Requirements Summary
- **Tech Stack**: React.js (Frontend), Node.js/Express (Backend), PostgreSQL (Database)
- **LLM Providers**: OpenRouter (cloud) + Ollama (local) - user selectable
- **Integrations**: Google Gmail API, Google Calendar API
- **Authentication**: OAuth 2.0 for Google services
- **Deployment**: Local development with cloud deployment capability

---

## System Architecture

```mermaid
graph TB
    subgraph Frontend [Frontend - React.js]
        UI[Dashboard UI]
        Chat[Chat Interface]
        Widgets[Dashboard Widgets]
    end

    subgraph Backend [Backend - Node.js/Express]
        API[REST API Layer]
        Auth[Auth Service]
        LLMService[LLM Service]
        GoogleService[Google API Service]
        AIAgent[AI Agent]
    end

    subgraph LLMProviders [LLM Providers]
        OpenRouter[OpenRouter API]
        Ollama[Ollama Local]
    end

    subgraph External [External Services]
        Gmail[Gmail API]
        Calendar[Google Calendar API]
    end

    subgraph Database [PostgreSQL]
        Users[(Users)]
        Conversations[(Conversations)]
        Messages[(Messages)]
        Tasks[(Tasks)]
        Emails[(Cached Emails)]
        Events[(Cached Events)]
    end

    UI --> API
    Chat --> API
    Widgets --> API
    
    API --> Auth
    API --> LLMService
    API --> GoogleService
    API --> AIAgent
    
    LLMService --> OpenRouter
    LLMService --> Ollama
    
    GoogleService --> Gmail
    GoogleService --> Calendar
    
    Auth --> Users
    AIAgent --> Conversations
    AIAgent --> Messages
    AIAgent --> Tasks
    GoogleService --> Emails
    GoogleService --> Events
```

---

## Project Structure

```
AI-Assistant-Dashboard/
├── client/                     # Frontend React application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # Reusable UI components
│   │   │   ├── dashboard/      # Dashboard widgets
│   │   │   ├── chat/           # Chat interface components
│   │   │   └── layout/         # Header, sidebar, layout
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client services
│   │   ├── store/              # State management
│   │   ├── types/              # TypeScript types
│   │   ├── utils/              # Utility functions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── server/                     # Backend Node.js application
│   ├── src/
│   │   ├── config/             # Configuration files
│   │   │   ├── database.ts
│   │   │   ├── google.ts
│   │   │   └── llm.ts
│   │   ├── controllers/        # Route controllers
│   │   │   ├── auth.controller.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── email.controller.ts
│   │   │   ├── calendar.controller.ts
│   │   │   └── task.controller.ts
│   │   ├── services/           # Business logic
│   │   │   ├── llm/
│   │   │   │   ├── llm.service.ts        # LLM abstraction layer
│   │   │   │   ├── openrouter.provider.ts
│   │   │   │   └── ollama.provider.ts
│   │   │   ├── google/
│   │   │   │   ├── gmail.service.ts
│   │   │   │   └── calendar.service.ts
│   │   │   ├── ai/
│   │   │   │   ├── agent.service.ts      # AI agent orchestrator
│   │   │   │   ├── prompts.ts            # System prompts
│   │   │   │   └── tools.ts              # Function definitions
│   │   │   └── auth.service.ts
│   │   ├── models/             # Database models
│   │   │   ├── user.model.ts
│   │   │   ├── conversation.model.ts
│   │   │   ├── message.model.ts
│   │   │   ├── task.model.ts
│   │   │   ├── email.model.ts
│   │   │   └── event.model.ts
│   │   ├── routes/             # API routes
│   │   │   ├── auth.routes.ts
│   │   │   ├── chat.routes.ts
│   │   │   ├── email.routes.ts
│   │   │   ├── calendar.routes.ts
│   │   │   └── task.routes.ts
│   │   ├── middleware/         # Express middleware
│   │   │   ├── auth.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── utils/              # Utility functions
│   │   └── app.ts              # Express app setup
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── package.json
│   └── tsconfig.json
│
├── plans/                      # Documentation
├── .env.example
├── docker-compose.yml          # For PostgreSQL
└── README.md
```

---

## Database Schema

```mermaid
erDiagram
    User ||--o{ Conversation : has
    User ||--o{ Task : has
    User ||--o{ CachedEmail : has
    User ||--o{ CachedEvent : has
    Conversation ||--o{ Message : contains
    
    User {
        uuid id PK
        string email UK
        string name
        json google_tokens
        string llm_provider
        json llm_settings
        timestamp created_at
        timestamp updated_at
    }
    
    Conversation {
        uuid id PK
        uuid user_id FK
        string title
        timestamp created_at
        timestamp updated_at
    }
    
    Message {
        uuid id PK
        uuid conversation_id FK
        enum role
        text content
        json tool_calls
        json tool_results
        timestamp created_at
    }
    
    Task {
        uuid id PK
        uuid user_id FK
        string title
        text description
        string source
        string source_id
        enum status
        timestamp due_date
        enum priority
        timestamp created_at
        timestamp updated_at
    }
    
    CachedEmail {
        uuid id PK
        uuid user_id FK
        string gmail_id UK
        string thread_id
        string subject
        string sender
        text snippet
        text body
        json ai_analysis
        timestamp received_at
        timestamp cached_at
    }
    
    CachedEvent {
        uuid id PK
        uuid user_id FK
        string calendar_id UK
        string title
        text description
        timestamp start_time
        timestamp end_time
        string location
        json attendees
        json ai_analysis
        timestamp cached_at
    }
```

---

## Implementation Phases

### Phase 1: Backend Foundation - Project Setup and Database ✅ COMPLETE

**Objective**: Set up the Node.js backend project structure with TypeScript, Express, and PostgreSQL using Prisma ORM.

#### Tasks:
- [x] Initialize Node.js project with TypeScript configuration
- [x] Set up Express.js with middleware (CORS, body-parser, error handling)
- [x] Configure Prisma ORM with PostgreSQL
- [x] Create database schema (users, conversations, messages, tasks, cached_emails, cached_events)
- [x] Set up environment configuration (.env)
- [x] Create Docker Compose file for local PostgreSQL
- [x] Implement basic health check endpoint

#### Key Files to Create:
- [`server/package.json`](server/package.json) - Dependencies and scripts
- [`server/tsconfig.json`](server/tsconfig.json) - TypeScript configuration
- [`server/prisma/schema.prisma`](server/prisma/schema.prisma) - Database schema
- [`server/src/app.ts`](server/src/app.ts) - Express application setup
- [`server/src/config/database.ts`](server/src/config/database.ts) - Database connection
- [`docker-compose.yml`](docker-compose.yml) - PostgreSQL container

#### Dependencies:
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@prisma/client": "^5.x",
    "dotenv": "^16.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "prisma": "^5.x",
    "@types/express": "^4.x",
    "@types/cors": "^2.x",
    "tsx": "^4.x",
    "nodemon": "^3.x"
  }
}
```

---

### Phase 2: Backend - Authentication and Google OAuth Integration ✅ COMPLETE

**Objective**: Implement user authentication using Google OAuth 2.0 and session management.

#### Tasks:
- [x] Set up Google OAuth 2.0 flow (authorization URL generation, token exchange)
- [x] Implement token storage and refresh mechanism
- [x] Create authentication middleware for protected routes
- [x] Implement user creation/retrieval on successful OAuth
- [x] Set up JWT or session-based authentication for API requests
- [x] Create auth routes (login, callback, logout, status)

#### OAuth Flow:
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Google

    User->>Frontend: Click Login with Google
    Frontend->>Backend: GET /api/auth/google
    Backend->>Frontend: Redirect URL to Google
    Frontend->>Google: Redirect to consent screen
    User->>Google: Grant permissions
    Google->>Backend: Callback with auth code
    Backend->>Google: Exchange code for tokens
    Google->>Backend: Access + Refresh tokens
    Backend->>Backend: Store tokens, create/update user
    Backend->>Frontend: Redirect with session token
    Frontend->>User: Show dashboard
```

#### Key Files to Create:
- [`server/src/config/google.ts`](server/src/config/google.ts) - Google OAuth configuration
- [`server/src/services/auth.service.ts`](server/src/services/auth.service.ts) - Authentication logic
- [`server/src/controllers/auth.controller.ts`](server/src/controllers/auth.controller.ts) - Auth endpoints
- [`server/src/routes/auth.routes.ts`](server/src/routes/auth.routes.ts) - Auth routes
- [`server/src/middleware/auth.middleware.ts`](server/src/middleware/auth.middleware.ts) - JWT verification

#### Dependencies to Add:
```json
{
  "dependencies": {
    "googleapis": "^130.x",
    "jsonwebtoken": "^9.x"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.x"
  }
}
```

---

### Phase 3: Backend - LLM Provider Abstraction (OpenRouter + Ollama) ✅ COMPLETE

**Objective**: Create a flexible LLM service that supports both OpenRouter (cloud) and Ollama (local) providers with function calling capabilities.

#### Tasks:
- [x] Design LLM provider interface/abstraction
- [x] Implement OpenRouter provider with function calling support
- [x] Implement Ollama provider with function calling support (with bug fixes applied 2026-06-08)
- [x] Create LLM service that routes to appropriate provider based on user settings
- [x] Implement streaming response support
- [x] Add provider health check and fallback logic
- [x] Create settings endpoint for users to configure their LLM preference

> **Bug Fixes Applied (2026-06-08):** `OllamaProvider` was fixed to (1) auto-fallback to first available model if configured model not installed, (2) correctly report `available: true` in health status when any model is installed, and (3) serialize tool call arguments as plain objects (not JSON strings) for Ollama API compatibility. See `plans/progress-summary.md` for full details.

#### LLM Provider Architecture:
```mermaid
classDiagram
    class LLMProvider {
        <<interface>>
        +chat(messages, tools) Promise~LLMResponse~
        +chatStream(messages, tools) AsyncGenerator
        +isAvailable() Promise~boolean~
    }
    
    class OpenRouterProvider {
        -apiKey: string
        -baseUrl: string
        -model: string
        +chat(messages, tools) Promise~LLMResponse~
        +chatStream(messages, tools) AsyncGenerator
        +isAvailable() Promise~boolean~
    }
    
    class OllamaProvider {
        -baseUrl: string
        -model: string
        +chat(messages, tools) Promise~LLMResponse~
        +chatStream(messages, tools) AsyncGenerator
        +isAvailable() Promise~boolean~
    }
    
    class LLMService {
        -providers: Map~string, LLMProvider~
        -userSettings: UserLLMSettings
        +getProvider(userId) LLMProvider
        +chat(userId, messages, tools) Promise~LLMResponse~
        +chatStream(userId, messages, tools) AsyncGenerator
    }
    
    LLMProvider <|.. OpenRouterProvider
    LLMProvider <|.. OllamaProvider
    LLMService --> LLMProvider
```

#### Key Files to Create:
- [`server/src/services/llm/llm.types.ts`](server/src/services/llm/llm.types.ts) - Type definitions
- [`server/src/services/llm/llm.provider.ts`](server/src/services/llm/llm.provider.ts) - Provider interface
- [`server/src/services/llm/openrouter.provider.ts`](server/src/services/llm/openrouter.provider.ts) - OpenRouter implementation
- [`server/src/services/llm/ollama.provider.ts`](server/src/services/llm/ollama.provider.ts) - Ollama implementation
- [`server/src/services/llm/llm.service.ts`](server/src/services/llm/llm.service.ts) - Main LLM service
- [`server/src/config/llm.ts`](server/src/config/llm.ts) - LLM configuration

#### OpenRouter API Format:
```typescript
// OpenRouter uses OpenAI-compatible format
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-3-flash-preview',
    messages: [...],
    tools: [...],  // Function calling
    tool_choice: 'auto'
  })
});
```

---

### Phase 4: Backend - Google API Integration (Gmail + Calendar) ✅ COMPLETE

**Objective**: Implement services to fetch, cache, and manage Gmail and Google Calendar data.

#### Tasks:
- [x] Implement Gmail service (list emails, get email details, search)
- [x] Implement Calendar service (list events, get event details, create events)
- [x] Create email caching mechanism with incremental sync
- [x] Create calendar event caching mechanism
- [ ] Implement webhook/push notification setup for real-time updates (optional - skipped for MVP)
- [x] Create API endpoints for email and calendar data

#### Gmail Service Features:
- List recent emails with pagination
- Get full email content by ID
- Search emails by query
- Mark emails as read/unread
- Cache email metadata and AI analysis

#### Calendar Service Features:
- List upcoming events
- Get event details
- Create new events
- Update existing events
- Cache event data and AI analysis

#### Key Files to Create:
- [`server/src/services/google/gmail.service.ts`](server/src/services/google/gmail.service.ts) - Gmail operations
- [`server/src/services/google/calendar.service.ts`](server/src/services/google/calendar.service.ts) - Calendar operations
- [`server/src/controllers/email.controller.ts`](server/src/controllers/email.controller.ts) - Email endpoints
- [`server/src/controllers/calendar.controller.ts`](server/src/controllers/calendar.controller.ts) - Calendar endpoints
- [`server/src/routes/email.routes.ts`](server/src/routes/email.routes.ts) - Email routes
- [`server/src/routes/calendar.routes.ts`](server/src/routes/calendar.routes.ts) - Calendar routes

---

### Phase 5: Backend - AI Features (Prioritization, Action Extraction, Briefing) ✅ COMPLETE

**Objective**: Implement the AI agent with function calling capabilities for email prioritization, action item extraction, and daily briefing generation.

#### Tasks:
- [x] Design AI agent architecture with tool definitions
- [x] Implement email prioritization tool
- [x] Implement action item extraction tool
- [x] Implement daily briefing generation
- [x] Implement task management tools (create, update, complete, delete)
- [x] Create chat endpoint with conversation history
- [x] Implement SSE streaming responses (used instead of WebSocket)

#### AI Tools Definition:
```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_emails',
      description: 'Fetch recent emails from Gmail',
      parameters: {
        type: 'object',
        properties: {
          maxResults: { type: 'number', description: 'Maximum emails to fetch' },
          query: { type: 'string', description: 'Search query' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar_events',
      description: 'Fetch upcoming calendar events',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to look ahead' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task/action item',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task description' },
          dueDate: { type: 'string', description: 'Due date in ISO format' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update an existing task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
          title: { type: 'string' },
          dueDate: { type: 'string' }
        },
        required: ['taskId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'Get user tasks',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['all', 'pending', 'completed'] }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_email_priority',
      description: 'Analyze and prioritize emails',
      parameters: {
        type: 'object',
        properties: {
          emailIds: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Email IDs to analyze' 
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_daily_briefing',
      description: 'Generate a daily briefing summary',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
];
```

#### AI Agent Flow:
```mermaid
sequenceDiagram
    participant User
    participant ChatController
    participant AIAgent
    participant LLMService
    participant Tools
    participant Database

    User->>ChatController: Send message
    ChatController->>Database: Get conversation history
    ChatController->>AIAgent: Process message
    AIAgent->>LLMService: Send to LLM with tools
    LLMService-->>AIAgent: Tool call request
    AIAgent->>Tools: Execute tool
    Tools->>Database: Read/Write data
    Tools-->>AIAgent: Tool result
    AIAgent->>LLMService: Send tool result
    LLMService-->>AIAgent: Final response
    AIAgent->>Database: Save messages
    AIAgent-->>ChatController: Response
    ChatController-->>User: Stream response
```

#### Key Files to Create:
- [`server/src/services/ai/agent.service.ts`](server/src/services/ai/agent.service.ts) - AI agent orchestrator
- [`server/src/services/ai/tools.ts`](server/src/services/ai/tools.ts) - Tool definitions and handlers
- [`server/src/services/ai/prompts.ts`](server/src/services/ai/prompts.ts) - System prompts
- [`server/src/controllers/chat.controller.ts`](server/src/controllers/chat.controller.ts) - Chat endpoints
- [`server/src/controllers/task.controller.ts`](server/src/controllers/task.controller.ts) - Task endpoints
- [`server/src/routes/chat.routes.ts`](server/src/routes/chat.routes.ts) - Chat routes
- [`server/src/routes/task.routes.ts`](server/src/routes/task.routes.ts) - Task routes

---

### Phase 6: Frontend - React Application Setup and Core Components ✅ COMPLETE

**Objective**: Set up the React frontend with TypeScript, routing, state management, and core reusable components.

#### Tasks:
- [x] Initialize React project with Vite and TypeScript
- [x] Set up project structure and configuration
- [x] Configure React Router for navigation
- [x] Set up state management (Zustand - auth, tasks, chat stores)
- [x] Create API client service with authentication (with bug fixes applied 2026-06-08)
- [x] Implement core UI components (Modal, Toast, Skeleton loading, etc.)
- [x] Set up Tailwind CSS with custom theme
- [x] Create authentication flow (login page, protected routes, OAuth callback)

#### Key Files to Create:
- [`client/package.json`](client/package.json) - Dependencies
- [`client/vite.config.ts`](client/vite.config.ts) - Vite configuration
- [`client/src/main.tsx`](client/src/main.tsx) - Entry point
- [`client/src/App.tsx`](client/src/App.tsx) - Main app component
- [`client/src/services/api.ts`](client/src/services/api.ts) - API client
- [`client/src/store/auth.store.ts`](client/src/store/auth.store.ts) - Auth state
- [`client/src/components/common/`](client/src/components/common/) - Reusable components

#### Dependencies:
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "zustand": "^4.x",
    "axios": "^1.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x"
  }
}
```

---

### Phase 7: Frontend - Dashboard Widgets and Chat Interface ✅ COMPLETE

**Objective**: Implement the main dashboard UI with all widgets and the conversational AI chat interface.

#### Tasks:
- [x] Create main layout component (Header, Dashboard, Chat Panel)
- [x] Implement Prioritized Inbox widget (with polling, view-all modal, email detail view)
- [x] Implement Action Items / Tasks widget (with add task modal, bulk update)
- [x] Implement Upcoming Schedule widget (with view-all modal, "happening now" indicator)
- [x] Implement Chat interface with message history and conversation management
- [x] Add real-time updates via polling (1-5 min intervals per widget)
- [x] Implement SSE streaming response display for AI chat
- [x] Add loading states (skeleton), error handling, and toast notifications
- [x] Implement settings panel for LLM provider + model selection with live status indicators

#### Component Hierarchy:
```mermaid
graph TD
    App --> AuthProvider
    AuthProvider --> Router
    Router --> LoginPage
    Router --> DashboardPage
    
    DashboardPage --> Header
    DashboardPage --> MainContent
    
    MainContent --> DashboardPanel
    MainContent --> ChatPanel
    
    DashboardPanel --> InboxWidget
    DashboardPanel --> TasksWidget
    DashboardPanel --> ScheduleWidget
    
    InboxWidget --> EmailItem
    TasksWidget --> TaskItem
    ScheduleWidget --> EventItem
    
    ChatPanel --> ChatHeader
    ChatPanel --> ChatHistory
    ChatPanel --> ChatInput
    
    ChatHistory --> ChatMessage
```

#### Key Files to Create:
- [`client/src/components/layout/Header.tsx`](client/src/components/layout/Header.tsx)
- [`client/src/components/layout/DashboardLayout.tsx`](client/src/components/layout/DashboardLayout.tsx)
- [`client/src/components/dashboard/InboxWidget.tsx`](client/src/components/dashboard/InboxWidget.tsx)
- [`client/src/components/dashboard/TasksWidget.tsx`](client/src/components/dashboard/TasksWidget.tsx)
- [`client/src/components/dashboard/ScheduleWidget.tsx`](client/src/components/dashboard/ScheduleWidget.tsx)
- [`client/src/components/chat/ChatPanel.tsx`](client/src/components/chat/ChatPanel.tsx)
- [`client/src/components/chat/ChatMessage.tsx`](client/src/components/chat/ChatMessage.tsx)
- [`client/src/components/chat/ChatInput.tsx`](client/src/components/chat/ChatInput.tsx)
- [`client/src/pages/DashboardPage.tsx`](client/src/pages/DashboardPage.tsx)
- [`client/src/pages/LoginPage.tsx`](client/src/pages/LoginPage.tsx)

---

### Phase 8: Integration Testing and Deployment Preparation

**Objective**: Ensure all components work together and prepare for deployment.

#### Tasks:
- [ ] Write unit tests for critical backend services
- [ ] Write integration tests for API endpoints
- [ ] Write component tests for React components
- [ ] End-to-end testing of complete user flows
- [ ] Create production build configuration
- [ ] Write deployment documentation
- [ ] Create environment variable templates
- [ ] Test local deployment with Docker Compose
- [ ] Document API endpoints

#### Testing Strategy:
- **Backend Unit Tests**: Jest for services and utilities
- **Backend Integration Tests**: Supertest for API routes
- **Frontend Component Tests**: React Testing Library
- **E2E Tests**: Playwright or Cypress (optional)

#### Key Files to Create:
- [`server/src/__tests__/`](server/src/__tests__/) - Backend tests
- [`client/src/__tests__/`](client/src/__tests__/) - Frontend tests
- [`docker-compose.prod.yml`](docker-compose.prod.yml) - Production Docker setup
- [`.env.example`](.env.example) - Environment template
- [`docs/API.md`](docs/API.md) - API documentation

---

## API Endpoints Summary

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/status` | Check auth status |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/conversations` | List conversations |
| POST | `/api/chat/conversations` | Create conversation |
| GET | `/api/chat/conversations/:id` | Get conversation |
| POST | `/api/chat/conversations/:id/messages` | Send message |
| DELETE | `/api/chat/conversations/:id` | Delete conversation |

### Emails
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/emails` | List emails |
| GET | `/api/emails/:id` | Get email details |
| POST | `/api/emails/sync` | Sync emails from Gmail |
| GET | `/api/emails/prioritized` | Get AI-prioritized emails |

### Calendar
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calendar/events` | List events |
| GET | `/api/calendar/events/:id` | Get event details |
| POST | `/api/calendar/events` | Create event |
| POST | `/api/calendar/sync` | Sync from Google Calendar |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get user settings |
| PATCH | `/api/settings` | Update settings |
| GET | `/api/settings/llm/status` | Check LLM provider status |

---

## Environment Variables

```env
# Server
PORT=3002
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_dashboard

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3002/api/auth/google/callback

# JWT
JWT_SECRET=your_jwt_secret

# LLM Providers
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_DEFAULT_MODEL=google/gemini-3-flash-preview
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.2

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

---

## Enhanced Features (Value-Added)

Based on best practices and user experience considerations, the following enhancements are included in the implementation:

### 1. Email Threading Support
Group related emails into conversation threads for better context understanding.
- Thread ID tracking from Gmail API
- Collapsed/expanded thread view in UI
- AI analysis considers full thread context

### 2. Meeting Preparation Briefs
AI-generated preparation notes before calendar events.
- Auto-generated when viewing upcoming meetings
- Includes relevant emails, past meeting notes, attendee information
- Action items from previous related meetings

### 3. Smart Email Draft Suggestions
AI can help draft email responses based on context.
- New AI tool: `draft_email_reply`
- Considers email thread history
- User can edit before sending (read-only for MVP - no send capability)

### 4. Calendar Conflict Detection
Automatic detection of scheduling conflicts.
- Overlapping events highlighted
- AI warns about back-to-back meetings
- Suggests optimal meeting times

### 5. Focus Time Insights
AI suggests optimal times for deep work.
- Analyzes calendar patterns
- Identifies meeting-free blocks
- Suggests protecting focus time

### 6. Dark Mode Support
User preference for light/dark theme.
- CSS variables for easy theming
- System preference detection
- Persisted user preference

### 7. Keyboard Shortcuts
Power user features for efficiency.
- `Ctrl/Cmd + K` - Quick command palette
- `Ctrl/Cmd + N` - New chat
- `Ctrl/Cmd + /` - Show shortcuts help

### 8. Activity Insights Dashboard
Productivity metrics and patterns.
- Tasks completed over time
- Email response patterns
- Meeting load visualization

### 9. Conversation Context Management
Smart handling of long conversations.
- Automatic summarization of old messages
- Context window optimization
- Conversation branching support

### 10. Data Export
User data sovereignty features.
- Export conversations as JSON/Markdown
- Export tasks as CSV
- Full data download option

---

## Updated AI Tools (Complete List)

```typescript
const tools = [
  // Data Retrieval Tools
  {
    type: 'function',
    function: {
      name: 'get_emails',
      description: 'Fetch recent emails from Gmail with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          maxResults: { type: 'number', description: 'Maximum emails to fetch - default: 20' },
          query: { type: 'string', description: 'Gmail search query' },
          includeThreads: { type: 'boolean', description: 'Include full thread context' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_email_details',
      description: 'Get full details of a specific email including body',
      parameters: {
        type: 'object',
        properties: {
          emailId: { type: 'string', description: 'Gmail message ID' }
        },
        required: ['emailId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar_events',
      description: 'Fetch upcoming calendar events',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to look ahead - default: 7' },
          includeDeclined: { type: 'boolean', description: 'Include declined events' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_event_details',
      description: 'Get full details of a calendar event',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Calendar event ID' }
        },
        required: ['eventId']
      }
    }
  },
  
  // Task Management Tools
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: 'Get user tasks with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['all', 'pending', 'in_progress', 'completed'] },
          priority: { type: 'string', enum: ['all', 'low', 'medium', 'high'] },
          dueBefore: { type: 'string', description: 'Filter tasks due before this date - ISO format' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task or action item',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Detailed description' },
          dueDate: { type: 'string', description: 'Due date in ISO format' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          source: { type: 'string', description: 'Source of the task - e.g. email ID or chat' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update an existing task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID to update' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
          dueDate: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        required: ['taskId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID to delete' }
        },
        required: ['taskId']
      }
    }
  },
  
  // AI Analysis Tools
  {
    type: 'function',
    function: {
      name: 'analyze_email_priority',
      description: 'Analyze emails and assign priority levels based on urgency and importance',
      parameters: {
        type: 'object',
        properties: {
          emailIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email IDs to analyze - analyzes all recent if empty'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_action_items',
      description: 'Extract action items from emails or text',
      parameters: {
        type: 'object',
        properties: {
          emailIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email IDs to extract actions from'
          },
          text: { type: 'string', description: 'Or provide raw text to analyze' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_daily_briefing',
      description: 'Generate a comprehensive daily briefing with priorities, schedule, and action items',
      parameters: {
        type: 'object',
        properties: {
          includeEmailSummary: { type: 'boolean', description: 'Include email summary - default: true' },
          includeCalendar: { type: 'boolean', description: 'Include calendar events - default: true' },
          includeTasks: { type: 'boolean', description: 'Include pending tasks - default: true' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'prepare_meeting_brief',
      description: 'Generate preparation notes for an upcoming meeting',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Calendar event ID' }
        },
        required: ['eventId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'draft_email_reply',
      description: 'Draft a reply to an email based on context and user intent',
      parameters: {
        type: 'object',
        properties: {
          emailId: { type: 'string', description: 'Email ID to reply to' },
          intent: { type: 'string', description: 'What the user wants to convey' },
          tone: { type: 'string', enum: ['formal', 'casual', 'friendly'], description: 'Desired tone' }
        },
        required: ['emailId', 'intent']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'find_focus_time',
      description: 'Analyze calendar and suggest optimal focus time blocks',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Days to analyze - default: 5' },
          minBlockMinutes: { type: 'number', description: 'Minimum focus block duration - default: 60' }
        }
      }
    }
  },
  
  // Calendar Management Tools
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create a new calendar event',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          description: { type: 'string', description: 'Event description' },
          startTime: { type: 'string', description: 'Start time in ISO format' },
          endTime: { type: 'string', description: 'End time in ISO format' },
          location: { type: 'string', description: 'Event location' },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email addresses of attendees'
          }
        },
        required: ['title', 'startTime', 'endTime']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_calendar_conflicts',
      description: 'Check for scheduling conflicts in a time range',
      parameters: {
        type: 'object',
        properties: {
          startTime: { type: 'string', description: 'Start of range - ISO format' },
          endTime: { type: 'string', description: 'End of range - ISO format' }
        },
        required: ['startTime', 'endTime']
      }
    }
  }
];
```

---

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| Google API rate limits | Implement caching and incremental sync |
| LLM provider downtime | Provider abstraction allows fallback |
| Token expiration | Automatic token refresh mechanism |
| Large email volumes | Pagination and lazy loading |
| Context window limits | Conversation summarization |
| Network failures | Retry logic with exponential backoff |
| Data consistency | Database transactions for critical operations |

---

## Success Metrics

The implementation success will be measured by:

1. **Functional Completeness**: All 8 phases implemented and working
2. **AI Accuracy**: Email prioritization and action extraction quality
3. **Performance**: Dashboard loads in under 2 seconds, AI responses start streaming within 3 seconds
4. **Reliability**: Graceful handling of API failures and edge cases
5. **User Experience**: Intuitive UI matching the design mockup

---

## Current Status (2026-06-08)

**Phases 1–7 are complete.** The application is fully functional end-to-end with both OpenRouter (cloud) and Ollama (local) LLM providers.

### Next Step: Phase 8 — Testing & Deployment

Priority items for Phase 8:
1. **Unit tests** for `OllamaProvider` tool message formatting
2. **Integration tests** for the `/api/chat/messages` endpoint (with mocked LLM)
3. **Component tests** for `ChatPanel`, `SettingsModal`, and `InboxWidget`
4. **Update `OLLAMA_DEFAULT_MODEL`** in `.env` to `gemma4:latest` (or whichever model is locally installed)
5. **Production build** configuration and Docker Compose cleanup
6. **API documentation** update (`docs/API.md`)
