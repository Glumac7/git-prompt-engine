import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PromptEngine, PromptTemplateSchema, TelemetryEvent, PromptTemplate } from '@git-prompt-engine/core';

const execFileAsync = promisify(execFile);

interface MetricsStore {
  endpointHits: Record<string, number>;
  endpointDurations: Record<string, number[]>;
  gitCommits: number;
  gitCommitDurations: number[];
  coreEvents: TelemetryEvent[];
}

export function createServer(promptDir: string): Express {
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  // Metrics In-Memory Store
  const metrics: MetricsStore = {
    endpointHits: {},
    endpointDurations: {},
    gitCommits: 0,
    gitCommitDurations: [],
    coreEvents: [],
  };

  // Instantiate core PromptEngine with telemetry callback hook
  const engine = new PromptEngine({
    promptDir,
    cacheTtl: 60000, // 1 minute caching
    onTelemetry: (event) => {
      metrics.coreEvents.push(event);
      // Keep only last 1000 events to prevent memory bloat
      if (metrics.coreEvents.length > 1000) {
        metrics.coreEvents.shift();
      }
    },
  });

  // Middleware to capture request latencies and endpoint hits
  app.use((req, res, next) => {
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

      metrics.endpointHits[routeKey] = (metrics.endpointHits[routeKey] || 0) + 1;
      if (!metrics.endpointDurations[routeKey]) {
        metrics.endpointDurations[routeKey] = [];
      }
      metrics.endpointDurations[routeKey].push(duration);
      if (metrics.endpointDurations[routeKey].length > 100) {
        metrics.endpointDurations[routeKey].shift();
      }
    });
    next();
  });

  /**
   * GET /api/v1/prompts
   * Reads and validates all JSON prompt templates in the target directory.
   */
  app.get('/api/v1/prompts', async (req: Request, res: Response) => {
    try {
      const files = await fs.readdir(promptDir);
      const prompts: PromptTemplate[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const id = path.basename(file, '.json');
          try {
            // Using PromptEngine ensures it runs through Zod validator and logs telemetry
            const template = await engine.getTemplate(id);
            prompts.push(template);
          } catch (err) {
            console.warn(`[Studio Server] Skipping corrupted file "${file}":`, (err as Error).message);
          }
        }
      }

      res.json(prompts);
    } catch (err) {
      res.status(500).json({ error: `Failed to read prompts directory: ${(err as Error).message}` });
    }
  });

  /**
   * POST /api/v1/prompts/:id
   * Validates the request body with Zod and atomically updates the prompt configuration on disk.
   */
  app.post('/api/v1/prompts/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      // 1. Zod validation
      const validatedPayload = PromptTemplateSchema.parse(req.body);

      // Verify the payload's ID matches the route parameter
      if (validatedPayload.id !== id) {
        return res.status(400).json({ error: `Payload ID "${validatedPayload.id}" does not match URL path ID "${id}"` });
      }

      // 2. Atomic write
      const filePath = path.join(promptDir, `${id}.json`);
      const tempPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      await fs.writeFile(tempPath, JSON.stringify(validatedPayload, null, 2), 'utf-8');
      await fs.rename(tempPath, filePath);

      // Clear the prompt engine cache for this template to ensure freshness
      engine.clearCache();

      res.json({ success: true, prompt: validatedPayload });
    } catch (err) {
      res.status(400).json({ error: `Failed to save prompt: ${(err as Error).message}` });
    }
  });

  /**
   * POST /api/v1/git/commit
   * Automatically stages and commits the modified file if unstaged changes exist.
   */
  app.post('/api/v1/git/commit', async (req: Request, res: Response) => {
    const { id } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid prompt ID in request body' });
    }

    const startGit = performance.now();
    try {
      const filePath = path.join(promptDir, `${id}.json`);

      // Verify file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: `Prompt file for ID "${id}" not found on disk.` });
      }

      // Check git status to see if the file has unstaged or uncommitted changes
      // We resolve the path relative to git root or run within promptDir
      const { stdout } = await execFileAsync('git', ['status', '--porcelain', filePath], { cwd: promptDir });

      if (stdout.trim().length === 0) {
        return res.json({ success: true, committed: false, message: 'No changes to commit' });
      }

      // Run staging and commit routine
      await execFileAsync('git', ['add', filePath], { cwd: promptDir });
      await execFileAsync('git', ['commit', '-m', `chore(prompts): update ${id} via Studio UI`, filePath], { cwd: promptDir });

      const duration = performance.now() - startGit;
      metrics.gitCommits += 1;
      metrics.gitCommitDurations.push(duration);
      if (metrics.gitCommitDurations.length > 100) {
        metrics.gitCommitDurations.shift();
      }

      res.json({
        success: true,
        committed: true,
        message: `Committed changes for prompt "${id}" successfully`,
      });
    } catch (err) {
      res.status(500).json({ error: `Git commit operation failed: ${(err as Error).message}` });
    }
  });

  /**
   * GET /api/v1/metrics
   * Exposes latency and throughput performance metrics.
   */
  app.get('/api/v1/metrics', (req: Request, res: Response) => {
    // 1. Calculate Endpoint Metrics
    const endpoints: Record<string, { hits: number; avgDurationMs: number }> = {};
    for (const [route, hits] of Object.entries(metrics.endpointHits)) {
      const durs = metrics.endpointDurations[route] || [];
      const avg = durs.length > 0 ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
      endpoints[route] = { hits, avgDurationMs: parseFloat(avg.toFixed(2)) };
    }

    // 2. Calculate Git Metrics
    const avgGit = metrics.gitCommitDurations.length > 0
      ? metrics.gitCommitDurations.reduce((a, b) => a + b, 0) / metrics.gitCommitDurations.length
      : 0;

    // 3. Calculate Core Metrics
    let cacheHits = 0;
    let cacheMisses = 0;
    const diskReadDurations: number[] = [];
    const schemaValidationDurations: number[] = [];
    const compileDurations: number[] = [];
    let totalErrors = 0;
    const recentErrors: string[] = [];

    for (const event of metrics.coreEvents) {
      if (event.type === 'cache_hit') cacheHits++;
      if (event.type === 'cache_miss') cacheMisses++;
      if (event.type === 'read_file' && event.success) diskReadDurations.push(event.durationMs);
      if (event.type === 'schema_validation' && event.success) schemaValidationDurations.push(event.durationMs);
      if (event.type === 'compile' && event.success) compileDurations.push(event.durationMs);
      if (!event.success) {
        totalErrors++;
        if (event.error) {
          recentErrors.push(`${event.type}: ${event.error}`);
          if (recentErrors.length > 10) recentErrors.shift();
        }
      }
    }

    const cacheTotal = cacheHits + cacheMisses;
    const cacheHitRate = cacheTotal > 0 ? cacheHits / cacheTotal : 0;

    const avgDisk = diskReadDurations.length > 0 ? diskReadDurations.reduce((a, b) => a + b, 0) / diskReadDurations.length : 0;
    const avgSchema = schemaValidationDurations.length > 0 ? schemaValidationDurations.reduce((a, b) => a + b, 0) / schemaValidationDurations.length : 0;
    const avgCompile = compileDurations.length > 0 ? compileDurations.reduce((a, b) => a + b, 0) / compileDurations.length : 0;

    res.json({
      endpoints,
      git: {
        commitsCount: metrics.gitCommits,
        avgCommitDurationMs: parseFloat(avgGit.toFixed(2)),
      },
      core: {
        cacheHitRate: parseFloat((cacheHitRate * 100).toFixed(2)),
        cacheHits,
        cacheMisses,
        avgDiskReadMs: parseFloat(avgDisk.toFixed(2)),
        avgSchemaValidationMs: parseFloat(avgSchema.toFixed(2)),
        avgCompileMs: parseFloat(avgCompile.toFixed(2)),
        totalErrors,
        recentErrors,
      },
    });
  });

  return app;
}
