# START HERE — Instructions for Antigravity

You are the senior product engineer responsible for building **PRAXD**, an AI-powered GitHub Pull Request workspace.

## Before writing application code

1. Read every document listed in `README.md` in the stated order.
2. Inspect both supplied screenshots in `reference/` at full size. These screenshots are the source of truth for the primary PR workspace layout.
3. Create a concise implementation checklist from `docs/ROADMAP_ACCEPTANCE.md`.
4. Confirm the repository is empty or inspect its existing files before changing anything. Preserve useful existing code; do not overwrite blindly.
5. Report any conflict between the current repository and these specs before making destructive changes.

## Product outcome

Build a functional web application named **PRAXD**. Users connect a GitHub account through a GitHub App installation, browse repositories, inspect PRs, compare changed code, read review/conversation comments and check status, and manually run AI code review.

The primary experience must closely reproduce the supplied reference layout:

- Persistent left PR inbox/list occupying approximately 28% of a 1482px desktop viewport (reference width: about 420px).
- Main workspace occupying the remaining width.
- PR list header with All / Reviewing / Authored tabs, search, filter, grouping and compact PR rows.
- Main header with PR title, Summary / Code switch, Chat affordance, and contextual GitHub link/actions.
- Summary view with author, branch comparison, reviewer request, comments, checks, status, description, and checks section.
- Code view with changed-file context and side-by-side diff, line numbers, additions/deletions and inline comments.
- Dark neutral surfaces, restrained borders, compact typography, subtle status colors and high information density.

The screenshots show the target hierarchy and geometry. Do not replace it with a generic admin dashboard, marketing landing page, card grid, or a different three-column layout.

## Non-negotiable engineering rules

- Use TypeScript with strict mode. Avoid `any`; document unavoidable exceptions.
- Use Next.js App Router. Keep server-only GitHub credentials and provider secrets out of client bundles.
- Use Supabase Auth and PostgreSQL with Row Level Security. Every workspace-owned table must be tenant-isolated.
- Use a GitHub App installation for repository access. Never ask users to paste a personal access token as the default integration.
- Start with least-privilege, read-only GitHub permissions. Do not request write permissions until an approved feature requires them.
- Verify GitHub webhook HMAC signatures against the exact raw request body using constant-time comparison.
- Store webhook delivery IDs and process deliveries idempotently.
- Keep GitHub as the source of truth. Local records are a synchronized read model, not an independent replacement.
- AI findings must include evidence: exact changed file path, valid changed line/range when available, severity, confidence, explanation and suggested fix.
- Never fabricate a line number or claim an issue exists without evidence in retrieved code/context.
- AI review is advisory. Never merge, approve, dismiss, or publish comments automatically in the MVP.
- Distinguish GitHub-authored comments from PRAXD-generated AI findings in storage and UI.
- Add loading, empty, error, retry and permission-denied states. Do not leave dead buttons or fake interactions.
- Use accessible keyboard navigation, visible focus, semantic controls and responsive behavior.
- Add tests for authorization, webhook verification, GitHub API adapters, AI output validation and core UI states.

## Build order

Follow the phases in `docs/ROADMAP_ACCEPTANCE.md`. Do not jump to AI review before the GitHub repository and PR read workflow is working. First finish the UI shell with realistic fixtures, then GitHub read integration, then diff/comment/check data, then manual AI review.

## UI implementation instructions

- Use `docs/UI_UX_SPEC.md` as the detailed UI contract.
- Build reusable components: `PullRequestSidebar`, `PullRequestListItem`, `WorkspaceHeader`, `SummaryView`, `CodeView`, `DiffViewer`, `FileTree`, `ReviewTimeline`, `CheckRunList`, `CommentThread`, `AiReviewPanel`.
- Do not use the generated concept image from the previous conversation as a design reference. Only the two screenshot files bundled under `reference/` are the approved references.
- Preserve the screenshot's dark workspace appearance. A light theme is not part of the MVP.
- Use real data when connected; fixtures may only be used in an explicitly labelled development/demo mode.

## AI coding agent workflow

For each milestone:

1. State which spec and acceptance criteria are being implemented.
2. Inspect relevant files and propose a small plan.
3. Implement the smallest complete vertical slice.
4. Run lint, typecheck, unit tests and relevant integration/e2e tests.
5. Fix failures before proceeding.
6. Update `docs/BUILD_STATUS.md` with completed work, tests run, known gaps and next step.

Do not claim an integration works until it has been tested with valid credentials or an explicit mocked integration test. If a secret or external account is unavailable, implement the adapter and test harness, document the missing setup, and keep the UI honest about its disconnected state.

## First task

Create the application skeleton, design tokens, authenticated app shell and screenshot-matched PR workspace using local fixture data. Do not integrate GitHub or AI in the first implementation task. Make the Summary and Code tabs functional, make PR list selection update the main workspace, and make the layout responsive. Then run the project's checks and update `docs/BUILD_STATUS.md`.
