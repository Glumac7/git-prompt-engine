import React from 'react';
import { 
  Save, 
  GitCommit, 
  Sparkles, 
  AlertTriangle, 
  GitBranch, 
  ChevronDown, 
  Search, 
  Check, 
  Plus, 
  Upload 
} from 'lucide-react';
import { PromptTemplate, GitStatus } from '../services/api';

interface HeaderProps {
  activePrompt: PromptTemplate | null;
  isModified: boolean;
  isGitUncommitted: boolean;
  isValid: boolean;
  onSave: () => Promise<void>;
  onGitCommit: () => Promise<void>;
  gitStatus: GitStatus | null;
  onCheckoutBranch: (name: string, create?: boolean) => Promise<void>;
  onPushBranch: () => Promise<void>;
}

const BranchSelector = ({
  gitStatus,
  onCheckoutBranch,
  onPushBranch,
}: {
  gitStatus: GitStatus | null;
  onCheckoutBranch: (name: string, create?: boolean) => Promise<void>;
  onPushBranch: () => Promise<void>;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [isPushing, setIsPushing] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!gitStatus) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/40 border border-slate-800/80 text-xs text-slate-500 select-none">
        <GitBranch size={13} className="animate-pulse text-slate-600" />
        <span>Loading Git...</span>
      </div>
    );
  }

  const filteredBranches = gitStatus.branches.filter(b =>
    b.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = gitStatus.branches.some(
    b => b.toLowerCase() === search.toLowerCase().trim()
  );

  const handleCreateAndCheckout = async () => {
    const branchName = search.trim();
    if (!branchName) return;
    setIsOpen(false);
    setSearch('');
    await onCheckoutBranch(branchName, true);
  };

  const handleCheckout = async (branchName: string) => {
    if (branchName === gitStatus.currentBranch) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);
    setSearch('');
    await onCheckoutBranch(branchName, false);
  };

  const handlePush = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPushing(true);
    try {
      await onPushBranch();
    } finally {
      setIsPushing(false);
    }
  };

  const isDetached = gitStatus.currentBranch === 'HEAD' || gitStatus.currentBranch === 'unknown';

  return (
    <div className="flex items-center gap-1.5" ref={dropdownRef}>
      {/* Branch selector trigger button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer select-none"
        >
          <GitBranch size={13} className="text-indigo-400" />
          <span className="max-w-[120px] truncate">{gitStatus.currentBranch}</span>
          {gitStatus.isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Dirty changes" />
          )}
          <ChevronDown size={11} className="text-slate-500" />
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="absolute left-0 mt-2 w-64 glass-panel border border-slate-800/95 rounded-lg shadow-xl shadow-black/80 z-50 overflow-hidden animate-fade-in p-2 flex flex-col gap-1.5 bg-slate-950/95">
            <div className="relative flex items-center">
              <Search size={12} className="absolute left-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search or create branch..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs pl-8 pr-2.5 py-1.5 rounded text-slate-200 outline-none focus:border-indigo-500/50"
                autoFocus
              />
            </div>

            <div className="max-h-48 overflow-y-auto flex flex-col">
              {filteredBranches.map(branchName => (
                <button
                  key={branchName}
                  onClick={() => handleCheckout(branchName)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded text-left text-xs transition-colors cursor-pointer ${
                    branchName === gitStatus.currentBranch
                      ? 'bg-indigo-950/40 text-indigo-300 font-medium'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <span className="truncate">{branchName}</span>
                  {branchName === gitStatus.currentBranch && <Check size={12} />}
                </button>
              ))}

              {filteredBranches.length === 0 && !search && (
                <div className="px-2.5 py-2 text-center text-xs text-slate-500">
                  No local branches found
                </div>
              )}
            </div>

            {search.trim() && !exactMatch && (
              <button
                onClick={handleCreateAndCheckout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/20 hover:bg-indigo-950/30 border border-indigo-900/30 rounded text-left transition-colors cursor-pointer"
              >
                <Plus size={12} />
                <span className="truncate">Create branch "{search.trim()}"</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Push button */}
      <button
        onClick={handlePush}
        disabled={isPushing || isDetached}
        title={isDetached ? 'Cannot push in detached HEAD state' : `Push ${gitStatus.currentBranch} to origin`}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
          isPushing
            ? 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
            : !isDetached
              ? 'bg-slate-900/80 hover:bg-slate-900 hover:text-white text-slate-300 border-slate-800 hover:border-slate-700 cursor-pointer shadow-lg shadow-indigo-600/5'
              : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
        }`}
      >
        <Upload size={12} className={isPushing ? 'animate-spin' : ''} />
        <span>{isPushing ? 'Pushing...' : 'Push'}</span>
      </button>
    </div>
  );
};

export const Header = React.memo(function Header({
  activePrompt,
  isModified,
  isGitUncommitted,
  isValid,
  onSave,
  onGitCommit,
  gitStatus,
  onCheckoutBranch,
  onPushBranch
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 glass-panel border-b border-slate-800/80 z-20 shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg shadow-lg shadow-indigo-500/20">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Prompt Workspace Studio
            </h1>
            <p className="text-xs text-slate-500">Git-Backed Prompt Engine Visual Client</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800/80" />

        <BranchSelector
          gitStatus={gitStatus}
          onCheckoutBranch={onCheckoutBranch}
          onPushBranch={onPushBranch}
        />
      </div>

      {activePrompt && (
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
            isModified 
              ? 'bg-amber-950/20 text-amber-400 border-amber-800/40 animate-pulse' 
              : isGitUncommitted 
                ? 'bg-blue-950/20 text-blue-400 border-blue-800/40' 
                : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}>
            {isModified ? 'Unsaved Changes' : isGitUncommitted ? 'Uncommitted (Git)' : 'All Saved & Committed'}
          </span>

          {!isValid && (
            <span className="text-xs text-rose-400 flex items-center gap-1 bg-rose-950/20 border border-rose-900/30 px-2 py-1 rounded-md transition-all animate-fade-in">
              <AlertTriangle size={12} className="text-rose-400" />
              Invalid Structure
            </span>
          )}

          <button
            onClick={onSave}
            disabled={!isModified || !isValid}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isModified && isValid
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-600/10 cursor-pointer' 
                : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
          >
            <Save size={14} />
            Save to Disk
          </button>

          <button
            onClick={onGitCommit}
            disabled={!isGitUncommitted && !isModified}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isGitUncommitted || isModified
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-600/10 cursor-pointer' 
                : 'bg-slate-900/60 text-slate-500 border-slate-800 cursor-not-allowed'
            }`}
          >
            <GitCommit size={14} />
            Commit to Git
          </button>
        </div>
      )}
    </header>
  );
}, (prevProps, nextProps) => {
  return (
    !!prevProps.activePrompt === !!nextProps.activePrompt &&
    prevProps.activePrompt?.id === nextProps.activePrompt?.id &&
    prevProps.isModified === nextProps.isModified &&
    prevProps.isGitUncommitted === nextProps.isGitUncommitted &&
    prevProps.isValid === nextProps.isValid &&
    prevProps.gitStatus?.currentBranch === nextProps.gitStatus?.currentBranch &&
    prevProps.gitStatus?.isDirty === nextProps.gitStatus?.isDirty &&
    prevProps.gitStatus?.branches?.length === nextProps.gitStatus?.branches?.length
  );
});
