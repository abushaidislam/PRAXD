# PRAXD Build Status

**Last updated:** 2026-10-30  
**Current phase:** Phase 4 — Publishing, Audit Logs & Production Hardening Complete  
**Build status:** All Phases (0, 1, 2, 3, and 4) 100% Complete & Verified

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

## Completed in Phase 3

- [x] Strict Zod schemas for AI Review structured output matching Draft 2020-12 spec (`types/ai-review.ts`):
  - `aiReviewFindingSchema`, `aiReviewOutputSchema`
  - Safe error handling and validation result types
- [x] Diff & context bounding engine (`lib/ai/context-builder.ts`):
  - System instruction boundary safety (PR metadata and diffs treated as data, never instructions)
  - Automatic secret/credential redaction in patches and diff context (`[REDACTED_SECRET]`)
  - Per-file patch truncation (16 KB) and overall review context byte cap (200 KB)
- [x] Deterministic finding fingerprint generator (`lib/ai/fingerprint.ts`):
  - SHA-256 hash over `(repository_id, pr_number, kind, file_path, rule_key, line_start)`
  - Natural deduplication and idempotency across repeated reviews
- [x] Server-side semantic validator (`lib/ai/validator.ts`):
  - Verifies cited file exists in the PR fileset
  - Validates line start and end ranges against touched lines
  - Verifies exact excerpt match against patch content
  - Filters out ungrounded or hallucinated findings before storage
- [x] Provider-agnostic AI Reviewer interface (`lib/ai/reviewer.ts`):
  - `DeterministicReviewer` for offline, test, and fixture review runs
  - `OpenAIReviewer` using Responses API / Structured JSON Output
- [x] Lifecycle & Concurrency Guard (`lib/ai/lifecycle.ts`):
  - Per-PR concurrency guard: re-entrant calls return the active run without duplicate execution
  - Immutable head SHA binding: marks stale runs if head SHA has progressed
  - State machine transitions: `queued` -> `running` -> `completed` / `failed` / `stale`
- [x] AI Review REST API Endpoints:
  - `POST /api/pull-requests/[pullRequestId]/ai-review`: Manual trigger with concurrency guard
  - `GET /api/pull-requests/[pullRequestId]/ai-review/runs`: List runs and associated findings
  - `PATCH /api/ai-findings/[findingId]`: Finding lifecycle actions (`open`, `accepted`, `dismissed`)
- [x] Interactive AI Review Panel (`components/ai-review-panel.tsx`):
  - "Run AI Review" button with running state spinner
  - Overall risk level badge (high, medium, low, unknown)
  - Findings list with severity badges (`critical`, `high`, `medium`, `low`, `info`)
  - Code excerpt snippet display and recommendation details
  - Accept / Dismiss user actions
  - Integrated into `components/summary-view.tsx`
- [x] Comprehensive Acceptance Test Suite (`tests/phase3-ai-review.test.ts`):
  - P3-01: Schema validation accepts conforming JSON and rejects malformed payloads
  - P3-02: Secret redaction in context builder
  - P3-03: Context byte and file bounding
  - P3-04: Deterministic fingerprint generation
  - P3-05: Server-side validation drops ungrounded findings
  - P3-06: Concurrency guard returns active run
  - P3-07: Head SHA change marks older runs stale
  - P3-08: Advisory review constraint (never auto-merges or publishes to GitHub)
  - P3-09: User finding lifecycle transitions (`open` -> `accepted` / `dismissed`)

## Completed in Phase 4

- [x] Immutable Workspace Audit Logging System (`lib/audit/logger.ts`):
  - Structured audit trail recorded into `audit_logs` table
  - Automatic credential and token redaction (`[REDACTED]`) from all event metadata
  - Safe error handling that never crashes or leaks secrets
  - Event coverage: `ai_review.requested`, `ai_review.completed`, `ai_review.failed`, `ai_finding.status_updated`, `ai_finding.published_to_github`
- [x] Workspace Audit Logs Endpoint:
  - `GET /api/workspaces/current/audit-logs`
  - Scoped strictly to authenticated workspace
  - Bounded pagination parameters (`limit` 1..100, `offset` >= 0)
- [x] Opt-In User-Confirmed GitHub Finding Publication:
  - `POST /api/ai-findings/[findingId]/publish`
  - Enforces explicit `confirmed: true` confirmation
  - Verifies target PR is currently open
  - Uses server-side GitHub App installation access token
  - Preserves local finding record intact even if GitHub publish fails
  - Fully integrated with interactive UI confirmation in `components/ai-review-panel.tsx`
- [x] System Health & Readiness Endpoint:
  - `GET /api/health`
  - Verifies PostgreSQL database connectivity, latency, and system environment
  - Returns HTTP 200 (`healthy`) / HTTP 503 (`degraded`)
- [x] Phase 4 Acceptance Test Suite (`tests/phase4-audit-hardening.test.ts`):
  - P4-01: Secret and sensitive token sanitization in audit metadata
  - P4-02: Safe error handling without throwing unhandled exceptions
  - P4-03: Explicit confirmation requirement enforcement
  - P4-04: Rejection of closed or merged pull requests
  - P4-05: Non-destructive failure preservation of findings
  - P4-06: Strictly bounded audit pagination parameters
  - P4-07: Conforming system health response structure

## UI Polish & Ergonomic Improvements

- [x] Header Centering: Centered `Summary | Code` segmented tabs in main content header.
- [x] Sidebar Tabs Centering: Centered `All | Reviewing | Authored` tab list in sidebar header.
- [x] Resizable Inbox Sidebar: Linear-style grab handle with magnetic snap points (340px, 420px, 540px), boundary clamping (280px - 720px), persistent localStorage, live HUD dimension badge, and double-click reset.
- [x] Author Avatars: Display author profile images with fallback monogram badges across all PR list items.
- [x] Diff Alignment: Unified split diff rows (`lib/diff-parser.ts`) preventing vertical height desynchronization, line wrap toggle, and synchronized inline annotation containers.
- [x] Synchronized Dual-Pane Horizontal Scroll:
  - Synchronized horizontal scroll (`scrollX`) lockstep across both Old Revision (Base) and New Revision (Head) code columns.
  - Pinned line numbers (gutters) and fixed column dividers preventing gutter scroll-off.
  - Multi-input support: trackpad horizontal swipe (`deltaX`), mouse wheel with Shift (`deltaY`), keyboard arrow keys (`ArrowLeft`, `ArrowRight`, `Home`, `End`).
  - Interactive bottom synchronized scrollbar with draggable thumb, click-to-jump track, step nudge buttons (`<` and `>`), and instant "Reset to start" affordance.
  - Subheader indicator with clear Base (Old) and Head (New) column badges, plus a `Sync Scroll` status badge in the toolbar.

## Quality Checks & Verification

- `typecheck` (`npm run typecheck`): Passed (0 errors).
- `test` (`npm run test`): Passed 54/54 acceptance tests across 7 test suites:
  - `tests/phase0-workspace.test.tsx` (9 tests: shell, tabs, search, selection, split/unified diffs, keyboard shortcut `Ctrl+B`, binary fallback, merge guardrail)
  - `tests/phase1-state.test.ts` (5 tests: P1-01 valid state token, P1-02 omitted/tampered/expired/reused state rejection)
  - `tests/phase1-github-sync.test.ts` (11 tests: P1-05 canonical PR state mapping, P1-06 Link pagination, P1-07 binary honesty, P1-08 comment segregation, P1-09 head SHA check run isolation, P1-10 403 & 429 rate limit parsing)
  - `tests/phase1-workspace-isolation.test.ts` (2 tests: P1-11 tenant isolation, P1-12 installation suspension/revocation)
  - `tests/phase2-webhooks.test.ts` (11 tests: P2-01 canonical test vector, P2-02 byte tampering/whitespace mutation rejection, P2-03 header prefix/secret validation, P2-04 delivery deduplication, P2-06 out-of-order forward-only SHA invariant, P2-07 repo removal access revocation, P2-09 check run idempotency, P2-11 bounded retries and safe error code)
  - `tests/phase3-ai-review.test.ts` (9 tests: P3-01 schema validation, P3-02 secret redaction, P3-03 context byte cap, P3-04 deterministic fingerprinting, P3-05 semantic evidence grounding, P3-06 concurrency guard, P3-07 stale head SHA invalidation, P3-08 advisory boundary, P3-09 finding lifecycle status transitions)
  - `tests/phase4-audit-hardening.test.ts` (7 tests: P4-01 audit metadata token sanitization, P4-02 database error resilience, P4-03 confirmation requirement, P4-04 closed PR rejection, P4-05 non-destructive failure preservation, P4-06 bounded pagination, P4-07 health status schema)
- `lint` (`npm run lint`): Passed (0 errors, 0 warnings).
- `build` (`npm run build`): Passed (22 dynamic API routes + static pages compiled successfully).
