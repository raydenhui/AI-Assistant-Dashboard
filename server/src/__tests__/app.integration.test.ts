// Integration Tests - Express App
// Tests the HTTP endpoints directly using supertest.
// All external dependencies (Prisma, fetch) are mocked.

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
    user: { findUnique: jest.fn() },
  },
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  disconnectDatabase: jest.fn().mockResolvedValue(undefined),
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
  },
}));

jest.mock('../config/index', () => ({
  config: {
    nodeEnv: 'test',
    isDevelopment: false,
    port: 3001,
    frontendUrl: 'http://localhost:5173',
    jwtSecret: 'test-secret',
    jwt: { secret: 'test-secret', expiresIn: '7d' },
    llm: {
      openrouter: {
        apiKey: 'test-openrouter-key',
        defaultModel: 'google/gemini-flash',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
      ollama: {
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3.2',
      },
    },
    google: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3001/api/auth/google/callback',
    },
  },
}));

import request from 'supertest';
import app from '../app';

function makeOkJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

describe('Express App - Health Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /health ─────────────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns 200 with healthy status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.environment).toBe('test');
    });

    it('returns JSON content type', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  // ── GET /health/detailed ────────────────────────────────────────────────────
  describe('GET /health/detailed', () => {
    it('returns 200 when all services are healthy', async () => {
      // Mock OpenRouter models endpoint
      mockFetch
        .mockResolvedValueOnce(makeOkJson({ data: [{ id: 'gpt-4' }] })) // OpenRouter
        .mockResolvedValueOnce(makeOkJson({ models: [{ name: 'llama3.2' }] })); // Ollama

      const res = await request(app).get('/health/detailed');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.services).toBeDefined();
      expect(res.body.services.database).toBe('healthy');
    });

    it('returns healthy status for OpenRouter when API key configured', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOkJson({ data: [] })) // OpenRouter OK
        .mockResolvedValueOnce(makeOkJson({ models: [] })); // Ollama OK but no models

      const res = await request(app).get('/health/detailed');

      expect(res.body.services.openrouter).toBe('healthy');
    });

    it('marks OpenRouter as unhealthy on API error', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401, json: jest.fn(), text: jest.fn() }) // OpenRouter error
        .mockResolvedValueOnce(makeOkJson({ models: [{ name: 'llama3.2' }] })); // Ollama OK

      const res = await request(app).get('/health/detailed');

      expect(res.body.services.openrouter).toBe('unhealthy');
    });

    it('marks OpenRouter as unhealthy on network error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED')) // OpenRouter down
        .mockResolvedValueOnce(makeOkJson({ models: [] })); // Ollama OK

      const res = await request(app).get('/health/detailed');

      expect(res.body.services.openrouter).toBe('unhealthy');
    });

    it('marks Ollama as unhealthy when not running', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOkJson({ data: [] })) // OpenRouter OK
        .mockRejectedValueOnce(new Error('ECONNREFUSED')); // Ollama down

      const res = await request(app).get('/health/detailed');

      expect(res.body.services.ollama).toBe('unhealthy');
    });

    it('marks Ollama as unhealthy on non-OK response', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOkJson({ data: [] })) // OpenRouter OK
        .mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn(), text: jest.fn() }); // Ollama 503

      const res = await request(app).get('/health/detailed');

      expect(res.body.services.ollama).toBe('unhealthy');
    });

    it('includes version field', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOkJson({ data: [] }))
        .mockResolvedValueOnce(makeOkJson({ models: [] }));

      const res = await request(app).get('/health/detailed');

      expect(res.body.version).toBeDefined();
    });

    it('returns 503 when database is unhealthy', async () => {
      const { prisma } = await import('../config/database');
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('DB connection failed'));

      mockFetch
        .mockResolvedValueOnce(makeOkJson({ data: [] }))
        .mockResolvedValueOnce(makeOkJson({ models: [] }));

      const res = await request(app).get('/health/detailed');

      expect(res.status).toBe(503);
      expect(res.body.services.database).toBe('unhealthy');
    });
  });

  // ── GET /api ────────────────────────────────────────────────────────────────
  describe('GET /api', () => {
    it('returns 200 with API info', async () => {
      const res = await request(app).get('/api');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('AI Dashboard API');
      expect(res.body.version).toBeDefined();
    });

    it('lists all expected endpoint groups', async () => {
      const res = await request(app).get('/api');

      expect(res.body.endpoints).toMatchObject({
        auth: expect.stringContaining('/auth'),
        chat: expect.stringContaining('/chat'),
        emails: expect.stringContaining('/emails'),
        calendar: expect.stringContaining('/calendar'),
        tasks: expect.stringContaining('/tasks'),
        settings: expect.stringContaining('/settings'),
      });
    });
  });

  // ── 404 Handling ────────────────────────────────────────────────────────────
  describe('404 Not Found handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/completely/unknown/route');

      expect(res.status).toBe(404);
    });

    it('returns JSON error body', async () => {
      const res = await request(app).get('/no-such-endpoint');

      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body.success).toBe(false);
    });
  });

  // ── CORS ────────────────────────────────────────────────────────────────────
  describe('CORS headers', () => {
    it('allows requests from configured frontend URL', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('responds to OPTIONS preflight', async () => {
      const res = await request(app)
        .options('/api')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBeLessThan(300);
    });
  });
});
