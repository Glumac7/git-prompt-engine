import express, { Express } from 'express';
import cors from 'cors';
import * as url from 'node:url';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { PromptEngine } from '@git-prompt-engine/core';

import { MetricsService } from './services/metrics.service.js';
import { PromptsService } from './services/prompts.service.js';
import { GitService } from './services/git.service.js';
import { LlmService } from './services/llm.service.js';

import { PromptsController } from './controllers/prompts.controller.js';
import { GitController } from './controllers/git.controller.js';
import { MetricsController } from './controllers/metrics.controller.js';
import { LlmController } from './controllers/llm.controller.js';

import { createMetricsMiddleware } from './middleware/metrics.middleware.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

export function createServer(promptDir: string): Express {
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
  }

  // Instantiate services
  const metricsService = new MetricsService();
  const llmService = new LlmService();
  
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
  const llmController = new LlmController(llmService);

  // Apply request latency monitoring middleware
  app.use(createMetricsMiddleware(metricsService));

  // Define API Routes
  app.get('/api/v1/prompts', promptsController.getAllPrompts);
  app.post('/api/v1/prompts/:id', promptsController.updatePrompt);
  app.get('/api/v1/git/status', gitController.getGitStatus);
  app.post('/api/v1/git/branch', gitController.checkoutBranch);
  app.post('/api/v1/git/push', gitController.pushBranch);
  app.post('/api/v1/git/commit', gitController.commitPrompt);
  app.post('/api/v1/playground/run', llmController.runPlayground);
  app.get('/api/v1/metrics', metricsController.getMetrics);

  if (fs.existsSync(clientDistPath)) {
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.resolve(clientDistPath, 'index.html'));
    });
  }

  return app;
}
