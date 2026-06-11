import React from 'react';
import { Play, Copy, RefreshCw } from 'lucide-react';
import { runPlaygroundPrompt, MessageTemplate } from '../services/api';

interface PlaygroundProps {
  requiredVariables: string[];
  playgroundVariables: Record<string, string>;
  setPlaygroundVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  compiledMessages: MessageTemplate[];
  onCopyTranscript: () => void;
  activePrompt?: {
    parameters?: {
      temperature?: number;
      maxTokens?: number;
    };
  } | null;
}

const PlaygroundVariables = React.memo(function PlaygroundVariables({
  requiredVariables,
  playgroundVariables,
  setPlaygroundVariables
}: {
  requiredVariables: string[];
  playgroundVariables: Record<string, string>;
  setPlaygroundVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="p-4 border-b border-slate-800/60 flex flex-col gap-4 max-h-[220px] overflow-y-auto shrink-0 bg-[#060a11]/40">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Playground Parameters</span>
      
      {requiredVariables.length === 0 ? (
        <span className="text-[10px] text-slate-600 text-center py-2">
          Define variables on the left canvas to populate playground fields.
        </span>
      ) : (
        <div className="space-y-3">
          {requiredVariables.map((v) => (
            <div key={v}>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">{v}</label>
              <input
                type="text"
                value={playgroundVariables[v] || ''}
                onChange={(e) => setPlaygroundVariables(prev => ({
                  ...prev,
                  [v]: e.target.value
                }))}
                placeholder={`Enter test value for ${v}...`}
                className="w-full px-3 py-1.5 bg-[#0a0d16] border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

interface PlaygroundSettingsProps {
  provider: 'google' | 'openai' | 'anthropic';
  setProvider: (p: 'google' | 'openai' | 'anthropic') => void;
  model: string;
  setModel: (m: string) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  isRunning: boolean;
  onRun: () => void;
  compiledMessages: MessageTemplate[];
}

const PlaygroundSettings = React.memo(function PlaygroundSettings({
  provider,
  setProvider,
  model,
  setModel,
  apiKey,
  setApiKey,
  isRunning,
  onRun,
  compiledMessages
}: PlaygroundSettingsProps) {
  const modelPresets = {
    google: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  };

  const handleProviderChange = (newProvider: 'google' | 'openai' | 'anthropic') => {
    setProvider(newProvider);
    localStorage.setItem('playground_provider', newProvider);
  };

  return (
    <div className="p-4 border-b border-slate-800/60 flex flex-col gap-3 shrink-0 bg-[#060a11]/40">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Model Settings</span>
      
      <div className="space-y-3">
        {/* Provider */}
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as any)}
            className="w-full px-3 py-1.5 bg-[#0a0d16] border border-slate-850 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="google">Google Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>

        {/* Model Select / Input */}
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Model Name</label>
          <div className="flex flex-col gap-2">
            <select
              value={modelPresets[provider].includes(model) ? model : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  setModel(e.target.value);
                } else {
                  setModel('');
                }
              }}
              className="w-full px-3 py-1.5 bg-[#0a0d16] border border-slate-850 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {modelPresets[provider].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
            {(!modelPresets[provider].includes(model) || model === '') && (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Custom model name..."
                className="w-full px-3 py-1.5 bg-[#0a0d16] border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`Enter ${provider === 'google' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key...`}
            className="w-full px-3 py-1.5 bg-[#0a0d16] border border-slate-850 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Run Button */}
        <button
          onClick={onRun}
          disabled={isRunning || !apiKey || compiledMessages.length === 0}
          className={`w-full py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            isRunning 
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
              : !apiKey || compiledMessages.length === 0
                ? 'bg-indigo-950/20 text-indigo-400/40 border border-indigo-900/30 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="animate-spin" size={13} />
              Running Prompt...
            </>
          ) : (
            <>
              <Play size={13} fill="currentColor" />
              Run Prompt
            </>
          )}
        </button>
      </div>
    </div>
  );
});

const CompiledTranscript = React.memo(function CompiledTranscript({
  compiledMessages,
  onCopyTranscript,
  responseStream,
  isRunning,
  runError
}: {
  compiledMessages: MessageTemplate[];
  onCopyTranscript: () => void;
  responseStream: string;
  isRunning: boolean;
  runError: string | null;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 bg-[#080c14] border-b border-slate-800/40 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Compiled Chat Transcript</span>
        <button
          onClick={onCopyTranscript}
          className="text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-slate-900 cursor-pointer"
          title="Copy compiled output"
        >
          <Copy size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#05080e]/40">
        {compiledMessages.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-xs">
            No messages defined to compile.
          </div>
        ) : (
          compiledMessages.map((msg, i) => (
            <div key={i} className="space-y-1">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                msg.role === 'system' ? 'text-indigo-400 bg-indigo-950/20 border-indigo-900/30' :
                msg.role === 'user' ? 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30' :
                'text-amber-400 bg-amber-950/20 border-amber-900/30'
              }`}>
                {msg.role}
              </span>
              <div className={`p-3 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed border ${
                msg.role === 'system' ? 'bg-[#0f1325]/45 border-slate-850' : 
                msg.role === 'user' ? 'bg-[#0b1b17]/45 border-slate-850' : 
                'bg-[#191510]/45 border-slate-850'
              }`}>
                {msg.content || <span className="text-slate-600 italic">Empty block content</span>}
              </div>
            </div>
          ))
        )}

        {(responseStream || isRunning || runError) && (
          <div className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border text-indigo-400 bg-indigo-950/20 border-indigo-900/30">
              Model Response
            </span>
            <div className="p-3 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed border bg-[#0f1325]/45 border-slate-850">
              {responseStream}
              {isRunning && <span className="animate-pulse text-indigo-400">▍</span>}
              {runError && (
                <div className="mt-2 text-rose-400 font-semibold border-t border-rose-950/50 pt-2 text-[11px]">
                  Error: {runError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export const Playground = React.memo(function Playground({
  requiredVariables,
  playgroundVariables,
  setPlaygroundVariables,
  compiledMessages,
  onCopyTranscript,
  activePrompt
}: PlaygroundProps) {
  const [provider, setProvider] = React.useState<'google' | 'openai' | 'anthropic'>(() => {
    return (localStorage.getItem('playground_provider') as any) || 'google';
  });
  
  const [model, setModel] = React.useState<string>('');
  const [apiKey, setApiKey] = React.useState<string>('');

  React.useEffect(() => {
    const savedModel = localStorage.getItem(`playground_model_${provider}`) || (
      provider === 'google' ? 'gemini-1.5-flash' :
      provider === 'openai' ? 'gpt-4o' :
      'claude-3-5-sonnet-20241022'
    );
    setModel(savedModel);

    const savedKey = localStorage.getItem(`playground_api_key_${provider}`) || '';
    setApiKey(savedKey);
  }, [provider]);

  const handleModelChange = React.useCallback((m: string) => {
    setModel(m);
    localStorage.setItem(`playground_model_${provider}`, m);
  }, [provider]);

  const handleApiKeyChange = React.useCallback((k: string) => {
    setApiKey(k);
    localStorage.setItem(`playground_api_key_${provider}`, k);
  }, [provider]);

  const [responseStream, setResponseStream] = React.useState<string>('');
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [runError, setRunError] = React.useState<string | null>(null);

  const handleRun = React.useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setResponseStream('');
    setRunError(null);

    runPlaygroundPrompt(
      {
        provider,
        apiKey,
        model,
        messages: compiledMessages,
        parameters: {
          temperature: activePrompt?.parameters?.temperature,
          maxTokens: activePrompt?.parameters?.maxTokens
        }
      },
      (chunk) => {
        setResponseStream(prev => prev + chunk);
      },
      () => {
        setIsRunning(false);
      },
      (err) => {
        setRunError(err.message || 'An error occurred during execution');
        setIsRunning(false);
      }
    );
  }, [provider, apiKey, model, compiledMessages, activePrompt, isRunning]);

  return (
    <aside className="w-[380px] border-l border-slate-800/80 bg-[#090d16]/80 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
          <Play size={13} />
          Live Playground
        </div>
        <span className="text-[10px] text-slate-500">Local Rendering Sandbox</span>
      </div>

      <PlaygroundVariables
        requiredVariables={requiredVariables}
        playgroundVariables={playgroundVariables}
        setPlaygroundVariables={setPlaygroundVariables}
      />

      <PlaygroundSettings
        provider={provider}
        setProvider={setProvider}
        model={model}
        setModel={handleModelChange}
        apiKey={apiKey}
        setApiKey={handleApiKeyChange}
        isRunning={isRunning}
        onRun={handleRun}
        compiledMessages={compiledMessages}
      />

      <CompiledTranscript
        compiledMessages={compiledMessages}
        onCopyTranscript={onCopyTranscript}
        responseStream={responseStream}
        isRunning={isRunning}
        runError={runError}
      />
    </aside>
  );
});

