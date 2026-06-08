// Unit Tests - OllamaProvider
// Covers Bug Fixes #4 (resolveModel fallback), #5 (getHealthStatus), #6 (tool_call args)
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

jest.mock('../config/index', () => ({
  config: {
    llm: {
      ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.2' },
      openrouter: { apiKey: 'test-key', defaultModel: 'gpt-4', baseUrl: 'https://openrouter.ai/api/v1' },
    },
    jwt: { secret: 'test-secret', expiresIn: '7d' },
  },
}));

import { OllamaProvider } from '../services/llm/ollama.provider';

function makeOk(data: unknown) {
  return { ok: true, status: 200, json: jest.fn().mockResolvedValue(data), text: jest.fn().mockResolvedValue(JSON.stringify(data)) };
}

function makeErr(status: number, body: string) {
  return { ok: false, status, json: jest.fn().mockRejectedValue(new Error('not json')), text: jest.fn().mockResolvedValue(body) };
}

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OllamaProvider({ provider: 'ollama', model: 'llama3.2', baseUrl: 'http://localhost:11434' });
  });

  it('returns providerType ollama', () => {
    expect(provider.providerType).toBe('ollama');
  });

  describe('resolveModel - Bug Fix #4 auto-fallback', () => {
    it('uses configured model when installed', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOk({ models: [{ name: 'llama3.2' }] }))
        .mockResolvedValueOnce(makeOk({ message: { role: 'assistant', content: 'Hi' }, model: 'llama3.2', done: true }));
      await provider.chat({ messages: [{ role: 'user', content: 'Hi' }] });
      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.model).toBe('llama3.2');
    });

    it('falls back to first model when configured model not installed', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOk({ models: [{ name: 'gemma4:latest' }] }))
        .mockResolvedValueOnce(makeOk({ message: { role: 'assistant', content: 'Hi' }, model: 'gemma4:latest', done: true }));
      await provider.chat({ messages: [{ role: 'user', content: 'Hi' }] });
      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.model).toBe('gemma4:latest');
    });

    it('throws when no models are installed', async () => {
      mockFetch.mockResolvedValueOnce(makeOk({ models: [] }));
      await expect(provider.chat({ messages: [{ role: 'user', content: 'Hi' }] }))
        .rejects.toThrow(/No models are installed/);
    });
  });

  describe('formatMessages - Bug Fix #6 tool_call args as objects', () => {
    it('converts string tool_call arguments to objects before sending to Ollama', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOk({ models: [{ name: 'llama3.2' }] }))
        .mockResolvedValueOnce(makeOk({ message: { role: 'assistant', content: 'Done' }, model: 'llama3.2', done: true }));

      const jsonArgs = JSON.stringify({ status: 'pending' });
      await provider.chat({
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'fn', arguments: jsonArgs } }] },
          { role: 'tool', content: '[]', tool_call_id: 'c1' },
        ],
      });

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      const asst = body.messages.find((m: any) => m.role === 'assistant');
      expect(typeof asst.tool_calls[0].function.arguments).toBe('object');
      expect(asst.tool_calls[0].function.arguments).toEqual({ status: 'pending' });
    });
  });

  describe('getHealthStatus - Bug Fix #5', () => {
    it('returns available:true when models exist', async () => {
      mockFetch.mockResolvedValueOnce(makeOk({ models: [{ name: 'llama3.2' }] }));
      const s = await provider.getHealthStatus();
      expect(s.available).toBe(true);
    });

    it('returns available:false when no models installed', async () => {
      mockFetch.mockResolvedValueOnce(makeOk({ models: [] }));
      const s = await provider.getHealthStatus();
      expect(s.available).toBe(false);
    });

    it('returns available:false when Ollama not running', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const s = await provider.getHealthStatus();
      expect(s.available).toBe(false);
    });

    it('uses configured model as activeModel when installed', async () => {
      mockFetch.mockResolvedValueOnce(makeOk({ models: [{ name: 'llama3.2' }] }));
      const s = await provider.getHealthStatus();
      expect(s.model).toBe('llama3.2');
    });

    it('uses first model as activeModel when configured not installed', async () => {
      mockFetch.mockResolvedValueOnce(makeOk({ models: [{ name: 'gemma4:latest' }] }));
      const s = await provider.getHealthStatus();
      expect(s.model).toBe('gemma4:latest');
    });
  });

  describe('chat() response parsing', () => {
    it('returns text content', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOk({ models: [{ name: 'llama3.2' }] }))
        .mockResolvedValueOnce(makeOk({ message: { role: 'assistant', content: 'Hello!' }, model: 'llama3.2', done: true, done_reason: 'stop' }));
      const r = await provider.chat({ messages: [{ role: 'user', content: 'Hi' }] });
      expect(r.content).toBe('Hello!');
      expect(r.finish_reason).toBe('stop');
    });

    it('throws on 404', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOk({ models: [{ name: 'llama3.2' }] }))
        .mockResolvedValueOnce(makeErr(404, 'model not found'));
      await expect(provider.chat({ messages: [{ role: 'user', content: 'Hi' }] }))
        .rejects.toThrow(/not found/);
    });

    it('throws on 500', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOk({ models: [{ name: 'llama3.2' }] }))
        .mockResolvedValueOnce(makeErr(500, 'internal server error'));
      await expect(provider.chat({ messages: [{ role: 'user', content: 'Hi' }] }))
        .rejects.toThrow(/Ollama API error: 500/);
    });

    it('tracks token usage when eval counts provided', async () => {
      mockFetch
        .mockResolvedValueOnce(makeOk({ models: [{ name: 'llama3.2' }] }))
        .mockResolvedValueOnce(makeOk({
          message: { role: 'assistant', content: '...' },
          model: 'llama3.2',
          done: true,
          done_reason: 'length',
          prompt_eval_count: 10,
          eval_count: 50,
        }));
      const r = await provider.chat({ messages: [{ role: 'user', content: 'Hi' }] });
      expect(r.finish_reason).toBe('length');
      expect(r.usage?.total_tokens).toBe(60);
    });
  });

  describe('listModels()', () => {
    it('returns models from /api/tags', async () => {
      mockFetch.mockResolvedValueOnce(makeOk({
        models: [{ name: 'llama3.2', size: 1000, digest: 'abc', modified_at: '2026-01-01' }],
      }));
      const models = await provider.listModels();
      expect(models).toHaveLength(1);
      expect(models[0]).toMatchObject({ id: 'llama3.2', provider: 'ollama' });
    });
  });
});
