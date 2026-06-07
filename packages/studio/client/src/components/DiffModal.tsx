import React, { useState, useMemo } from 'react';
import { X, Check, Columns, Menu, AlertCircle, Sparkles } from 'lucide-react';
import { PromptTemplate } from '../services/api';

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  originalPrompt: PromptTemplate | null;
  activePrompt: PromptTemplate | null;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  leftLineNum?: number;
  rightLineNum?: number;
}

// LCS-based line-by-line diff algorithm
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const n = oldLines.length;
  const m = newLines.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'unchanged',
        content: oldLines[i - 1],
        leftLineNum: i,
        rightLineNum: j
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        content: newLines[j - 1],
        rightLineNum: j
      });
      j--;
    } else {
      result.unshift({
        type: 'removed',
        content: oldLines[i - 1],
        leftLineNum: i
      });
      i--;
    }
  }

  return result;
}

export const DiffModal: React.FC<DiffModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  originalPrompt,
  activePrompt
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    diffLines,
    variablesSummary,
    messagesCountDiff
  } = useMemo(() => {
    if (!activePrompt) {
      return { diffLines: [], variablesSummary: { added: [], removed: [] }, messagesCountDiff: 0 };
    }

    // Standardize original config if null (i.e. new prompt creation)
    const original = originalPrompt || {
      id: activePrompt.id,
      name: '',
      requiredVariables: [],
      messages: []
    };

    // Serialize configurations for code review comparison
    const cleanOriginal = {
      id: original.id,
      name: original.name,
      requiredVariables: original.requiredVariables,
      messages: original.messages,
      description: original.description,
      parameters: original.parameters
    };

    const cleanActive = {
      id: activePrompt.id,
      name: activePrompt.name,
      requiredVariables: activePrompt.requiredVariables,
      messages: activePrompt.messages,
      description: activePrompt.description,
      parameters: activePrompt.parameters
    };

    const origStr = JSON.stringify(cleanOriginal, null, 2);
    const actStr = JSON.stringify(cleanActive, null, 2);
    const lines = computeLineDiff(origStr, actStr);

    // Compute high-level variable changes
    const addedVars = activePrompt.requiredVariables.filter(v => !original.requiredVariables.includes(v));
    const removedVars = original.requiredVariables.filter(v => !activePrompt.requiredVariables.includes(v));

    return {
      diffLines: lines,
      variablesSummary: { added: addedVars, removed: removedVars },
      messagesCountDiff: activePrompt.messages.length - original.messages.length
    };
  }, [originalPrompt, activePrompt]);

  if (!isOpen || !activePrompt) return null;

  const handleSaveClick = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl h-[85vh] flex flex-col bg-[#090d16]/95 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden glass-panel animate-scale-up">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Visual Review Canvas</h2>
              <p className="text-[10px] text-slate-500">Review changes for prompt config <code className="text-indigo-400 font-mono">{activePrompt.id}.json</code> before saving</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Mode Switcher */}
            <div className="flex bg-[#070b13] p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase rounded-md transition cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-800/40'
                    : 'text-slate-500 hover:text-slate-400 bg-transparent border border-transparent'
                }`}
              >
                <Columns size={12} />
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase rounded-md transition cursor-pointer ${
                  viewMode === 'unified'
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-800/40'
                    : 'text-slate-500 hover:text-slate-400 bg-transparent border border-transparent'
                }`}
              >
                <Menu size={12} />
                Unified Diff
              </button>
            </div>

            <button 
              onClick={onClose} 
              className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800/60 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Change Summary Strip */}
        <div className="px-6 py-3 bg-indigo-950/10 border-b border-slate-800/60 flex flex-wrap gap-4 items-center text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Summary:</span>
          
          {/* Messages difference */}
          <span className="flex items-center gap-1">
            Messages: 
            <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
              messagesCountDiff > 0 ? 'bg-emerald-950/30 text-emerald-400' :
              messagesCountDiff < 0 ? 'bg-rose-950/30 text-rose-400' :
              'bg-slate-900 text-slate-500'
            }`}>
              {messagesCountDiff > 0 ? `+${messagesCountDiff}` : messagesCountDiff}
            </span>
          </span>

          {/* Variables Summary */}
          {variablesSummary.added.length > 0 && (
            <span className="flex items-center gap-1">
              Added Variables: 
              {variablesSummary.added.map(v => (
                <code key={v} className="bg-emerald-950/20 border border-emerald-900/40 px-1 py-0.5 rounded text-emerald-400 font-mono text-[10px]">{v}</code>
              ))}
            </span>
          )}

          {variablesSummary.removed.length > 0 && (
            <span className="flex items-center gap-1">
              Removed Variables: 
              {variablesSummary.removed.map(v => (
                <code key={v} className="bg-rose-950/20 border border-rose-900/40 px-1 py-0.5 rounded text-rose-400 font-mono text-[10px]">{v}</code>
              ))}
            </span>
          )}

          {variablesSummary.added.length === 0 && variablesSummary.removed.length === 0 && messagesCountDiff === 0 && (
            <span className="text-slate-500 italic">No structural additions or removals. Meta or instruction updates only.</span>
          )}
        </div>

        {/* Diff Canvas Area */}
        <div className="flex-1 overflow-auto bg-[#07090e] p-6 font-mono text-xs leading-5">
          {viewMode === 'unified' ? (
            /* Unified Diff View */
            <div className="min-w-full divide-y divide-slate-900/50">
              {diffLines.map((line, idx) => {
                const isAdded = line.type === 'added';
                const isRemoved = line.type === 'removed';
                return (
                  <div 
                    key={idx} 
                    className={`flex items-start ${
                      isAdded ? 'bg-emerald-950/15 border-l-2 border-l-emerald-500/50 text-emerald-300' :
                      isRemoved ? 'bg-rose-950/15 border-l-2 border-l-rose-500/50 text-rose-300' :
                      'text-slate-400 hover:bg-slate-900/20'
                    }`}
                  >
                    {/* Left Line Number */}
                    <span className="w-12 text-right select-none pr-4 text-[10px] text-slate-700">
                      {line.leftLineNum || ''}
                    </span>
                    {/* Right Line Number */}
                    <span className="w-12 text-right select-none pr-4 text-[10px] text-slate-700">
                      {line.rightLineNum || ''}
                    </span>
                    {/* Operation Indicator */}
                    <span className="w-6 select-none text-center text-[10px] font-bold pr-2">
                      {isAdded ? '+' : isRemoved ? '-' : ' '}
                    </span>
                    {/* Code Content */}
                    <span className="whitespace-pre">{line.content}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Split / Side-by-Side Diff View */
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Left Side: Original */}
              <div className="border border-slate-900 bg-[#06080c] rounded-xl flex flex-col overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-900 bg-slate-950/60 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none shrink-0">
                  <span>Current Disk State (Original)</span>
                </div>
                <div className="flex-1 overflow-auto p-4 divide-y divide-slate-950/20">
                  {diffLines.filter(l => l.type !== 'added').map((line, idx) => {
                    const isRemoved = line.type === 'removed';
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-start ${
                          isRemoved ? 'bg-rose-950/15 border-l-2 border-l-rose-500/50 text-rose-300' : 'text-slate-500'
                        }`}
                      >
                        <span className="w-10 text-right select-none pr-3 text-[10px] text-slate-700">{line.leftLineNum}</span>
                        <span className="whitespace-pre">{line.content}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: Active Edits */}
              <div className="border border-slate-900 bg-[#06080c] rounded-xl flex flex-col overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-900 bg-slate-950/60 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none shrink-0">
                  <span>Proposed Changes (Active)</span>
                </div>
                <div className="flex-1 overflow-auto p-4 divide-y divide-slate-950/20">
                  {diffLines.filter(l => l.type !== 'removed').map((line, idx) => {
                    const isAdded = line.type === 'added';
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-start ${
                          isAdded ? 'bg-emerald-950/15 border-l-2 border-l-emerald-500/50 text-emerald-300' : 'text-slate-400'
                        }`}
                      >
                        <span className="w-10 text-right select-none pr-3 text-[10px] text-slate-700">{line.rightLineNum}</span>
                        <span className="whitespace-pre">{line.content}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between shrink-0">
          <div className="max-w-md">
            {saveError ? (
              <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/20 border border-rose-900/40 p-2 rounded-lg animate-pulse">
                <AlertCircle size={14} />
                <span>Save failed: {saveError}</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-500">
                Confirming writes these changes to the local Git repository filesystem. Uncommitted status will show in sidebar.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-850 hover:bg-slate-900 hover:text-slate-300 text-slate-400 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/10 cursor-pointer transition-all"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-transparent rounded-full animate-spin"></div>
                  Writing...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Confirm Save & Write
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
