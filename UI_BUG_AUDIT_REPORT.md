# UI Bug Audit Report — PRAXD PR Workspace

## 1. Executive Summary

- **Project Name:** PRAXD — AI-Powered GitHub Pull Request Workspace
- **Framework and Tech Stack:** Next.js 15.5.28 (App Router), React 19.3.1, TypeScript 5.9.3, Tailwind CSS 3.4.19, Lucide React 0.468.0, Vitest 2.1.9, Playwright.
- **Total Routes Inspected:** 1 primary application route (`/`) hosting the PR Workspace shell, along with 22 supporting API routes and mock fixture states.
- **Total Components & Workflows Inspected:** 18 client and shared UI components, including PR Inbox Sidebar, Workspace Header, Summary View, Code View, Diff Viewer, Activity Timeline, Check Run List, Merge Modal, Keyboard Shortcuts Modal, GitHub Connect Modal, and Toast notifications.
- **Testing Environment:** Headless Chromium via Playwright, Next.js local development server (`http://localhost:3000`), Node.js v22.22.1 on Linux (x86_64).
- **Viewport Sizes Tested:**
  - Mobile: 320 × 568 (iPhone SE / compact), 375 × 812 (iPhone X/11/Mini), 390 × 844 (iPhone 12/13/14), 430 × 932 (iPhone Pro Max)
  - Tablet: 768 × 1024 (iPad / medium tablet)
  - Laptop: 1024 × 768 (legacy small desktop / iPad landscape)
  - Desktop: 1366 × 768 (standard laptop display)
  - Desktop: 1440 × 900 (MacBook Pro standard)
  - Large Desktop: 1920 × 1080 (Full HD monitor)
- **Total Discovered Issues:** 12 distinct issues.
- **Severity Breakdown:**
  - **P0 — Critical:** 0
  - **P1 — High:** 2
  - **P2 — Medium:** 4
  - **P3 — Low:** 4
  - **P4 — Informational:** 2
- **Overall UI Quality Assessment:**
  PRAXD features an exceptionally well-engineered, dense, dark-mode design system with responsive typefaces and rich keyboard navigation. However, critical responsive layout defects exist at mobile and tablet viewports where the left sidebar and main content attempt simultaneous flex rendering without an adaptive stacked view or overlay drawer. Furthermore, the Workspace Header exhibits visual collision between the center tab switcher and left/right action bars at narrower screen widths, and several decorative/placeholder interactive controls lack functional handlers or accessible attributes.

---

## 2. Bug Summary Table

| ID | Bug Title | Category | Severity | Affected Route | Status |
|---|---|---|---|---|---|
| BUG-001 | Workspace Header View Switcher Overlaps PR Title and Action Controls on Narrow Screens | Layout / Responsive | P1 | `/` (Header) | Confirmed |
| BUG-002 | Mobile Dual-Pane Flex Collision Without Responsive Drawer / Stack Transition | Responsive / Layout | P1 | `/` (Shell) | Confirmed |
| BUG-003 | DiffViewer Split Mode Forces Content Squishing and Card Cropping on Tablet Viewports | Responsive / Layout | P2 | `/` (Code View) | Confirmed |
| BUG-004 | Dead Filter and Grouping Controls in Left PR Inbox | Interaction | P2 | `/` (Sidebar) | Confirmed |
| BUG-005 | Merge Modal Form Fields Lack Accessible Labels (`<label for>` / `aria-label`) | Accessibility | P2 | `/` (Merge Modal) | Confirmed |
| BUG-006 | Reviewer Request Button "+ Request" Lacks Action Handler or Feedback State | Interaction | P2 | `/` (Summary View) | Confirmed |
| BUG-007 | Unconstrained Resizable Sidebar Can Squeeze Main Workspace Beyond Usability Limits | Interaction / Layout | P3 | `/` (Sidebar) | Confirmed |
| BUG-008 | Line Wrap Indicator Button Lacks `aria-pressed` Semantic State | Accessibility | P3 | `/` (Code View) | Confirmed |
| BUG-009 | Non-Interactive AI Review "Warning" Chip Rendered Without Sufficient Contrast or Semantics | Visual / A11y | P3 | `/` (AI Review Card) | Confirmed |
| BUG-010 | Missing Light Theme Implementation Despite Configured CSS Color Scheme Class | Theme / Styling | P3 | `/` (Global) | Confirmed |
| BUG-011 | DiffViewer Unmodified Context Expansion Lacks Accessible State Indication | Accessibility | P4 | `/` (Diff Viewer) | Confirmed |
| BUG-012 | Hardcoded External Repository URL Schema Bypasses Custom GitHub Enterprise Instances | UX / Navigation | P4 | `/` (Header) | Confirmed |

---

## 3. Detailed Bug Reports

### BUG-001: Workspace Header View Switcher Overlaps PR Title and Action Controls on Narrow Screens

**Severity:** P1
**Category:** Layout / Responsive
**Affected Route:** `/`
**Affected Component:** `WorkspaceHeader` (`components/workspace-header.tsx`)
**Viewport:** Mobile (320px–430px) and Tablet/Small Laptop (768px–1024px)

**Description:**
The segmented view switcher containing "Summary" and "Code" buttons is positioned using `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20`. On screen widths below 1100px or when the sidebar is expanded on tablets, the header title on the left and action buttons on the right physically overlap and collide with the centered view switcher. At 768px width, the PR title `#17 Sentinel: [MEDIUM]...` and the `Checkout Command` button collide directly with the tab buttons, obscuring text and intercepting pointer clicks.

**Steps to Reproduce:**
1. Open the application at `http://localhost:3000`.
2. Resize the browser viewport to 768px × 1024px (Tablet) or 1024px × 768px (Laptop).
3. Ensure the left PR inbox sidebar is expanded (default state).
4. Observe the top 48px workspace header bar.
5. Notice the centered "Summary / Code" toggle buttons colliding directly into the PR title and the right actions.

**Expected Behavior:**
The header should use a responsive flex or grid layout that hides secondary actions, truncates the title progressively, or stacks/relocates the segmented view switcher without absolute coordinate overlap.

**Actual Behavior:**
The absolute-positioned switcher renders directly on top of the left and right header flex containers, causing text collision and unclickable controls.

**Root Cause:**
In `components/workspace-header.tsx`, line 78:
```tsx
<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto">
```
Absolute centering without minimum spacing bounds or hiding on smaller viewports causes direct geometric collision.

**Relevant Files:**
- `components/workspace-header.tsx`: lines 77–125

**Evidence:**
Captured screenshot at `/tmp/praxd_audit/responsive/tablet_768x1024_code.png` and Playwright bounding box collision measurements showing `title_right` exceeding `switcher_left`.

**Recommended Fix:**
On viewports `< 1024px`, place the view switcher inline within the flex flow, hide the terminal checkout button earlier (e.g. `hidden lg:block`), and reduce padding or convert the switcher into an icon-only or dropdown control.

**Confidence:** Confirmed.

---

### BUG-002: Mobile Dual-Pane Flex Collision Without Responsive Drawer / Stack Transition

**Severity:** P1
**Category:** Responsive / Layout
**Affected Route:** `/`
**Affected Component:** `PRWorkspace` (`components/pr-workspace.tsx`), `PullRequestSidebar` (`components/pull-request-sidebar.tsx`)
**Viewport:** Mobile (320 × 568, 375 × 812, 390 × 844, 430 × 932)

**Description:**
According to `docs/UI_UX_SPEC.md` Section 8, viewports `< 768px` must provide a "Stacked view; navigation between PR list and PR detail; diff switches to unified view." In reality, `pr-workspace.tsx` renders `<PullRequestSidebar>` and `<main>` inside a single flex row (`flex-1 flex min-h-0 overflow-hidden relative`). On mobile viewports, the sidebar takes `w-full`, pushing the `<main>` workspace completely offscreen to a width of `0px` with horizontal clipping. When the sidebar is collapsed, `<main>` fills the screen, but there is no navigation button to re-open the sidebar because the header expand button is squeezed or hidden.

**Steps to Reproduce:**
1. Open the application on a mobile viewport (e.g., 375 × 812).
2. The initial view renders only the PR list sidebar.
3. Select any pull request item in the list.
4. Notice that selecting a PR does not transition or navigate to the PR workspace detail. The user remains stuck on the sidebar view unless they manually click the small collapse icon (`PanelLeftClose`).
5. After collapsing, the workspace header has no accessible back/list button to return to the inbox.

**Expected Behavior:**
On mobile viewports, selecting a PR from the inbox should automatically collapse the sidebar (or navigate to the workspace pane), and a dedicated back button ("< PRs") should appear in the header to return to the list.

**Actual Behavior:**
The desktop dual-pane structure remains active in DOM, resulting in zero-width main viewports and requiring unintuitive manual toggles to see PR contents.

**Root Cause:**
In `components/pr-workspace.tsx`:
```tsx
<div className="flex-1 flex min-h-0 overflow-hidden relative">
  <PullRequestSidebar ... />
  <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-praxd-bg" ...>
```
There is no mobile route state or condition to switch between "inbox mode" and "detail mode" upon selecting a pull request.

**Relevant Files:**
- `components/pr-workspace.tsx`: lines 162–225
- `components/pull-request-sidebar.tsx`: lines 170–178

**Evidence:**
Playwright responsive audit logs showing `mainClientWidth: 0` when sidebar is open at 320px–430px.

**Recommended Fix:**
Introduce mobile navigation state (e.g., `mobileView: 'list' | 'detail'`). When a user taps a PR row on screen width `< 768px`, set `isSidebarOpen = false` to navigate to the PR detail, and display a prominent back button in `WorkspaceHeader`.

**Confidence:** Confirmed.

---

### BUG-003: DiffViewer Split Mode Forces Content Squishing and Card Cropping on Tablet Viewports

**Severity:** P2
**Category:** Responsive / Layout
**Affected Route:** `/` (Code View)
**Affected Component:** `DiffViewer` (`components/diff-viewer.tsx`), `CodeView` (`components/code-view.tsx`)
**Viewport:** 768 × 1024 (Tablet) and 1024 × 768 (Laptop)

**Description:**
When viewing code diffs on tablet viewports (768px) with the sidebar open (~420px), the remaining main workspace width is only ~348px. In `diff-viewer.tsx`, the side-by-side split diff mode forces both "Base (OLD)" and "Head (NEW)" columns along with inline AI Review cards into this narrow width. The AI Review card (`ai-review-card.tsx`) suffers from severe vertical text wrapping (each word on a single line) and horizontal text clipping. Furthermore, `docs/UI_UX_SPEC.md` Section 8 explicitly specifies: "768px – 1199px (Tablet/Laptop): Narrower inbox or collapsed sidebar; diff defaults to split with unified fallback. < 768px (Mobile): diff switches to unified view." Currently, the diff viewer remains forced into `split` mode by default across all viewports.

**Steps to Reproduce:**
1. Set viewport to 768 × 1024.
2. Select PR #17 (Sentinel: Fix DOM XSS vulnerability).
3. Switch to `Code` view (`2`).
4. Inspect the right-hand split diff pane and AI review cards.
5. Notice the AI Review card text is severely squashed and illegible.

**Expected Behavior:**
On screen widths below 1024px (or whenever main pane width is `< 600px`), the diff viewer should automatically default to `unified` mode or collapse the sidebar to preserve diff readability.

**Actual Behavior:**
Split diff mode remains active on narrow viewports, squishing dual code columns and inline review cards into illegible vertical text strips.

**Root Cause:**
In `components/code-view.tsx`, line 34:
```tsx
const [diffMode, setDiffMode] = useState<"split" | "unified">("split");
```
No viewport media query or container query updates `diffMode` to `"unified"` on smaller screens.

**Relevant Files:**
- `components/code-view.tsx`: lines 34–35, 270–320
- `components/diff-viewer.tsx`: lines 160–180
- `components/ai-review-card.tsx`: lines 60–120

**Evidence:**
Captured screenshot at `/tmp/praxd_audit/responsive/tablet_768x1024_code.png` displaying squished inline card text `V\ne\nr\ni\nf\ny`.

**Recommended Fix:**
Add a responsive check on mount or container resize; if `window.innerWidth < 1024`, default `diffMode` to `"unified"`.

**Confidence:** Confirmed.

---

### BUG-004: Dead Filter and Grouping Controls in Left PR Inbox

**Severity:** P2
**Category:** Interaction
**Affected Route:** `/` (Sidebar)
**Affected Component:** `PullRequestSidebar` (`components/pull-request-sidebar.tsx`)
**Viewport:** All Viewports

**Description:**
In the Left PR Inbox sidebar header, two prominent UI controls are rendered:
1. The **Filter button** with icon `<Filter className="w-3.5 h-3.5" />` (line 270).
2. The **Grouping dropdown button** showing `"Authored ⌵"` with icon `<ChevronDown className="w-3 h-3" />` and attribute `aria-haspopup="listbox"` (line 280).
Clicking either of these controls does absolutely nothing: no popup appears, no dropdown opens, no filter menu is triggered, and no state change occurs. This violates Core Principle 10: "Make all UI controls functional or clearly disabled with an explanation."

**Steps to Reproduce:**
1. Open the PR workspace at any resolution.
2. In the left sidebar, click the `Filter` icon button next to the search input.
3. Notice no filter dialog, popover, or dropdown opens.
4. Click the `Authored ⌵` button located below the search bar.
5. Notice no dropdown menu opens to select groups (e.g. Repository, Author, Milestone, State).

**Expected Behavior:**
- Clicking the filter button should open a menu allowing filtering by state (`Open`, `Merged`, `Closed`) or author.
- Clicking `Authored ⌵` should open a menu allowing switching grouping between `Authored`, `Repository`, `Status`, etc.

**Actual Behavior:**
Both buttons are dead clickable elements with zero click event handlers or popover states.

**Root Cause:**
In `components/pull-request-sidebar.tsx`:
- Line 266: The `<button>` for `<Filter>` lacks an `onClick` handler.
- Line 282: The `<button>` displaying `{selectedGroup}` has `aria-haspopup="listbox"` but no `onClick` handler and no associated menu state.

**Relevant Files:**
- `components/pull-request-sidebar.tsx`: lines 265–292

**Evidence:**
Inspected source code and automated interaction test script (`/home/jules/self_created_tools/interactive_audit.py`) confirmed 0 popups or menus opened upon clicking.

**Recommended Fix:**
Implement the filter dropdown menu (or filter popover) for PR state selection and the group selection popover, or remove the chevron affordance until the feature is active.

**Confidence:** Confirmed.

---

### BUG-005: Merge Modal Form Fields Lack Accessible Labels (`<label for>` / `aria-label`)

**Severity:** P2
**Category:** Accessibility / Forms
**Affected Route:** `/` (Merge Modal)
**Affected Component:** `MergeModal` (`components/merge-modal.tsx`)
**Viewport:** All Viewports

**Description:**
In the Merge Confirmation Modal, the text inputs for "Commit Title" and "Commit Message" are rendered with generic visual text labels above them (`<label className="text-[11.5px] font-medium text-praxd-text-muted block mb-1">Commit Title</label>`), but they lack `htmlFor` associations or `id` attributes on the corresponding `<input>` and `<textarea>` elements. Screen readers cannot announce the accessible name for these fields, violating WCAG 2.2 AA (Criterion 1.3.1 Info and Relationships, Criterion 4.1.2 Name, Role, Value).

**Steps to Reproduce:**
1. Click the `Merge` split button in the workspace header.
2. Inspect the "Commit Title" `<input>` and "Commit Message" `<textarea>` with browser accessibility developer tools.
3. Observe that neither input has an accessible name or programmatic label association.

**Expected Behavior:**
`<label htmlFor="commit-title">Commit Title</label>` should be paired with `<input id="commit-title" name="commitTitle" />`. Similarly, `<label htmlFor="commit-message">Commit Message</label>` should be paired with `<textarea id="commit-message" name="commitMessage" />`.

**Actual Behavior:**
`<label>` has no `htmlFor`, `<input>` and `<textarea>` have no `id` or `aria-label`.

**Root Cause:**
In `components/merge-modal.tsx`, lines 212–231:
```tsx
<label className="text-[11.5px] font-medium text-praxd-text-muted block mb-1">
  Commit Title
</label>
<input
  type="text"
  value={commitTitle}
  onChange={(e) => setCommitTitle(e.target.value)}
  className="..."
/>
```

**Relevant Files:**
- `components/merge-modal.tsx`: lines 212–231

**Evidence:**
Playwright accessibility audit evaluating `hasForLabel` returned `False` for both inputs in the dialog.

**Recommended Fix:**
Add `id="commit-title"` and `id="commit-message"` with corresponding `htmlFor="commit-title"` and `htmlFor="commit-message"`.

**Confidence:** Confirmed.

---

### BUG-006: Reviewer Request Button "+ Request" Lacks Action Handler or Feedback State

**Severity:** P2
**Category:** Interaction
**Affected Route:** `/` (Summary View)
**Affected Component:** `SummaryView` (`components/summary-view.tsx`)
**Viewport:** All Viewports

**Description:**
In the Summary View metadata grid under the Reviewers row, a button is rendered displaying `+ Request` (`<button type="button" className="..."><span>+ Request</span></button>`). Clicking this button does nothing: it lacks an `onClick` handler, does not open a user picker or reviewer request modal, and provides no user feedback.

**Steps to Reproduce:**
1. Open the Summary view of any PR.
2. In the metadata grid under "Reviewers", locate the `+ Request` button next to the reviewer list.
3. Click the button.
4. Observe that no action occurs.

**Expected Behavior:**
Clicking `+ Request` should either trigger a reviewer selection dialog/dropdown or display a tooltip/disabled state explaining that reviewer assignment requires live GitHub App installation.

**Actual Behavior:**
The button is rendered as a clickable interactive element with hover states but has no `onClick` handler.

**Root Cause:**
In `components/summary-view.tsx`, lines 291–296:
```tsx
<button
  type="button"
  className="text-praxd-text-secondary hover:text-praxd-text hover:underline text-[12px] flex items-center gap-1"
>
  <span>+ Request</span>
</button>
```

**Relevant Files:**
- `components/summary-view.tsx`: lines 291–296

**Evidence:**
Inspected source code and automated interaction script verified 0 click handlers.

**Recommended Fix:**
Add an `onClick` handler that opens a reviewer assignment popover, or disable the button with an informative tooltip if the current workspace is in demo mode.

**Confidence:** Confirmed.

---

### BUG-007: Unconstrained Resizable Sidebar Can Squeeze Main Workspace Beyond Usability Limits

**Severity:** P3
**Category:** Interaction / Layout
**Affected Route:** `/`
**Affected Component:** `PullRequestSidebar` (`components/pull-request-sidebar.tsx`)
**Viewport:** Laptop / Desktop (1024px–1366px)

**Description:**
The left sidebar resizer handle allows dragging up to `MAX_SIDEBAR_WIDTH = 720px` or `Math.floor(window.innerWidth * 0.6)`. On a 1024px wide viewport, dragging the sidebar to 614px (60%) leaves only 410px for the entire main workspace. In Code view, this collapses the diff viewer to an unusable state while the user is dragging. Furthermore, double-clicking the resizer handle resets to `DEFAULT_SIDEBAR_WIDTH = 420px`, but keyboard resizing via `ArrowLeft` / `ArrowRight` steps by only 12px without announcements.

**Steps to Reproduce:**
1. Open the application at 1024px × 768px.
2. Drag the resizer handle to the right up to its maximum boundary.
3. Observe the main workspace becoming excessively narrow and diff controls getting clipped.

**Expected Behavior:**
The maximum draggable width should take into account a minimum main pane width (e.g., minimum 640px for main workspace).

**Actual Behavior:**
The sidebar can expand up to 60% of viewport width regardless of main pane usability.

**Root Cause:**
In `components/pull-request-sidebar.tsx`, line 70:
```tsx
const maxWidthBound = Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.6));
```
60% is too large when `window.innerWidth` is near 1024px.

**Relevant Files:**
- `components/pull-request-sidebar.tsx`: lines 69–75

**Evidence:**
Source calculation verification: at 1024px, main pane width drops to 409px.

**Recommended Fix:**
Calculate `maxWidthBound` as `Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - 600)`.

**Confidence:** Confirmed.

---

### BUG-008: Line Wrap Indicator Button Lacks `aria-pressed` Semantic State

**Severity:** P3
**Category:** Accessibility
**Affected Route:** `/` (Code View)
**Affected Component:** `CodeView` (`components/code-view.tsx`)
**Viewport:** All Viewports

**Description:**
In the Code View toolbar, the "Wrap" toggle button allows users to toggle line wrapping between enabled and disabled. While visual styling toggles between active and inactive states, the button does not expose the `aria-pressed` attribute. Screen reader users cannot determine whether line wrapping is currently turned on or off.

**Steps to Reproduce:**
1. Open Code view.
2. Inspect the "Wrap" button (`<button aria-label="Toggle line wrapping">`).
3. Click the button to toggle wrapping.
4. Inspect the DOM attributes; notice `aria-pressed` is absent in both on and off states.

**Expected Behavior:**
Toggle buttons must announce their active state with `aria-pressed={wrapLines}`.

**Actual Behavior:**
`aria-pressed` attribute is missing.

**Root Cause:**
In `components/code-view.tsx`, lines 282–295:
```tsx
<button
  type="button"
  onClick={() => setWrapLines(!wrapLines)}
  className={cn(...)}
  title={wrapLines ? "Disable line wrapping" : "Wrap long lines"}
  aria-label="Toggle line wrapping"
>
```

**Relevant Files:**
- `components/code-view.tsx`: lines 282–295

**Evidence:**
Direct source code inspection and DOM inspection via Playwright.

**Recommended Fix:**
Add `aria-pressed={wrapLines}` to the button.

**Confidence:** Confirmed.

---

### BUG-009: Non-Interactive AI Review "Warning" Chip Rendered Without Sufficient Contrast or Semantics

**Severity:** P3
**Category:** Visual / Accessibility
**Affected Route:** `/` (Code View inline diff)
**Affected Component:** `AIReviewCard` (`components/ai-review-card.tsx`)
**Viewport:** All Viewports

**Description:**
Within the inline AI review cards (`AIReviewCard`), severity badges such as `WARNING` are rendered using `bg-yellow-950/40 text-amber-300 border-yellow-700/50`. In certain browser rendering contexts and against dark backgrounds, the thin text color `amber-300` against `yellow-950/40` fails the 4.5:1 WCAG contrast requirement for small font sizes (10px). Additionally, the card header contains a non-interactive badge that looks like a button but does not support keyboard focus or tooltip explanations.

**Steps to Reproduce:**
1. Open PR #17 in Code View.
2. Locate the inline "PRAXD AI Review" card anchored below line 1644.
3. Inspect the `WARNING` badge in the top right corner.

**Expected Behavior:**
Badge text contrast should exceed 4.5:1 against its background, and the severity indicator should include appropriate `aria-label` or accessible role.

**Actual Behavior:**
Text size is 10px font with marginal color contrast and no accessible role descriptor.

**Root Cause:**
In `components/ai-review-card.tsx`, badge styling uses low-opacity backgrounds with muted amber text.

**Relevant Files:**
- `components/ai-review-card.tsx`: lines 55–85

**Evidence:**
Visual inspection from screenshot `/tmp/praxd_audit/responsive/tablet_768x1024_code.png`.

**Recommended Fix:**
Increase text weight and brightness (e.g. `text-amber-200 bg-amber-950/80 border-amber-600/60`).

**Confidence:** Confirmed.

---

### BUG-010: Missing Light Theme Implementation Despite Configured CSS Color Scheme Class

**Severity:** P3
**Category:** Theme / Styling
**Affected Route:** `/`
**Affected Component:** `RootLayout` (`app/layout.tsx`), `globals.css`
**Viewport:** All Viewports

**Description:**
In `app/layout.tsx`, `<html lang="en" className="dark">` is hardcoded. `tailwind.config.ts` specifies `darkMode: "class"`. However, throughout the entire component codebase (`components/*.tsx`), arbitrary hardcoded dark hex color values (such as `bg-[#111111]`, `bg-[#181818]`, `bg-[#202020]`, `text-[#a3a3a3]`) are used directly instead of semantic Tailwind theme classes or CSS variables. As a result, even if an operating system prefers light mode or a theme toggle were introduced, the application cannot support light mode without extensive visual breakage.

**Steps to Reproduce:**
1. Remove `className="dark"` from `<html>` in dev tools or simulate `prefers-color-scheme: light`.
2. Notice the UI remains completely dark with inconsistent inverted borders and dark hardcoded container backgrounds.

**Expected Behavior:**
Styling tokens should reference CSS variables (`var(--praxd-bg)`, `var(--praxd-panel)`) rather than hardcoded hex classes like `bg-[#141414]` so themes can be switched smoothly.

**Actual Behavior:**
Dozens of components hardcode `#141414`, `#161616`, `#181818`, `#202020`.

**Root Cause:**
Lack of consistent CSS variable usage across JSX class names.

**Relevant Files:**
- `app/globals.css`: lines 5–25
- `components/pull-request-sidebar.tsx`: lines 240–280
- `components/workspace-header.tsx`: lines 50–90

**Evidence:**
Grep check `grep -rn "dark:" app/ components/` returned 0 occurrences of Tailwind dark mode variant classes.

**Recommended Fix:**
Consistently use `var(--praxd-...)` tokens or configure Tailwind semantic colors for background and text.

**Confidence:** Confirmed.

---

### BUG-011: DiffViewer Unmodified Context Expansion Lacks Accessible State Indication

**Severity:** P4
**Category:** Accessibility
**Affected Route:** `/` (Code View)
**Affected Component:** `DiffViewer` (`components/diff-viewer.tsx`)
**Viewport:** All Viewports

**Description:**
In `diff-viewer.tsx`, collapsed unmodified lines are represented by an expand bar with a button:
`<button type="button" onClick={() => setUnmodifiedExpanded(!unmodifiedExpanded)} ...> > 1640 unmodified lines</button>`.
This button does not have `aria-expanded` set to reflect whether the folded context is currently open or collapsed.

**Steps to Reproduce:**
1. Open Code View with any diff containing folded unmodified lines.
2. Inspect the fold bar button (`> 1640 unmodified lines`).
3. Notice `aria-expanded` is not defined on the `<button>`.

**Expected Behavior:**
The button should declare `aria-expanded={unmodifiedExpanded}`.

**Actual Behavior:**
The attribute is omitted.

**Root Cause:**
In `components/diff-viewer.tsx`, lines 260–280, the button lacks `aria-expanded`.

**Relevant Files:**
- `components/diff-viewer.tsx`: lines 260–280

**Evidence:**
DOM inspection in headless browser.

**Recommended Fix:**
Add `aria-expanded={unmodifiedExpanded}` and `aria-label="Expand 1640 unmodified lines"`.

**Confidence:** Confirmed.

---

### BUG-012: Hardcoded External Repository URL Schema Bypasses Custom GitHub Enterprise Instances

**Severity:** P4
**Category:** UX / Navigation
**Affected Route:** `/` (Workspace Header)
**Affected Component:** `WorkspaceHeader` (`components/workspace-header.tsx`)
**Viewport:** All Viewports

**Description:**
In `WorkspaceHeader`, the external link button always constructs URLs using the public GitHub URL:
`href={pr ? 'https://github.com/' + pr.repoOwner + '/' + pr.repoName + '/pull/' + pr.number : '#'}`.
If an enterprise user connects a GitHub Enterprise Server (GHES) installation, clicking this link directs them to public `github.com` where the repository does not exist, generating a 404.

**Steps to Reproduce:**
1. Inspect the "Open on GitHub" link in `WorkspaceHeader`.
2. Notice the host `https://github.com` is hardcoded regardless of PR origin or metadata.

**Expected Behavior:**
The link should use `pr.htmlUrl` or dynamic origin if provided by the GitHub API.

**Actual Behavior:**
The URL is strictly hardcoded to `https://github.com/...`.

**Root Cause:**
In `components/workspace-header.tsx`, line 144:
```tsx
href={pr ? `https://github.com/${pr.repoOwner}/${pr.repoName}/pull/${pr.number}` : "#"}
```

**Relevant Files:**
- `components/workspace-header.tsx`: lines 143–152

**Evidence:**
Source code inspection of `components/workspace-header.tsx`.

**Recommended Fix:**
Use `pr.htmlUrl || `https://github.com/${pr.repoOwner}/${pr.repoName}/pull/${pr.number}``.

**Confidence:** Confirmed.

---

## 4. Route-by-Route Audit

### Route: `/` (PR Workspace Home)

- **Visual Condition:**
  Excellent desktop presentation at 1440 × 900 and 1920 × 1080. Surface colors `#111111`, `#171717`, `#1b1b1b` conform to specification tokens. Text hierarchy and font rendering are crisp.
- **Responsive Condition:**
  - Mobile (< 768px): **Severely Degraded.** Dual-pane flex layout pushes main content offscreen with 0px width.
  - Tablet (768px–1024px): **Impaired.** Left sidebar width (420px) consumes over 54% of screen width, causing split diff view to compress into illegible text columns. Header elements overlap.
  - Desktop (> 1200px): **Stable and Functional.** Resizable handle works with magnetic snapping at 340px, 420px, and 540px.
- **Interactive Behavior:**
  - View switcher (Summary / Code): Functional via mouse click and keys `1` / `2`.
  - Search input: Functional with live filtering and clear button.
  - PR row selection: Preserves active view state and updates URL params/state.
  - In-place title edit: Opens input and sends PATCH request on save; Escape cancels.
  - In-place description edit: Toggles markdown editor and preview.
  - Comment submission: Optimistically updates timeline.
  - Merge modal: Displays merge strategies, commits, and error banners.
  - Dead interactions: Sidebar Filter button, Sidebar Group selector (`Authored ⌵`), and Summary View `+ Request` reviewer button.
- **Console / Runtime Issues:**
  Zero unhandled console errors or runtime exceptions during normal navigation.
- **Known Limitations:**
  In local demo mode (default), data is served from deterministic fixtures in `lib/fixtures/pull-requests.ts`.
- **Remaining Untested Areas:**
  Direct webhook delivery HMAC signing on live GitHub payloads (verified via unit test suite, not manual UI).

---

## 5. Shared Component Audit

### 1. `WorkspaceHeader` (`components/workspace-header.tsx`)
- **Shared Impact:** Controls top-level navigation, view switching, and merge actions across all views.
- **Common Defect:** The centered segmented tab container uses absolute position coordinates (`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`), which causes unconstrained collisions with child elements in the left identity container and right actions container at screen widths below 1100px.

### 2. `PullRequestSidebar` (`components/pull-request-sidebar.tsx`)
- **Shared Impact:** Persistent inbox navigation controlling PR selection for both Summary and Code views.
- **Common Defect:** Flex shrinkage rules (`shrink-0 w-full md:w-[var(--sidebar-width)]`) do not handle mobile view transitions. Furthermore, decorative buttons (`Filter`, `Group`) lack attached event listeners.

### 3. `DiffViewer` (`components/diff-viewer.tsx`)
- **Shared Impact:** Core code review engine used for all changed files in Code View.
- **Common Defect:** Lacks container-query or viewport-aware mode switching. On viewports `< 1024px`, forcing split mode causes horizontal and vertical distortion of code and inline cards.

---

## 6. Accessibility Findings (WCAG 2.2 AA Target)

1. **Form Controls Without Programmatic Labels (WCAG 1.3.1, 4.1.2):**
   `MergeModal` inputs (`#commit-title`, `#commit-message`) use visual text labels without `htmlFor` or `aria-label` bindings.
2. **Toggle Buttons Lacking State Attributes (WCAG 4.1.2):**
   The "Wrap" button in `CodeView` changes color and functionality on click, but does not provide `aria-pressed="true|false"` for assistive technologies.
3. **Disclosure Controls Missing `aria-expanded` (WCAG 4.1.2):**
   Unmodified lines context toggle in `DiffViewer` (`> 1640 unmodified lines`) does not announce its expansion state.
4. **Color Contrast Thresholds (WCAG 1.4.3):**
   Small badge labels (such as `WARNING` in `AIReviewCard`) use low-contrast amber text on dark amber backgrounds with 10px font size.

---

## 7. Recommended Fix Priority

### Priority 1: Critical & High-Impact Responsive Issues
1. **BUG-001 (P1): Fix Workspace Header Layout Overlap:**
   Replace absolute centering with flex layout or responsive hiding of secondary controls below 1024px.
2. **BUG-002 (P1): Implement Mobile Inbox-to-Detail Navigation:**
   On viewports `< 768px`, auto-collapse sidebar when a PR is tapped and provide a clear back button to return to the inbox.

### Priority 2: Interaction & Usability Issues
3. **BUG-003 (P2): Responsive Diff Mode Default:**
   Automatically switch `diffMode` to `"unified"` when container width is below 600px.
4. **BUG-004 (P2): Wire or Gracefully Disable Sidebar Filter and Group Controls:**
   Either implement the filter popover for PR state selection or visually indicate they are disabled.
5. **BUG-006 (P2): Wire or Disable `+ Request` Reviewer Action:**
   Add click handler or demo tooltip to avoid dead clickable affordances.

### Priority 3: Accessibility & Form Hardening
6. **BUG-005 (P2): Accessible Form Labels in Merge Modal:**
   Add `id` and `htmlFor` attributes to commit title and message fields.
7. **BUG-008 (P3): Add `aria-pressed` to Line Wrap Toggle:**
   Ensure screen readers recognize toggle button state changes.
8. **BUG-011 (P4): Add `aria-expanded` to Diff Folding Controls.**

### Priority 4: Visual Polish & Theme Architecture
9. **BUG-009 (P3): Enhance Contrast on Inline Severity Badges.**
10. **BUG-007 (P3): Constrain Maximum Sidebar Resize Width based on Viewport.**
11. **BUG-010 (P3): Abstract Hardcoded Hex Backgrounds to CSS Tokens.**
12. **BUG-012 (P4): Use Dynamic `htmlUrl` for GitHub Links.**

---

## 8. Final Assessment

- **Is the current UI stable?**
  Yes, the UI is exceptionally stable on desktop displays (≥ 1200px) with 0 runtime errors, robust keyboard shortcuts, reliable in-place editing, and comprehensive unit test coverage (88 passing tests).
- **Which pages have the most problems?**
  The single application shell `/` when rendered on **mobile viewports (< 768px)** and **tablet viewports (768px–1024px)** has the most severe layout issues due to dual-pane flex crowding and header collisions.
- **Which shared components create the most issues?**
  1. `WorkspaceHeader`: Absolute coordinate overlap destroys header usability below 1024px.
  2. `PullRequestSidebar`: Lack of responsive transition on mobile and dead filter/grouping buttons.
  3. `DiffViewer`: Forced split mode on narrow widths squishes diff text.
- **What should be fixed first?**
  BUG-001 (Header layout collision) and BUG-002 (Mobile navigation) should be remediated first, as they represent the most prominent user-facing functional blockers.
- **What areas could not be tested?**
  Live OAuth redirects against real GitHub enterprise instances in an isolated offline sandbox (mocked fixtures and test suite were used instead).
- **What additional tests are recommended?**
  - Automated visual regression testing using Playwright with snapshot comparison at 375px, 768px, and 1440px.
  - Automated axe-core accessibility scanner suite integrated into Vitest/Playwright CI.
