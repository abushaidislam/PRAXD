"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, ChevronDown, Check, Copy } from "lucide-react";
import { PullRequest } from "@/types/pr";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

interface CheckoutCommandDropdownProps {
  pr: PullRequest;
  variant?: "header" | "inline";
}

interface CommandOption {
  id: string;
  label: string;
  tool: string;
  command: string;
}

export function CheckoutCommandDropdown({
  pr,
  variant = "inline",
}: CheckoutCommandDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const commands: CommandOption[] = [
    {
      id: "gh-cli",
      label: "GitHub CLI",
      tool: "gh pr checkout",
      command: `gh pr checkout ${pr.number}`,
    },
    {
      id: "git-checkout",
      label: "Git Checkout",
      tool: "git checkout",
      command: `git checkout ${pr.headRef}`,
    },
    {
      id: "git-fetch-checkout",
      label: "Git Fetch & Checkout",
      tool: "git fetch & checkout",
      command: `git fetch origin ${pr.headRef} && git checkout ${pr.headRef}`,
    },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleCopyCommand = (option: CommandOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(option.command);
      setCopiedId(option.id);
      showToast(`Copied "${option.command}" to clipboard!`, "success");
      setTimeout(() => {
        setCopiedId(null);
        setIsOpen(false);
      }, 700);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 rounded-md font-mono text-[11px] transition-colors select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue",
          variant === "header"
            ? "px-2 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-neutral-300 hover:text-white border border-praxd-border-soft"
            : "px-2 py-0.5 bg-[#181818] hover:bg-[#222222] text-neutral-300 hover:text-white border border-praxd-border-soft"
        )}
        title="Copy local git checkout commands"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Checkout branch commands"
      >
        <Terminal className="w-3.5 h-3.5 text-praxd-blue shrink-0" />
        <span className="font-sans font-medium">Checkout</span>
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Checkout command options"
          className={cn(
            "absolute mt-1.5 w-80 sm:w-[340px] rounded-xl bg-[#161616] border border-neutral-700/80 shadow-2xl ring-1 ring-white/5 z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 select-none",
            variant === "header" ? "right-0" : "left-0"
          )}
        >
          <div className="px-2.5 py-1.5 border-b border-praxd-border-soft text-[11px] text-neutral-400 font-medium flex items-center justify-between">
            <span>Checkout locally</span>
            <span className="text-[10px] text-neutral-500 font-mono">#{pr.number}</span>
          </div>

          {commands.map((option) => {
            const isCopied = copiedId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={(e) => handleCopyCommand(option, e)}
                className="w-full text-left p-2 rounded-lg hover:bg-[#222222] transition-colors group flex flex-col gap-1.5 border border-transparent hover:border-neutral-700/50"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-neutral-200 group-hover:text-white">
                    {option.label}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-neutral-400 group-hover:text-neutral-200">
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-praxd-green" />
                        <span className="text-praxd-green font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                        <span>Copy</span>
                      </>
                    )}
                  </span>
                </div>
                <code className="text-[11px] font-mono text-praxd-blue bg-[#101010] px-2 py-1 rounded-md border border-neutral-800 break-words leading-relaxed select-all">
                  {option.command}
                </code>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
