# PRAXD Build Status — Personal PR Management Edition

**Last updated:** 2026-10-31  
**Current version:** v1.0.0-personal (Pure Git & PR Focus — Option B)  
**Status:** Core Personal PR Workspace Verified & Ready

---

## Architecture Overview (Option B: Pure Git & PR Focus)

PRAXD has been streamlined into a **Personal GitHub Pull Request Workspace** for individual developers and open-source maintainers. All enterprise bloat (multiplayer presence, team invitation tokens, 5-role RBAC, DORA analytics modals, data retention purges, and external AI chat drawers) has been removed to deliver a fast, quiet, and distraction-free code review environment.

---

## Shipped Core Capabilities

### 1. Dual-Pane Personal PR Workspace (Phase 0)
- [x] **Persistent Left PR Inbox:**
  - Standard reference width ~420px, resizable with magnetic snap points (340px, 420px, 540px) and bounds clamping (280px–720px).
  - Collapsible sidebar toggle button and `Cmd/Ctrl + B` keyboard shortcut.
  - Tabs: `All`, `Reviewing`, and `Authored` pull requests.
  - Real-time search across PR title, number, author, and branch.
  - Compact PR rows with author avatars, status icons, and `+additions -deletions`.
- [x] **Minimal Workspace Header:**
  - PR title and branch flow comparison.
  - Strictly centered `Summary | Code` segmented view toggle (`1` for Summary, `2` for Code).
  - Direct external link to GitHub PR (`ExternalLink`).
  - Safe Merge button guardrail with read-only explanatory tooltip.
  - *Clean layout: Zero enterprise icons, no presence indicators, no chat drawer button.*
- [x] **Comprehensive Summary View:**
  - Author details, branch flow (`head > base`), requested reviewers, and status.
  - Collapsible PR description with styled markdown formatting.
  - Real-time CI/CD check run list (`CheckRunList`) with passing/failing status and logs.
  - Activity timeline (`ActivityTimeline`) tracking commits, reviews, and conversation comments.
- [x] **High-Performance Code Diff Viewer:**
  - Side-by-side split diff and unified diff switcher.
  - Lockstep synchronized dual-pane horizontal scrolling (`scrollX`) between Base (Old) and Head (New) columns.
  - Fixed, pinned line number gutters and column dividers.
  - Unmodified context folding with expand affordances (`Expand context`).
  - Sticky multi-file selector dropdown with additions/deletions and change status.
  - Line-level inline comment threads and gutter hover `+` affordance.

### 2. Authoritative GitHub Integration (Phase 1)
- [x] Server-side GitHub App RS256 JWT generation with private key.
- [x] Ephemeral installation access token caching with in-memory buffer safety.
- [x] Canonical synchronization engine with natural idempotency keys:
  - Repositories: `(installation_id, github_repo_id)`
  - Pull requests: `(repository_id, number)`
- [x] State mapping: `merged_at != null` -> `merged`, `state == 'closed'` -> `closed`, else `open`.
- [x] Changed files synchronization with patch honesty (`patch_available: false` for binary files).
- [x] Commits, review records, discussion comments, and CI/CD check runs synchronization.

### 3. Webhook Ingestion & Deduplication (Phase 2)
- [x] Public webhook route (`/api/webhooks/github`) using raw request bytes.
- [x] HMAC-SHA256 signature verification (`X-Hub-Signature-256`) using constant-time buffer comparison (`crypto.timingSafeEqual`).
- [x] Payload size cap (24 MB) and required header enforcement.
- [x] Durable delivery deduplication preventing duplicate event execution.
- [x] Event handlers for `pull_request`, `pull_request_review`, `pull_request_review_comment`, `issue_comment`, and `check_run`.

---

## Quality Checks & Verification

- `lint` (`npm run lint`): Passed (0 warnings, 0 errors).
- `typecheck` (`npm run typecheck`): Passed (0 errors).
- `test` (`npm run test`): Core PR triage, state mapping, webhook verification, and workspace UI test suites pass.
- `build` (`npm run build`): Passed (Clean Next.js compilation).
