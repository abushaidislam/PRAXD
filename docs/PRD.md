# PRD — Product Requirements Document

**Product:** PRAXD  
**Edition:** Personal PR Management Workspace  
**Document status:** Core Personal Architecture (Option B — Pure Git & PR Focus with Full Write Actions)  
**Version:** 1.1.0-personal

---

## 1. Product Summary

PRAXD is a fast, focused, and distraction-free personal GitHub pull request workspace designed for individual developers and open-source maintainers. It brings repository discovery, pull-request triage, rich PR summaries, side-by-side code diffs, commit timelines, review comments, CI/CD checks, and **full personal PR write actions (merging, title/description editing, and conversation messaging)** into one cohesive, high-information-density interface.

Inspired directly by the approved reference screenshots (`reference/`), PRAXD eliminates unnecessary enterprise bloat (such as team management matrices, complex subscription billing, and external AI chat sidebars) to deliver a lightning-fast, pure Git PR triage, inspection, and execution experience.

---

## 2. Problem Statement

Developers who maintain multiple personal or open-source repositories often struggle with GitHub's default web interface when reviewing pull requests:
- Context is scattered across multiple tabs (Conversation, Commits, Checks, Files Changed).
- Diff viewers often suffer from desynchronized scrolling, slow file switching, and excessive whitespace.
- Switching between multiple incoming and authored PRs requires frequent back-and-forth navigation.
- Simple daily operations—like merging an approved PR, fixing a PR title typo, or responding to a reviewer comment—often force the developer to jump back into GitHub's slower web interface.

PRAXD solves this by providing a unified, dual-pane personal PR workstation: a persistent left inbox for instant triage, a synchronized Summary/Code workspace, and **direct execution actions to merge PRs, edit titles/descriptions, and post comments without leaving the app**.

---

## 3. Product Goals

### Core Personal PR Workspace Goals
1. **Personal GitHub Integration:**
   - Seamlessly connect a personal GitHub account or organization through a secure GitHub App.
   - Authoritative synchronization: GitHub remains the canonical source of truth for PR, review, commit, and check run states.
   - Real-time webhook ingestion with HMAC-SHA256 signature verification and delivery deduplication.

2. **Persistent Dual-Pane PR Inbox:**
   - Occupies approximately 28% of desktop viewport (~420px), resizable with magnetic snap points (340px, 420px, 540px).
   - Collapsible with shortcut (`Ctrl+B`) or toggle button to maximize diff viewing.
   - Tabbed filtering: `All`, `Reviewing`, and `Authored` pull requests.
   - Instant search across PR title, number, branch, and author.

3. **Minimal Workspace Header & Functional Merge Action:**
   - Clear PR title with inline editing affordance.
   - Branch flow indicator (`head > base`) and state badge.
   - Centered `Summary | Code` segmented view switcher.
   - Direct external link to GitHub PR.
   - **Interactive Merge Engine:** Functional `Merge v` action with method selection (Create merge commit, Squash and merge, Rebase and merge), commit message customization, and confirmation modal.

4. **Comprehensive Summary View & Interactive Conversation:**
   - Author details, branch comparison, requested reviewers, and status.
   - **In-Place PR Title & Description Editing:** Edit PR title and description directly within the workspace, immediately saved to GitHub.
   - Real-time CI/CD check run list with status badges, duration, and logs.
   - Activity timeline tracking commits, reviews, and conversation comments.
   - **Live Conversation Messaging:** Interactive comment box at the bottom of the discussion timeline to reply or leave review notes directly on GitHub.

5. **High-Performance Code Diff Viewer:**
   - Split (side-by-side) and Unified diff switcher.
   - Lockstep synchronized dual-pane horizontal scrolling (`scrollX`) between Base (Old) and Head (New) columns.
   - Fixed, pinned line number gutters and column dividers.
   - Unmodified line folding and multi-file selector dropdown with additions/deletions counts.
   - Inline comment threads positioned at exact diff line anchors.

---

## 4. Non-Goals (Scope Boundaries)

- **No External AI Chat or Review Overhead (Option B):** No LLM API calls, token metering, prompt injections, or AI chat drawers. The application is a pure, ultra-fast Git PR workspace.
- **No Multi-User Team Administration:** No team member invitation tokens, seat licensing, or 5-role RBAC hierarchies. The workspace belongs directly to the authenticated developer.
- **No Third-Party Notification Bots:** No Slack/Discord webhook alert dispatchers.
- **No Unconfirmed Actions:** All write actions (merging, title editing, posting comments) require explicit human interaction and confirmation.

---

## 5. User Persona & Access Model

- **Persona:** Individual software engineer, consultant, or open-source repository maintainer.
- **Authentication:** Personal GitHub OAuth / GitHub App session.
- **Permissions Required:** GitHub App with `Pull requests: write` (for merge, title edits) and `Issues: write` (for PR conversation comments).
- **Workspace:** Single personal workspace scoped directly to the authenticated developer's GitHub installations.

---

## 6. Primary User Journeys

### Journey 1 — Triage, Inspect & Edit PR
1. Developer opens PRAXD and views active pull requests in the left inbox.
2. Selects a PR to inspect summary, checks status, and conversation history.
3. Notices a typo in the PR title or description; clicks the edit pencil icon, updates the text, and saves it directly to GitHub.

### Journey 2 — Conversation & Commenting
1. Developer reads the discussion timeline in the Summary view.
2. Types a message into the "Leave a comment" input box and clicks "Comment".
3. The comment is instantly dispatched to GitHub via REST API and appended to the local timeline without page reload.

### Journey 3 — Code Diff Review & 1-Click Merge
1. Developer switches to the **Code** view to inspect split diffs with synchronized horizontal scroll.
2. Verifies that all CI check runs are passing.
3. Clicks **Merge**, selects preferred merge method (`Squash and merge` or `Create a merge commit`), enters commit title/message, and clicks **Confirm & Merge**.
4. The PR status advances to `merged` on GitHub and in the PRAXD workspace.
