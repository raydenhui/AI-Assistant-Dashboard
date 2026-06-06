import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root project folder
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Environment validation schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3002'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.string().url('GOOGLE_REDIRECT_URI must be a valid URL'),
  
  // LLM Providers
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_DEFAULT_MODEL: z.string().default('google/gemini-3-flash-preview'),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_DEFAULT_MODEL: z.string().default('llama3.2'),
  
  // Frontend URL (for CORS)
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  // Optional: Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`);
      console.error('❌ Environment validation failed:');
      console.error(missingVars.join('\n'));
      process.exit(1);
    }
    throw error;
  }
};

const env = parseEnv();

// Export typed configuration object
export const config = {
  // Server
  nodeEnv: env.NODE_ENV,
  port: parseInt(env.PORT, 10),
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // Database
  databaseUrl: env.DATABASE_URL,
  
  // JWT
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  
  // Google OAuth
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  },
  
  // LLM Providers
  llm: {
    openrouter: {
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: env.OPENROUTER_BASE_URL,
      defaultModel: env.OPENROUTER_DEFAULT_MODEL,
    },
    ollama: {
      baseUrl: env.OLLAMA_BASE_URL,
      defaultModel: env.OLLAMA_DEFAULT_MODEL,
    },
  },
  
  // CORS
  frontendUrl: env.FRONTEND_URL,
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10),
  },
} as const;

export type Config = typeof config;
