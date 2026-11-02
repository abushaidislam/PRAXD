"use client";

import { useEffect, useCallback } from "react";

export interface UseWorkspaceShortcutsOptions {
  onToggleSidebar?: () => void;
  onSelectSummaryView?: () => void;
  onSelectCodeView?: () => void;
  onOpenShortcutsModal?: () => void;
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts hook for the PRAXD PR Workspace.
 * Handles:
 * - Cmd/Ctrl + B : Toggle left PR inbox sidebar
 * - 1 : Switch to Summary view (when not editing input/textarea)
 * - 2 : Switch to Code view (when not editing input/textarea)
 * - ? : Open Keyboard Shortcuts modal (when not editing input/textarea)
 */
export function useWorkspaceShortcuts({
  onToggleSidebar,
  onSelectSummaryView,
  onSelectCodeView,
  onOpenShortcutsModal,
  enabled = true,
}: UseWorkspaceShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Cmd/Ctrl + B: Toggle sidebar (works even while in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // Single-key shortcuts only fire when not actively typing in an input
      if (!isEditing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "1") {
          e.preventDefault();
          onSelectSummaryView?.();
        } else if (e.key === "2") {
          e.preventDefault();
          onSelectCodeView?.();
        } else if (e.key === "?") {
          e.preventDefault();
          onOpenShortcutsModal?.();
        }
      }
    },
    [enabled, onToggleSidebar, onSelectSummaryView, onSelectCodeView, onOpenShortcutsModal]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);
}
