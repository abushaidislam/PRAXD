# Internal API Specification — PRAXD

**Version:** 1.1.0-personal  
**Base path:** `/api`  
**Transport:** HTTPS + JSON, except GitHub webhook payloads  
**Auth:** Supabase user session for user routes; GitHub HMAC for webhook route.

---

## 1. Conventions

- All user routes require an authenticated user.
- The server derives user access from the session and database.
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

- Validate all query/body values with Zod or equivalent.
- Do not return installation tokens, GitHub App private keys, or encryption keys.

---

## 2. Endpoints

### Workspace and User

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/me` | Current user and basic profile |
| `GET` | `/api/workspaces/current` | Current workspace summary |

### GitHub Connection

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/github/install` | Start GitHub App installation redirect |
| `GET` | `/api/github/callback` | Validate state/context and finalize installation |
| `GET` | `/api/github/installations` | List installations connected to current workspace |
| `DELETE` | `/api/github/installations/:installationId` | Disconnect an installation |
| `POST` | `/api/webhooks/github` | Receive and verify GitHub webhooks |

### Repositories

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/repositories` | List repositories with search/sort/pagination |
| `GET` | `/api/repositories/:repositoryId` | Repository overview |
| `POST` | `/api/repositories/:repositoryId/sync` | Trigger repository/PR reconciliation |

### Pull Requests (Read & Write)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/pull-requests` | Workspace PR inbox across repositories |
| `GET` | `/api/pull-requests/:pullRequestId` | PR summary and metadata |
| `PATCH` | `/api/pull-requests/:pullRequestId` | **Update PR Title or Description (Body) on GitHub** |
| `PUT` | `/api/pull-requests/:pullRequestId/merge` | **Execute PR Merge on GitHub (merge, squash, rebase)** |
| `GET` | `/api/pull-requests/:pullRequestId/files` | Changed file list; patch loaded lazily |
| `GET` | `/api/pull-requests/:pullRequestId/commits` | PR commits |
| `GET` | `/api/pull-requests/:pullRequestId/reviews` | Review records |
| `GET` | `/api/pull-requests/:pullRequestId/comments` | Conversation and review comments |
| `POST` | `/api/pull-requests/:pullRequestId/comments` | **Post a Conversation Comment directly to the PR on GitHub** |
| `GET` | `/api/pull-requests/:pullRequestId/checks` | GitHub Check Runs for the PR head SHA |
| `POST` | `/api/pull-requests/:pullRequestId/refresh` | Trigger authoritative refresh from GitHub |

---

## 3. Pull Request Write Action Payloads

### 3.1 Update PR Title / Description (`PATCH /api/pull-requests/:pullRequestId`)
**Request Body:**
```json
{
  "title": "fix: update authentication middleware error handling",
  "body": "Updated description with clarified error logs."
}
```
**Response (200 OK):**
```json
{
  "data": {
    "id": "pr-12345",
    "title": "fix: update authentication middleware error handling",
    "body": "Updated description with clarified error logs.",
    "updatedAt": "2026-10-31T21:30:00Z"
  }
}
```

### 3.2 Execute PR Merge (`PUT /api/pull-requests/:pullRequestId/merge`)
**Request Body:**
```json
{
  "commit_title": "feat: release v1.0.0 (#42)",
  "commit_message": "Squash and merge commit details.",
  "merge_method": "squash"
}
```
*`merge_method` must be one of: `"merge"`, `"squash"`, `"rebase"` (default: `"merge"`).*

**Response (200 OK):**
```json
{
  "data": {
    "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e",
    "merged": true,
    "message": "Pull Request successfully merged"
  }
}
```

### 3.3 Post Conversation Comment (`POST /api/pull-requests/:pullRequestId/comments`)
**Request Body:**
```json
{
  "body": "LGTM! Verified the fix locally on macOS and Linux."
}
```
**Response (201 Created):**
```json
{
  "data": {
    "id": 10928374,
    "body": "LGTM! Verified the fix locally on macOS and Linux.",
    "author": {
      "login": "developer",
      "avatar_url": "https://avatars.githubusercontent.com/u/12345"
    },
    "createdAt": "2026-10-31T21:30:00Z"
  }
}
```
