import React from 'react';
import { Settings } from 'lucide-react';

interface TemplateConfigProps {
  id: string;
  name: string;
  description: string;
  onChange: (field: 'name' | 'description', value: string) => void;
}

export const TemplateConfig = React.memo(function TemplateConfig({
  id,
  name,
  description,
  onChange
}: TemplateConfigProps) {
  return (
    <div className="glass-panel p-5 rounded-xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
          <Settings size={13} />
          Template Configuration
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Prompt ID (File Name)</label>
          <div className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/80 rounded-lg text-sm text-slate-500 font-mono select-all select-none cursor-not-allowed">
            {id}.json
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Descriptive Title</label>
          <input
            type="text"
            value={name}
            onChange={(e) => onChange('name', e.target.value)}
            className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/80 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500"
            placeholder="Define template name..."
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Description (Internal context)</label>
        <textarea
          value={description}
          onChange={(e) => onChange('description', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/80 resize-none"
          placeholder="Specify who uses this prompt and what role it plays inside the codebase..."
        />
      </div>
    </div>
  );
});
