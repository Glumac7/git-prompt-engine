import React from 'react';
import { Layers } from 'lucide-react';

interface RequiredVariablesProps {
  requiredVariables: string[];
  newVarName: string;
  setNewVarName: (val: string) => void;
  onAddVariable: (e: React.FormEvent) => void;
  onRemoveVariable: (varName: string) => void;
}

export const RequiredVariables = React.memo(function RequiredVariables({
  requiredVariables,
  newVarName,
  setNewVarName,
  onAddVariable,
  onRemoveVariable
}: RequiredVariablesProps) {
  return (
    <div className="glass-panel p-5 rounded-xl flex flex-col gap-4">
      <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
        <Layers size={13} />
        Required Application Variables
      </div>

      <form onSubmit={onAddVariable} className="flex gap-2">
        <input
          type="text"
          placeholder="e.g. orderNumber"
          value={newVarName}
          onChange={(e) => setNewVarName(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          Add
        </button>
      </form>

      <div className="flex-1 border border-dashed border-slate-800 rounded-lg p-3 overflow-y-auto max-h-[140px] flex flex-wrap gap-1.5 align-content-start">
        {requiredVariables.length === 0 ? (
          <span className="text-[10px] text-slate-600 m-auto text-center">
            No required application variables defined. Add a variable above to configure interpolation checks.
          </span>
        ) : (
          requiredVariables.map((v) => (
            <div 
              key={v}
              className="flex items-center gap-1 pl-2.5 pr-1 py-1 bg-indigo-950/20 text-indigo-300 border border-indigo-900/40 rounded-full text-xs font-medium"
            >
              {v}
              <button
                type="button"
                onClick={() => onRemoveVariable(v)}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-indigo-900/30 text-indigo-400 hover:text-indigo-200 cursor-pointer"
              >
                &times;
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
