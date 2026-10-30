-- PRAXD initial schema (Supabase PostgreSQL)
-- Review in a development project before production use.

create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.github_installation_status as enum ('active', 'suspended', 'deleted', 'pending');
create type public.pull_request_state as enum ('open', 'closed', 'merged');
create type public.pull_request_review_state as enum ('approved', 'changes_requested', 'commented', 'dismissed', 'pending', 'unknown');
create type public.comment_type as enum ('issue', 'review');
create type public.ai_review_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled', 'stale');
create type public.finding_severity as enum ('critical', 'high', 'medium', 'low', 'info');
create type public.finding_kind as enum ('bug', 'security', 'performance', 'reliability', 'maintainability', 'test_gap', 'style', 'other');
create type public.webhook_status as enum ('received', 'queued', 'processing', 'processed', 'failed', 'ignored');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);

create table public.github_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  installation_id bigint not null unique,
  account_github_id bigint,
  account_login text not null,
  account_type text,
  status public.github_installation_status not null default 'pending',
  permissions jsonb not null default '{}'::jsonb,
  repository_selection text,
  installed_by uuid references auth.users(id),
  suspended_at timestamptz,
  deleted_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index github_installations_workspace_idx on public.github_installations(workspace_id);

create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  installation_id uuid not null references public.github_installations(id) on delete cascade,
  github_repo_id bigint not null,
  owner_login text not null,
  name text not null,
  full_name text not null,
  description text,
  html_url text not null,
  visibility text,
  primary_language text,
  default_branch text,
  is_archived boolean not null default false,
  is_disabled boolean not null default false,
  open_pr_count integer,
  github_created_at timestamptz,
  github_updated_at timestamptz,
  github_pushed_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installation_id, github_repo_id)
);
create index repositories_workspace_fullname_idx on public.repositories(workspace_id, full_name);

create table public.pull_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  repository_id uuid not null references public.repositories(id) on delete cascade,
  github_pr_id bigint not null,
  number integer not null,
  title text not null,
  body text,
  state public.pull_request_state not null default 'open',
  draft boolean not null default false,
  author_login text,
  author_avatar_url text,
  head_ref text,
  head_sha text,
  base_ref text,
  base_sha text,
  additions integer,
  deletions integer,
  changed_files_count integer,
  comments_count integer,
  review_comments_count integer,
  commits_count integer,
  mergeable boolean,
  mergeable_state text,
  html_url text not null,
  github_created_at timestamptz,
  github_updated_at timestamptz,
  github_closed_at timestamptz,
  merged_at timestamptz,
  github_author_association text,
  requested_reviewers jsonb not null default '[]'::jsonb,
  labels jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repository_id, number),
  unique (repository_id, github_pr_id)
);
create index pull_requests_workspace_state_updated_idx on public.pull_requests(workspace_id, state, github_updated_at desc);
create index pull_requests_repository_state_idx on public.pull_requests(repository_id, state, number desc);
create index pull_requests_author_idx on public.pull_requests(workspace_id, author_login);

create table public.pull_request_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pull_request_id uuid not null references public.pull_requests(id) on delete cascade,
  github_file_id text,
  file_path text not null,
  previous_file_path text,
  change_status text not null,
  additions integer,
  deletions integer,
  changes integer,
  patch_text text,
  patch_available boolean not null default false,
  blob_url text,
  raw_url text,
  contents_url text,
  patch_cached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pull_request_id, file_path)
);
create index pull_request_files_pr_idx on public.pull_request_files(pull_request_id, file_path);

create table public.pull_request_commits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pull_request_id uuid not null references public.pull_requests(id) on delete cascade,
  sha text not null,
  message text,
  author_login text,
  author_avatar_url text,
  committed_at timestamptz,
  html_url text,
  created_at timestamptz not null default now(),
  unique (pull_request_id, sha)
);
create index pull_request_commits_pr_date_idx on public.pull_request_commits(pull_request_id, committed_at desc);

create table public.pull_request_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pull_request_id uuid not null references public.pull_requests(id) on delete cascade,
  github_review_id bigint not null unique,
  reviewer_login text,
  reviewer_avatar_url text,
  state public.pull_request_review_state not null default 'unknown',
  body text,
  commit_id text,
  submitted_at timestamptz,
  html_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pull_request_reviews_pr_date_idx on public.pull_request_reviews(pull_request_id, submitted_at desc);

create table public.pull_request_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pull_request_id uuid not null references public.pull_requests(id) on delete cascade,
  github_comment_id bigint not null unique,
  comment_type public.comment_type not null,
  author_login text,
  author_avatar_url text,
  body text not null,
  path text,
  diff_hunk text,
  commit_id text,
  original_commit_id text,
  line integer,
  original_line integer,
  start_line integer,
  side text,
  start_side text,
  in_reply_to_id bigint,
  html_url text,
  created_at_github timestamptz,
  updated_at_github timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pull_request_comments_pr_date_idx on public.pull_request_comments(pull_request_id, created_at_github);
create index pull_request_comments_path_line_idx on public.pull_request_comments(pull_request_id, path, line);

create table public.check_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  repository_id uuid not null references public.repositories(id) on delete cascade,
  pull_request_id uuid references public.pull_requests(id) on delete cascade,
  github_check_id bigint,
  external_id text,
  name text not null,
  head_sha text not null,
  status text,
  conclusion text,
  details_url text,
  started_at timestamptz,
  completed_at timestamptz,
  output_title text,
  output_summary text,
  source text not null default 'check_run',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index check_runs_github_id_unique on public.check_runs(repository_id, github_check_id) where github_check_id is not null;
create index check_runs_pr_sha_idx on public.check_runs(pull_request_id, head_sha);

create table public.ai_review_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pull_request_id uuid not null references public.pull_requests(id) on delete cascade,
  requested_by uuid references auth.users(id),
  head_sha text not null,
  status public.ai_review_status not null default 'queued',
  provider text not null,
  model text not null,
  prompt_version text not null,
  summary text,
  overall_risk text,
  files_considered integer,
  findings_count integer,
  token_usage jsonb,
  error_code text,
  error_message_safe text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_review_runs_pr_date_idx on public.ai_review_runs(pull_request_id, created_at desc);
create index ai_review_runs_workspace_status_idx on public.ai_review_runs(workspace_id, status, created_at desc);

create table public.ai_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_run_id uuid not null references public.ai_review_runs(id) on delete cascade,
  fingerprint text not null,
  severity public.finding_severity not null,
  kind public.finding_kind not null default 'other',
  title text not null,
  description text not null,
  impact text,
  recommendation text,
  confidence numeric(5,4) check (confidence >= 0 and confidence <= 1),
  file_path text,
  line_start integer,
  line_end integer,
  evidence_excerpt text,
  status text not null default 'open',
  is_validated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_run_id, fingerprint),
  check (line_start is null or line_start > 0),
  check (line_end is null or line_end > 0)
);
create index ai_findings_run_severity_idx on public.ai_findings(review_run_id, severity);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid references public.github_installations(id) on delete set null,
  delivery_id text not null unique,
  event_name text not null,
  action_name text,
  status public.webhook_status not null default 'received',
  payload_sha256 text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  safe_error_code text,
  created_at timestamptz not null default now()
);
create index webhook_deliveries_status_received_idx on public.webhook_deliveries(status, received_at);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null,
  resource_type text,
  resource_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_workspace_date_idx on public.audit_logs(workspace_id, created_at desc);

-- Membership helper used by RLS policies. Keep the function's search_path fixed.
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;
revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

-- Enable RLS on all user-facing tables.
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.github_installations enable row level security;
alter table public.repositories enable row level security;
alter table public.pull_requests enable row level security;
alter table public.pull_request_files enable row level security;
alter table public.pull_request_commits enable row level security;
alter table public.pull_request_reviews enable row level security;
alter table public.pull_request_comments enable row level security;
alter table public.check_runs enable row level security;
alter table public.ai_review_runs enable row level security;
alter table public.ai_findings enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "workspaces_select_member" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy "workspace_members_select_member" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "github_installations_select_member" on public.github_installations
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "repositories_select_member" on public.repositories
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "pull_requests_select_member" on public.pull_requests
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "pull_request_files_select_member" on public.pull_request_files
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "pull_request_commits_select_member" on public.pull_request_commits
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "pull_request_reviews_select_member" on public.pull_request_reviews
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "pull_request_comments_select_member" on public.pull_request_comments
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "check_runs_select_member" on public.check_runs
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "ai_review_runs_select_member" on public.ai_review_runs
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "ai_findings_select_member" on public.ai_findings
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "audit_logs_select_member" on public.audit_logs
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- Webhook deliveries are not exposed to authenticated clients. Workers/server use service role.
-- Add write policies only for narrowly scoped server/client use cases. Prefer server-only writes
-- with explicit workspace authorization and the Supabase service role.
