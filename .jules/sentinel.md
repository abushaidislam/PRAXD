## 2026-03-31 - Untrusted URL Scheme Validation in Markdown Content

**Vulnerability:**
The `sanitizeUrl` utility in `components/markdown-content.tsx` used a faulty regular expression `/^(javascript|vbscript|data:(?!image\/)):/i` which failed to match `data:text/html;base64,...` (because it required a colon after the negative lookahead). This allowed attackers to craft malicious links in PR descriptions or comments with executable HTML/JS data payloads (`data:text/html;...`), leading to Cross-Site Scripting (XSS) upon click. Additionally, scheme checks could be bypassed if URLs contained leading whitespace or ASCII control characters.

**Learning:**
Blocklist-based regex checks for URLs with complex negative lookaheads are prone to subtle parsing discrepancies and bypasses when encountering obfuscated schemes, whitespace, or control characters.

**Prevention:**
Normalize URLs by stripping control characters and whitespace first, and adopt an allowlist pattern for valid web schemes (`http:`, `https:`, `mailto:`, safe relative paths) while strictly restricting `data:` URIs to safe raster image MIME types (`data:image/(png|jpeg|jpg|gif|webp);base64,`).

## 2026-04-16 - Cross-Tenant PR File Exposure via Service Role Client Fallback

**Vulnerability:**
In `app/api/pull-requests/[pullRequestId]/files/route.ts`, when diff files were not yet cached in `pull_request_files`, the route fetched PR details using `createServiceRoleClient()` to resolve the repository owner and name from `pull_requests`. The fallback database query queried only by `.eq("id", pullRequestId)` without scoping by `.eq("workspace_id", auth.workspaceId)`. Because the service role client bypasses PostgreSQL Row Level Security (RLS), an authenticated tenant could query an arbitrary PR ID belonging to another tenant and trigger GitHub API calls to retrieve changed files and diff patches across workspace boundaries.

**Learning:**
When using Supabase service role clients in server route handlers, PostgreSQL RLS policies are bypassed entirely. If any subsequent query in a route handler neglects to re-apply tenant boundaries (`workspace_id`), multi-tenant isolation is broken even if the primary query checked tenant access.

**Prevention:**
Always enforce explicit `.eq("workspace_id", auth.workspaceId)` filters on every database operation performed using service role clients, especially in fallback or secondary lookup paths.
