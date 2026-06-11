# Git-Backed Prompt Engine Tasks

## Completed Milestones

### [x] Milestone 1: Production CLI & Single Command Launch
- [x] Add `"bin"` property to `packages/studio/server/package.json` pointing to `./dist/index.js`.
- [x] Add shebang `#!/usr/bin/env node` to `packages/studio/server/src/index.ts`.
- [x] Support `open` option (boolean, short `-o`) in `parseArgs` configuration in `index.ts`.
- [x] In the `app.listen` callback of `index.ts`, check if `open` is true and execute the platform-specific command to automatically launch the default browser.
- [x] Update `packages/studio/server/src/server.ts` to register `clientDistPath` (`../../client/dist`) as static middleware.
- [x] Add a regex-based SPA catch-all route at the bottom of the API routes in `server.ts` to serve `index.html` for all paths that do not start with `/api`.
- [x] Build packages and verify tests pass cleanly without errors.

### [x] Milestone 2: Actual LLM API Execution in Playground
- [x] Create service `packages/studio/server/src/services/llm.service.ts` to fetch and parse streamed completions from Google (Gemini), OpenAI, and Anthropic.
- [x] Create controller `packages/studio/server/src/controllers/llm.controller.ts` to handle `POST /api/v1/playground/run` and write unified SSE events.
- [x] Register `/api/v1/playground/run` route in `packages/studio/server/src/server.ts`.
- [x] Implement `runPlaygroundPrompt` streaming fetch in client API service (`packages/studio/client/src/services/api.ts`).
- [x] Integrate Model Provider, Model Name, and API Key settings sidebar inputs inside `packages/studio/client/src/components/Playground.tsx`, persisting values to localStorage.
- [x] Add "Run Prompt" action in Playground sidebar, displaying real-time streaming "Model Response" directly in the chat transcript.
- [x] Add comprehensive service, controller, and client API tests, ensuring full test coverage and clean builds.

### [x] Milestone 4: Advanced Git Interactions
- [x] Update `packages/studio/server/src/services/git.service.ts` to implement:
  - `getGitStatus()`: returning current branch, local branches, and clean/dirty status.
  - `checkoutBranch(name, create)`: checking out/creating branch.
  - `pushBranch()`: pushing current branch to origin.
- [x] Update `packages/studio/server/src/controllers/git.controller.ts` to add endpoints:
  - `GET /api/v1/git/status`: returns git status.
  - `POST /api/v1/git/branch`: switches/creates a branch. Body: `{ name: string, create?: boolean }`
  - `POST /api/v1/git/push`: pushes current branch.
- [x] Update `packages/studio/server/src/server.ts` to register endpoints.
- [x] Update client API service (`packages/studio/client/src/services/api.ts`) to expose functions.
- [x] Update client UI (`packages/studio/client/src/components/Header.tsx`) to show branch selector dropdown and push button.
- [x] Verify changes by running `npm test` and manually testing. Add unit and integration tests.
