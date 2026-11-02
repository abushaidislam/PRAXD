"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { Check, Info, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastItem {
  id: string;
  message: string;
  type?: "success" | "info" | "error";
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: "success" | "info" | "error", duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a safe fallback if used outside provider
    return {
      showToast: (msg: string) => {
        // Fallback or no-op
      },
    };
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: "success" | "info" | "error" = "success", duration = 2500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, type, duration }]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Render Viewport */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-2xl backdrop-blur-md text-[12px] font-medium transition-all duration-200 animate-in fade-in slide-in-from-bottom-2",
              toast.type === "error"
                ? "bg-red-950/90 text-red-200 border-red-800/60"
                : toast.type === "info"
                ? "bg-sky-950/90 text-sky-200 border-sky-800/60"
                : "bg-[#181818]/95 text-neutral-100 border-neutral-700/80 shadow-black/80"
            )}
          >
            <div className="flex items-center gap-2 truncate">
              {toast.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : toast.type === "info" ? (
                <Info className="w-4 h-4 text-sky-400 shrink-0" />
              ) : (
                <Check className="w-4 h-4 text-praxd-green shrink-0" />
              )}
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded text-neutral-400 hover:text-neutral-100 transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
