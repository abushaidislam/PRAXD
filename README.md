# PRAXD — Project Documentation Pack

**Product:** PRAXD  
**Description:** AI-powered GitHub Pull Request workspace  
**Status:** Pre-build specification (documentation only)  
**Version:** 0.1.0  
**Primary design references:** `reference/praxd-reference-pr-summary.png` and `reference/praxd-reference-code-diff.png`

PRAXD is a web application for connecting GitHub repositories, monitoring pull requests, reviewing changes, inspecting comments/checks, and running AI-assisted code reviews. The product's primary workspace intentionally follows the supplied reference screenshots: a persistent pull-request inbox on the left and a focused Summary/Code workspace on the right.

> This package is a build specification, not a working application. It does not include GitHub credentials, Supabase credentials, an OpenAI key, or a registered GitHub App.

## Read in this order

1. [`START_HERE.md`](START_HERE.md) — instructions for the coding agent and non-negotiable build rules.
2. [`docs/PRD.md`](docs/PRD.md) — product requirements and scope.
3. [`docs/UI_UX_SPEC.md`](docs/UI_UX_SPEC.md) — screenshot-derived layout, interactions and design tokens.
4. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture and event flow.
5. [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md), [`migrations/0001_initial_schema.sql`](migrations/0001_initial_schema.sql) and [`migrations/0002_production_integrity.sql`](migrations/0002_production_integrity.sql) — data model, initial schema and required additive production-integrity migration.
6. [`docs/API_SPEC.md`](docs/API_SPEC.md) — application API contracts.
7. [`docs/GITHUB_INTEGRATION.md`](docs/GITHUB_INTEGRATION.md) — authoritative GitHub App permissions, webhook security, event routing and schema mapping.
8. [`docs/AI_REVIEW_SPEC.md`](docs/AI_REVIEW_SPEC.md) — strict AI review contract, JSON Schema, context budgeting, validation and run lifecycle.
9. [`docs/SECURITY_PRIVACY.md`](docs/SECURITY_PRIVACY.md) — security requirements.
10. [`docs/ROADMAP_ACCEPTANCE.md`](docs/ROADMAP_ACCEPTANCE.md) — phased implementation plan, acceptance criteria, test scenarios and ship checklist.

## Product decisions captured in this pack

- **Platform:** responsive web application; desktop-first for the PR workspace.
- **Initial operating model:** one account/workspace can connect one or more GitHub App installations. The data model is workspace-aware so team/SaaS support can be added without a rewrite.
- **Review mode:** manual AI review first. Automatic review on new/updated PRs is a later opt-in capability.
- **GitHub actions:** read-only integration for the MVP. Publishing AI findings as GitHub review comments is a later, explicitly permissioned feature.
- **AI is advisory:** PRAXD must not automatically approve, merge, or close pull requests.
- **Data source of truth:** GitHub remains authoritative for repository, PR, review, comment, commit and CI status data. PRAXD keeps a local synchronized read model and AI review history.

## Recommended stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui + Lucide
- Supabase (PostgreSQL, Auth, Storage; Row Level Security)
- GitHub App + Octokit REST client + signed webhooks
- OpenAI API behind a provider adapter and structured-output validation
- Durable background jobs (Inngest or an equivalent queue adapter)
- Vercel deployment

Exact package versions must be selected and locked at implementation time. Do not copy stale version numbers from this document.

## Repository layout expected from the implementation

```text
praxd/
├── app/                    # Next.js routes, layouts and route handlers
├── components/             # UI components, including PR workspace
├── features/               # repositories, pull-requests, reviews, settings
├── lib/                    # GitHub, Supabase, AI, queue, validation utilities
├── database/               # generated database types / supplemental SQL
├── tests/                  # unit, integration and end-to-end tests
├── public/
├── docs/                   # copy these project specifications here
├── .env.example
├── AGENTS.md
└── README.md
```

## External references

- [GitHub REST API — Pull requests](https://docs.github.com/en/rest/pulls/pulls)
- [GitHub REST API — Pull request reviews](https://docs.github.com/en/rest/pulls/reviews)
- [GitHub webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [GitHub webhook signature validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [PRAXD GitHub integration contract](docs/GITHUB_INTEGRATION.md)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs)

## Important

The screenshots are visual references, not permission to copy GitHub/Codex branding or proprietary assets. PRAXD must use its own name, logo, icons and copy while reproducing the reference's layout, information hierarchy, density, interaction patterns and dark visual style.
