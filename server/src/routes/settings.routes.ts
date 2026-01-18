import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { llmService } from '../services/llm/index.js';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';

const router = Router();

// =============================================================================
// LLM Provider Status
// =============================================================================

/**
 * @route   GET /api/settings/llm/status
 * @desc    Check health status of LLM providers
 * @access  Private
 */
router.get('/llm/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Check OpenRouter status
    let openrouterStatus = false;
    try {
      const provider = llmService.getOpenRouterProvider();
      // Use user's key if available, otherwise fallback to config
      const userRecord = await prisma.user.findUnique({ where: { id: userId } }) as any;
      openrouterStatus = await provider.isAvailable(userRecord?.openRouterKey || config.llm.openrouter.apiKey);
    } catch (e) {
      console.error('OpenRouter status check failed:', e);
    }

    // Check Ollama status
    let ollamaStatus = false;
    try {
      const provider = llmService.getOllamaProvider();
      ollamaStatus = await provider.isAvailable();
    } catch (e) {
      console.error('Ollama status check failed:', e);
    }

    res.json({
      success: true,
      data: {
        openrouter: openrouterStatus,
        ollama: ollamaStatus,
      },
    });
  } catch (error) {
    console.error('LLM status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check LLM status',
    });
  }
});

/**
 * @route   GET /api/settings/llm/models
 * @desc    Get available models for a provider
 * @access  Private
 */
router.get('/llm/models', requireAuth, async (req: Request, res: Response) => {
  try {
    const { provider } = req.query as { provider?: string };
    
    if (!provider || !['openrouter', 'ollama'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Must be "openrouter" or "ollama"',
      });
    }

    let models: string[] = [];
    
    if (provider === 'ollama') {
      try {
        const ollamaProvider = llmService.getOllamaProvider();
        const modelInfos = await ollamaProvider.listModels();
        models = modelInfos.map(m => m.id);
      } catch {
        models = ['llama3.2', 'llama3.1', 'mistral', 'mixtral', 'codellama'];
      }
    } else {
      // OpenRouter - return popular models
      models = [
        'google/gemini-3-flash-preview',
        'google/gemini-3-pro-preview',
        'anthropic/claude-sonnet-4.5',
        'anthropic/claude-haiku-4.5',
        'openai/gpt-5.2-chat',
        'openai/gpt-oss-120b',
      ];
    }

    res.json({
      success: true,
      data: { provider, models },
    });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get models',
    });
  }
});

export default router;
