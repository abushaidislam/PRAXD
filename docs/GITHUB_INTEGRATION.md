# PRAXD — GitHub App & Integration Contract

**Document status:** Normative implementation specification  
**Integration model:** GitHub App installation tokens + REST API + signed webhooks  
**Schema source:** `migrations/0001_initial_schema.sql`  
**Security baseline:** Least-privilege, read-only by default

This document is the authoritative GitHub integration specification. If an older quick-start note in `docs/GITHUB_APP_SETUP.md` conflicts with this file, follow this file.

## 1. Integration principles

- Use a **GitHub App**, not a user-supplied Personal Access Token, as the default integration.
- Install the App on selected user/organization repositories. Treat the installation's accessible repository set as the authorization boundary.
- Generate installation access tokens on the server only. Tokens are short-lived; acquire/refresh them when needed and never expose them to browser code.
- Start with read-only permissions. Add write permission only for a specific, shipped, user-confirmed action.
- Use GitHub REST API responses as the canonical source. Webhook payloads are change notifications; re-fetch canonical objects when the payload is partial, ambiguous or out of order.
- Persist only the PRAXD data needed for the UI, search, synchronization and audit. Do not store full webhook payloads or entire repositories by default.
- Every GitHub object is scoped through a local workspace and local GitHub App installation. A caller-supplied owner/repo/installation ID is not authorization.

## 2. GitHub App registration

Create a dedicated App named **PRAXD**. Use separate GitHub Apps for local development, staging and production; never reuse a production private key or webhook secret in a local environment.

| Setting | Required value / rule |
|---|---|
| App name | `PRAXD` (must be globally available in GitHub) |
| Homepage URL | Deployed PRAXD origin, e.g. `https://app.example.com` |
| Callback URL | `https://APP_ORIGIN/api/github/callback` (OAuth user authorization callback) |
| Setup URL | `https://APP_ORIGIN/api/github/callback` (**Required** to redirect users back to PRAXD after App installation; enable "Redirect on update") |
| Webhook URL | `https://APP_ORIGIN/api/webhooks/github` |
| Webhook secret | High-entropy random secret, different per environment, stored in a server secret manager |
| SSL verification | Enabled |
| Where can this App be installed? | Personal accounts and organizations, if required by the product's supported users |
| User authorization | Request only if a product feature actually needs user-to-GitHub identity; installation-token access is the default repository API model |

GitHub App installation and callback behavior must follow the current official GitHub App documentation. Validate the callback `state` nonce and verify the installation by using authenticated GitHub API calls. A callback query parameter is not proof that an installation belongs to the current PRAXD user.

## 3. Repository permissions — exact least-privilege model

### 3.1 Default read permissions

Configure only the permissions needed by the enabled release features:

| Repository permission | Level | Required in which phase | Reason |
|---|---|---|---|
| Metadata | Read-only | All GitHub-connected phases | GitHub repository identity and metadata; baseline App repository visibility permission. |
| Pull requests | Read-only | Phase 1 | List/get PRs, changed files, commits, review summaries and review comments. |
| Checks | Read-only | Phase 1 when displaying check runs | Read check runs and check-suite state for the PR head commit. |
| Issues | Read-only | Phase 1 when subscribing to `issue_comment` / reading PR conversation comments | GitHub models PR conversation comments as issue comments; the `issue_comment` webhook requires this permission. Filter the payload to issues that contain a `pull_request` object. |
| Contents | Read-only | Phase 3 only if AI retrieves related source files beyond PR diff patches | Fetch bounded source context for evidence-based AI review. Do not request it if AI is restricted to the PR patch only. |
| Commit statuses | Read-only | Optional only | Required only if PRAXD explicitly subscribes to the `status` event or reads legacy commit status contexts in addition to Checks API runs. Not required for Check Runs alone. |

**MVP recommendation:** Metadata: Read, Pull requests: Read, Checks: Read and Issues: Read if issue conversation comments are required. Add Contents: Read only when the AI context builder needs to fetch repository source files. Do not request Commit statuses unless that capability is explicitly implemented.

The `issue_comment` event requires `Issues: Read`; `pull_request_review` and `pull_request_review_comment` require `Pull requests: Read`; `check_run` and `check_suite` require `Checks: Read`. Confirm the event-to-permission matrix against GitHub's current documentation immediately before registering the production App.

### 3.2 Write permissions — disabled by default

| Permission | Level | Enable only when | What it permits |
|---|---|---|---|
| Pull requests | Read & write | A later release allows a user to publish selected PRAXD findings as a GitHub review/comment | Create a PR review and its comments. Keep the action user-selected and explicitly confirmed. |

Do **not** enable Contents: Write, Checks: Write, Actions: Write, Administration: Write, Issues: Write, or repository administration/merge permissions for the described MVP. PRAXD does not need to push a branch, change repository settings, rerun CI, approve, merge or close a PR.

If publishing comments is enabled later, request the changed permission through the GitHub App permission update flow and require affected installations to approve the new permission. Do not quietly enable write access because the backend has a code path for it.

## 4. Webhook event subscriptions

GitHub Apps receive `installation` and `installation_repositories` events by default; they are not manually selectable in the App event checklist. They are still first-class events for PRAXD to handle. The app also receives the `github_app_authorization` revocation event by default; handle it if user authorization tokens are used.

### 4.1 Subscribe to these events

| Event | Required? | Purpose | Handler behavior |
|---|---|---|---|
| `pull_request` | Yes | Open, edit, close, reopen, synchronize, draft/ready and reviewer/label changes | Re-fetch PR by repository + number; upsert canonical PR and relevant relationships. |
| `pull_request_review` | Yes | Submitted, edited or dismissed reviews | Re-fetch/upsert the affected review; update PR review activity. |
| `pull_request_review_comment` | Yes | Diff/inline review comments | Upsert the review comment including path, line, side, commit and reply metadata. |
| `issue_comment` | Yes if PR conversation comments are shown | PR conversation comments and replies | Process only when `issue.pull_request` exists; ignore ordinary issue comments. Requires Issues: Read. |
| `check_run` | Yes | CI check run creation/completion | Upsert check run by repository/check ID and head SHA. |
| `check_suite` | Recommended | Check-suite completion and reconciliation signal | Re-fetch check runs for the affected SHA; do not persist a suite as though it were an individual check run. |
| `pull_request_review_thread` | Optional/recommended | Review thread resolution/reopening state | Use if the UI displays resolved/unresolved review thread state; otherwise omit and derive only what the chosen APIs support. |

### 4.2 Always-received installation events

| Event | Purpose | Required handler |
|---|---|---|
| `installation` | App installed, suspended, unsuspended, deleted or permissions changed | Update `github_installations.status`, permission snapshot and lifecycle timestamps. |
| `installation_repositories` | Repositories added to/removed from an installation | Sync added repositories; immediately revoke PRAXD access to removed repositories and stop future fetches. |
| `github_app_authorization` | User revoked App authorization (if user tokens are used) | Revoke/delete the affected user authorization and stop requests using it. |

### 4.3 Explicitly omit unless a feature requires them

- `push`: not required for PR head updates when `pull_request` includes `synchronize`; add only if a separately defined branch/commit feature requires it.
- `status`: only for legacy commit status contexts; adds the Commit statuses permission.
- `workflow_run` / `workflow_job`: only if PRAXD adds a workflow-run view distinct from Check Runs; would require Actions: Read.
- `issues`: ordinary issue lifecycle is outside current product scope; `issue_comment` is enough for PR conversation comments when filtered by `issue.pull_request`.
- `repository`, `public`, `release` and other broad events: not necessary for the described PR workspace.

Subscribe to the smallest set of events that PRAXD processes. Store an event/action allowlist in code and make unhandled actions produce an `ignored` delivery rather than an accidental mutation.

## 5. Installation and account-linking lifecycle

### 5.1 Start installation

1. Require an authenticated PRAXD user and an authorized workspace membership.
2. Create a cryptographically random, single-use `state` nonce with short expiry, bound server-side to `user_id`, `workspace_id`, creation time and intended return route.
3. Redirect the user to the GitHub App installation URL.
4. On callback, validate the state, expiry, single-use property and initiating user/workspace session.
5. Validate the returned installation ID by requesting installation details from GitHub using App authentication. Confirm account ID/login/type and available repository selection.
6. Link the installation to the initiating workspace. Do not allow the browser to choose an arbitrary existing workspace or overwrite a different workspace's installation mapping.
7. Generate an installation token server-side and call the installation repositories endpoint.
8. Upsert accessible repositories and queue an initial PR sync.
9. Report the exact connected account and repository scope to the user.

The current `github_installations.installation_id` has a global unique constraint. A single GitHub installation must be mapped to one PRAXD workspace in this schema. If the product later needs to share one GitHub installation across multiple PRAXD workspaces, change the data model before implementation; do not bypass the uniqueness constraint.

### 5.2 Installation status mapping

Map GitHub installation lifecycle actions to the exact enum `public.github_installation_status`:

| GitHub condition/action | Database status | Timestamp behavior |
|---|---|---|
| Installation created and verified | `active` | Set `updated_at`; keep `deleted_at`/`suspended_at` null. |
| Installation is pending callback/verification | `pending` | Set `updated_at`. |
| Installation suspended | `suspended` | Set `suspended_at = now()`. Stop API work. |
| Installation unsuspended | `active` | Clear `suspended_at`; queue repository reconciliation. |
| Installation deleted | `deleted` | Set `deleted_at = now()`; stop token generation and scheduled jobs. |

Do not mark an installation active from an unverified callback alone. Treat permission changes as a reason to refresh the `permissions` JSON snapshot and verify which features remain authorized.

## 6. Webhook endpoint and signature verification

### 6.1 Required headers

- `X-GitHub-Event`: event name.
- `X-GitHub-Delivery`: unique delivery GUID; required for idempotency.
- `X-Hub-Signature-256`: `sha256=` followed by a 64-character hexadecimal HMAC digest.
- `Content-Type`: expect `application/json` for the configured payload format.

`X-GitHub-Hook-ID` can be captured for diagnostics but is not a substitute for the delivery ID or signature.

### 6.2 Processing order

1. Enforce method, content-type and configured payload-size limit.
2. Read the original request body as raw bytes exactly once.
3. Validate required headers and signature over those exact bytes.
4. Only after successful signature validation, parse UTF-8 JSON and validate the minimal event envelope.
5. Compute SHA-256 of the raw body for `webhook_deliveries.payload_sha256`.
6. Insert a unique delivery row with status `received`. A duplicate `delivery_id` is acknowledged without scheduling duplicate domain work.
7. Durably enqueue or make the row available to a worker/outbox poller; transition it to `queued`.
8. Respond promptly with `2xx`. Domain processing happens asynchronously.

Do not call `request.json()` before signature verification. Do not stringify parsed JSON and verify the re-serialized bytes; whitespace, key order and Unicode byte sequences may differ from the originally signed payload.

### 6.3 Node.js / TypeScript reference implementation

Use a Node.js runtime route handler (`export const runtime = "nodejs"`) because this example uses `node:crypto`. The implementation must be adapted to the chosen framework and tested against GitHub's published test vector.

```ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Stay below GitHub's documented 25 MB webhook payload cap. Configure the
// reverse proxy/platform request limit to the same or a slightly larger value.
const MAX_WEBHOOK_BYTES = 24 * 1024 * 1024;

async function readBodyWithLimit(request: Request): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        throw new Error("WEBHOOK_PAYLOAD_TOO_LARGE");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}

export function verifyGitHubWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signatureHeader.slice("sha256=".length);
  // SHA-256 hex digest is exactly 64 hexadecimal characters.
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) {
    return false;
  }

  const expectedHex = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const received = Buffer.from(receivedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  // timingSafeEqual throws when lengths differ; compare only equal lengths.
  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("x-hub-signature-256");
  const deliveryId = request.headers.get("x-github-delivery");
  const eventName = request.headers.get("x-github-event");
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);

  if (!deliveryId || !eventName || !contentType.startsWith("application/json")) {
    return new Response("Missing required headers or unsupported content type", { status: 400 });
  }
  if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0)) {
    return new Response("Invalid content length", { status: 400 });
  }
  if (contentLength !== null && contentLength > MAX_WEBHOOK_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let rawBody: Buffer;
  try {
    rawBody = await readBodyWithLimit(request);
  } catch (error) {
    if (error instanceof Error && error.message === "WEBHOOK_PAYLOAD_TOO_LARGE") {
      return new Response("Payload too large", { status: 413 });
    }
    return new Response("Could not read request body", { status: 400 });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    // Configuration failure: do not accept unverified events.
    return new Response("Webhook verification unavailable", { status: 503 });
  }

  if (!verifyGitHubWebhookSignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
    payload = JSON.parse(utf8);
  } catch {
    return new Response("Invalid UTF-8 JSON", { status: 400 });
  }

  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const safeEnvelope = validateAndExtractDeliveryEnvelope(eventName, payload);
  // Persist only the digest + minimal routing envelope, not the raw body or the
  // full webhook payload. The worker re-fetches canonical objects from GitHub.
  await persistAndScheduleDelivery({
    deliveryId,
    eventName,
    actionName: safeEnvelope.actionName,
    payloadHash,
    envelope: safeEnvelope,
  });
  return new Response(null, { status: 202 });
}
```

`persistAndScheduleDelivery` above is an application boundary, not a library function supplied by Next.js. It must perform duplicate-safe persistence and durable scheduling. Do not acknowledge a delivery before it is durably recorded. If the queue publish and database insert cannot be one transaction, store the delivery row first and run a poller that re-enqueues old `received`/`queued` rows that have not been claimed. Worker processing must itself be idempotent.

### 6.4 GitHub signature test vector

Add a unit test using GitHub's published values:

- Secret: `It's a Secret to Everybody`
- Raw body: `Hello, World!`
- Expected header: `sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17`

Also test missing header, wrong prefix, invalid hex, wrong secret, changed raw bytes, Unicode body, whitespace-preserving body and an oversized payload.

## 7. Delivery persistence, idempotency and worker contract

The current schema table is `public.webhook_deliveries`:

| Column | Contract |
|---|---|
| `installation_id` | Local `github_installations.id` UUID, not GitHub's numeric installation ID. Nullable for events that cannot be linked. |
| `delivery_id` | Exact `X-GitHub-Delivery`; unique idempotency key. |
| `event_name` | Exact `X-GitHub-Event` header value. |
| `action_name` | Parsed payload `action`, if present. |
| `status` | Exact `public.webhook_status` enum. |
| `payload_sha256` | SHA-256 hex digest of original raw bytes; never store the webhook secret or signature as payload data. |
| `received_at` | Server receipt timestamp. |
| `processed_at` | Set only after successful domain processing or explicit final handling. |
| `attempts` | Increment when a worker claims an attempt. |
| `safe_error_code` | Sanitized stable error code; never stack trace, token or payload contents. |

### Status transitions

- `received` → `queued` → `processing` → `processed`
- `received`/`queued`/`processing` → `failed` for exhausted or permanent failure
- `received`/`queued` → `ignored` for unsupported event/action or irrelevant ordinary issue comment
- `failed` may be manually/reconciliation replayed by returning it to `queued` through an audited operator action; preserve attempt history in logs/metrics.

### Required guarantees

- Unique delivery insert is the first idempotency barrier.
- Domain upserts use stable GitHub IDs and schema unique constraints as the second barrier.
- Workers may execute more than once. All handlers must be safe under retries.
- Queue messages contain identifiers, not secrets. Resolve the installation token at processing time.
- Use bounded retry with exponential backoff + jitter for transient network, 5xx and rate-limit errors.
- Stop automatic retries for permanent 401/403/404 or invalid schema, then surface a safe operator/user-visible state.
- Do not save a raw payload merely for debugging. The digest, event/action, delivery ID and safe error code are sufficient for ordinary observability.

## 8. Canonical data ingestion and mapping contract

### 8.1 Identity and numeric safety

GitHub provides numeric object IDs. The database stores them as PostgreSQL `bigint`. Do not perform lossy numeric coercion. Validate they are positive integers and preserve decimal precision from the GitHub client through persistence. If the selected client/runtime cannot preserve a value losslessly, represent the ID as a decimal string in the domain layer and bind it as a PostgreSQL bigint string.

Resolve local foreign keys on the server:

- `github_installations.id` = PRAXD UUID; `github_installations.installation_id` = GitHub numeric installation ID.
- `repositories.installation_id` references the local installation UUID.
- `pull_requests.repository_id` references the local repository UUID.
- Child records' `pull_request_id` references the local PR UUID.
- `workspace_id` is copied from the owning local parent after authorization checks, not accepted from arbitrary webhook fields or browser input.

### 8.2 `github_installations`

| Database column | GitHub/source value | Mapping rule |
|---|---|---|
| `workspace_id` | Verified installation-to-workspace link | Set from the validated install-initiation state/context. |
| `installation_id` | `installation.id` | Preserve as bigint; globally unique under current schema. |
| `account_github_id` | `installation.account.id` | Nullable if absent. |
| `account_login` | `installation.account.login` | Required; reject/quarantine malformed payload without it. |
| `account_type` | `installation.account.type` | Usually `User` or `Organization`; preserve source value. |
| `status` | Installation lifecycle/action | Map to `pending`, `active`, `suspended`, `deleted` as defined in §5.2. |
| `permissions` | `installation.permissions` or authenticated installation response | Store only the permission snapshot JSON needed to explain the installation's granted scope. |
| `repository_selection` | `installation.repository_selection` | `all` or `selected` when present. |
| `installed_by` | PRAXD authenticated user from validated flow | Never trust `sender.id` as the PRAXD user ID. |
| `suspended_at` / `deleted_at` | Installation lifecycle | Set/clear using lifecycle rules. |
| `last_synced_at` / `last_sync_error` | Sync worker result | Set only from completed sync attempts; error field must be safe/redacted. |

### 8.3 `repositories`

Natural key: `(installation_id, github_repo_id)`.

| Database column | GitHub `repository` object |
|---|---|
| `workspace_id` | Local workspace inherited from installation |
| `installation_id` | Local `github_installations.id` UUID |
| `github_repo_id` | `repository.id` |
| `owner_login` | `repository.owner.login` |
| `name` | `repository.name` |
| `full_name` | `repository.full_name` |
| `description` | `repository.description` |
| `html_url` | `repository.html_url` |
| `visibility` | `repository.visibility` (fallback from `private` only when the field is unavailable; preserve `internal` distinctly when supplied) |
| `primary_language` | `repository.language` |
| `default_branch` | `repository.default_branch` |
| `is_archived` | `repository.archived` |
| `is_disabled` | `repository.disabled` |
| `is_accessible` / `access_revoked_at` | PRAXD installation scope (additive migration `0002`) | Set `false` / `now()` when removed from installation scope; set `true` / `null` only after GitHub confirms the repository is accessible again. |
| `open_pr_count` | Derived count from synchronized open PRs, not treated as canonical if unavailable |
| `github_created_at` | `repository.created_at` |
| `github_updated_at` | `repository.updated_at` |
| `github_pushed_at` | `repository.pushed_at` |
| `synced_at` | Current server time after successful repository sync |

**Schema gap — repository access removal:** `0001_initial_schema.sql` has `is_disabled` (GitHub repository disabled) but no field for “this App installation no longer has access.” Do not overload `is_disabled` for that meaning. Before production, apply `migrations/0002_production_integrity.sql`, which adds `is_accessible boolean not null default true` and `access_revoked_at timestamptz` and tightens the authenticated read policies for repositories and their PR/AI descendants. On `installation_repositories.removed`, set `is_accessible=false` and `access_revoked_at=now()`, stop token/API access and hide private content from normal workspace queries while preserving records for controlled retention/deletion. An alternative is hard deletion only if product retention requirements explicitly permit cascading deletion of all PR history. The preferred behavior is a soft access revocation.

### 8.4 `pull_requests`

Natural key: `(repository_id, number)`; also preserve GitHub `pull_request.id` in `github_pr_id`.

| Database column | GitHub Pull Request object | Mapping rule |
|---|---|---|
| `workspace_id` | Local repository workspace | Inherit from repository. |
| `repository_id` | Local repository UUID | Resolve by GitHub repository ID and installation. |
| `github_pr_id` | `pull_request.id` | GitHub global PR object ID. |
| `number` | `pull_request.number` | Repository-scoped PR number. |
| `title` / `body` | `title` / `body` | Preserve body as plain Markdown text; render safely in UI. |
| `state` | `state`, `merged_at` | `merged_at != null` → `merged`; else `state == "closed"` → `closed`; else `open`. |
| `draft` | `draft` | Boolean. |
| `author_login` / `author_avatar_url` | `user.login` / `user.avatar_url` | Nullable if API response lacks user. |
| `head_ref` / `head_sha` | `head.ref` / `head.sha` | Current source branch and commit. |
| `base_ref` / `base_sha` | `base.ref` / `base.sha` | Target branch and commit. |
| `additions` / `deletions` | `additions` / `deletions` | API totals. |
| `changed_files_count` | `changed_files` | Count from canonical PR response; may be subject to endpoint/result limits. |
| `comments_count` | `comments` | Issue-conversation comment count, as returned by GitHub. |
| `review_comments_count` | `review_comments` | Diff review-comment count. |
| `commits_count` | `commits` | API total. |
| `mergeable` / `mergeable_state` | `mergeable` / `mergeable_state` | `mergeable` can be temporarily null while GitHub computes it. |
| `html_url` | `html_url` | Canonical GitHub URL. |
| `github_created_at` / `github_updated_at` | `created_at` / `updated_at` | Parse as UTC timestamptz. |
| `github_closed_at` / `merged_at` | `closed_at` / `merged_at` | Parse as UTC timestamptz. |
| `github_author_association` | `author_association` | Preserve upstream value. |
| `requested_reviewers` | `requested_reviewers` (+ teams if supported by product) | Store normalized JSON array; do not assume only user reviewers exist. |
| `labels` | `labels` | Store normalized JSON array of label identity/name/color. |

Always refetch a PR after a webhook when its payload may be incomplete. `pull_request` events include a PR object, but the canonical GET response is the safer reconciliation source for current status and head/base SHA.

### 8.5 Changed files, commits and reviews

| Table | Source endpoint/object | Mapping/notes |
|---|---|---|
| `pull_request_files` | `GET /repos/{owner}/{repo}/pulls/{pull_number}/files` | Upsert per `(pull_request_id, file_path)`; map `filename` → `file_path`, `previous_filename` → `previous_file_path`, `status`, additions/deletions/changes, `patch` → `patch_text`, `patch_available = patch != null`; retain blob/raw/contents URLs only as references. |
| `pull_request_commits` | `GET /repos/{owner}/{repo}/pulls/{pull_number}/commits` | Upsert on `(pull_request_id, sha)`; map commit message, author login/avatar, committed date and HTML URL. |
| `pull_request_reviews` | `GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`; `pull_request_review` webhook | Upsert by globally unique `github_review_id`; map reviewer/body/commit/submitted time/URL. Map upstream state case-insensitively: `APPROVED` → `approved`; `CHANGES_REQUESTED` → `changes_requested`; `COMMENTED` → `commented`; `DISMISSED` → `dismissed`; `PENDING` → `pending`; everything else → `unknown`. |

The GitHub “List pull request files” endpoint returns at most **3,000 files** per PR. It is paginated (maximum `per_page` 100), but the endpoint maximum remains. The patch property may be absent for binary, too-large or unsupported files. PRAXD must show partial/unsupported state instead of pretending the entire diff was read.

### 8.6 Comments — exact table name is `pull_request_comments`

There is no `public.comments` table in `0001_initial_schema.sql`.

| Source | `comment_type` | Mapping |
|---|---|---|
| `issue_comment` webhook / issue comments endpoint for an object whose `issue.pull_request` exists | `issue` | Map `comment.id` → `github_comment_id`, author, body, html URL, `created_at`/`updated_at`. `path`, `line`, `diff_hunk` and `in_reply_to_id` remain null unless GitHub provides them. Ignore ordinary issue comments without a PR marker. |
| `pull_request_review_comment` webhook / PR review comments endpoint | `review` | Map comment ID, author, body, `path`, `diff_hunk`, `commit_id`, `original_commit_id`, `line`, `original_line`, `start_line`, `side`, `start_side`, `in_reply_to_id`, URL and timestamps. |

Use `github_comment_id` as the idempotency key; it is globally unique in the current schema. Do not convert a top-level `pull_request_review` body into a `pull_request_comments` row: it belongs in `pull_request_reviews`. A reply to a diff thread is still a review comment; preserve `in_reply_to_id`.

### 8.7 Checks — exact table name is `check_runs`

There is no `public.checks` table in `0001_initial_schema.sql`.

| Database column | Check Run source |
|---|---|
| `workspace_id` / `repository_id` | Resolve from repository installation mapping |
| `pull_request_id` | Link only when the check run's associated PR/head SHA maps unambiguously; otherwise leave null and query by SHA when displaying a PR |
| `github_check_id` | `check_run.id`; unique partial index per repository when non-null |
| `external_id` | `check_run.external_id` |
| `name` | `check_run.name` (required) |
| `head_sha` | `check_run.head_sha` (required) |
| `status` | `check_run.status` (`queued`, `in_progress`, `completed`, etc.); preserve upstream string |
| `conclusion` | `check_run.conclusion` (nullable until completed) |
| `details_url` | `check_run.details_url` or `html_url` according to API object availability |
| `started_at` / `completed_at` | `check_run.started_at` / `completed_at` |
| `output_title` / `output_summary` | `check_run.output.title` / `output.summary`; sanitize/render as text |
| `source` | `check_run` for check-run API records; a documented value such as `status` only if optional Commit Status API support is later implemented |
| `synced_at` | Server time after successful check sync |

A `check_suite` webhook is a trigger to reconcile the check runs for its `head_sha`; it is not itself a check run. Do not mark all checks green merely because the suite event arrived. The UI must group/check by exact PR head SHA so old checks do not appear to validate new code.

## 9. Event-to-ingestion routing

| Event/action family | Required behavior |
|---|---|
| `installation` (`created`, `deleted`, `suspend`, `unsuspend`, permission changes) | Update the mapped `github_installations` row; suspend/delete stops token generation and jobs. |
| `installation_repositories` (`added`, `removed`) | For additions, verify access then set `is_accessible=true` and clear `access_revoked_at`; for removals, set `is_accessible=false` and `access_revoked_at=now()` immediately, then queue reconciliation. |
| `pull_request` (`opened`, `reopened`, `synchronize`, `edited`, `closed`, `ready_for_review`, `converted_to_draft`, review request/label actions) | Refetch PR and upsert `pull_requests`; refresh changed files/commits when head SHA changes; enqueue old AI run invalidation in Phase 3. |
| `pull_request_review` | Refetch or map review; upsert `pull_request_reviews`; update PR review activity. |
| `pull_request_review_comment` | Map/upsert `pull_request_comments` with `comment_type='review'`. |
| `issue_comment` | If `issue.pull_request` is absent, mark `ignored`; otherwise map/upsert `pull_request_comments` with `comment_type='issue'`. |
| `check_run` | Upsert `check_runs` by repository/check ID; preserve status/conclusion. |
| `check_suite` | Reconcile all check runs for the suite head SHA. |
| `pull_request_review_thread` | Update thread resolution state only if the implementation has a persisted/displayed state model; the current `pull_request_comments` table has no resolved column, so do not claim persistent resolution state without an additive migration. |

For all event types, first map `repository.id` and `installation.id` to an installed local repository/workspace. If the installation or repository is unknown, do not create a workspace based on payload values. Quarantine/ignore the delivery with a safe diagnostic and trigger an installation/repository reconciliation where appropriate.

## 10. Synchronization, pagination and race handling

- Initial sync: list installation repositories; for each accessible repository, list PRs by required states/sort and fetch PR detail, files, commits, reviews, comments and checks as needed.
- Use Octokit pagination or parse `Link` headers. Do not assume `per_page=100` means the endpoint is complete.
- Use conditional requests/ETags where supported. Cache only within the installation/repository boundary.
- A `pull_request` webhook is a prompt to fetch the current PR; it is not an ordered event log. Do not overwrite a newer stored `head_sha` with an older payload.
- Use per-PR serialization/locking for PR detail + dependent file/commit refresh jobs. After acquiring the lock, fetch canonical current PR and compare the current head SHA.
- When head SHA changes, atomically upsert PR metadata and schedule file/commit/check reconciliation for the new SHA. Previous check runs remain historical and must not be represented as current-head checks.
- For a failed dependent fetch, keep last known data with a visible stale state and safe `last_sync_error`/job error. Do not clear correct data just because a partial fetch failed.
- Run periodic reconciliation even when webhooks are enabled. Webhooks can be delayed, disabled or missed.
- Store timestamps as UTC `timestamptz`; render in user-local time.

## 11. Disconnect, revocation and retention

- On installation deletion/suspension, stop generating installation tokens and stop all sync/AI source retrieval for that installation.
- On repository removal from an installation, remove its private source content from accessible UI and APIs immediately. Preserve or delete historical metadata according to documented retention rules; never let a soft-retained repository remain accessible merely because the local row still exists.
- On workspace disconnect, provide a clear operation to revoke the connection and remove/retain synchronized metadata per user policy.
- Do not rely on frontend hiding. Enforce access in server queries and RLS.
- Log disconnect and deletion actions in `audit_logs` where appropriate.
- A data deletion process must account for repositories, PR child rows, comments, files, check runs and AI records. Validate cascade behavior before promising complete deletion.

## 12. Required environment variables

Variable names must match the repo's `.env.example`; never put real values there. `NEXT_PUBLIC_APP_URL` is a public origin, not a secret.

```bash
NEXT_PUBLIC_APP_URL=
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY_BASE64=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_SLUG=praxd
```

`GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` are required only if the selected GitHub App user authorization flow uses them. The current repo `.env.example` uses `GITHUB_APP_PRIVATE_KEY_BASE64`; decode it only server-side. Keep names aligned with `.env.example` and prefer a managed secret store in deployed environments.

## 13. Minimum integration test suite

- App installation callback valid/invalid/expired/replayed `state`.
- GitHub account/repository scope validation.
- Installation access-token generation and revocation handling.
- Raw-body signature test vector plus modified-body, malformed-signature, missing-secret and Unicode cases.
- Duplicate delivery ID and duplicate event processing.
- Each event's action allowlist and ignored behavior.
- Upsert mapping for every table in §8, including `merged_at`, review-state mapping, comment types and check SHA association.
- Pagination, 3,000-file limitation and missing patch behavior.
- Rate-limit, 401, 403, 404, 422, 5xx and network retry behavior.
- Out-of-order `synchronize`/`edited` events.
- Repository removal and installation suspension access revocation.
- Cross-workspace RLS and server authorization.

## 14. Official GitHub references

Verify these documents again when registering or changing the production App because GitHub's permission matrix and API behavior can evolve.

- [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/setting-up-a-github-app/choosing-permissions-for-a-github-app)
- [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Using webhooks with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)
- [REST API — Pull requests](https://docs.github.com/en/rest/pulls/pulls)
- [REST API — Pull request reviews](https://docs.github.com/en/rest/pulls/reviews)
- [REST API — Pull request review comments](https://docs.github.com/en/rest/pulls/comments)
- [REST API — Issue comments](https://docs.github.com/en/rest/issues/comments)
- [REST API — Check runs](https://docs.github.com/en/rest/checks/runs)
- [REST API — Check suites](https://docs.github.com/en/rest/checks/suites)
- [REST API — Installation repositories](https://docs.github.com/en/rest/apps/installations)
