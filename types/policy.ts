export type ReviewProfile =
  | "strict_security"
  | "performance"
  | "style"
  | "comprehensive";

export type NotificationThreshold = "critical" | "high" | "medium" | "all" | "none";

export interface RepositoryPolicy {
  repositoryId: string;
  workspaceId: string;
  autoReviewEnabled: boolean;
  branches: string[];
  paths: string[];
  ignoredAuthors: string[];
  reviewProfile: ReviewProfile;
  customRules: string[];
  slackWebhookUrl?: string | null;
  discordWebhookUrl?: string | null;
  notificationThreshold: NotificationThreshold;
  updatedAt: string;
}

export type RiskTier = "low" | "medium" | "high";

export interface RiskFactors {
  churnScore: number;
  blastRadiusScore: number;
  dependencyScore: number;
  testCoverageScore: number;
  findingsScore: number;
  totalLinesChanged: number;
  criticalFilesTouched: string[];
  dependenciesTouched: string[];
  hasTests: boolean;
  highOrCriticalFindingsCount: number;
}

export interface RiskScore {
  score: number; // 0 to 100
  tier: RiskTier;
  label: string;
  factors: RiskFactors;
}

export interface NotificationResult {
  slack: {
    sent: boolean;
    skippedReason?: string;
    error?: string;
  };
  discord: {
    sent: boolean;
    skippedReason?: string;
    error?: string;
  };
}
