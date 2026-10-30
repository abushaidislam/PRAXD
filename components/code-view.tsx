import React, { useState } from "react";
import { MoreHorizontal, Columns, AlignJustify } from "lucide-react";
import { PullRequest, ChangedFile } from "@/types/pr";
import { FileTreeDropdown } from "./file-tree-dropdown";
import { DiffViewer } from "./diff-viewer";
import { cn } from "@/lib/utils";

interface CodeViewProps {
  pr: PullRequest;
}

export function CodeView({ pr }: CodeViewProps) {
  const [selectedFile, setSelectedFile] = useState<ChangedFile>(
    pr.files[0] || {
      filename: "no-files-changed",
      status: "modified",
      additions: 0,
      deletions: 0,
      changes: 0,
      lines: [],
    }
  );

  const [diffMode, setDiffMode] = useState<"split" | "unified">("split");

  // Keep selectedFile valid if PR changes
  const activeFile = pr.files.find((f) => f.filename === selectedFile.filename) || pr.files[0] || selectedFile;

  return (
    <div className="h-full flex flex-col min-w-0 bg-[#111111]">
      {/* Top Breadcrumb & Ergonomic Diff Toolbar */}
      <div className="h-[42px] px-4 border-b border-praxd-border-soft bg-praxd-bg flex items-center justify-between shrink-0 select-none text-[12px]">
        {/* Left: Branch comparison & sticky file selector */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 text-praxd-text-muted font-mono text-[11px] truncate">
            <span className="text-praxd-text-secondary truncate max-w-[260px]">{pr.headRef}</span>
            <span>&gt;</span>
            <span className="text-praxd-text-muted">{pr.baseRef}</span>
          </div>

          {/* Sticky Multi-File Selector Dropdown */}
          {pr.files.length > 0 && (
            <FileTreeDropdown
              files={pr.files}
              selectedFile={activeFile}
              onSelectFile={setSelectedFile}
            />
          )}
        </div>

        {/* Right: Split / Unified Diff Switcher & Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Segmented Diff Mode Switcher (ADR-0002) */}
          <div
            role="tablist"
            aria-label="Diff view mode"
            className="flex items-center p-0.5 rounded-lg bg-[#1e1e1e] border border-praxd-border-soft"
          >
            <button
              type="button"
              role="tab"
              aria-selected={diffMode === "split"}
              onClick={() => setDiffMode("split")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                diffMode === "split"
                  ? "bg-[#2c2c2c] text-praxd-text shadow-sm"
                  : "text-praxd-text-muted hover:text-praxd-text-secondary"
              )}
              title="Side-by-side split diff"
            >
              <Columns className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={diffMode === "unified"}
              onClick={() => setDiffMode("unified")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                diffMode === "unified"
                  ? "bg-[#2c2c2c] text-praxd-text shadow-sm"
                  : "text-praxd-text-muted hover:text-praxd-text-secondary"
              )}
              title="Unified inline diff"
            >
              <AlignJustify className="w-3 h-3" />
              <span>Unified</span>
            </button>
          </div>

          {/* More options button */}
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-[#202020] text-praxd-text-muted hover:text-praxd-text transition-colors"
            aria-label="More diff options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Diff Content Area */}
      <DiffViewer
        file={activeFile}
        diffMode={diffMode}
        comments={pr.comments}
        aiFindings={pr.aiFindings}
      />
    </div>
  );
}
