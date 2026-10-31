"use client";

import React, { useState, useEffect } from "react";
import { X, UserPlus, Users, Copy, Check, Shield } from "lucide-react";
import { WorkspaceRole } from "@/lib/auth/rbac";

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MemberItem {
  id: string;
  userId: string;
  username: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export function TeamManagementModal({ isOpen, onClose }: TeamManagementModalProps) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("reviewer");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadMembers() {
      try {
        const res = await fetch("/api/workspaces/current/members");
        if (res.ok) {
          const json = await res.json();
          if (json.data?.members) {
            setMembers(json.data.members);
          }
        }
      } catch {
        // Fallback
      }
    }

    loadMembers();
  }, [isOpen]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isInviting) return;

    setIsInviting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/workspaces/current/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to create invitation");
      }

      if (json.data?.inviteUrl) {
        setInviteUrl(window.location.origin + json.data.inviteUrl);
        setEmail("");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsInviting(false);
    }
  };

  const copyInviteLink = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl bg-[#141414] border border-praxd-border-soft shadow-2xl overflow-hidden select-text">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-praxd-border-soft bg-[#181818]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-praxd-blue/15 border border-praxd-blue/30 flex items-center justify-center text-praxd-blue">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-white">Team Collaboration & Members</h2>
              <p className="text-[11.5px] text-praxd-text-muted">Manage roles and invite reviewers</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-praxd-text-muted hover:text-praxd-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Invite Form */}
          <form onSubmit={handleSendInvite} className="space-y-3">
            <label className="block text-[12px] font-medium text-praxd-text-secondary">
              Invite New Team Member
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                required
                className="flex-1 px-3 py-1.5 rounded-lg bg-[#1c1c1c] border border-praxd-border-soft text-[12px] text-white placeholder:text-praxd-text-muted focus:outline-none focus:border-praxd-blue/80"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className="px-2.5 py-1.5 rounded-lg bg-[#1c1c1c] border border-praxd-border-soft text-[12px] text-white focus:outline-none"
              >
                <option value="reviewer">Reviewer</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={isInviting}
                className="px-3 py-1.5 rounded-lg bg-praxd-blue hover:bg-blue-600 text-white text-[12px] font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite</span>
              </button>
            </div>

            {errorMsg && <p className="text-[11px] text-rose-400">{errorMsg}</p>}
          </form>

          {/* Generated Invite Link Banner */}
          {inviteUrl && (
            <div className="p-3 rounded-lg bg-[#1b221d] border border-emerald-900/50 space-y-1.5">
              <span className="text-[11px] text-emerald-400 font-medium">Invitation Link Generated (Valid for 7 days):</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 px-2 py-1 bg-black/40 border border-emerald-900/40 rounded text-[11px] text-emerald-200 font-mono"
                />
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="px-2.5 py-1 bg-emerald-700/40 hover:bg-emerald-600/60 text-emerald-300 rounded text-[11px] font-medium flex items-center gap-1 shrink-0 transition-colors"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Existing Members List */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-semibold text-praxd-text-muted uppercase tracking-wider">
              Workspace Members ({members.length})
            </span>
            <div className="space-y-1 max-h-[160px] overflow-y-auto">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#1a1a1a] border border-praxd-border-soft text-[12px]"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-white font-medium border border-neutral-700">
                      {m.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-white font-medium">@{m.username}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10.5px] font-mono capitalize bg-[#242424] text-praxd-text-secondary border border-praxd-border-soft">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
