import React from "react";
import { Settings, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

export function parseFilePath(filePath: string) {
  const parts = filePath.split("/");
  const basename = parts.pop() || filePath;
  const dirname = parts.join("/");
  return { basename, dirname };
}

export function renderFileBadge(filename: string) {
  const lower = filename.toLowerCase();
  const ext = lower.split(".").pop() || "";

  if (ext === "md" || ext === "markdown") {
    return (
      <span className="font-bold text-[11px] text-sky-400 font-mono tracking-tighter shrink-0 select-none">
        M↓
      </span>
    );
  }

  if (ext === "ts" || ext === "tsx") {
    return (
      <span className="px-1 py-0.2 rounded text-[10px] bg-blue-950/60 text-blue-400 font-mono font-bold border border-blue-700/50 shrink-0 select-none">
        TS
      </span>
    );
  }

  if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") {
    return (
      <span className="px-1 py-0.2 rounded text-[10px] bg-yellow-950/60 text-amber-300 font-mono font-bold border border-yellow-700/50 shrink-0 select-none">
        JS
      </span>
    );
  }

  if (
    ext === "json" ||
    ext === "yml" ||
    ext === "yaml" ||
    ext === "toml" ||
    lower.includes(".env") ||
    lower.includes("config")
  ) {
    return <Settings className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
  }

  if (ext === "css" || ext === "scss" || ext === "sass" || ext === "less") {
    return (
      <span className="px-1 py-0.2 rounded text-[10px] bg-purple-950/60 text-purple-300 font-mono font-bold border border-purple-700/50 shrink-0 select-none">
        CSS
      </span>
    );
  }

  return <FileCode className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
}

// Modern syntax tokenization with HTML tag and string recognition
export function renderHighlightedCode(text: string, isDeleted = false, isAdded = false) {
  if (!text) return <span>&nbsp;</span>;

  if (text.trim().startsWith("//")) {
    return <span className="text-[#768390] italic">{text}</span>;
  }

  const tokens = text.split(
    /(\b(?:const|let|var|function|return|import|export|from|if|else|true|false|document|window)\b|'[^']*'|"[^"]*"|`[^`]*`|<[^>]+>)/g
  );

  return (
    <>
      {tokens.map((token, i) => {
        if (!token) return null;

        if (
          [
            "const",
            "let",
            "var",
            "function",
            "return",
            "import",
            "export",
            "from",
            "if",
            "else",
          ].includes(token)
        ) {
          return (
            <span key={i} className="text-[#f47067] font-semibold">
              {token}
            </span>
          );
        }
        if (["document", "window"].includes(token)) {
          return (
            <span key={i} className="text-[#d2a8ff]">
              {token}
            </span>
          );
        }
        if (["true", "false"].includes(token)) {
          return (
            <span key={i} className="text-[#6cb6ff]">
              {token}
            </span>
          );
        }
        if (
          (token.startsWith("'") && token.endsWith("'")) ||
          (token.startsWith('"') && token.endsWith('"')) ||
          (token.startsWith("`") && token.endsWith("`"))
        ) {
          return (
            <span
              key={i}
              className={cn(
                "text-[#96d0ff]",
                isDeleted && "bg-red-950/60 rounded px-0.5",
                isAdded && "bg-emerald-950/70 rounded px-0.5"
              )}
            >
              {token}
            </span>
          );
        }
        if (token.startsWith("<") && token.endsWith(">")) {
          return (
            <span key={i} className="text-[#7ee787] font-mono">
              {token}
            </span>
          );
        }
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}
