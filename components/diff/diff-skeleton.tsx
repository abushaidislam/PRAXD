"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface DiffSkeletonProps {
  className?: string;
  count?: number;
}

/**
 * DiffSkeleton renders an authentic, dark-themed GitHub/PRAXD styled
 * diff skeleton with shimmering headers, line number gutters, and code lines
 * to eliminate jarring "No file diffs" flickers while PR files load.
 */
export function DiffSkeleton({ className, count = 2 }: DiffSkeletonProps) {
  return (
    <div
      className={cn("flex flex-col divide-y divide-praxd-border-soft bg-[#0e0e0e] w-full", className)}
      role="status"
      aria-label="Loading pull request diff"
    >
      <span className="sr-only">Loading file diffs...</span>

      {/* First file: Expanded skeleton with line numbers and code rows */}
      <div className="flex flex-col">
        {/* Shimmering File Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#141414] border-b border-praxd-border-soft">
          <div className="flex items-center gap-3">
            {/* File Icon Badge Placeholder */}
            <div className="w-5 h-5 rounded bg-neutral-800/80 animate-pulse shrink-0" />
            {/* Filename & Directory Placeholder */}
            <div className="flex items-center gap-2">
              <div className="w-32 h-4 rounded bg-neutral-800 animate-pulse" />
              <div className="w-20 h-3 rounded bg-neutral-900 animate-pulse hidden sm:inline-block" />
            </div>
          </div>
          {/* Right Header Stats & Buttons Placeholder */}
          <div className="flex items-center gap-2.5">
            <div className="w-16 h-4 rounded bg-neutral-800/60 animate-pulse" />
            <div className="w-14 h-5 rounded bg-neutral-800/80 animate-pulse hidden sm:inline-block" />
            <div className="w-5 h-5 rounded bg-neutral-800/60 animate-pulse" />
          </div>
        </div>

        {/* Shimmering Diff Lines */}
        <div className="font-mono text-[12px] bg-[#0c0c0c] py-2 flex flex-col space-y-1.5 select-none">
          {/* Line 1: Normal context line */}
          <div className="flex items-center gap-4 px-3 py-0.5">
            <div className="w-8 text-right text-neutral-700 text-[11px]">1</div>
            <div className="w-8 text-right text-neutral-700 text-[11px]">1</div>
            <div className="w-2/5 h-3 rounded bg-neutral-800/60 animate-pulse" />
          </div>

          {/* Line 2: Context line */}
          <div className="flex items-center gap-4 px-3 py-0.5">
            <div className="w-8 text-right text-neutral-700 text-[11px]">2</div>
            <div className="w-8 text-right text-neutral-700 text-[11px]">2</div>
            <div className="w-3/5 h-3 rounded bg-neutral-800/70 animate-pulse" />
          </div>

          {/* Line 3: Deletion line (red tinted shimmer) */}
          <div className="flex items-center gap-4 px-3 py-0.5 bg-red-950/20 border-l-2 border-red-500/40">
            <div className="w-8 text-right text-red-400/50 text-[11px]">3</div>
            <div className="w-8 text-right text-transparent text-[11px]">-</div>
            <div className="w-4/5 h-3 rounded bg-red-900/30 animate-pulse" />
          </div>

          {/* Line 4: Addition line (green tinted shimmer) */}
          <div className="flex items-center gap-4 px-3 py-0.5 bg-emerald-950/25 border-l-2 border-emerald-500/50">
            <div className="w-8 text-right text-transparent text-[11px]">-</div>
            <div className="w-8 text-right text-emerald-400/60 text-[11px]">3</div>
            <div className="w-11/12 h-3 rounded bg-emerald-900/35 animate-pulse" />
          </div>

          {/* Line 5: Addition line (green tinted shimmer) */}
          <div className="flex items-center gap-4 px-3 py-0.5 bg-emerald-950/25 border-l-2 border-emerald-500/50">
            <div className="w-8 text-right text-transparent text-[11px]">-</div>
            <div className="w-8 text-right text-emerald-400/60 text-[11px]">4</div>
            <div className="w-3/4 h-3 rounded bg-emerald-900/35 animate-pulse" />
          </div>

          {/* Line 6: Context line */}
          <div className="flex items-center gap-4 px-3 py-0.5">
            <div className="w-8 text-right text-neutral-700 text-[11px]">4</div>
            <div className="w-8 text-right text-neutral-700 text-[11px]">5</div>
            <div className="w-1/2 h-3 rounded bg-neutral-800/60 animate-pulse" />
          </div>

          {/* Line 7: Context line */}
          <div className="flex items-center gap-4 px-3 py-0.5">
            <div className="w-8 text-right text-neutral-700 text-[11px]">5</div>
            <div className="w-8 text-right text-neutral-700 text-[11px]">6</div>
            <div className="w-2/3 h-3 rounded bg-neutral-800/60 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Subsequent files: Collapsed skeleton header */}
      {count > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#141414] border-b border-praxd-border-soft">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-neutral-800/80 animate-pulse shrink-0" />
            <div className="w-44 h-4 rounded bg-neutral-800 animate-pulse" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-4 rounded bg-neutral-800/60 animate-pulse" />
            <div className="w-5 h-5 rounded bg-neutral-800/60 animate-pulse" />
          </div>
        </div>
      )}

      {count > 2 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#141414] border-b border-praxd-border-soft">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-neutral-800/80 animate-pulse shrink-0" />
            <div className="w-36 h-4 rounded bg-neutral-800 animate-pulse" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-14 h-4 rounded bg-neutral-800/60 animate-pulse" />
            <div className="w-5 h-5 rounded bg-neutral-800/60 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
