"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChangedFile } from "@/types/pr";

export interface UseCollapsibleFilesOptions {
  files?: ChangedFile[];
  prId: string;
}

/**
 * Custom hook to manage GitHub-style collapsible files and reviewed progress.
 * Default behavior:
 * - 1st file is expanded by default; subsequent files are collapsed.
 * - Marking a file as viewed auto-collapses it and increments progress.
 * - Provides bulk expandAll and collapseAll affordances.
 */
export function useCollapsibleFiles({ files = [], prId }: UseCollapsibleFilesOptions) {
  const safeFiles = useMemo(() => (Array.isArray(files) ? files : []), [files]);
  const [viewedFiles, setViewedFiles] = useState<Record<string, boolean>>({});
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (safeFiles.length > 0) {
      initial[safeFiles[0].filename] = true;
    }
    return initial;
  });

  // Re-synchronize expanded & viewed files whenever the active PR changes
  useEffect(() => {
    if (safeFiles.length > 0) {
      const initial: Record<string, boolean> = {};
      initial[safeFiles[0].filename] = true;
      setExpandedFiles(initial);
      setViewedFiles({});
    } else {
      setExpandedFiles({});
      setViewedFiles({});
    }
  }, [prId, safeFiles]);

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
        setExpandedFiles((ePrev) => ({
          ...ePrev,
          [filename]: false,
        }));
      }

      return updated;
    });
  }, []);

  const expandAll = useCallback(() => {
    const expandedState: Record<string, boolean> = {};
    safeFiles.forEach((f) => {
      expandedState[f.filename] = true;
    });
    setExpandedFiles(expandedState);
  }, [safeFiles]);

  const collapseAll = useCallback(() => {
    const collapsedState: Record<string, boolean> = {};
    safeFiles.forEach((f) => {
      collapsedState[f.filename] = false;
    });
    setExpandedFiles(collapsedState);
  }, [safeFiles]);

  const isAllExpanded = useMemo(() => {
    if (safeFiles.length === 0) return false;
    return safeFiles.every((f) => expandedFiles[f.filename] ?? false);
  }, [safeFiles, expandedFiles]);

  const handleToggleAllFiles = useCallback(() => {
    if (isAllExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
  }, [isAllExpanded, collapseAll, expandAll]);

  const viewedCount = useMemo(() => {
    return Object.values(viewedFiles).filter(Boolean).length;
  }, [viewedFiles]);

  return {
    expandedFiles,
    viewedFiles,
    isAllExpanded,
    viewedCount,
    totalFiles: safeFiles.length,
    toggleFileExpanded,
    toggleFileViewed,
    handleToggleAllFiles,
    expandAll,
    collapseAll,
  };
}
