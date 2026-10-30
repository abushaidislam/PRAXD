# PRAXD Build Status

**Last updated:** 2026-10-30  
**Current phase:** Phase 2 — Webhook Automation & Real-time Reconciliation  
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

- [x] HMAC-SHA256 GitHub Webhook signature verification (`lib/github/webhook-verify.ts`):
  - Validates `X-Hub-Signature-256` header against raw payload body
  - Timing-safe comparison to prevent timing attacks
- [x] Webhook route & delivery deduplication (`app/api/webhooks/github/route.ts`):
  - Ingestion endpoint with strict raw body buffering
  - `X-GitHub-Delivery` delivery tracking and idempotency check
  - Fast HTTP 202 response and async background event dispatch
- [x] Granular Webhook Event Handlers (`lib/github/webhook-handlers.ts`):
  - `pull_request` (`opened`, `synchronize`, `closed`, `reopened`, `edited`)
  - `pull_request_review` (`submitted`, `dismissed`)
  - `pull_request_review_comment` (`created`, `edited`, `deleted`)
  - `issue_comment` (`created`, `edited`, `deleted`)
  - `check_run` (`completed`, `created`, `rerequested`)
  - `installation` (`created`, `deleted`, `suspend`, `unsuspend`)
  - `installation_repositories` (`added`, `removed`)
- [x] Self-healing Reconciler (`lib/github/reconciler.ts`) for missing parent records and periodic sync

## Quality Checks & Verification

- `typecheck` (`npm run typecheck`): Passed (0 errors).
- `test` (`npm run test`): Passed 38/38 acceptance tests across 5 test suites:
  - `tests/phase0-workspace.test.tsx` (9 tests)
  - `tests/phase1-state.test.ts` (5 tests)
  - `tests/phase1-github-sync.test.ts` (11 tests)
  - `tests/phase1-workspace-isolation.test.ts` (2 tests)
  - `tests/phase2-webhooks.test.ts` (11 tests)
- `lint` (`npm run lint`): Passed (0 errors, 0 warnings).

## Next Task

Begin **Phase 3 — AI Review Engine & Guardrails**:
1. Implement provider-agnostic LLM interface with fallback and token budgeting.
2. Build diff chunking and context window packing.
3. Validate structured AI review findings (file, line range, severity, category, recommendation) using Zod.
