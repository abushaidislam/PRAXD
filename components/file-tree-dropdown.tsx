import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, FileCode, Check } from "lucide-react";
import { ChangedFile } from "@/types/pr";
import { cn } from "@/lib/utils";

interface FileTreeDropdownProps {
  files: ChangedFile[];
  selectedFile: ChangedFile;
  onSelectFile: (file: ChangedFile) => void;
}

export function FileTreeDropdown({
  files,
  selectedFile,
  onSelectFile,
}: FileTreeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#181818] hover:bg-[#222222] border border-praxd-border-soft text-[12px] text-praxd-text font-mono transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-praxd-blue"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="w-2 h-2 rounded-full bg-praxd-amber" />
        <span className="truncate max-w-[220px] font-medium">{selectedFile.filename}</span>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-praxd-green">+{selectedFile.additions}</span>
          <span className="text-praxd-red">-{selectedFile.deletions}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-praxd-text-muted" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Files changed in this pull request"
          className="absolute left-0 top-full mt-1.5 w-80 max-h-72 overflow-y-auto rounded-lg bg-[#181818] border border-praxd-border shadow-xl z-50 p-1 space-y-0.5"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-praxd-text-muted border-b border-praxd-border-soft flex items-center justify-between">
            <span>Files changed ({files.length})</span>
            <span className="font-mono text-[10px]">
              +{files.reduce((acc, f) => acc + f.additions, 0)} -
              {files.reduce((acc, f) => acc + f.deletions, 0)}
            </span>
          </div>

          {files.map((file) => {
            const isSelected = file.filename === selectedFile.filename;
            return (
              <button
                key={file.filename}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelectFile(file);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] font-mono transition-colors",
                  isSelected
                    ? "bg-[#252525] text-praxd-text"
                    : "text-praxd-text-secondary hover:bg-[#202020] hover:text-praxd-text"
                )}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <FileCode className="w-3.5 h-3.5 text-praxd-text-muted shrink-0" />
                  <span className="truncate">{file.filename}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[10px]">
                  <span className="text-praxd-green">+{file.additions}</span>
                  <span className="text-praxd-red">-{file.deletions}</span>
                  {isSelected && <Check className="w-3 h-3 text-praxd-blue" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
