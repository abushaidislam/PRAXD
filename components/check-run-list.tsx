import React, { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, XCircle, Clock } from "lucide-react";
import { CheckRun } from "@/types/pr";

interface CheckRunListProps {
  checks: CheckRun[];
}

export function CheckRunList({ checks }: CheckRunListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!checks || checks.length === 0) {
    return null;
  }

  const allPassed = checks.every((c) => c.conclusion === "success");

  return (
    <div className="space-y-2 border-t border-praxd-border-soft pt-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-[14px] font-medium text-praxd-text hover:text-white transition-colors"
        aria-expanded={isExpanded}
      >
        <span>Checks</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-praxd-text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-praxd-text-muted" />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-1.5 pt-1">
          {checks.map((check) => (
            <div
              key={check.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px] hover:border-praxd-border transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {check.conclusion === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-praxd-green shrink-0" />
                ) : check.conclusion === "failure" ? (
                  <XCircle className="w-4 h-4 text-praxd-red shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-praxd-amber shrink-0" />
                )}
                <span className="font-medium text-praxd-text">{check.name}</span>
              </div>
              <span className="text-praxd-text-muted text-[11px] capitalize">
                {check.conclusion === "success" ? "Passed" : check.conclusion || "Pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
