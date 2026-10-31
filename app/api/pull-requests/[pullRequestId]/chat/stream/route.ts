import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchLivePullRequestDetails } from "@/lib/github/live";
import { FIXTURE_PULL_REQUESTS } from "@/lib/fixtures/pull-requests";
import { buildChatPromptContext } from "@/lib/ai/chat-context";
import { streamChatResponse } from "@/lib/ai/chat-stream";
import { chatStore } from "@/lib/ai/chat-store";
import { liveReviewsStore } from "@/lib/ai/lifecycle";
import { ChatCitation, ChatMessage, ChatStreamEvent, ChatStreamRequest } from "@/types/chat";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;

  // 1. Authenticate or fallback to demo workspace
  const auth = await getAuthenticatedContext();
  const workspaceId = auth?.workspaceId || "demo-workspace";

  let body: ChatStreamRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages = [], command, activeFile, activeLines } = body;
  const lastUserMsg = messages[messages.length - 1];

  if (!lastUserMsg || lastUserMsg.role !== "user") {
    return new Response(JSON.stringify({ error: "Last message must be from user" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Resolve PR metadata, files, and findings
  let repoFullName = "praxd/repository";
  let primaryLanguage = "TypeScript";
  let prNumber = 1;
  let prTitle = "Pull Request";
  let prBody: string | null = null;
  let authorLogin = "developer";
  let baseRef = "main";
  let headRef = "feature";
  let headSha = "0000000";
  let prState = "open";
  let files: Array<{
    filename: string;
    status: string;
    additions?: number;
    deletions?: number;
    patch?: string | null;
  }> = [];
  let findings: Array<{
    severity: string;
    title: string;
    filePath?: string | null;
    lineStart?: number | null;
    explanation?: string;
  }> = [];
  let checks: Array<{
    name: string;
    status: string;
    conclusion?: string | null;
  }> = [];

  // Check 2a: Live GitHub PR
  if (pullRequestId.startsWith("live__")) {
    const parts = pullRequestId.split("__");
    if (parts.length === 4) {
      const owner = parts[1];
      const repo = parts[2];
      const num = parseInt(parts[3], 10);
      const livePr = await fetchLivePullRequestDetails(owner, repo, num);
      if (livePr) {
        repoFullName = `${owner}/${repo}`;
        prNumber = livePr.number;
        prTitle = livePr.title;
        prBody = livePr.body;
        authorLogin = livePr.author.login;
        baseRef = livePr.baseRef;
        headRef = livePr.headRef;
        headSha = livePr.headSha;
        prState = livePr.state;
        files = (livePr.files || []).map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch || null,
        }));
        checks = (livePr.checks || []).map((c) => ({
          name: c.name,
          status: c.status,
          conclusion: c.conclusion || null,
        }));
      }

      // Check live review store for findings
      const liveData = liveReviewsStore.get(pullRequestId);
      if (liveData) {
        findings = liveData.findings.map((f) => ({
          severity: f.severity,
          title: f.title,
          filePath: f.file_path,
          lineStart: f.line_start,
          explanation: f.impact_summary,
        }));
      }
    }
  } else {
    // Check 2b: Fixture PRs
    const fixturePr = FIXTURE_PULL_REQUESTS.find(
      (p) => p.id === pullRequestId || String(p.number) === pullRequestId
    );

    if (fixturePr) {
      repoFullName = `${fixturePr.repoOwner}/${fixturePr.repoName}`;
      prNumber = fixturePr.number;
      prTitle = fixturePr.title;
      prBody = fixturePr.body;
      authorLogin = fixturePr.author.login;
      baseRef = fixturePr.baseRef;
      headRef = fixturePr.headRef;
      headSha = fixturePr.headSha;
      prState = fixturePr.state;
      files = (fixturePr.files || []).map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || null,
      }));
      checks = (fixturePr.checks || []).map((c) => ({
        name: c.name,
        status: c.status,
        conclusion: c.conclusion || null,
      }));
      findings = [
        {
          severity: "medium",
          title: "DOM XSS vulnerability on innerHTML assignment",
          filePath: "extension/content.js",
          lineStart: 1644,
          explanation: "Direct assignment to innerHTML without sanitization allows script injection.",
        },
      ];
    } else {
      // Check 2c: Database PR
      try {
        const supabase = createServiceRoleClient();
        const { data: dbPr } = await supabase
          .from("pull_requests")
          .select("*, repositories!inner(*)")
          .eq("id", pullRequestId)
          .maybeSingle();

        const prRecord = dbPr as any;
        if (prRecord) {
          const repo = prRecord.repositories;
          repoFullName = repo?.full_name || `${repo?.owner_login}/${repo?.name}`;
          primaryLanguage = repo?.primary_language || "TypeScript";
          prNumber = prRecord.number;
          prTitle = prRecord.title;
          prBody = prRecord.body;
          authorLogin = prRecord.author_login;
          baseRef = prRecord.base_ref;
          headRef = prRecord.head_ref;
          headSha = prRecord.head_sha || "0000000";
          prState = prRecord.state;

          // Fetch files
          const { data: dbFiles } = await supabase
            .from("pull_request_files")
            .select("*")
            .eq("pull_request_id", prRecord.id);

          if (dbFiles) {
            files = dbFiles.map((f: any) => ({
              filename: f.file_path,
              status: f.change_status,
              additions: f.additions,
              deletions: f.deletions,
              patch: f.patch_text,
            }));
          }

          // Fetch findings
          const { data: dbFindings } = await supabase
            .from("ai_findings")
            .select("*, ai_review_runs!inner(*)")
            .eq("ai_review_runs.pull_request_id", prRecord.id);

          if (dbFindings) {
            findings = dbFindings.map((f: any) => ({
              severity: f.severity,
              title: f.title,
              filePath: f.file_path,
              lineStart: f.line_start,
              explanation: f.impact_summary,
            }));
          }
        }
      } catch {
        // Fall back to default PR context
      }
    }
  }

  // 3. Build sanitized, bounded prompt context
  const preparedPrompt = buildChatPromptContext({
    repository: { fullName: repoFullName, primaryLanguage },
    pullRequest: {
      number: prNumber,
      title: prTitle,
      body: prBody,
      authorLogin,
      baseRef,
      headRef,
      headSha,
      state: prState,
    },
    files,
    findings,
    checks,
    messages,
    command,
    activeFile,
    activeLines,
  });

  // 4. Record user message in chat store
  const userMessageRecord: ChatMessage = {
    id: `msg-user-${Date.now()}`,
    role: "user",
    content: lastUserMsg.content,
    command,
    createdAt: new Date().toISOString(),
    status: "complete",
  };
  chatStore.appendMessage(workspaceId, pullRequestId, userMessageRecord);

  // 5. Create Server-Sent Events stream
  const encoder = new TextEncoder();
  const reasoningSteps: string[] = [];
  const citations: ChatCitation[] = [];
  let generatedFullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: ChatStreamEvent) {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      try {
        await streamChatResponse(
          preparedPrompt,
          (event) => {
            if (event.type === "reasoning") {
              reasoningSteps.push(event.step);
            } else if (event.type === "citation") {
              citations.push(event.citation);
            } else if (event.type === "done") {
              generatedFullText = event.fullText;
            }
            sendEvent(event);
          },
          {},
          command
        );

        // Store assistant response in history
        const assistantMessageRecord: ChatMessage = {
          id: `msg-assistant-${Date.now()}`,
          role: "assistant",
          content: generatedFullText,
          command,
          reasoningSteps,
          citations,
          createdAt: new Date().toISOString(),
          status: "complete",
        };
        chatStore.appendMessage(workspaceId, pullRequestId, assistantMessageRecord);
      } catch (err: any) {
        sendEvent({ type: "error", error: err.message || "Streaming failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
