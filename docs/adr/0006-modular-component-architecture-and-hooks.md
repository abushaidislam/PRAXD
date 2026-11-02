# ADR 0006: Modular Component Architecture and Custom Hooks

## Status
Accepted

## Context
As PRAXD evolved into a high-performance personal PR workspace (Option B), several core components grew in size and responsibility:
- `components/diff-viewer.tsx` grew beyond 1,000 lines, bundling syntax tokenization, horizontal synchronized scroll physics, drag and wheel handlers, line annotations, and both split and unified row renderers into a single file.
- `components/activity-timeline.tsx` bundled timeline history together with a multi-line markdown composer, profile switcher, and markdown toolbar.
- The `components/` directory was entirely flat (21 files), mixing primitive UI components (toast, logo, badges) with domain views (diff, summary, workspace).
- Stateful behaviors (keyboard shortcuts, scroll lockstep, collapsible file states) were embedded directly inside component lifecycles rather than reusable hooks.

## Decision
1. **Subdirectory Component Architecture:**
   Organize `components/` into domain-focused subdirectories:
   - `components/ui/`: Primitive presentation tokens (`brand-logo.tsx`, `copy-icon.tsx`, `toast.tsx`, `demo-mode-badge.tsx`, `diff-split-toggle.tsx`).
   - `components/modals/`: Modals & dialogs (`github-connect-modal.tsx`, `keyboard-shortcuts-modal.tsx`, `merge-modal.tsx`).
   - `components/workspace/`: Core layout & sidebar (`pr-workspace.tsx`, `workspace-header.tsx`, `pull-request-sidebar.tsx`, `pull-request-list-item.tsx`).
   - `components/summary/`: Summary view & timeline (`summary-view.tsx`, `check-run-list.tsx`, `activity-timeline.tsx`, `comment-composer.tsx`).
   - `components/diff/`: Diff engine & navigation (`code-view.tsx`, `diff-viewer.tsx`, `diff-split-row.tsx`, `diff-unified-row.tsx`, `diff-syntax.tsx`, `file-tree-dropdown.tsx`, `checkout-command-dropdown.tsx`).
   - `components/markdown/`: Markdown rendering engine (`markdown-content.tsx`).

2. **Custom Hook Extraction (`hooks/`):**
   Extract pure UI interaction mechanics into reusable custom hooks:
   - `hooks/use-workspace-shortcuts.ts`: Encapsulates global shortcut listeners (`1`, `2`, `Ctrl+B`, `?`).
   - `hooks/use-diff-scroll-sync.ts`: Encapsulates synchronized dual-pane horizontal scrolling, wheel math, keyboard navigation, and draggable scrollbar tracking.
   - `hooks/use-collapsible-files.ts`: Encapsulates multi-file collapsible state, viewed file tracking, and progress metrics.

3. **Full Backward Compatibility:**
   Maintain root-level re-exports in `components/*.tsx` and a central barrel export in `components/index.ts` to ensure 100% backward compatibility with existing tests and imports.

## Consequences
- Single-responsibility components: `diff-viewer.tsx` reduced from 1,033 lines to ~450 lines of clean orchestration.
- Reusable, testable hooks decoupled from JSX rendering.
- Cleaner cognitive model for developers navigating the codebase.
- Zero breaking changes: all 96 Vitest tests, ESLint checks, and TypeScript strict checks continue to pass cleanly.
