# ADR-0004: Enterprise Cloud Infrastructure, Autonomous Autofix, and Commercial Scaling

- **Status:** Accepted
- **Date:** 2026-10-31
- **Relates to:** `docs/PRD.md` (v0.6.0), `docs/ROADMAP_ACCEPTANCE.md` (Phases 9–13), `docs/ARCHITECTURE.md`

## Context

PRAXD has achieved full core post-MVP maturity across Phases 0 through 8 (v0.5.0), verified with 119 automated tests spanning UI ergonomics, GitHub sync, webhook deduplication, evidence-grounded AI review, interactive SSE chat, team presence, policy automation, multi-model adapters, and DORA analytics.

To evolve PRAXD from a developer prototype into an enterprise-grade, commercial SaaS platform (v1.0.0 GA), key architectural decisions must be formalized for:
1. **Automated Quality & Deployment Assurance:** Continuous automated testing and idempotent database migrations.
2. **Key Management & Secret Enclaves:** Moving beyond plaintext environment variables for customer GitHub App private keys.
3. **Autonomous Write-Back Code Remediation:** Enabling 1-click Git commits to resolve findings without violating the "AI is advisory" security principle.
4. **Multi-VCS Decoupling:** Allowing GitLab and Bitbucket support without duplicating business logic.
5. **Billing & Quota Guardrails:** Metering model consumption to prevent denial-of-wallet risks.

## Decisions

### 1. GitHub Actions Quality Gatekeeper & Migration Automation
- Configure `.github/workflows/ci.yml` running `npm run lint`, `npm run typecheck`, and Vitest test suites on all PRs.
- Schema migrations run as automated GitHub Actions deployment jobs utilizing Supabase CLI migration verification.

### 2. Envelope Encryption for Secret Storage
- Employ envelope encryption: sensitive customer credentials (private keys, client secrets, webhook tokens) are encrypted with a unique data encryption key (DEK), which is wrapped by a master key hosted in AWS KMS, HashiCorp Vault, or Vercel Secure Enclave.
- Decrypted keys are held ephemeral in memory and explicitly wiped post-request.

### 3. Guarded Server-Side Git Write-Back Flow
- In Phase 10, PRAXD introduces an "Apply Fix" action.
- Security Invariant: The action requires explicit two-click confirmation from an authorized user.
- Pre-commit AST syntax validation ensures patches parse cleanly before dispatching a commit to GitHub.
- Commits are pushed to a dedicated companion branch (`praxd/fix-...`) or directly to the source branch with clear attribution.

### 4. Pluggable VCS Provider Abstraction (`IVCSProvider`)
- Abstract Git platform dependencies into an interface decoupling Octokit from domain entities.
- Implementations: `GitHubProvider`, `GitLabProvider`, `BitbucketProvider`.
- Common domain model maps Pull Requests, Merge Requests, Commits, and Diffs uniformly.

### 5. Event-Driven Stripe Metering & Quotas
- Record LLM prompt and completion tokens in real time within a lightweight `workspace_usage` table.
- Enforce hard stop limits and Stripe customer portal synchronization via signed webhooks.

## Consequences

- Additional repository permissions (`Contents: write`) will be required only when teams opt into the autonomous autofix feature.
- Multi-VCS abstraction requires careful mapping of GitLab's slightly different diff hunk and thread resolution models.
- Production deployment becomes fully automated, auditable, and resilient.
