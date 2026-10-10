# Story Studio workflow upgrade

This is the real Next.js application at `/app`, migrated from the approved visual prototype. It is not the mock HTML. The home page, gallery, Supabase authentication, image endpoints, and provider integrations remain in the project.

## Included

- Warm-white / green-ink / coral workspace, four-step navigation, responsive layouts, Chinese and English copy.
- Text planning is separated from paid image generation. Review and edit characters, scenes, camera direction, and dialogue before confirming generation.
- The requested frame count reaches the storyboard endpoint as a validated planning target. The reviewed model response is the final count.
- Sequential image generation, single-run protection, cooperative pause, missing/stale-frame continuation, and completed-frame saves before the next request.
- Per-frame redraw / image modification, three previous images, PNG comic pages, original-image ZIP, project JSON backup, gallery sharing, and sign-in continuation.
- Legacy project compatibility, blank project creation, atomic image revisions, serialized saves, cross-tab Web Locks, safe read failures, and inline-image storage in IndexedDB.
- Minimal backend integration repairs: use the installed `@google/genai` SDK, configurable server-side model IDs, complete panel-cache inputs, preserve style in refinement, and remove overlapping redraw timeout retries.

## Run and verify

Use Node 24 for the dependency-free storage/workflow tests (they use Node's TypeScript stripping). The repository's `pnpm-lock.yaml` covers the current dependencies. Its existing `package-lock.json` is stale and omits 14 dependencies, so use pnpm until the npm lockfile is regenerated and reviewed in a network-enabled environment.

```sh
corepack pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm exec biome check src/components/studio src/lib/studioWorkflow.ts src/lib/studioExport.ts
pnpm build
pnpm dev
```

The existing `npm run lint` script uses `--write` and changes files. Run it only in a clean working copy and inspect its diff. New tests are fully mocked; none consume model credits or authenticate to external services.

### Verification performed in the implementation environment

- 19 storage regression tests passed.
- 11 pure workflow / API-error / export-URL tests passed.
- 8 mocked component interaction tests passed. They check planning-only calls, failed replan preservation, double-click generation, selected-style no-op, changed-story guard, one-frame invalidation, saved navigation, and late upload isolation.
- TypeScript / TSX parser checks and `git diff --check` passed.
- Dependency installation was blocked with npm registry HTTP 403. The `typecheck`, `build`, and `lint` commands were attempted, but their executables were unavailable. No semantic typecheck, full build, or real React browser run is claimed.
- The cloud browser could not reach this executor's local preview server. Static snapshot generation is available through `STUDIO_SNAPSHOT_DIR`, but it is not a replacement for a real application browser test.

Before merging, perform the full commands above and browser tests for desktop/mobile, reload, multi-project switching, pause/resume, failed model responses, login-and-share, and multi-page image exports. No paid model calls were made during implementation.

## Model configuration

Keep provider keys on the server in the deployment platform's secret settings, never in the repository or a `NEXT_PUBLIC_` variable. Existing Google and Volcengine settings are retained. `GOOGLE_IMAGE_MODEL` and `GOOGLE_TEXT_MODEL` allow model selection without another UI release. Image calls now use the declared `@google/genai` dependency instead of the undeclared legacy SDK.

The old image-preview ID was retired. The conservative fallback is `gemini-2.5-flash-image`, with a configurable override. The official lifecycle page was checked on 2026-10-10; provider access and output quality still require an operator smoke test: https://ai.google.dev/gemini-api/docs/deprecations/

Neowow is not integrated in this patch. A current, verified CLI-key contract is needed for text planning, image generation/editing, polling, reference uploads, and CORS. `requestStudioApi` and the existing server routes provide a bounded integration seam; a chat-only token must not be assumed to authorize image APIs.

## Deployment boundary

This app still has Next.js server POST routes. GitHub Pages alone cannot execute those routes. Keep a Node/Next-capable host or design a separately reviewed server gateway before pursuing a static deployment. This update does not deploy, change production credentials, or merge main.

## Important limits

- Browser-local projects are not cross-device synchronized. JSON / ZIP backups contain editable project data and images; there is currently no new one-click project-import UI.
- Pausing stops new client requests after the current request completes. Closing a tab cannot cancel work already running on a provider, and provider-level fallback behavior still belongs to the existing router.
- The generation endpoints and image proxy retain the repository's existing authorization and remote-URL handling. They need a separate security review before exposing a new public paid deployment.
- Cross-tab locking covers cooperating tabs using this implementation. Concurrent edits can still follow last-writer-wins semantics; do not edit one project in multiple tabs. Browsers without Web Locks keep old image revisions rather than risk destructive cleanup.
- Storage failures visibly request a project backup and do not claim a successful save.
