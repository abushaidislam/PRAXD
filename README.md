# PRAXD — Personal GitHub PR Management & Code Diff Workspace

**Product:** PRAXD  
**Description:** Fast, focused, and distraction-free personal GitHub Pull Request workspace  
**Design references:** `reference/praxd-reference-pr-summary.png` and `reference/praxd-reference-code-diff.png`  
**Architecture:** 100% Pure Git & PR Focus (Zero AI bloat, zero enterprise complexity)

PRAXD is a personal web application for developers and maintainers to connect GitHub repositories, triage pull requests, inspect rich PR summaries, explore side-by-side split & unified code diffs with synchronized horizontal scrolling, and monitor commit activity and CI checks without the distraction of bloated enterprise suites or external AI dependencies.

The product's workspace faithfully follows the approved reference screenshots: a persistent pull-request inbox on the left and a high-performance Summary/Code workspace on the right.

---

## Core Features (Personal Developer Edition)

- **Persistent PR Inbox:**
  - Multi-tab organization: `All`, `Reviewing`, and `Authored` pull requests.
  - Real-time search across PR titles, numbers, authors, and branches.
  - Collapsible sidebar (`Ctrl+B`) with magnetic snapping (340px, 420px, 540px) to maximize diff viewing.
- **Minimal Workspace Header:**
  - Clean PR identity, branch comparison flow (`head > base`).
  - Centered `Summary | Code` segmented view toggle.
  - Direct external link to GitHub and safe merge guardrail.
- **Comprehensive Summary View:**
  - Complete PR description with markdown rendering.
  - Real-time CI/CD check run statuses with duration and logs.
  - Activity timeline displaying PR commits, comments, and review state changes.
- **High-Performance Code Diff Viewer:**
  - Side-by-side split and unified diff switcher.
  - Lockstep synchronized dual-pane horizontal scrolling across Base and Head revisions.
  - Pinned line number gutters, syntax highlighting, and unmodified line folding.
  - Multi-file switcher with additions/deletions badges.
- **Authoritative GitHub Synchronization:**
  - Authenticated via secure GitHub App.
  - Real-time webhook ingestion with HMAC-SHA256 signature verification and delivery deduplication.

---

## Read in this order

1. [`START_HERE.md`](START_HERE.md) — instructions and build rules.
2. [`docs/PRD.md`](docs/PRD.md) — product requirements and personal PR workspace scope.
3. [`docs/UI_UX_SPEC.md`](docs/UI_UX_SPEC.md) — screenshot-derived layout, interactions and design tokens.
4. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture, synchronization, and diff engine.
5. [`docs/GITHUB_INTEGRATION.md`](docs/GITHUB_INTEGRATION.md) — GitHub App permissions, webhook security, and event routing.
6. [`docs/ROADMAP_ACCEPTANCE.md`](docs/ROADMAP_ACCEPTANCE.md) — acceptance criteria, test scenarios, and ship checklist.
7. [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md) — build status and verified milestone history.

---

## Technical Stack

- **Framework:** Next.js (App Router) + React 19 + TypeScript (Strict Mode)
- **Styling:** Tailwind CSS + Lucide Icons + Dark Theme Tokens
- **Backend & Storage:** Supabase (PostgreSQL with Row Level Security)
- **VCS Integration:** GitHub REST API + Signed Webhooks
- **Testing:** Vitest + React Testing Library

---

## Running Locally

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run quality checks
npm run lint
npm run typecheck
npm run test
npm run build
```
