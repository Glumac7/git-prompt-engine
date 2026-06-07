import { Request, Response } from 'express';
import { MetricsService } from '../services/metrics.service.js';

export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  public getMetrics = (req: Request, res: Response): void => {
    const report = this.metricsService.getMetricsReport();
    res.json(report);
  };
}
