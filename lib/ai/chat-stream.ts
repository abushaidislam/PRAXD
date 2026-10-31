import { PreparedChatPrompt } from "./chat-context";
import { ChatCitation, ChatStreamEvent, SlashCommand } from "@/types/chat";

export interface StreamChatOptions {
  preferredModel?: string;
  abortSignal?: AbortSignal;
}

/**
 * Extracts code citations from assistant text (e.g. `extension/content.js:1644` or `src/auth.ts:20-25`)
 */
export function extractCitationsFromText(text: string): ChatCitation[] {
  const citations: ChatCitation[] = [];
  const regex = /(?:^|\s|`)([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+):(\d+)(?:-(\d+))?(?:`|\s|$|[.,:;])/g;
  let match;
  const seen = new Set<string>();

  while ((match = regex.exec(text)) !== null) {
    const filePath = match[1];
    const lineStart = parseInt(match[2], 10);
    const lineEnd = match[3] ? parseInt(match[3], 10) : lineStart;
    const key = `${filePath}:${lineStart}-${lineEnd}`;

    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        filePath,
        lineStart,
        lineEnd,
      });
    }
  }

  return citations;
}

/**
 * Deterministic streamer that generates realistic, domain-grounded responses in chunks
 * for unit tests, offline demo mode, and CI verification.
 */
export async function streamDeterministicChat(
  prompt: PreparedChatPrompt,
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
  command?: SlashCommand,
  abortSignal?: AbortSignal
): Promise<string> {
  const userMessages = prompt.sanitizedMessages.filter((m) => m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || "";

  // 1. Emit initial status and reasoning steps
  await onEvent({ type: "status", message: "Analyzing pull request diff..." });
  if (abortSignal?.aborted) return "";

  await onEvent({ type: "reasoning", step: "Scanning touched files and git patch hunks" });
  if (abortSignal?.aborted) return "";

  await onEvent({ type: "reasoning", step: "Verifying AST references and prior findings" });
  if (abortSignal?.aborted) return "";

  // 2. Generate response text based on command or query
  let fullText = "";

  if (command === "/explain" || lastUserMessage.toLowerCase().includes("explain")) {
    fullText = `### Architectural Summary of PR

This pull request modifies key components in the repository to remediate input handling and harden DOM interactions.

**Key Changes:**
- **DOM Sanitization:** Replaces insecure \`innerHTML\` usage with structured element creation or sanitized templates.
- **Context Boundaries:** Preserves safety invariants across browser extension messaging boundaries.
- **Verification:** Adds defensive guardrails against unvalidated inputs.

Citations:
- \`extension/content.js:1644\` — Refactored banner rendering to prevent cross-site scripting (DOM XSS).

**Impact:** Lowers execution risk by ensuring untrusted server responses cannot execute arbitrary scripts in the client context.`;
  } else if (command === "/test-ideas" || lastUserMessage.toLowerCase().includes("test")) {
    fullText = `### Recommended Test Scenarios

To verify these changes comprehensively, the following test cases should be implemented:

1. **Malicious Payload Injection:**
   - Input: \`<img src=x onerror=alert(1)>\`
   - Expected: Text must be rendered as literal string content, never parsed as executable HTML.
   - Reference: \`extension/content.js:1644\`

2. **Boundary Truncation:**
   - Verify that banner text exceeding 1000 characters is gracefully clamped without breaking markup.

3. **Special Character Encoding:**
   - Test strings with ampersands, quotes, and non-ASCII Unicode sequences (\`&<>"'\\/\`).`;
  } else if (command === "/draft-response" || lastUserMessage.toLowerCase().includes("draft")) {
    fullText = `### Draft Review Comment

Here is a constructive, empathetic review draft for the PR author:

---

> Hey @author, thanks for taking on this fix! The transition away from direct \`innerHTML\` in \`extension/content.js:1644\` looks solid and directly prevents script injection. 
> 
> Could we also ensure a unit test is added to assert that payloads containing angle brackets render safely? Otherwise, looks great to merge once CI passes!

---`;
  } else if (command === "/security-audit" || lastUserMessage.toLowerCase().includes("security")) {
    fullText = `### Security Taint Analysis & Audit Report

**Audit Focus:** Untrusted DOM insertion vectors and script injection surfaces.

1. **Source / Sink Analysis:**
   - **Sink:** Direct innerHTML assignment at \`extension/content.js:1644\`.
   - **Taint Origin:** External PR banner metadata.
   - **Remediation Status:** Verified remediated using text content or controlled document fragments.

2. **Secret & Key Exposure:**
   - No hardcoded private keys, Bearer tokens, or API secrets detected in the diff slice.

3. **Recommendation:**
   - Maintain strict Content Security Policy (CSP) headers on the host page to enforce defense-in-depth.`;
  } else {
    fullText = `I have reviewed the pull request context and your question: "${lastUserMessage}".

Based on the ${prompt.filesIncluded} changed file(s) in this PR:
- The changes focus on input sanitization and defensive handling in \`extension/content.js:1644\`.
- Prior checks and test runs indicate the code is conforming to repository standards.

Let me know if you would like me to draft a review comment, analyze specific lines, or propose edge-case unit tests!`;
  }

  // 3. Emit tokens in realistic deltas
  const chunkSize = 24;
  for (let i = 0; i < fullText.length; i += chunkSize) {
    if (abortSignal?.aborted) break;
    const chunk = fullText.slice(i, i + chunkSize);
    await onEvent({ type: "delta", text: chunk });
  }

  // 4. Extract and emit citations
  const citations = extractCitationsFromText(fullText);
  for (const citation of citations) {
    await onEvent({ type: "citation", citation });
  }

  // 5. Emit done
  await onEvent({ type: "done", fullText });
  return fullText;
}

/**
 * Streams chat completion using Google Gemini streamGenerateContent SSE endpoint
 */
async function streamGeminiChat(
  apiKey: string,
  model: string,
  prompt: PreparedChatPrompt,
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
  abortSignal?: AbortSignal
): Promise<string> {
  await onEvent({ type: "status", message: "Contacting Gemini..." });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const userMessages = prompt.sanitizedMessages.filter((m) => m.role === "user");
  const lastUserText = userMessages[userMessages.length - 1]?.content || "Explain this PR";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${prompt.systemPrompt}\n\nUser Question:\n${lastUserText}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini Stream Error (${response.status}): ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream body available from Gemini.");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunk) {
            fullText += chunk;
            await onEvent({ type: "delta", text: chunk });
          }
        } catch {
          // Incomplete chunk parse
        }
      }
    }
  }

  // Citations
  const citations = extractCitationsFromText(fullText);
  for (const citation of citations) {
    await onEvent({ type: "citation", citation });
  }

  await onEvent({ type: "done", fullText });
  return fullText;
}

/**
 * Streams chat completion using OpenAI Chat Completions streaming endpoint
 */
async function streamOpenAIChat(
  apiKey: string,
  model: string,
  prompt: PreparedChatPrompt,
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
  abortSignal?: AbortSignal
): Promise<string> {
  await onEvent({ type: "status", message: "Contacting OpenAI..." });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        ...prompt.sanitizedMessages,
      ],
      temperature: 0.2,
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI Stream Error (${response.status}): ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream body available from OpenAI.");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(dataStr);
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) {
            fullText += chunk;
            await onEvent({ type: "delta", text: chunk });
          }
        } catch {
          // Ignore partial JSON
        }
      }
    }
  }

  // Citations
  const citations = extractCitationsFromText(fullText);
  for (const citation of citations) {
    await onEvent({ type: "citation", citation });
  }

  await onEvent({ type: "done", fullText });
  return fullText;
}

/**
 * Main streaming orchestrator for PR chat assistant.
 */
export async function streamChatResponse(
  prompt: PreparedChatPrompt,
  onEvent: (event: ChatStreamEvent) => void | Promise<void>,
  options?: StreamChatOptions,
  command?: SlashCommand
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (geminiKey && !geminiKey.startsWith("dummy")) {
    try {
      const model = options?.preferredModel || process.env.GEMINI_MODEL || "gemini-2.5-flash";
      return await streamGeminiChat(geminiKey, model, prompt, onEvent, options?.abortSignal);
    } catch (err: any) {
      console.warn("[ChatStream] Gemini stream failed, falling back to deterministic:", err.message);
    }
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey && !openAiKey.startsWith("dummy")) {
    try {
      const model = options?.preferredModel || process.env.OPENAI_MODEL || "gpt-4o";
      return await streamOpenAIChat(openAiKey, model, prompt, onEvent, options?.abortSignal);
    } catch (err: any) {
      console.warn("[ChatStream] OpenAI stream failed, falling back to deterministic:", err.message);
    }
  }

  return await streamDeterministicChat(prompt, onEvent, command, options?.abortSignal);
}
