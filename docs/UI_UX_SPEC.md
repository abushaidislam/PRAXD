# UI/UX Specification — PRAXD PR Workspace

**Status:** Source-of-truth visual specification  
**Reference screenshots:**

- `../reference/praxd-reference-pr-summary.png` — PR Summary state
- `../reference/praxd-reference-code-diff.png` — Code / split-diff state

## 1. Design objective

Recreate the structure and working feel of the supplied references as closely as practical, branded as PRAXD. The target is a dense, professional developer workspace: dark, quiet, information-rich, restrained and fast. Do not turn it into a generic analytics dashboard.

The screenshots are the primary visual authority. Reproduce layout proportions, hierarchy, spacing rhythm, selected states, compact typography, subtle separators, and the behavior of switching between Summary and Code. Use original PRAXD branding and Lucide icons; do not use GitHub/Codex logos as PRAXD product branding.

## 2. Main application shell

### Desktop target

Reference image dimensions: approximately **1482 × 819 px**.

- Left PR inbox: approximately **420 px** wide (about 28.3% of the reference width).
- Right workspace: fills remaining width (about 1062 px).
- Full viewport height; each pane scrolls independently where needed.
- Thin vertical separator between panes.
- Main workspace header stays at the top while the content pane scrolls.
- Avoid an additional global navigation column in the MVP; the reference's PR inbox is the primary navigation.
- **Collapsible Sidebar Affordance:** Provide a toggle control (icon button and `Cmd/Ctrl + B` shortcut) to collapse the 420px PR inbox into a slim rail or hide it completely. This allows full-viewport focus for side-by-side diffs on standard 13"–15" laptops (~1280px–1440px) without cramped columns.

Use a responsive left-pane width around `minmax(360px, 28.3vw)` with a desktop cap near 440px. At narrower widths, collapse the PR list into a drawer or a dedicated list route; do not squeeze the diff until it is unreadable.

## 3. Left PR inbox

Top region:

- Compact segmented tabs: **All**, **Reviewing**, **Authored**.
- Search field with search icon and placeholder `Search pull requests`.
- Adjacent filter button with a visible active state when filters are applied.
- Group selector (reference displays `Authored`) with dropdown affordance.

List:

- Compact vertical PR rows with subtle separators/spacing.
- Each row includes a PR/status icon, optional draft/CI/review indicator, truncated PR title, relative timestamp, owner/repository and branch context, additions/deletions.
- Selected row uses a subtle elevated/darker surface, not a large colorful card.
- State indicators use restrained colors: green for successful/approved, amber for pending/warning, red for failed/changes requested, muted gray for unknown.
- Keep list title text single-line with ellipsis. Metadata is smaller and lower contrast.
- Show count or loading skeleton where useful.
- Search, tabs, filters and selection must actually work.

Suggested item information hierarchy:

1. PR icon + title + age.
2. Owner/repository + source branch.
3. `+N -M` diff summary and compact status markers.

## 4. Main workspace header

A slim top bar spans only the right pane.

- Left: PR status icon and truncated PR title.
- Center/right: **Summary** and **Code** segmented tabs.
- Right actions: external GitHub link, **Chat** affordance (can be disabled until AI chat is implemented), contextual action menu and merge state/action.
- **Safe Merge Action Guardrails:** Do not make merge a functional one-click write action in the MVP. For visual parity with the reference screenshot:
  - If displayed, the white `Merge v` pill button defaults to disabled or read-only mode with an explanatory tooltip: `Merge is disabled in read-only MVP mode; please merge via GitHub.`
  - When enabled in future releases with write permissions, clicking `Merge v` opens a confirmation modal detailing the merge method (Create merge commit / Squash / Rebase), branch protections, and CI check status before any mutation occurs.
- Header height should be compact (roughly 48–56 px at desktop).

Clicking Summary/Code switches content without changing the selected PR. Browser back/forward or URL query/segment should preserve workspace state.

## 5. Summary view

Use the second reference screenshot as the direct layout guide.

Content is centered within the main pane with a readable maximum width (roughly 760–820 px at reference size), leaving comfortable side margins.

Order:

1. Large PR title, wrapped to a maximum of about two lines.
2. Author avatar, username and relative age.
3. Metadata rows:
   - Branch: `head-branch → base-branch`, with additions/deletions.
   - Reviewers: requested reviewers or `Request` action if supported by permission.
   - Comments: conversation/review comment count.
   - Checks: overall status, clickable to details.
   - Status: open/draft/merged/closed and review readiness.
4. **Description** section with collapse/expand affordance and safe Markdown rendering.
5. PR body content including lists, code spans and links.
6. Timeline/commit activity (when available).
7. **Checks** section with expandable check rows, name and result.
8. Review/conversation activity and comments, grouped clearly.

Keep a consistent vertical rhythm and horizontal divider between major sections. Avoid dashboard-style metric cards. The PR title and content are the visual focus.

## 6. Code view

Use the first reference screenshot.

- Keep the left PR inbox visible at desktop widths (with a quick collapse toggle button).
- **Multi-File Navigation & Sticky File Picker:**
  - In PRs touching multiple files, add a compact file selector dropdown inside the top breadcrumb bar showing: filename, status badge (modified, added, deleted, renamed), and `+additions -deletions`.
  - Provide an optional keyboard-navigable slide-out file list/tree when reviewing PRs with >5 files.
- Show file header with language/file name and `+additions -deletions`.
- **Split vs. Unified Diff Mode Switcher:**
  - Provide an explicit segmented toggle (`Split` | `Unified`) on the right side of the file breadcrumb toolbar.
  - Defaults to split (side-by-side) on wide screens (≥1200px) and smoothly transitions to unified diff when space is constrained or on user preference.
- Split view shows old lines on the left and new lines on the right, with independent line numbers and syntax highlighting.
- Deleted lines use a muted red background; added lines use a muted green background; context lines remain neutral.
- Show collapsed unchanged-line regions with an expand action.
- **Line-Level Commenting & Diff Gutter Affordances:**
  - Hovering on any diff line number gutter displays a subtle `+` affordance to initiate an inline review comment.
  - Inline comments and threads appear directly attached beneath the relevant diff line, with clear collapse/expand controls.
- Changed-file navigation is available without making a third permanent narrow column; use an expandable file tree/panel or a compact file selector.
- Horizontal scrolling belongs inside the diff region. Preserve line number gutters.
- For files without patch text, show a clear message such as `Diff unavailable for this file` with a link to GitHub.
- Do not truncate code silently. If PRAXD intentionally caps loaded lines/context, disclose it.

## 7. Comments and review details

- Conversation comments are not the same as line-level review comments; label them separately.
- Each comment shows avatar, author, relative time, body and source.
- Review state badges: Approved, Changes requested, Commented, Pending/Dismissed where relevant.
- Inline review comments show file and line context and offer a `View in diff` navigation action.
- Resolved state must come from authoritative data; do not invent it when the REST response lacks thread resolution information.
- **AI Findings Anchoring in Diff:**
  - AI findings that reference specific lines are anchored directly in the diff with a dedicated **PRAXD AI Review** card badge and severity tag (Critical, Warning, Suggestion).
  - AI findings must never masquerade as human/GitHub-authored review comments.
  - Users can collapse AI finding callouts in the diff to keep code view clean.

## 8. AI review panel (MVP)

- Entry point: `Run AI Review` button on Summary and/or Code view.
- States: Not run, Queued, Running, Completed, Failed, Stale.
- While running: show progress stages only when backed by actual job states; do not invent percentage completion.
- Result header: current head SHA short hash, timestamp, model/review version and status.
- Summary: concise explanation of areas reviewed and important caveats.
- Findings list: severity, title, file/line, confidence, why it matters and suggested fix.
- Each finding deep-links to the relevant diff line when valid.
- Empty result must clearly say no actionable findings were returned; do not claim the PR is safe.

## 9. Chat affordance

The reference shows a Chat control. It may be included in the top bar as a placeholder in MVP, but it must either:

- open an implemented repository/PR-scoped assistant, or
- be visibly disabled with a tooltip such as `Coming in a later release`.

Never make it appear functional if no chat backend exists.

## 10. Visual tokens

Start with these tokens and tune against the supplied images. These are implementation starting points, not measurements extracted from the original software.

```css
:root {
  color-scheme: dark;
  --praxd-bg: #111111;
  --praxd-sidebar: #171717;
  --praxd-panel: #1b1b1b;
  --praxd-panel-hover: #222222;
  --praxd-border: #303030;
  --praxd-border-soft: #262626;
  --praxd-text: #f2f2f2;
  --praxd-text-secondary: #a3a3a3;
  --praxd-text-muted: #737373;
  --praxd-green: #2fbf71;
  --praxd-red: #f05252;
  --praxd-amber: #d6a344;
  --praxd-blue: #5a9cff;
  --praxd-radius-sm: 6px;
  --praxd-radius-md: 9px;
  --praxd-radius-lg: 12px;
  --praxd-font-ui: Inter, Geist, ui-sans-serif, system-ui, sans-serif;
  --praxd-font-code: "Geist Mono", ui-monospace, SFMono-Regular, monospace;
}
```

Typography:

- UI: Inter or Geist Sans; choose one font family and use it consistently.
- Code: Geist Mono or a platform monospace fallback.
- Dense metadata: 11–13 px.
- Main body: 13–14 px.
- PR title: 22–26 px depending on available width.
- Use font weight and contrast for hierarchy, not excessive font sizes.

Icons:

- Lucide, 16–18 px in dense controls, consistent 1.75–2 px stroke.
- Avoid emoji as core UI icons.

Motion:

- 120–180 ms for hover/tab/panel transitions.
- Avoid bouncy, spring-heavy or distracting animations.
- Respect `prefers-reduced-motion`.

## 11. Responsive behavior

- `>= 1200px`: full two-pane workspace; left list about 360–440px.
- `768–1199px`: narrower inbox; allow collapse; diff defaults to unified if split panes become too narrow.
- `< 768px`: list and detail become separate navigable views; provide a back-to-PR-list control; code diff defaults to unified mode; controls remain touch accessible.
- Keep sticky headers from overlapping scrollable content.

## 12. Accessibility and interaction states

- All tabs, rows, buttons, filters and menus keyboard-operable.
- Selected PR indicated by both color and semantic state.
- Color never carries status information alone; include text/icon labels.
- Visible focus ring; sufficient text contrast.
- Use tooltips for icon-only buttons.
- Skeleton states should preserve layout dimensions.
- Empty state, permission denied, rate limited, stale cache, GitHub unavailable, diff unavailable and disconnected integration states must be designed.

## 13. UI acceptance checklist

- [ ] At 1482×819, left list and right pane proportions closely match the reference.
- [ ] Left PR inbox can be toggled/collapsed for extra code diff real estate.
- [ ] All/Reviewing/Authored tabs change the PR set.
- [ ] Search and filters work.
- [ ] Selecting a PR updates main content and selected row.
- [ ] Summary and Code tabs switch correctly.
- [ ] Summary hierarchy and sections resemble the second reference.
- [ ] Code view resembles the first reference, including split diff, line gutters and add/delete fills.
- [ ] Quick file switcher allows hopping across multi-file PR changes without losing context.
- [ ] Split vs Unified diff switcher toggles diff presentation cleanly.
- [ ] Gutter hover shows `+` affordance for line comments, and inline threads render at the correct line.
- [ ] Merge button has explicit disabled/safety state with tooltip in MVP.
- [ ] Horizontal scrolling stays inside the diff area.
- [ ] Responsive layout is usable at tablet/mobile widths.
- [ ] No decorative button is inert or falsely promises an unavailable action.
