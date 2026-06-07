import express, { Express } from 'express';
import cors from 'cors';
import { PromptEngine } from '@git-prompt-engine/core';

import { MetricsService } from './services/metrics.service.js';
import { PromptsService } from './services/prompts.service.js';
import { GitService } from './services/git.service.js';

import { PromptsController } from './controllers/prompts.controller.js';
import { GitController } from './controllers/git.controller.js';
import { MetricsController } from './controllers/metrics.controller.js';

import { createMetricsMiddleware } from './middleware/metrics.middleware.js';

export function createServer(promptDir: string): Express {
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  // Instantiate services
  const metricsService = new MetricsService();
  
  const engine = new PromptEngine({
    promptDir,
    cacheTtl: 60000, // 1 minute caching
    onTelemetry: (event) => {
      metricsService.recordCoreEvent(event);
    },
  });

  const promptsService = new PromptsService(promptDir, engine);
  const gitService = new GitService(promptDir);

  // Instantiate controllers
  const promptsController = new PromptsController(promptsService);
  const gitController = new GitController(gitService, metricsService);
  const metricsController = new MetricsController(metricsService);

  // Apply request latency monitoring middleware
  app.use(createMetricsMiddleware(metricsService));

  // Define API Routes
  app.get('/api/v1/prompts', promptsController.getAllPrompts);
  app.post('/api/v1/prompts/:id', promptsController.updatePrompt);
  app.post('/api/v1/git/commit', gitController.commitPrompt);
  app.get('/api/v1/metrics', metricsController.getMetrics);

  return app;
}
