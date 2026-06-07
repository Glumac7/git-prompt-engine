import React from 'react';
import { Activity } from 'lucide-react';
import { ServerMetrics } from '../services/api';

interface MetricsDashboardProps {
  metrics: ServerMetrics | null;
}

export const MetricsDashboard = React.memo(function MetricsDashboard({
  metrics
}: MetricsDashboardProps) {
  return (
    <div className="p-4 border-t border-slate-800/80 bg-[#070b12] flex flex-col gap-3 shrink-0">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
        <Activity size={12} className="text-indigo-400" />
        Live Performance Metrics
      </div>

      {metrics ? (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-[#0b101d] border border-slate-800/50 p-2 rounded-lg">
            <span className="text-slate-500 block">Cache Hit Rate</span>
            <span className="font-semibold text-indigo-400 text-xs">
              {metrics.core.cacheHitRate}%
            </span>
          </div>
          <div className="bg-[#0b101d] border border-slate-800/50 p-2 rounded-lg">
            <span className="text-slate-500 block">Compiler Speed</span>
            <span className="font-semibold text-emerald-400 text-xs">
              {metrics.core.avgCompileMs}ms
            </span>
          </div>
          <div className="bg-[#0b101d] border border-slate-800/50 p-2 rounded-lg">
            <span className="text-slate-500 block">Avg Disk Read</span>
            <span className="font-semibold text-amber-400 text-xs">
              {metrics.core.avgDiskReadMs}ms
            </span>
          </div>
          <div className="bg-[#0b101d] border border-slate-800/50 p-2 rounded-lg">
            <span className="text-slate-500 block">Git Commits</span>
            <span className="font-semibold text-slate-300 text-xs">
              {metrics.git.commitsCount}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <span className="text-[10px] text-slate-600">Retrieving metrics...</span>
        </div>
      )}
    </div>
  );
});
