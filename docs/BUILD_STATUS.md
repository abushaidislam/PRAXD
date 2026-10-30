# PRAXD Build Status

**Last updated:** 2026-10-30  
**Current phase:** Phase 0 — Application shell and visual contract complete  
**Build status:** Phase 0 Complete & Verified (Ready for Phase 1)

## Completed

- [x] Product requirements and MVP scope (updated with UX ergonomics & safe merge guardrails)
- [x] Screenshot-derived UI/UX specification (`docs/UI_UX_SPEC.md`)
- [x] System architecture and sequence diagrams (`docs/ARCHITECTURE.md`)
- [x] Architecture Decision Records (`0001-initial-architecture.md`, `0002-ui-ux-ergonomics-and-diff-navigation.md`)
- [x] Database ERD and initial SQL migration draft (`migrations/0001_initial_schema.sql`, `0002_production_integrity.sql`)
- [x] Internal API contract (`docs/API_SPEC.md`)
- [x] GitHub App setup and permission plan (`docs/GITHUB_INTEGRATION.md`)
- [x] AI review pipeline and output contract (`docs/AI_REVIEW_SPEC.md`)
- [x] Security and privacy requirements (`docs/SECURITY_PRIVACY.md`)
- [x] Phased roadmap and acceptance criteria (`docs/ROADMAP_ACCEPTANCE.md`)
- [x] Next.js App Router scaffolded with strict TypeScript, Tailwind CSS, Lucide icons
- [x] Screenshot-matched dual-pane PR workspace:
  - Persistent left PR inbox (~420px, All/Reviewing/Authored tabs, search, filter, group selector, compact PR items, collapsible sidebar via toggle & `Cmd/Ctrl+B`)
  - Main workspace header (PR title, breadcrumb, Summary/Code toggle, GitHub link, disabled Chat affordance, guarded disabled Merge button)
  - Summary view (exact reproduction of screenshots: title with shield icon, author metadata, branch comparison, requested reviewers, comments, checks, collapsible description with styled vulnerability breakdown, checks list, activity timeline, leave comment input)
  - Code view (breadcrumb toolbar with branch flow, sticky multi-file selector dropdown, split vs unified diff toggle, file header, unmodified lines folding, side-by-side split diff with independent line numbers and syntax highlighting, gutter comment hover `+` affordance, inline comment threads, PRAXD AI review finding callout anchor, fallback for binary/missing patch files)
  - Demo mode notice badge explicitly marking local fixture mode

## Quality Checks & Verification

- `typecheck` (`npm run typecheck`): Passed (0 errors).
- `test` (`npm run test`): Passed 9/9 acceptance tests in `tests/phase0-workspace.test.tsx`:
  - `P0-01`: Loads workspace with fixtures and displays local demo mode notice without external secrets.
  - `P0-02`: Switches tabs between All, Reviewing, and Authored according to defined rules.
  - `P0-03`: Searches PRs by number, title, author, branch; clearing restores list.
  - `P0-04`: Selecting different PR updates header, Summary, and Code views without full-page reload.
  - `P0-05`: Switches between Summary and Code views reliably and preserves selected PR.
  - `P0-06`: Displays explicit 'Diff unavailable' message for binary files / files without patch.
  - `P0-07`: Guards Merge button safely in read-only MVP mode.
  - `P0-08`: Switches between Split and Unified diff modes cleanly.
  - `P0-09`: Collapses and expands left PR inbox with toggle button and shortcut.
- `lint` (`npm run lint`): Passed (0 errors, 0 warnings).
- `build` (`npm run build`): Production build compiled successfully (`/` static page generated).

## Not yet implemented (Phase 1+)

- [ ] Supabase project connection & migration application
- [ ] GitHub App registration & OAuth callback flow
- [ ] Server-side GitHub App installation token generation
- [ ] Repository & Pull Request live synchronization
- [ ] Live diff & comment fetch from GitHub API
- [ ] Webhook receiver & signature verification
- [ ] AI review provider pipeline (Phase 2)

## Next Task

Begin **Phase 1 — MVP PR Inbox & Summary/Code Split View with Live GitHub Integration**:
1. Implement Supabase client and Auth wrappers.
2. Implement GitHub App OAuth callback handler with single-use `state` verification.
3. Implement GitHub API adapter (installation tokens, repository discovery, PR sync).
