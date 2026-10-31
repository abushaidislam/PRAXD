# ADR 0005: Pivot to Distraction-Free Personal PR Management & Direct Write Actions (Option B)

## Status
Accepted

## Context
PRAXD was initially designed with a multi-phase horizon including interactive AI copilot drawers (Phase 5), enterprise multiplayer collaboration / RBAC (Phase 6), automated policy engines (Phase 7), enterprise DORA metrics & SOC2 purging (Phase 8), and multi-tenant KMS cloud infrastructure (Phase 9).

For personal engineering workflows and solo developer use cases, enterprise multi-tenant administration, automated compliance policies, and AI chat drawers introduced unnecessary cognitive overhead, slow iteration loops, and bloated UI real estate.

The primary user requirement is a blisteringly fast, keyboard-first **Personal PR Management & Code Diff Workspace** with high-fidelity GitHub write actions:
1. One-click PR Merge with strategy selection (`Merge`, `Squash`, `Rebase`).
2. In-place PR Title & Description editing directly synchronized via GitHub REST API.
3. Activity timeline conversation commenting with immediate GitHub synchronization.

## Decision
1. **Streamline Codebase:** Reverted to the stable UI/UX ergonomic foundation at commit `348a7ee`, instantly eliminating ~15,000 lines of enterprise/chat overhead while keeping the resizable magnetic sidebar, PR inbox author avatars, synchronized dual-pane diff scrolling, and live GitHub REST API fallbacks.
2. **Implement Core Write Actions:**
   - Added `PUT /api/pull-requests/[pullRequestId]/merge` and `components/merge-modal.tsx` with commit strategy selection and branch targeting.
   - Added `PATCH /api/pull-requests/[pullRequestId]` and in-place title/description editing in `components/summary-view.tsx`.
   - Added `POST /api/pull-requests/[pullRequestId]/comments` and connected timeline comment composer in `components/activity-timeline.tsx`.
3. **Eliminate AI & Enterprise UI Bloat:** Removed AI chat button, AI review panel, and enterprise modals from the workspace view.

## Consequences
- **Positive:** UI load time reduced significantly, first load JS dropped from >240 kB to ~103 kB, zero distraction from AI or enterprise compliance alerts, and full capability to review, edit, comment, and merge pull requests directly from PRAXD.
- **Verification:** 100% of quality checks pass cleanly (`lint` 0 errors, `typecheck` 0 errors, `test` 67/67 passing, `build` 0 errors).
