import React from 'react';
import { Play, Copy } from 'lucide-react';

interface PlaygroundProps {
  requiredVariables: string[];
  playgroundVariables: Record<string, string>;
  setPlaygroundVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  compiledMessages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  onCopyTranscript: () => void;
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
    <div className="p-4 border-b border-slate-800/60 flex flex-col gap-4 max-h-[300px] overflow-y-auto shrink-0 bg-[#060a11]/40">
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

const CompiledTranscript = React.memo(function CompiledTranscript({
  compiledMessages,
  onCopyTranscript
}: {
  compiledMessages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  onCopyTranscript: () => void;
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
      </div>
    </div>
  );
});

export const Playground = React.memo(function Playground({
  requiredVariables,
  playgroundVariables,
  setPlaygroundVariables,
  compiledMessages,
  onCopyTranscript
}: PlaygroundProps) {
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

      <CompiledTranscript
        compiledMessages={compiledMessages}
        onCopyTranscript={onCopyTranscript}
      />
    </aside>
  );
});
