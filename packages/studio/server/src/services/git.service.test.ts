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
        if (args[0] === 'branch') {
          if (args[1] === '--show-current') {
            // Detached HEAD mockup logic
            if (options && options.cwd && options.cwd.includes('detached')) {
              callback(null, { stdout: '' }, '');
            } else {
              callback(null, { stdout: 'main\n' }, '');
            }
          } else if (args[1] === '--format=%(refname:short)') {
            callback(null, { stdout: 'main\nfeature-xyz\n' }, '');
          } else {
            callback(null, { stdout: '' }, '');
          }
        } else if (args[0] === 'rev-parse') {
          callback(null, { stdout: 'HEAD\n' }, '');
        } else if (args[0] === 'status' && args.includes('--porcelain')) {
          if (args.length === 2) {
            if (options && options.cwd && options.cwd.includes('dirty')) {
              callback(null, { stdout: ' M somefile.json\n' }, '');
            } else {
              callback(null, { stdout: '' }, '');
            }
          } else {
            if (args.some((a: string) => a.includes('unchanged'))) {
              callback(null, { stdout: '' }, '');
            } else {
              callback(null, { stdout: ' M test.json\n' }, '');
            }
          }
        } else if (args[0] === 'checkout') {
          callback(null, { stdout: 'Switched to branch' }, '');
        } else if (args[0] === 'push') {
          callback(null, { stdout: 'Pushed successfully' }, '');
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

  describe('getGitStatus', () => {
    it('should return branch status information', async () => {
      const status = await service.getGitStatus();
      expect(status.currentBranch).toBe('main');
      expect(status.branches).toEqual(['main', 'feature-xyz']);
      expect(status.isDirty).toBe(false);
    });

    it('should show isDirty true if status output is non-empty', async () => {
      const dirtyService = new GitService(path.join(tempDir, 'dirty'));
      const status = await dirtyService.getGitStatus();
      expect(status.isDirty).toBe(true);
    });
  });

  describe('checkoutBranch', () => {
    it('should switch branch successfully', async () => {
      const res = await service.checkoutBranch('feature-xyz');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Successfully checked out branch "feature-xyz"');
    });

    it('should create and switch branch successfully', async () => {
      const res = await service.checkoutBranch('new-branch', true);
      expect(res.success).toBe(true);
      expect(res.message).toContain('Successfully checked out branch "new-branch"');
    });

    it('should validate branch names to prevent flag injection', async () => {
      await expect(service.checkoutBranch('-invalid')).rejects.toThrow('Invalid branch name');
      await expect(service.checkoutBranch('invalid name')).rejects.toThrow('Invalid branch name');
    });
  });

  describe('pushBranch', () => {
    it('should push current branch successfully', async () => {
      const res = await service.pushBranch();
      expect(res.success).toBe(true);
      expect(res.message).toContain('Successfully pushed branch "main" to origin');
    });

    it('should fail if current branch is unknown/detached HEAD', async () => {
      const detachedService = new GitService(path.join(tempDir, 'detached'));
      await expect(detachedService.pushBranch()).rejects.toThrow(/Cannot push in detached HEAD state/);
    });
  });
});
