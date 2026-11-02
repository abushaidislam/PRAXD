"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PullRequest } from "@/types/pr";
import { FIXTURE_PULL_REQUESTS } from "@/lib/fixtures/pull-requests";
import { PullRequestSidebar } from "../pull-request-sidebar";
import { WorkspaceHeader } from "../workspace-header";
import { SummaryView } from "../summary-view";
import { CodeView } from "../code-view";
import { DemoModeBadge } from "../demo-mode-badge";
import { GitHubConnectModal } from "../github-connect-modal";
import { KeyboardShortcutsModal } from "../keyboard-shortcuts-modal";
import { ToastProvider } from "../toast";
import { BrandLogo } from "../brand-logo";
import { cn } from "@/lib/utils";
import { useWorkspaceShortcuts } from "@/hooks/use-workspace-shortcuts";

export function PRWorkspace() {
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>(FIXTURE_PULL_REQUESTS);
  const [selectedPr, setSelectedPr] = useState<PullRequest>(FIXTURE_PULL_REQUESTS[0]);
  const [activeView, setActiveView] = useState<"summary" | "code">("code");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  // Automatically switch to Live Mode if GitHub App is connected or redirected
  useEffect(() => {
    async function checkActiveInstallation() {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const installStatus = params.get("installation");
        if (installStatus === "success" || installStatus === "connected") {
          setIsLiveMode(true);
          return;
        }
      }

      try {
        const res = await fetch("/api/github/installations");
        if (res.ok) {
          const json = await res.json();
          if (json.installations && json.installations.length > 0) {
            setIsLiveMode(true);
          }
        }
      } catch {
        // Fall back to fixture mode
      }
    }

    checkActiveInstallation();
  }, []);

  // Fetch live pull requests when Live Mode is active
  useEffect(() => {
    if (!isLiveMode) {
      setPullRequests(FIXTURE_PULL_REQUESTS);
      setSelectedPr(FIXTURE_PULL_REQUESTS[0]);
      return;
    }

    async function loadLivePrs() {
      setIsLoadingLive(true);
      try {
        const res = await fetch("/api/pull-requests?state=all");
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setPullRequests(json.data);
            setSelectedPr(json.data[0]);

            // If the first PR files or comments need loading, fetch its details
            const firstPr = json.data[0];
            const firstNeedsFiles = !firstPr.files || firstPr.files.length === 0;
            const firstNeedsComments =
              (firstPr.commentsCount ?? 0) > 0 && (!firstPr.comments || firstPr.comments.length === 0);
            if (firstNeedsFiles || firstNeedsComments) {
              try {
                const detailRes = await fetch(`/api/pull-requests/${firstPr.id}`);
                if (detailRes.ok) {
                  const detailJson = await detailRes.json();
                  if (detailJson.data) {
                    setSelectedPr(detailJson.data);
                    setPullRequests((prev) =>
                      prev.map((item, idx) => (idx === 0 ? detailJson.data : item))
                    );
                  }
                }
              } catch {
                // Ignore detail fetch error
              }
            }
          } else {
            setPullRequests([]);
          }
        }
      } catch {
        // Network or server error
      } finally {
        setIsLoadingLive(false);
      }
    }

    loadLivePrs();
  }, [isLiveMode]);

  // Select PR and lazily fetch files/diff and comments if not yet loaded
  const handleSelectPr = useCallback(async (pr: PullRequest) => {
    setSelectedPr(pr);

    // On mobile (< 768px), auto-collapse sidebar to show the selected PR workspace
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    const needsFiles = !pr.files || pr.files.length === 0;
    const needsComments = (pr.commentsCount ?? 0) > 0 && (!pr.comments || pr.comments.length === 0);
    if (needsFiles || needsComments) {
      try {
        const res = await fetch(`/api/pull-requests/${pr.id}`);
        if (res.ok) {
          const fullPr = await res.json();
          if (fullPr && fullPr.data) {
            setSelectedPr(fullPr.data);
            setPullRequests((prev) =>
              prev.map((item) => (item.id === pr.id ? fullPr.data : item))
            );
          }
        }
      } catch {
        // Keep existing pr
      }
    }
  }, []);

  // Update selected PR fields in local state
  const handleUpdatePr = useCallback((updates: Partial<PullRequest>) => {
    setSelectedPr((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      setPullRequests((prs) => prs.map((item) => (item.id === next.id ? next : item)));
      return next;
    });
  }, []);

  // Global Workspace Keyboard Shortcuts via Custom Hook
  useWorkspaceShortcuts({
    onToggleSidebar: () => setIsSidebarOpen((prev) => !prev),
    onSelectSummaryView: () => setActiveView("summary"),
    onSelectCodeView: () => setActiveView("code"),
    onOpenShortcutsModal: () => setIsShortcutsOpen(true),
  });

  return (
    <ToastProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-praxd-bg text-praxd-text antialiased font-sans">
        {/* Workspace Connection Notice Badge */}
        <DemoModeBadge
          isLiveMode={isLiveMode}
          onToggleMode={() => setIsLiveMode(!isLiveMode)}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
        />

        {/* GitHub Connect Modal */}
        <GitHubConnectModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
        />

        {/* Keyboard Shortcuts Cheatsheet Modal */}
        <KeyboardShortcutsModal
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />

        {/* Main Dual-Pane Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Left PR Inbox Sidebar */}
          <PullRequestSidebar
            pullRequests={pullRequests}
            selectedPr={selectedPr}
            onSelectPr={handleSelectPr}
            isOpen={isSidebarOpen}
            onToggleOpen={() => setIsSidebarOpen(false)}
          />

          {/* Right Main Workspace */}
          <main
            className={cn(
              "flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-praxd-bg",
              isSidebarOpen && "hidden md:flex"
            )}
            aria-label="Pull request workspace"
          >
            {/* Main Top Header */}
            <WorkspaceHeader
              pr={selectedPr}
              activeView={activeView}
              onViewChange={setActiveView}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(true)}
              onMergeSuccess={() => handleUpdatePr({ state: "merged" })}
              onOpenShortcuts={() => setIsShortcutsOpen(true)}
            />

            {/* Workspace Body: Summary or Code */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {isLoadingLive ? (
                <div className="h-full flex flex-col items-center justify-center text-praxd-text-muted space-y-3">
                  <BrandLogo size="xl" className="animate-pulse opacity-85" />
                  <p className="text-[13px] animate-pulse">Syncing pull requests from GitHub...</p>
                </div>
              ) : selectedPr ? (
                activeView === "summary" ? (
                  <SummaryView pr={selectedPr} onUpdatePr={handleUpdatePr} />
                ) : (
                  <CodeView pr={selectedPr} />
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-praxd-text-muted space-y-3 p-6 text-center">
                  <BrandLogo size="2xl" className="mb-2 shadow-2xl" />
                  <p className="text-[14px] font-medium text-praxd-text">No pull requests found</p>
                  <p className="text-[12px] max-w-sm">
                    {isLiveMode
                      ? "Connect your GitHub App installation or sync a repository to populate this workspace."
                      : "Select a pull request from the left inbox."}
                  </p>
                  {isLiveMode && (
                    <button
                      type="button"
                      onClick={() => setIsConnectModalOpen(true)}
                      className="px-3 py-1.5 rounded bg-white text-black text-[12px] font-medium hover:bg-neutral-200 transition-colors"
                    >
                      Connect GitHub App
                    </button>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
