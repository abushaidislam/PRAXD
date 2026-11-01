import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SummaryView } from "@/components/summary-view";
import { MergeModal } from "@/components/merge-modal";
import { ActivityTimeline } from "@/components/activity-timeline";
import { FIXTURE_PULL_REQUESTS } from "@/lib/fixtures/pull-requests";
import { PUT as mergePut } from "@/app/api/pull-requests/[pullRequestId]/merge/route";
import { PATCH as prPatch } from "@/app/api/pull-requests/[pullRequestId]/route";
import { POST as commentPost } from "@/app/api/pull-requests/[pullRequestId]/comments/route";
import { NextRequest } from "next/server";

// Mock Supabase Auth
vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedContext: vi.fn().mockResolvedValue({
    workspaceId: "ws-mock",
    userId: "user-mock",
    role: "admin",
  }),
}));

// Mock Supabase Server
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

describe("Personal PR Write Actions Suite", () => {
  const samplePr = FIXTURE_PULL_REQUESTS[0];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url, init) => {
      if (typeof url === "string" && url.includes("/comments") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              comment: {
                id: `c-test-${Date.now()}`,
                author: { login: "testuser", avatarUrl: "https://github.com/ghost.png" },
                body: body.body,
                createdAt: new Date().toISOString(),
                commentType: "issue",
              },
            },
          }),
        });
      }

      if (typeof url === "string" && url.includes("/merge") && init?.method === "PUT") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              merged: true,
              message: "Pull Request successfully merged",
              sha: "mock-sha-123",
            },
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ data: {} }),
      });
    });
  });

  describe("In-Place PR Title & Description Editing", () => {
    it("enters title edit mode, allows editing, and saves updated title", async () => {
      const handleUpdatePr = vi.fn();
      render(<SummaryView pr={samplePr} onUpdatePr={handleUpdatePr} />);

      const editTitleBtn = screen.getByRole("button", { name: /Edit title/i });
      fireEvent.click(editTitleBtn);

      const titleInput = screen.getByPlaceholderText(/Pull request title/i);
      expect(titleInput).toBeInTheDocument();
      expect(titleInput).toHaveValue(samplePr.title);

      fireEvent.change(titleInput, { target: { value: "Refactored Core Engine" } });

      const saveTitleBtn = screen.getByRole("button", { name: /Save title/i });
      fireEvent.click(saveTitleBtn);

      await waitFor(() => {
        expect(handleUpdatePr).toHaveBeenCalledWith({ title: "Refactored Core Engine" });
      });
    });

    it("enters description edit mode and saves updated description", async () => {
      const handleUpdatePr = vi.fn();
      render(<SummaryView pr={samplePr} onUpdatePr={handleUpdatePr} />);

      const editDescBtn = screen.getByRole("button", { name: /Edit description/i });
      fireEvent.click(editDescBtn);

      const descTextarea = screen.getByPlaceholderText(/Add a detailed description/i);
      expect(descTextarea).toBeInTheDocument();

      fireEvent.change(descTextarea, { target: { value: "New updated PR description." } });

      const saveDescBtn = screen.getByRole("button", { name: /Save Description/i });
      fireEvent.click(saveDescBtn);

      await waitFor(() => {
        expect(handleUpdatePr).toHaveBeenCalledWith({ body: "New updated PR description." });
      });
    });

    it("displays commentsCount in metadata when comments array is empty", () => {
      const prWithCount: PullRequest = {
        ...samplePr,
        commentsCount: 5,
        comments: [],
      };
      render(<SummaryView pr={prWithCount} />);
      expect(screen.getByText("5 comments")).toBeInTheDocument();
    });

    it("displays accurate singular comment count", () => {
      const prWithSingle: PullRequest = {
        ...samplePr,
        commentsCount: 1,
        comments: [],
      };
      render(<SummaryView pr={prWithSingle} />);
      expect(screen.getByText("1 comment")).toBeInTheDocument();
    });
  });

  describe("PR Conversation Comments", () => {
    it("submits a new comment and appends it to the timeline", async () => {
      const handleCommentAdded = vi.fn();
      render(<ActivityTimeline pr={samplePr} onCommentAdded={handleCommentAdded} />);

      const input = screen.getByPlaceholderText(/Leave a comment on this pull request/i);
      const submitBtn = screen.getByRole("button", { name: /Send comment/i });

      expect(submitBtn).toBeDisabled();

      fireEvent.change(input, { target: { value: "Looks great, ready to merge!" } });
      expect(submitBtn).toBeEnabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Looks great, ready to merge!")).toBeInTheDocument();
      });
    });

    it("switches between Write and Preview tabs in the comment composer", () => {
      render(<ActivityTimeline pr={samplePr} />);

      const input = screen.getByPlaceholderText(/Leave a comment on this pull request/i);
      fireEvent.change(input, { target: { value: "### Review Note\n\n- [x] Verified" } });

      const previewTab = screen.getByRole("button", { name: /Preview/i });
      fireEvent.click(previewTab);

      // In Preview tab, markdown should be rendered via MarkdownContent
      expect(screen.getByText("Review Note")).toBeInTheDocument();
      expect(screen.getByText("Verified")).toBeInTheDocument();

      const writeTab = screen.getByRole("button", { name: /Write/i });
      fireEvent.click(writeTab);
      expect(screen.getByPlaceholderText(/Leave a comment on this pull request/i)).toBeInTheDocument();
    });

    it("allows switching comment profile between personal and praxd-app[bot]", async () => {
      render(<ActivityTimeline pr={samplePr} />);

      const profileBtn = screen.getByRole("button", { name: /Select comment profile/i });
      expect(profileBtn).toBeInTheDocument();

      // Open profile dropdown
      fireEvent.click(profileBtn);

      const botOption = screen.getByRole("button", { name: /praxd-app\[bot\]/i });
      expect(botOption).toBeInTheDocument();

      fireEvent.click(botOption);

      // Now profile button should show praxd-app[bot]
      expect(screen.getByRole("button", { name: /Select comment profile/i })).toHaveTextContent("praxd-app[bot]");

      // Write and submit comment as bot
      const input = screen.getByPlaceholderText(/Leave a comment on this pull request/i);
      fireEvent.change(input, { target: { value: "Automated review finished." } });

      const submitBtn = screen.getByRole("button", { name: /Send comment/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Automated review finished.")).toBeInTheDocument();
      });
    });
  });

  describe("PR Merge Modal & Strategy Execution", () => {
    it("allows switching merge strategy between merge, squash, and rebase", () => {
      const onClose = vi.fn();
      const onMergeSuccess = vi.fn();

      render(
        <MergeModal
          pr={samplePr}
          isOpen={true}
          onClose={onClose}
          onMergeSuccess={onMergeSuccess}
        />
      );

      expect(screen.getByText(/Create a merge commit/i)).toBeInTheDocument();
      expect(screen.getByText(/Squash and merge/i)).toBeInTheDocument();
      expect(screen.getByText(/Rebase and merge/i)).toBeInTheDocument();

      const squashRadio = screen.getByLabelText(/Squash and merge/i);
      fireEvent.click(squashRadio);
      expect(squashRadio).toBeChecked();
    });

    it("triggers merge API call and executes onMergeSuccess callback", async () => {
      const onClose = vi.fn();
      const onMergeSuccess = vi.fn();

      render(
        <MergeModal
          pr={samplePr}
          isOpen={true}
          onClose={onClose}
          onMergeSuccess={onMergeSuccess}
        />
      );

      const confirmBtn = screen.getByRole("button", { name: /Confirm Merge/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(onMergeSuccess).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });

  describe("API Route Handlers (Merge, PATCH PR, POST Comments)", () => {
    it("PATCH /api/pull-requests/[pullRequestId] updates title successfully", async () => {
      const req = new NextRequest("http://localhost:3000/api/pull-requests/pr-123", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated via API" }),
      });

      const res = await prPatch(req, {
        params: Promise.resolve({ pullRequestId: "pr-123" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.title).toBe("Updated via API");
    });

    it("POST /api/pull-requests/[pullRequestId]/comments posts a comment successfully", async () => {
      const req = new NextRequest("http://localhost:3000/api/pull-requests/pr-123/comments", {
        method: "POST",
        body: JSON.stringify({ body: "API comment text" }),
      });

      const res = await commentPost(req, {
        params: Promise.resolve({ pullRequestId: "pr-123" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.comment.body).toBe("API comment text");
    });

    it("PUT /api/pull-requests/[pullRequestId]/merge merges successfully", async () => {
      const req = new NextRequest("http://localhost:3000/api/pull-requests/pr-123/merge", {
        method: "PUT",
        body: JSON.stringify({ mergeMethod: "squash" }),
      });

      const res = await mergePut(req, {
        params: Promise.resolve({ pullRequestId: "pr-123" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.merged).toBe(true);
      expect(json.mergeMethod).toBe("squash");
    });
  });
});
