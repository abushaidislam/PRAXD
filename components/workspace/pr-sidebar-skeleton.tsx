"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PRSidebarSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * PRSidebarSkeleton renders shimmering PR row placeholders
 * in the sidebar while PRs are being fetched from the server.
 */
export function PRSidebarSkeleton({ count = 5, className }: PRSidebarSkeletonProps) {
  return (
    <div
      className={cn("p-2 space-y-1 select-none", className)}
      role="status"
      aria-label="Loading pull requests list"
    >
      <span className="sr-only">Loading pull requests...</span>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="w-full p-2.5 rounded-lg border border-transparent flex items-start gap-2.5"
        >
          {/* PR icon shimmer */}
          <div className="w-4 h-4 rounded-full bg-neutral-800 animate-pulse mt-0.5 shrink-0" />

          {/* PR Details Shimmer */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* PR Title row */}
            <div className="flex items-center justify-between gap-2">
              <div
                className="h-3.5 rounded bg-neutral-800 animate-pulse"
                style={{ width: index % 2 === 0 ? "82%" : "68%" }}
              />
              <div className="w-7 h-3 rounded bg-neutral-900 animate-pulse shrink-0" />
            </div>

            {/* Subtitle row (repo, branch, relative time) */}
            <div className="flex items-center justify-between gap-2">
              <div
                className="h-2.5 rounded bg-neutral-900 animate-pulse"
                style={{ width: index % 2 === 0 ? "55%" : "42%" }}
              />
              <div className="w-10 h-2.5 rounded bg-neutral-900 animate-pulse shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
