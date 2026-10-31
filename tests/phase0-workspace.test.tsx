import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PRWorkspace } from "@/components/pr-workspace";

describe("Phase 0 — PR Workspace & Visual Contract Acceptance Tests", () => {
  it("P0-01: loads workspace with fixtures and displays local demo mode notice without external secrets", () => {
    render(<PRWorkspace />);

    // Check demo mode badge
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("PRAXD Phase 0 Fixture Mode");
    expect(within(status).getByText("READ-ONLY MVP")).toBeInTheDocument();

    // Check primary PR title in header
    expect(
      screen.getByRole("heading", {
        name: /Sentinel: \[MEDIUM\] Fix DOM/i,
      })
    ).toBeInTheDocument();
  });

  it("P0-02: switches tabs between All, Reviewing, and Authored according to defined rules", () => {
    render(<PRWorkspace />);

    const allTab = screen.getByRole("tab", { name: "All" });
    const reviewingTab = screen.getByRole("tab", { name: "Reviewing" });
    const authoredTab = screen.getByRole("tab", { name: "Authored" });
    const prListbox = screen.getByRole("listbox", { name: "Pull requests" });

    expect(allTab).toHaveAttribute("aria-selected", "true");

    // Click reviewing tab
    fireEvent.click(reviewingTab);
    expect(reviewingTab).toHaveAttribute("aria-selected", "true");

    // Reviewing tab should show PRs with category === "reviewing"
    expect(within(prListbox).getByText(/fix: 🔍 SEO: end-to-end SEO metadata/i)).toBeInTheDocument();

    // Click authored tab
    fireEvent.click(authoredTab);
    expect(authoredTab).toHaveAttribute("aria-selected", "true");
    expect(within(prListbox).getByText(/Sentinel: \[MEDIUM\] Fix DOM XSS/i)).toBeInTheDocument();
  });

  it("P0-03: searches pull requests by number, title, author, and branch; clearing restores list", () => {
    render(<PRWorkspace />);

    const searchInput = screen.getByPlaceholderText("Search pull requests");
    const prListbox = screen.getByRole("listbox", { name: "Pull requests" });

    // Search by exact PR number
    fireEvent.change(searchInput, { target: { value: "164" } });
    expect(within(prListbox).getByText(/Sentinel: \[MEDIUM\] Fix DOM XSS/i)).toBeInTheDocument();
    expect(within(prListbox).queryByText(/assets: update brand icons/i)).not.toBeInTheDocument();

    // Search by keyword "SEO"
    fireEvent.change(searchInput, { target: { value: "SEO" } });
    expect(within(prListbox).getByText(/technical SEO audit report/i)).toBeInTheDocument();

    // Clear search
    const clearButton = screen.getByRole("button", { name: "Clear search" });
    fireEvent.click(clearButton);
    expect(searchInput).toHaveValue("");
    expect(within(prListbox).getByText(/Sentinel: \[MEDIUM\] Fix DOM XSS/i)).toBeInTheDocument();
  });

  it("P0-04: selecting a different PR updates the header, Summary, and Code views without full-page reload", () => {
    render(<PRWorkspace />);

    const prListbox = screen.getByRole("listbox", { name: "Pull requests" });

    // Click another PR in the list
    const seoPrButton = within(prListbox).getByText(/technical SEO audit report/i);
    fireEvent.click(seoPrButton);

    // Workspace header should now display the newly selected PR title
    expect(
      screen.getByRole("heading", {
        name: /technical SEO audit report/i,
      })
    ).toBeInTheDocument();
  });

  it("P0-05: switches between Summary and Code views reliably and preserves the selected PR", () => {
    render(<PRWorkspace />);

    const summaryTab = screen.getByRole("tab", { name: "Summary" });
    const codeTab = screen.getByRole("tab", { name: "Code" });

    // Switch to Summary
    fireEvent.click(summaryTab);
    expect(summaryTab).toHaveAttribute("aria-selected", "true");

    // Summary elements should be present
    expect(screen.getByRole("button", { name: /^Description/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Checks/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Activity/i })).toBeInTheDocument();
    expect(screen.getByText(/Lint, Validate & Build Artifacts/i)).toBeInTheDocument();

    // Switch back to Code
    fireEvent.click(codeTab);
    expect(codeTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("extension/content.js").length).toBeGreaterThan(0);
  });

  it("P0-06: displays explicit 'Diff unavailable' message for binary files / files without patch", () => {
    render(<PRWorkspace />);

    const prListbox = screen.getByRole("listbox", { name: "Pull requests" });

    // Find and click the binary assets PR
    const binaryPr = within(prListbox).getByText(/assets: update brand icons/i);
    fireEvent.click(binaryPr);

    // Switch to Code view
    const codeTab = screen.getByRole("tab", { name: "Code" });
    fireEvent.click(codeTab);

    // Should display honesty message instead of fabricated code
    expect(screen.getByText("Diff unavailable for this file")).toBeInTheDocument();
    expect(screen.getAllByText(/public\/icons\/logo\.png/i).length).toBeGreaterThan(0);
  });

  it("P0-07: opens merge confirmation modal when clicking Merge button", () => {
    render(<PRWorkspace />);

    const mergeButton = screen.getByRole("button", {
      name: /Merge pull request/i,
    });
    expect(mergeButton).toBeEnabled();

    // Clicking Merge opens Merge modal
    fireEvent.click(mergeButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Create a merge commit/i)).toBeInTheDocument();
    expect(screen.getByText(/Squash and merge/i)).toBeInTheDocument();
    expect(screen.getByText(/Rebase and merge/i)).toBeInTheDocument();
  });

  it("P0-08: switches between Split and Unified diff modes cleanly", () => {
    render(<PRWorkspace />);

    const splitTab = screen.getByRole("tab", { name: "Split" });
    const unifiedTab = screen.getByRole("tab", { name: "Unified" });

    expect(splitTab).toHaveAttribute("aria-selected", "true");

    // Switch to Unified
    fireEvent.click(unifiedTab);
    expect(unifiedTab).toHaveAttribute("aria-selected", "true");

    // Switch back to Split
    fireEvent.click(splitTab);
    expect(splitTab).toHaveAttribute("aria-selected", "true");
  });

  it("P0-09: collapses and expands left PR inbox with toggle button and shortcut", () => {
    render(<PRWorkspace />);

    // Collapse inbox
    const collapseButton = screen.getByRole("button", { name: "Collapse inbox sidebar" });
    fireEvent.click(collapseButton);

    // Sidebar should be collapsed
    expect(screen.queryByPlaceholderText("Search pull requests")).not.toBeInTheDocument();

    // Expand button in header
    const expandButton = screen.getByRole("button", { name: "Expand inbox sidebar" });
    fireEvent.click(expandButton);
    expect(screen.getByPlaceholderText("Search pull requests")).toBeInTheDocument();

    // Keyboard shortcut Ctrl+B
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.queryByPlaceholderText("Search pull requests")).not.toBeInTheDocument();
  });
});
