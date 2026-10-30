# ADR-0002: UI/UX Ergonomics, Collapsible Layout, and Diff Navigation

- **Status:** Accepted
- **Date:** 2026-10-30
- **Relates to:** `docs/UI_UX_SPEC.md`, `docs/PRD.md`, `docs/ROADMAP_ACCEPTANCE.md`

## Context

The primary visual reference for PRAXD is based on the reference screenshots in `reference/`, presenting a dense, dark-themed, dual-pane PR workspace (persistent left PR inbox occupying ~28% and right workspace with Summary/Code views).

During visual and ergonomic review of real developer workflows on standard laptop screens (1280px–1440px) and multi-file PRs, several usability considerations were identified:
1. A fixed 420px sidebar can constrain side-by-side split diffs on screens under 1482px, causing horizontal scrolling.
2. Reviewing PRs with 10+ modified files requires rapid file hopping without endlessly scrolling through giant multi-file diff feeds.
3. Long code lines sometimes read better in unified diff mode than split diff mode.
4. Developers require line-level review commenting affordances directly in the diff gutter, with distinct anchoring for PRAXD AI review findings.
5. Accidental clicks on the prominent header `Merge` button pose a risk unless guarded by safe disabled/read-only states in MVP.

## Decision

We enhance the workspace ergonomics while strictly preserving the visual tokens, dark aesthetics, typography, and geometry of the reference screenshots:

1. **Collapsible PR Inbox:**
   - Default to the reference layout (~420px inbox on desktop).
   - Add a toggle button and shortcut (`Cmd/Ctrl + B`) to collapse the inbox to 0px (or icon rail) to give 100% viewport width to split diffs.
2. **Sticky Multi-File Navigation Dropdown:**
   - Add a compact file selector within the diff breadcrumb bar displaying file name, status badges (added/modified/deleted), and change counters (`+N -M`) for instant navigation.
3. **Split vs. Unified Diff Mode Switcher:**
   - Include an explicit `Split` | `Unified` segmented toggle in the diff toolbar, defaulting to Split on wide viewports (≥1200px) and gracefully allowing manual or responsive fallback to Unified.
4. **Line-Level Comment Gutter Affordance & AI Anchors:**
   - Display a subtle `+` button when hovering over diff line gutters to initiate line-level comments.
   - Anchor PRAXD AI Review findings directly beneath corresponding diff lines with distinct badges and collapse/expand controls.
5. **Merge Action Guardrails:**
   - Keep the `Merge v` button disabled in the read-only MVP, accompanied by an informative tooltip.

## Rationale

These enhancements solve real developer ergonomics without deviating from the reference screenshots' visual hierarchy, dark color scheme, and dense professional aesthetic.

## Consequences

- The application shell must manage sidebar expanded/collapsed state (persisted locally in browser storage).
- The Code view component must support both split and unified layout renderers.
- Multi-file navigation must integrate smoothly with virtualized or paginated file diffs.
