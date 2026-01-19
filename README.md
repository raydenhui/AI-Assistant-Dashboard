# AI Personal Productivity Dashboard

An intelligent productivity dashboard that integrates Gmail and Google Calendar with AI-powered analysis for email prioritization, action item extraction, and daily briefing generation. Features a privacy-centric architecture supporting both cloud (OpenRouter) and local (Ollama) LLM providers.

## Features

### Core Functionality

- 📧 **Email Integration** - Connect with Gmail to view and manage emails
- 📅 **Calendar Integration** - Sync with Google Calendar for events and scheduling
- ✅ **Task Management** - Create, track, and complete action items
- 💬 **AI Chat Assistant** - Conversational interface for productivity assistance

### AI-Powered Features

- 🎯 **Email Prioritization** - AI analyzes and ranks emails by importance
- 📋 **Action Item Extraction** - Automatically identify tasks from emails
- 📊 **Daily Briefing** - AI-generated summary of your day
- 📝 **Meeting Preparation** - Generate prep notes for upcoming meetings
- ✉️ **Email Draft Suggestions** - AI-assisted email reply drafting
- ⏰ **Focus Time Analysis** - Identify optimal time blocks for deep work

### Privacy & Flexibility

- 🔒 **Privacy-Centric** - Choose between cloud or local LLM processing
- 🌐 **OpenRouter Support** - Access various cloud AI models
- 🏠 **Ollama Support** - Run AI locally for complete data privacy
- 🎨 **Dark Mode** - Light and dark theme support

## Tech Stack

- **Frontend**: React.js, TypeScript, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Google OAuth 2.0
- **AI**: OpenRouter API / Ollama (local)

## Prerequisites

- Node.js 18+
- Docker & Docker Compose (for PostgreSQL)
- Google Cloud Console project with Gmail and Calendar APIs enabled
- OpenRouter API key (for cloud LLM) or Ollama installed (for local LLM)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/AI-Assistant-Dashboard.git
cd AI-Assistant-Dashboard
```

### 2. Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# Required: DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
```

### 3. Start the Database

```bash
# Start PostgreSQL using Docker
docker-compose up -d postgres

# Optional: Start pgAdmin for database management
docker-compose --profile dev-tools up -d
```

### 4. Set Up the Backend

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:push

# Start the development server
npm run dev
```

The backend will be available at `http://localhost:3001`

### 5. Set Up the Frontend

```bash
# Navigate to client directory (from project root)
cd client

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Project Structure

```tree
AI-Assistant-Dashboard/
├── client/                     # Frontend React application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client services
│   │   ├── store/              # State management
│   │   ├── types/              # TypeScript types
│   │   └── utils/              # Utility functions
│   └── ...
│
├── server/                     # Backend Node.js application
│   ├── src/
│   │   ├── config/             # Configuration
│   │   ├── controllers/        # Route controllers
│   │   ├── middleware/         # Express middleware
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   │   ├── ai/             # AI agent & tools
│   │   │   ├── google/         # Gmail & Calendar
│   │   │   └── llm/            # LLM providers
│   │   ├── types/              # TypeScript types
│   │   └── app.ts              # Express app
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   └── ...
│
├── docker-compose.yml          # Docker services
├── .env.example                # Environment template
└── README.md
```

## API Endpoints

### Health Check

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with service status

### Authentication

- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/status` - Check auth status

### Chat

- `GET /api/chat/conversations` - List conversations
- `POST /api/chat/conversations` - Create conversation
- `POST /api/chat/conversations/:id/messages` - Send message

### Emails

- `GET /api/emails` - List emails
- `GET /api/emails/prioritized` - Get AI-prioritized emails
- `POST /api/emails/sync` - Sync from Gmail

### Calendar

- `GET /api/calendar/events` - List events
- `POST /api/calendar/events` - Create event
- `POST /api/calendar/sync` - Sync from Google Calendar

### Tasks

- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Settings

- `GET /api/settings` - Get user settings
- `PATCH /api/settings` - Update settings
- `GET /api/settings/llm/status` - Check LLM provider status

## Configuration

### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API and Google Calendar API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### LLM Provider Setup

#### OpenRouter (Cloud)

1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Generate an API key
3. Add to `.env`: `OPENROUTER_API_KEY=your-key`

#### Ollama (Local)

1. Install Ollama from [ollama.ai](https://ollama.ai/)
2. Pull a model: `ollama pull llama3.2`
3. Ensure Ollama is running on `http://localhost:11434`

## Development

### Available Scripts

#### Server

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
```

#### Client

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Database Management

```bash
# Open Prisma Studio (GUI for database)
cd server && npm run db:studio

# Or use pgAdmin
# Navigate to http://localhost:5050
# Login with credentials from .env
```

## Deployment

### Local Deployment

The application is configured to run locally by default. Ensure:

1. PostgreSQL is running (via Docker or locally)
2. Environment variables are set
3. Backend and frontend are started

### Production Deployment

1. Build both frontend and backend
2. Configure production environment variables
3. Set up PostgreSQL database
4. Deploy to your preferred hosting platform
