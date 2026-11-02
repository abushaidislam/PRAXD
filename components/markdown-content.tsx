"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  ChevronRight,
  Clock,
  Info,
  Lightbulb,
  AlertCircle,
  TriangleAlert,
  ShieldAlert,
} from "lucide-react";
import { CopyIcon } from "./copy-icon";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Common GitHub emoji shortcode mappings
 */
const EMOJI_MAP: Record<string, string> = {
  ":white_check_mark:": "✅",
  ":heavy_check_mark:": "✔️",
  ":bookmark_tabs:": "📑",
  ":bookmark:": "🔖",
  ":eyes:": "👀",
  ":thumbsup:": "👍",
  ":+1:": "👍",
  ":thumbsdown:": "👎",
  ":-1:": "👎",
  ":information_source:": "ℹ️",
  ":warning:": "⚠️",
  ":rocket:": "🚀",
  ":tada:": "🎉",
  ":sparkles:": "✨",
  ":x:": "❌",
  ":link:": "🔗",
  ":lock:": "🔒",
  ":unlock:": "🔓",
  ":bug:": "🐛",
  ":zap:": "⚡",
  ":recycle:": "♻️",
  ":memo:": "📝",
  ":pencil:": "📝",
  ":gear:": "⚙️",
  ":clock:": "🕒",
  ":hourglass:": "⌛",
  ":white_circle:": "⚪",
  ":black_circle:": "⚫",
  ":red_circle:": "🔴",
  ":green_circle:": "🟢",
  ":large_blue_circle:": "🔵",
  ":yellow_circle:": "🟡",
  ":shield:": "🛡️",
  ":package:": "📦",
  ":wrench:": "🔧",
  ":construction:": "🚧",
  ":bulb:": "💡",
  ":fire:": "🔥",
  ":speech_balloon:": "💬",
};

/**
 * Sanitizes URLs to prevent XSS (javascript:, vbscript:, unsafe data: URIs, etc.).
 * Strips hidden control characters and only permits safe web protocols (http, https, mailto),
 * safe relative paths, and safe raster images for data: URIs.
 */
function sanitizeUrl(url?: string): string {
  if (!url) return "#";
  const trimmed = url.trim();
  // Strip ASCII control characters (0x00-0x1F, 0x7F) and whitespace before evaluating protocol
  const normalized = trimmed.replace(/[\u0000-\u001F\u007F\s]+/g, "");

  // Detect URI schemes (e.g., "javascript:", "data:", "https:")
  const schemeMatch = normalized.match(/^([a-zA-Z0-9+.-]+):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "http" || scheme === "https" || scheme === "mailto") {
      return trimmed;
    }
    if (scheme === "data" && /^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=]+$/i.test(normalized)) {
      return trimmed;
    }
    // Block all other schemes (javascript:, vbscript:, file:, data:text/html, etc.)
    return "#";
  }

  // Safe relative paths (#anchor, /path, ./path, etc.)
  return trimmed;
}

/**
 * Safely parses HTML attributes from tag string
 */
function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_\-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(attrStr)) !== null) {
    const key = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    attrs[key] = value;
  }
  return attrs;
}

/**
 * Formats ISO timestamps into relative and readable strings
 */
function formatTimestamp(dateStr?: string): { relative: string; full: string } {
  if (!dateStr) return { relative: "", full: "" };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { relative: dateStr, full: dateStr };

    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffSec < 60) relative = "just now";
    else if (diffMin < 60) relative = `${diffMin}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = "yesterday";
    else if (diffDays < 30) relative = `${diffDays}d ago`;
    else {
      relative = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    const full = d.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
    return { relative, full };
  } catch {
    return { relative: dateStr, full: dateStr };
  }
}

/**
 * Strips hidden metadata comments commonly injected by bots (Dependabot, Renovate, Vercel):
 * e.g. `[//]: # (dependabot-automerge-start)`, `[vc]: #...`, or HTML comments `<!-- ... -->`
 * and resolves emojis.
 */
function cleanCommentText(raw: string): string {
  if (!raw) return "";
  let text = raw
    // Remove markdown comments: e.g. [//]: # (dependabot-automerge-start) or [anything]: # ...
    .replace(/\[[\w\/\.\-]+\]:\s*#[^\n)]*\)?/g, "")
    // Remove reference link definition comments: e.g. [vc]: #9YptFdxp...
    .replace(/^\[[a-zA-Z0-9_\-]+\]:\s*#.*$/gm, "")
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, "");

  // Replace emoji shortcodes
  text = text.replace(/:[a-zA-Z0-9_+]+:/g, (match) => EMOJI_MAP[match] || match);

  return text.trim();
}

/**
 * Normalizes HTML block elements (common in bot changelogs from Dependabot, Renovate, GitHub Releases)
 * into standard markdown blocks so they render with rich typography instead of raw HTML markup.
 * Preserves code inside fenced code blocks.
 */
function normalizeHtmlBlocks(text: string): string {
  if (!text) return "";

  // 1. Temporarily extract fenced code blocks to preserve them intact
  const codeBlocks: string[] = [];
  let res = text.replace(/```[\s\S]*?```/g, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
    return `__CODE_BLOCK_${idx}__`;
  });

  // 2. Normalize <br> and <hr>
  res = res.replace(/<br\s*\/?>/gi, "\n");
  res = res.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  // 3. Normalize Headings <h1>-<h6>
  res = res.replace(/<h([1-6])(?:\s+[^>]*)?>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
    const hashes = "#".repeat(Math.min(parseInt(level, 10) + 1, 4));
    return `\n\n${hashes} ${content.trim()}\n\n`;
  });

  // 4. Normalize lists: <li>...</li> and strip wrapping <ul>, <ol>
  res = res.replace(/<li(?:\s+[^>]*)?>([\s\S]*?)<\/li>/gi, (_, content) => {
    return `\n- ${content.trim()}`;
  });
  res = res.replace(/<\/?(?:ul|ol)(?:\s+[^>]*)?>/gi, "\n");

  // 5. Normalize paragraphs <p>...</p>
  res = res.replace(/<p(?:\s+[^>]*)?>([\s\S]*?)<\/p>/gi, (_, content) => {
    return `\n\n${content.trim()}\n\n`;
  });

  // 6. Normalize blockquotes <blockquote>...</blockquote>
  let prev = "";
  let iterations = 0;
  while (res !== prev && iterations < 10) {
    prev = res;
    iterations++;
    res = res.replace(/<blockquote(?:\s+[^>]*)?>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
      const inner = content.trim();
      const quoted = inner
        .split("\n")
        .map((line: string) => (line.trim() ? `> ${line}` : ">"))
        .join("\n");
      return `\n\n${quoted}\n\n`;
    });
  }

  // 7. Strip wrapper <div> tags
  res = res.replace(/<\/?div(?:\s+[^>]*)?>/gi, "\n");

  // 8. Clean excessive blank lines (3+ down to 2)
  res = res.replace(/\n{3,}/g, "\n\n");

  // 9. Restore fenced code blocks
  res = res.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => {
    return codeBlocks[parseInt(idx, 10)] || "";
  });

  return res.trim();
}

/**
 * Interactive Code Block with Copy button
 */
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="my-3 rounded-lg border border-praxd-border-soft bg-[#121212] overflow-hidden group">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1a1a1a] border-b border-praxd-border-soft text-[11px] text-praxd-text-muted font-mono">
        <span>{lang || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors p-1 rounded group/btn"
          title={copied ? "Copied!" : "Copy code"}
          aria-label="Copy code"
        >
          <CopyIcon
            as="span"
            copied={copied}
            size={12}
            strokeWidth={2}
            className="p-0 pointer-events-none"
          />
          <span className={copied ? "text-praxd-green" : ""}>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 text-[12px] font-mono text-praxd-text overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * GitHub Callout / Alert block
 */
function AlertCallout({ alertType, body }: { alertType: string; body: string }) {
  const type = alertType.toUpperCase();

  const configs: Record<
    string,
    { title: string; border: string; bg: string; text: string; icon: React.ReactNode }
  > = {
    NOTE: {
      title: "Note",
      border: "border-praxd-blue/40",
      bg: "bg-praxd-blue/10",
      text: "text-praxd-blue",
      icon: <Info className="w-4 h-4 shrink-0 text-praxd-blue" />,
    },
    TIP: {
      title: "Tip",
      border: "border-praxd-green/40",
      bg: "bg-praxd-green/10",
      text: "text-praxd-green",
      icon: <Lightbulb className="w-4 h-4 shrink-0 text-praxd-green" />,
    },
    IMPORTANT: {
      title: "Important",
      border: "border-purple-500/40",
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      icon: <AlertCircle className="w-4 h-4 shrink-0 text-purple-400" />,
    },
    WARNING: {
      title: "Warning",
      border: "border-praxd-amber/40",
      bg: "bg-praxd-amber/10",
      text: "text-praxd-amber",
      icon: <TriangleAlert className="w-4 h-4 shrink-0 text-praxd-amber" />,
    },
    CAUTION: {
      title: "Caution",
      border: "border-praxd-red/40",
      bg: "bg-praxd-red/10",
      text: "text-praxd-red",
      icon: <ShieldAlert className="w-4 h-4 shrink-0 text-praxd-red" />,
    },
  };

  const config = configs[type] || configs.NOTE;

  return (
    <div className={`my-3 p-3.5 rounded-lg border ${config.border} ${config.bg} space-y-1.5`}>
      <div className={`flex items-center gap-2 font-semibold text-[12.5px] ${config.text}`}>
        {config.icon}
        <span>{config.title}</span>
      </div>
      <div className="text-[12px] text-praxd-text-secondary leading-relaxed pl-6">
        {renderInlineMarkdown(body)}
      </div>
    </div>
  );
}

/**
 * Tokenizes and parses inline markdown + HTML elements safely
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Token regex for:
  // 0. Linked image: [![alt](imgUrl)](linkUrl)
  // 1. Markdown image: ![alt](url)
  // 2. Markdown link: [text](url)
  // 3. HTML <relative-time>: <relative-time datetime="...">...</relative-time>
  // 4. HTML <a>: <a href="...">...</a>
  // 5. HTML <img>: <img src="..." ... />
  // 6. HTML <sup>: <sup>...</sup>
  // 7. HTML <sub>: <sub>...</sub>
  // 8. HTML <br>: <br/> or <br>
  // 9. HTML <kbd>: <kbd>...</kbd>
  // 10. HTML <strong>/<b>: <strong>...</strong> or <b>...</b>
  // 11. HTML <em>/<i>: <em>...</em> or <i>...</i>
  // 12. HTML <code>: <code>...</code>
  // 13. HTML <del>/<s>: <del>...</del> or <s>...</s>
  // 14. Markdown ~~strikethrough~~
  // 15. Markdown ***bold italic***
  // 16. Markdown **bold** or __bold__
  // 17. Markdown *italic* or _italic_
  // 18. Markdown `code`
  // 19. Mentions: @username
  // 20. Auto-links: https://...
  const tokenRegex =
    /(\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)|!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|<relative-time\s+([^>]*?)>(.*?)<\/relative-time>|<relative-time\s+([^>]*?)\/>|<a\s+([^>]*?)>([\s\S]*?)<\/a>|<img\s+([^>]*?)\/?>|<sup\s*?>([\s\S]*?)<\/sup>|<sub\s*?>([\s\S]*?)<\/sub>|<br\s*\/?>|<kbd\s*?>([\s\S]*?)<\/kbd>|<(?:strong|b)\s*?>([\s\S]*?)<\/(?:strong|b)>|<(?:em|i)\s*?>([\s\S]*?)<\/(?:em|i)>|<code\s*?>([\s\S]*?)<\/code>|<(?:del|s)\s*?>([\s\S]*?)<\/(?:del|s)>|~~([^~]+)~~|\*\*\*([^*]+)\*\*\*|\*\_([^*_]+)\_\*|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|@([a-zA-Z0-9_\-]+(?:\[bot\])?)|(https?:\/\/[^\s<>"')]+))/gi;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];
    const key = `token-${match.index}`;

    // 0. Linked image: [![alt](imgUrl)](linkUrl)
    if (full.startsWith("[![")) {
      const linkedMatch = full.match(/^\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)$/);
      const altText = linkedMatch ? linkedMatch[1] : "Badge";
      const imageUrl = sanitizeUrl(linkedMatch ? linkedMatch[2] : "");
      const linkUrl = sanitizeUrl(linkedMatch ? linkedMatch[3] : "");
      const isExternal = linkUrl.startsWith("http://") || linkUrl.startsWith("https://");

      nodes.push(
        <a
          key={key}
          href={linkUrl}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          title={altText}
          className="inline-flex items-center gap-1.5 my-1 text-praxd-blue hover:underline align-middle group font-medium"
        >
          <img
            src={imageUrl}
            alt={altText}
            className="inline-block max-h-5 object-contain rounded-xs align-middle"
            onError={(e) => {
              const img = e.target as HTMLElement;
              img.style.display = "none";
              const fallbackSpan = img.nextElementSibling as HTMLElement;
              if (fallbackSpan) fallbackSpan.style.display = "inline-flex";
            }}
          />
          <span style={{ display: "none" }} className="items-center gap-1 text-[12px] text-praxd-blue font-medium">
            <span>{altText}</span>
            {isExternal && <ExternalLink className="w-3 h-3 opacity-70 inline" />}
          </span>
        </a>
      );
    }
    // 1. Markdown image: ![alt](url)
    else if (full.startsWith("![")) {
      const altText = match[2];
      const imageUrl = sanitizeUrl(match[3]);
      nodes.push(
        <img
          key={key}
          src={imageUrl}
          alt={altText || "Image"}
          className="inline-block h-4 w-4 align-middle rounded-xs object-contain mr-1"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      );
    }
    // 2. Markdown link: [text](url)
    else if (full.startsWith("[")) {
      const linkText = match[4];
      const linkUrl = sanitizeUrl(match[5]);
      const isExternal = linkUrl.startsWith("http://") || linkUrl.startsWith("https://");
      nodes.push(
        <a
          key={key}
          href={linkUrl}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="text-praxd-blue hover:underline font-medium inline-flex items-center gap-0.5 whitespace-nowrap align-middle"
        >
          <span>{linkText}</span>
          {isExternal && <ExternalLink className="w-3 h-3 opacity-70 shrink-0 inline ml-0.5" />}
        </a>
      );
    }
    // 3. HTML <relative-time>
    else if (full.toLowerCase().startsWith("<relative-time")) {
      const attrStr = match[6] || match[8] || "";
      const attrs = parseAttributes(attrStr);
      const innerText = match[7];
      const dateVal = attrs.datetime || innerText;
      const { relative, full: fullDate } = formatTimestamp(dateVal);
      const display = relative || innerText || dateVal || "now";

      nodes.push(
        <time
          key={key}
          dateTime={attrs.datetime || dateVal}
          title={fullDate || dateVal}
          className="inline-flex items-center gap-1 font-mono text-[11px] text-praxd-text-muted hover:text-praxd-text bg-[#1e1e1e] border border-praxd-border-soft px-1.5 py-0.5 rounded cursor-help transition-colors tabular-nums align-middle"
        >
          <Clock className="w-2.5 h-2.5 opacity-60 shrink-0" />
          <span>{display}</span>
        </time>
      );
    }
    // 4. HTML <a>
    else if (full.toLowerCase().startsWith("<a")) {
      const attrs = parseAttributes(match[9] || "");
      const innerContent = match[10];
      const linkUrl = sanitizeUrl(attrs.href);
      const isExternal = linkUrl.startsWith("http://") || linkUrl.startsWith("https://");

      nodes.push(
        <a
          key={key}
          href={linkUrl}
          target={attrs.target || (isExternal ? "_blank" : undefined)}
          rel={isExternal ? "noopener noreferrer" : undefined}
          title={attrs.title}
          className="text-praxd-blue hover:underline font-medium inline-flex items-center gap-1 align-middle whitespace-nowrap"
        >
          {renderInlineMarkdown(innerContent)}
          {isExternal && <ExternalLink className="w-3 h-3 opacity-70 shrink-0 inline ml-0.5" />}
        </a>
      );
    }
    // 5. HTML <img>
    else if (full.toLowerCase().startsWith("<img")) {
      const attrs = parseAttributes(match[11] || "");
      const src = sanitizeUrl(attrs.src);
      const width = attrs.width ? parseInt(attrs.width, 10) : undefined;
      const height = attrs.height ? parseInt(attrs.height, 10) : undefined;

      nodes.push(
        <img
          key={key}
          src={src}
          alt={attrs.alt || ""}
          width={width}
          height={height}
          style={{
            width: width ? `${width}px` : undefined,
            height: height ? `${height}px` : undefined,
          }}
          className="inline-block align-middle rounded-xs object-contain"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      );
    }
    // 6. HTML <sup>
    else if (full.toLowerCase().startsWith("<sup")) {
      nodes.push(
        <sup key={key} className="text-[10px] leading-none align-super inline-flex items-center mr-0.5">
          {renderInlineMarkdown(match[12])}
        </sup>
      );
    }
    // 7. HTML <sub>
    else if (full.toLowerCase().startsWith("<sub")) {
      nodes.push(
        <sub key={key} className="text-[10px] leading-none align-sub inline-flex items-center">
          {renderInlineMarkdown(match[13])}
        </sub>
      );
    }
    // 8. HTML <br>
    else if (full.toLowerCase().startsWith("<br")) {
      nodes.push(<br key={key} className="my-0.5" />);
    }
    // 9. HTML <kbd>
    else if (full.toLowerCase().startsWith("<kbd")) {
      nodes.push(
        <kbd
          key={key}
          className="px-1.5 py-0.5 rounded bg-[#1e1e1e] border border-praxd-border-soft font-mono text-[11px] text-praxd-text shadow-xs"
        >
          {renderInlineMarkdown(match[14])}
        </kbd>
      );
    }
    // 10. HTML <strong> / <b>
    else if (/^<(strong|b)\b/i.test(full)) {
      nodes.push(
        <strong key={key} className="font-semibold text-white">
          {renderInlineMarkdown(match[15])}
        </strong>
      );
    }
    // 11. HTML <em> / <i>
    else if (/^<(em|i)\b/i.test(full)) {
      nodes.push(
        <em key={key} className="italic text-praxd-text-secondary">
          {renderInlineMarkdown(match[16])}
        </em>
      );
    }
    // 12. HTML <code>
    else if (full.toLowerCase().startsWith("<code")) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-[#222222] border border-praxd-border-soft text-praxd-text font-mono text-[11.5px]"
        >
          {match[17]}
        </code>
      );
    }
    // 13. HTML <del> / <s>
    else if (/^<(del|s)\b/i.test(full)) {
      nodes.push(
        <del key={key} className="line-through text-praxd-text-muted">
          {renderInlineMarkdown(match[18])}
        </del>
      );
    }
    // 14. Markdown ~~strike~~
    else if (match[19]) {
      nodes.push(
        <del key={key} className="line-through text-praxd-text-muted">
          {match[19]}
        </del>
      );
    }
    // 15. Markdown ***bold italic***
    else if (match[20] || match[21]) {
      nodes.push(
        <strong key={key} className="font-semibold italic text-praxd-text">
          {match[20] || match[21]}
        </strong>
      );
    }
    // 16. Markdown **bold**
    else if (match[22] || match[23]) {
      nodes.push(
        <strong key={key} className="font-semibold text-white">
          {match[22] || match[23]}
        </strong>
      );
    }
    // 17. Markdown `code`
    else if (match[24]) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-[#222222] border border-praxd-border-soft text-praxd-text font-mono text-[11.5px]"
        >
          {match[24]}
        </code>
      );
    }
    // 18. Markdown *italic*
    else if (match[25] || match[26]) {
      nodes.push(
        <em key={key} className="italic text-praxd-text-secondary">
          {match[25] || match[26]}
        </em>
      );
    }
    // 19. Mention: @username
    else if (match[27]) {
      nodes.push(
        <span
          key={key}
          className="text-praxd-blue font-medium bg-praxd-blue/10 px-1 py-0.5 rounded text-[11.5px] border border-praxd-blue/20"
        >
          @{match[27]}
        </span>
      );
    }
    // 20. Auto-link: https://...
    else if (match[28]) {
      const url = sanitizeUrl(match[28]);
      nodes.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-praxd-blue hover:underline font-medium inline-flex items-center gap-0.5 break-all align-middle"
        >
          <span>{url}</span>
          <ExternalLink className="w-3 h-3 opacity-70 shrink-0 inline ml-0.5" />
        </a>
      );
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Parses multi-line markdown blocks (tables, code, lists, details, alerts, paragraphs)
 */
function renderMarkdownBlocks(content: string, blockKeyPrefix = "b"): React.ReactNode[] {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Details block: <details ...> ... </details>
    if (/^<details\b/i.test(trimmed)) {
      const detailsLines: string[] = [];
      while (i < lines.length) {
        detailsLines.push(lines[i]);
        if (/<\/details>/i.test(lines[i])) {
          i++;
          break;
        }
        i++;
      }

      const fullDetailsText = detailsLines.join("\n");
      const summaryMatch = fullDetailsText.match(/<summary(?:\s+[^>]*)?>([\s\S]*?)<\/summary>/i);
      const summaryText = summaryMatch
        ? summaryMatch[1].replace(/<br\s*\/?>/gi, "").trim()
        : "Details";

      const summaryIdx = summaryMatch?.index ?? 0;
      let innerBody = summaryMatch
        ? fullDetailsText.slice(summaryIdx + summaryMatch[0].length)
        : fullDetailsText.replace(/^<details[^>]*>/i, "");

      innerBody = innerBody
        .replace(/<\/details>[\s\S]*$/i, "")
        .replace(/^(\s*<br\s*\/?>\s*)+/gi, "")
        .replace(/(\s*<br\s*\/?>\s*)+$/gi, "")
        .trim();

      const isOpen = /<details[^>]*\bopen\b/i.test(fullDetailsText);

      blocks.push(
        <details
          key={`${blockKeyPrefix}-details-${i}`}
          className="group my-3 rounded-lg border border-praxd-border-soft bg-[#141414] overflow-hidden"
          open={isOpen ? true : undefined}
        >
          <summary className="px-3.5 py-2.5 flex items-center gap-2 cursor-pointer text-[12.5px] font-medium text-praxd-text hover:text-white hover:bg-[#1a1a1a] transition-colors select-none list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-praxd-border-soft">
            <ChevronRight className="w-3.5 h-3.5 text-praxd-text-muted transition-transform duration-200 group-open:rotate-90 shrink-0" />
            <span className="flex-1 min-w-0">{renderInlineMarkdown(summaryText)}</span>
          </summary>
          <div className="px-4 py-3 bg-[#111111]/70 space-y-2.5 text-[12.5px] text-praxd-text-secondary leading-relaxed">
            {renderMarkdownBlocks(normalizeHtmlBlocks(innerBody), `${blockKeyPrefix}-dt-${i}`)}
          </div>
        </details>
      );
      continue;
    }

    // 2. Fenced Code Block: ```lang ... ```
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push(
        <CodeBlock
          key={`${blockKeyPrefix}-code-${i}`}
          code={codeLines.join("\n")}
          lang={lang}
        />
      );
      continue;
    }

    // 3. Markdown Table: lines starting with |
    if (trimmed.startsWith("|") && trimmed.includes("|", 1)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());

        // Extract column alignment (:--- left, :---: center, ---: right)
        const separatorRow = tableLines[1]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());

        const alignments = separatorRow.map((s) => {
          const l = s.startsWith(":");
          const r = s.endsWith(":");
          if (l && r) return "center";
          if (r) return "right";
          return "left";
        });

        const dataRows = tableLines.slice(2).map((row) =>
          row
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim())
        );

        blocks.push(
          <div
            key={`${blockKeyPrefix}-table-${i}`}
            className="my-3 overflow-x-auto rounded-lg border border-praxd-border-soft bg-[#141414] shadow-xs"
          >
            <table className="w-full text-left text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#1c1c1c] border-b border-praxd-border-soft">
                  {headerRow.map((h, hi) => {
                    const align = alignments[hi] || "left";
                    const alignClass =
                      align === "center"
                        ? "text-center"
                        : align === "right"
                        ? "text-right"
                        : "text-left";
                    return (
                      <th
                        key={hi}
                        className={`px-3.5 py-2.5 font-semibold text-white whitespace-nowrap ${alignClass}`}
                      >
                        {renderInlineMarkdown(h)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-praxd-border-soft bg-[#141414]">
                {dataRows.map((r, ri) => (
                  <tr key={ri} className="hover:bg-[#1a1a1a]/80 transition-colors">
                    {r.map((cell, ci) => {
                      const align = alignments[ci] || "left";
                      const alignClass =
                        align === "center"
                          ? "text-center"
                          : align === "right"
                          ? "text-right"
                          : "text-left";
                      return (
                        <td
                          key={ci}
                          className={`px-3.5 py-2.5 text-praxd-text-secondary align-middle ${alignClass}`}
                        >
                          <div className="inline-flex items-center gap-1.5 flex-wrap">
                            {renderInlineMarkdown(cell)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 4. Horizontal Rule: `---` or `***` or `___`
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(
        <hr
          key={`${blockKeyPrefix}-hr-${i}`}
          className="my-3 border-t border-praxd-border-soft"
        />
      );
      i++;
      continue;
    }

    // 5. Headings: # H1, ## H2, ### H3, #### H4
    if (trimmed.startsWith("#")) {
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const headingText = trimmed.replace(/^#+\s*/, "");
      if (level === 1) {
        blocks.push(
          <h2
            key={`${blockKeyPrefix}-h1-${i}`}
            className="text-[17px] font-semibold text-white mt-4 mb-2"
          >
            {renderInlineMarkdown(headingText)}
          </h2>
        );
      } else if (level === 2) {
        blocks.push(
          <h3
            key={`${blockKeyPrefix}-h2-${i}`}
            className="text-[15px] font-semibold text-white mt-3.5 mb-1.5"
          >
            {renderInlineMarkdown(headingText)}
          </h3>
        );
      } else {
        blocks.push(
          <h4
            key={`${blockKeyPrefix}-h3-${i}`}
            className="text-[13.5px] font-medium text-white mt-3 mb-1"
          >
            {renderInlineMarkdown(headingText)}
          </h4>
        );
      }
      i++;
      continue;
    }

    // 6. Blockquote or GitHub Alert: > [!NOTE] or > quote
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ""));
        i++;
      }

      const firstLine = quoteLines[0] || "";
      const alertMatch = firstLine.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);

      if (alertMatch) {
        const alertType = alertMatch[1].toUpperCase();
        const firstRemaining = firstLine.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, "").trim();
        const alertBody = [firstRemaining, ...quoteLines.slice(1)].filter(Boolean).join("\n");
        blocks.push(
          <AlertCallout
            key={`${blockKeyPrefix}-alert-${i}`}
            alertType={alertType}
            body={alertBody}
          />
        );
        continue;
      }

      blocks.push(
        <blockquote
          key={`${blockKeyPrefix}-quote-${i}`}
          className="border-l-2 border-praxd-border-soft pl-3.5 my-2.5 text-praxd-text-secondary text-[12.5px] space-y-2 bg-[#141414]/50 py-1.5 rounded-r-md"
        >
          {renderMarkdownBlocks(quoteLines.join("\n"), `${blockKeyPrefix}-q-${i}`)}
        </blockquote>
      );
      continue;
    }

    // 7. Unordered List & Task List: - item or * item
    if (/^[-*]\s+/.test(trimmed)) {
      const listItems: { isTask: boolean; checked?: boolean; text: string }[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const rawItem = lines[i].trim().replace(/^[-*]\s+/, "");
        const taskMatch = rawItem.match(/^\[([ xX])\]\s+(.*)$/);
        if (taskMatch) {
          listItems.push({
            isTask: true,
            checked: taskMatch[1].toLowerCase() === "x",
            text: taskMatch[2],
          });
        } else {
          listItems.push({
            isTask: false,
            text: rawItem,
          });
        }
        i++;
      }

      blocks.push(
        <ul
          key={`${blockKeyPrefix}-ul-${i}`}
          className="my-2 space-y-1.5 text-[12.5px] text-praxd-text-secondary"
        >
          {listItems.map((item, li) => (
            <li
              key={li}
              className={`leading-relaxed ${
                item.isTask ? "flex items-start gap-2 list-none" : "list-disc list-inside ml-1"
              }`}
            >
              {item.isTask && (
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly
                  className="mt-1 h-3.5 w-3.5 rounded border-praxd-border-soft bg-[#222222] text-praxd-blue focus:ring-0 shrink-0 cursor-default"
                />
              )}
              <span className="flex-1 min-w-0">{renderInlineMarkdown(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 8. Numbered List: 1. item
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }

      blocks.push(
        <ol
          key={`${blockKeyPrefix}-ol-${i}`}
          className="my-2 space-y-1.5 list-decimal list-inside text-[12.5px] text-praxd-text-secondary ml-1"
        >
          {listItems.map((item, li) => (
            <li key={li} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 9. Standard Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("<details") &&
      !/^(\-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push(
        <p
          key={`${blockKeyPrefix}-p-${i}`}
          className="leading-relaxed text-[13px] text-praxd-text-secondary"
        >
          {renderInlineMarkdown(paraLines.join(" "))}
        </p>
      );
    }
  }

  return blocks;
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const cleaned = cleanCommentText(content);
  if (!cleaned) return null;
  const normalized = normalizeHtmlBlocks(cleaned);
  if (!normalized) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {renderMarkdownBlocks(normalized)}
    </div>
  );
}
