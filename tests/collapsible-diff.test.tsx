import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CodeView } from "@/components/code-view";
import { PullRequest } from "@/types/pr";

import { FIXTURE_PULL_REQUESTS } from "@/lib/fixtures/pull-requests";

const mockMultiFilePR: PullRequest = {
  ...FIXTURE_PULL_REQUESTS[0],
  id: "pr-multi-collapsible",
  number: 101,
  title: "feat: add multi-file vertical diff viewing",
  body: "Demonstrating vertical collapsible diffs",
  state: "open",
  headRef: "feature/collapsible-diffs",
  baseRef: "main",
  files: [
    {
      filename: "docs/UI_UX_SPEC.md",
      status: "modified",
      additions: 23,
      deletions: 7,
      changes: 30,
      patch: `@@ -1,4 +1,5 @@\n # UI UX Spec\n-Old design doc\n+New collapsible design doc\n+Added second line`,
      lines: [
        { type: "context", oldLineNumber: 1, newLineNumber: 1, content: " # UI UX Spec" },
        { type: "deletion", oldLineNumber: 2, content: "-Old design doc" },
        { type: "addition", newLineNumber: 2, content: "+New collapsible design doc" },
        { type: "addition", newLineNumber: 3, content: "+Added second line" },
      ],
    },
    {
      filename: "lib/supabase/auth.ts",
      status: "modified",
      additions: 8,
      deletions: 1,
      changes: 9,
      patch: `@@ -1,3 +1,4 @@\n-import auth from 'old';\n+import auth from 'new';\n+export const session = true;`,
      lines: [
        { type: "deletion", oldLineNumber: 1, content: "-import auth from 'old';" },
        { type: "addition", newLineNumber: 1, content: "+import auth from 'new';" },
        { type: "addition", newLineNumber: 2, content: "+export const session = true;" },
      ],
    },
    {
      filename: "public/icons/logo.png",
      status: "modified",
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: "",
      lines: [],
    },
  ],
};

describe("GitHub-Style Vertical Collapsible Diff View", () => {
  it("renders all files vertically with the 1st file expanded and subsequent files collapsed by default", () => {
    render(<CodeView pr={mockMultiFilePR} />);

    // Basenames are all visible in headers
    expect(screen.getByText("UI_UX_SPEC.md")).toBeInTheDocument();
    expect(screen.getByText("auth.ts")).toBeInTheDocument();
    expect(screen.getByText("logo.png")).toBeInTheDocument();

    // Directory paths are visible
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("lib/supabase")).toBeInTheDocument();
    expect(screen.getByText("public/icons")).toBeInTheDocument();

    // 1st file's diff content is visible
    expect(screen.getByText("+New collapsible design doc")).toBeInTheDocument();

    // 2nd file's diff content is collapsed by default and NOT in the document
    expect(screen.queryByText(/session =/i)).not.toBeInTheDocument();

    // 3rd file's diff unavailable message is collapsed by default
    expect(screen.queryByText("Diff unavailable for this file")).not.toBeInTheDocument();
  });

  it("expands a collapsed file when its header is clicked and reveals its diff", () => {
    render(<CodeView pr={mockMultiFilePR} />);

    // Click 2nd file header (auth.ts)
    const authHeader = screen.getByRole("button", { name: /Expand lib\/supabase\/auth\.ts/i });
    fireEvent.click(authHeader);

    // Now auth.ts diff content is rendered
    expect(screen.getByText(/session =/i)).toBeInTheDocument();
  });

  it("collapses an expanded file when its header is clicked", () => {
    render(<CodeView pr={mockMultiFilePR} />);

    // 1st file diff is visible initially
    expect(screen.getByText("+New collapsible design doc")).toBeInTheDocument();

    // Click 1st file header (UI_UX_SPEC.md) to collapse
    const firstHeader = screen.getByRole("button", { name: /Collapse docs\/UI_UX_SPEC\.md/i });
    fireEvent.click(firstHeader);

    // Now 1st file diff content is hidden
    expect(screen.queryByText("+New collapsible design doc")).not.toBeInTheDocument();
  });

  it("expands all and collapses all files with the toolbar toggle button", () => {
    render(<CodeView pr={mockMultiFilePR} />);

    const toggleAllBtn = screen.getByRole("button", { name: /Expand all files/i });
    expect(toggleAllBtn).toBeInTheDocument();

    // Click "Expand all files"
    fireEvent.click(toggleAllBtn);

    // Now all 3 file diffs are visible
    expect(screen.getByText("+New collapsible design doc")).toBeInTheDocument();
    expect(screen.getByText(/session =/i)).toBeInTheDocument();
    expect(screen.getByText("Diff unavailable for this file")).toBeInTheDocument();

    // Toolbar button changes label to "Collapse all files"
    const collapseAllBtn = screen.getByRole("button", { name: /Collapse all files/i });
    expect(collapseAllBtn).toBeInTheDocument();

    // Click "Collapse all files"
    fireEvent.click(collapseAllBtn);

    // All file diffs are hidden
    expect(screen.queryByText("+New collapsible design doc")).not.toBeInTheDocument();
    expect(screen.queryByText(/session =/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Diff unavailable for this file")).not.toBeInTheDocument();
  });
});
