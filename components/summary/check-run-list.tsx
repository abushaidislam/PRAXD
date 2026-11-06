import React, { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, XCircle, Clock, ExternalLink } from "lucide-react";
import { CheckRun } from "@/types/pr";

interface CheckRunListProps {
  checks: CheckRun[];
}

export function CheckRunList({ checks }: CheckRunListProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!checks || checks.length === 0) {
    return null;
  }

  const passedCount = checks.filter((c) => c.conclusion === "success").length;

  return (
    <div className="space-y-2 border-t border-praxd-border-soft pt-4 select-text">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-[14px] font-medium text-praxd-text hover:text-white transition-colors rounded-md px-1 py-0.5 -mx-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue"
        aria-expanded={isExpanded}
        aria-controls="check-run-list-items"
        aria-label={`Checks: ${passedCount} of ${checks.length} passed. Click to ${isExpanded ? "collapse" : "expand"}`}
      >
        <span>Checks</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-praxd-text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-praxd-text-muted" />
        )}
        <span className="text-[12px] text-praxd-text-muted font-normal ml-0.5">
          ({passedCount}/{checks.length} passed)
        </span>
      </button>

      {isExpanded && (
        <div id="check-run-list-items" className="space-y-1.5 pt-1">
          {checks.map((check) => (
            <div
              key={check.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#181818] border border-praxd-border-soft text-[12px] hover:border-praxd-border transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {check.conclusion === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-praxd-green shrink-0" />
                ) : check.conclusion === "failure" ? (
                  <XCircle className="w-4 h-4 text-praxd-red shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-praxd-amber shrink-0" />
                )}
                <span className="font-medium text-praxd-text truncate">{check.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-praxd-text-muted text-[11px] capitalize">
                  {check.conclusion === "success" ? "Passed" : check.conclusion || "Pending"}
                </span>
                {check.detailsUrl && (
                  <a
                    href={check.detailsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-[#252525] text-praxd-text-muted hover:text-praxd-text transition-colors"
                    title="View check details on GitHub"
                    aria-label={`View details for ${check.name}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
