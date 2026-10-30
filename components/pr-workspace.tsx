"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PullRequest } from "@/types/pr";
import { FIXTURE_PULL_REQUESTS } from "@/lib/fixtures/pull-requests";
import { PullRequestSidebar } from "./pull-request-sidebar";
import { WorkspaceHeader } from "./workspace-header";
import { SummaryView } from "./summary-view";
import { CodeView } from "./code-view";
import { DemoModeBadge } from "./demo-mode-badge";

export function PRWorkspace() {
  const [pullRequests] = useState<PullRequest[]>(FIXTURE_PULL_REQUESTS);
  const [selectedPr, setSelectedPr] = useState<PullRequest>(FIXTURE_PULL_REQUESTS[0]);
  const [activeView, setActiveView] = useState<"summary" | "code">("code");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Keyboard shortcut listener: Cmd/Ctrl + B to toggle sidebar
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      setIsSidebarOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-praxd-bg text-praxd-text antialiased font-sans">
      {/* Demo Mode Notice Badge */}
      <DemoModeBadge />

      {/* Main Dual-Pane Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left PR Inbox Sidebar */}
        <PullRequestSidebar
          pullRequests={pullRequests}
          selectedPr={selectedPr}
          onSelectPr={(pr) => setSelectedPr(pr)}
          isOpen={isSidebarOpen}
          onToggleOpen={() => setIsSidebarOpen(false)}
        />

        {/* Right Main Workspace */}
        <main
          className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-praxd-bg"
          aria-label="Pull request workspace"
        >
          {/* Main Top Header */}
          <WorkspaceHeader
            pr={selectedPr}
            activeView={activeView}
            onViewChange={setActiveView}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(true)}
          />

          {/* Workspace Body: Summary or Code */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {selectedPr ? (
              activeView === "summary" ? (
                <SummaryView pr={selectedPr} />
              ) : (
                <CodeView pr={selectedPr} />
              )
            ) : (
              <div className="h-full flex items-center justify-center text-praxd-text-muted">
                <p className="text-[13px]">Select a pull request from the left inbox to view details.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
