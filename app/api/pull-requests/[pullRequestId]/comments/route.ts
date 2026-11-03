import { NextRequest } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchLivePullRequestComments, createLivePullRequestComment } from "@/lib/github/live";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  // Handle live PR comments directly from GitHub API
  if (pullRequestId.startsWith("live__")) {
    const parts = pullRequestId.split("__");
    if (parts.length === 4) {
      const owner = parts[1];
      const repo = parts[2];
      const pullNumber = parseInt(parts[3], 10);
      if (!isNaN(pullNumber) && owner && repo) {
        const comments = await fetchLivePullRequestComments(owner, repo, pullNumber);
        return apiSuccess({ comments });
      }
    }
  }

  const supabase = createServiceRoleClient();
  const { data: comments, error } = await supabase
    .from("pull_request_comments")
    .select("*")
    .eq("pull_request_id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .order("created_at_github", { ascending: true });

  if (!error && comments && comments.length > 0) {
    const domainComments = comments.map((c: any) => ({
      id: c.id,
      author: {
        login: c.author_login || "unknown",
        avatarUrl:
          c.author_avatar_url ||
          (c.author_login
            ? `https://github.com/${c.author_login}.png`
            : "https://github.com/ghost.png"),
        name: c.author_login || "unknown",
      },
      body: c.body,
      createdAt: c.created_at_github || c.created_at || new Date().toISOString(),
      commentType: c.comment_type === "review" ? ("review" as const) : ("issue" as const),
      path: c.path || undefined,
      line: c.line ?? undefined,
      side: c.side || undefined,
    }));
    return apiSuccess({ comments: domainComments });
  }

  // If Supabase has no comments yet, fetch from GitHub and synchronize
  const { data: dbPr } = await supabase
    .from("pull_requests")
    .select("number, repositories ( owner_login, name )")
    .eq("id", pullRequestId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  const prData = dbPr as any;
  const repo = prData?.repositories;
  if (repo?.owner_login && repo?.name && prData?.number) {
    const liveComments = await fetchLivePullRequestComments(repo.owner_login, repo.name, prData.number);
    if (liveComments.length > 0) {
      const commentRows = liveComments.map((c) => {
        const ghId = parseInt(c.id, 10);
        return {
          workspace_id: auth.workspaceId,
          pull_request_id: pullRequestId,
          github_comment_id: isNaN(ghId) ? Math.floor(Date.now() / 1000) : ghId,
          comment_type: c.commentType,
          author_login: c.author.login,
          author_avatar_url: c.author.avatarUrl,
          body: c.body,
          path: c.path || null,
          line: c.line ?? null,
          side: c.side || null,
          created_at_github: c.createdAt,
          updated_at_github: c.createdAt,
        };
      });

      supabase
        .from("pull_request_comments")
        .upsert(commentRows, { onConflict: "github_comment_id" })
        .then();

      return apiSuccess({ comments: liveComments });
    }
  }

  return apiSuccess({ comments: [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pullRequestId: string }> }
) {
  const { pullRequestId } = await params;
  const auth = await getAuthenticatedContext();
  if (!auth) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  let body: {
    body?: string;
    profileType?: "personal" | "bot";
    author?: { login?: string; avatarUrl?: string; name?: string };
  };
  try {
    body = await req.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON payload", 400);
  }

  const commentText = body.body?.trim();
  if (!commentText) {
    return apiError("BAD_REQUEST", "Comment body cannot be empty", 400);
  }

  const isBotProfile = body.profileType === "bot";
  const authorInfo = {
    login: isBotProfile
      ? "praxd-app[bot]"
      : body.author?.login || auth.userId || "abushaidislam",
    avatarUrl: isBotProfile
      ? "/logo.png"
      : body.author?.avatarUrl || "https://avatars.githubusercontent.com/u/104990928?v=4",
    name: isBotProfile
      ? "praxd-app[bot]"
      : body.author?.name || body.author?.login || "abushaidislam",
  };

  // Handle live PR comment creation directly on GitHub
  if (pullRequestId.startsWith("live__")) {
    const parts = pullRequestId.split("__");
    if (parts.length === 4) {
      const owner = parts[1];
      const repo = parts[2];
      const pullNumber = parseInt(parts[3], 10);
      if (!isNaN(pullNumber) && owner && repo) {
        const result = await createLivePullRequestComment(
          owner,
          repo,
          pullNumber,
          commentText,
          body.profileType,
          authorInfo.login
        );
        if (!result.success || !result.comment) {
          return apiError("GITHUB_ERROR", result.error || "Failed to post comment to GitHub", 502);
        }
        return apiSuccess({
          comment: {
            ...result.comment,
            author: authorInfo,
          },
        });
      }
    }
  }

  // Handle Supabase database PR comment creation (post to GitHub first, then store in DB)
  const supabase = createServiceRoleClient();
  try {
    let ghCommentId = Math.floor(Date.now() / 1000);

    const { data: dbPr } = await supabase
      .from("pull_requests")
      .select("number, repositories ( owner_login, name )")
      .eq("id", pullRequestId)
      .eq("workspace_id", auth.workspaceId)
      .single();

    const prData = dbPr as any;
    const repo = prData?.repositories;
    if (repo?.owner_login && repo?.name && prData?.number) {
      const result = await createLivePullRequestComment(
        repo.owner_login,
        repo.name,
        prData.number,
        commentText,
        body.profileType,
        authorInfo.login
      );
      if (result.success && result.comment) {
        const parsed = parseInt(result.comment.id, 10);
        if (!isNaN(parsed)) ghCommentId = parsed;
      }
    }

    const commentRecord: any = {
      workspace_id: auth.workspaceId,
      pull_request_id: pullRequestId,
      github_comment_id: ghCommentId,
      comment_type: "issue",
      body: commentText,
      created_at_github: new Date().toISOString(),
      author_login: authorInfo.login,
      author_avatar_url: authorInfo.avatarUrl,
    };

    const { data: created, error } = await (supabase.from("pull_request_comments") as any)
      .insert(commentRecord)
      .select()
      .single();

    if (error || !created) {
      return apiSuccess({
        comment: {
          id: `comment-${Date.now()}`,
          body: commentText,
          author: authorInfo,
          createdAt: new Date().toISOString(),
          commentType: "issue",
        },
      });
    }

    return apiSuccess({
      comment: {
        id: created.id,
        body: created.body,
        author: {
          login: created.author_login || authorInfo.login,
          avatarUrl: created.author_avatar_url || authorInfo.avatarUrl,
        },
        createdAt: created.created_at_github,
        commentType: "issue",
      },
    });
  } catch {
    return apiSuccess({
      comment: {
        id: `c-local-${Date.now()}`,
        body: commentText,
        author: authorInfo,
        createdAt: new Date().toISOString(),
        commentType: "issue",
      },
    });
  }
}
