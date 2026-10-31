"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Server,
  Shield,
  Trash2,
  Check,
  AlertCircle,
  Database,
  Lock,
  RefreshCw,
  Cpu,
} from "lucide-react";
import { WorkspaceGovernanceSettings, AIProviderType } from "@/types/governance";

interface GovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
}

export function GovernanceModal({ isOpen, onClose, workspaceId = "current" }: GovernanceModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [primaryProvider, setPrimaryProvider] = useState<AIProviderType>("fallback");
  const [modelName, setModelName] = useState("");
  const [retentionDays, setRetentionDays] = useState(60);
  const [zeroDataRetention, setZeroDataRetention] = useState(false);
  const [autoPurgeEnabled, setAutoPurgeEnabled] = useState(true);

  // Self-hosted config
  const [selfHostedBaseUrl, setSelfHostedBaseUrl] = useState("");
  const [selfHostedApiKey, setSelfHostedApiKey] = useState("");
  const [requireTls, setRequireTls] = useState(true);

  // Purge actions
  const [isPurgingDiffs, setIsPurgingDiffs] = useState(false);
  const [purgeDiffsSuccess, setPurgeDiffsSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadSettings() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/governance/settings");
        if (res.ok) {
          const json = await res.json();
          const settings: WorkspaceGovernanceSettings = json.settings || json.data?.settings;
          if (settings) {
            setPrimaryProvider(settings.primaryProvider || "fallback");
            setModelName(settings.modelName || "");
            setRetentionDays(settings.retentionDays ?? 60);
            setZeroDataRetention(!!settings.zeroDataRetention);
            setAutoPurgeEnabled(settings.autoPurgeEnabled ?? true);
            if (settings.selfHosted) {
              setSelfHostedBaseUrl(settings.selfHosted.baseUrl || "");
              setSelfHostedApiKey(settings.selfHosted.apiKey || "");
              setRequireTls(settings.selfHosted.requireTls !== false);
            }
          }
        }
      } catch (err: any) {
        console.error("Failed to load governance settings:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/governance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryProvider,
          modelName,
          retentionDays,
          zeroDataRetention,
          autoPurgeEnabled,
          selfHosted: selfHostedBaseUrl
            ? {
                baseUrl: selfHostedBaseUrl.trim(),
                apiKey: selfHostedApiKey.trim() || null,
                requireTls,
              }
            : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${res.status}`);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to update governance settings.");
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeDiffs = async () => {
    setIsPurgingDiffs(true);
    setPurgeDiffsSuccess(null);
    try {
      const res = await fetch("/api/governance/retention/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retentionDays }),
      });
      if (res.ok) {
        const json = await res.json();
        const r = json.result || json.data?.result;
        setPurgeDiffsSuccess(
          `Purged ${r.prunedDiffsCount} diffs across ${r.affectedPullRequestsCount} PRs.`
        );
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to execute patch purge.");
    } finally {
      setIsPurgingDiffs(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Multi-Model Adapter & Enterprise Governance
              </h3>
              <p className="text-xs text-zinc-400">
                Configure provider failover chains, self-hosting TLS, and SOC2 retention policies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-zinc-300">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* AI Provider Selector */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2 flex items-center justify-between">
              <span>Primary AI Inference Provider</span>
              <span className="text-[11px] text-zinc-500">Zero code refactoring to switch</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              {[
                { id: "fallback", name: "Fallback Chain", sub: "Anthropic → Gemini → OpenAI" },
                { id: "anthropic", name: "Anthropic Claude", sub: "Claude 3.7 Sonnet / Haiku" },
                { id: "gemini", name: "Google Gemini", sub: "Gemini 2.5 Flash / Pro" },
                { id: "openai", name: "OpenAI", sub: "GPT-4o / GPT-4o-mini" },
                { id: "selfhosted", name: "Self-Hosted / On-Prem", sub: "Ollama / vLLM / Azure" },
                { id: "deterministic", name: "Deterministic", sub: "Offline AST Rule Engine" },
              ].map((p) => (
                <div
                  key={p.id}
                  onClick={() => setPrimaryProvider(p.id as AIProviderType)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    primaryProvider === p.id
                      ? "border-emerald-500 bg-emerald-500/10 text-zinc-100"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <div className="font-medium text-zinc-200">{p.name}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{p.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Self-Hosted Settings (when selected or configured) */}
          {(primaryProvider === "selfhosted" || selfHostedBaseUrl) && (
            <div className="p-4 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>Self-Hosted Endpoint Configuration</span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  OpenAI-Compatible Base URL
                </label>
                <input
                  type="url"
                  value={selfHostedBaseUrl}
                  onChange={(e) => setSelfHostedBaseUrl(e.target.value)}
                  placeholder="https://vllm.internal.company.com/v1"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    API Key / Bearer Token (Optional)
                  </label>
                  <input
                    type="password"
                    value={selfHostedApiKey}
                    onChange={(e) => setSelfHostedApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-5">
                  <div className="text-[11px] text-zinc-300 font-medium">Require TLS (HTTPS)</div>
                  <input
                    type="checkbox"
                    checked={requireTls}
                    onChange={(e) => setRequireTls(e.target.checked)}
                    className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Data Retention & Privacy Controls */}
          <div className="space-y-4 pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Database className="w-4 h-4 text-blue-400" />
              <span>Data Retention & Zero-Data-Retention (ZDR)</span>
            </div>

            {/* Zero-Data-Retention Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-zinc-950/40 border border-zinc-800/80 rounded-lg">
              <div>
                <div className="font-medium text-zinc-200 text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zero-Data-Retention (ZDR) Enforcement</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Transmits ZDR headers to AI providers and prevents persisting diff hunks to PostgreSQL.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={zeroDataRetention}
                  onChange={(e) => setZeroDataRetention(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Retention Window */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-medium text-zinc-300">Diff Cache Retention Window</span>
                <span className="font-mono text-zinc-400">
                  {retentionDays === 0 ? "Retain Indefinitely" : `${retentionDays} Days`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="30"
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                <span>Indefinite</span>
                <span>30 Days</span>
                <span>60 Days</span>
                <span>90 Days</span>
              </div>
            </div>

            {/* Manual Patch Purge Button */}
            <div className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-lg text-xs">
              <div>
                <div className="text-zinc-200 font-medium">Patch Purge Maintenance</div>
                <div className="text-[11px] text-zinc-400">
                  Permanently wipe diff caches for closed/merged PRs older than {retentionDays} days.
                </div>
              </div>
              <button
                type="button"
                onClick={handlePurgeDiffs}
                disabled={isPurgingDiffs}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPurgingDiffs ? "animate-spin" : ""}`} />
                <span>{isPurgingDiffs ? "Purging..." : "Purge Expired"}</span>
              </button>
            </div>

            {purgeDiffsSuccess && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs">
                {purgeDiffsSuccess}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Complies with SOC2 CC6.1, ISO 27001, and least-privilege enterprise governance.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  Saved
                </>
              ) : saving ? (
                "Saving..."
              ) : (
                "Save Governance Settings"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
