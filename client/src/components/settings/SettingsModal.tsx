import { useState, useEffect, useCallback } from 'react';
import { Modal, ModalFooter, ModalButton } from '../common/Modal';
import { useAuthStore } from '../../store';
import { authApi } from '../../services/api';
import { toast } from '../common/Toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LLMStatus {
  openrouter: boolean;
  ollama: boolean;
}

const DEFAULT_MODELS = {
  openrouter: [
    'google/gemini-3-flash-preview',
    'google/gemini-3-pro-preview',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-haiku-4.5',
    'openai/gpt-5.2-chat',
    'openai/gpt-oss-120b',
  ],
  ollama: [
    'llama3.2',
    'llama3.1',
    'mistral',
    'mixtral',
    'codellama',
    'qwen2.5',
  ],
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, updateUser } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [llmStatus, setLLMStatus] = useState<LLMStatus>({ openrouter: false, ollama: false });
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [showOllamaHelp, setShowOllamaHelp] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>(DEFAULT_MODELS.ollama);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  
  const [formData, setFormData] = useState({
    provider: user?.llmProvider || 'openrouter',
    model: user?.llmModel || DEFAULT_MODELS.openrouter[0],
    openRouterKey: '',
    theme: (user?.theme || 'SYSTEM') as 'LIGHT' | 'DARK' | 'SYSTEM',
    timezone: user?.timezone || 'UTC',
  });

  const fetchOllamaModels = useCallback(async () => {
    setIsFetchingModels(true);
    try {
      const response = await fetch('/api/settings/llm/models?provider=ollama', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.models?.length > 0) {
          setOllamaModels(data.data.models);
        }
      }
    } catch {
      // Keep default models on error
    } finally {
      setIsFetchingModels(false);
    }
  }, []);

  const checkLLMStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const response = await fetch('/api/settings/llm/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Backend returns { success: true, data: { openrouter: bool, ollama: bool } }
        const statusData = data.data || data;
        const newStatus = {
          openrouter: statusData.openrouter || false,
          ollama: statusData.ollama || false,
        };
        setLLMStatus(newStatus);
        if (newStatus.ollama) {
          fetchOllamaModels();
        }
      }
    } catch {
      setLLMStatus({ openrouter: false, ollama: false });
    } finally {
      setIsCheckingStatus(false);
    }
  }, [fetchOllamaModels]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        provider: user.llmProvider,
        model: user.llmModel || DEFAULT_MODELS[user.llmProvider as keyof typeof DEFAULT_MODELS]?.[0] || '',
        openRouterKey: '', // Don't populate with the masked key from server
        theme: (user.theme || 'SYSTEM') as 'LIGHT' | 'DARK' | 'SYSTEM',
        timezone: user.timezone || 'UTC',
      });
      checkLLMStatus();
    }
  }, [isOpen, user, checkLLMStatus]);

  const getDefaultModel = (provider: 'openrouter' | 'ollama'): string => {
    if (provider === 'ollama') return ollamaModels[0] || DEFAULT_MODELS.ollama[0];
    return DEFAULT_MODELS[provider][0];
  };

  const handleProviderChange = (provider: 'openrouter' | 'ollama') => {
    setFormData((prev) => ({
      ...prev,
      provider,
      model: getDefaultModel(provider),
    }));
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, model: e.target.value }));
  };

  const handleThemeChange = (theme: 'LIGHT' | 'DARK' | 'SYSTEM') => {
    setFormData((prev) => ({ ...prev, theme }));
  };

  const handleDetectTimezone = () => {
    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setFormData((prev) => ({ ...prev, timezone: detectedTimezone }));
      toast.success(`Detected timezone: ${detectedTimezone}`);
    } catch (error) {
      toast.error('Failed to detect timezone');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      const updatedUser = await authApi.updateSettings({
        provider: formData.provider as 'openrouter' | 'ollama',
        model: formData.model,
        openRouterKey: formData.openRouterKey || '', // Send empty string if not provided to avoid 'undefined' check in api.ts
        theme: formData.theme,
        timezone: formData.timezone,
      });
      updateUser(updatedUser);
      toast.success('Settings saved successfully');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const models = formData.provider === 'openrouter' 
    ? DEFAULT_MODELS.openrouter 
    : ollamaModels;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="System Settings" size="2xl">
      <form onSubmit={handleSubmit} className="space-y-6 py-2">
        {/* Section: AI Configuration */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <i className="fas fa-robot text-xs"></i>
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Intelligence</h3>
            </div>
            <button
              type="button"
              onClick={() => checkLLMStatus()}
              disabled={isCheckingStatus}
              className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 hover:text-primary transition-colors disabled:opacity-50"
              title="Re-check connection status"
            >
              <i className={`fas fa-rotate-right text-[10px] ${isCheckingStatus ? 'fa-spin' : ''}`}></i>
              {isCheckingStatus ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* OpenRouter Option */}
            <div
              onClick={() => handleProviderChange('openrouter')}
              className={`
                group relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                ${formData.provider === 'openrouter'
                  ? 'border-primary bg-primary/[0.02] ring-4 ring-primary/5 dark:bg-primary/10'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/50'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                    ${formData.provider === 'openrouter' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400'}
                  `}>
                    <i className="fas fa-cloud text-lg"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">OpenRouter</h4>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400">Cloud-based AI</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {user?.llmProvider === 'openrouter' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-[8px] font-bold text-green-700 uppercase tracking-wider dark:bg-green-900/30 dark:text-green-400">
                      Active
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isCheckingStatus ? 'bg-yellow-400 animate-pulse' : llmStatus.openrouter ? 'bg-green-500' : 'bg-red-400'}`}></span>
                    <span className={`text-[8px] font-bold uppercase tracking-wider ${isCheckingStatus ? 'text-yellow-600' : llmStatus.openrouter ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {isCheckingStatus ? 'Checking' : llmStatus.openrouter ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-[8px] font-bold text-red-600 border border-red-100 uppercase tracking-wider dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">
                    Not Safe
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-red-500 font-medium flex items-start gap-1.5 dark:text-red-400">
                <i className="fas fa-shield-virus mt-0.5"></i>
                Warning: Data processed on external servers.
              </p>

              {formData.provider === 'openrouter' && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
                  <i className="fas fa-check text-[8px]"></i>
                </div>
              )}
            </div>

            {/* Ollama Option */}
            <div
              onClick={() => handleProviderChange('ollama')}
              className={`
                group relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                ${formData.provider === 'ollama'
                  ? 'border-primary bg-primary/[0.02] ring-4 ring-primary/5 dark:bg-primary/10'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/50'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                    ${formData.provider === 'ollama' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400'}
                  `}>
                    <i className="fas fa-server text-lg"></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">Ollama</h4>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400">Local AI</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {user?.llmProvider === 'ollama' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-[8px] font-bold text-green-700 uppercase tracking-wider dark:bg-green-900/30 dark:text-green-400">
                      Active
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${isCheckingStatus ? 'bg-yellow-400 animate-pulse' : llmStatus.ollama ? 'bg-green-500' : 'bg-red-400'}`}></span>
                    <span className={`text-[8px] font-bold uppercase tracking-wider ${isCheckingStatus ? 'text-yellow-600' : llmStatus.ollama ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {isCheckingStatus ? 'Checking' : llmStatus.ollama ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full bg-green-50 text-[8px] font-bold text-green-600 border border-green-100 uppercase tracking-wider dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30">
                    Recommended
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-green-600 font-medium flex items-start gap-1.5 dark:text-green-400">
                <i className="fas fa-lock mt-0.5"></i>
                100% Private: Data stays on this machine.
              </p>

              {formData.provider === 'ollama' && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
                  <i className="fas fa-check text-[8px]"></i>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section: Model & API Key */}
        <section className="bg-gray-50 rounded-xl p-4 border border-gray-100 dark:bg-slate-800/50 dark:border-slate-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="model" className="block text-xs font-bold text-gray-900 dark:text-white">
                  Model Selection
                </label>
                {formData.provider === 'ollama' && isFetchingModels && (
                  <span className="text-[9px] text-gray-400 flex items-center gap-1">
                    <i className="fas fa-circle-notch fa-spin text-[8px]"></i>
                    Fetching models...
                  </span>
                )}
              </div>
              <select
                id="model"
                value={formData.model}
                onChange={handleModelChange}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236B7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.8rem' }}
              >
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              {formData.provider === 'ollama' && llmStatus.ollama && (
                <p className="mt-1 text-[9px] text-green-600 dark:text-green-400 flex items-center gap-1">
                  <i className="fas fa-check-circle"></i>
                  {ollamaModels.length} model{ollamaModels.length !== 1 ? 's' : ''} found on your local Ollama instance
                </p>
              )}
            </div>

            {/* OpenRouter API Key */}
            {formData.provider === 'openrouter' && (
              <div>
                <label htmlFor="apiKey" className="block text-xs font-bold text-gray-900 mb-1.5 dark:text-white">
                  OpenRouter API Key
                </label>
                <div className="relative">
                  <input
                    id="apiKey"
                    type="password"
                    value={formData.openRouterKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, openRouterKey: e.target.value }))}
                    placeholder={user?.openRouterKey ? '••••••••••••••••' : 'Enter your API key'}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <i className="fas fa-key text-[10px]"></i>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ollama Connected Success */}
          {formData.provider === 'ollama' && llmStatus.ollama && !isCheckingStatus && (
            <div className="mt-2 p-3 rounded-xl bg-green-50 border border-green-100 dark:bg-green-900/10 dark:border-green-900/30">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0 dark:bg-green-900/30 dark:text-green-400">
                  <i className="fas fa-check text-xs"></i>
                </div>
                <div>
                  <p className="text-xs font-bold text-green-800 dark:text-green-300">Ollama Connected</p>
                  <p className="text-[10px] text-green-600 dark:text-green-400">
                    Your local Ollama instance is running at localhost:11434
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ollama Setup Guide */}
          {formData.provider === 'ollama' && !llmStatus.ollama && !isCheckingStatus && (
            <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 dark:bg-amber-900/30 dark:text-amber-400">
                  <i className="fas fa-plug text-sm"></i>
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-bold text-amber-900 mb-1 dark:text-amber-200">Ollama Connection Required</h5>
                  <p className="text-xs text-amber-700 mb-3 leading-relaxed dark:text-amber-400">
                    We couldn't detect Ollama running on your system. Please ensure it's installed and active.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowOllamaHelp(!showOllamaHelp)}
                    className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 transition-colors dark:text-amber-300 dark:hover:text-amber-200"
                  >
                    {showOllamaHelp ? 'Hide setup guide' : 'View setup instructions'}
                    <i className={`fas fa-chevron-${showOllamaHelp ? 'up' : 'down'} text-[10px]`}></i>
                  </button>
                  
                  {showOllamaHelp && (
                    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { step: 1, text: 'Download from ollama.ai', icon: 'fa-download' },
                          { step: 2, text: 'Launch the Ollama application', icon: 'fa-rocket' },
                          { step: 3, text: 'Run: ollama pull llama3.2', icon: 'fa-terminal' }
                        ].map((item) => (
                          <div key={item.step} className="flex items-center gap-3 bg-white/50 p-2 rounded-lg border border-amber-200/50 dark:bg-slate-800/50 dark:border-amber-900/20">
                            <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-center shrink-0 dark:bg-amber-900 dark:text-amber-200">
                              {item.step}
                            </span>
                            <span className="text-[11px] text-amber-800 font-medium dark:text-amber-200">{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section: Appearance & Preferences */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <i className="fas fa-palette text-xs"></i>
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Preferences</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-900 dark:text-slate-300">Interface Theme</label>
              <div className="flex p-1 bg-gray-100 rounded-lg border border-gray-200 dark:bg-slate-800 dark:border-slate-700">
                {(['LIGHT', 'DARK', 'SYSTEM'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleThemeChange(t)}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${formData.theme === t ? 'bg-white text-primary shadow-sm dark:bg-slate-700 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="timezone" className="block text-xs font-bold text-gray-900 dark:text-slate-300">Time Zone</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236B7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '0.8rem' }}
                  >
                    {(Intl as any).supportedValuesOf ? (
                      (Intl as any).supportedValuesOf('timeZone').map((tz: string) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))
                    ) : (
                      <option value={formData.timezone}>{formData.timezone}</option>
                    )}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleDetectTimezone}
                  className="px-2.5 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                  title="Detect my timezone"
                >
                  <i className="fas fa-location-crosshairs text-xs"></i>
                </button>
              </div>
            </div>
          </div>
        </section>

        <ModalFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-[11px] text-gray-400 italic dark:text-slate-500">
              Last updated: {user?.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Never'}
            </p>
            <div className="flex gap-3">
              <ModalButton type="button" variant="secondary" onClick={onClose} className="rounded-xl px-6">
                Cancel
              </ModalButton>
              <ModalButton type="submit" variant="primary" disabled={isSubmitting} className="rounded-xl px-8 shadow-lg shadow-primary/20">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-circle-notch fa-spin"></i>
                    Applying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <i className="fas fa-check-double"></i>
                    Save Changes
                  </span>
                )}
              </ModalButton>
            </div>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default SettingsModal;
