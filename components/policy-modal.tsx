"use client";

import React, { useState, useEffect } from "react";
import { X, Sliders, Shield, Bell, Check, AlertCircle, Plus, Trash2 } from "lucide-react";
import { RepositoryPolicy, ReviewProfile, NotificationThreshold } from "@/types/policy";

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  repositoryId?: string;
  repoName?: string;
}

export function PolicyModal({ isOpen, onClose, repositoryId = "default-repo", repoName = "Repository" }: PolicyModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoReviewEnabled, setAutoReviewEnabled] = useState(true);
  const [branches, setBranches] = useState("main, master, release/*");
  const [paths, setPaths] = useState("");
  const [reviewProfile, setReviewProfile] = useState<ReviewProfile>("comprehensive");
  const [customRules, setCustomRules] = useState<string[]>([]);
  const [newRuleText, setNewRuleText] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [notificationThreshold, setNotificationThreshold] = useState<NotificationThreshold>("high");

  useEffect(() => {
    if (!isOpen) return;

    async function loadPolicy() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/repositories/${repositoryId}/policy`);
        if (res.ok) {
          const json = await res.json();
          const policy: RepositoryPolicy = json.policy || json.data?.policy;
          if (policy) {
            setAutoReviewEnabled(policy.autoReviewEnabled);
            setBranches((policy.branches || []).join(", "));
            setPaths((policy.paths || []).join(", "));
            setReviewProfile(policy.reviewProfile || "comprehensive");
            setCustomRules(policy.customRules || []);
            setSlackWebhookUrl(policy.slackWebhookUrl || "");
            setDiscordWebhookUrl(policy.discordWebhookUrl || "");
            setNotificationThreshold(policy.notificationThreshold || "high");
          }
        }
      } catch (err: any) {
        console.error("Failed to load repository policy:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPolicy();
  }, [isOpen, repositoryId]);

  if (!isOpen) return null;

  const handleAddRule = () => {
    if (!newRuleText.trim()) return;
    if (customRules.length >= 10) {
      setError("Maximum of 10 custom rules allowed per repository.");
      return;
    }
    setCustomRules([...customRules, newRuleText.trim()]);
    setNewRuleText("");
  };

  const handleRemoveRule = (index: number) => {
    setCustomRules(customRules.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const branchesList = branches
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b.length > 0);

      const pathsList = paths
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const res = await fetch(`/api/repositories/${repositoryId}/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoReviewEnabled,
          branches: branchesList,
          paths: pathsList,
          reviewProfile,
          customRules,
          slackWebhookUrl: slackWebhookUrl.trim() || null,
          discordWebhookUrl: discordWebhookUrl.trim() || null,
          notificationThreshold,
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
      setError(err?.message || "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Automated Policy Engine & CI/CD Bot
              </h3>
              <p className="text-xs text-zinc-400">
                Configure autonomous review triggers and guardrails for {repoName}
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

          {/* Trigger Toggle */}
          <div className="flex items-center justify-between p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-lg">
            <div>
              <div className="font-medium text-zinc-200">Event-Driven CI/CD Bot Review</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Automatically triggers AI code inspection on <code className="text-blue-400">pull_request.opened</code> and <code className="text-blue-400">synchronize</code>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoReviewEnabled}
                onChange={(e) => setAutoReviewEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Branch & Path Filters */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Target Branches (comma-separated globs)
              </label>
              <input
                type="text"
                value={branches}
                onChange={(e) => setBranches(e.target.value)}
                placeholder="main, master, release/*"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">
                PRs targeting matching branches will be evaluated. Leave empty for all branches.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Target File Paths (comma-separated globs)
              </label>
              <input
                type="text"
                value={paths}
                onChange={(e) => setPaths(e.target.value)}
                placeholder="auth/**, migrations/**, src/security/**"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block">
                Only trigger review if changes match these path globs. Leave empty for all files.
              </span>
            </div>
          </div>

          {/* Review Profile */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">
              Review Focus Profile
            </label>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                {
                  id: "comprehensive",
                  title: "Comprehensive",
                  desc: "Balanced analysis across security, bugs, reliability and performance.",
                },
                {
                  id: "strict_security",
                  title: "Strict Security",
                  desc: "Focuses exclusively on OWASP flaws, auth bypasses, and untrusted inputs.",
                },
                {
                  id: "performance",
                  title: "Performance & Memory",
                  desc: "Focuses on runtime bottlenecks, memory leaks, and unindexed queries.",
                },
                {
                  id: "style",
                  title: "Style & Conventions",
                  desc: "Focuses on architecture coherence, naming standards, and clean code.",
                },
              ].map((p) => (
                <div
                  key={p.id}
                  onClick={() => setReviewProfile(p.id as ReviewProfile)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    reviewProfile === p.id
                      ? "border-blue-500 bg-blue-500/10 text-zinc-100"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <div className="font-medium text-zinc-200 mb-0.5">{p.title}</div>
                  <div className="text-[11px] leading-relaxed text-zinc-400">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Rules */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Custom Team Quality Rules ({customRules.length}/10)</span>
              <span className="text-[11px] text-zinc-500 font-normal">Sanitized on save</span>
            </label>
            
            <div className="space-y-2 mb-2">
              {customRules.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-lg text-xs"
                >
                  <span className="text-zinc-300 pr-2 leading-relaxed">{rule}</span>
                  <button
                    onClick={() => handleRemoveRule(idx)}
                    className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newRuleText}
                onChange={(e) => setNewRuleText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRule()}
                placeholder="e.g. Ensure all React hooks declare full dependencies array"
                className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddRule}
                disabled={!newRuleText.trim() || customRules.length >= 10}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

          {/* Webhook Notifications */}
          <div className="space-y-4 pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Slack & Discord Alert Webhooks</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Slack Incoming Webhook URL
                </label>
                <input
                  type="url"
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Discord Webhook URL
                </label>
                <input
                  type="url"
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Notification Severity Threshold
              </label>
              <select
                value={notificationThreshold}
                onChange={(e) => setNotificationThreshold(e.target.value as NotificationThreshold)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                <option value="high">Critical & High Findings Only (Recommended)</option>
                <option value="critical">Critical Findings Only</option>
                <option value="medium">Medium, High & Critical Findings</option>
                <option value="all">All Findings (Verbose)</option>
                <option value="none">Disable Webhook Notifications</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            PRAXD bot never auto-merges or publishes without manual human confirmation.
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  Saved
                </>
              ) : saving ? (
                "Saving..."
              ) : (
                "Save Policy"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
