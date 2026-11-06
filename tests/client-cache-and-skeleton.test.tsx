import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  getCachedPullRequests,
  setCachedPullRequests,
  getCachedPrDetail,
  setCachedPrDetail,
  getCachedLiveMode,
  setCachedLiveMode,
} from "@/lib/client-cache";
import { DiffSkeleton } from "@/components/diff/diff-skeleton";
import { SummarySkeleton } from "@/components/summary/summary-skeleton";
import { CodeView } from "@/components/code-view";
import { SummaryView } from "@/components/summary-view";
import { FIXTURE_PULL_REQUESTS } from "@/lib/fixtures/pull-requests";

function createStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

describe("Client Cache & Diff Skeleton Verification Suite", () => {
  let mockLocal: ReturnType<typeof createStorageMock>;
  let mockSession: ReturnType<typeof createStorageMock>;

  beforeEach(() => {
    mockLocal = createStorageMock();
    mockSession = createStorageMock();
    Object.defineProperty(window, "localStorage", { value: mockLocal, writable: true });
    Object.defineProperty(window, "sessionStorage", { value: mockSession, writable: true });
    vi.restoreAllMocks();
  });

  it("1. Persists and retrieves pull requests list in localStorage", () => {
    expect(getCachedPullRequests()).toBeNull();

    setCachedPullRequests(FIXTURE_PULL_REQUESTS);
    const cached = getCachedPullRequests();
    expect(cached).not.toBeNull();
    expect(cached?.length).toBe(FIXTURE_PULL_REQUESTS.length);
    expect(cached?.[0].title).toBe(FIXTURE_PULL_REQUESTS[0].title);
  });

  it("2. Persists and retrieves PR detail with files in sessionStorage and localStorage", () => {
    const prWithFiles = FIXTURE_PULL_REQUESTS[0];
    expect(getCachedPrDetail(prWithFiles.id)).toBeNull();

    setCachedPrDetail(prWithFiles);
    const cached = getCachedPrDetail(prWithFiles.id);
    expect(cached).not.toBeNull();
    expect(cached?.id).toBe(prWithFiles.id);
    expect(cached?.files.length).toBe(prWithFiles.files.length);
  });

  it("3. Persists and toggles Live Mode preference", () => {
    expect(getCachedLiveMode()).toBeNull();

    setCachedLiveMode(true);
    expect(getCachedLiveMode()).toBe(true);

    setCachedLiveMode(false);
    expect(getCachedLiveMode()).toBe(false);
  });

  it("4. Renders DiffSkeleton with accessible status and shimmering lines", () => {
    render(<DiffSkeleton count={3} />);

    const skeleton = screen.getByRole("status", { name: /loading pull request diff/i });
    expect(skeleton).toBeInTheDocument();
    expect(screen.getByText("Loading file diffs...")).toBeInTheDocument();
  });

  it("5. CodeView displays DiffSkeleton when isLoadingDiff is true, avoiding 'No file diffs' flicker", () => {
    const emptyPr = {
      ...FIXTURE_PULL_REQUESTS[0],
      files: [],
    };

    // When isLoadingDiff is true: shows skeleton instead of "No file diffs"
    const { rerender } = render(<CodeView pr={emptyPr} isLoadingDiff={true} />);
    expect(screen.getByRole("status", { name: /loading pull request diff/i })).toBeInTheDocument();
    expect(screen.queryByText(/No file diffs to display/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Loading diff.../i)).toBeInTheDocument();

    // When loaded: files rendered without skeleton
    rerender(<CodeView pr={FIXTURE_PULL_REQUESTS[0]} isLoadingDiff={false} />);
    expect(screen.queryByRole("status", { name: /loading pull request diff/i })).not.toBeInTheDocument();
  });

  it("6. Renders SummarySkeleton with accessible status and shimmering sections", () => {
    render(<SummarySkeleton />);

    const skeleton = screen.getByRole("status", { name: /loading pull request summary/i });
    expect(skeleton).toBeInTheDocument();
    expect(screen.getByText("Loading pull request summary...")).toBeInTheDocument();
  });

  it("7. SummaryView displays SummarySkeleton when isLoading is true", () => {
    const samplePr = FIXTURE_PULL_REQUESTS[0];

    const { rerender } = render(<SummaryView pr={samplePr} isLoading={true} />);
    expect(screen.getByRole("status", { name: /loading pull request summary/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit description" })).not.toBeInTheDocument();

    // When loaded: full summary rendered
    rerender(<SummaryView pr={samplePr} isLoading={false} />);
    expect(screen.queryByRole("status", { name: /loading pull request summary/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: samplePr.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit description" })).toBeInTheDocument();
  });
});
