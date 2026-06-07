import React from 'react';
import { Sliders } from 'lucide-react';
import { Slider } from '@base-ui/react/slider';
import { MODEL_PRESETS } from '../hooks/usePromptStudio';

interface ModelParametersProps {
  modelName: string;
  temperature: number;
  maxTokens: number;
  customModelMode: boolean;
  setCustomModelMode: (val: boolean) => void;
  onChange: (field: string, value: any) => void;
}

export const ModelParameters = React.memo(function ModelParameters({
  modelName,
  temperature,
  maxTokens,
  customModelMode,
  setCustomModelMode,
  onChange
}: ModelParametersProps) {
  return (
    <div className="glass-panel p-5 rounded-xl flex flex-col gap-4 justify-between">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
          <Sliders size={13} />
          Model Parameters
        </div>
        
        {/* Toggle Custom Model input */}
        <button
          onClick={() => {
            setCustomModelMode(!customModelMode);
          }}
          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
        >
          {customModelMode ? 'Use Preset List' : 'Enter Custom Model'}
        </button>
      </div>

      <div className="space-y-4">
        {/* Model Name Combobox */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Targeted Model</label>
          {customModelMode ? (
            <input
              type="text"
              value={modelName}
              onChange={(e) => onChange('modelName', e.target.value)}
              placeholder="e.g. custom-llama-3-100b"
              className="w-full px-3 py-1.5 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          ) : (
            <select
              value={modelName || 'gemini-3.5-flash'}
              onChange={(e) => onChange('modelName', e.target.value)}
              className="w-full px-3 py-1.5 bg-[#0c1220] border border-slate-800/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {MODEL_PRESETS.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          )}
        </div>

        {/* Temperature with Base UI Slider */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
            <span>Temperature</span>
            <span className="font-mono text-indigo-400">{temperature}</span>
          </div>
          <div className="px-1 py-1">
            <Slider.Root 
              value={[temperature]} 
              onValueChange={(val) => onChange('temperature', val[0])}
              min={0} 
              max={2} 
              step={0.1}
              className="relative flex items-center w-full h-5 touch-none select-none cursor-pointer"
            >
              <Slider.Control className="relative w-full h-1 bg-slate-800 rounded-full">
                <Slider.Track className="w-full h-1 rounded-full">
                  <Slider.Indicator className="absolute h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" />
                  <Slider.Thumb className="absolute block w-3.5 h-3.5 bg-white border border-indigo-500 rounded-full -translate-y-1.25 -translate-x-1.75 shadow focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-transform active:scale-110" />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
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
