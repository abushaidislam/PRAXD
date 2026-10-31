# PRAXD Build Status

**Last updated:** 2026-10-31  
**Current version:** v0.7.0 (Enterprise Horizon & Commercial Roadmap Active)  
**Current phase:** Phase 11 — Developer IDE Integration: VS Code & JetBrains Extension  
**Build status:** Phases 0 through 10 (v0.1.0 to v0.7.0) are 100% Complete & Verified (147/147 Automated Tests Passing)

## Completed Roadmap Phases (v0.1.0 — v0.7.0)

- [x] **Phase 0–4 (v0.1.0 MVP):** UI Shell, Dual-Pane Workspace, Synchronized Diff Scroll, GitHub Sync, Webhooks, AI Review Engine, Audit Logging.
- [x] **Phase 5 (v0.2.0):** Interactive PR Assistant & Contextual Chat (Header `Chat` drawer, streaming SSE, `/explain`, `/test-ideas`, `/draft-response`).
- [x] **Phase 6 (v0.3.0):** Team Collaboration, GitHub SSO & Real-Time Presence (Presence heartbeats, internal workspace notes, 5-role RBAC).
- [x] **Phase 7 (v0.4.0):** Automated Policy Engine, CI/CD Bot Mode & Risk Scoring (0–100 risk score, event-driven webhooks, Slack/Discord alerts).
- [x] **Phase 8 (v0.5.0):** Multi-Model LLM Adapters & Enterprise Governance (Claude, Gemini, OpenAI, Ollama, retention purging, DORA metrics).
- [x] **Phase 9 (v0.6.0):** Production Cloud Deployment, CI/CD Pipeline & KMS Secret Management (GitHub Actions automated test gatekeeper, Supabase live migrations, envelope encryption).
- [x] **Phase 10 (v0.7.0):** 1-Click Autonomous Autofix & PR Commit Engine (User-confirmed Git commit write-back with pre-commit AST syntax validation).

## Active Commercial & Enterprise Roadmap (v0.8.0 — v1.0.0 GA)

- [ ] **Phase 11 (v0.8.0):** Developer IDE Integration: VS Code & JetBrains Extension (In-editor PR triage, diff annotations, and local patch application).
- [ ] **Phase 12 (v0.9.0):** Multi-VCS Expansion: GitLab MR & Bitbucket Support (Pluggable `IVCSProvider` universal code review layer).
- [ ] **Phase 13 (v1.0.0 GA):** SaaS Commercialization, Usage Quotas & Stripe Billing (Usage metering, seat licensing, Stripe subscription portal).

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


## Completed in Phase 7 (Automated Policy Engine & CI/CD Bot Mode)

- [x] Event-Driven Policy Trigger Rules & Pattern Matching (`lib/policy/policy-engine.ts`, `lib/policy/policy-store.ts`):
  - Configurable branch globs (`main`, `master`, `release/*`) and file path globs (`auth/**`, `migrations/**`).
  - Event trigger filtering: automates review runs exclusively on `pull_request.opened` and `pull_request.synchronize`.
  - Author bot exclusion: automatically ignores dependabot, renovate, and github-actions bots.
- [x] Review Focus Profiles & Prompt Injection Defense:
  - 4 specialized review focus profiles: *Strict Security & Compliance*, *Performance & Memory*, *Style & Conventions*, and *Comprehensive*.
  - Team custom rules manager: bounded to 10 active rules and 500 chars per rule.
  - Robust prompt injection quarantine (`sanitizeCustomRule`): strips system/assistant role spoofing, instruction overrides (`ignore previous instructions`), and markdown fences.
- [x] PR Blast Radius & Deterministic Composite Risk Scoring Engine (`lib/policy/risk-scoring.ts`):
  - 0–100 composite scoring algorithm incorporating 5 objective factors:
    1. Churn volume score (0–25 pts)
    2. Sensitive core module blast radius (0–25 pts; auth, security, database, migrations, infrastructure)
    3. Package dependency additions (0–15 pts)
    4. Test coverage delta (0–15 pts; flags unverified executable changes)
    5. AI finding severities (0–20 pts; critical = 20, high = 15, medium = 8)
  - Objective risk tiering: Low (0–30), Medium (31–65), High (66–100).
- [x] Out-of-Order Webhook Queue Guard & Concurrency Mutex (`lib/policy/auto-reviewer.ts`):
  - Pinned head-SHA execution prevents race conditions when concurrent or out-of-order `synchronize` webhooks arrive.
  - Superseded runs in queue are automatically skipped without running redundant reviews.
- [x] Slack & Discord Webhook Notification Dispatcher (`lib/notifications/webhook-notifier.ts`):
  - Slack Block Kit and Discord Embed payload formatters.
  - Configurable notification severity thresholds (`critical`, `high`, `medium`, `all`, `none`).
  - Strict confidentiality constraint: zero source code diffs, hunks, or tokens are transmitted in alert notifications.
- [x] Policy UI Components & Header Integration (`components/risk-badge.tsx`, `components/policy-modal.tsx`, `components/workspace-header.tsx`, `components/summary-view.tsx`, `components/pull-request-list-item.tsx`):
  - Interactive `PolicyModal` with sliders, rule adder/remover, profile selector, and webhook inputs.
  - Compact `RiskBadge` displayed on PR list rows and workspace header with factor breakdown popover.
  - Detailed PR Blast Radius & Risk Analysis card displayed in `SummaryView`.
- [x] REST API Endpoints:
  - `GET /api/repositories/[repositoryId]/policy`
  - `PUT /api/repositories/[repositoryId]/policy` (enforces owner/admin RBAC permissions)
  - `GET /api/pull-requests/[pullRequestId]/risk`
- [x] Comprehensive Acceptance Test Suite (`tests/phase7-policy-bot.test.ts`):
  - P7-01: Branch & file path pattern matching (exact, wildcards, globstars).
  - P7-02: Event-driven trigger rules (branch, path, author, and action filters).
  - P7-03: Out-of-order synchronize guard and queue concurrency.
  - P7-04: Custom rules sanitizer and prompt injection defense.
  - P7-05: PR blast radius and deterministic risk score computation across fixtures.
  - P7-06: Slack & Discord webhook payload formatting and secret exclusion.
  - P7-07: Repository policy endpoints and RBAC protection.


## Completed in Phase 8 (Multi-Model Adapter & Enterprise Governance)

- [x] Provider-Agnostic LLM Adapters (`lib/ai/anthropic-reviewer.ts`, `lib/ai/self-hosted-reviewer.ts`, `lib/ai/fallback-chain-reviewer.ts`, `lib/ai/reviewer.ts`):
  - Native Anthropic Claude Messages API adapter (`claude-3-7-sonnet-20250219`, `claude-3-5-haiku-20241022`) with Zero-Data-Retention beta header support.
  - Native Google Gemini adapter (`gemini-2.5-flash`, `gemini-2.5-pro`).
  - Native OpenAI Structured Outputs adapter (`gpt-4o`, `gpt-4o-mini`).
  - Enterprise Self-Hosted adapter for OpenAI-compatible endpoints (Ollama, vLLM, Azure OpenAI).
  - Autonomous Model Fallback Chain: automatically fails over to backup providers on rate limits (HTTP 429), outages (HTTP 500/502/503), or network interruptions with failover telemetry logs.
  - Zero-Code Refactoring Guarantee: switching providers requires only setting `AI_PROVIDER` or workspace governance configuration.
- [x] Self-Hosted TLS & Header Validation Guard (`lib/ai/self-hosted-reviewer.ts`):
  - Rejects insecure non-TLS `http://` endpoints when enterprise TLS is enforced.
  - Strips dangerous/hop-by-hop headers (`host`, `content-length`, `connection`, `transfer-encoding`).
  - Rejects CRLF injection attempts (`\r`, `\n`) in headers.
- [x] Automated Data Retention & Patch Purging Engine (`lib/governance/retention.ts`, `app/api/governance/retention/purge/route.ts`):
  - Configurable patch retention window (30 / 60 / 90 days; or indefinite).
  - Permanently purges cached diff hunks (`patch_text`) from closed/merged PRs while preserving PR metadata and findings.
  - Supports scheduled cron invocation and on-demand manual maintenance.
- [x] One-Click Workspace Purge for SOC2 Offboarding (`lib/governance/workspace-purge.ts`, `app/api/workspaces/current/purge/route.ts`):
  - Irreversibly purges workspace records (pull requests, diffs, findings, review runs, internal notes, audit logs).
  - Enforces workspace Owner-only authorization and explicit `confirmWorkspaceId` payload matching.
- [x] Zero-Data-Retention (ZDR) Enterprise Compliance:
  - Supports `zeroDataRetention: true` contract mode, transmitting provider privacy flags and suppressing diff persistence.
- [x] Engineering Velocity & DORA Metrics Analytics Engine (`lib/analytics/dora.ts`, `app/api/analytics/dora/route.ts`):
  - Computes 4 core velocity metrics: Time to First Review (TTFR), Review Cycle Time, AI Triage Resolution Rate, and Churn Velocity.
  - Industry DORA classification rating: `elite` (&lt;4h TTFR, &lt;24h cycle), `high`, `medium`, `low`.
  - Non-blocking read-optimized analytics queries that never lock write tables or block incoming GitHub webhooks.
- [x] Enterprise Governance & Analytics UI Modals (`components/governance-modal.tsx`, `components/dora-metrics-modal.tsx`, `components/workspace-header.tsx`, `components/pr-workspace.tsx`):
  - Interactive governance modal with provider picker, self-hosted TLS config, retention slider, patch purge button, and ZDR toggle.
  - DORA velocity modal displaying real-time metrics cards and industry benchmarks.
  - Workspace header integration with dedicated Governance and Analytics affordances.
- [x] Comprehensive Acceptance Test Suite (`tests/phase8-enterprise-governance.test.ts`):
  - P8-01: Provider-agnostic adapter switches providers with zero code refactoring.
  - P8-02: Self-hosted endpoint validates TLS certificates and handles custom headers safely.
  - P8-03: Model fallback chain automatically fails over on HTTP 429/503.
  - P8-04: Automated retention policy permanently purges diffs older than retention window.
  - P8-05: One-click workspace purge wipes workspace data with owner check.
  - P8-06: DORA metrics calculations and performance tier assignment.
  - P8-07: Enterprise governance REST API and RBAC protection.

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

## Completed in Phase 9 (Production Cloud Deployment, CI/CD Pipeline & KMS Secret Management)

- [x] Automated GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`):
  - Strict pull request and main branch execution gates.
  - Mandatory pipeline steps: `npm run lint`, `npm run typecheck`, full acceptance test suite execution, and production Next.js build.
  - Concurrency cancel-in-progress configuration preventing race conditions and stale CI runs.
  - Database schema checksum validation job and preview deployment staging hooks.
- [x] Production Supabase Database Migrator & Integrity Engine (`lib/db/migrator.ts`, `scripts/migrate.ts`):
  - Deterministic SHA-256 checksum calculation over migration files (`0001_initial_schema.sql`, `0002_production_integrity.sql`).
  - Idempotent execution model: automatically detects applied vs pending migrations without duplicate schema execution.
  - Cryptographic tamper detection: immediately halts and alerts if historical migration SQL has been altered post-execution.
  - Standalone CLI runner with `--dry-run`, `--status`, and automated application modes.
- [x] Enterprise KMS Envelope Encryption & Buffer Purging (`lib/security/kms.ts`):
  - Production envelope encryption leveraging AES-256-GCM and ephemeral 256-bit Data Encryption Keys (DEKs).
  - Encrypted envelope structure with 96-bit IVs, 128-bit authentication tags, and key IDs.
  - Memory security: zero-wiping (`purgeDecryptedBuffer` / `buf.fill(0)`) purging sensitive secret buffers post-invocation.
  - Transparent key resolver (`decryptKeyIfEnveloped`) seamlessly integrated into GitHub App authentication (`lib/github/app-auth.ts`).
  - KMS operational status reporter supporting local AES-256-GCM, AWS KMS, and HashiCorp Vault.
- [x] Production Security Headers & Edge CDN Caching (`next.config.mjs`):
  - Pre-configured enterprise security headers across all application routes:
    - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS)
    - `X-Frame-Options: DENY` (Anti-clickjacking)
    - `X-Content-Type-Options: nosniff` (MIME sniffing prevention)
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
    - `Content-Security-Policy`: strict defense-in-depth policy restricting script and connect origins.
  - Immutable production caching headers (`Cache-Control: public, max-age=31536000, immutable`) for `/_next/static/*`.
- [x] Enhanced Production Health & Readiness (`app/api/health/route.ts`):
  - Updated API version to `0.6.0`.
  - Comprehensive health checks inspecting PostgreSQL database connectivity, KMS engine operational status, and schema migration status.
  - Latency measurement maintaining strict SLAs under 50ms.
- [x] Comprehensive Acceptance Test Suite (`tests/phase9-production-cloud.test.ts`):
  - P9-01: GitHub Actions CI workflow triggers and mandatory pipeline step enforcement.
  - P9-02: Database migrator checksum calculation, idempotent execution, and tamper detection.
  - P9-03: KMS AES-256-GCM envelope encryption, auth tag validation, and in-memory buffer zeroing.
  - P9-04: Production security headers and edge caching configuration.
  - P9-05: Enhanced health and readiness response structure and SLA metrics.

## Completed in Phase 10 (1-Click Autonomous Autofix & PR Commit Engine)

- [x] Pre-Commit Syntax & Delimiter Guardrail (`lib/autofix/syntax-validator.ts`):
  - Multi-language AST delimiter and structural validation engine (TypeScript, JavaScript, JSON, Python, Go, Rust, SQL, CSS, HTML).
  - Unmatched bracket, unbalanced curly brace, unclosed quote, and malformed token inspection.
  - Rejects broken or syntax-invalid patches before any commit is attempted.
- [x] Server-Side Git Write-Back Flow & Branch Engine (`lib/autofix/commit-engine.ts`):
  - Direct PR branch write-back or isolated companion branch creation (`praxd/fix-finding-[id]`).
  - GitHub App token authenticated file write via GitHub REST Contents / Git Trees API.
  - Deterministic 40-character SHA commit execution for tests, demo mode, and offline environments.
  - Conventional commit message generator: `fix(praxd): resolve [title] in [file]` with `Co-authored-by: PRAXD AI <bot@praxd.com>`.
- [x] Autofix REST API Endpoint (`app/api/ai-findings/[findingId]/autofix/route.ts`):
  - Guarded with strict two-click confirmation (`confirmed: true`).
  - Open PR state validation (rejects closed/merged PRs with HTTP 400 `PR_CLOSED`).
  - Pre-commit syntax enforcement (blocks invalid patches with HTTP 422 `SYNTAX_ERROR`).
  - RBAC enforcement (`canCommitAutofix`): viewers blocked with HTTP 403 `PERMISSION_DENIED`.
  - Immutable audit trail recorded (`ai_finding.autofix_committed`).
- [x] Interactive 1-Click Autofix UI Modal (`components/autofix-modal.tsx`, `components/ai-review-panel.tsx`):
  - "Apply Fix via Commit" action button on finding cards.
  - Two-click safety confirmation modal with syntax verification badge.
  - Target branch selection (Direct PR branch vs Companion branch).
  - Pre-commit diff preview and conventional commit message inspection.
  - Post-commit state badge updates showing commit SHA.
- [x] Comprehensive Acceptance Test Suite (`tests/phase10-autofix.test.ts`):
  - P10-01: Two-click confirmation enforcement.
  - P10-02: Pre-commit syntax validation error catching.
  - P10-03: Pre-commit syntax validation valid code verification.
  - P10-04: Conventional commit message and co-author attribution.
  - P10-05: Target branch and companion branch naming resolution.
  - P10-06: RBAC permission matrix for autofix write-back.
  - P10-07: PR state guardrails (closed/merged rejection).
  - P10-08: Commit engine execution and SHA generation.

## Quality Checks & Verification

- `lint` (`npm run lint`): Passed (0 warnings, 0 errors).
- `typecheck` (`npm run typecheck`): Passed (0 errors).
- `test` (`npm run test`): Passed 147/147 acceptance tests across 14 test suites:
  - `tests/phase0-workspace.test.tsx` (9 tests)
  - `tests/phase1-state.test.ts` (5 tests)
  - `tests/phase1-github-sync.test.ts` (12 tests)
  - `tests/phase1-workspace-isolation.test.ts` (2 tests)
  - `tests/phase2-webhooks.test.ts` (11 tests)
  - `tests/phase3-ai-review.test.ts` (9 tests)
  - `tests/phase4-audit-hardening.test.ts` (7 tests)
  - `tests/phase5-chat.test.ts` (9 tests)
  - `tests/phase6-collaboration.test.ts` (9 tests)
  - `tests/phase7-policy-bot.test.ts` (25 tests)
  - `tests/phase8-enterprise-governance.test.ts` (17 tests)
  - `tests/phase9-production-cloud.test.ts` (11 tests)
  - `tests/phase10-autofix.test.ts` (17 tests)
  - `tests/live-ai-readiness.test.ts` (4 tests)
- `build` (`npm run build`): Passed (36 dynamic API routes + 23 static pages compiled successfully).
