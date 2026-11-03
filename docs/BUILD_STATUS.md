# PRAXD Build Status — Personal PR Management Edition

**Last updated:** 2026-11-03  
**Current version:** v1.2.1-personal (Real-time GitHub & Supabase Bi-Directional Comments, CI Checks & Commits Sync)  
**Status:** Complete & Production Ready — Personal Multi-Repo PR Workspace with Supabase Caching, Real CI Checks & Real Comments Sync

---

## Architecture Overview (Personal Multi-Repo PR Workspace with Supabase Caching)

PRAXD connects directly to the developer's personal GitHub account via GitHub App (`abushaidislam`), synchronizing across all repositories (93 repositories) and PRs into a high-performance Supabase PostgreSQL database read-model.

### Core Architecture Enhancements (v1.2.1)
1. **Supabase Personal Workspace Bootstrapping:** Automatically resolves the canonical personal workspace (`a0000000-0000-0000-0000-000000000001`) with associated member and active GitHub App installation (`176989009`).
2. **24-Item Pagination & Infinite Scroll:** The PR sidebar loads the initial 24 PRs and smoothly fetches the next batches as the user scrolls, showing accurate counts (`Showing X of Y pull requests`).
3. **Multi-Repository Aggregation:** PRs across all repositories are searchable, filterable (`All`, `Reviewing`, `Authored`), and rendered with their respective repository identity.
4. **Rich Live Details Hydration:** Selected PRs are hydrated on demand with full syntax diffs, file trees, discussion comments, and CI/CD check status.
5. **Real-time Bi-Directional GitHub & Supabase Comments Sync:** Real GitHub issue comments and review comments are fetched and synchronized into Supabase `pull_request_comments`. Writing comments in PRAXD posts to GitHub and persists to Supabase instantly.
6. **Live GitHub Actions & CI Check Runs:** Real CI check runs (e.g. Vercel Preview Comments, GitHub Actions) fetched directly from GitHub commits API, persisted into Supabase `check_runs`, and rendered with live statuses and external GitHub logs links.
7. **Full Commit History Timeline:** Commits on the PR branch are retrieved from GitHub, cached into Supabase `pull_request_commits`, and displayed with author avatars, commit SHAs, and relative timestamps in `ActivityTimeline`.

---

## Shipped Core Capabilities

### 1. Dual-Pane Personal PR Workspace (Phase 0)
- [x] **Persistent Left PR Inbox:**
  - Standard reference width ~420px, resizable with magnetic snap points (340px, 420px, 540px) and bounds clamping (280px–720px).
  - Collapsible sidebar toggle button and `Cmd/Ctrl + B` keyboard shortcut.
  - Tabs: `All`, `Reviewing`, and `Authored` pull requests.
  - Real-time search across PR title, number, author, and branch.
  - 24-item infinite scroll and explicit 'Load more pull requests' fallback.
  - Compact PR rows with author avatars, status icons, repository tag, and `+additions -deletions`.
- [x] **Minimal Workspace Header:**
  - PR title and branch flow comparison.
  - Strictly centered `Summary | Code` segmented view toggle (`1` for Summary, `2` for Code).
  - Direct external link to GitHub PR (`ExternalLink`).
- [x] **Comprehensive Summary View:**
  - Author details, branch flow (`head > base`), requested reviewers, and status.
  - In-place title & description editing with Write/Preview tabs, markdown toolbar, keyboard shortcuts (Ctrl+Enter, Esc), error boundaries, and background hydration protection.
  - Real-time CI/CD check run list (`CheckRunList`) with passing/failing status and logs.
  - Pixel-accurate GitHub-standard activity timeline (`ActivityTimeline` & `CommentComposer`) with centered spine rail, ring-masked node badges, avatars anchored on rail, and speech-bubble caret connectors.
- [x] **High-Performance Code Diff Viewer:**
  - Side-by-side split diff and unified diff switcher.
  - Lockstep synchronized dual-pane horizontal scrolling (`scrollX`) between Base (Old) and Head (New) columns.
  - Fixed, pinned line number gutters and column dividers.
  - Multi-file selector dropdown with additions/deletions and change status.
  - Line-level inline comment threads and gutter hover `+` affordance.

### 2. Authoritative GitHub Integration & Supabase Read Model (Phase 1)
- [x] Server-side GitHub App RS256 JWT generation with private key.
- [x] Ephemeral installation access token caching with in-memory buffer safety.
- [x] Supabase PostgreSQL read model synced with all 93 user repositories and 200 PRs.
- [x] Ephemeral on-demand hydration for full files, patch lines, comments, and CI check runs.

### 3. Webhook Ingestion & Deduplication (Phase 2)
- [x] Public webhook route (`/api/webhooks/github`) using raw request bytes.
- [x] HMAC-SHA256 signature verification (`X-Hub-Signature-256`) using constant-time buffer comparison (`crypto.timingSafeEqual`).
- [x] Self-healing repository provisioning on webhook receipt.
- [x] Durable delivery deduplication preventing duplicate event execution.

### 4. Functional Personal PR Write Actions
- [x] Interactive PR Merge Action (Merge commit, Squash, Rebase).
- [x] In-Place PR Title & Description Editing.
- [x] PR Conversation Comments & Multi-Line Markdown Composer.

### 5. Quality Pipeline
- [x] TypeScript Strict Mode (0 errors).
- [x] 96 passing Vitest unit and integration tests across 12 test suites.
