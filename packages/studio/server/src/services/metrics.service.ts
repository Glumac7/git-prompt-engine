import { TelemetryEvent } from '@git-prompt-engine/core';

export interface MetricsStore {
  endpointHits: Record<string, number>;
  endpointDurations: Record<string, number[]>;
  gitCommits: number;
  gitCommitDurations: number[];
  coreEvents: TelemetryEvent[];
}

export class MetricsService {
  private metrics: MetricsStore = {
    endpointHits: {},
    endpointDurations: {},
    gitCommits: 0,
    gitCommitDurations: [],
    coreEvents: [],
  };

  public recordEndpointHit(routeKey: string, duration: number): void {
    this.metrics.endpointHits[routeKey] = (this.metrics.endpointHits[routeKey] || 0) + 1;
    if (!this.metrics.endpointDurations[routeKey]) {
      this.metrics.endpointDurations[routeKey] = [];
    }
    this.metrics.endpointDurations[routeKey].push(duration);
    if (this.metrics.endpointDurations[routeKey].length > 100) {
      this.metrics.endpointDurations[routeKey].shift();
    }
  }

  public recordGitCommit(duration: number): void {
    this.metrics.gitCommits += 1;
    this.metrics.gitCommitDurations.push(duration);
    if (this.metrics.gitCommitDurations.length > 100) {
      this.metrics.gitCommitDurations.shift();
    }
  }

  public recordCoreEvent(event: TelemetryEvent): void {
    this.metrics.coreEvents.push(event);
    if (this.metrics.coreEvents.length > 1000) {
      this.metrics.coreEvents.shift();
    }
  }

  public getMetrics(): MetricsStore {
    return this.metrics;
  }

  public getMetricsReport() {
    // 1. Calculate Endpoint Metrics
    const endpoints: Record<string, { hits: number; avgDurationMs: number }> = {};
    for (const [route, hits] of Object.entries(this.metrics.endpointHits)) {
      const durs = this.metrics.endpointDurations[route] || [];
      const avg = durs.length > 0 ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
      endpoints[route] = { hits, avgDurationMs: parseFloat(avg.toFixed(2)) };
    }

    // 2. Calculate Git Metrics
    const avgGit = this.metrics.gitCommitDurations.length > 0
      ? this.metrics.gitCommitDurations.reduce((a, b) => a + b, 0) / this.metrics.gitCommitDurations.length
      : 0;

    // 3. Calculate Core Metrics
    let cacheHits = 0;
    let cacheMisses = 0;
    const diskReadDurations: number[] = [];
    const schemaValidationDurations: number[] = [];
    const compileDurations: number[] = [];
    let totalErrors = 0;
    const recentErrors: string[] = [];

    for (const event of this.metrics.coreEvents) {
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

    return {
      endpoints,
      git: {
        commitsCount: this.metrics.gitCommits,
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
    };
  }
}
