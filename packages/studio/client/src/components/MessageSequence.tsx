import React from 'react';
import { FileText, ArrowUp, ArrowDown, Trash2, AlertTriangle } from 'lucide-react';
import { MessageTemplate } from '../services/api';

interface MessageBlockProps {
  index: number;
  msg: MessageTemplate;
  requiredVariables: string[];
  onUpdateMessage: (index: number, content: string) => void;
  onUpdateMessageRole: (index: number, role: 'system' | 'user' | 'assistant') => void;
  onDeleteMessage: (index: number) => void;
  onMoveMessage: (index: number, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

const MessageBlock = React.memo(function MessageBlock({
  index,
  msg,
  requiredVariables,
  onUpdateMessage,
  onUpdateMessageRole,
  onDeleteMessage,
  onMoveMessage,
  isFirst,
  isLast
}: MessageBlockProps) {
  // Validate variables inside message content
  const variablesInMessage = Array.from(msg.content.matchAll(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g)).map(m => m[1]);
  const invalidVars = variablesInMessage.filter(v => !requiredVariables.includes(v));

  return (
    <div 
      className={`glass-card p-4 rounded-xl border flex flex-col gap-3 transition-all relative ${
        msg.role === 'system' ? 'border-l-4 border-l-indigo-500/70' : 
        msg.role === 'user' ? 'border-l-4 border-l-emerald-500/70' : 
        'border-l-4 border-l-amber-500/70'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500">Block #{index + 1}</span>
          
          {/* Role Badge Selector */}
          <div className="flex bg-[#0c1220] p-0.5 rounded-lg border border-slate-800">
            {(['system', 'user', 'assistant'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onUpdateMessageRole(index, r)}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md transition cursor-pointer ${
                  msg.role === r 
                    ? r === 'system' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-800/40' : 
                      r === 'user' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-800/40' : 
                      'bg-amber-600/20 text-amber-400 border-amber-800/40'
                    : 'text-slate-600 hover:text-slate-400 bg-transparent border border-transparent'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Sequence controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveMessage(index, 'up')}
            disabled={isFirst}
            className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800/55 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Move block up"
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            onClick={() => onMoveMessage(index, 'down')}
            disabled={isLast}
            className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800/55 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Move block down"
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            onClick={() => onDeleteMessage(index)}
            className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800/55 cursor-pointer ml-1"
            title="Delete block"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Message text input */}
      <div className="relative">
        <textarea
          value={msg.content}
          onChange={(e) => onUpdateMessage(index, e.target.value)}
          rows={4}
          className="w-full px-3 py-2 bg-[#080d17] border border-slate-800/60 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-700 focus:outline-none focus:border-indigo-500/50"
          placeholder={`Enter message body... Reference variables using {{variableName}}.`}
        />
      </div>

      {/* Warnings / Inline errors if variables not specified */}
      {invalidVars.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-500 bg-amber-950/20 border border-amber-900/40 p-2 rounded-lg">
          <AlertTriangle size={12} />
          Warning: {invalidVars.map(v => `{{${v}}}`).join(', ')} is/are referenced in block but NOT declared in Required Application Variables.
        </div>
      )}
    </div>
  );
});

interface MessageSequenceProps {
  messages: MessageTemplate[];
  requiredVariables: string[];
  onAddMessage: (role: 'system' | 'user' | 'assistant') => void;
  onUpdateMessage: (index: number, content: string) => void;
  onUpdateMessageRole: (index: number, role: 'system' | 'user' | 'assistant') => void;
  onDeleteMessage: (index: number) => void;
  onMoveMessage: (index: number, direction: 'up' | 'down') => void;
}

export const MessageSequence = React.memo(function MessageSequence({
  messages,
  requiredVariables,
  onAddMessage,
  onUpdateMessage,
  onUpdateMessageRole,
  onDeleteMessage,
  onMoveMessage
}: MessageSequenceProps) {
  return (
    <div className="glass-panel p-5 rounded-xl flex flex-col gap-4 flex-1 min-h-[300px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
          <FileText size={13} />
          Message Block Sequence
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => onAddMessage('system')}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-950/30 border border-indigo-900/40 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-900/40 rounded-lg transition cursor-pointer"
          >
            + System Block
          </button>
          <button
            onClick={() => onAddMessage('user')}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/30 border border-emerald-900/40 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-900/40 rounded-lg transition cursor-pointer"
          >
            + User Block
          </button>
          <button
            onClick={() => onAddMessage('assistant')}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-950/30 border border-amber-900/40 text-[10px] font-semibold text-amber-300 hover:bg-amber-900/40 rounded-lg transition cursor-pointer"
          >
            + Assistant Block
          </button>
        </div>
      </div>

      <div className="space-y-4 flex-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg py-12 text-slate-500 gap-2">
            <FileText size={24} className="text-slate-600" />
            <span className="text-xs">No message blocks added yet.</span>
            <span className="text-[10px] text-slate-600">Choose one of the roles above to define a text context block.</span>
          </div>
        ) : (
          messages.map((msg, index) => (
            <MessageBlock
              key={index}
              index={index}
              msg={msg}
              requiredVariables={requiredVariables}
              onUpdateMessage={onUpdateMessage}
              onUpdateMessageRole={onUpdateMessageRole}
              onDeleteMessage={onDeleteMessage}
              onMoveMessage={onMoveMessage}
              isFirst={index === 0}
              isLast={index === messages.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
});
