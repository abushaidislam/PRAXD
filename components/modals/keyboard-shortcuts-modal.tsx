"use client";

import React, { useEffect } from "react";
import { X, Command, Keyboard } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Views & Panels",
    shortcuts: [
      { keys: ["1"], description: "Switch to Summary View" },
      { keys: ["2"], description: "Switch to Code Diff View" },
      { keys: ["Ctrl", "B"], description: "Toggle PR Inbox Sidebar" },
    ],
  },
  {
    title: "Diff & File Navigation",
    shortcuts: [
      { keys: ["["], description: "Jump to Previous Changed File" },
      { keys: ["]"], description: "Jump to Next Changed File" },
      { keys: ["↑", "↓"], description: "Navigate Pull Requests in Inbox" },
    ],
  },
  {
    title: "Actions & Editing",
    shortcuts: [
      { keys: ["Enter"], description: "Save in-place PR title or description" },
      { keys: ["Esc"], description: "Close modal / Cancel in-place edit" },
      { keys: ["?"], description: "Open Keyboard Shortcuts cheatsheet" },
    ],
  },
];

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[#161616] border border-praxd-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 select-none text-praxd-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-praxd-border-soft bg-[#181818]">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-praxd-blue" />
            <h2 id="shortcuts-dialog-title" className="text-[14px] font-semibold text-white">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-[#252525] transition-colors"
            aria-label="Close shortcuts modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts Content */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {section.title}
              </h3>
              <div className="space-y-1.5 bg-[#121212] rounded-lg border border-praxd-border-soft p-2">
                {section.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2 text-[12px] hover:bg-[#1a1a1a] rounded transition-colors"
                  >
                    <span className="text-neutral-300 font-medium">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {shortcut.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#222222] text-neutral-200 border border-neutral-700 shadow-sm min-w-[22px] text-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div className="px-5 py-2.5 bg-[#141414] border-t border-praxd-border-soft flex items-center justify-between text-[11px] text-neutral-400">
          <span>Press <kbd className="px-1.5 py-0.2 bg-[#222] border border-neutral-700 rounded font-mono text-[10px] text-neutral-300">?</kbd> anytime to open this guide</span>
          <span>Press <kbd className="px-1.5 py-0.2 bg-[#222] border border-neutral-700 rounded font-mono text-[10px] text-neutral-300">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
