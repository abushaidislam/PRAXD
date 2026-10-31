"use client";

import React, { useState, useEffect } from "react";
import { PresenceUser } from "@/lib/realtime/presence";
import { cn } from "@/lib/utils";
import { Users, Eye } from "lucide-react";

interface PresenceAvatarsProps {
  pullRequestId: string;
  activeView: "summary" | "code";
  activeFile?: string | null;
}

export function PresenceAvatars({
  pullRequestId,
  activeView,
  activeFile,
}: PresenceAvatarsProps) {
  const [reviewers, setReviewers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    let isCancelled = false;

    // Send heartbeat immediately and then every 8s
    async function sendHeartbeat() {
      try {
        const res = await fetch(`/api/pull-requests/${pullRequestId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activeView,
            activeFile,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.data?.reviewers) {
            setReviewers(json.data.reviewers);
          }
        }
      } catch {
        // Ignore network failure
      }
    }

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 8000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      // Leave presence on unmount
      fetch(`/api/pull-requests/${pullRequestId}/presence`, {
        method: "DELETE",
      }).catch(() => {});
    };
  }, [pullRequestId, activeView, activeFile]);

  if (reviewers.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#1c1c1c] border border-praxd-border-soft select-none text-[11px]"
      title={`${reviewers.length} reviewer(s) active on this PR`}
    >
      <div className="flex items-center -space-x-1.5 overflow-hidden">
        {reviewers.slice(0, 3).map((r) => (
          <div key={r.userId} className="relative group">
            <img
              src={r.avatarUrl || "https://avatars.githubusercontent.com/u/1024025?v=4"}
              alt={r.username}
              className="w-5 h-5 rounded-full border border-black bg-neutral-800 object-cover"
            />
            {/* Active presence dot */}
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-black" />

            {/* Hover Tooltip showing user inspect status */}
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:flex flex-col z-50 p-2 bg-[#222222] border border-praxd-border text-[11px] text-white rounded shadow-xl whitespace-nowrap">
              <span className="font-semibold">@{r.username}</span>
              <span className="text-praxd-text-secondary text-[10.5px]">
                Viewing {r.activeView === "code" ? `Code: ${r.activeFile || "diff"}` : "Summary"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 text-[11px] text-praxd-text-secondary">
        <Eye className="w-3 h-3 text-emerald-400" />
        <span className="font-mono text-emerald-400 font-medium">{reviewers.length}</span>
      </div>
    </div>
  );
}
