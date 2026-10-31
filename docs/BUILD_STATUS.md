# PRAXD Build Status

**Last updated:** 2026-10-31  
**Current version:** v0.3.0 (Post-MVP Evolution)  
**Current phase:** Phase 7 — Automated Policy Engine & CI/CD Bot Mode (Next in Queue)  
**Build status:** Phases 0, 1, 2, 3, 4 (MVP), Phase 5, and Phase 6 are 100% Complete & Verified (77/77 Automated Tests Passing)

## Active Post-MVP Roadmap (v0.2.0 — v0.5.0)

- [x] **Phase 5 (v0.2.0):** Interactive PR Assistant & Contextual Chat (Header `Chat` affordance activated with slide-out drawer, streaming SSE, 32 KB diff-bounded reasoning, copy buttons, line-citation deep linking, and `/explain`, `/test-ideas`, `/draft-response`, `/security-audit` slash commands)
- [x] **Phase 6 (v0.3.0):** Team Collaboration, GitHub SSO & Real-Time Presence (GitHub OAuth profile hydration, real-time reviewer presence heartbeats with live file inspection pills, shared workspace-only internal notes with `@mention` tagging, and 5-role RBAC enforcement)
- [ ] **Phase 7 (v0.4.0):** Automated Policy Engine, CI/CD Bot Mode & Risk Scoring (0–100 composite risk score, event-driven webhooks, Slack/Discord alerts)
- [ ] **Phase 8 (v0.5.0):** Multi-Model LLM Adapters & Enterprise Governance (Anthropic Claude, Google Gemini, Ollama/vLLM, automated patch retention purging)

---

## Completed in Phase 0 (MVP Shell)

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
  - Official PRAXD brand logo integration across the workspace (`public/logo.png`, `public/favicon.ico`, `app/icon.png`, `app/apple-icon.png`, `components/brand-logo.tsx`) in layout metadata, top status badge, sidebar header, collapsed-header brand mark, connect modal, and empty states

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

## Completed in Phase 5 (Interactive PR Assistant & Contextual Chat)

- [x] Slide-out / Split-pane PR Chat Drawer (`components/pr-chat.tsx`):
  - Accessible via header **Chat** button and `Cmd/Ctrl + K` or `Cmd/Ctrl + J` shortcut.
  - Dark, information-dense UI styled in `#111111` / `#161616` matching the approved PRAXD design language.
  - Streaming Markdown renderer supporting headers, bullet points, blockquotes, and inline code.
  - Syntax-highlighted code blocks with language badge and one-click "Copy" confirmation.
  - Interactive "View in Diff" deep-links from cited code lines (e.g. `extension/content.js:1644`) that navigate to the Code view and focus the cited file.
  - Expandable / collapsible reasoning step pills ("Analyzing diff...", "Scanning touched files...").
  - Stop generation button (`Square` icon) to cleanly abort active streams without error states.
- [x] Streaming Server-Sent Events (SSE) Route (`app/api/pull-requests/[pullRequestId]/chat/stream/route.ts`):
  - Next.js App Router streaming endpoint using Node.js runtime (`export const runtime = 'nodejs'`).
  - Emits real-time event types: `status`, `reasoning`, `delta`, `citation`, `done`, and `error`.
  - Multi-provider support via `lib/ai/chat-stream.ts`:
    - Google Gemini Streaming (`gemini-2.5-flash` via `streamGenerateContent?alt=sse`)
    - OpenAI Streaming (`gpt-4o` via Chat Completions SSE)
    - Deterministic chunked generator for offline demo mode, fixture mode, and CI test suites
- [x] Context-Hydrated Retrieval & Strict 32 KB Bounding (`lib/ai/chat-context.ts`):
  - Ingestion of active PR metadata (title, body, author, branches, head SHA, checks summary, prior AI findings).
  - Strict diff patch slice bounding (`CHAT_MAX_DIFF_BYTES = 32768`).
  - Omitted file tracking and coverage notice banner when diffs exceed 32 KB.
  - Automatic token and credential sanitization (`[REDACTED_SECRET]`) across all user messages and diff content.
  - System instruction boundary safety: PR titles, descriptions, and patch contents quarantined as untrusted DATA ONLY.
- [x] Actionable Copilot Slash Commands (`types/chat.ts`):
  - `/explain` — Architectural walkthrough and structural impact analysis.
  - `/test-ideas` — Unit, edge-case, and boundary test recommendations.
  - `/draft-response` — Empathetic, constructive GitHub review comment drafts.
  - `/security-audit` — Deep-dive taint analysis on user inputs and DOM manipulation sinks.
- [x] Chat History Store & REST Endpoints (`lib/ai/chat-store.ts`, `app/api/pull-requests/[pullRequestId]/chat/messages/route.ts`):
  - Multi-tenant workspace and PR scoping (`workspaceId:pullRequestId`).
  - `GET /api/pull-requests/[pullRequestId]/chat/messages` for loading persisted conversation history.
  - `DELETE /api/pull-requests/[pullRequestId]/chat/messages` for clearing conversation history.
- [x] Workspace Header & Code Navigation Integration (`components/workspace-header.tsx`, `components/pr-workspace.tsx`, `components/code-view.tsx`):
  - Enabled active header `Chat` affordance with visual indicator, icon, and pressed state.
  - Integrated keyboard shortcuts (`Cmd/Ctrl+K` and `Cmd/Ctrl+J`).
  - Integrated deep-link file navigation into `CodeView`.
- [x] Comprehensive Acceptance Test Suite (`tests/phase5-chat.test.ts`):
  - P5-01: Context builder bounds prompt size to 32 KB active diff slice.
  - P5-02: Secrets and sensitive tokens are redacted from user chat inputs and context (`[REDACTED_SECRET]`).
  - P5-03: Code citation extraction correctly identifies file paths and line ranges.
  - P5-04: Actionable slash commands trigger specialized reasoning and outputs.
  - P5-05: Untrusted PR data boundary validation quarantines prompt injections.
  - P5-06: Chat conversation history persists per PR and enforces workspace isolation.
  - P5-07: Chat history deletion clears PR messages cleanly.
  - P5-08: POST `/api/pull-requests/[pullRequestId]/chat/stream` emits SSE stream headers and valid events.
  - P5-09: GET and DELETE `/api/pull-requests/[pullRequestId]/chat/messages` routes manage history.

## Completed in Phase 6 (Team Collaboration, GitHub SSO & Real-Time Presence)

- [x] GitHub OAuth Social Login & Profile Onboarding (`lib/auth/github-sso.ts`):
  - Seamless profile hydration (`display_name`, `avatar_url`, `login`) from GitHub OAuth session.
  - Automatic workspace provisioning and membership initialization with `owner` role.
- [x] Real-Time Multiplayer Presence Engine (`lib/realtime/presence.ts`, `app/api/pull-requests/[pullRequestId]/presence/route.ts`):
  - In-memory WebSocket / subscription presence broker per PR.
  - Live presence heartbeat tracking active reviewers, active view (`summary` vs `code`), and active inspected file/line.
  - Automatic 15s inactivity stale presence pruning (`PRESENCE_TIMEOUT_MS`).
- [x] Shared Team Internal Notes & Mentions (`lib/notes/internal-notes-store.ts`, `app/api/pull-requests/[pullRequestId]/internal-notes/route.ts`):
  - Private workspace-only discussion threads that are NEVER published to GitHub.
  - Automated regex `@mention` parsing (`@username`).
  - Delete authorization enforced via `canDeleteNote`.
- [x] Workspace Member Invitations & Management (`lib/auth/invitations.ts`, `app/api/workspaces/current/invitations/route.ts`, `app/api/workspaces/current/members/route.ts`):
  - Cryptographically signed HMAC invitation tokens with 7-day expiration (`expiresInDays: 7`).
  - Single-use redemption protection and tampering validation.
  - Role assignment (`admin`, `reviewer`, `viewer`, `member`).
- [x] Role-Based Access Control (RBAC) Enforcement (`lib/auth/rbac.ts`):
  - Defined strict permission matrix across all 5 roles (`owner`, `admin`, `reviewer`, `member`, `viewer`).
  - Guarded `POST /api/pull-requests/[pullRequestId]/ai-review`: `viewer` role blocked with HTTP 403 `PERMISSION_DENIED`.
  - Guarded `POST /api/ai-findings/[findingId]/publish`: `viewer` role blocked with HTTP 403 `PERMISSION_DENIED`.
- [x] Collaboration UI Components (`components/presence-avatars.tsx`, `components/internal-notes-panel.tsx`, `components/team-management-modal.tsx`):
  - Live presence avatar pills in workspace header with inspection status tooltips.
  - Team collaboration button in header to open member management & invite modal.
  - Internal discussion panel embedded in `SummaryView` with private badge and `@mention` styling.
- [x] Comprehensive Acceptance Test Suite (`tests/phase6-collaboration.test.ts`):
  - P6-01: GitHub OAuth profile onboarding hydrates user profile and provisions default workspace.
  - P6-02: Workspace member invitation creates cryptographically signed token with 7-day expiration.
  - P6-03: Invitation redemption validates signature, rejects expired/tampered tokens, and enrolls member.
  - P6-04: Real-time multiplayer presence tracks active reviewers, broadcasts file/line inspection, and prunes stale users.
  - P6-05: Shared team internal notes extracts @mentions, persists notes per workspace, and isolates them from GitHub.
  - P6-06: RBAC enforcement: Viewers cannot trigger billable AI reviews (HTTP 403 `PERMISSION_DENIED`).
  - P6-07: RBAC enforcement: Viewers cannot publish findings to GitHub (HTTP 403 `PERMISSION_DENIED`).
  - P6-08: RBAC permissions matrix correctly defines role boundaries across all roles.
  - P6-09: Cross-tenant isolation guarantees notes and invitations from Workspace A cannot be read by Workspace B.

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

## Live AI Review & Production Model Readiness

- [x] Multi-Provider AI Review Engine (`lib/ai/reviewer.ts`):
  - Google Gemini API reviewer (`GeminiReviewer`) supporting `gemini-2.5-flash` / `gemini-2.5-pro` with structured JSON output and markdown code-fence sanitization.
  - OpenAI Structured reviewer (`OpenAIReviewer`) supporting `gpt-4o` with strict JSON parsing.
  - Deterministic fallback reviewer (`DeterministicReviewer`) with dynamic hunk line matching across live patches.
  - Auto-resolver `getAIReviewer(preferredModel)` supporting both Gemini and OpenAI keys.
- [x] Live GitHub PR AI Review Execution (`lib/ai/lifecycle.ts`, `app/api/pull-requests/[pullRequestId]/ai-review/route.ts`):
  - Added support for direct live PR IDs (`live__${owner}__${repo}__${number}`).
  - Resolves metadata and diff patches directly from GitHub REST API on the fly.
  - Durable in-memory review store (`liveReviewsStore`) caching runs and findings across requests.
- [x] Dynamic AI Review UI Synchronization (`components/summary-view.tsx`, `components/ai-review-panel.tsx`):
  - Replaces static fixture findings with dynamic state hook.
  - Fetches and displays newly generated AI review findings immediately after triggering review.
  - Synchronizes parent finding updates to local panel state with `useEffect`.
- [x] GitHub Finding Comment Publication Fix (`app/api/ai-findings/[findingId]/publish/route.ts`):
  - Fixed database column lookup from `repo.owner` to `repo.owner_login` preventing GitHub 404 URL errors.
  - Added support for publishing findings from live PRs via GitHub App installation token.
- [x] Dynamic Context Lines in Diff Viewer (`components/diff-viewer.tsx`):
  - Replaced hardcoded lines 1638-1640 with dynamic context line numbers derived from actual diff hunk headers.
  - Placed hook before early return, preventing React hook ordering errors.

## Quality Checks & Verification

- `typecheck` (`npm run typecheck`): Passed (0 errors).
- `test` (`npm run test`): Passed 77/77 acceptance tests across 10 test suites:
  - `tests/phase0-workspace.test.tsx` (9 tests)
  - `tests/phase1-state.test.ts` (5 tests)
  - `tests/phase1-github-sync.test.ts` (12 tests)
  - `tests/phase1-workspace-isolation.test.ts` (2 tests)
  - `tests/phase2-webhooks.test.ts` (11 tests)
  - `tests/phase3-ai-review.test.ts` (9 tests)
  - `tests/phase4-audit-hardening.test.ts` (7 tests)
  - `tests/phase5-chat.test.ts` (9 tests)
  - `tests/phase6-collaboration.test.ts` (9 tests)
  - `tests/live-ai-readiness.test.ts` (4 tests)
- `build` (`npm run build`): Passed (29 dynamic API routes + static pages compiled successfully).
