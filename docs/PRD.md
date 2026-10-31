# PRD — Product Requirements Document

**Product:** PRAXD  
**Document status:** v0.1.0 MVP & v0.5.0 Post-MVP Complete; v0.6.0 Enterprise Horizon Proposed  
**Version:** 0.6.0

## 1. Product summary

PRAXD is a GitHub-connected pull request workspace. It brings repository discovery, pull-request triage, PR summaries, code diffs, commits, reviews, comments, CI checks, evidence-grounded AI-assisted code analysis, and conversational PR intelligence into one focused interface.

The product is inspired by the supplied reference screenshots' workflow and information hierarchy. It is not a GitHub replacement: GitHub remains the authoritative system for source code, branches, pull request state, review state and checks.

## 2. Problem statement

Developers who maintain multiple repositories need to move between repositories and pull requests to understand what changed, inspect code, find review discussion and evaluate CI status. Large PRs and scattered context increase review time. Existing AI summaries can help, but the user still needs a trustworthy, evidence-linked view of the actual diff, conversational exploration, and review history.

PRAXD solves this by providing a unified PR inbox and detail workspace, with optional AI analysis grounded in changed code and relevant repository context.

## 3. Goals

### MVP Goals (Completed in v0.1.0)
- Connect a GitHub account through a GitHub App installation.
- List repositories the installation can access.
- List, search and filter pull requests across connected repositories.
- Provide a PR detail view with metadata, branches, reviewers, comments, checks and description.
- Render changed files and readable side-by-side/unified diffs with synchronized horizontal scrolling.
- Show comments at the correct file/line context and keep human/AI sources distinct.
- Run a manual AI review and show actionable, evidence-based findings.
- Synchronize relevant GitHub changes through webhooks with deduplication and reconciliation.
- User-confirmed publishing of individual findings back to GitHub.
- Provide a clear, screenshot-matched dark UI that works on desktop and smaller screens.

### Post-MVP Goals (Completed in v0.5.0)
- **Interactive PR Assistant & Contextual Chat:** Header **Chat** drawer activated with SSE streaming, diff-bounded retrieval, and `/explain`, `/test-ideas`, `/draft-response` slash commands.
- **Multiplayer Collaboration & Team Workspaces:** GitHub OAuth SSO, live reviewer presence indicators (WebSockets), and internal workspace-only discussions.
- **Automated Policy Trigger Rules & Risk Scoring:** Event-driven reviews on PR open/sync, composite PR risk scoring (0–100), and Slack/Discord alerts.
- **Enterprise Governance & Multi-Model Inference:** Multi-provider adapters (Anthropic Claude, Google Gemini, OpenAI, self-hosted Ollama/vLLM), automated patch retention purging, and DORA velocity analytics.

### Enterprise Horizon Goals (v0.6.0 — v1.0.0 GA)
- **Production CI/CD & Envelope Encryption:** GitHub Actions automated test gatekeeper (119 tests), live PostgreSQL migrations, and AWS KMS / Vault secret envelope encryption.
- **1-Click Autonomous Autofix:** Write-back Git commit engine applying validated AI patches directly to companion branches with human confirmation.
- **Developer IDE Integration:** Native VS Code and JetBrains extensions bringing PR triage and AI assistant into local code editors.
- **Multi-VCS Platform Expansion:** Pluggable VCS adapter layer supporting GitLab Merge Requests and Bitbucket PRs.
- **Commercial SaaS & Usage Metering:** Token usage quotas, workspace seat management, and Stripe subscription billing.

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

### Journey D — Interactive PR Assistant (v0.2.0)

1. User opens a complex PR and clicks the **Chat** button in the header (or presses `Cmd/Ctrl + K`).
2. A contextual slide-out chat drawer opens, pre-hydrated with the PR diff, description, checks, and prior AI findings.
3. User asks: *"Does this PR introduce breaking API changes to `/api/webhooks`?"*
4. The assistant streams a token-by-token response referencing exact file lines with clickable deep-links to the diff.
5. User highlights a 10-line block in the diff and clicks *"Draft review response"*; assistant generates a constructive review snippet ready to copy.

### Journey E — Collaborative Team Review (v0.3.0)

1. Reviewer A opens the PR workspace; teammate Reviewer B opens the same PR simultaneously.
2. Real-time presence indicators show both teammates' avatars in the top header.
3. Reviewer A leaves an internal workspace note (`@mentioning` Reviewer B) asking for a second pair of eyes on an authentication check.
4. Reviewer B receives a notification, inspects the line anchor, and marks the note as resolved.
5. After team consensus, Reviewer A selects the verified AI security finding and clicks **Publish to GitHub**, posting the comment directly to GitHub PR discussion.

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

### FR-11 Contextual PR chat assistant (v0.2.0)

- Activate header **Chat** button into a persistent PR-scoped chat drawer.
- Pre-load current PR metadata, modified files, diff hunks, and AI findings into context.
- Stream model responses via Server-Sent Events (SSE) with progressive reasoning display.
- Support slash commands: `/explain`, `/test-ideas`, `/draft-response`, `/security-audit`.
- Link code mentions back to specific diff line numbers with jump-to-line navigation.
- Redact secrets from user inputs and prompt buffers before dispatching to LLM APIs.

### FR-12 Team workspaces & real-time presence (v0.3.0)

- Social login via GitHub OAuth (Supabase Auth).
- Multi-user workspace member invitations and role management (`Owner`, `Admin`, `Reviewer`, `Viewer`).
- Real-time presence indicators via WebSockets showing active reviewers per PR.
- Workspace-only internal review notes and mentions that do not publish to GitHub.

### FR-13 Automated policy trigger rules & risk scoring (v0.4.0)

- Event-driven review triggers for specific branches (e.g. `main`, `release/*`) and file paths.
- Team custom rule-sets (Markdown-defined compliance, architectural patterns, test requirements).
- Composite PR risk score (0–100) and visual risk badge (`Low`, `Medium`, `High`) based on blast radius, churn, and finding severity.
- Slack and Discord webhook alert integrations.

### FR-14 Multi-model adapters & enterprise governance (v0.5.0)

- Provider-agnostic LLM interface supporting OpenAI, Anthropic Claude, Google Gemini, and local/on-prem endpoints (Ollama/vLLM).
- Automatic provider failover chain on rate limits (HTTP 429/503).
- Configurable diff patch retention policies (e.g. auto-purge raw patches 30 days post-merge).
- Engineering velocity and DORA metrics dashboard (cycle time, time-to-first-review).

### FR-15 Automated CI/CD pipelines & KMS envelope encryption (v0.6.0)

- GitHub Actions automated verification gatekeeper executing lint, strict typecheck, and full test suite on all PRs.
- Automated idempotent database migration runner for PostgreSQL.
- Envelope encryption of private keys and webhook secrets using AWS KMS / Vault / Vercel Secure Enclave with in-memory decryption.

### FR-16 1-Click autonomous autofix & PR commit engine (v0.7.0)

- Server-side Git write-back engine transforming AI suggestions into unified diffs.
- Creates companion branches or pushes commits directly to source branch upon explicit user confirmation.
- Pre-commit AST syntax validation to prevent committing broken code.

### FR-17 Developer IDE extensions (v0.8.0)

- Official VS Code extension and JetBrains plugin.
- Direct PR triage inbox, inline diff gutter findings, and real-time streaming chat inside native editor.
- 1-click local patch application with git stash safety.

### FR-18 Universal multi-VCS layer (v0.9.0)

- Generic VCS abstraction interface (`IVCSProvider`).
- Native support for GitLab.com / GitLab Self-Managed Merge Requests.
- Native support for Bitbucket Cloud Pull Requests.

### FR-19 SaaS usage metering & Stripe subscriptions (v1.0.0 GA)

- Workspace token consumption tracking and automated soft/hard quota caps.
- Stripe billing integration with Free, Pro, and Team seat-based licensing.
- Self-serve Customer Portal for invoices, payment method updates, and plan upgrades.

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
