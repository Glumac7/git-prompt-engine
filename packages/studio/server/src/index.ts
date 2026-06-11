#!/usr/bin/env node
import { parseArgs } from 'node:util';
import * as fs from 'node:fs';
import { exec } from 'node:child_process';
import { createServer } from './server.js';

const { values } = parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
    },
    port: {
      type: 'string',
      short: 'p',
    },
    open: {
      type: 'boolean',
      short: 'o',
    },
  },
  strict: false,
});

const promptDirRaw = values.dir;
const promptDir = typeof promptDirRaw === 'string' ? promptDirRaw : (process.env.PROMPT_DIR || process.env.DIR);

const portRaw = values.port;
const portStr = typeof portRaw === 'string' ? portRaw : (process.env.PORT || '3000');
const port = parseInt(portStr, 10);
const open = !!values.open;

if (!promptDir) {
  console.error('Error: Target directory is required. Specify it via --dir <path> or PROMPT_DIR environment variable.');
  process.exit(1);
}

try {
  const stats = fs.statSync(promptDir);
  if (!stats.isDirectory()) {
    console.error(`Error: Target path "${promptDir}" is not a directory.`);
    process.exit(1);
  }
} catch (err) {
  console.error(`Error: Target directory "${promptDir}" does not exist or is inaccessible: ${(err as Error).message}`);
  process.exit(1);
}

const app = createServer(promptDir);

app.listen(port, () => {
  console.log(`[Studio Server] Listening on http://localhost:${port}`);
  console.log(`[Studio Server] Target prompt directory: ${promptDir}`);
  if (open) {
    const url = `http://localhost:${port}`;
    let cmd = '';
    if (process.platform === 'darwin') {
      cmd = `open "${url}"`;
    } else if (process.platform === 'win32') {
      cmd = `start "" "${url}"`;
    } else {
      cmd = `xdg-open "${url}"`;
    }
    exec(cmd, (err) => {
      if (err) {
        console.error(`[Studio Server] Failed to automatically open browser: ${err.message}`);
      }
    });
  }
});
