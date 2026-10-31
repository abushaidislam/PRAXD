# ADR-0003: Post-MVP Architecture Evolution — Interactive Streaming Chat, Real-Time Collaboration, and Multi-Model Adapters

- **Status:** Accepted
- **Date:** 2026-10-31
- **Relates to:** `docs/PRD.md` (v0.2.0), `docs/ROADMAP_ACCEPTANCE.md` (Phases 5–8), `docs/ARCHITECTURE.md`

## Context

PRAXD's initial release (v0.1.0, Phases 0–4) established a high-density, screenshot-matched PR workspace with dual-pane layout, synchronized diff scrolling, GitHub App synchronization, signed webhooks, evidence-grounded AI reviews, and user-confirmed finding publication.

As we transition into post-MVP development (v0.2.0+), several architectural expansions are required:
1. **Interactive PR Chat (Header Affordance Activation):** The header includes a `Chat` button that was disabled in MVP. Activating it requires low-latency streaming (SSE), conversational state persistence, and diff-bounded prompt assembly.
2. **Multi-User Collaboration & Real-Time Presence:** Transforming PRAXD into a multi-player review workspace requires live presence indicators (showing who is reviewing a PR) and GitHub OAuth SSO.
3. **Multi-Model Inference:** Teams need flexibility to run reviews on Claude 3.7 Sonnet, Gemini 2.5 Flash, or self-hosted models (Ollama/vLLM) without lock-in to a single provider.
4. **Autonomous Policy Enforcement:** Moving beyond purely manual "Run AI Review" triggers to event-driven rules for sensitive branches and files.

## Decisions

### 1. Streaming Server-Sent Events (SSE) for Interactive Chat
- Implement a dedicated Next.js App Router streaming endpoint (`POST /api/pull-requests/[pullRequestId]/chat/stream`) using Node.js runtime and `ReadableStream`.
- Client communicates via EventSource/fetch-stream with token-by-token rendering, markdown code blocks, and line-anchor deep links.
- Chat prompts are dynamically hydrated with PR metadata, git diff hunks, and existing AI findings, strictly capped to 32 KB active diff slice to avoid token bloat.

### 2. Real-Time Presence via Supabase Realtime Channels
- Use Supabase Realtime WebSocket channels (`pr:pr_id`) to broadcast reviewer presence (`userId`, `avatarUrl`, `activeTab`, `currentFile`).
- Avoid persistent database writes for transient presence states; retain database persistence solely for durable internal notes and published comments.

### 3. Provider-Agnostic AI Adapter Interface
- Extend `lib/ai/reviewer.ts` into a pluggable provider abstraction:
  - `OpenAIReviewer` (Responses API / Structured JSON)
  - `AnthropicReviewer` (Claude 3.7 / Tool Calling)
  - `GeminiReviewer` (Gemini 2.5 Flash via `@google/genai`)
  - `CustomOaiReviewer` (OpenAI-compatible local inference endpoints for Ollama/vLLM)
- Configure provider selection at the workspace or environment level with automatic fallback on HTTP 429/503.

### 4. Event-Driven Policy Trigger Engine
- Extend webhook ingestion (`lib/github/webhook-handlers.ts`) to evaluate workspace-defined trigger rules upon `pull_request.opened` and `pull_request.synchronize`.
- Autonomous reviews queue background jobs with an explicit `trigger_source: "automation_rule"` and post high-severity alerts to configured Slack/Discord webhooks.

## Consequences

- Server deployment must support streaming responses (Edge or Node.js runtime with unbounded response streaming).
- Secret sanitization must run on both automated diff contexts and user-submitted chat messages.
- Workspace membership and RLS rules seamlessly extend to chat histories and internal collaboration notes.
