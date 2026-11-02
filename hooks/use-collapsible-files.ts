"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChangedFile } from "@/types/pr";

export interface UseCollapsibleFilesOptions {
  files: ChangedFile[];
  prId: string;
}

/**
 * Custom hook to manage GitHub-style collapsible files and reviewed progress.
 * Default behavior:
 * - 1st file is expanded by default; subsequent files are collapsed.
 * - Marking a file as viewed auto-collapses it and increments progress.
 * - Provides bulk expandAll and collapseAll affordances.
 */
export function useCollapsibleFiles({ files, prId }: UseCollapsibleFilesOptions) {
  const [viewedFiles, setViewedFiles] = useState<Record<string, boolean>>({});
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (files.length > 0) {
      initial[files[0].filename] = true;
    }
    return initial;
  });

  // Re-synchronize expanded & viewed files whenever the active PR changes
  useEffect(() => {
    if (files.length > 0) {
      const initial: Record<string, boolean> = {};
      initial[files[0].filename] = true;
      setExpandedFiles(initial);
      setViewedFiles({});
    }
  }, [prId, files]);

  const toggleFileExpanded = useCallback((filename: string) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [filename]: !prev[filename],
    }));
  }, []);

  const toggleFileViewed = useCallback((filename: string) => {
    setViewedFiles((prev) => {
      const nextViewed = !prev[filename];
      const updated = { ...prev, [filename]: nextViewed };

      // GitHub behavior: when marked as viewed, auto-collapse file to reduce scroll clutter
      if (nextViewed) {
        setExpandedFiles((exp) => ({ ...exp, [filename]: false }));
      }
      return updated;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    files.forEach((f) => {
      all[f.filename] = true;
    });
    setExpandedFiles(all);
  }, [files]);

  const collapseAll = useCallback(() => {
    const none: Record<string, boolean> = {};
    files.forEach((f) => {
      none[f.filename] = false;
    });
    setExpandedFiles(none);
  }, [files]);

  const isAllExpanded = useMemo(() => {
    if (files.length === 0) return true;
    return files.every((f) => expandedFiles[f.filename] === true);
  }, [files, expandedFiles]);

  const viewedCount = useMemo(() => {
    return files.filter((f) => viewedFiles[f.filename]).length;
  }, [files, viewedFiles]);

  const totalFiles = files.length;
  const progressPercent = totalFiles > 0 ? (viewedCount / totalFiles) * 100 : 0;

  return {
    expandedFiles,
    viewedFiles,
    toggleFileExpanded,
    toggleFileViewed,
    expandAll,
    collapseAll,
    isAllExpanded,
    viewedCount,
    totalFiles,
    progressPercent,
  };
}
