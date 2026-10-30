# ADR-0001: Initial PRAXD Architecture

- **Status:** Accepted for MVP planning
- **Date:** 2026-10-30

## Context

PRAXD needs a browser-based GitHub PR workspace with authenticated multi-repository access, synchronized PR data, asynchronous AI review and a dense diff-focused UI. The first release should be achievable as a focused web application without introducing a large microservice fleet.

## Decision

- Next.js App Router + TypeScript for web and server routes.
- Supabase Auth + PostgreSQL for user/workspace data and synchronized read models.
- GitHub App + Octokit for repository access and webhook delivery.
- Durable queue/worker for sync and AI tasks.
- OpenAI API behind a provider adapter for AI review.
- Vercel for the Next.js app; worker execution must use a runtime suitable for durable background jobs.
- Single deployable application with modular domain boundaries; no microservices for MVP.

## Rationale

This stack is familiar, has strong ecosystem support, and permits a small initial implementation while preserving explicit boundaries between GitHub, persistence, job processing, AI and UI.

## Consequences

- Requires separate handling for durable background jobs; request handlers must not run long AI operations inline.
- Supabase RLS and server authorization require careful testing.
- GitHub App permissions and webhook handling are first-class parts of the system, not optional add-ons.
- Exact package versions must be checked and locked during implementation.
