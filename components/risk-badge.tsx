"use client";

import React, { useState } from "react";
import { ShieldCheck, AlertTriangle, Flame } from "lucide-react";
import { RiskScore, RiskTier } from "@/types/policy";

interface RiskBadgeProps {
  risk?: RiskScore | null;
  compact?: boolean;
}

export function RiskBadge({ risk, compact = false }: RiskBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!risk) {
    return null;
  }

  const { score, tier, label, factors } = risk;

  let colorClasses = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let icon = <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;

  if (tier === "high") {
    colorClasses = "bg-rose-500/10 text-rose-400 border-rose-500/20";
    icon = <Flame className="w-3.5 h-3.5 text-rose-400" />;
  } else if (tier === "medium") {
    colorClasses = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  }

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium cursor-help transition-colors ${colorClasses}`}
        aria-label={`Risk assessment: ${label}, Score: ${score}/100`}
      >
        {icon}
        <span>{compact ? `${score}/100` : label}</span>
        {!compact && (
          <span className="text-[10px] opacity-75 font-mono">({score})</span>
        )}
      </div>

      {showTooltip && factors && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-64 p-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl text-xs text-zinc-300 pointer-events-none">
          <div className="font-semibold text-zinc-100 mb-2 flex items-center justify-between">
            <span>PR Blast Radius</span>
            <span className="font-mono text-xs">{score}/100</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-zinc-400">Churn Volume ({factors.totalLinesChanged} lines):</span>
              <span className="font-mono">{factors.churnScore}/25 pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Core Modules ({factors.criticalFilesTouched.length}):</span>
              <span className="font-mono">{factors.blastRadiusScore}/25 pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Dependencies:</span>
              <span className="font-mono">
                {factors.dependenciesTouched.length > 0 ? "15/15 pts" : "0/15 pts"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Test Coverage:</span>
              <span className="font-mono">
                {factors.hasTests ? "0 pts (tested)" : "15 pts (untested)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Security Findings:</span>
              <span className="font-mono">{factors.findingsScore}/20 pts</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
