import { RiskScore, RiskTier, RiskFactors } from "@/types/policy";

const SENSITIVE_PATTERNS = {
  auth: /(?:^|\/)(auth|security|crypto|oauth|tokens?|permissions?|session|jwt|password|secret|credential)\b/i,
  database: /(?:^|\/)(migrations?|db|database|schema|sql|seed)\b/i,
  infra: /(?:^|\/)(dockerfile|\.github|k8s|kubernetes|terraform|docker-compose|helm)\b/i,
};

const DEPENDENCY_MANIFEST_PATTERNS = [
  /^package\.json$/i,
  /\/package\.json$/i,
  /package-lock\.json$/i,
  /pnpm-lock\.yaml$/i,
  /yarn\.lock$/i,
  /cargo\.(toml|lock)$/i,
  /go\.(mod|sum)$/i,
  /requirements.*\.txt$/i,
  /pipfile(?:\.lock)?$/i,
  /gemfile(?:\.lock)?$/i,
  /pom\.xml$/i,
  /build\.gradle(?:\.kts)?$/i,
];

const TEST_FILE_PATTERN = /(?:^|\/)(?:tests?|specs?|__tests__)\/|\.(?:test|spec)\.[a-zA-Z0-9]+$/i;
const DOCS_OR_STATIC_PATTERN = /\.(md|txt|png|jpg|jpeg|gif|svg|ico|css)$/i;

export interface FileInput {
  path: string;
  additions?: number;
  deletions?: number;
}

export interface FindingInput {
  severity: "critical" | "high" | "medium" | "low" | "info" | string;
}

/**
 * Deterministically computes the PR Blast Radius & composite Risk Score (0-100).
 */
export function computeRiskScore(params: {
  additions: number;
  deletions: number;
  files: FileInput[];
  findings?: FindingInput[];
}): RiskScore {
  const { additions, deletions, files, findings = [] } = params;
  const totalLinesChanged = additions + deletions;

  // 1. Churn Volume Score (0-25)
  let churnScore = 0;
  if (totalLinesChanged === 0) {
    churnScore = 0;
  } else if (totalLinesChanged <= 50) {
    churnScore = 5;
  } else if (totalLinesChanged <= 200) {
    churnScore = 10;
  } else if (totalLinesChanged <= 500) {
    churnScore = 18;
  } else {
    churnScore = 25;
  }

  // 2. Blast Radius & Critical Core Modules (0-25)
  const criticalFilesTouched: string[] = [];
  let blastPoints = 0;

  for (const file of files) {
    // Test files should not be flagged as sensitive production blast radius
    if (TEST_FILE_PATTERN.test(file.path)) {
      continue;
    }

    let matched = false;
    if (SENSITIVE_PATTERNS.auth.test(file.path)) {
      blastPoints += 15;
      matched = true;
    }
    if (SENSITIVE_PATTERNS.database.test(file.path)) {
      blastPoints += 10;
      matched = true;
    }
    if (SENSITIVE_PATTERNS.infra.test(file.path)) {
      blastPoints += 10;
      matched = true;
    }
    if (matched && !criticalFilesTouched.includes(file.path)) {
      criticalFilesTouched.push(file.path);
    }
  }
  const blastRadiusScore = Math.min(25, blastPoints);

  // 3. Dependency Modifications (0-15)
  const dependenciesTouched: string[] = [];
  for (const file of files) {
    const isDep = DEPENDENCY_MANIFEST_PATTERNS.some((pat) => pat.test(file.path));
    if (isDep && !dependenciesTouched.includes(file.path)) {
      dependenciesTouched.push(file.path);
    }
  }
  const dependencyScore = dependenciesTouched.length > 0 ? 15 : 0;

  // 4. Test Coverage Delta (0-15)
  const hasTests = files.some((file) => TEST_FILE_PATTERN.test(file.path));
  const hasExecutableCode = files.some(
    (file) =>
      !TEST_FILE_PATTERN.test(file.path) &&
      !DOCS_OR_STATIC_PATTERN.test(file.path) &&
      !DEPENDENCY_MANIFEST_PATTERNS.some((pat) => pat.test(file.path))
  );

  let testCoverageScore = 0;
  // If executable code changed but zero tests were added/updated, penalize with untested risk
  if (hasExecutableCode && !hasTests) {
    testCoverageScore = 15;
  }

  // 5. AI Finding Severity (0-20)
  let findingPoints = 0;
  let highOrCriticalFindingsCount = 0;

  for (const finding of findings) {
    const sev = finding.severity.toLowerCase();
    if (sev === "critical") {
      findingPoints += 20;
      highOrCriticalFindingsCount++;
    } else if (sev === "high") {
      findingPoints += 15;
      highOrCriticalFindingsCount++;
    } else if (sev === "medium") {
      findingPoints += 8;
    } else if (sev === "low") {
      findingPoints += 2;
    }
  }
  const findingsScore = Math.min(20, findingPoints);

  // Composite calculation
  const rawScore =
    churnScore + blastRadiusScore + dependencyScore + testCoverageScore + findingsScore;
  const score = Math.max(0, Math.min(100, rawScore));

  let tier: RiskTier = "low";
  let label = "Low Risk";
  if (score > 65) {
    tier = "high";
    label = "High Risk";
  } else if (score > 30) {
    tier = "medium";
    label = "Medium Risk";
  }

  const factors: RiskFactors = {
    churnScore,
    blastRadiusScore,
    dependencyScore,
    testCoverageScore,
    findingsScore,
    totalLinesChanged,
    criticalFilesTouched,
    dependenciesTouched,
    hasTests,
    highOrCriticalFindingsCount,
  };

  return {
    score,
    tier,
    label,
    factors,
  };
}
