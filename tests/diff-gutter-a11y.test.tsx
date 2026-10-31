import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DiffViewer } from "@/components/diff-viewer";
import { ChangedFile } from "@/types/pr";

const mockFile: ChangedFile = {
  filename: "src/sample.ts",
  status: "modified",
  additions: 1,
  deletions: 1,
  changes: 2,
  patch: `@@ -10,1 +10,1 @@\n-const oldVal = 1;\n+const newVal = 2;`,
  lines: [
    {
      type: "deletion",
      content: "const oldVal = 1;",
      oldLineNumber: 10,
    },
    {
      type: "addition",
      content: "const newVal = 2;",
      newLineNumber: 10,
    },
  ],
};

describe("DiffViewer Gutter Comment Button Accessibility", () => {
  it("renders accessible comment buttons with aria-labels and focus styles in Split mode", () => {
    render(
      <DiffViewer
        file={mockFile}
        diffMode="split"
        comments={[]}
        wrapLines={false}
      />
    );

    // In Split mode, both left (old line 10) and right (new line 10) render comment buttons
    const commentButtons = screen.getAllByRole("button", {
      name: "Comment on line 10",
    });
    expect(commentButtons).toHaveLength(2);

    // Left (Base) column comment button
    expect(commentButtons[0]).toHaveAttribute("aria-label", "Comment on line 10");
    expect(commentButtons[0].className).toContain("focus-visible:opacity-100");
    expect(commentButtons[0].className).toContain("focus-visible:ring-praxd-blue");

    // Right (Head) column comment button
    expect(commentButtons[1]).toHaveAttribute("aria-label", "Comment on line 10");
    expect(commentButtons[1].className).toContain("focus-visible:opacity-100");
    expect(commentButtons[1].className).toContain("focus-visible:ring-praxd-blue");
  });

  it("renders accessible comment buttons with aria-labels and focus styles in Unified mode", () => {
    render(
      <DiffViewer
        file={mockFile}
        diffMode="unified"
        comments={[]}
        wrapLines={false}
      />
    );

    const unifiedCommentButtons = screen.getAllByRole("button", {
      name: "Comment on line 10",
    });
    expect(unifiedCommentButtons.length).toBeGreaterThan(0);
    expect(unifiedCommentButtons[0]).toHaveAttribute("aria-label", "Comment on line 10");
    expect(unifiedCommentButtons[0].className).toContain("focus-visible:opacity-100");
    expect(unifiedCommentButtons[0].className).toContain("focus-visible:ring-praxd-blue");
  });
});
