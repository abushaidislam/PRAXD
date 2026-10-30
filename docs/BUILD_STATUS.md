# PRAXD Build Status

**Last updated:** 2026-10-30  
**Current phase:** Phase 1 — MVP PR Inbox & Summary/Code Split View with Live GitHub Integration  
**Build status:** Phase 0 & Phase 1 Complete & Verified (Ready for Phase 2)

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

## Quality Checks & Verification

- `typecheck` (`npm run typecheck`): Passed (0 errors).
- `test` (`npm run test`): Passed 27/27 acceptance tests across 4 test suites:
  - `tests/phase0-workspace.test.tsx` (9 tests: shell, tabs, search, selection, split/unified diffs, keyboard shortcut `Ctrl+B`, binary fallback, merge guardrail)
  - `tests/phase1-state.test.ts` (5 tests: P1-01 valid state token, P1-02 omitted/tampered/expired/reused state rejection)
  - `tests/phase1-github-sync.test.ts` (11 tests: P1-05 canonical PR state mapping, P1-06 Link pagination, P1-07 binary honesty, P1-08 comment segregation, P1-09 head SHA check run isolation, P1-10 403 & 429 rate limit parsing)
  - `tests/phase1-workspace-isolation.test.ts` (2 tests: P1-11 tenant isolation, P1-12 installation suspension/revocation)
- `lint` (`npm run lint`): Passed (0 errors, 0 warnings).
- `build` (`npm run build`): Passed (15 dynamic API routes + static pages compiled successfully).

## Next Task

Begin **Phase 2 — Webhook Automation & Real-time Reconciliation**:
1. Implement HMAC-SHA256 signature verification route (`/api/webhooks/github`) using raw request body.
2. Webhook delivery deduplication using `webhook_deliveries` table.
3. Event handlers for `pull_request`, `pull_request_review`, `pull_request_review_comment`, `issue_comment`, `check_run`, `installation`, and `installation_repositories`.
