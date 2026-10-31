"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Strips hidden metadata comments commonly injected by bots like Vercel:
 * e.g. `[vc]: #...` or HTML comments `<!-- ... -->`
 */
function cleanCommentText(raw: string): string {
  if (!raw) return "";
  return raw
    // Remove reference link definition comments: e.g. [vc]: #9YptFdxp...
    .replace(/^\[[a-zA-Z0-9_\-]+\]:\s*#.*$/gm, "")
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

/**
 * Parses inline formatting:
 * - Bold: `**bold**` or `__bold__`
 * - Italic: `*italic*` or `_italic_`
 * - Bold + Italic: `***text***` or `*_text_*`
 * - Inline Code: `` `code` ``
 * - Links: `[title](url)`
 * - Mentions: `@username`
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex pattern matching tokens in order:
  // 1. Links: [text](url)
  // 2. BoldItalic: ***text*** or *_text_*
  // 3. Bold: **text**
  // 4. Italic: *text* or _text_
  // 5. Inline Code: `code`
  // 6. Mentions: @username
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*\*([^*]+)\*\*\*|\*\_([^*_]+)\_\*|\*\*([^*]+)\*\*|\*([^*]+)\*|\_([^_]+)\_|`([^`]+)`|@([a-zA-Z0-9_\-]+(\[bot\])?))/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Append leading plain text
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [full, , linkText, linkUrl, bi1, bi2, boldText, it1, it2, codeText, mention] = match;

    if (linkText && linkUrl) {
      const isExternal = linkUrl.startsWith("http://") || linkUrl.startsWith("https://");
      nodes.push(
        <a
          key={`link-${match.index}`}
          href={linkUrl}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="text-praxd-blue hover:underline font-medium inline-flex items-center gap-0.5 break-all"
        >
          <span>{linkText}</span>
          {isExternal && <ExternalLink className="w-3 h-3 opacity-70 shrink-0 inline ml-0.5" />}
        </a>
      );
    } else if (bi1 || bi2) {
      nodes.push(
        <strong key={`bi-${match.index}`} className="font-semibold italic text-praxd-text">
          {bi1 || bi2}
        </strong>
      );
    } else if (boldText) {
      nodes.push(
        <strong key={`bold-${match.index}`} className="font-semibold text-white">
          {boldText}
        </strong>
      );
    } else if (it1 || it2) {
      nodes.push(
        <em key={`it-${match.index}`} className="italic text-praxd-text-secondary">
          {it1 || it2}
        </em>
      );
    } else if (codeText) {
      nodes.push(
        <code
          key={`code-${match.index}`}
          className="px-1.5 py-0.5 rounded bg-[#222222] border border-praxd-border-soft text-praxd-text font-mono text-[11.5px]"
        >
          {codeText}
        </code>
      );
    } else if (mention) {
      nodes.push(
        <span
          key={`mention-${match.index}`}
          className="text-praxd-blue font-medium bg-praxd-blue/10 px-1 py-0.5 rounded text-[11.5px]"
        >
          {mention}
        </span>
      );
    }

    lastIndex = match.index + full.length;
  }

  // Append remaining plain text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const cleaned = cleanCommentText(content);
  if (!cleaned) return null;

  const lines = cleaned.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal Rule: `---` or `***` or `___`
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(
        <hr key={`hr-${i}`} className="my-3 border-t border-praxd-border-soft" />
      );
      i++;
      continue;
    }

    // Fenced Code Block: ```lang
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push(
        <pre
          key={`codeblock-${i}`}
          className="p-3 my-2.5 rounded-lg bg-[#141414] border border-praxd-border-soft text-[12px] font-mono text-praxd-text overflow-x-auto leading-relaxed"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Markdown Table: lines starting and containing |
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

        // Skip separator line (|---|---|...)
        const dataRows = tableLines.slice(2).map((row) =>
          row
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim())
        );

        blocks.push(
          <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-lg border border-praxd-border-soft">
            <table className="w-full text-left text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#202020] border-b border-praxd-border-soft">
                  {headerRow.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 font-semibold text-white whitespace-nowrap">
                      {renderInlineMarkdown(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-praxd-border-soft bg-[#151515]">
                {dataRows.map((r, ri) => (
                  <tr key={ri} className="hover:bg-[#1a1a1a] transition-colors">
                    {r.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-praxd-text-secondary">
                        {renderInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Heading: # H1, ## H2, ### H3
    if (trimmed.startsWith("#")) {
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const text = trimmed.replace(/^#+\s*/, "");
      if (level === 1) {
        blocks.push(
          <h2 key={`h1-${i}`} className="text-[16px] font-semibold text-white mt-3 mb-1.5">
            {renderInlineMarkdown(text)}
          </h2>
        );
      } else if (level === 2) {
        blocks.push(
          <h3 key={`h2-${i}`} className="text-[14px] font-semibold text-white mt-2.5 mb-1">
            {renderInlineMarkdown(text)}
          </h3>
        );
      } else {
        blocks.push(
          <h4 key={`h3-${i}`} className="text-[13px] font-medium text-white mt-2 mb-1">
            {renderInlineMarkdown(text)}
          </h4>
        );
      }
      i++;
      continue;
    }

    // Blockquote: > text
    if (trimmed.startsWith(">")) {
      const quoteText = trimmed.replace(/^>\s*/, "");
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-praxd-border pl-3 my-2 text-praxd-text-muted italic text-[12.5px]"
        >
          {renderInlineMarkdown(quoteText)}
        </blockquote>
      );
      i++;
      continue;
    }

    // List item: - item or * item
    if (/^[-*]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1 list-disc list-inside text-[12.5px] text-praxd-text-secondary">
          {listItems.map((item, li) => (
            <li key={li} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list: 1. item
    if (/^\d+\.\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1 list-decimal list-inside text-[12.5px] text-praxd-text-secondary">
          {listItems.map((item, li) => (
            <li key={li} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Standard Paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("```") &&
      !/^(\-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed text-[13px] text-praxd-text-secondary">
        {renderInlineMarkdown(paraLines.join(" "))}
      </p>
    );
  }

  return <div className={`space-y-2.5 ${className}`}>{blocks}</div>;
}
