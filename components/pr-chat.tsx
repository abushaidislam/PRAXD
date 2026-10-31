"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Send,
  Square,
  Sparkles,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Code2,
  FileCode,
  CornerDownLeft,
} from "lucide-react";
import { PullRequest } from "@/types/pr";
import {
  ChatMessage,
  ChatStreamEvent,
  ChatCitation,
  SlashCommand,
  SLASH_COMMANDS,
} from "@/types/chat";
import { cn } from "@/lib/utils";

interface PRChatProps {
  pr: PullRequest;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDiff?: (filePath: string, line?: number) => void;
}

export function PRChat({ pr, isOpen, onClose, onNavigateToDiff }: PRChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentReasoning, setCurrentReasoning] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [showCommandsMenu, setShowCommandsMenu] = useState(false);
  const [expandedReasoningMap, setExpandedReasoningMap] = useState<Record<string, boolean>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, currentStatus, scrollToBottom]);

  // Load chat messages on mount / PR change
  useEffect(() => {
    let isCancelled = false;

    async function loadHistory() {
      try {
        const res = await fetch(`/api/pull-requests/${pr.id}/chat/messages`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled) {
            const list = json.messages || json.data?.messages || [];
            setMessages(list);
          }
        }
      } catch {
        // Fall back to empty history
      }
    }

    if (isOpen) {
      loadHistory();
      // Focus textarea on open
      setTimeout(() => textareaRef.current?.focus(), 150);
    }

    return () => {
      isCancelled = true;
    };
  }, [pr.id, isOpen]);

  // Handle clearing chat history
  const handleClearHistory = async () => {
    try {
      await fetch(`/api/pull-requests/${pr.id}/chat/messages`, { method: "DELETE" });
      setMessages([]);
      setStreamingText("");
      setCurrentStatus(null);
      setCurrentReasoning([]);
    } catch {
      // Ignore
    }
  };

  // Stop active generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    if (streamingText) {
      const stoppedMsg: ChatMessage = {
        id: `msg-stopped-${Date.now()}`,
        role: "assistant",
        content: streamingText + "\n\n*(Generation stopped by user)*",
        reasoningSteps: currentReasoning,
        createdAt: new Date().toISOString(),
        status: "complete",
      };
      setMessages((prev) => [...prev, stoppedMsg]);
      setStreamingText("");
    }
  };

  // Send message or trigger slash command
  const handleSendMessage = async (textToSend?: string, command?: SlashCommand) => {
    const rawContent = (textToSend ?? input).trim();
    if (!rawContent && !command) return;

    let activeCommand = command;
    let messageContent = rawContent;

    // Detect typed slash command (e.g. "/explain")
    if (!activeCommand && rawContent.startsWith("/")) {
      const parts = rawContent.split(" ");
      const potentialCmd = parts[0] as SlashCommand;
      if (SLASH_COMMANDS.some((c) => c.command === potentialCmd)) {
        activeCommand = potentialCmd;
        messageContent = parts.slice(1).join(" ") || `Execute ${potentialCmd}`;
      }
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageContent,
      command: activeCommand,
      createdAt: new Date().toISOString(),
      status: "complete",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setShowCommandsMenu(false);
    setIsStreaming(true);
    setCurrentStatus("Initializing analysis...");
    setCurrentReasoning([]);
    setStreamingText("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const conversationHistory = [...messages, userMessage].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const res = await fetch(`/api/pull-requests/${pr.id}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory,
          command: activeCommand,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      const collectedSteps: string[] = [];
      const collectedCitations: ChatCitation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr) as ChatStreamEvent;
              if (event.type === "status") {
                setCurrentStatus(event.message);
              } else if (event.type === "reasoning") {
                collectedSteps.push(event.step);
                setCurrentReasoning([...collectedSteps]);
              } else if (event.type === "delta") {
                accumulatedText += event.text;
                setStreamingText(accumulatedText);
              } else if (event.type === "citation") {
                collectedCitations.push(event.citation);
              } else if (event.type === "done") {
                accumulatedText = event.fullText;
                setStreamingText(accumulatedText);
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch {
              // Parse error on incomplete chunk
            }
          }
        }
      }

      // Append assistant message upon complete stream
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: accumulatedText,
        command: activeCommand,
        reasoningSteps: collectedSteps,
        citations: collectedCitations,
        createdAt: new Date().toISOString(),
        status: "complete",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingText("");
      setCurrentStatus(null);
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Handled cleanly by stop generation
        return;
      }
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Error: ${err.message || "Failed to stream chat response."}`,
        createdAt: new Date().toISOString(),
        status: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStreamingText("");
      setCurrentStatus(null);
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === "Escape") {
      if (showCommandsMenu) {
        setShowCommandsMenu(false);
      } else {
        onClose();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    setShowCommandsMenu(val.startsWith("/") && val.length < 15);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Render markdown with code block copy buttons and line citations
  const renderFormattedContent = (content: string, citations?: ChatCitation[]) => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(renderTextFragment(content.slice(lastIndex, matchIndex), citations));
      }

      const lang = match[1] || "code";
      const code = match[2];
      const blockId = `code-${matchIndex}`;

      parts.push(
        <div
          key={blockId}
          className="my-3 rounded-lg border border-praxd-border-soft bg-[#141414] overflow-hidden text-[12px] font-mono shadow-sm"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#1b1b1b] border-b border-praxd-border-soft text-praxd-text-muted text-[11px]">
            <span className="font-semibold text-praxd-text-secondary">{lang}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(code, blockId)}
              className="flex items-center gap-1 hover:text-praxd-text transition-colors"
              title="Copy code"
            >
              {copiedCodeId === blockId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3 overflow-x-auto text-[#d4d4d4] leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(renderTextFragment(content.slice(lastIndex), citations));
    }

    return parts;
  };

  const renderTextFragment = (text: string, citations?: ChatCitation[]) => {
    // Process markdown headers, bold, bullets, and inline codes
    const lines = text.split("\n");
    return (
      <div key={text.slice(0, 20)} className="space-y-1.5 text-[13px] leading-relaxed text-[#dedede]">
        {lines.map((line, idx) => {
          if (line.startsWith("### ")) {
            return (
              <h4 key={idx} className="font-semibold text-white text-[13px] pt-1.5 pb-0.5">
                {line.slice(4)}
              </h4>
            );
          }
          if (line.startsWith("## ")) {
            return (
              <h3 key={idx} className="font-bold text-white text-[14px] pt-2 pb-1 border-b border-praxd-border-soft/60">
                {line.slice(3)}
              </h3>
            );
          }
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-praxd-text-muted select-none">•</span>
                <span>{renderInlineTokens(line.slice(2), citations)}</span>
              </div>
            );
          }
          if (line.startsWith("> ")) {
            return (
              <blockquote key={idx} className="pl-3 border-l-2 border-praxd-blue/60 italic text-praxd-text-secondary my-1">
                {renderInlineTokens(line.slice(2), citations)}
              </blockquote>
            );
          }
          if (!line.trim()) {
            return <div key={idx} className="h-1" />;
          }
          return <p key={idx}>{renderInlineTokens(line, citations)}</p>;
        })}
      </div>
    );
  };

  const renderInlineTokens = (line: string, citations?: ChatCitation[]) => {
    // Matches inline code `...` and bold **...**
    const tokens = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

    return tokens.map((token, i) => {
      if (token.startsWith("`") && token.endsWith("`")) {
        const codeContent = token.slice(1, -1);

        // Check if token matches a file:line citation (e.g. extension/content.js:1644)
        const isCitation = citations?.some((c) =>
          codeContent.includes(c.filePath)
        ) || /[a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+:\d+/.test(codeContent);

        if (isCitation && onNavigateToDiff) {
          const parts = codeContent.split(":");
          const file = parts[0];
          const lineNum = parts[1] ? parseInt(parts[1], 10) : undefined;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onNavigateToDiff(file, lineNum)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-blue-950/40 text-blue-300 hover:bg-blue-900/60 border border-blue-800/50 font-mono text-[11.5px] transition-colors"
              title="Click to view in Diff"
            >
              <FileCode className="w-3 h-3 text-blue-400" />
              <span>{codeContent}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </button>
          );
        }

        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-[#202020] text-amber-200/90 font-mono text-[11.5px] border border-praxd-border-soft"
          >
            {codeContent}
          </code>
        );
      }
      if (token.startsWith("**") && token.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white">
            {token.slice(2, -2)}
          </strong>
        );
      }
      return token;
    });
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="PRAXD Copilot Chat Assistant"
      className="w-[430px] h-full flex flex-col bg-[#111111] border-l border-praxd-border-soft z-30 shrink-0 select-text shadow-2xl transition-all duration-200"
    >
      {/* Header */}
      <div className="h-[48px] px-3.5 border-b border-praxd-border-soft flex items-center justify-between bg-[#161616] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-praxd-blue/15 border border-praxd-blue/30 flex items-center justify-center text-praxd-blue shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-praxd-text flex items-center gap-1.5">
              PRAXD Copilot
              <span className="text-[11px] px-1.5 py-0.2 rounded bg-[#232323] text-praxd-text-muted font-mono font-normal border border-praxd-border-soft">
                #{pr.number}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={isStreaming}
              className="p-1.5 rounded hover:bg-[#252525] text-praxd-text-muted hover:text-rose-400 transition-colors disabled:opacity-50"
              title="Clear conversation history"
              aria-label="Clear chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#252525] text-praxd-text-muted hover:text-praxd-text transition-colors"
            title="Close chat (Esc)"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message Thread Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="h-full flex flex-col justify-center items-center text-center p-4 space-y-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-praxd-blue/20 to-indigo-500/10 border border-praxd-blue/30 flex items-center justify-center text-praxd-blue shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-[14px] font-medium text-white">Ask PRAXD Copilot</h3>
              <p className="text-[12px] text-praxd-text-muted max-w-[280px]">
                Ask questions about diffs, architecture impact, or test coverage for PR #{pr.number}.
              </p>
            </div>

            {/* Quick Action Slash Commands */}
            <div className="w-full space-y-1.5 pt-2 text-left">
              <p className="text-[11px] font-semibold text-praxd-text-muted uppercase tracking-wider px-1">
                Suggested Commands
              </p>
              {SLASH_COMMANDS.map((cmd) => (
                <button
                  key={cmd.command}
                  type="button"
                  onClick={() => handleSendMessage(undefined, cmd.command)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-[#1a1a1a] hover:bg-[#222222] border border-praxd-border-soft transition-all text-[12px] text-left group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-blue-400 group-hover:text-blue-300 font-medium">
                      {cmd.command}
                    </span>
                    <span className="text-praxd-text-secondary text-[11.5px]">{cmd.label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-praxd-text-muted opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Render Conversation Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col space-y-1.5",
              msg.role === "user" ? "items-end" : "items-start"
            )}
          >
            {/* Command tag badge */}
            {msg.command && (
              <div className="flex items-center gap-1 text-[11px] text-blue-400 font-mono px-1">
                <span>{msg.command}</span>
              </div>
            )}

            <div
              className={cn(
                "max-w-[92%] rounded-xl px-3.5 py-2.5 text-[13px] shadow-sm",
                msg.role === "user"
                  ? "bg-[#252525] text-white border border-[#333333]"
                  : "bg-[#181818] text-[#e0e0e0] border border-praxd-border-soft w-full"
              )}
            >
              {/* Expandable Reasoning Steps for Assistant */}
              {msg.role === "assistant" && msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                <div className="mb-2.5 pb-2 border-b border-praxd-border-soft/60">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedReasoningMap((prev) => ({
                        ...prev,
                        [msg.id]: !prev[msg.id],
                      }))
                    }
                    className="flex items-center gap-1.5 text-[11px] text-praxd-text-muted hover:text-praxd-text-secondary transition-colors select-none"
                  >
                    {expandedReasoningMap[msg.id] ? (
                      <ChevronDown className="w-3 h-3 text-praxd-blue" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-praxd-blue" />
                    )}
                    <span className="font-medium text-praxd-blue">
                      {msg.reasoningSteps.length} reasoning steps
                    </span>
                  </button>

                  {expandedReasoningMap[msg.id] && (
                    <ul className="mt-1.5 pl-4 border-l border-praxd-blue/30 space-y-1 text-[11px] text-praxd-text-secondary font-mono">
                      {msg.reasoningSteps.map((step, sIdx) => (
                        <li key={sIdx} className="list-disc list-inside">
                          {step}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Message Content */}
              {msg.role === "assistant"
                ? renderFormattedContent(msg.content, msg.citations)
                : <p className="whitespace-pre-wrap">{msg.content}</p>}
            </div>

            <span className="text-[10px] text-praxd-text-muted px-1 select-none">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}

        {/* Live Streaming Assistant Message */}
        {isStreaming && (
          <div className="flex flex-col items-start space-y-1.5 w-full">
            <div className="w-full rounded-xl px-3.5 py-2.5 text-[13px] bg-[#181818] text-[#e0e0e0] border border-praxd-border-soft shadow-sm">
              {/* Live Status Banner */}
              {currentStatus && (
                <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-praxd-border-soft/60 text-[11.5px] text-praxd-blue">
                  <span className="inline-block w-2 h-2 rounded-full bg-praxd-blue animate-ping" />
                  <span className="animate-pulse font-medium">{currentStatus}</span>
                </div>
              )}

              {/* Live Reasoning Feed */}
              {currentReasoning.length > 0 && (
                <div className="mb-2 pl-3 border-l border-praxd-blue/40 space-y-0.5 text-[11px] text-praxd-text-muted font-mono">
                  {currentReasoning.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-praxd-blue">✓</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Live Streaming Text */}
              {streamingText ? (
                <div>
                  {renderFormattedContent(streamingText)}
                  <span className="inline-block w-1.5 h-3.5 bg-praxd-blue ml-0.5 animate-pulse select-none" />
                </div>
              ) : (
                <div className="py-2 text-[12px] text-praxd-text-muted animate-pulse">
                  PRAXD Copilot is thinking...
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Slash Commands Autocomplete Popup */}
      {showCommandsMenu && (
        <div className="mx-3 mb-1 p-1 bg-[#1c1c1c] border border-praxd-border-soft rounded-lg shadow-xl z-20 space-y-0.5">
          <div className="px-2 py-1 text-[10px] font-semibold text-praxd-text-muted uppercase tracking-wider">
            Available Slash Commands
          </div>
          {SLASH_COMMANDS.map((cmd) => (
            <button
              key={cmd.command}
              type="button"
              onClick={() => handleSendMessage(undefined, cmd.command)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#262626] text-left text-[12px] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-blue-400 font-medium">{cmd.command}</span>
                <span className="text-praxd-text-secondary text-[11.5px]">{cmd.label}</span>
              </div>
              <CornerDownLeft className="w-3 h-3 text-praxd-text-muted" />
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-praxd-border-soft bg-[#161616] shrink-0 space-y-2">
        <div className="relative rounded-lg border border-praxd-border-soft bg-[#1c1c1c] focus-within:border-praxd-blue/80 focus-within:ring-1 focus-within:ring-praxd-blue/30 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this PR, or type / for commands..."
            disabled={isStreaming}
            rows={2}
            className="w-full px-3 py-2 text-[12.5px] bg-transparent text-praxd-text placeholder:text-praxd-text-muted resize-none focus:outline-none disabled:opacity-60"
          />

          <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-praxd-border-soft/50 bg-[#191919]">
            <div className="flex items-center gap-1.5">
              {SLASH_COMMANDS.map((cmd) => (
                <button
                  key={cmd.command}
                  type="button"
                  onClick={() => handleSendMessage(undefined, cmd.command)}
                  disabled={isStreaming}
                  className="px-1.5 py-0.5 text-[10.5px] font-mono rounded bg-[#252525] hover:bg-[#303030] text-praxd-text-secondary hover:text-white border border-praxd-border-soft/60 transition-colors disabled:opacity-40"
                  title={cmd.description}
                >
                  {cmd.command}
                </button>
              ))}
            </div>

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="flex items-center gap-1 px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-[11px] font-medium transition-colors"
                title="Stop generation"
              >
                <Square className="w-3 h-3 fill-rose-300" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!input.trim()}
                className="p-1.5 rounded bg-praxd-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:hover:bg-praxd-blue shadow-sm"
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-[10.5px] text-praxd-text-muted">
          <span>Bounded to 32 KB active diff · Secrets redacted</span>
          <span className="font-mono">Ctrl+K to toggle</span>
        </div>
      </div>
    </aside>
  );
}
