# Technical References

Use official documentation as the final authority when implementation begins. GitHub APIs and framework packages evolve; verify endpoint permission requirements and package versions at that time.

## GitHub

- [REST API — Pull requests](https://docs.github.com/en/rest/pulls/pulls)
- [REST API — Pull request reviews](https://docs.github.com/en/rest/pulls/reviews)
- [REST API — Issue comments](https://docs.github.com/en/rest/issues/comments)
- [REST API — Checks](https://docs.github.com/en/rest/checks)
- [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [Validate webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app)
- [Choosing GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
- [GitHub App best practices](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)

## Application platform

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Implementation note

GitHub PR list, PR detail, changed files, commits, reviews, line comments, issue conversation comments and checks are separate resources. Build an adapter that composes them. Do not assume one endpoint contains the entire PR screen.

GitHub documents a 3,000-file maximum for the PR changed-files endpoint response and a maximum page size of 100 for that endpoint. The UI must handle missing patches and large PRs gracefully. Verify these limits again before shipping.
