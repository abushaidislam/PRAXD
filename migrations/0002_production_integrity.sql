-- PRAXD additive production-integrity migration.
-- Apply only after 0001_initial_schema.sql.
-- This migration closes documented schema gaps for repository access revocation
-- and structured AI-review evidence. Review in staging before production.

begin;

-- ---------------------------------------------------------------------------
-- Repository access revocation
-- ---------------------------------------------------------------------------
-- `is_disabled` describes GitHub's repository.disabled property. It must not be
-- overloaded to mean that a GitHub App installation lost access to a repo.

alter table public.repositories
  add column if not exists is_accessible boolean not null default true,
  add column if not exists access_revoked_at timestamptz;

-- A repository is readable only while the GitHub App installation is active
-- and the repository remains within the installation's selected scope.
drop policy if exists "repositories_select_member" on public.repositories;
create policy "repositories_select_member" on public.repositories
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and is_accessible = true
    and exists (
      select 1
      from public.github_installations gi
      where gi.id = repositories.installation_id
        and gi.workspace_id = repositories.workspace_id
        and gi.status = 'active'
    )
  );

drop policy if exists "pull_requests_select_member" on public.pull_requests;
create policy "pull_requests_select_member" on public.pull_requests
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.repositories r
      join public.github_installations gi on gi.id = r.installation_id
      where r.id = pull_requests.repository_id
        and r.workspace_id = pull_requests.workspace_id
        and r.is_accessible = true
        and gi.status = 'active'
    )
  );

drop policy if exists "pull_request_files_select_member" on public.pull_request_files;
create policy "pull_request_files_select_member" on public.pull_request_files
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.pull_requests pr
      join public.repositories r on r.id = pr.repository_id
      join public.github_installations gi on gi.id = r.installation_id
      where pr.id = pull_request_files.pull_request_id
        and pr.workspace_id = pull_request_files.workspace_id
        and r.is_accessible = true
        and gi.status = 'active'
    )
  );

drop policy if exists "pull_request_commits_select_member" on public.pull_request_commits;
create policy "pull_request_commits_select_member" on public.pull_request_commits
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.pull_requests pr
      join public.repositories r on r.id = pr.repository_id
      join public.github_installations gi on gi.id = r.installation_id
      where pr.id = pull_request_commits.pull_request_id
        and pr.workspace_id = pull_request_commits.workspace_id
        and r.is_accessible = true
        and gi.status = 'active'
    )
  );

drop policy if exists "pull_request_reviews_select_member" on public.pull_request_reviews;
create policy "pull_request_reviews_select_member" on public.pull_request_reviews
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.pull_requests pr
      join public.repositories r on r.id = pr.repository_id
      join public.github_installations gi on gi.id = r.installation_id
      where pr.id = pull_request_reviews.pull_request_id
        and pr.workspace_id = pull_request_reviews.workspace_id
        and r.is_accessible = true
        and gi.status = 'active'
    )
  );

drop policy if exists "pull_request_comments_select_member" on public.pull_request_comments;
create policy "pull_request_comments_select_member" on public.pull_request_comments
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.pull_requests pr
      join public.repositories r on r.id = pr.repository_id
      join public.github_installations gi on gi.id = r.installation_id
      where pr.id = pull_request_comments.pull_request_id
        and pr.workspace_id = pull_request_comments.workspace_id
        and r.is_accessible = true
        and gi.status = 'active'
    )
  );

drop policy if exists "check_runs_select_member" on public.check_runs;
create policy "check_runs_select_member" on public.check_runs
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.repositories r
      join public.github_installations gi on gi.id = r.installation_id
      where r.id = check_runs.repository_id
        and r.workspace_id = check_runs.workspace_id
        and r.is_accessible = true
        and gi.status = 'active'
    )
  );

drop policy if exists "ai_review_runs_select_member" on public.ai_review_runs;
create policy "ai_review_runs_select_member" on public.ai_review_runs
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.pull_requests pr
      join public.repositories r on r.id = pr.repository_id
      join public.github_installations gi on gi.id = r.installation_id
      where pr.id = ai_review_runs.pull_request_id
        and pr.workspace_id = ai_review_runs.workspace_id
        and r.is_accessible = true
        and gi.status = 'active'
    )
  );

drop policy if exists "ai_findings_select_member" on public.ai_findings;
create policy "ai_findings_select_member" on public.ai_findings
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.ai_review_runs rr
      join public.pull_requests pr on pr.id = rr.pull_request_id
      join public.repositories r on r.id = pr.repository_id
      join public.github_installations gi on gi.id = r.installation_id
      where rr.id = ai_findings.review_run_id
        and rr.workspace_id = ai_findings.workspace_id
        and pr.workspace_id = ai_findings.workspace_id
        and r.is_accessible = true
        and gi.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Structured AI finding evidence
-- ---------------------------------------------------------------------------

alter table public.ai_findings
  add column if not exists verification_steps jsonb not null default '[]'::jsonb,
  add column if not exists recommended_patch jsonb;

alter table public.ai_findings
  drop constraint if exists ai_findings_verification_steps_array_check;
alter table public.ai_findings
  add constraint ai_findings_verification_steps_array_check
  check (jsonb_typeof(verification_steps) = 'array') not valid;

alter table public.ai_findings
  drop constraint if exists ai_findings_recommended_patch_object_check;
alter table public.ai_findings
  add constraint ai_findings_recommended_patch_object_check
  check (recommended_patch is null or jsonb_typeof(recommended_patch) = 'object') not valid;

alter table public.ai_findings
  drop constraint if exists ai_findings_line_range_pair_check;
alter table public.ai_findings
  add constraint ai_findings_line_range_pair_check
  check (
    (line_start is null and line_end is null)
    or (line_start is not null and line_end is not null and line_start > 0 and line_end >= line_start)
  ) not valid;

alter table public.ai_findings
  drop constraint if exists ai_findings_status_check;
alter table public.ai_findings
  add constraint ai_findings_status_check
  check (status in ('open', 'accepted', 'dismissed', 'fixed', 'wont_fix', 'stale')) not valid;

alter table public.ai_findings
  validate constraint ai_findings_verification_steps_array_check;
alter table public.ai_findings
  validate constraint ai_findings_recommended_patch_object_check;
alter table public.ai_findings
  validate constraint ai_findings_line_range_pair_check;
alter table public.ai_findings
  validate constraint ai_findings_status_check;

-- At most one active run per PR. Existing duplicates must be reconciled before
-- applying this index to a database that already contains AI runs.
create unique index if not exists ai_review_runs_one_active_per_pr_idx
  on public.ai_review_runs (pull_request_id)
  where status in ('queued', 'running');

commit;
