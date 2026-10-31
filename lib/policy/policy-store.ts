import { RepositoryPolicy, ReviewProfile, NotificationThreshold } from "@/types/policy";

const repositoryPolicies = new Map<string, RepositoryPolicy>();

export const DEFAULT_REPOSITORY_POLICY: Omit<RepositoryPolicy, "repositoryId" | "workspaceId"> = {
  autoReviewEnabled: true,
  branches: ["main", "master", "release/*"],
  paths: [],
  ignoredAuthors: ["dependabot[bot]", "renovate[bot]", "github-actions[bot]"],
  reviewProfile: "comprehensive",
  customRules: [
    "Verify all input parameters are validated before use.",
    "Ensure sensitive tokens and keys are never printed in console logs.",
  ],
  slackWebhookUrl: null,
  discordWebhookUrl: null,
  notificationThreshold: "high",
  updatedAt: new Date().toISOString(),
};

/**
 * Retrieves the effective policy for a repository, creating the default policy if not set.
 */
export function getRepositoryPolicy(repositoryId: string, workspaceId: string): RepositoryPolicy {
  const existing = repositoryPolicies.get(repositoryId);
  if (existing) {
    return { ...existing };
  }

  const defaultPolicy: RepositoryPolicy = {
    ...DEFAULT_REPOSITORY_POLICY,
    repositoryId,
    workspaceId,
    updatedAt: new Date().toISOString(),
  };

  repositoryPolicies.set(repositoryId, defaultPolicy);
  return { ...defaultPolicy };
}

/**
 * Updates repository policy settings.
 */
export function setRepositoryPolicy(
  repositoryId: string,
  workspaceId: string,
  updates: Partial<Omit<RepositoryPolicy, "repositoryId" | "workspaceId">>
): RepositoryPolicy {
  const current = getRepositoryPolicy(repositoryId, workspaceId);

  const updated: RepositoryPolicy = {
    ...current,
    ...updates,
    repositoryId,
    workspaceId,
    updatedAt: new Date().toISOString(),
  };

  repositoryPolicies.set(repositoryId, updated);
  return { ...updated };
}

/**
 * Clears in-memory policies (useful for testing).
 */
export function resetPolicyStore(): void {
  repositoryPolicies.clear();
}
