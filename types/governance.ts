export type AIProviderType =
  | "anthropic"
  | "gemini"
  | "openai"
  | "selfhosted"
  | "fallback"
  | "deterministic";

export interface SelfHostedConfig {
  baseUrl: string;
  apiKey?: string | null;
  model?: string;
  requireTls?: boolean;
  customHeaders?: Record<string, string>;
}

export interface WorkspaceGovernanceSettings {
  workspaceId: string;
  primaryProvider: AIProviderType;
  modelName: string;
  fallbackProviders: AIProviderType[];
  selfHosted?: SelfHostedConfig;
  retentionDays: number; // e.g. 30, 60, 90; 0 = retain indefinitely
  zeroDataRetention: boolean;
  autoPurgeEnabled: boolean;
  lastPurgeAt?: string | null;
  updatedAt: string;
}

export interface PurgeResult {
  prunedDiffsCount: number;
  affectedPullRequestsCount: number;
  purgedBytes: number;
  completedAt: string;
}

export type DoraRating = "elite" | "high" | "medium" | "low";

export interface DoraMetrics {
  timeToFirstReviewHours: number;
  reviewCycleTimeHours: number;
  triageResolutionRate: number; // Percentage 0 - 100
  churnVelocityLinesPerPr: number;
  doraRating: DoraRating;
  totalPrsAnalyzed: number;
  resolvedFindingsCount: number;
  totalFindingsCount: number;
  generatedAt: string;
}
