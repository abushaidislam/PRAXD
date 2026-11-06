"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { PullRequest } from "@/types/pr";
import { FIXTURE_PULL_REQUESTS } from "@/lib/fixtures/pull-requests";
import {
  getCachedPullRequests,
  setCachedPullRequests,
  getCachedPrDetail,
  setCachedPrDetail,
  getCachedLiveMode,
  setCachedLiveMode,
} from "@/lib/client-cache";
import { createClient } from "@/lib/supabase/client";
import { mapDbPrToDomain } from "@/lib/github/mapper";
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
  const isTestEnv = process.env.NODE_ENV === "test";

  const [isLiveMode, setIsLiveMode] = useState<boolean>(() => {
    if (isTestEnv) return false;
    const cachedLive = getCachedLiveMode();
    return cachedLive !== null ? cachedLive : true;
  });

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Initialize with cached PRs in the browser for instant 0ms load; Vitest uses fixtures synchronously
  const [pullRequests, setPullRequests] = useState<PullRequest[]>(() => {
    if (isTestEnv) return FIXTURE_PULL_REQUESTS;
    const cached = getCachedPullRequests();
    return cached && cached.length > 0 ? cached : [];
  });

  const [selectedPr, setSelectedPr] = useState<PullRequest | null>(() => {
    if (isTestEnv) return FIXTURE_PULL_REQUESTS[0];
    const cached = getCachedPullRequests();
    if (cached && cached.length > 0) {
      const firstDetail = getCachedPrDetail(cached[0].id);
      return firstDetail || cached[0];
    }
    return null;
  });

  const [activeView, setActiveView] = useState<"summary" | "code">("code");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Initial loading only if we do not already have cached pull requests
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(() => {
    if (isTestEnv) return false;
    const cached = getCachedPullRequests();
    return !cached || cached.length === 0;
  });

  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalPrCount, setTotalPrCount] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const prCacheRef = useRef<Map<string, PullRequest>>(new Map());

  // Automatically verify GitHub App connection & reconcile mode
  useEffect(() => {
    async function checkActiveInstallation() {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const installStatus = params.get("installation");
        if (installStatus === "success" || installStatus === "connected") {
          setIsLiveMode(true);
          setCachedLiveMode(true);
          return;
        }
      }

      try {
        const res = await fetch("/api/github/installations");
        if (res.ok) {
          const json = await res.json();
          if (json.installations && json.installations.length > 0) {
            setIsLiveMode(true);
            setCachedLiveMode(true);
            return;
          }
        }
        // If no installation exists and we have no cached PRs, fall back to fixture demo mode
        if (!isTestEnv) {
          const cached = getCachedPullRequests();
          if (!cached || cached.length === 0) {
            setIsLiveMode(false);
            setCachedLiveMode(false);
            setPullRequests(FIXTURE_PULL_REQUESTS);
            setSelectedPr(FIXTURE_PULL_REQUESTS[0]);
            setIsLoadingLive(false);
          }
        }
      } catch {
        // Fall back to fixture mode if network or auth error
        if (!isTestEnv) {
          const cached = getCachedPullRequests();
          if (!cached || cached.length === 0) {
            setIsLiveMode(false);
            setCachedLiveMode(false);
            setPullRequests(FIXTURE_PULL_REQUESTS);
            setSelectedPr(FIXTURE_PULL_REQUESTS[0]);
            setIsLoadingLive(false);
          }
        }
      }
    }

    checkActiveInstallation();
  }, [isTestEnv]);

  // Fetch live pull requests when Live Mode is active (Stale-While-Revalidate)
  useEffect(() => {
    if (!isLiveMode) {
      setPullRequests(FIXTURE_PULL_REQUESTS);
      setSelectedPr(FIXTURE_PULL_REQUESTS[0]);
      setIsLoadingLive(false);
      return;
    }

    async function loadLivePrs() {
      // If no cached PRs exist, indicate live loading
      if (pullRequests.length === 0) {
        setIsLoadingLive(true);
      }

      try {
        const res = await fetch("/api/pull-requests?state=all&limit=24&page=1");
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setPullRequests(json.data);
            setCachedPullRequests(json.data);
            setPage(1);
            setHasMore(json.pagination?.hasMore || false);
            setTotalPrCount(json.pagination?.total || json.data.length);

            // Select first PR if nothing is selected or if previous selection wasn't in list
            const currentSelectedId = selectedPr?.id;
            const targetPr = currentSelectedId
              ? json.data.find((p: PullRequest) => p.id === currentSelectedId) || json.data[0]
              : json.data[0];

            // Check if full PR detail is in memory or disk cache
            const cachedDetail =
              prCacheRef.current.get(targetPr.id) || getCachedPrDetail(targetPr.id);

            if (cachedDetail && cachedDetail.files && cachedDetail.files.length > 0) {
              prCacheRef.current.set(cachedDetail.id, cachedDetail);
              setSelectedPr(cachedDetail);
            } else {
              setSelectedPr(targetPr);
              // Fetch details for target PR if needed
              const needsFiles = !targetPr.files || targetPr.files.length === 0;
              const needsComments =
                (targetPr.commentsCount ?? 0) > 0 && (!targetPr.comments || targetPr.comments.length === 0);
              const needsCommits = !targetPr.commits || targetPr.commits.length === 0;
              const needsChecks = !targetPr.checks || targetPr.checks.length === 0;
              const needsSummary = needsComments || needsCommits || needsChecks;

              if (needsFiles || needsSummary) {
                if (needsFiles) {
                  setIsLoadingDiff(true);
                }
                if (needsSummary) {
                  setIsLoadingSummary(true);
                }
                try {
                  const detailRes = await fetch(`/api/pull-requests/${targetPr.id}`);
                  if (detailRes.ok) {
                    const detailJson = await detailRes.json();
                    const loadedPr = detailJson?.data?.id
                      ? detailJson.data
                      : detailJson?.id
                      ? detailJson
                      : null;
                    if (loadedPr) {
                      prCacheRef.current.set(loadedPr.id, loadedPr);
                      setCachedPrDetail(loadedPr);
                      setSelectedPr(loadedPr);
                      setPullRequests((prev) =>
                        prev.map((item) => (item.id === loadedPr.id ? loadedPr : item))
                      );
                    }
                  }
                } catch {
                  // Ignore detail fetch error
                } finally {
                  if (needsFiles) {
                    setIsLoadingDiff(false);
                  }
                  if (needsSummary) {
                    setIsLoadingSummary(false);
                  }
                }
              }
            }
          } else {
            setPullRequests([]);
            setSelectedPr(null);
          }
        }
      } catch {
        // Network or server error
      } finally {
        setIsLoadingLive(false);
      }
    }

    loadLivePrs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveMode]);

  // Realtime: Listen to new PR insertions in Supabase and automatically prepend to top
  useEffect(() => {
    if (!isLiveMode) return;

    let channel: any = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel("realtime:pull_requests")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "pull_requests",
          },
          (payload) => {
            if (payload.new) {
              const newPr = mapDbPrToDomain(payload.new);
              setPullRequests((prev) => {
                const exists = prev.some(
                  (p) =>
                    p.id === newPr.id ||
                    (p.number === newPr.number && p.repoName === newPr.repoName)
                );
                if (exists) return prev;
                const updated = [newPr, ...prev];
                setCachedPullRequests(updated);
                return updated;
              });
              setTotalPrCount((prev) => (prev !== null ? prev + 1 : null));
            }
          }
        )
        .subscribe();
    } catch {
      // Supabase realtime channel not supported or failed
    }

    return () => {
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {
          // Ignore
        }
      }
    };
  }, [isLiveMode]);

  // Window Focus & Periodic SWR Revalidation: Auto-prepend any newly discovered PRs
  useEffect(() => {
    if (!isLiveMode) return;

    async function checkForNewPrs() {
      try {
        const res = await fetch("/api/pull-requests?state=all&limit=10&page=1");
        if (!res.ok) return;
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setPullRequests((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newPrs = json.data.filter((p: PullRequest) => !existingIds.has(p.id));
            if (newPrs.length > 0) {
              const updated = [...newPrs, ...prev];
              setCachedPullRequests(updated);
              return updated;
            }
            return prev;
          });
          if (json.pagination?.total) {
            setTotalPrCount(json.pagination.total);
          }
        }
      } catch {
        // Silently ignore background poll errors
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForNewPrs();
      }
    };

    window.addEventListener("focus", checkForNewPrs);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = setInterval(checkForNewPrs, 30_000);

    return () => {
      window.removeEventListener("focus", checkForNewPrs);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [isLiveMode]);

  // Synchronize new pull requests from GitHub across all user repos
  const handleSyncPrs = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch("/api/pull-requests/sync", { method: "POST" });
      if (res.ok) {
        const listRes = await fetch("/api/pull-requests?state=all&limit=24&page=1");
        if (listRes.ok) {
          const json = await listRes.json();
          if (json.data && json.data.length > 0) {
            setPullRequests(json.data);
            setCachedPullRequests(json.data);
            setTotalPrCount(json.pagination?.total || json.data.length);
            setHasMore(json.pagination?.hasMore || false);
            setPage(1);

            // If no selected PR, select the top newly synced PR
            if (!selectedPr) {
              setSelectedPr(json.data[0]);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to sync pull requests:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, selectedPr]);

  // Load more pull requests for infinite scroll / pagination
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`/api/pull-requests?state=all&limit=24&page=${nextPage}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setPullRequests((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newPrs = json.data.filter((p: PullRequest) => !existingIds.has(p.id));
            const merged = [...prev, ...newPrs];
            setCachedPullRequests(merged);
            return merged;
          });
          setPage(nextPage);
          setHasMore(json.pagination?.hasMore || false);
          if (json.pagination?.total) setTotalPrCount(json.pagination.total);
        } else {
          setHasMore(false);
        }
      }
    } catch {
      // Keep existing prs
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page]);

  // Select PR with Instant Cached Diff or Shimmer Skeleton while Fetching
  const handleSelectPr = useCallback(async (pr: PullRequest) => {
    // 1. Check if fully loaded version exists in client-side memory cache
    const memCached = prCacheRef.current.get(pr.id);
    if (memCached && memCached.files && memCached.files.length > 0) {
      setSelectedPr(memCached);
      setIsLoadingDiff(false);
      setIsLoadingSummary(false);
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
      return;
    }

    // 2. Check if fully loaded version exists in browser storage cache
    const diskCached = getCachedPrDetail(pr.id);
    if (diskCached && diskCached.files && diskCached.files.length > 0) {
      prCacheRef.current.set(pr.id, diskCached);
      setSelectedPr(diskCached);
      setIsLoadingDiff(false);
      setIsLoadingSummary(false);
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
      return;
    }

    // 3. Otherwise: set summary PR immediately (so header title/repo update), but mark details as loading
    setSelectedPr(pr);

    // On mobile (< 768px), auto-collapse sidebar to show the selected PR workspace
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    const needsFiles = isLiveMode && (!pr.files || pr.files.length === 0);
    const needsComments =
      isLiveMode && (pr.commentsCount ?? 0) > 0 && (!pr.comments || pr.comments.length === 0);
    const needsCommits = isLiveMode && (!pr.commits || pr.commits.length === 0);
    const needsChecks = isLiveMode && (!pr.checks || pr.checks.length === 0);
    const needsSummary = needsComments || needsCommits || needsChecks;

    if (needsFiles || needsSummary) {
      if (needsFiles) {
        setIsLoadingDiff(true);
      }
      if (needsSummary) {
        setIsLoadingSummary(true);
      }
      try {
        const res = await fetch(`/api/pull-requests/${pr.id}`);
        if (res.ok) {
          const fullPr = await res.json();
          const loadedPr = fullPr?.data?.id ? fullPr.data : fullPr?.id ? fullPr : null;
          if (loadedPr) {
            prCacheRef.current.set(loadedPr.id, loadedPr);
            setCachedPrDetail(loadedPr);
            setSelectedPr(loadedPr);
            setPullRequests((prev) =>
              prev.map((item) => (item.id === pr.id ? loadedPr : item))
            );
          }
        }
      } catch {
        // Keep existing pr
      } finally {
        if (needsFiles) {
          setIsLoadingDiff(false);
        }
        if (needsSummary) {
          setIsLoadingSummary(false);
        }
      }
    } else {
      setIsLoadingDiff(false);
      setIsLoadingSummary(false);
    }
  }, [isLiveMode]);

  // Update selected PR fields in local state
  const handleUpdatePr = useCallback((updates: Partial<PullRequest>) => {
    setSelectedPr((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      prCacheRef.current.set(next.id, next);
      setCachedPrDetail(next);
      setPullRequests((prs) => {
        const updated = prs.map((item) => (item.id === next.id ? next : item));
        setCachedPullRequests(updated);
        return updated;
      });
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
          onToggleMode={() => {
            const nextMode = !isLiveMode;
            setIsLiveMode(nextMode);
            setCachedLiveMode(nextMode);
          }}
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
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            totalCount={totalPrCount}
            onSync={handleSyncPrs}
            isSyncing={isSyncing}
            isLoading={isLoadingLive && pullRequests.length === 0}
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
              {isLoadingLive && pullRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-praxd-text-muted space-y-3">
                  <BrandLogo size="xl" className="animate-pulse opacity-85" />
                  <p className="text-[13px] animate-pulse">Syncing pull requests from GitHub...</p>
                </div>
              ) : selectedPr ? (
                activeView === "summary" ? (
                  <SummaryView
                    pr={selectedPr}
                    onUpdatePr={handleUpdatePr}
                    isLoading={isLoadingSummary}
                  />
                ) : (
                  <CodeView pr={selectedPr} isLoadingDiff={isLoadingDiff} />
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
