"use client";

import React, { useState, useEffect } from "react";
import { Lock, MessageSquare, Send, Trash2, AtSign, Check } from "lucide-react";
import { InternalNote } from "@/lib/notes/internal-notes-store";
import { cn } from "@/lib/utils";

interface InternalNotesPanelProps {
  pullRequestId: string;
}

export function InternalNotesPanel({ pullRequestId }: InternalNotesPanelProps) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch internal notes for this PR
  useEffect(() => {
    let isCancelled = false;

    async function loadNotes() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/pull-requests/${pullRequestId}/internal-notes`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.data?.notes) {
            setNotes(json.data.notes);
          }
        }
      } catch {
        // Fallback
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadNotes();
    return () => {
      isCancelled = true;
    };
  }, [pullRequestId]);

  // Submit note
  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pull-requests/${pullRequestId}/internal-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          authorName: "You",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data?.note) {
          setNotes((prev) => [...prev, json.data.note]);
          setContent("");
        }
      }
    } catch {
      // Ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/pull-requests/${pullRequestId}/internal-notes/${noteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="rounded-xl border border-praxd-border-soft bg-[#141414] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-praxd-border-soft bg-[#181818]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-white flex items-center gap-2">
              Internal Team Discussion
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/40 text-amber-300 font-mono border border-amber-800/40">
                Workspace Only
              </span>
            </h3>
            <p className="text-[11px] text-praxd-text-muted">
              Notes here are private to your workspace and NEVER published to GitHub.
            </p>
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="p-4 space-y-3 max-h-[320px] overflow-y-auto">
        {isLoading ? (
          <p className="text-[12px] text-praxd-text-muted animate-pulse">Loading internal notes...</p>
        ) : notes.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-praxd-text-muted space-y-1">
            <MessageSquare className="w-6 h-6 mx-auto opacity-40 mb-1" />
            <p>No internal notes yet.</p>
            <p className="text-[11px] text-neutral-500">
              Use @mentions (e.g. <code className="text-blue-400">@security-reviewer</code>) to request private feedback.
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-3 rounded-lg bg-[#1a1a1a] border border-praxd-border-soft text-[12.5px] space-y-1.5 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-[12px]">@{note.authorName}</span>
                  <span className="text-[10px] text-praxd-text-muted">
                    {new Date(note.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-praxd-text-muted hover:text-rose-400 transition-all"
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Render note content with highlight on @mentions */}
              <p className="text-[#dedede] leading-relaxed">
                {note.content.split(/(@[a-zA-Z0-9_\-]+)/g).map((token, i) =>
                  token.startsWith("@") ? (
                    <span
                      key={i}
                      className="px-1 py-0.5 mx-0.5 rounded bg-blue-950/60 text-blue-300 font-mono text-[11.5px] border border-blue-800/40"
                    >
                      {token}
                    </span>
                  ) : (
                    token
                  )
                )}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Note Input Form */}
      <form onSubmit={handleSubmitNote} className="p-3 border-t border-praxd-border-soft bg-[#161616]">
        <div className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add internal note or mention teammates (e.g. @alice)..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-praxd-border-soft text-[12px] text-white placeholder:text-praxd-text-muted focus:outline-none focus:border-praxd-blue/80"
          />
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="px-3 py-1.5 rounded-lg bg-praxd-blue hover:bg-blue-600 text-white text-[12px] font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post</span>
          </button>
        </div>
      </form>
    </div>
  );
}
