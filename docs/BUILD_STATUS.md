# PRAXD Build Status

**Last updated:** 2026-10-30  
**Current phase:** Phase 2 — Webhooks & Live Synchronization Complete  
**Build status:** Phase 0, Phase 1 & Phase 2 Complete & Verified (Ready for Phase 3)

## Completed in Phase 0

- [x] Product requirements and MVP scope (updated with UX ergonomics & safe merge guardrails)
- [x] Screenshot-derived UI/UX specification (`docs/UI_UX_SPEC.md`)
- [x] Architecture Decision Records (`0001-initial-architecture.md`, `0002-ui-ux-ergonomics-and-diff-navigation.md`)
- [x] Next.js App Router scaffolded with strict TypeScript, Tailwind CSS, Lucide icons
- [x] Screenshot-matched dual-pane PR workspace:
  - Persistent left PR inbox (~420px, All/Reviewing/Authored tabs, search, filter, group selector, compact PR items, collapsible sidebar via toggle & `Cmd/Ctrl+B`)
  - Main workspace header (PR title, breadcrumb, Summary/Code toggle, GitHub link, disabled Chat affordance, guarded disabled Merge button)
  - Summary view (exact reproduction of screenshots: title with shield icon, author metadata, branch comparison, requested reviewers, comments, checks, collapsible description with styled vulnerability breakdown, checks list, activity timeline, leave comment input)
  - Code view (breadcrumb toolbar with branch flow, sticky multi-file selector dropdown, split vs unified diff toggle, file header, unmodified lines folding, side-by-side split diff with independent line numbers and syntax highlighting, gutter comment hover `+` affordance, inline comment threads, PRAXD AI review finding callout anchor, fallback for binary/missing patch files)
  - Demo mode notice badge explicitly marking local fixture mode

## Completed in Phase 1

- [x] Supabase TypeScript Database schema definition (`types/database.ts`) reflecting tables and RLS constraints
- [x] Supabase server & client wrappers (`lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/auth.ts`)
- [x] Multi-tenant workspace isolation & session verification
- [x] Cryptographic OAuth `state` parameter management with HMAC-SHA256, expiration, and single-use replay prevention (`lib/github/state.ts`)
- [x] Server-only GitHub App authentication:
  - RS256 JWT generation with private key (`lib/github/app-auth.ts`)
  - Installation access token generation and caching
- [x] GitHub REST client with Link header pagination, rate limit tracking, 403/429 error handling (`lib/github/client.ts`)
- [x] Canonical GitHub Synchronization Engine (`lib/github/sync.ts`):
  - Repository upsert with `(installation_id, github_repo_id)` natural idempotency key
  - Canonical PR state mapping: `merged_at != null` -> `merged`, `state == 'closed'` -> `closed`, else `open`
  - PR upsert with `(repository_id, number)` natural key
  - Changed files sync with patch honesty (`patch_available: false` for binary/omitted diffs)
  - Commits sync
  - Review records sync
  - Comment segregation: conversation comments (`issue`) vs inline diff comments (`review`)
  - Check runs sync: strictly filtered to PR current `head_sha`
- [x] Internal REST API Endpoints:
  - `GET /api/me`
  - `GET /api/workspaces/current`
  - `GET /api/github/install`
  - `GET /api/github/callback`
  - `GET /api/github/installations`
  - `GET /api/repositories`
  - `POST /api/repositories/:repositoryId/sync`
  - `GET /api/pull-requests` (with `view`, `state`, `q` filters)
  - `GET /api/pull-requests/:id`
  - `GET /api/pull-requests/:id/files`
  - `GET /api/pull-requests/:id/commits`
  - `GET /api/pull-requests/:id/reviews`
  - `GET /api/pull-requests/:id/comments`
  - `GET /api/pull-requests/:id/checks`
  - `POST /api/pull-requests/:id/refresh`
- [x] UI GitHub Connect Modal & Live/Fixtures Mode toggle (`components/github-connect-modal.tsx`, `components/demo-mode-badge.tsx`)

## Completed in Phase 2

- [x] Public webhook route (`/api/webhooks/github`) using Node.js runtime and raw request bytes (`export const runtime = 'nodejs'`)
- [x] HMAC SHA-256 verification using `X-Hub-Signature-256` and constant-time buffer comparison (`lib/github/webhook-verify.ts`)
- [x] Validated against official GitHub published test vector (`It's a Secret to Everybody` / `Hello, World!`)
- [x] Payload size cap (24 MB) and required header enforcement (`x-github-delivery`, `x-github-event`, `content-type`)
- [x] Durable delivery ingestion into `webhook_deliveries` with unique `delivery_id` and SHA-256 payload digest (no raw payload storage)
- [x] Webhook delivery deduplication (re-delivered GUIDs return acknowledgement without re-executing duplicate work)
- [x] Event handlers (`lib/github/webhook-handlers.ts`):
  - `pull_request` (opened, synchronize, closed, reopened, edited)
  - PR head SHA forward-only invariant: out-of-order events cannot roll head SHA backward
  - `pull_request_review` (submitted, edited, dismissed)
  - `pull_request_review_comment` (diff line comments)
  - `issue_comment` (PR conversation comments only; ordinary issue comments marked `ignored`)
  - `check_run` (upserted by `(repository_id, github_check_id)`)
  - `installation` (created, deleted, suspend, unsuspend)
  - `installation_repositories` (additions synced; removed repositories marked `is_accessible: false`)
- [x] Reconciliation and dead-letter recovery engine (`lib/github/reconciler.ts`) with bounded retries and safe error codes

## Quality Checks & Verification

- `typecheck` (`npm run typecheck`): Passed (0 errors).
- `test` (`npm run test`): Passed 38/38 acceptance tests across 5 test suites:
  - `tests/phase0-workspace.test.tsx` (9 tests: shell, tabs, search, selection, split/unified diffs, keyboard shortcut `Ctrl+B`, binary fallback, merge guardrail)
  - `tests/phase1-state.test.ts` (5 tests: P1-01 valid state token, P1-02 omitted/tampered/expired/reused state rejection)
  - `tests/phase1-github-sync.test.ts` (11 tests: P1-05 canonical PR state mapping, P1-06 Link pagination, P1-07 binary honesty, P1-08 comment segregation, P1-09 head SHA check run isolation, P1-10 403 & 429 rate limit parsing)
  - `tests/phase1-workspace-isolation.test.ts` (2 tests: P1-11 tenant isolation, P1-12 installation suspension/revocation)
  - `tests/phase2-webhooks.test.ts` (11 tests: P2-01 canonical test vector, P2-02 byte tampering/whitespace mutation rejection, P2-03 header prefix/secret validation, P2-04 delivery deduplication, P2-06 out-of-order forward-only SHA invariant, P2-07 repo removal access revocation, P2-09 check run idempotency, P2-11 bounded retries and safe error code)
- `lint` (`npm run lint`): Passed (0 errors, 0 warnings).
- `build` (`npm run build`): Passed (16 dynamic API routes + static pages compiled successfully).

## Next Task

Begin **Phase 3 — AI Review Engine & User Actions**:
1. Manual **Run AI Review** button and state machine (`queued` -> `running` -> `completed` / `failed` / `stale`).
2. Per-PR concurrency guard and immutable head SHA binding.
3. Bounded diff and patch context builder.
4. AI Review Provider adapter with structured JSON Schema output validation (`docs/AI_REVIEW_SPEC.md`).
5. Persisting to `ai_review_runs` and `ai_findings` with diff anchor deep-linking.
