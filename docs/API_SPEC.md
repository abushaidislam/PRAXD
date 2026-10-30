# Internal API Specification — PRAXD

**Version:** 0.1 draft  
**Base path:** `/api`  
**Transport:** HTTPS + JSON, except GitHub webhook payloads  
**Auth:** Supabase user session for user routes; GitHub HMAC for webhook route; trusted service auth for worker callbacks.

## 1. Conventions

- All user routes require an authenticated user and verified workspace membership.
- The server derives user/workspace access from the session and database membership. Never trust a client-supplied `workspaceId` on its own.
- Return stable JSON error shape:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found.",
    "requestId": "req_xxx"
  }
}
```

- Paginated list shape:

```json
{
  "data": [],
  "pageInfo": { "nextCursor": null, "hasNextPage": false }
}
```

- Use cursor pagination where supported by the app's storage/query model. If using GitHub REST page pagination internally, expose an opaque PRAXD cursor rather than a raw GitHub token/page value.
- Validate all query/body values with Zod or equivalent.
- Do not return installation tokens, GitHub App private keys, encryption keys or provider API keys.

## 2. Endpoints

### Workspace and user

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/me` | Current user and basic profile |
| `GET` | `/api/workspaces/current` | Current workspace summary |
| `POST` | `/api/workspaces` | Create workspace and owner membership |

### GitHub connection

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/github/install` | Start GitHub App installation redirect |
| `GET` | `/api/github/callback` | Validate state/context and finalize installation |
| `GET` | `/api/github/installations` | List installations connected to current workspace |
| `DELETE` | `/api/github/installations/:installationId` | Disconnect an installation / begin local data cleanup |
| `POST` | `/api/webhooks/github` | Receive and verify GitHub webhooks (no Supabase user session) |

### Repositories

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/repositories` | List repositories with search/sort/pagination |
| `GET` | `/api/repositories/:repositoryId` | Repository overview |
| `POST` | `/api/repositories/:repositoryId/sync` | Queue repository/PR reconciliation |

Suggested query params for list:

- `q`: search full name or repository name.
- `installationId`: optional installation filter.
- `sort`: `updated`, `name`, `open_prs`.
- `cursor`, `limit` (server-capped; default 30, max 100).

### Pull requests

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/pull-requests` | Workspace PR inbox across repositories |
| `GET` | `/api/pull-requests/:pullRequestId` | PR summary and metadata |
| `GET` | `/api/pull-requests/:pullRequestId/files` | Changed file list; patch loaded lazily |
| `GET` | `/api/pull-requests/:pullRequestId/files/:fileId/diff` | Patch/diff for one file |
| `GET` | `/api/pull-requests/:pullRequestId/commits` | PR commits |
| `GET` | `/api/pull-requests/:pullRequestId/reviews` | Review records |
| `GET` | `/api/pull-requests/:pullRequestId/comments` | Conversation and review comments |
| `GET` | `/api/pull-requests/:pullRequestId/checks` | GitHub Check Runs for the PR head SHA (MVP); legacy commit statuses are a separately permissioned optional extension |
| `POST` | `/api/pull-requests/:pullRequestId/refresh` | Queue authoritative refresh |

Suggested inbox query params:

- `view`: `all`, `reviewing`, `authored`.
- `state`: `open`, `closed`, `merged`, `all`.
- `q`: title, repository, author or PR number.
- `repositoryId`, `author`, `reviewer`, `draft`, `checkState`, `reviewState`.
- `sort`: `updated`, `created`, `comments`.
- `cursor`, `limit`.

MVP check data is GitHub Check Runs/Check Suites tied to the current PR head SHA. Do not request the `Commit statuses: Read` permission or subscribe to the `status` webhook unless legacy commit status contexts are explicitly added to the product; if they are added, update `docs/GITHUB_INTEGRATION.md` and the GitHub App permission list together.

`reviewing` should mean the authenticated GitHub identity is a requested reviewer or assigned reviewer, based on synced data; define the identity mapping explicitly. If not available, do not present a false count.

### AI review

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/pull-requests/:pullRequestId/ai-reviews` | Queue a manual AI review for current head SHA |
| `GET` | `/api/ai-reviews/:reviewRunId` | Review run status, summary and findings |
| `GET` | `/api/pull-requests/:pullRequestId/ai-reviews` | Review history for a PR |
| `POST` | `/api/ai-reviews/:reviewRunId/cancel` | Cancel a queued/running review when supported |

Example request:

```json
{
  "headSha": "full-git-commit-sha",
  "options": {
    "includeSecurity": true,
    "includePerformance": true,
    "includeTests": true
  }
}
```

The server must compare `headSha` with the currently synchronized PR head SHA. Reject an outdated SHA with `409 PR_HEAD_CHANGED` or refresh the PR before queueing.

Example accepted response:

```json
{
  "data": {
    "reviewRunId": "uuid",
    "status": "queued",
    "headSha": "full-git-commit-sha"
  }
}
```

### Notifications (later phase)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/notifications` | List workspace notifications |
| `PATCH` | `/api/notifications/:notificationId` | Mark as read |

## 3. Webhook contract

`POST /api/webhooks/github`

Required handling order:

1. Read the exact raw request body.
2. Read `X-Hub-Signature-256`, `X-GitHub-Delivery`, `X-GitHub-Event` headers.
3. Verify HMAC-SHA256 with the configured webhook secret using constant-time comparison.
4. Reject invalid/missing signature with `401`/`403`.
5. Insert delivery ID into `webhook_deliveries` with a unique constraint.
6. If duplicate, return success without scheduling duplicate work.
7. Parse only supported event types/actions with runtime validation.
8. Enqueue a durable job and return `202` quickly.

Initial subscribed events:

- `installation` (created, deleted, suspend/unsuspend actions where available).
- `installation_repositories`.
- `pull_request` (opened, reopened, synchronize, edited, closed, ready_for_review, converted_to_draft, review_requested/review_request_removed as applicable).
- `pull_request_review`.
- `pull_request_review_comment`.
- `issue_comment` (filter to pull request issue comments in the worker).
- `check_run` and/or `check_suite` if checks are synchronized via webhook.

Do not assume the payload includes all fields required by the UI. Fetch authoritative resource details through GitHub API in the worker.

## 4. Error codes

| Code | HTTP | Meaning |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | No valid user session |
| `FORBIDDEN` | 403 | User is not a workspace member or lacks role |
| `NOT_FOUND` | 404 | Resource not visible or does not exist |
| `VALIDATION_ERROR` | 400 | Invalid request input |
| `GITHUB_NOT_CONNECTED` | 409 | No active installation for requested repository |
| `GITHUB_PERMISSION_MISSING` | 403 | Installation lacks the required permission |
| `GITHUB_RATE_LIMITED` | 429 | GitHub rate limit reached; include retry guidance |
| `PR_HEAD_CHANGED` | 409 | Requested head SHA is stale |
| `DIFF_UNAVAILABLE` | 422 | GitHub has no patch for requested file |
| `AI_REVIEW_ALREADY_RUNNING` | 409 | Active review already exists for the same PR head/config |
| `AI_PROVIDER_UNAVAILABLE` | 503 | AI provider temporarily unavailable |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

## 5. Security requirements

- Authenticate before loading tenant resources.
- Use server-side GitHub adapter for all GitHub API calls.
- Do not pass GitHub tokens from client to server.
- Rate-limit manual AI review requests per user/workspace/repository.
- Use idempotency for job creation and webhook deliveries.
- Avoid exposing raw third-party errors, source code or tokens in API errors.
- Log request IDs and safe error codes only.
