## 2026-03-31 - Missing Workspace Isolation in Service-Role Fallback Queries

**Vulnerability:**
In `app/api/pull-requests/[pullRequestId]/merge/route.ts` and `app/api/pull-requests/[pullRequestId]/files/route.ts`, fallback database lookups and update operations used the Supabase service-role client (`createServiceRoleClient()`) without filtering by `workspace_id`. Because the service-role client bypasses PostgreSQL Row Level Security (RLS), an authenticated user from one tenant workspace could look up or execute merge actions against pull requests belonging to a different tenant workspace if they knew or guessed the PR UUID.

**Learning:**
Using the service-role client bypasses all database-level RLS policies. Any route handler utilizing `createServiceRoleClient()` must strictly include `.eq("workspace_id", auth.workspaceId)` in every query, mutation, and update filter to enforce tenant isolation.

**Prevention:**
Always audit service-role queries in route handlers to ensure explicit `workspace_id` filtering on both reads and writes.

## 2026-03-31 - Untrusted URL Scheme Validation in Markdown Content

**Vulnerability:**
The `sanitizeUrl` utility in `components/markdown-content.tsx` used a faulty regular expression `/^(javascript|vbscript|data:(?!image\/)):/i` which failed to match `data:text/html;base64,...` (because it required a colon after the negative lookahead). This allowed attackers to craft malicious links in PR descriptions or comments with executable HTML/JS data payloads (`data:text/html;...`), leading to Cross-Site Scripting (XSS) upon click. Additionally, scheme checks could be bypassed if URLs contained leading whitespace or ASCII control characters.

**Learning:**
Blocklist-based regex checks for URLs with complex negative lookaheads are prone to subtle parsing discrepancies and bypasses when encountering obfuscated schemes, whitespace, or control characters.

**Prevention:**
Normalize URLs by stripping control characters and whitespace first, and adopt an allowlist pattern for valid web schemes (`http:`, `https:`, `mailto:`, safe relative paths) while strictly restricting `data:` URIs to safe raster image MIME types (`data:image/(png|jpeg|jpg|gif|webp);base64,`).
