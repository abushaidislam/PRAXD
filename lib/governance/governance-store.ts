import { WorkspaceGovernanceSettings, AIProviderType } from "@/types/governance";

const governanceSettingsStore = new Map<string, WorkspaceGovernanceSettings>();

export const DEFAULT_GOVERNANCE_SETTINGS: Omit<WorkspaceGovernanceSettings, "workspaceId"> = {
  primaryProvider: (process.env.AI_PROVIDER as AIProviderType) || "fallback",
  modelName: process.env.AI_MODEL || "default",
  fallbackProviders: ["anthropic", "gemini", "openai", "selfhosted", "deterministic"],
  retentionDays: 60,
  zeroDataRetention: false,
  autoPurgeEnabled: true,
  lastPurgeAt: null,
  updatedAt: new Date().toISOString(),
};

/**
 * Retrieves the governance & model settings for a given workspace.
 */
export function getWorkspaceGovernance(workspaceId: string): WorkspaceGovernanceSettings {
  const existing = governanceSettingsStore.get(workspaceId);
  if (existing) {
    return { ...existing };
  }

  const defaultSettings: WorkspaceGovernanceSettings = {
    ...DEFAULT_GOVERNANCE_SETTINGS,
    workspaceId,
    updatedAt: new Date().toISOString(),
  };

  governanceSettingsStore.set(workspaceId, defaultSettings);
  return { ...defaultSettings };
}

/**
 * Updates governance & model settings for a workspace.
 */
export function setWorkspaceGovernance(
  workspaceId: string,
  updates: Partial<Omit<WorkspaceGovernanceSettings, "workspaceId">>
): WorkspaceGovernanceSettings {
  const current = getWorkspaceGovernance(workspaceId);

  const updated: WorkspaceGovernanceSettings = {
    ...current,
    ...updates,
    workspaceId,
    updatedAt: new Date().toISOString(),
  };

  governanceSettingsStore.set(workspaceId, updated);
  return { ...updated };
}

/**
 * Resets the in-memory governance store (useful for tests).
 */
export function resetGovernanceStore(): void {
  governanceSettingsStore.clear();
}
