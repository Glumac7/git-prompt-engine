import { parseArgs } from 'node:util';
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
  },
  strict: false,
});

const promptDirRaw = values.dir;
const promptDir = typeof promptDirRaw === 'string' ? promptDirRaw : (process.env.PROMPT_DIR || process.env.DIR);

const portRaw = values.port;
const portStr = typeof portRaw === 'string' ? portRaw : (process.env.PORT || '3000');
const port = parseInt(portStr, 10);

if (!promptDir) {
  console.error('Error: Target directory is required. Specify it via --dir <path> or PROMPT_DIR environment variable.');
  process.exit(1);
}

const app = createServer(promptDir);

app.listen(port, () => {
  console.log(`[Studio Server] Listening on http://localhost:${port}`);
  console.log(`[Studio Server] Target prompt directory: ${promptDir}`);
});
