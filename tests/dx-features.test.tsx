import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { CodeView } from "@/components/code-view";
import { CheckoutCommandDropdown } from "@/components/checkout-command-dropdown";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { FileTreeDropdown } from "@/components/file-tree-dropdown";
import { ToastProvider, useToast } from "@/components/toast";
import { PRWorkspace } from "@/components/pr-workspace";
import { FIXTURE_PULL_REQUESTS } from "@/lib/fixtures/pull-requests";

describe("PRAXD Developer Experience & Bite-Sized Features Suite", () => {
  const samplePr = FIXTURE_PULL_REQUESTS[0];

  describe("1. Mark File as Viewed & Review Progress", () => {
    it("renders Viewed button on file headers, toggles viewed state, and updates progress indicator", () => {
      render(
        <ToastProvider>
          <CodeView pr={samplePr} />
        </ToastProvider>
      );

      // Initially review progress should show 0 viewed
      expect(screen.getByText(/0\/3/)).toBeInTheDocument();
      expect(screen.getByText("viewed")).toBeInTheDocument();

      // Find the Viewed button for the first file (extension/content.js)
      const viewedButtons = screen.getAllByRole("button", { name: /Mark as viewed/i });
      expect(viewedButtons.length).toBeGreaterThan(0);

      // Click the first Viewed button to mark as viewed
      fireEvent.click(viewedButtons[0]);

      // Progress counter should now be 1/3 viewed
      expect(screen.getByText(/1\/3/)).toBeInTheDocument();

      // The button should now have aria-pressed="true" and label Mark as unviewed
      expect(
        screen.getByRole("button", { name: /Mark as unviewed: extension\/content\.js/i })
      ).toBeInTheDocument();

      // Clicking it again unmarks it as viewed
      const unviewedButton = screen.getByRole("button", {
        name: /Mark as unviewed: extension\/content\.js/i,
      });
      fireEvent.click(unviewedButton);

      // Counter should return to 0/3 viewed
      expect(screen.getByText(/0\/3/)).toBeInTheDocument();
    });
  });

  describe("2. Terminal Checkout Command Dropdown", () => {
    it("opens checkout command dropdown, displays gh pr and git checkout options, and copies on click", () => {
      // Mock clipboard
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <ToastProvider>
          <CheckoutCommandDropdown pr={samplePr} variant="inline" />
        </ToastProvider>
      );

      const checkoutButton = screen.getByRole("button", { name: /Checkout branch commands/i });
      expect(checkoutButton).toBeInTheDocument();

      // Open dropdown
      fireEvent.click(checkoutButton);

      // Dropdown menu should be visible
      const menu = screen.getByRole("menu", { name: /Checkout command options/i });
      expect(menu).toBeInTheDocument();

      // Options should exist
      expect(screen.getByText("GitHub CLI")).toBeInTheDocument();
      expect(screen.getByText(`gh pr checkout ${samplePr.number}`)).toBeInTheDocument();
      expect(screen.getByText("Git Checkout")).toBeInTheDocument();
      expect(screen.getByText(`git checkout ${samplePr.headRef}`)).toBeInTheDocument();

      // Click gh pr checkout option
      const ghOption = screen.getByText(`gh pr checkout ${samplePr.number}`);
      fireEvent.click(ghOption);

      // Verify clipboard call
      expect(writeTextMock).toHaveBeenCalledWith(`gh pr checkout ${samplePr.number}`);
    });
  });

  describe("3. Keyboard Shortcuts Cheatsheet Modal", () => {
    it("renders keyboard shortcuts dialog with categories and closes on Escape", () => {
      const handleClose = vi.fn();
      render(<KeyboardShortcutsModal isOpen={true} onClose={handleClose} />);

      const dialog = screen.getByRole("dialog", { name: /Keyboard Shortcuts/i });
      expect(dialog).toBeInTheDocument();

      // Categories
      expect(screen.getByText("Views & Panels")).toBeInTheDocument();
      expect(screen.getByText("Diff & File Navigation")).toBeInTheDocument();
      expect(screen.getByText("Actions & Editing")).toBeInTheDocument();

      // Shortcuts listed
      expect(screen.getByText("Switch to Summary View")).toBeInTheDocument();
      expect(screen.getByText("Switch to Code Diff View")).toBeInTheDocument();
      expect(screen.getByText("Toggle PR Inbox Sidebar")).toBeInTheDocument();

      // Press Escape to close
      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalled();
    });

    it("opens shortcuts modal when clicking shortcuts button in workspace header", () => {
      render(<PRWorkspace />);

      const shortcutsButton = screen.getByRole("button", { name: /Open keyboard shortcuts guide/i });
      expect(shortcutsButton).toBeInTheDocument();

      // Click button
      fireEvent.click(shortcutsButton);

      // Dialog opens
      expect(screen.getByRole("dialog", { name: /Keyboard Shortcuts/i })).toBeInTheDocument();

      // Close modal by clicking close button
      const closeButton = screen.getByRole("button", { name: /Close shortcuts modal/i });
      fireEvent.click(closeButton);
      expect(screen.queryByRole("dialog", { name: /Keyboard Shortcuts/i })).not.toBeInTheDocument();
    });
  });

  describe("4. FileTreeDropdown Quick Search & Filter", () => {
    it("filters changed files in dropdown when user types in search input", () => {
      const handleSelectFile = vi.fn();
      render(
        <FileTreeDropdown
          files={samplePr.files}
          selectedFile={samplePr.files[0]}
          onSelectFile={handleSelectFile}
        />
      );

      // Open dropdown
      const trigger = screen.getByRole("button", { name: /extension\/content\.js/i });
      fireEvent.click(trigger);

      const searchInput = screen.getByPlaceholderText("Filter files...");
      expect(searchInput).toBeInTheDocument();

      // Type filter "manifest"
      fireEvent.change(searchInput, { target: { value: "manifest" } });

      const listbox = screen.getByRole("listbox", { name: /Files changed in this pull request/i });

      // Only manifest.json should match in the listbox options
      expect(within(listbox).getByText("manifest.json")).toBeInTheDocument();
      expect(within(listbox).queryByText("extension/content.js")).not.toBeInTheDocument();

      // Clear search
      fireEvent.change(searchInput, { target: { value: "" } });
      expect(within(listbox).getByText("extension/content.js")).toBeInTheDocument();
    });
  });

  describe("5. Sleek Toast Notification System", () => {
    function TestToastConsumer() {
      const { showToast } = useToast();
      return (
        <button
          type="button"
          onClick={() => showToast("Test notification dispatched!", "success", 1000)}
        >
          Trigger Toast
        </button>
      );
    }

    it("displays floating toast notification and allows manual dismissal", () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      const triggerBtn = screen.getByRole("button", { name: "Trigger Toast" });
      fireEvent.click(triggerBtn);

      // Toast appears
      expect(screen.getByText("Test notification dispatched!")).toBeInTheDocument();

      // Dismiss button
      const dismissBtn = screen.getByRole("button", { name: "Dismiss notification" });
      fireEvent.click(dismissBtn);

      expect(screen.queryByText("Test notification dispatched!")).not.toBeInTheDocument();
    });
  });
});
