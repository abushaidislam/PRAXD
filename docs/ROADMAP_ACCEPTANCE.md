# PRAXD — Roadmap & Acceptance Criteria

**Document status:** Implementation contract  
**Edition:** Personal PR Management Workspace (Option B — Pure Git & PR Focus)  
**Applies to:** Core Personal PR Workspace Release  
**Normative sources:** `START_HERE.md`, `docs/PRD.md`, `docs/UI_UX_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/GITHUB_INTEGRATION.md`, and `migrations/0001_initial_schema.sql`.

---

## 0. Release Principles

1. **GitHub is authoritative.** PRAXD is a fast, synchronized read model. Do not invent or independently mutate GitHub PR state.
2. **Pure Git & PR Focus (Option B):** Zero external AI dependencies, zero LLM token costs, zero chat sidebars, and zero enterprise multi-user bloat. The application is built for personal developer productivity.
3. **Keep the supplied reference layout.** The approved visual authority is `reference/praxd-reference-pr-summary.png` and `reference/praxd-reference-code-diff.png`.
4. **Synchronized Diff Navigation:** Side-by-side split diff columns must remain horizontally synchronized in lockstep with pinned line gutters.
5. **No secrets in the browser.** GitHub App private keys, installation tokens, and webhook secrets stay strictly on the server.
6. **A visible control must work.** Implement its behavior, or visibly disable it with an explanation.

---

## 1. Core Implementation Phases

### Phase 0 — Application Shell & Visual Contract
- [x] Responsive dual-pane workspace reproducing the reference screenshots (`#111111` dark surface).
- [x] Persistent left PR inbox (~420px, resizable with magnetic snap points 340px, 420px, 540px, collapsible with `Cmd/Ctrl+B`).
- [x] Segmented tabs: `All`, `Reviewing`, `Authored`.
- [x] Search field filtering by title, PR number, branch, and author.
- [x] Header centering: Centered `Summary | Code` segmented tabs.
- [x] Split vs Unified diff switcher with synchronized dual-pane horizontal scrolling.
- [x] Pinned line number gutters, column dividers, and unmodified line folding.
- [x] Multi-file sticky selector dropdown with additions/deletions counts.

### Phase 1 — GitHub Integration & Canonical Synchronization
- [x] Secure GitHub App RS256 JWT generation with private key.
- [x] Ephemeral installation access token caching with in-memory buffer protection.
- [x] Natural key deduplication: `(installation_id, github_repo_id)` and `(repository_id, number)`.
- [x] PR state mapping (`open`, `closed`, `merged`).
- [x] Changed files synchronization with patch honesty (`patch_available: false` for binary files).
- [x] Commits, review records, discussion comments, and CI/CD check runs synchronization.

### Phase 2 — Webhook Ingestion & Deduplication
- [x] HMAC-SHA256 signature verification (`X-Hub-Signature-256`) using constant-time buffer comparison.
- [x] Payload size capping (24 MB) and required header enforcement.
- [x] Webhook delivery deduplication preventing redundant processing of duplicate deliveries.
- [x] Event handlers for `pull_request`, `pull_request_review`, `issue_comment`, and `check_run`.

### Phase 3 — Personal PR Workspace Simplification (Option B)
- [x] **Workspace Header De-cluttering:**
  - Removed 6 enterprise buttons from the header: Team management, Policy bot, DORA analytics, Data retention governance, AI chat toggle, and Presence avatars.
  - Kept essential personal controls: Sidebar collapse toggle (`Ctrl+B`), PR identity, Centered `Summary | Code` toggle, External GitHub link (`ExternalLink`), and safe Merge guardrail.
- [x] **Summary View Streamlining:**
  - Removed internal team discussion panel (`InternalNotesPanel`).
  - Removed AI review panel (`AIReviewPanel`) and blast radius scoring.
  - Focused layout on: PR metadata grid, expandable description markdown, CI/CD check runs (`CheckRunList`), and activity timeline (`ActivityTimeline`).
- [x] **Code View Focus:**
  - High-performance side-by-side split & unified diffs.
  - Synchronized horizontal scroll lockstep across Base and Head revisions.
  - Clean diff gutters and file switcher without AI finding callout badges.
- [x] **API & Bundle Optimization:**
  - Disconnected AI chat SSE streams and message persistence routes.
  - Disconnected enterprise member invitations, presence heartbeats, and SOC2 workspace purges.

---

## 2. Core Ship Checklist

### Product & UX
- [x] The two screenshot references remain the source of truth for the primary PR workspace.
- [x] Inbox, Summary, and Code workflows are fully functional with connected GitHub data.
- [x] Loading, empty, error, disconnected, stale, and rate-limited states are implemented.
- [x] No decorative dead buttons, misleading badges, or fabricated line anchors.
- [x] Keyboard shortcuts (`Ctrl+B` for sidebar, `1` for Summary, `2` for Code) and focus states work.

### GitHub & Synchronization
- [x] GitHub App permissions are reviewed and least-privilege.
- [x] Installation callback state and ownership are validated.
- [x] API pagination, rate limits, and retry behavior are tested.
- [x] Webhook HMAC validation, delivery idempotency, and out-of-order event handling pass.
- [x] GitHub remains the canonical source of truth for all PR, review, commit, and CI check states.

### Quality & Performance
- [x] TypeScript strict mode: 0 errors.
- [x] ESLint: 0 warnings, 0 errors.
- [x] Automated test suite: 100% passing.
- [x] Production build: Successful compilation.
