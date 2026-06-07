import * as path from 'node:path';

export const ID_REGEX = /^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/;

/**
 * Checks if a target path is safely resolved within a base directory, preventing path traversal.
 */
export function isSafePath(targetPath: string, baseDir: string): boolean {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedBase === path.sep
    ? resolvedTarget.startsWith(resolvedBase)
    : resolvedTarget.startsWith(resolvedBase + path.sep);
}
