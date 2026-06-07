import { Request, Response } from 'express';
import { GitService } from '../services/git.service.js';
import { MetricsService } from '../services/metrics.service.js';

export class GitController {
  constructor(
    private readonly gitService: GitService,
    private readonly metricsService: MetricsService
  ) {}

  public commitPrompt = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.body;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Missing or invalid prompt ID in request body' });
      return;
    }

    try {
      const result = await this.gitService.commitPrompt(id);
      this.metricsService.recordGitCommit(result.duration);
      res.json({
        success: true,
        committed: result.committed,
        message: result.message,
      });
    } catch (err: any) {
      const statusCode = err.status || 500;
      res.status(statusCode).json({ error: `Git commit operation failed: ${err.message}` });
    }
  };
}
