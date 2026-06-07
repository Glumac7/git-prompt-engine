import { useState, useEffect } from 'react';
import { fetchMetrics, ServerMetrics } from '../services/api';

function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }
  return true;
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);

  // Poll metrics every 4 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await fetchMetrics();
        setMetrics(prev => {
          if (isDeepEqual(prev, data)) {
            return prev;
          }
          return data;
        });
      } catch (err) {
        console.warn('Failed to poll metrics', err);
      }
    };

    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    setMetrics
  };
}
