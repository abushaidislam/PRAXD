"use client";

import React from "react";
import { GitBranch, Users, MessageSquare, CheckCircle2, GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummarySkeletonProps {
  className?: string;
}

/**
 * SummarySkeleton renders a dark-themed, authentic GitHub/PRAXD-styled
 * skeleton placeholder for the PR Summary View (metadata, description,
 * check runs, and activity timeline).
 */
export function SummarySkeleton({ className }: SummarySkeletonProps) {
  return (
    <div
      className={cn("h-full overflow-y-auto bg-praxd-bg select-none", className)}
      role="status"
      aria-label="Loading pull request summary"
    >
      <span className="sr-only">Loading pull request summary...</span>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Title & Author Header Shimmer */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="w-3/4 h-7 rounded bg-neutral-800 animate-pulse" />
              <div className="w-1/2 h-5 rounded bg-neutral-800/60 animate-pulse sm:hidden" />
            </div>
            <div className="w-8 h-8 rounded-md bg-neutral-800/60 animate-pulse shrink-0" />
          </div>

          {/* Author Line Shimmer */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-neutral-800 animate-pulse shrink-0" />
            <div className="w-24 h-3.5 rounded bg-neutral-800/80 animate-pulse" />
            <span className="text-neutral-700">·</span>
            <div className="w-12 h-3.5 rounded bg-neutral-900 animate-pulse" />
          </div>
        </div>

        {/* Metadata Grid Shimmer */}
        <div className="space-y-3 py-2 text-[12px] border-y border-praxd-border-soft">
          {/* Branch Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              <GitBranch className="w-3.5 h-3.5 text-neutral-600" />
              <span>Branch</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-32 h-5 rounded bg-neutral-800/90 animate-pulse" />
              <span className="text-neutral-700 font-mono">→</span>
              <div className="w-20 h-5 rounded bg-neutral-800/90 animate-pulse" />
              <div className="w-16 h-4 rounded bg-neutral-900 animate-pulse ml-1" />
            </div>
          </div>

          {/* Reviewers Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              <Users className="w-3.5 h-3.5 text-neutral-600" />
              <span>Reviewers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-5 rounded bg-neutral-800/80 animate-pulse" />
              <div className="w-20 h-5 rounded bg-neutral-800/60 animate-pulse hidden sm:inline-block" />
            </div>
          </div>

          {/* Comments Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              <MessageSquare className="w-3.5 h-3.5 text-neutral-600" />
              <span>Comments</span>
            </div>
            <div className="w-20 h-4 rounded bg-neutral-800/70 animate-pulse" />
          </div>

          {/* Checks Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              <CheckCircle2 className="w-3.5 h-3.5 text-neutral-600" />
              <span>Checks</span>
            </div>
            <div className="w-28 h-4 rounded bg-neutral-800/70 animate-pulse" />
          </div>

          {/* Status Row */}
          <div className="flex items-center">
            <div className="w-[105px] sm:w-[120px] shrink-0 flex items-center gap-2 text-praxd-text-muted">
              <GitPullRequest className="w-3.5 h-3.5 text-neutral-600" />
              <span>Status</span>
            </div>
            <div className="w-24 h-4 rounded bg-neutral-800/70 animate-pulse" />
          </div>
        </div>

        {/* Description Section Shimmer */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="w-28 h-4 rounded bg-neutral-800 animate-pulse" />
            <div className="w-14 h-6 rounded bg-neutral-900 animate-pulse" />
          </div>
          <div className="p-4 rounded-lg bg-[#141414] border border-praxd-border-soft space-y-2.5">
            <div className="w-full h-3.5 rounded bg-neutral-800/70 animate-pulse" />
            <div className="w-5/6 h-3.5 rounded bg-neutral-800/60 animate-pulse" />
            <div className="w-2/3 h-3.5 rounded bg-neutral-800/50 animate-pulse" />
          </div>
        </div>

        {/* CI / Check Runs Section Shimmer */}
        <div className="space-y-2 pt-2">
          <div className="w-24 h-4 rounded bg-neutral-800 animate-pulse" />
          <div className="p-3.5 rounded-lg bg-[#141414] border border-praxd-border-soft space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500/50 animate-pulse" />
                <div className="w-36 h-3.5 rounded bg-neutral-800/80 animate-pulse" />
              </div>
              <div className="w-16 h-3 rounded bg-neutral-900 animate-pulse" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neutral-600 animate-pulse" />
                <div className="w-44 h-3.5 rounded bg-neutral-800/80 animate-pulse" />
              </div>
              <div className="w-14 h-3 rounded bg-neutral-900 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Activity Timeline Shimmer */}
        <div className="space-y-4 pt-3">
          <div className="w-32 h-4 rounded bg-neutral-800 animate-pulse" />

          {/* Timeline Spine & Nodes */}
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-800/80">
            {/* Commit node shimmer */}
            <div className="relative flex items-center gap-3">
              <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-neutral-800 border-2 border-praxd-bg animate-pulse" />
              <div className="flex items-center gap-2 flex-1">
                <div className="w-14 h-3.5 rounded bg-neutral-800 animate-pulse font-mono" />
                <div className="w-3/5 h-3.5 rounded bg-neutral-800/80 animate-pulse" />
              </div>
            </div>

            {/* Comment bubble shimmer */}
            <div className="relative">
              <div className="absolute -left-6 top-2 w-3.5 h-3.5 rounded-full bg-neutral-800 border-2 border-praxd-bg animate-pulse" />
              <div className="rounded-lg bg-[#141414] border border-praxd-border-soft overflow-hidden">
                <div className="px-3.5 py-2 bg-[#181818] border-b border-praxd-border-soft flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-neutral-700 animate-pulse" />
                    <div className="w-20 h-3 rounded bg-neutral-800 animate-pulse" />
                  </div>
                  <div className="w-12 h-3 rounded bg-neutral-900 animate-pulse" />
                </div>
                <div className="p-3.5 space-y-2">
                  <div className="w-4/5 h-3.5 rounded bg-neutral-800/70 animate-pulse" />
                  <div className="w-3/5 h-3.5 rounded bg-neutral-800/60 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Comment composer box shimmer */}
          <div className="w-full h-24 rounded-lg bg-[#141414]/60 border border-praxd-border-soft animate-pulse mt-4" />
        </div>
      </div>
    </div>
  );
}
