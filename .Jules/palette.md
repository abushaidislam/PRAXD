# Palette's Journal

Critical UX and accessibility learnings from working on PRAXD.

## 2025-05-18 - Hover-Only Gutter Actions Need Focus-Visible Fallbacks
**Learning:** In code diff viewers, gutter action buttons (such as the `+` inline comment button) are commonly hidden behind `opacity-0 group-hover:opacity-100`. Without explicit `focus-visible:opacity-100` and clear focus ring indicators, keyboard navigators tabbing through line numbers cannot see where focus lands or trigger inline comments visually. Additionally, Split diff columns need explicit `aria-label`s on both sides so screen reader users know which line number they are commenting on.
**Action:** Always pair `group-hover:opacity-100` with `focus-visible:opacity-100 focus-visible:ring-1 focus:outline-none` on gutter controls, and ensure `aria-label`s include the target line number.
