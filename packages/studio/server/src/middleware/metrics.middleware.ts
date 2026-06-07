import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../services/metrics.service.js';

export function createMetricsMiddleware(metricsService: MetricsService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();
    res.on('finish', () => {
      // Avoid tracking metrics endpoint itself in metrics to prevent noise
      if (req.path.endsWith('/metrics')) return;

      const duration = performance.now() - start;
      // Normalise path by replacing specific route parameters for aggregated metrics
      let routeKey = `${req.method} ${req.baseUrl || ''}${req.path}`;
      if (req.params && Object.keys(req.params).length > 0) {
        for (const [key, val] of Object.entries(req.params)) {
          routeKey = routeKey.replace(val, `:${key}`);
        }
      }

      metricsService.recordEndpointHit(routeKey, duration);
    });
    next();
  };
}
