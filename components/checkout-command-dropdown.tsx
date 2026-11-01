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
          "flex items-center gap-1.5 rounded-md font-sans transition-colors select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue",
          variant === "header"
            ? "px-2.5 py-1 bg-[#181818] hover:bg-[#202020] text-neutral-300 hover:text-white border border-praxd-border-soft hover:border-neutral-600 text-[12px] font-medium shadow-sm"
            : "px-2 py-0.5 bg-[#181818] hover:bg-[#222222] text-neutral-300 hover:text-white border border-praxd-border-soft hover:border-neutral-600 text-[11px] font-medium"
        )}
        title="Copy local git checkout commands"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Checkout branch commands"
      >
        <Terminal className="w-3.5 h-3.5 text-praxd-blue shrink-0" />
        <span>Checkout</span>
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Checkout command options"
          className={cn(
            "absolute mt-1.5 w-80 sm:w-[340px] rounded-xl bg-[#161616] border border-praxd-border shadow-2xl shadow-black/90 ring-1 ring-white/5 z-50 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-100 select-none",
            variant === "header" ? "right-0" : "left-0"
          )}
        >
          {/* Menu Header */}
          <div className="px-2 py-1.5 border-b border-praxd-border-soft flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-praxd-blue" />
              <span className="text-[12px] font-semibold text-neutral-200">Checkout locally</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-mono bg-[#202020] px-1.5 py-0.5 rounded border border-praxd-border-soft">
              #{pr.number}
            </span>
          </div>

          {/* Command Options List */}
          <div className="space-y-1">
            {commands.map((option) => {
              const isCopied = copiedId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={(e) => handleCopyCommand(option, e)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-lg transition-all duration-150 group border flex flex-col gap-1.5 cursor-pointer",
                    isCopied
                      ? "bg-emerald-950/20 border-emerald-600/40 text-emerald-200"
                      : "bg-[#131313] hover:bg-[#1f1f1f] border-praxd-border-soft/60 hover:border-neutral-600"
                  )}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-colors",
                          isCopied ? "bg-emerald-400" : "bg-neutral-500 group-hover:bg-praxd-blue"
                        )}
                      />
                      <span className="font-medium text-neutral-400 group-hover:text-neutral-200 transition-colors">
                        {option.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isCopied ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-1.5 py-0.2 rounded">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 group-hover:text-neutral-300 transition-colors opacity-70 group-hover:opacity-100">
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 font-mono text-[11.5px] leading-relaxed pt-0.5">
                    <span className="text-neutral-500 select-none font-bold">$</span>
                    <span
                      className={cn(
                        "break-words font-medium transition-colors select-all",
                        isCopied ? "text-emerald-300" : "text-neutral-200 group-hover:text-white"
                      )}
                    >
                      {option.command}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Menu Footer */}
          <div className="px-2 pt-1.5 pb-0.5 border-t border-praxd-border-soft/60 flex items-center justify-between text-[10px] text-neutral-500">
            <span>Click any command to copy</span>
            <kbd className="px-1.5 py-0.2 bg-[#202020] border border-neutral-700/60 rounded text-[9px] font-mono text-neutral-400">
              Esc
            </kbd>
          </div>
        </div>
      )}
    </div>
  );
}
