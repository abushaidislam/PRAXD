# PRD — Product Requirements Document

**Product:** PRAXD  
**Document status:** Proposed / pre-build  
**Version:** 0.1.0

## 1. Product summary

PRAXD is a GitHub-connected pull request workspace. It brings repository discovery, pull-request triage, PR summaries, code diffs, commits, reviews, comments, CI checks and AI-assisted code analysis into one focused interface.

The product is inspired by the supplied reference screenshots' workflow and information hierarchy. It is not a GitHub replacement: GitHub remains the authoritative system for source code, branches, pull request state, review state and checks.

## 2. Problem statement

Developers who maintain multiple repositories need to move between repositories and pull requests to understand what changed, inspect code, find review discussion and evaluate CI status. Large PRs and scattered context increase review time. Existing AI summaries can help, but the user still needs a trustworthy, evidence-linked view of the actual diff and review history.

PRAXD solves this by providing a unified PR inbox and detail workspace, with optional AI analysis grounded in changed code and relevant repository context.

## 3. Goals

- Connect a GitHub account through a GitHub App installation.
- List repositories the installation can access.
- List, search and filter pull requests across connected repositories.
- Provide a PR detail view with metadata, branches, reviewers, comments, checks and description.
- Render changed files and readable side-by-side/unified diffs.
- Show comments at the correct file/line context and keep human/AI sources distinct.
- Run a manual AI review and show actionable, evidence-based findings.
- Synchronize relevant GitHub changes through webhooks.
- Provide a clear, screenshot-matched dark UI that works on desktop and smaller screens.

## 4. Non-goals for MVP

- Replacing GitHub's full repository/code-hosting experience.
- Hosting Git repositories or editing/committing code in PRAXD.
- Automatically approving, merging, closing or modifying pull requests.
- Automatically posting AI comments to GitHub.
- Building a full project-management or issue-tracking suite.
- Supporting GitLab, Bitbucket or self-hosted GitHub Enterprise Server in the first release.
- Providing guaranteed security certification or claiming that a PR is safe to merge.
- Running arbitrary code from a connected repository.

## 5. Users and access model

### Initial persona: Individual developer / repository maintainer

Connects personal or organization repositories, checks authored and incoming PRs, reads review details, inspects diffs and requests an AI review.

### Later persona: Development team

Uses a shared workspace, shared GitHub installation, reviewer assignments, notifications and team analytics. The schema includes workspace membership from the beginning, but team collaboration UI can ship later.

### Authorization model

- A PRAXD user authenticates with Supabase Auth.
- The user creates/uses a PRAXD workspace.
- A GitHub App is installed on the user's GitHub account or an organization and grants repository access.
- The backend associates the installation with the workspace.
- All workspace data is visible only to authorized workspace members.
- GitHub access is limited to repositories selected by the installation owner.

## 6. MVP user journeys

### Journey A — First connection

1. User signs in to PRAXD.
2. User sees a clear empty state with a **Connect GitHub** action.
3. User installs the PRAXD GitHub App and chooses repository access.
4. GitHub redirects to PRAXD's setup/callback route.
5. PRAXD stores installation metadata and synchronizes accessible repositories.
6. User lands in the PR inbox with connected repositories and PRs.

### Journey B — Triage a PR

1. User opens the PR workspace.
2. User selects All, Reviewing or Authored.
3. User searches or filters the PR list.
4. User selects a PR.
5. Summary view shows PR metadata, branch comparison, review status, comments, checks and description.
6. User switches to Code to inspect changed files and diff.
7. User follows inline comments to the relevant changed lines.

### Journey C — Run AI review

1. User selects **Run AI Review** from the PR workspace.
2. PRAXD checks that the installation can read the PR and obtains the head SHA.
3. A durable background job fetches changed-file patches and bounded relevant context.
4. The AI review pipeline runs static/context checks and requests structured model output.
5. PRAXD validates every finding against actual changed files and line ranges.
6. Findings are saved against the exact PR head SHA and displayed in an AI Review panel.
7. If the PR head changes, the UI marks the prior review as stale and offers a rerun.

## 7. Functional requirements

### FR-01 Authentication and workspace

- Sign in/sign out using Supabase Auth.
- Create a default workspace during onboarding.
- Enforce workspace membership on server reads/writes and with RLS.
- Show connected/disconnected GitHub state.

### FR-02 GitHub installation

- Start GitHub App installation flow.
- Handle setup/callback with state/nonce validation.
- Record installation ID, account identity, installation status and repository scope.
- Support installation deletion/suspension events.
- Do not store short-lived installation tokens as durable credentials.

### FR-03 Repository list

- Display name, owner, visibility, primary language (when available), default branch, open PR count and last synchronized time.
- Search and sort repositories.
- Provide empty/error/loading states.

### FR-04 Pull request inbox

- Aggregate PRs from connected repositories.
- Tabs: All, Reviewing, Authored.
- Search by PR title, number, repository or author.
- Filters: state, draft, author, reviewer, checks, review decision and repository.
- PR list item displays title, repository, author, time, state, review state, additions and deletions.
- Pagination/infinite loading; no unbounded fetch.
- Collapsible sidebar toggle to expand diff workspace on compact laptop viewports.

### FR-05 PR summary

- Display PR title, number, author avatar/name, age, source branch, target branch and diff totals.
- Display reviewers and review request state.
- Display total comments and review activity.
- Display CI/check status with individual check details.
- Display PR description safely as Markdown (sanitize rendered HTML).
- Link to the original PR on GitHub.
- Guarded `Merge` control (disabled in MVP with informative read-only tooltip).

### FR-06 Code review workspace

- Provide Summary and Code modes without losing selected PR context.
- Provide changed-file navigation with a sticky file selector/dropdown for multi-file PRs.
- Render split (side-by-side) and unified diffs with an explicit mode switcher.
- Line numbers, additions/deletions, collapsed unchanged regions, and line gutter hover `+` affordance for review comments.
- Show inline comments with author, timestamp, body and resolved state when available.
- Keep horizontal scrolling within the diff pane, not the entire application.
- Handle binary, generated, very large and unavailable patches gracefully.

### FR-07 Comments, reviews and commits

- Display issue/conversation comments separately from line-level review comments.
- Display reviews and their state: APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED or pending as returned by GitHub.
- Display commits in chronological order with SHA, message, author and date.
- Deep-link comments to file/line context where the API provides it.

### FR-08 Checks

- Display check runs and commit statuses for the PR head SHA.
- Summarize success, failure, pending, neutral, cancelled and unknown states.
- Show name, conclusion/status, elapsed time if available and GitHub link.

### FR-09 AI review

- Manual review is the only MVP trigger.
- Run against a specific head SHA.
- Output overall summary, risk notes and structured findings.
- Each finding must include severity, title, explanation, impact, recommendation, confidence, file and validated line range/evidence when applicable.
- Findings must distinguish confirmed issue, potential issue and informational suggestion.
- Store prompt/model/version metadata and review run state.
- Do not write findings back to GitHub in MVP.
- Mark a review stale when the PR head SHA changes.

### FR-10 Synchronization

- Accept signed GitHub webhooks.
- Process webhook events idempotently.
- Queue synchronization; do not perform slow AI work inside webhook requests.
- Provide manual refresh fallback and periodic reconciliation job.

## 8. Non-functional requirements

- Security: server-only credentials, webhook verification, RLS and least-privilege GitHub permissions.
- Reliability: webhook idempotency, retryable background jobs and visible failure states.
- Performance: paginate PRs/files; lazy-load diffs and comments; avoid loading every file patch at once.
- Accessibility: keyboard-operable navigation, focus visibility, semantic labels and sufficient contrast.
- Maintainability: domain adapters for GitHub and AI, runtime schema validation and automated tests.
- Observability: structured logs, request/job IDs and error monitoring without logging tokens or source code.
- Privacy: collect/store only what is required; support disconnect and workspace data deletion.

## 9. MVP success criteria

- A new user can authenticate and install the GitHub App.
- Repositories in the installation are shown correctly.
- PR list pagination, search and basic filters work.
- Selecting a PR loads the correct summary, branch data, checks, comments, commits and files.
- Split and unified diff render correctly for normal text patches.
- AI review produces validated results tied to the current head SHA.
- Webhook duplicates do not create duplicate jobs or records.
- Unauthorized workspace users cannot read another workspace's data.
- Main workspace matches the supplied screenshot structure at desktop size and remains usable on tablet/mobile.

## 10. Risks and assumptions

- GitHub permissions, endpoint limits and installation access determine which data can be fetched.
- GitHub's PR-files endpoint returns at most 3,000 files; very large PRs require an explicit limited/unsupported state.
- Some diffs do not include a patch (binary, large or unsupported changes). The UI must not pretend otherwise.
- AI can miss issues or produce false positives. Findings must be evidence-backed, confidence-labelled and advisory.
- Review comments and conversation comments are different GitHub resources; both must be synchronized correctly.
- Exact UI parity depends on testing at the reference viewport and tuning dimensions, fonts and overflow behavior.
