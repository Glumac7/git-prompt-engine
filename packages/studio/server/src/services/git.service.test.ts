import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { GitService } from './git.service.js';

vi.mock('node:child_process', () => {
  return {
    execFile: vi.fn((file, args, options, callback) => {
      if (typeof callback === 'function') {
        if (args.includes('status')) {
          if (args.some((a: string) => a.includes('unchanged'))) {
            callback(null, { stdout: '' }, '');
          } else {
            callback(null, { stdout: ' M test.json' }, '');
          }
        } else {
          callback(null, { stdout: 'Mocked successful commit' }, '');
        }
      }
    }),
  };
});

describe('GitService', () => {
  let tempDir: string;
  let service: GitService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-service-tests-'));
    service = new GitService(tempDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should throw 404 error if file does not exist', async () => {
    await expect(service.commitPrompt('nonexistent')).rejects.toThrow(/not found on disk/);
  });

  it('should return committed false if no changes', async () => {
    const id = 'unchanged';
    await fs.writeFile(path.join(tempDir, `${id}.json`), '{}');
    const result = await service.commitPrompt(id);
    expect(result.committed).toBe(false);
    expect(result.message).toBe('No changes to commit');
  });

  it('should perform commit if changes exist', async () => {
    const id = 'changed';
    await fs.writeFile(path.join(tempDir, `${id}.json`), '{}');
    const result = await service.commitPrompt(id);
    expect(result.committed).toBe(true);
    expect(execFile).toHaveBeenCalled();
  });
});
