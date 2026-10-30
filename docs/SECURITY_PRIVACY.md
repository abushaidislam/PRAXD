# Security & Privacy Requirements

## 1. Threat model

PRAXD processes GitHub installation metadata, repository/PR metadata, comments, patches and AI review results. Treat these as sensitive developer data. Main threat areas:

- Stolen GitHub App credentials or installation tokens.
- Cross-workspace data access.
- Forged/replayed webhooks.
- Malicious PR descriptions/comments/code attempting prompt injection.
- Secrets embedded in source diffs.
- XSS through PR Markdown, filenames or comments.
- Abuse of AI review endpoints causing cost spikes.
- Overly broad GitHub permissions.

## 2. Authentication and authorization

- Supabase Auth session required for user-facing routes.
- Workspace membership checked for every resource access.
- RLS enabled on every exposed table.
- Server role/service key only in server-side execution environments.
- Workspace and repository IDs from the browser are untrusted; resolve them and validate membership before reads/writes.
- Use explicit roles for future workspace administration.

## 3. Credential handling

- GitHub App private key and webhook secret are server-side secrets.
- Never expose them in `NEXT_PUBLIC_*`, HTML, logs, browser storage or client responses.
- Do not persist short-lived installation access tokens unless a justified token-refresh design requires it. Prefer generating them just-in-time and keeping them ephemeral.
- If any refresh/user token must be stored, encrypt at rest using authenticated encryption (e.g. AES-256-GCM with managed key rotation/KMS envelope encryption), store nonce/tag/key version and restrict decryption to a minimal server module.
- AI provider keys are server-only.
- Use separate secrets for local, staging and production.

## 4. Webhook security

- Verify `X-Hub-Signature-256` over the raw request body with HMAC-SHA256.
- Use constant-time comparison.
- Require/record delivery ID and event header.
- Enforce unique delivery ID and idempotent processing.
- Validate payload shape and installation association before scheduling work.
- Apply request-size limits and rate controls.

## 5. Prompt injection and untrusted data

- Repository code, comments, PR descriptions, branch names, filenames and commit messages are data, not instructions.
- Keep model instructions separate from retrieved content.
- Do not provide tools, credentials, secrets or write capabilities to the MVP review model.
- No automatic merge, approval, GitHub comment write or code execution based on model output.
- Validate every model response before persistence/rendering.

## 6. Secret detection and data minimization

- Scan patch/context for common credential patterns and redact before sending to an AI provider.
- Do not log raw diff text, full webhook payloads, tokens or private keys.
- Persist only necessary GitHub metadata, comments and review results.
- Make patch caching optional and time-limited; set a clear retention policy.
- Provide disconnect and delete-data flows for a workspace/installation.
- Review AI provider data handling and configure privacy controls before production.

## 7. XSS and content safety

- Treat PR descriptions/comments as untrusted Markdown.
- Render Markdown through a safe pipeline; sanitize HTML and disallow scripts/event handlers/unsafe URL schemes.
- Never set unsanitized `dangerouslySetInnerHTML` from GitHub or AI content.
- Render source code in text/code components, not as HTML.
- Validate external image/avatar URLs and use safe image handling.

## 8. Abuse controls

- Rate-limit login, connection, sync and AI review operations.
- Per-user and per-workspace AI request quotas.
- Maximum files, patch bytes, context tokens, output tokens and retry counts.
- Deduplicate same PR/head/prompt active jobs.
- Reject unauthorized repository IDs and mismatched head SHAs.

## 9. Audit and observability

Record safe metadata for:

- GitHub installation connected/disconnected/suspended.
- Workspace membership/role changes.
- AI review requested/completed/failed/cancelled.
- Security-relevant authorization failures.

Do not log secrets, complete code files, raw tokens or full webhook bodies. Include request/job/delivery IDs for correlation.

## 10. Production release gate

Before production:

- [ ] Threat model reviewed.
- [ ] RLS tested with two distinct workspaces/users.
- [ ] GitHub app permissions reviewed for least privilege.
- [ ] Webhook signature and replay/deduplication tests pass.
- [ ] Secrets are stored in a managed secret store.
- [ ] Markdown/XSS sanitization tests pass.
- [ ] Prompt-injection test fixtures pass.
- [ ] AI provider privacy/retention configuration reviewed.
- [ ] Data retention/deletion behavior documented and tested.
- [ ] Logs are redacted and monitored.
