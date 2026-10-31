export type ChatMessageRole = "user" | "assistant" | "system";

export type SlashCommand =
  | "/explain"
  | "/test-ideas"
  | "/draft-response"
  | "/security-audit";

export interface ChatCitation {
  filePath: string;
  lineStart?: number | null;
  lineEnd?: number | null;
  excerpt?: string | null;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
  command?: SlashCommand;
  reasoningSteps?: string[];
  citations?: ChatCitation[];
  status?: "sending" | "streaming" | "complete" | "error";
  error?: string;
}

export interface ChatStreamRequest {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  command?: SlashCommand;
  activeFile?: string;
  activeLines?: {
    start: number;
    end: number;
  };
}

export type ChatStreamEvent =
  | { type: "status"; message: string }
  | { type: "reasoning"; step: string }
  | { type: "delta"; text: string }
  | { type: "citation"; citation: ChatCitation }
  | { type: "done"; fullText: string; error?: string }
  | { type: "error"; error: string };

export interface ChatSlashCommandDefinition {
  command: SlashCommand;
  label: string;
  description: string;
  promptPrefix: string;
}

export const SLASH_COMMANDS: ChatSlashCommandDefinition[] = [
  {
    command: "/explain",
    label: "Explain PR",
    description: "Architectural overview and intent of this pull request",
    promptPrefix: "Provide a clear architectural walkthrough of what this PR does, why it was created, and its structural changes.",
  },
  {
    command: "/test-ideas",
    label: "Test Ideas",
    description: "Edge cases and recommended tests for changed logic",
    promptPrefix: "Analyze the logic changes and recommend critical unit, edge-case, and regression tests.",
  },
  {
    command: "/draft-response",
    label: "Draft Review Comment",
    description: "Draft constructive, polite review feedback for the author",
    promptPrefix: "Draft a constructive, empathetic, and professional review comment for the pull request author.",
  },
  {
    command: "/security-audit",
    label: "Security Audit",
    description: "Deep-dive security and taint analysis across the diff",
    promptPrefix: "Perform a rigorous security review of user inputs, sanitization, data flows, and potential vulnerabilities.",
  },
];
