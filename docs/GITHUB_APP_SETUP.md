# GitHub App Setup — Superseded

This short setup note is retained to avoid breaking older links. The authoritative and complete implementation specification is now [`GITHUB_INTEGRATION.md`](GITHUB_INTEGRATION.md).

Use that document for:

- Exact GitHub App repository permissions and least-privilege configuration.
- Webhook event subscriptions and required permission matrix.
- Raw-body HMAC SHA-256 signature verification.
- Installation lifecycle, idempotency, retries and synchronization.
- Exact mapping from GitHub payloads to the tables in `migrations/0001_initial_schema.sql`.

Do not implement from this legacy note.
