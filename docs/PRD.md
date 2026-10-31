# PRD — Product Requirements Document

**Product:** PRAXD  
**Edition:** Personal PR Management Workspace  
**Document status:** Core Personal Architecture (Option B — 100% Pure Git & PR Focus)  
**Version:** 1.0.0-personal

---

## 1. Product Summary

PRAXD is a fast, focused, and distraction-free personal GitHub pull request workspace designed for individual developers and open-source maintainers. It brings repository discovery, pull-request triage, rich PR summaries, side-by-side code diffs, commit timelines, review comments, and CI/CD checks into one cohesive, high-information-density interface.

Inspired directly by the approved reference screenshots (`reference/`), PRAXD eliminates unnecessary enterprise bloat (such as team management matrices, complex subscription billing, and external AI chat sidebars) to deliver a lightning-fast, pure Git PR triage and diff inspection experience.

---

## 2. Problem Statement

Developers who maintain multiple personal or open-source repositories often struggle with GitHub's default web interface when reviewing pull requests:
- Context is scattered across multiple tabs (Conversation, Commits, Checks, Files Changed).
- Diff viewers often suffer from desynchronized scrolling, slow file switching, and excessive whitespace.
- Switching between multiple incoming and authored PRs requires frequent back-and-forth navigation.
- Modern enterprise review tools are overburdened with multi-user team billing, complex RBAC roles, and invasive AI chat drawers that distract from pure code review.

PRAXD solves this by providing a unified, dual-pane personal PR workstation: a persistent left inbox for instant triage and a synchronized Summary/Code workspace on the right.

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

3. **Ultra-Clean Minimal Workspace Header:**
   - Clear PR title, branch flow indicator (`head > base`), and status badge.
   - Centered `Summary | Code` segmented view switcher.
   - Direct external link to GitHub PR.
   - Safe merge button guardrail (read-only protection directing user to GitHub).

4. **Comprehensive Summary View:**
   - Author details, branch comparison, requested reviewers, and status.
   - Collapsible PR description with styled markdown formatting.
   - Real-time CI/CD check run list with status badges and duration.
   - Activity timeline tracking commits, reviews, and conversation comments.

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
- **No Git Hosting Replacement:** Source code hosting, branch creation, and merge execution remain authoritative on GitHub.

---

## 5. User Persona & Access Model

- **Persona:** Individual software engineer, consultant, or open-source repository maintainer.
- **Authentication:** Personal GitHub OAuth / GitHub App session.
- **Workspace:** Single personal workspace scoped directly to the authenticated developer's GitHub installations.
- **Security:** Server-side GitHub App private keys, zero credentials in client bundles, and Row Level Security on local cache tables.

---

## 6. Primary User Journeys

### Journey 1 — Triage & Review
1. Developer opens PRAXD and instantly sees their active pull requests grouped in the left inbox.
2. Filters by `Reviewing` to see PRs requesting their review, or uses search to find a specific feature branch.
3. Clicks a PR to inspect its summary, checks status, and conversation history.

### Journey 2 — In-Depth Code Diff Inspection
1. Developer switches to the **Code** view (or presses keyboard shortcut).
2. Uses the sticky multi-file picker to jump between touched files.
3. Reads the side-by-side split diff with synchronized horizontal scroll across long lines without viewport misalignment.
4. Collapses the left sidebar (`Ctrl+B`) for full-screen code focus.
5. Clicks "Open on GitHub" to submit official review or merge.
