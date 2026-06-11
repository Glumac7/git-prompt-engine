import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isSafePath, ID_REGEX } from '../utils/path.js';

const execFileAsync = promisify(execFile);

export interface GitStatus {
  currentBranch: string;
  branches: string[];
  isDirty: boolean;
}

export class GitService {
  constructor(private readonly promptDir: string) {}

  public async getGitStatus(): Promise<GitStatus> {
    let currentBranch = '';
    try {
      const { stdout } = await execFileAsync('git', ['branch', '--show-current'], { cwd: this.promptDir });
      currentBranch = stdout.trim();
    } catch {
      // Ignore and fallback
    }

    if (!currentBranch) {
      try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: this.promptDir });
        currentBranch = stdout.trim();
      } catch {
        currentBranch = 'unknown';
      }
    }

    let branches: string[] = [];
    try {
      const { stdout } = await execFileAsync('git', ['branch', '--format=%(refname:short)'], { cwd: this.promptDir });
      branches = stdout.split('\n').map(b => b.trim()).filter(b => b.length > 0);
    } catch {
      branches = [currentBranch];
    }

    let isDirty = false;
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: this.promptDir });
      isDirty = stdout.trim().length > 0;
    } catch {
      isDirty = false;
    }

    return {
      currentBranch,
      branches,
      isDirty,
    };
  }

  public async checkoutBranch(name: string, create?: boolean): Promise<{ success: boolean; message: string }> {
    if (!name || typeof name !== 'string' || name.startsWith('-') || /\s/.test(name)) {
      const error = new Error('Invalid branch name');
      (error as any).status = 400;
      throw error;
    }

    try {
      if (create) {
        await execFileAsync('git', ['checkout', '-b', name], { cwd: this.promptDir });
      } else {
        await execFileAsync('git', ['checkout', name], { cwd: this.promptDir });
      }
      return {
        success: true,
        message: `Successfully checked out branch "${name}"`,
      };
    } catch (err: any) {
      const error = new Error(err.message || 'Failed to checkout branch');
      (error as any).status = 400;
      throw error;
    }
  }

  public async pushBranch(): Promise<{ success: boolean; message: string }> {
    let currentBranch = '';
    try {
      const { stdout } = await execFileAsync('git', ['branch', '--show-current'], { cwd: this.promptDir });
      currentBranch = stdout.trim();
    } catch {}

    if (!currentBranch) {
      try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: this.promptDir });
        currentBranch = stdout.trim();
      } catch {}
    }

    if (!currentBranch || currentBranch === 'HEAD' || currentBranch === 'unknown') {
      const error = new Error('Cannot push in detached HEAD state or unknown branch');
      (error as any).status = 400;
      throw error;
    }

    try {
      await execFileAsync('git', ['push', 'origin', currentBranch], { cwd: this.promptDir });
      return {
        success: true,
        message: `Successfully pushed branch "${currentBranch}" to origin`,
      };
    } catch (err: any) {
      const error = new Error(err.message || 'Failed to push branch');
      (error as any).status = 400;
      throw error;
    }
  }

  public async commitPrompt(id: string): Promise<{ committed: boolean; message: string; duration: number }> {
    if (!ID_REGEX.test(id)) {
      const error = new Error('Invalid prompt ID format');
      (error as any).status = 400;
      throw error;
    }

    const filePath = path.join(this.promptDir, `${id}.json`);
    if (!isSafePath(filePath, this.promptDir)) {
      const error = new Error('Security Error: Path traversal detected');
      (error as any).status = 400;
      throw error;
    }

    const startGit = performance.now();

    // Verify file exists
    try {
      await fs.access(filePath);
    } catch {
      const error = new Error(`Prompt file for ID "${id}" not found on disk.`);
      (error as any).status = 404;
      throw error;
    }

    // Check git status to see if the file has unstaged or uncommitted changes
    const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--', filePath], { cwd: this.promptDir });

    if (stdout.trim().length === 0) {
      return {
        committed: false,
        message: 'No changes to commit',
        duration: performance.now() - startGit,
      };
    }

    // Run staging and commit routine
    await execFileAsync('git', ['add', '--', filePath], { cwd: this.promptDir });
    await execFileAsync('git', ['commit', '-m', `chore(prompts): update ${id} via Studio UI`, '--', filePath], { cwd: this.promptDir });

    const duration = performance.now() - startGit;
    return {
      committed: true,
      message: `Committed changes for prompt "${id}" successfully`,
      duration,
    };
  }
}
