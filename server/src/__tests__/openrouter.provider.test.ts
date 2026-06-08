/**
 * Unit Tests - OpenRouterProvider
 *
 * Tests the OpenRouter LLM provider implementation including:
 * - Chat completions (non-streaming)
 * - Streaming responses  
 * - Health status checks
 * - Model listing
 * - API key handling (per-user keys, masked keys)
 * - Error handling
 */

// ─── Mock global fetch BEFORE any imports ────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ─── Mock config ─────────────────────────────────────────────────────────────
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

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import { OpenRouterProvider } from '../services/llm/openrouter.provider';
import { ChatMessage } from '../services/llm/llm.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchOkJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

function makeFetchError(status: number, errorBody: unknown) {
  return {
    ok: false,
    status,
    statusText: `Error ${status}`,
    json: jest.fn().mockResolvedValue(errorBody),
    text: jest.fn().mockResolvedValue(JSON.stringify(errorBody)),
  };
}

function makeOpenRouterChatResponse(content: string | null, toolCalls?: Array<{
  id: string;
  type: string;
  function: { name: string; arguments: string };
}>) {
  return {
    id: 'chatcmpl-test-123',
    model: 'google/gemini-flash',
    choices: [
      {
        message: {
          content,
          tool_calls: toolCalls,
        },
        finish_reason: toolCalls ? 'tool_calls' : 'stop',
      },
    ],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 100,
      total_tokens: 120,
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenRouterProvider({
      provider: 'openrouter',
      model: 'google/gemini-flash',
      apiKey: 'sk-or-test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
    });
  });

  // ── providerType ────────────────────────────────────────────────────────────
  describe('providerType', () => {
    it('should return "openrouter"', () => {
      expect(provider.providerType).toBe('openrouter');
    });
  });

  // ── Request headers ─────────────────────────────────────────────────────────
  describe('request headers', () => {
    it('includes Authorization header with API key', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(makeOpenRouterChatResponse('Hello')),
      );

      await provider.chat({ messages: [{ role: 'user', content: 'Hi' }] });

      const [_url, requestInit] = mockFetch.mock.calls[0];
      const headers = requestInit.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer sk-or-test-key');
    });

    it('strips non-ASCII characters from API key', async () => {
      const providerWithUnicode = new OpenRouterProvider({
        provider: 'openrouter',
        model: 'google/gemini-flash',
        apiKey: '•••sk-or-clean-key', // bullet points are non-ASCII
        baseUrl: 'https://openrouter.ai/api/v1',
      });

      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(makeOpenRouterChatResponse('Hello')),
      );

      await providerWithUnicode.chat({ messages: [{ role: 'user', content: 'Hi' }] });

      const [_url, requestInit] = mockFetch.mock.calls[0];
      const headers = requestInit.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer sk-or-clean-key');
    });

    it('includes HTTP-Referer and X-Title headers', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(makeOpenRouterChatResponse('Hello')),
      );

      await provider.chat({ messages: [{ role: 'user', content: 'Hi' }] });

      const [_url, requestInit] = mockFetch.mock.calls[0];
      const headers = requestInit.headers as Record<string, string>;
      expect(headers['HTTP-Referer']).toBeDefined();
      expect(headers['X-Title']).toBeDefined();
    });
  });

  // ── chat() ──────────────────────────────────────────────────────────────────
  describe('chat()', () => {
    it('returns content from a plain text response', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(makeOpenRouterChatResponse('Hello from OpenRouter!')),
      );

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.content).toBe('Hello from OpenRouter!');
      expect(result.finish_reason).toBe('stop');
      expect(result.tool_calls).toBeUndefined();
    });

    it('returns tool_calls when LLM requests function execution', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(
          makeOpenRouterChatResponse(null, [
            {
              id: 'call_abc',
              type: 'function',
              function: { name: 'get_tasks', arguments: '{"status":"pending"}' },
            },
          ]),
        ),
      );

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Get my tasks' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_tasks',
              description: 'Get tasks',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
      });

      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls![0].id).toBe('call_abc');
      expect(result.tool_calls![0].function.name).toBe('get_tasks');
      // OpenRouter returns arguments as JSON string - should stay as string
      expect(typeof result.tool_calls![0].function.arguments).toBe('string');
      expect(result.tool_calls![0].function.arguments).toBe('{"status":"pending"}');
      expect(result.finish_reason).toBe('tool_calls');
    });

    it('sends tools and tool_choice in request body', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(makeOpenRouterChatResponse('Done')),
      );

      const tool = {
        type: 'function' as const,
        function: {
          name: 'create_task',
          description: 'Create a task',
          parameters: {
            type: 'object' as const,
            properties: { title: { type: 'string' as const, description: 'Title' } },
            required: ['title'],
          },
        },
      };

      await provider.chat({
        messages: [{ role: 'user', content: 'Create task' }],
        tools: [tool],
        tool_choice: 'auto',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools).toBeDefined();
      expect(body.tools).toHaveLength(1);
      expect(body.tool_choice).toBe('auto');
    });

    it('includes usage information in response', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(makeOpenRouterChatResponse('Hello')),
      );

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.usage?.prompt_tokens).toBe(20);
      expect(result.usage?.completion_tokens).toBe(100);
      expect(result.usage?.total_tokens).toBe(120);
    });

    it('passes temperature and max_tokens to the API', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(makeOpenRouterChatResponse('Hello')),
      );

      await provider.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.2,
        max_tokens: 512,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.2);
      expect(body.max_tokens).toBe(512);
    });

    it('passes response_format to the API', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(makeOpenRouterChatResponse('{"key":"value"}')),
      );

      await provider.chat({
        messages: [{ role: 'user', content: 'Return JSON' }],
        response_format: { type: 'json_object' },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.response_format).toEqual({ type: 'json_object' });
    });

    it('throws an error when API returns non-OK status', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchError(401, { message: 'Invalid API key' }),
      );

      await expect(
        provider.chat({ messages: [{ role: 'user', content: 'Hi' }] }),
      ).rejects.toThrow(/OpenRouter API error: 401/);
    });

    it('preserves message roles including tool messages', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson(makeOpenRouterChatResponse('Task created')),
      );

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Create a task' },
        {
          role: 'assistant',
          content: null as unknown as string,
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'create_task', arguments: '{}' } },
          ],
        },
        { role: 'tool', content: '{"success":true}', tool_call_id: 'call_1' },
      ];

      await provider.chat({ messages });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(3);
      expect(body.messages[1].role).toBe('assistant');
      expect(body.messages[2].role).toBe('tool');
      expect(body.messages[2].tool_call_id).toBe('call_1');
    });
  });

  // ── getHealthStatus() ────────────────────────────────────────────────────────
  describe('getHealthStatus()', () => {
    it('returns available: true when /models responds OK', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchOkJson({ data: [] }));

      const status = await provider.getHealthStatus();

      expect(status.available).toBe(true);
      expect(status.provider).toBe('openrouter');
      expect(status.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns available: false when API returns non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: jest.fn(), text: jest.fn() });

      const status = await provider.getHealthStatus();

      expect(status.available).toBe(false);
      expect(status.error).toContain('401');
    });

    it('returns available: false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const status = await provider.getHealthStatus();

      expect(status.available).toBe(false);
      expect(status.error).toContain('Network error');
    });

    it('uses provided apiKey parameter instead of instance key', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchOkJson({ data: [] }));

      await provider.getHealthStatus('sk-or-custom-key');

      const [_url, requestInit] = mockFetch.mock.calls[0];
      const headers = requestInit.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer sk-or-custom-key');
    });
  });

  // ── isAvailable() ────────────────────────────────────────────────────────────
  describe('isAvailable()', () => {
    it('returns true when health status is available', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchOkJson({ data: [] }));
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when health status is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Offline'));
      expect(await provider.isAvailable()).toBe(false);
    });
  });

  // ── listModels() ─────────────────────────────────────────────────────────────
  describe('listModels()', () => {
    it('returns mapped models from /models endpoint', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchOkJson({
          data: [
            {
              id: 'google/gemini-flash',
              name: 'Gemini Flash',
              context_length: 1_000_000,
              pricing: { prompt: '0.000001', completion: '0.000002' },
            },
            {
              id: 'anthropic/claude-3-haiku',
              name: 'Claude 3 Haiku',
              context_length: 200_000,
            },
          ],
        }),
      );

      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models[0]).toMatchObject({
        id: 'google/gemini-flash',
        name: 'Gemini Flash',
        provider: 'openrouter',
        contextLength: 1_000_000,
      });
      expect(models[0].pricing).toEqual({ prompt: 0.000001, completion: 0.000002 });
      expect(models[1].pricing).toBeUndefined();
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: jest.fn() });

      await expect(provider.listModels()).rejects.toThrow(/Failed to list models: 403/);
    });
  });

  // ── chatStream() basic behavior ───────────────────────────────────────────────
  describe('chatStream()', () => {
    it('throws an error when API returns non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: jest.fn().mockResolvedValue({ message: 'Rate limit exceeded' }),
      });

      const stream = provider.chatStream({ messages: [{ role: 'user', content: 'Hi' }] });

      await expect(stream.next()).rejects.toThrow(/OpenRouter API error: 429/);
    });

    it('throws when response body is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
      });

      const stream = provider.chatStream({ messages: [{ role: 'user', content: 'Hi' }] });

      await expect(stream.next()).rejects.toThrow(/No response body/);
    });
  });
});
