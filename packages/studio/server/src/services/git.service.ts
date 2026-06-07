import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isSafePath, ID_REGEX } from '../utils/path.js';

const execFileAsync = promisify(execFile);

export class GitService {
  constructor(private readonly promptDir: string) {}

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
