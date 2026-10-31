# START HERE — Instructions for Antigravity

You are the senior product engineer responsible for building and maintaining **PRAXD**, a personal, high-performance GitHub Pull Request management and code diff workspace.

## Core Product Outcome

Build and maintain a focused, high-performance personal web application named **PRAXD**. Users connect their personal GitHub account through a GitHub App installation, browse repositories, triage PRs, inspect rich PR summaries, read conversation comments and CI check status, and examine side-by-side split & unified code diffs with synchronized horizontal scrolling.

The primary experience faithfully reproduces the approved reference layout from `reference/`:

- **Persistent left PR inbox/list** occupying approximately 28% of a desktop viewport (reference width: ~420px, resizable with magnetic snapping at 340px, 420px, 540px).
- **Main workspace** occupying the remaining width with seamless tab switching between `Summary` and `Code` views.
- **PR list header** with `All` / `Reviewing` / `Authored` tabs, search, filter, grouping and compact PR rows.
- **Clean workspace header** with PR title, `Summary` / `Code` view switch, external GitHub link, and safe merge guardrail.
- **Summary view** with author, branch flow (`head > base`), requested reviewers, comments, status, description, and checks list.
- **Code view** with changed-file context, side-by-side split & unified diffs, pinned line numbers, additions/deletions, line folding, and inline comment anchors.
- **Dark neutral surfaces**, restrained borders, compact typography, subtle status colors, and high information density.
- **Pure Git & PR Focus:** Fast, personal PR review without external AI API dependencies, chat drawers, or enterprise team bloat.

## Non-Negotiable Engineering Rules

- Use TypeScript with strict mode. Avoid `any`; document unavoidable exceptions.
- Use Next.js App Router. Keep server-only GitHub credentials out of client bundles.
- Use Supabase Auth and PostgreSQL with Row Level Security.
- Use a GitHub App installation for repository access.
- Start with least-privilege, read-only GitHub permissions.
- Verify GitHub webhook HMAC signatures against the exact raw request body using constant-time comparison.
- Store webhook delivery IDs and process deliveries idempotently.
- Keep GitHub as the source of truth. Local records are a synchronized read model, not an independent replacement.
- Add loading, empty, error, retry and permission-denied states. Do not leave dead buttons or fake interactions.
- Use accessible keyboard navigation, visible focus, semantic controls and responsive behavior.
- Add tests for authorization, webhook verification, GitHub API adapters, diff rendering, and core UI states.

## UI Implementation Instructions

- Use `docs/UI_UX_SPEC.md` as the detailed UI contract.
- Build reusable, modular components: `PullRequestSidebar`, `PullRequestListItem`, `WorkspaceHeader`, `SummaryView`, `CodeView`, `DiffViewer`, `CheckRunList`, `ActivityTimeline`.
- Preserve the screenshot's dark workspace appearance (`#111111`, `#161616`, dark neutral surfaces).
- Use real data when connected; fixtures may only be used in an explicitly labelled development/demo mode.
