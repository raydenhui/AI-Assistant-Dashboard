import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import 'express-async-errors';

import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

// Create Express application
const app: Express = express();

// =============================================================================
// Middleware Configuration
// =============================================================================

// CORS configuration
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (config.isDevelopment) {
  app.use((req: Request, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// =============================================================================
// Health Check Endpoints
// =============================================================================

// Basic health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Detailed health check (includes database status)
app.get('/health/detailed', async (_req: Request, res: Response) => {
  const healthStatus = {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    services: {
      database: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
      openrouter: 'unknown' as 'healthy' | 'unhealthy' | 'unknown' | 'not_configured',
      ollama: 'unknown' as 'healthy' | 'unhealthy' | 'unknown',
    },
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check database connection
  try {
    const { prisma } = await import('./config/database.js');
    await prisma.$queryRaw`SELECT 1`;
    healthStatus.services.database = 'healthy';
  } catch {
    healthStatus.services.database = 'unhealthy';
    healthStatus.status = 'degraded';
  }

  // Check OpenRouter (if configured)
  if (config.llm.openrouter.apiKey) {
    try {
      const response = await fetch(`${config.llm.openrouter.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.llm.openrouter.apiKey}`,
        },
      });
      healthStatus.services.openrouter = response.ok ? 'healthy' : 'unhealthy';
    } catch {
      healthStatus.services.openrouter = 'unhealthy';
    }
  } else {
    healthStatus.services.openrouter = 'not_configured';
  }

  // Check Ollama
  try {
    const response = await fetch(`${config.llm.ollama.baseUrl}/api/tags`);
    healthStatus.services.ollama = response.ok ? 'healthy' : 'unhealthy';
  } catch {
    healthStatus.services.ollama = 'unhealthy';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// =============================================================================
// API Routes
// =============================================================================

// API version prefix
const API_PREFIX = '/api';

// Placeholder for routes (will be added in later phases)
app.get(`${API_PREFIX}`, (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'AI Dashboard API',
    version: '1.0.0',
    endpoints: {
      auth: `${API_PREFIX}/auth`,
      chat: `${API_PREFIX}/chat`,
      emails: `${API_PREFIX}/emails`,
      calendar: `${API_PREFIX}/calendar`,
      tasks: `${API_PREFIX}/tasks`,
      settings: `${API_PREFIX}/settings`,
    },
  });
});

// =============================================================================
// Error Handling
// =============================================================================

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// =============================================================================
// Server Startup
// =============================================================================

async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      console.log('🚀 Server started successfully');
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   Port: ${config.port}`);
      console.log(`   Health: http://localhost:${config.port}/health`);
      console.log(`   API: http://localhost:${config.port}/api`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📤 Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        console.log('   HTTP server closed');
        await disconnectDatabase();
        console.log('   Database disconnected');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
