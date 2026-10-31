# PRAXD Build Status — Personal PR Management Edition

**Last updated:** 2026-10-31  
**Current version:** v1.1.0-personal (Pure Git & PR Focus with Full Write Actions — Option B)  
**Status:** Complete & Production Ready — Personal PR Management Workspace with Full Write Actions

---

## Architecture Overview (Option B: Pure Git & PR Focus with Full Write Actions)

PRAXD has been streamlined into a **Personal GitHub Pull Request Workspace** for individual developers and open-source maintainers. All enterprise bloat (multiplayer presence, team invitation tokens, 5-role RBAC, DORA analytics modals, data retention purges, and external AI chat drawers) has been removed to deliver a fast, quiet, and distraction-free code review environment.

In addition to core triage and diff inspection, PRAXD includes **direct personal PR write actions**:
1. **Interactive PR Merging:** `Merge v` action with method selection (Create merge commit, Squash and merge, Rebase and merge) and confirmation modal.
2. **In-Place PR Title & Description Editing:** Edit PR title and description directly within the workspace and sync immediately to GitHub.
3. **Live Conversation Messaging:** Reply and post discussion comments directly to the PR timeline without leaving the app.

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

### 4. Functional Personal PR Write Actions (Shipped & Verified)
- [x] **Interactive PR Merge Action:**
  - Header `Merge` button triggers modal (`components/merge-modal.tsx`).
  - Supports 3 merge strategies: `merge` (Create a merge commit), `squash` (Squash and merge), and `rebase` (Rebase and merge).
  - Customizable commit title and commit message fields.
  - API route `PUT /api/pull-requests/[pullRequestId]/merge` calling GitHub REST API `PUT /repos/{owner}/{repo}/pulls/{number}/merge`.
  - Reflects merged status (`Merged` purple badge) instantly in workspace state.
- [x] **In-Place PR Title & Description Editing:**
  - Inline pencil button activates edit mode in `components/summary-view.tsx`.
  - Title input supports keyboard `Enter` to save and `Escape` to cancel.
  - Description textarea supports rich markdown text and quick save.
  - API route `PATCH /api/pull-requests/[pullRequestId]` syncing directly with GitHub REST API `PATCH /repos/{owner}/{repo}/pulls/{number}`.
- [x] **PR Conversation Comments:**
  - "Leave a comment" composer at the bottom of the activity timeline in `components/activity-timeline.tsx`.
  - API route `POST /api/pull-requests/[pullRequestId]/comments` calling GitHub REST API `POST /repos/{owner}/{repo}/issues/{number}/comments`.
  - New comments immediately rendered in timeline with user avatar and relative timestamp.

### 5. Impeccable Web UI/UX Craft Polish
- [x] **Global Design System & Browser Surfaces:**
  - Removed blanket `user-select: none` from body, restoring code, comment, commit SHA, and description selectable text.
  - Custom themed selection (`::selection` & `::-moz-selection` with alpha brand blue).
  - Themed caret color for text inputs and textareas.
  - Firefox custom scrollbar matching WebKit scrollbars (`scrollbar-width: thin`).
  - Text antialiasing and subpixel optimization.
- [x] **Workspace Header & View Navigation:**
  - Added PR number pill (`#<number>`) with mono styling.
  - Added keyboard shortcut badges (`1` for Summary, `2` for Code) with global keydown navigation.
  - Polished external GitHub link and high-contrast Merged/Closed status badges.
- [x] **Left PR Inbox Sidebar & ListItem:**
  - Real-time tab count badges (`All`, `Reviewing`, `Authored`).
  - Keyboard navigation (`ArrowUp` / `ArrowDown`) through PR list.
  - Active list item accent indicator bar with high contrast typography and `tabular-nums` diff metrics.
- [x] **Summary View:**
  - Refined branch flow arrow (`headRef → baseRef`) with 1-click branch name copy button.
  - Rendered requested reviewers with avatar chips, status icons (approved, changes requested, pending).
  - Checks summary pill `(X/Y passed)`.
  - 1-click description markdown copy button with checkmark confirmation.
- [x] **Code View & Diff Viewer:**
  - Enforced Impeccable craft floor: refined diff addition/deletion line borders to clean 1px (`border-l`).
  - Added keyboard navigation (`[` for previous file, `]` for next file).
  - Dynamic file extension badge (TS, JS, CSS, JSON, etc.) based on file type.
  - 1-click file path copy button with feedback.
- [x] **Timeline & Modals:**
  - 1-click commit SHA copy button in activity timeline with feedback.
  - Modal keyboard `Escape` closing listeners and smooth entrance animations.

---

## Quality Checks & Verification

- `lint` (`npm run lint`): Passed (0 warnings, 0 errors).
- `typecheck` (`npm run typecheck`): Passed (0 errors).
- `test` (`npm run test`): Passed (71/71 tests passing across 10 test files).
- `build` (`npm run build`): Passed (16 static pages, 20 dynamic API routes compiled cleanly in Next.js).
