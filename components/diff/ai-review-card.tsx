import React, { useState } from "react";
import { Sparkles, ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { AIFinding } from "@/types/pr";
import { cn } from "@/lib/utils";

interface AIReviewCardProps {
  finding: AIFinding;
}

export function AIReviewCard({ finding }: AIReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const severityBadge = {
    critical: "bg-praxd-red/15 text-praxd-red border-praxd-red/30",
    warning: "bg-praxd-amber/15 text-praxd-amber border-praxd-amber/30",
    suggestion: "bg-praxd-blue/15 text-praxd-blue border-praxd-blue/30",
    info: "bg-neutral-800 text-praxd-text-secondary border-praxd-border",
  }[finding.severity];

  const SeverityIcon = {
    critical: AlertCircle,
    warning: AlertTriangle,
    suggestion: Sparkles,
    info: Info,
  }[finding.severity];

  return (
    <div className="my-2 mx-4 rounded-lg bg-[#181818] border border-praxd-border-soft overflow-hidden shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#202020] border-b border-praxd-border-soft text-[12px]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-praxd-blue font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PRAXD AI Review</span>
          </div>
          <span
            className={cn(
              "px-1.5 py-0.2 rounded text-[10px] font-medium border uppercase tracking-wider",
              severityBadge
            )}
          >
            {finding.severity}
          </span>
          <span className="text-[11px] text-praxd-text-muted font-mono">
            {Math.round(finding.confidence * 100)}% confidence
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-praxd-text-muted hover:text-praxd-text transition-colors"
          aria-label={isExpanded ? "Collapse finding" : "Expand finding"}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="p-3 text-[12px] space-y-2.5">
          <div className="flex items-start gap-2">
            <SeverityIcon className="w-4 h-4 text-praxd-amber shrink-0 mt-0.5" />
            <p className="font-semibold text-praxd-text leading-snug">{finding.title}</p>
          </div>

          <p className="text-praxd-text-secondary pl-6 leading-relaxed">
            {finding.explanation}
          </p>

          {finding.suggestedFix && (
            <div className="ml-6 p-2 rounded bg-[#121212] border border-praxd-border-soft font-mono text-[11px] text-praxd-green">
              <span className="text-praxd-text-muted select-none">Suggested fix: </span>
              <span>{finding.suggestedFix}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
