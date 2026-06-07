import React from 'react';
import { Sliders, ChevronDown } from 'lucide-react';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { MODEL_PRESETS } from '../hooks/usePromptStudio';

interface ModelParametersProps {
  modelName: string;
  temperature: number;
  maxTokens: number;
  onChange: (field: string, value: any) => void;
}

export const ModelParameters = React.memo(function ModelParameters({
  modelName,
  temperature,
  maxTokens,
  onChange
}: ModelParametersProps) {
  return (
    <div className="glass-panel p-5 rounded-xl flex flex-col gap-4 justify-between">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
          <Sliders size={13} />
          Model Parameters
        </div>
      </div>

      <div className="space-y-4">
        {/* Model Name Predefined Base UI Autocomplete */}
        <div className="flex flex-col">
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Targeted Model</label>
          <Autocomplete.Root
            items={MODEL_PRESETS}
            value={modelName}
            onValueChange={(val) => onChange('modelName', val)}
            openOnInputClick
            autoHighlight
          >
            <div className="relative flex items-center w-full">
              <Autocomplete.Input
                placeholder="Select preset or type custom..."
                className="w-full pl-3 pr-8 py-1.5 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-sans"
              />
              <Autocomplete.Trigger className="absolute right-2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer flex items-center justify-center bg-transparent border-none outline-none group">
                <ChevronDown size={14} className="transform transition-transform duration-200 group-data-[popup-open]:rotate-180" />
              </Autocomplete.Trigger>
            </div>

            <Autocomplete.Portal>
              <Autocomplete.Positioner className="z-50 w-[var(--anchor-width)]" sideOffset={6}>
                <Autocomplete.Popup className="max-h-48 overflow-y-auto bg-[#0d1324]/95 backdrop-blur-md border border-slate-800/90 rounded-lg shadow-2xl py-1 font-sans text-xs scrollbar-thin scrollbar-thumb-slate-800 focus:outline-none">
                  <Autocomplete.Empty className="px-3 py-2 text-slate-500 italic select-none">
                    Press Enter to use custom model name
                  </Autocomplete.Empty>
                  <Autocomplete.List className="focus:outline-none">
                    {(preset: string) => (
                      <Autocomplete.Item
                        key={preset}
                        value={preset}
                        className="px-3 py-1.5 cursor-pointer transition-colors text-slate-300 data-[highlighted]:bg-indigo-600 data-[highlighted]:text-white focus:outline-none"
                      >
                        {preset}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </div>

        {/* Temperature with Premium styled Range Input */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
            <span>Temperature</span>
            <span className="font-mono text-indigo-400">{temperature}</span>
          </div>
          <div className="px-1 py-2 flex items-center">
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => onChange('temperature', parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Max Output Tokens</label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => onChange('maxTokens', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-1.5 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            min={1}
            max={100000}
          />
        </div>
      </div>
    </div>
  );
});
