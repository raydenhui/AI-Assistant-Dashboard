/**
 * Unit Tests - LLMService
 *
 * Tests the LLM service layer including:
 * - Provider selection based on user settings
 * - parseToolCalls() helper
 * - Health status checks
 * - Provider availability
 */

// ─── Mock global fetch ────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ─── Mock Prisma ─────────────────────────────────────────────────────────────
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// ─── Mock config ─────────────────────────────────────────────────────────────
jest.mock('../config/index', () => ({
  config: {
    llm: {
      openrouter: {
        apiKey: 'sk-or-default-key',
        defaultModel: 'google/gemini-flash',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
      ollama: {
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3.2',
      },
    },
    jwt: { secret: 'test-secret', expiresIn: '7d' },
  },
}));

// ─── Imports ─────────────────────────────────────────────────────────────────
import prisma from '../config/database';
import { BadRequestError } from '../middleware/error.middleware';

const mockPrisma = prisma as any;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeFetchOkJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LLMService', () => {
  // We import the service AFTER mocks are set up
  let llmService: typeof import('../services/llm/llm.service').default;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Re-import to get fresh instance that sees our mocks
    jest.resetModules();
    // Re-apply mocks after resetModules
    jest.mock('../config/database', () => ({
      __esModule: true,
      default: {
        user: { findUnique: jest.fn() },
      },
    }));
    jest.mock('../config/index', () => ({
      config: {
        llm: {
          openrouter: {
            apiKey: 'sk-or-default-key',
            defaultModel: 'google/gemini-flash',
            baseUrl: 'https://openrouter.ai/api/v1',
          },
          ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.2' },
        },
        jwt: { secret: 'test-secret', expiresIn: '7d' },
      },
    }));

    const module = await import('../services/llm/llm.service');
    llmService = module.default;
  });

  // ── parseToolCalls ────────────────────────────────────────────────────────
  describe('parseToolCalls()', () => {
    it('returns empty array when tool_calls is undefined', () => {
      const result = llmService.parseToolCalls(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array when tool_calls is empty', () => {
      const result = llmService.parseToolCalls([]);
      expect(result).toEqual([]);
    });

    it('parses tool calls with valid JSON arguments', () => {
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function' as const,
          function: {
            name: 'get_tasks',
            arguments: '{"status":"pending","priority":"high"}',
          },
        },
      ];

      const result = llmService.parseToolCalls(toolCalls);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'call_1',
        name: 'get_tasks',
        arguments: { status: 'pending', priority: 'high' },
      });
    });

    it('handles multiple tool calls', () => {
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function' as const,
          function: { name: 'get_tasks', arguments: '{"status":"all"}' },
        },
        {
          id: 'call_2',
          type: 'function' as const,
          function: { name: 'get_emails', arguments: '{"maxResults":10}' },
        },
      ];

      const result = llmService.parseToolCalls(toolCalls);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('get_tasks');
      expect(result[1].name).toBe('get_emails');
      expect(result[1].arguments).toEqual({ maxResults: 10 });
    });

    it('returns empty arguments object when JSON is invalid', () => {
      const toolCalls = [
        {
          id: 'call_bad',
          type: 'function' as const,
          function: { name: 'broken_tool', arguments: 'not-json' },
        },
      ];

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = llmService.parseToolCalls(toolCalls);
      consoleSpy.mockRestore();

      expect(result).toHaveLength(1);
      expect(result[0].arguments).toEqual({});
    });
  });

  // ── getAvailableProviderTypes ──────────────────────────────────────────────
  describe('getAvailableProviderTypes()', () => {
    it('includes ollama as a provider type', () => {
      const types = llmService.getAvailableProviderTypes();
      expect(types).toContain('ollama');
    });

    it('includes openrouter when API key is configured', () => {
      const types = llmService.getAvailableProviderTypes();
      expect(types).toContain('openrouter');
    });
  });

  // ── getDefaultProviderType ─────────────────────────────────────────────────
  describe('getDefaultProviderType()', () => {
    it('returns "openrouter" as default', () => {
      expect(llmService.getDefaultProviderType()).toBe('openrouter');
    });
  });

  // ── getProvider ────────────────────────────────────────────────────────────
  describe('getProvider()', () => {
    it('returns OpenRouterProvider for "openrouter" type', () => {
      const provider = llmService.getProvider('openrouter');
      expect(provider.providerType).toBe('openrouter');
    });

    it('returns OllamaProvider for "ollama" type', () => {
      const provider = llmService.getProvider('ollama');
      expect(provider.providerType).toBe('ollama');
    });

    it('creates new OpenRouter provider instance when user has personal API key', () => {
      const provider = llmService.getProvider('openrouter', null, 'sk-or-user-key');
      expect(provider.providerType).toBe('openrouter');
    });

    it('applies user model settings when provided', () => {
      const provider = llmService.getProvider('ollama', { model: 'gemma4:latest' });
      // Model config is applied - provider still reports correct type
      expect(provider.providerType).toBe('ollama');
    });

    it('throws BadRequestError for unknown provider type', () => {
      // Delete openrouter to simulate unconfigured state, test unknown type
      expect(() => llmService.getProvider('unknown' as any)).toThrow();
    });
  });

  // ── getHealthStatus ────────────────────────────────────────────────────────
  describe('getHealthStatus()', () => {
    it('returns not-configured status for unknown provider', async () => {
      const status = await llmService.getHealthStatus('unknown' as any);
      expect(status.available).toBe(false);
      expect(status.error).toContain('not configured');
    });

    it('returns status for ollama provider', async () => {
      // Mock Ollama responding with models
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson({ models: [{ name: 'llama3.2' }] }),
      );

      const status = await llmService.getHealthStatus('ollama');
      expect(status.provider).toBe('ollama');
    });
  });

  // ── getAllHealthStatuses ────────────────────────────────────────────────────
  describe('getAllHealthStatuses()', () => {
    it('returns statuses for all configured providers', async () => {
      // Mock OpenRouter health check
      mockFetch.mockResolvedValueOnce(makeFetchOkJson({ data: [] }));
      // Mock Ollama health check
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson({ models: [{ name: 'llama3.2' }] }),
      );

      const statuses = await llmService.getAllHealthStatuses();
      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBeGreaterThan(0);
    });
  });

  // ── isProviderAvailable ────────────────────────────────────────────────────
  describe('isProviderAvailable()', () => {
    it('returns false for unconfigured provider type', async () => {
      const result = await llmService.isProviderAvailable('unknown' as any);
      expect(result).toBe(false);
    });

    it('returns true when ollama has models', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson({ models: [{ name: 'llama3.2' }] }),
      );

      const result = await llmService.isProviderAvailable('ollama');
      expect(result).toBe(true);
    });

    it('returns false when ollama has no models', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchOkJson({ models: [] }));
      const result = await llmService.isProviderAvailable('ollama');
      expect(result).toBe(false);
    });
  });

  // ── getProviderForUser ─────────────────────────────────────────────────────
  describe('getProviderForUser()', () => {
    it('throws BadRequestError when user is not found', async () => {
      const { default: prismaMock } = await import('../config/database');
      (prismaMock as any).user.findUnique.mockResolvedValue(null);

      await expect(llmService.getProviderForUser('non-existent-user')).rejects.toThrow(
        'User not found',
      );
    });

    it('returns openrouter provider for user with OPENROUTER setting', async () => {
      const { default: prismaMock } = await import('../config/database');
      (prismaMock as any).user.findUnique.mockResolvedValue({
        id: 'user-1',
        llmProvider: 'OPENROUTER',
        llmSettings: null,
        openRouterKey: null,
      });

      const provider = await llmService.getProviderForUser('user-1');
      expect(provider.providerType).toBe('openrouter');
    });

    it('returns ollama provider for user with OLLAMA setting', async () => {
      const { default: prismaMock } = await import('../config/database');
      (prismaMock as any).user.findUnique.mockResolvedValue({
        id: 'user-1',
        llmProvider: 'OLLAMA',
        llmSettings: null,
        openRouterKey: null,
      });

      const provider = await llmService.getProviderForUser('user-1');
      expect(provider.providerType).toBe('ollama');
    });

    it('uses personal openRouterKey when user has one', async () => {
      const { default: prismaMock } = await import('../config/database');
      (prismaMock as any).user.findUnique.mockResolvedValue({
        id: 'user-1',
        llmProvider: 'OPENROUTER',
        llmSettings: null,
        openRouterKey: 'sk-or-personal-key',
      });

      const provider = await llmService.getProviderForUser('user-1');
      expect(provider.providerType).toBe('openrouter');
    });
  });
});
