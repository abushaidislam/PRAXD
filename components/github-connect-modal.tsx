import React from "react";
import { X, Github, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

interface GitHubConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GitHubConnectModal({ isOpen, onClose }: GitHubConnectModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-github-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 select-none"
    >
      <div className="w-full max-w-md bg-[#181818] border border-praxd-border rounded-xl shadow-2xl p-5 space-y-4 text-praxd-text animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-praxd-border-soft pb-3">
          <div className="flex items-center gap-2.5">
            <BrandLogo size="md" />
            <h2 id="connect-github-title" className="text-[14px] font-semibold">
              Connect to PRAXD via GitHub App
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-praxd-text-muted hover:text-praxd-text transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 text-[12px] text-praxd-text-secondary leading-relaxed">
          <p>
            PRAXD connects to your GitHub repositories via a dedicated GitHub App installation using short-lived installation tokens.
          </p>

          <div className="p-3 rounded-lg bg-[#141414] border border-praxd-border-soft space-y-2">
            <div className="flex items-center gap-2 text-praxd-green text-[11.5px] font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Least-Privilege Read-Only Permissions:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-praxd-text-muted pl-1">
              <li>Pull requests: Read-only</li>
              <li>Checks & CI runs: Read-only</li>
              <li>Issues (PR conversation comments): Read-only</li>
              <li>Metadata: Read-only</li>
            </ul>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/30 flex items-start gap-2 text-[11px] text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              If you haven&apos;t registered your GitHub App yet, see <code>docs/GITHUB_INTEGRATION.md</code> to register your app and set <code>GITHUB_APP_ID</code> and <code>GITHUB_APP_PRIVATE_KEY_BASE64</code> in <code>.env.local</code>.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-praxd-border-soft">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[12px] text-praxd-text-muted hover:text-praxd-text transition-colors"
          >
            Cancel
          </button>
          <a
            href="/api/github/install"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-black text-[12px] font-medium transition-colors shadow-sm"
          >
            <Github className="w-3.5 h-3.5" />
            <span>Install GitHub App</span>
            <ExternalLink className="w-3 h-3 text-neutral-600" />
          </a>
        </div>
      </div>
    </div>
  );
}
