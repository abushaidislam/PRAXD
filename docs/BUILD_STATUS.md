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
- [x] **PR Conversation Comments & Multi-Line Markdown Composer:**
  - Multi-line auto-expanding Markdown textarea composer replacing single-line input to preserve `\n` linebreaks, headings, bullet lists, and code blocks.
  - Interactive segmented `Write` and `Preview` tabs with live Markdown preview before posting.
  - Mini Profile Selector dropdown allowing toggle between Personal Profile (`abushaidislam`) and GitHub App Bot (`praxd-app[bot]`).
  - Markdown helper toolbar buttons for quick formatting (Bold, Italic, Heading, Code, List, Quote).
  - Keyboard shortcut `Ctrl+Enter` / `Cmd+Enter` to submit quickly without leaving the keyboard.
  - API route `POST /api/pull-requests/[pullRequestId]/comments` accepting `profileType` and updating local timeline with proper author avatar and `BOT` / `Author` badge.

### 6. Codebase Hygiene & Dead Code Removal
- [x] **Dead Component Removal:** Safely removed deprecated `components/ai-review-panel.tsx` leftover from Phase 3 simplification.
- [x] **Asset De-duplication:** Removed unreferenced duplicate logo asset `public/praxd-logo.png` in favor of canonical `public/logo.png`.
- [x] **Reconciler Verification:** Integrated and validated `runDeliveryReconciler` (`lib/github/reconciler.ts`) into `tests/phase2-webhooks.test.ts` for automated test coverage of requirement P2-11.
- [x] **Clean Quality Pipeline:** Verified 0 ESLint warnings, 0 TypeScript errors, and 88 passing Vitest tests.
- [x] **Global Design System & Browser Surfaces:**
  - Removed blanket `user-select: none` from body, restoring code, comment, commit SHA, and description selectable text.
  - Custom themed selection (`::selection` & `::-moz-selection` with alpha brand blue).
  - Themed caret color for text inputs and textareas.
  - Firefox custom scrollbar matching WebKit scrollbars (`scrollbar-width: thin`).
  - Text antialiasing and subpixel optimization.
- [x] **Workspace Header & View Navigation:**
  - Removed redundant bottom border (`border-b`) on `WorkspaceHeader` to provide a clean, unified flow into the view toolbar without stacked dividing lines.
  - Added PR number pill (`#<number>`) with mono styling.
  - Added keyboard shortcut badges (`1` for Summary, `2` for Code) with global keydown navigation.
  - Polished external GitHub link and high-contrast Merged/Closed status badges.
- [x] **Left PR Inbox Sidebar & ListItem:**
  - Resolved responsive header overlap: split the sidebar top bar into a clean Row 1 (`BrandLogo` + `PanelLeftClose` toggle) and Row 2 full-width 3-column segmented tabs (`All`, `Reviewing`, `Authored`), eliminating icon and badge collisions at narrower widths.
  - Added mobile responsive auto-collapse upon selecting a PR and responsive master-detail layout.
  - Real-time tab count badges (`All`, `Reviewing`, `Authored`).
  - Keyboard navigation (`ArrowUp` / `ArrowDown`) through PR list.
  - Active list item accent indicator bar with high contrast typography and `tabular-nums` diff metrics.
- [x] **Summary View:**
  - Refined branch flow arrow (`headRef → baseRef`) with 1-click branch name copy button.
  - Rendered requested reviewers with avatar chips, status icons (approved, changes requested, pending).
  - Checks summary pill `(X/Y passed)`.
  - 1-click description markdown copy button with checkmark confirmation.
- [x] **Code View & GitHub-Style Collapsible Multi-File Diff View:**
  - Multi-file vertical stacked layout matching GitHub PR changes interface.
  - Collapsible file headers with file type badges (`M↓`, `TS`, `JS`, `⚙`, `CSS`), basename, directory path, `+additions -deletions`, and chevron toggle (`>` / `⌵`).
  - By default, the 1st file is expanded while subsequent files are collapsed to single lines.
  - Clicking any file header toggles its expansion directly in place beneath its header.
  - Added "Expand all" / "Collapse all" bulk toggle button to the top toolbar.
  - File picker dropdown and Prev/Next keyboard navigation (`[` and `]`) smoothly scroll to and auto-expand target file diff.
  - Sticky header bar keeps file context visible while scrolling through long diffs with `z-20` elevation.
  - Fixed stacking context hierarchy so line numbers gutter (`z-[1]`) and code lines cleanly scroll beneath the sticky file header (`z-20`) without overlapping the file name or badges.
  - Preserved 100% solid opacity on file headers when marked as viewed (`bg-[#111111]`) to prevent underlying diff content from bleeding through during scroll.
  - Enforced Impeccable craft floor: refined diff addition/deletion line borders to clean 1px (`border-l`).
  - 1-click file path copy button with feedback.
- [x] **Timeline & Modals:**
  - 1-click commit SHA copy button in activity timeline with feedback.
  - Full GitHub-Flavored Markdown (GFM) and safe HTML rendering engine (`components/markdown-content.tsx`).
  - Interactive collapsible accordions for `<details>` and `<summary>` blocks (e.g. Codex connector bot comments).
  - Native embedded HTML element handling inside tables and comments (`<a>`, `<img>`, `<sup>`, `<sub>`, `<kbd>`, `<br>`).
  - GitHub custom web component `<relative-time datetime="...">` formatted with clock icon, relative time, and full ISO tooltip.
  - Markdown images (`![alt](url)`) and status badges rendered inline rather than as broken link text.
  - One-click copy code button on fenced code blocks with language indicator.
  - GitHub alert callouts (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`).
  - Task list checkboxes (`- [ ]`, `- [x]`) and common GitHub emoji shortcodes (`:white_check_mark:`, `:eyes:`, `:thumbsup:`, etc.).
  - Bot comment metadata stripping (`[vc]: #...` and `<!-- ... -->`) and strict URL sanitization.
  - Modal keyboard `Escape` closing listeners and smooth entrance animations.

### 6. Developer Experience (DX) & Bite-Sized Polish Features (Shipped)
- [x] **"Mark File as Viewed" & Circular Review Progress Ring:**
  - Added `[✓] Viewed` button to each file header in the collapsible diff viewer.
  - Marking a file as viewed collapses the file and reflects viewed state with green checkmark indicator and dimmed header styling.
  - Streamlined top toolbar by eliminating redundant static file selector and prev/next buttons (all files are accessible directly in the vertical collapsible feed).
  - Upgraded review progress indicator from a linear bar to a compact SVG Circular Progress Ring (`X/Y viewed` with animated radial emerald fill and completion checkmark).
- [x] **Terminal Checkout Command Dropdown:**
  - Added `<CheckoutCommandDropdown />` in both `WorkspaceHeader` and `SummaryView` (branch row).
  - One-click copy for `gh pr checkout <number>`, `git checkout <headRef>`, and `git fetch origin <headRef> && git checkout <headRef>`.
  - Copy feedback with checkmark and toast notifications.
- [x] **Keyboard Shortcuts Cheatsheet Modal:**
  - Added accessible modal (`<KeyboardShortcutsModal />`) triggered by pressing `?` or clicking the keyboard icon button in `WorkspaceHeader`.
  - Cleanly categorized shortcuts for Views & Panels (`1`, `2`, `Ctrl+B`), Diff Navigation (`[`, `]`, `↑`, `↓`), and Actions (`Enter`, `Esc`, `?`).
- [x] **FileTreeDropdown Quick Search & Filter:**
  - Added instant search input inside `FileTreeDropdown` to rapidly filter files when reviewing pull requests with multiple changed files.
- [x] **Sleek Floating Toast Notification System:**
  - Added `<ToastProvider />` and `useToast()` rendering auto-dismissing notifications in the bottom-right corner for terminal commands and copy feedback.

### 7. Responsive Design & Full-Web Layout Polish (Shipped)
- [x] **Full-App Responsive Audit & Mobile Ergonomics:**
  - **PR Inbox ListItem (`PullRequestListItem`):** Replaced fixed `max-w-[220px]` with `truncate flex-1 min-w-0` to guarantee fluid width scaling and prevent badge wrapping or overflow at compact widths (280px–340px) or mobile viewports.
  - **Code View Breadcrumbs & Progress (`CodeView`):** Scaled branch flow breadcrumbs dynamically (`max-w-[150px] sm:max-w-[220px] md:max-w-[320px]`) and hid the `"viewed"` text label on mobile screens (`hidden sm:inline`) to keep circular progress ring visible without crowding toolbar icons.
  - **Mobile Default Diff Mode:** Automatically defaults diff mode to `"unified"` on viewports `< 768px` per UI/UX specification.
  - **Diff File Header & Subheaders (`DiffViewer`):** Hid directory path on mobile screens (`hidden sm:inline-block`) to prioritize file basename; adapted "Viewed" button label on mobile (`<span className="hidden sm:inline">Viewed</span>`) while preserving full `aria-label` and checkbox; concealed parenthetical labels `(Original revision)` / `(Modified revision)` on compact viewports.
  - **Dual-Pane Synced Scrollbar Footer:** Compressed sync scroll label on small screens (`Dual-Pane Sync Scroll` -> `Sync`) and optimized margin spacing (`ml-2 sm:ml-6`) to prevent horizontal clipping.
  - **Summary View Metadata Grid (`SummaryView`):** Applied `shrink-0` to all metadata labels (`w-[105px] sm:w-[120px] shrink-0`) to prevent text wrapping on mobile devices; made checkout dropdown flow cleanly without breaking bounds.
  - **Activity Timeline Commits (`ActivityTimeline`):** Replaced hardcoded `max-w-[420px]` on commit messages with `flex-1 min-w-0 truncate` to ensure commit SHA, author avatar, and relative timestamp remain visible on narrow screens.
  - **Dropdown Modals & Popovers:** Updated `FileTreeDropdown` and `CheckoutCommandDropdown` to use responsive viewport clamping (`w-[calc(100vw-24px)] max-w-xs / max-w-[340px] sm:w-80`) preventing edge overflowing on mobile.
  - **Demo Mode Top Bar (`DemoModeBadge`):** Responsive button text (`SWITCH TO FIXTURES` / `FIXTURES`) maintaining clean alignment across viewports.

---

## Quality Checks & Verification

- `lint` (`npm run lint`): Passed (`✔ No ESLint warnings or errors`).
- `typecheck` (`npm run typecheck`): Passed (`tsc --noEmit` 0 errors).
- `test` (`npm test`): Passed (96/96 tests passing across 12 test files).
- `build` (`npm run build`): Passed (16 static pages, 20 dynamic API routes compiled cleanly in Next.js production build).
