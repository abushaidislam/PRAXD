# UI/UX Specification — PRAXD Personal PR Workspace

**Status:** Source-of-truth visual specification  
**Edition:** Personal PR Management Workspace (Option B — Pure Git & PR Focus with Full Write Actions)  
**Reference screenshots:**
- `../reference/praxd-reference-pr-summary.png` — PR Summary state
- `../reference/praxd-reference-code-diff.png` — Code / split-diff state

---

## 1. Design Objective

Recreate the structure, density, and working feel of the supplied reference screenshots as an ultra-fast, distraction-free **Personal PR Workspace**. The target is a professional developer workstation: dark, quiet, information-rich, restrained, and lightning-fast.

All enterprise clutter (multi-user team invite modals, DORA analytics dialogs, data retention purges, and AI chat drawers) is removed. The developer's focus is 100% on reviewing pull requests, inspecting code diffs, tracking CI checks, and executing core PR actions (merging, title editing, and conversation comments).

---

## 2. Main Application Shell

### Proportions & Layout Geometry (Desktop ~1482 × 819 px)

- **Left PR Inbox:** Approximately **420 px** wide (~28% viewport width).
  - Resizable via draggable Linear-style handle with magnetic snap points (340px, 420px, 540px) and boundary limits (280px – 720px).
  - Collapsible via header toggle button and `Cmd/Ctrl + B` keyboard shortcut to provide full-viewport focus for code diffs.
- **Right Workspace Pane:** Fills all remaining width (~1062 px).
- **Independent Scroll Containers:** Left inbox and right workspace scroll independently.
- **Thin Separator:** 1px border (`#262626`) between panes.

---

## 3. Left PR Inbox

### Top Controls
- **Segmented Tabs:** `All`, `Reviewing`, and `Authored` with badge counts.
- **Search Field:** Fast inline filtering across PR titles, numbers, branches, and authors.
- **Filter Action:** Quick filter dropdown for open, closed, or merged PR states.

### List Items
- Compact rows with author avatars (or fallback monogram badges).
- PR state icon, title, relative time, repository name, branch flow (`head > base`), and `+additions -deletions` diff summary.
- Subtle elevated active state (`#1b1b1b`) without garish card styling.
- Keyboard navigation with Arrow keys (`Up` / `Down`) and `Enter` selection.

---

## 4. Minimal Workspace Header & Functional Merge Action

A clean, single-tier 48px top bar with zero bloat:

- **Left Section (PR Identity):**
  - Sidebar collapse/expand toggle button (`Cmd/Ctrl+B`).
  - PRAXD brand logo.
  - Pull request icon and title.
- **Center Section (View Switcher):**
  - Segmented toggle: **`Summary`** and **`Code`** (strictly centered in the main pane).
  - Keyboard shortcuts (`1` for Summary, `2` for Code).
- **Right Section (Actions):**
  - External GitHub link (`ExternalLink` icon) jumping directly to the PR on GitHub.
  - **Functional Merge Action (`Merge v`):**
    - Active when PR is open; displays split button or dropdown to select merge method:
      1. `Create a merge commit` (`merge`)
      2. `Squash and merge` (`squash`)
      3. `Rebase and merge` (`rebase`)
    - Clicking opens the **Merge Confirmation Modal**:
      - Displays PR title, target branch, and selected merge strategy.
      - Input fields for `Commit Title` and `Commit Message`.
      - Check-runs warning banner if any CI tests are failing or pending.
      - "Cancel" and "Confirm & Merge" buttons.
    - When merged, the button transitions to a disabled `Merged` state with purple indicator.

---

## 5. Summary View & Interactive Editing

Layout centered in main pane with readable maximum width (~780–840 px):

1. **Title & Header with In-Place Editing:**
   - Displays PR title with an edit pencil icon (`Pencil`).
   - Clicking allows editing the title inline with `Save` and `Cancel` controls (or `Enter` to save).
   - Saved titles immediately sync to GitHub via `PATCH /api/pull-requests/:id`.
2. **Author & Metadata Grid:**
   - Author avatar, username, and relative time.
   - Branch comparison (`head-branch → base-branch`) with total additions/deletions.
   - Requested reviewers list with approval badges.
   - Discussion comment count.
   - Overall CI checks result.
3. **Description Section with In-Place Editing:**
   - Markdown container rendering body text, lists, code spans, and links.
   - Edit button (`Pencil`) allowing editing the PR body directly with markdown preview and GitHub synchronization.
4. **Checks Section (`CheckRunList`):**
   - Detailed list of CI/CD check runs, passing/failing status, duration, and link to GitHub workflow runs.
5. **Activity Timeline & Live Conversation Messaging (`ActivityTimeline`):**
   - Chronological stream of commits, reviews, and conversation comments.
   - **Interactive Comment Editor:**
     - Positioned at the bottom of the timeline.
     - Textarea with placeholder `Leave a comment... (Markdown supported)`.
     - "Comment" submit button with loading spinner.
     - On submission, calls `POST /api/pull-requests/:id/comments` and optimistically appends the comment to the timeline.

---

## 6. High-Performance Code View

The primary diff workspace replicating the first reference screenshot:

1. **File Breadcrumb Toolbar:**
   - Source branch to target branch context.
   - **Sticky File Selector:** Dropdown showing all touched files with additions/deletions and change status (`modified`, `added`, `deleted`, `renamed`).
   - **Split vs. Unified Diff Mode Switcher:** Explicit segmented toggle (`Split` | `Unified`).
2. **Synchronized Dual-Pane Diff Viewer:**
   - **Split Mode:** Side-by-side Base (Old) and Head (New) revision columns.
   - **Lockstep Synchronized Horizontal Scroll:** Both columns scroll horizontally in lockstep with pinned line numbers and fixed dividers.
   - Interactive synchronized bottom scrollbar with click-to-jump track and nudge buttons.
   - Line numbers pinned to left gutter on both sides.
   - Unmodified context folding with expand affordances (`Expand context`).
   - Green fill for additions (`#2fbf71`), red fill for deletions (`#f05252`).
3. **Line-Level Inline Comments:**
   - Gutter hover `+` affordance to view line comments.
   - Discussion threads anchored directly beneath the cited line.

---

## 7. Visual Design Tokens

```css
:root {
  color-scheme: dark;
  --praxd-bg: #111111;
  --praxd-sidebar: #171717;
  --praxd-panel: #1b1b1b;
  --praxd-panel-hover: #222222;
  --praxd-border: #303030;
  --praxd-border-soft: #262626;
  --praxd-text: #f2f2f2;
  --praxd-text-secondary: #a3a3a3;
  --praxd-text-muted: #737373;
  --praxd-green: #2fbf71;
  --praxd-red: #f05252;
  --praxd-amber: #d6a344;
  --praxd-blue: #5a9cff;
  --praxd-purple: #a855f7;
  --praxd-radius-sm: 6px;
  --praxd-radius-md: 9px;
  --praxd-radius-lg: 12px;
  --praxd-font-ui: Inter, Geist, ui-sans-serif, system-ui, sans-serif;
  --praxd-font-code: "Geist Mono", ui-monospace, SFMono-Regular, monospace;
}
```

---

## 8. Responsive Breakpoints

- **`>= 1200px` (Desktop):** Full dual-pane workspace with resizable left inbox (340px–540px) and split diff.
- **`768px – 1199px` (Tablet/Laptop):** Narrower inbox or collapsed sidebar; diff defaults to split with unified fallback.
- **`< 768px` (Mobile):** Stacked view; navigation between PR list and PR detail; diff switches to unified view.
