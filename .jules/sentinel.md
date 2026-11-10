## 2026-03-31 - Untrusted URL Scheme Validation in Markdown Content

**Vulnerability:**
The `sanitizeUrl` utility in `components/markdown-content.tsx` used a faulty regular expression `/^(javascript|vbscript|data:(?!image\/)):/i` which failed to match `data:text/html;base64,...` (because it required a colon after the negative lookahead). This allowed attackers to craft malicious links in PR descriptions or comments with executable HTML/JS data payloads (`data:text/html;...`), leading to Cross-Site Scripting (XSS) upon click. Additionally, scheme checks could be bypassed if URLs contained leading whitespace or ASCII control characters.

**Learning:**
Blocklist-based regex checks for URLs with complex negative lookaheads are prone to subtle parsing discrepancies and bypasses when encountering obfuscated schemes, whitespace, or control characters.

**Prevention:**
Normalize URLs by stripping control characters and whitespace first, and adopt an allowlist pattern for valid web schemes (`http:`, `https:`, `mailto:`, safe relative paths) while strictly restricting `data:` URIs to safe raster image MIME types (`data:image/(png|jpeg|jpg|gif|webp);base64,`).

## 2026-04-01 - Missing Workspace Scoping in Service Role Database Queries on PR Merge Route

**Vulnerability:**
The PR merge endpoint (`app/api/pull-requests/[pullRequestId]/merge/route.ts`) resolved pull request records and associated repositories using `createServiceRoleClient()` without filtering by `workspace_id`. Because the service role client bypasses PostgreSQL Row Level Security (RLS), an authenticated tenant from Workspace A could resolve or mutate pull requests belonging to Workspace B by identifier.

**Learning:**
Using the Supabase service role client on the server bypasses database-level RLS policies entirely. Whenever `createServiceRoleClient()` is used for reads or mutations, explicit `.eq("workspace_id", auth.workspaceId)` filters must be applied to every query chain.

**Prevention:**
Audit all server route handlers that instantiate `createServiceRoleClient()` and ensure every `.from(...)` query explicitly includes `.eq("workspace_id", auth.workspaceId)` across selects, updates, and deletes.
