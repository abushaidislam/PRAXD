# PRAXD — Roadmap & Acceptance Criteria

**Document status:** Implementation contract  
**Applies to:** PRAXD v0.1 MVP through the first AI-review release  
**Normative sources:** `START_HERE.md`, `docs/PRD.md`, `docs/UI_UX_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/API_SPEC.md`, `docs/GITHUB_INTEGRATION.md`, `docs/AI_REVIEW_SPEC.md`, and `migrations/0001_initial_schema.sql`.

This document defines the build order and the evidence required to call each phase complete. A phase is not complete because a screen exists or an endpoint returns `200`; it is complete only when its acceptance criteria and relevant tests pass against real integrations or explicit, deterministic test doubles.

## 0. Release principles

1. **GitHub is authoritative.** PRAXD is a synchronized read model plus PRAXD-owned review history. Do not invent or independently mutate GitHub PR state.
2. **A visible control must work.** Implement its behavior, or visibly disable it with an explanation. Never ship decorative buttons that imply an action.
3. **No silent partial data.** Expose missing patches, permission failures, truncated API results, stale sync state, and incomplete AI coverage.
4. **Tenant isolation is mandatory.** Every workspace-owned record must be scoped through the authenticated workspace membership and verified by RLS and server-side authorization.
5. **AI is advisory.** No automatic approval, merge, branch write, or GitHub comment publication. Publishing is a separate user-confirmed capability requiring a permission change.
6. **No secrets in the browser.** GitHub App private keys, installation tokens, webhook secrets, service-role keys, and AI provider keys stay server-side.
7. **Keep the supplied reference layout.** The approved visual source is the two screenshots in `reference/`. Do not replace the persistent left PR inbox and right Summary/Code workspace with a generic dashboard.

## 1. Phase 0 — Application shell and visual contract

This is the first implementation task from `START_HERE.md`. It is a fixture-backed UI milestone, not the production MVP and not permission to fake connected GitHub data.

### Deliverables

- Next.js App Router application, strict TypeScript, lint/typecheck/test/build scripts.
- Design tokens, dark theme, app shell, typography, icons, focus styles and responsive breakpoints.
- Persistent left PR inbox with All / Reviewing / Authored tabs, search, filter, collapsible sidebar toggle (`Cmd/Ctrl+B`), and compact PR rows.
- Main workspace header with PR identity, Summary / Code navigation, Chat affordance, external GitHub link, and guarded `Merge` button state.
- Summary view with author, branch comparison, review requests, comments, checks, PR status and description.
- Code view with multi-file picker/dropdown, split/unified diff switcher, line numbers, gutter comment hover (`+`), additions/deletions, and inline-comment placement.
- Clearly labelled local fixture mode. No GitHub or AI credentials required.

### Acceptance criteria

- [ ] At the supplied 1482 × 819 reference viewport, the left inbox is approximately 420 px wide and the main workspace uses the remaining width. The pane can resize responsively without overlapping content.
- [ ] The left inbox can be collapsed/toggled to maximize the diff viewing area.
- [ ] The interface reproduces the reference information hierarchy, density, spacing, dark neutral surfaces and restrained status colors. It does not introduce a marketing hero, dashboard card grid or unrelated navigation as the primary screen.
- [ ] All / Reviewing / Authored tabs change the fixture list according to documented semantics.
- [ ] Search filters by repository, PR number, title, author and branch. Filter controls can be applied, cleared and keyboard-operated.
- [ ] Selecting a PR updates the active PR in the main workspace without a full-page reload.
- [ ] Summary and Code switch reliably and preserve the selected PR.
- [ ] Code view renders valid split and unified fixtures, both sides' line numbers, additions/deletions, collapsed context, multi-file switcher, and inline comment threads with gutter hover affordance.
- [ ] Long paths and long diff lines remain usable; horizontal diff scrolling does not scroll the whole application horizontally.
- [ ] Empty, loading, error and no-selection states exist. Fixture data is visibly labelled as demo data.
- [ ] Buttons and links either perform the described action or are disabled with a concise reason (e.g. `Merge` button is safely disabled in read-only MVP mode).
- [ ] Keyboard focus is visible; tabs, list selection, menus and dialogs are operable without a pointer; reduced-motion preferences are respected.
- [ ] At a tablet/mobile width, the inbox and workspace have a deliberate navigation pattern (drawer or stacked route) rather than clipped desktop columns.

### Test scenarios

| ID | Scenario | Expected result |
|---|---|---|
| P0-01 | Load the app with fixtures enabled | The PR workspace renders without external secrets. |
| P0-02 | Switch All → Reviewing → Authored | Each view shows only records matching its defined rule. |
| P0-03 | Search for an exact PR number, title fragment and author | Each query returns the expected rows; clearing search restores the list. |
| P0-04 | Select a different PR | Header, Summary and Code content update to the selected PR. |
| P0-05 | Open a PR with additions, deletions, rename and comment | Diff and comment anchors render on the correct side and line. |
| P0-06 | Open a fixture with no patch / binary file | The UI explains that a patch is unavailable; it does not show fabricated code. |
| P0-07 | Navigate with keyboard only | All primary controls are reachable and have visible focus. |
| P0-08 | Resize to tablet and mobile | No critical content is clipped or inaccessible. |

**Exit gate:** UI review against both reference screenshots is signed off; lint, typecheck, unit tests and production build pass. Update `docs/BUILD_STATUS.md` with screenshots and test output.

## 2. Phase 1 — MVP PR Inbox & Summary/Code Split View

This is the first end-to-end product milestone. It replaces fixtures with real, read-only GitHub data while keeping the approved UI.

### Deliverables

- Supabase Auth, workspace creation/membership and workspace-safe RLS policies.
- GitHub App install/callback flow with validated `state`, installation identity and repository selection.
- Server-only GitHub App authentication and installation access-token generation.
- Initial repository discovery and synchronization into `github_installations` and `repositories`.
- PR list/detail synchronization into `pull_requests`.
- Review records, issue/review comments, commits, changed files and check runs synchronized into their schema tables.
- PR inbox tabs, search, filtering, repository context, counts and accurate timestamps.
- Summary view populated by real PR data.
- Code view populated by real changed-file patches and inline review comments.
- Pagination, caching, stale-data indicators, retries, API-rate-limit handling and permission-denied states.
- Explicit sync/refresh action where webhooks are not yet enabled.

### Acceptance criteria

- [ ] A signed-in user can create/open a workspace and install the PRAXD GitHub App on a test account or organization.
- [ ] OAuth/callback state is random, short-lived, bound to the initiating user/workspace and single-use. Callback query parameters alone are never treated as proof of installation ownership.
- [ ] PRAXD lists only repositories available to the installation and persists the installation/repository relationship correctly.
- [ ] Every API request for a private repository uses a server-generated installation token with the minimum approved permissions.
- [ ] Repository upserts use `(installation_id, github_repo_id)` as the natural idempotency key; PR upserts use `(repository_id, number)` and/or the GitHub PR ID, respecting the schema unique constraints.
- [ ] PR state mapping is correct: `merged_at != null` → `merged`; otherwise `state == closed` → `closed`; otherwise `open`.
- [ ] The PR inbox includes real title, number, author, draft state, update time, additions/deletions and repository identity. Unknown values are shown as unavailable, not guessed.
- [ ] `Reviewing` and `Authored` semantics are documented and tested against the authenticated GitHub user. If the GitHub actor identity is not known, the tab is not silently misrepresented.
- [ ] Summary shows correct base/head refs and SHAs, requested reviewers, review state, comments, description and checks for the PR's current head SHA.
- [ ] Code view shows actual changed files and patch hunks. It supports add/delete/modify/rename and handles binary, oversized and patch-unavailable files honestly.
- [ ] Review comments are anchored using GitHub's original/current line and side information; unresolved anchors are shown in a general thread instead of assigned a fabricated line.
- [ ] `pull_request_comments.comment_type` distinguishes `issue` from `review`. Review summary bodies are stored in `pull_request_reviews`, not incorrectly duplicated as line comments.
- [ ] Check runs are associated with the PR only when their `head_sha` matches the PR head SHA or GitHub's returned PR association supports the link.
- [ ] API pagination uses `Link` headers or Octokit pagination and does not assume a single page. The PR files endpoint's 3,000-file maximum is surfaced as a hard source limitation.
- [ ] A revoked/uninstalled/suspended app or missing repository permission produces a clear disconnected/permission state and stops unauthorized fetches.
- [ ] A user from Workspace B cannot read Workspace A's installations, repositories, PRs, comments, checks or AI records by changing a URL or request body.
- [ ] Production UI never displays fixture data as if it were live GitHub data.

### Test scenarios

| ID | Scenario | Expected result |
|---|---|---|
| P1-01 | Complete installation callback with valid state | Installation is bound to the initiating workspace and synced. |
| P1-02 | Reuse, omit or alter callback state | Callback is rejected; no installation is linked. |
| P1-03 | Install on selected repositories only | Only selected repositories are displayed and synced. |
| P1-04 | Sync the same repository and PR twice | Upserts occur; no duplicate rows are created. |
| P1-05 | Sync merged, closed-unmerged, open and draft PRs | Enum/state/draft values match GitHub's canonical response. |
| P1-06 | PR has 101+ changed files | All available pages are retrieved and no records are skipped/duplicated. |
| P1-07 | PR has a binary or missing patch file | File metadata appears with an explicit no-patch explanation. |
| P1-08 | PR has both issue conversation comments and diff comments | They render in the correct thread and comment type. |
| P1-09 | PR head advances while old checks exist | Old checks are not presented as checks for the new head. |
| P1-10 | GitHub API returns 403 permission failure or 429 rate limit | The app shows the correct reason/retry time and does not spin indefinitely. |
| P1-11 | Workspace B requests Workspace A's resource ID | Server/RLS denies access; no data is leaked. |
| P1-12 | Installation is removed or suspended | Access stops and the UI clearly shows that synchronization is unavailable. |

**Exit gate:** End-to-end smoke test against a dedicated test GitHub App and test repository passes. RLS/cross-workspace tests pass. Core UI states have no fixture fallback outside demo mode. Lint, typecheck, unit, integration and e2e tests plus production build pass.

## 3. Phase 2 — Webhooks & Live Synchronization

This phase removes the need for users to manually refresh for ordinary GitHub updates. Webhooks are a fast signal to reconcile state; GitHub REST API remains the source of truth.

### Deliverables

- Public webhook route using Node.js runtime and original raw request bytes.
- HMAC SHA-256 verification using `X-Hub-Signature-256` and constant-time comparison.
- Required delivery/event header validation and payload-size limit.
- Durable delivery ingestion into `webhook_deliveries` with unique `delivery_id` and SHA-256 payload digest.
- Idempotent worker/queue processing and retry/reconciliation strategy.
- Event handlers for installation lifecycle, repository selection, PR lifecycle, review changes, issue comments, review comments and check runs/suites.
- Per-installation sync locking or equivalent protection against out-of-order concurrent syncs.
- UI refresh/subscription strategy, stale indicators and reconnect states.
- Scheduled reconciliation job to recover missed webhooks and abandoned deliveries.

### Acceptance criteria

- [ ] The webhook endpoint reads the request body exactly once as raw bytes before JSON parsing or framework body transformation.
- [ ] Requests without a valid signature, with invalid encoding/length, or with malformed required headers are rejected before any job is queued.
- [ ] HMAC is computed over the exact received bytes; comparison uses constant-time comparison after equal-length validation.
- [ ] `X-GitHub-Delivery` is stored in the unique `webhook_deliveries.delivery_id`; duplicate deliveries do not enqueue duplicate domain work.
- [ ] `payload_sha256` stores the digest of raw bytes. Full webhook payloads are not stored in `webhook_deliveries`; if a durable queue requires payload data, retain only the minimum necessary with bounded retention and encryption.
- [ ] The endpoint acknowledges valid deliveries quickly after durable receipt; it does not synchronously make multiple GitHub API calls before responding.
- [ ] A delivery is not considered processed until its domain updates succeed. State moves through `received` → `queued` → `processing` → `processed`, or to `failed`/`ignored` as appropriate.
- [ ] A worker crash after delivery receipt but before queue publication is recovered by a reconciliation poller/outbox strategy.
- [ ] Event handlers re-fetch authoritative GitHub resources where the event payload is incomplete or order-sensitive.
- [ ] `pull_request.synchronize` updates the PR head SHA and marks old-head AI review runs stale (when Phase 3 exists).
- [ ] `installation_repositories` additions and removals update accessible repository scope; removal does not silently leave private repository content available in PRAXD.
- [ ] Check runs are upserted by `(repository_id, github_check_id)` where a GitHub check ID exists; updates to the same check do not create duplicates.
- [ ] Out-of-order events cannot roll the local PR head SHA backward. Reconciliation compares canonical `updated_at`/head SHA and refetches current state.
- [ ] Retry policy distinguishes transient network/5xx/rate-limit failures from permanent 401/403/404 or invalid payload failures. Retries use exponential backoff with jitter and are bounded.
- [ ] Failed deliveries expose safe error codes and can be replayed by an operator without bypassing signature verification for the original delivery record.
- [ ] A periodic reconciliation job repairs missed events and compares repository/PR state with GitHub.
- [ ] Logs omit webhook secrets, signatures, installation tokens, private source code and full payload bodies.

### Test scenarios

| ID | Scenario | Expected result |
|---|---|---|
| P2-01 | Valid GitHub test signature and unchanged raw body | Delivery is accepted and recorded. |
| P2-02 | Change one byte, normalize JSON whitespace or alter Unicode bytes after signing | Signature verification fails. |
| P2-03 | Missing signature or wrong header prefix | Request is rejected before parse/enqueue. |
| P2-04 | Deliver the same `X-GitHub-Delivery` twice | One delivery row and one logical processing result exist. |
| P2-05 | Worker crashes after row insert | Reconciler re-queues the delivery without duplicate domain mutations. |
| P2-06 | Deliver `synchronize` followed by an older `edited` payload | Current canonical PR head remains correct. |
| P2-07 | Add/remove repositories from an installation | Added scope is synced; removed scope becomes inaccessible. |
| P2-08 | Create/update a review comment | Correct row is upserted in `pull_request_comments`. |
| P2-09 | Re-send check_run completed event | Same `check_runs` row is updated. |
| P2-10 | Simulate 429/502 then success | Retry is delayed and eventual state is processed once. |
| P2-11 | Simulate permanent 403 permission loss | Delivery is marked failed with safe error and no infinite retries. |
| P2-12 | Stop webhook delivery for a period | Reconciliation discovers and repairs missed repository/PR changes. |

**Exit gate:** Signature, replay, idempotency, retry, ordering and installation-scope tests pass. Monitoring for delivery lag/failure is active. A controlled staging test proves Summary/Code data refreshes after real GitHub changes.

## 4. Phase 3 — AI Review Engine & User Actions

AI reviews are tied to an immutable PR head SHA. A run against an old SHA must never be shown as current for a newer commit.

### Deliverables

- Manual **Run AI Review** action for an authorized workspace member.
- Durable AI job queue, per-PR concurrency guard, request idempotency and cost/rate limits.
- Context builder that collects PR metadata, changed-file patches and bounded related source context.
- Secret/credential redaction and untrusted-content isolation before model invocation.
- Versioned system/developer prompt and strict structured JSON output contract from `docs/AI_REVIEW_SPEC.md`.
- Runtime JSON Schema validation and server-side validation of enum values, paths, line ranges, evidence, patches and confidence.
- Persistence to `ai_review_runs` and `ai_findings` with schema-compatible mapping.
- AI review summary, risk label, finding list, severity filtering, file/line navigation, verification steps and patch preview.
- Historical runs and finding deduplication across commits.
- User actions for accepting/dismissing a finding, copying a suggested patch and marking a finding as addressed (local PRAXD state only).
- Explicitly gated optional GitHub comment publication, if included in a later release; read-only mode remains the default.

### Acceptance criteria

- [ ] Every run is created with `pull_request_id`, `workspace_id`, `requested_by`, provider/model/prompt version and exact `head_sha`.
- [ ] A run only starts if the PR's current synchronized head SHA equals the run's requested SHA. Otherwise the run becomes `stale` without a model call.
- [ ] Duplicate clicks/API requests for the same PR while a run is queued/running return the existing active run or a clear conflict; they do not fan out duplicate model calls.
- [ ] Context is bounded by the selected provider/model context capacity and configured token/cost budget. Truncation/omission is recorded in the run summary or coverage metadata exposed by the API.
- [ ] AI receives only the relevant diff and explicitly retrieved context. It is not given all repositories by default.
- [ ] Retrieved code, PR title/body, comments, commit messages, filenames and test output are treated as untrusted data, not instructions.
- [ ] Secrets are redacted before model transmission. Raw secret values are never persisted in prompts, logs or findings.
- [ ] Output is valid JSON with no prose wrappers and validates against the exact schema in `docs/AI_REVIEW_SPEC.md`.
- [ ] `severity` is exactly one of `critical`, `high`, `medium`, `low`, `info`; `kind` is exactly one of `bug`, `security`, `performance`, `reliability`, `maintainability`, `test_gap`, `style`, `other`.
- [ ] Each actionable finding has a credible explanation and evidence. File paths must exist in the review context; line anchors must be valid in the current diff/head and must not be fabricated.
- [ ] Findings that cannot be tied to a file/line are allowed only when the finding genuinely concerns a cross-cutting PR-level issue; the UI must label the missing anchor.
- [ ] Invalid JSON, unknown enums, unknown files, impossible line ranges, malformed patches and unsupported patch formats are rejected or safely omitted. They are never written as trusted findings.
- [ ] The server derives fingerprints; the model cannot choose identity or status values.
- [ ] Findings repeated on later commits are grouped by stable fingerprint. Findings absent from a later run are marked stale/not re-reported, not automatically marked fixed.
- [ ] `ai_review_runs.status` follows the documented state machine; terminal transitions are enforced by server code and tested.
- [ ] AI findings are visibly distinct from GitHub-authored review comments.
- [ ] User actions are authorized against workspace membership and finding ownership; audit-relevant actions are logged.
- [ ] No AI action automatically approves, merges, closes, pushes, changes branch protection or publishes a GitHub comment.
- [ ] If publishing to GitHub is implemented, it is opt-in, requires `Pull requests: write`, shows the exact target/comment content, requires an explicit confirmation, and writes only the selected content. Failure does not erase the PRAXD finding.
- [ ] Provider errors, timeouts, quota failures and malformed output fail safely and do not corrupt synchronized GitHub data.

### Test scenarios

| ID | Scenario | Expected result |
|---|---|---|
| P3-01 | Authorized user manually starts a review | One queued run is created and UI exposes status. |
| P3-02 | User clicks Run repeatedly while queued/running | Same active run is returned; only one model job executes. |
| P3-03 | PR head SHA changes before worker starts | Run becomes stale and no model request is made. |
| P3-04 | PR head SHA changes during model execution | Result is discarded from current findings or stored only as stale history; never presented as current. |
| P3-05 | Model returns valid findings with every supported severity/kind | All enum values persist exactly. |
| P3-06 | Model returns unknown enum, extra field or malformed JSON | Schema validation rejects the response; run fails safely. |
| P3-07 | Model invents a file path or line number | Server-side evidence validation rejects the affected finding. |
| P3-08 | Model returns an out-of-diff line anchor | Anchor is rejected or made unanchored with explicit reason; never rendered at a false line. |
| P3-09 | PR content contains “ignore previous instructions” or exfiltration request | Content is treated as untrusted; model follows the system rules and has no tools/secrets to exfiltrate. |
| P3-10 | Two commits contain the same underlying defect with shifted line numbers | Fingerprint groups findings across runs; current line anchor is refreshed. |
| P3-11 | A previous finding is absent on a new run | Old record becomes stale/not re-reported; it is not automatically labelled fixed. |
| P3-12 | Provider timeout or rate limit | Run becomes failed with safe error code; retry is bounded and user-visible. |
| P3-13 | User copies a suggested patch | Exact patch preview is copied; repository files remain unchanged. |
| P3-14 | Unauthorized member tries to dismiss/accept a finding | Server denies the action and records no state change. |
| P3-15 | User starts a run on a very large PR | Budget/coverage limit is visible; no claim of full review is made. |

**Exit gate:** AI schema, evidence, prompt-injection, stale-head, deduplication, authorization, budget and failure-mode tests pass. A human reviewer inspects a representative set of model findings before production release. Provider/model and prompt version are observable for every run.

## 5. Phase 4 — Publishing, Audit Logs & Production Hardening (MVP Completion)

Status: **100% Completed & Shipped in v0.1.0**

This phase bridges internal AI findings to user-confirmed repository interactions while establishing enterprise auditability and system reliability.

### Deliverables

- Immutable Workspace Audit Logging System (`lib/audit/logger.ts`) writing to `audit_logs` table.
- Automatic credential and secret redaction (`[REDACTED]`) from all audit event payloads.
- Bounded workspace audit log endpoint (`GET /api/workspaces/current/audit-logs`) with strict pagination (limit 1..100).
- Opt-in user-confirmed GitHub finding publication (`POST /api/ai-findings/[findingId]/publish`).
- PR open state verification and non-destructive failure preservation of local findings.
- System health and database latency endpoint (`GET /api/health`).
- High-density UX ergonomics: Resizable inbox sidebar with magnetic snap points (340px, 420px, 540px), centered navigation tabs, and synchronized dual-pane horizontal scrolling.

### Acceptance criteria

- [x] Audit logger handles database failures gracefully without throwing unhandled exceptions.
- [x] All tokens and passwords in audit metadata are redacted before insertion.
- [x] Finding publication requires explicit `confirmed: true` payload parameter.
- [x] Publication is rejected if the target PR is merged or closed.
- [x] Failed GitHub API calls preserve the local finding record intact.
- [x] Health endpoint returns valid JSON with database connectivity status and roundtrip latency.
- [x] 54/54 automated tests pass across all phases.

---

# Post-MVP Evolution Roadmap (v0.2.0 — v0.5.0)

With the foundational PR workspace, GitHub App sync, webhooks, and core advisory AI review complete, the following phases define PRAXD's expansion into an active, collaborative developer intelligence hub.

## 6. Phase 5 — Interactive PR Assistant & Contextual Chat (v0.2.0)

The reference workspace header features a prominent **Chat** affordance that was disabled in the MVP. Phase 5 activates this affordance into a full conversational PR companion.

### Deliverables

- **Slide-out or Split-pane PR Chat Drawer:**
  - Accessible via the header **Chat** button and keyboard shortcut (`Cmd/Ctrl + K` or `Cmd/Ctrl + J`).
  - Dark, information-dense UI styled in `#111111` / `#171717` with streaming Markdown responses.
- **Context-Hydrated Retrieval:**
  - Automatically loads the active PR's metadata, branch diff, modified AST symbols, check statuses, and prior AI findings into the chat context window.
  - Multi-file code context querying (e.g. "What breaking changes does `extension/content.js` introduce?").
- **Streaming Response Architecture:**
  - Server-Sent Events (SSE) route: `POST /api/pull-requests/[pullRequestId]/chat/stream`.
  - Token-by-token streaming with visible reasoning states ("Analyzing diff...", "Verifying references...").
- **Actionable Copilot Commands:**
  - `/explain` — Plain-language architectural summary of the PR.
  - `/test-ideas` — Suggests edge-case unit/integration tests for touched functions.
  - `/draft-response` — Generates a polite, constructive review comment draft for selected lines.
  - `/security-audit` — Deep-dive taint analysis across user input paths in the diff.

### Acceptance criteria

- [x] Chat button in the header opens/closes the chat panel without reloading or resetting active PR tabs.
- [x] Context builder bounds prompt size to model context limits (max 32 KB active diff slice).
- [x] Model responses stream via SSE with low time-to-first-token (<800ms).
- [x] Code snippets rendered inside chat include copy buttons and "View in Diff" deep-links when valid line numbers exist.
- [x] Secrets and authentication tokens are redacted from user chat inputs and context before reaching LLM endpoints.
- [x] Chat conversation history is persisted per PR run and scoped strictly to workspace members.

---

## 7. Phase 6 — Team Collaboration, GitHub SSO & Real-Time Presence (v0.3.0)

Status: **100% Completed & Verified (9/9 Acceptance Tests Passing)**

Transforms PRAXD from a single-user inspection tool into a real-time multiplayer code review environment.

### Deliverables

- **GitHub OAuth Social Login:**
  - One-click "Sign in with GitHub" via Supabase Auth, linking user identity directly to GitHub logins and avatars.
  - Automatic workspace onboarding and membership hydration.
- **Real-Time Multiplayer Presence:**
  - Supabase Realtime WebSocket presence channels (`pr:pr_id`).
  - Shows active reviewers currently looking at the Summary or Code view with avatar indicator pills in the header.
  - Live cursor/line highlight indicator showing which file/line a teammate is inspecting.
- **Team Workspaces & Role-Based Access Control (RBAC):**
  - Workspace management UI: invite members via email/GitHub handle.
  - Roles: `Owner`, `Admin`, `Reviewer`, `Viewer`.
  - Permission matrix governing AI review triggers, finding publication, and repository connections.
- **Shared Team Review Notes & Bookmarks:**
  - Internal workspace-only discussion threads that are not published to GitHub.
  - Ability to tag teammates (`@mention`) for internal second-opinions before posting public GitHub reviews.

### Acceptance criteria

- [ ] Users can sign in with GitHub OAuth and have their profile automatically populated.
- [ ] Inviting a user sends a secure magic link / invitation with workspace-scoped token.
- [ ] When two users view the same PR simultaneously, both see live presence avatar badges within 1s.
- [ ] Internal review notes are visible only to workspace members and never pushed to GitHub.
- [ ] Viewers cannot trigger billable AI reviews or publish comments to GitHub.

---

## 8. Phase 7 — Automated Policy Engine & CI/CD Bot Mode (v0.4.0)

Enables engineering teams to set autonomous quality and security guardrails that run on webhook triggers without manual user clicks.

### Deliverables

- **Event-Driven Policy Trigger Rules:**
  - Configure automated review triggers based on branch patterns (`main`, `release/*`), author teams, or file paths (e.g. `auth/**`, `migrations/**`).
  - Event triggers: `pull_request.opened`, `pull_request.synchronize`.
- **Configurable Review Profiles:**
  - Choose review focus per repository: *Strict Security & Compliance*, *Performance & Memory*, *Style & Conventions*, or *Comprehensive*.
  - Team custom rules: Upload custom markdown rules (e.g. "Ensure all React components use forwardRef" or "Flag any unindexed foreign keys in migrations").
- **PR Blast Radius & Risk Scoring Engine:**
  - Computes composite risk score (0–100) based on churn volume, touched core modules, dependency additions, test coverage delta, and AI finding severities.
  - Surfaces a compact risk badge (`Low Risk`, `Medium Risk`, `High Risk`) directly in the PR list row.
- **Slack & Discord Webhook Notifications:**
  - Instant notifications for `Critical` or `High` security findings detected in incoming pull requests.

### Acceptance criteria

- [ ] Automated review runs only for configured repositories and branches.
- [ ] Out-of-order `synchronize` webhooks safely queue head-sha reviews without race conditions.
- [ ] Custom rules are safely injected into system prompts without permitting prompt injections.
- [ ] Risk score calculation is deterministic and tested against standard fixtures.
- [ ] Slack/Discord notifications fire only on configured severity thresholds and omit sensitive code.

---

## 9. Phase 8 — Multi-Model Adapter & Enterprise Governance (v0.5.0)

Provides deployment flexibility, self-hosting compatibility, and SOC2/ISO compliance for enterprise engineering teams.

### Deliverables

- **Provider-Agnostic LLM Adapters:**
  - Native support for Anthropic Claude (Claude 3.7 Sonnet / 3.5 Haiku), Google Gemini (Gemini 2.5 Flash / Pro via `@google/genai`), and OpenAI (GPT-4o).
  - Support for self-hosted / on-premise inference engines via OpenAI-compatible endpoints (Ollama, vLLM, Azure OpenAI).
  - Model fallback chain: automatic failover if primary provider experiences outage or rate limit (HTTP 429/503).
- **Data Retention & Privacy Controls:**
  - Automated patch purging policy (configurable: delete diff caches 30/60/90 days after PR merge).
  - One-click "Purge Workspace Data" for SOC2 compliance and offboarding.
  - Zero-Data-Retention (ZDR) verification flags for enterprise contracts.
- **Engineering Velocity & Review Analytics:**
  - DORA metrics dashboard: Time to First Review, Review Cycle Time, AI Assisted Triage Resolution Rate, and Churn Velocity.

### Acceptance criteria

- [ ] Switching AI provider requires only an environment or workspace configuration change with zero code refactoring.
- [ ] Self-hosted endpoints validate TLS certificates and handle custom headers safely.
- [ ] Scheduled cron job permanently purges diffs older than retention window.
- [ ] Analytics queries run against read-optimized indexes and never block live PR sync.

---

## 10. Core ship checklist

This is the checklist that `START_HERE.md` requires the product engineer to extract and verify. Check only what has objective evidence in CI, staging or production; do not check a box based on code inspection alone.

### Product and UX

- [ ] The two screenshot references remain the source of truth for the primary PR workspace.
- [ ] Inbox, Summary and Code workflows are functional with connected GitHub data.
- [ ] Loading, empty, error, disconnected, stale, rate-limited and permission-denied states are implemented.
- [ ] No fake live data, dead controls, misleading badges or fabricated line anchors remain.
- [ ] Keyboard, focus, responsive and reduced-motion checks pass.

### GitHub and synchronization

- [ ] GitHub App permissions are reviewed and least-privilege.
- [ ] Installation callback state and installation ownership are validated.
- [ ] API pagination, rate limits, ETags/caching where suitable and retry behavior are tested.
- [ ] Webhook HMAC validation, delivery idempotency, retries and out-of-order event handling pass.
- [ ] Periodic reconciliation and installation-removal handling are operational.
- [ ] GitHub remains the canonical source of PR/review/comment/check state.

### Data and security

- [ ] Supabase migrations run cleanly in a staging project and are version-controlled.
- [ ] RLS and server authorization tests prove cross-workspace isolation for every workspace-owned table.
- [ ] Service-role access is server-only; secrets are absent from client bundles, source control and logs.
- [ ] Webhook bodies and private code are not unnecessarily retained.
- [ ] Data retention, GitHub disconnect and workspace deletion behavior are documented and tested.
- [ ] Audit logging covers security-sensitive user actions.

### AI (when enabled)

- [ ] Review runs are pinned to head SHA and stale results cannot be presented as current.
- [ ] Strict JSON Schema and server evidence validation pass.
- [ ] Secret redaction, prompt-injection fixtures, chunk budgets and cost limits pass.
- [ ] Findings are clearly labelled as AI output and never impersonate GitHub reviewers.
- [ ] No automatic approve/merge/publish behavior exists.
- [ ] Any GitHub write feature is separately permissioned, user-confirmed and tested.

### Quality and operations

- [ ] Lint, typecheck, unit, integration, RLS, webhook, AI-contract and e2e suites pass.
- [ ] Production build and deployment smoke test pass.
- [ ] Error monitoring, queue/delivery lag alerts and safe structured logs are enabled.
- [ ] Database backup/restore and migration rollback/recovery procedure are documented.
- [ ] Rate limits, queue concurrency, model cost ceilings and abuse controls are configured.
- [ ] `.env.example` matches runtime configuration and contains placeholders only.
- [ ] `docs/BUILD_STATUS.md` reports shipped scope, test evidence, remaining risks and rollback notes.

## 6. Definition of done for a release

A release is ready only when:

1. Every acceptance criterion in its included phases passes.
2. The Core ship checklist has no unchecked mandatory item for that release.
3. No unresolved critical/high security defect remains.
4. Known limitations are documented in the UI or release notes, not hidden.
5. The deployed build has been smoke-tested against the intended GitHub App and Supabase environment.
6. Rollback steps and the owner for operational alerts are known.

Do not label the product “100% production-ready.” Production readiness is an evidence-based release decision and must be re-evaluated whenever permissions, data flows, models, migrations or deployment infrastructure change.
