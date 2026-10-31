import { RepositoryPolicy, NotificationThreshold, RiskScore, NotificationResult } from "@/types/policy";

export interface NotificationPayloadOptions {
  policy: RepositoryPolicy;
  pr: {
    number: number;
    title: string;
    htmlUrl: string;
    author: string;
    repoFullName: string;
  };
  findings: Array<{
    severity: string;
    title: string;
    kind?: string;
    filePath?: string;
    impactSummary?: string;
  }>;
  risk: RiskScore;
}

/**
 * Checks whether findings meet the configured notification threshold.
 */
export function meetsNotificationThreshold(
  threshold: NotificationThreshold,
  findings: Array<{ severity: string }>
): boolean {
  if (threshold === "none" || findings.length === 0) {
    return false;
  }

  const hasCritical = findings.some((f) => f.severity.toLowerCase() === "critical");
  const hasHigh = findings.some((f) => f.severity.toLowerCase() === "high");
  const hasMedium = findings.some((f) => f.severity.toLowerCase() === "medium");

  switch (threshold) {
    case "critical":
      return hasCritical;
    case "high":
      return hasCritical || hasHigh;
    case "medium":
      return hasCritical || hasHigh || hasMedium;
    case "all":
      return findings.length > 0;
    default:
      return hasCritical || hasHigh;
  }
}

/**
 * Formats Slack notification payload using Slack Block Kit.
 * Strictly omits sensitive code patches and secrets.
 */
export function formatSlackPayload(options: NotificationPayloadOptions): any {
  const { pr, findings, risk } = options;
  const criticalOrHigh = findings.filter(
    (f) => f.severity.toLowerCase() === "critical" || f.severity.toLowerCase() === "high"
  );
  const displayFindings = criticalOrHigh.length > 0 ? criticalOrHigh : findings.slice(0, 5);

  const findingsText = displayFindings
    .map(
      (f) =>
        `• *[${f.severity.toUpperCase()}]* ${f.title}${
          f.filePath ? ` (\`${f.filePath}\`)` : ""
        }\n  _${f.impactSummary || "Identified during automated policy scan."}_`
    )
    .join("\n\n");

  return {
    text: `🚨 PRAXD Security Alert: PR #${pr.number} in ${pr.repoFullName} (${risk.label})`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🚨 PRAXD Security Alert: PR #${pr.number}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Repository:* ${pr.repoFullName}\n*Pull Request:* <${pr.htmlUrl}|#${pr.number} - ${pr.title}>\n*Author:* @${pr.author}\n*Risk Level:* *${risk.label}* (Score: ${risk.score}/100)`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Key Findings Detected (${findings.length} total):*\n\n${findingsText}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "🔒 Sensitive source code and tokens are excluded from this advisory alert.",
          },
        ],
      },
    ],
  };
}

/**
 * Formats Discord notification payload using Discord Webhook Embeds.
 * Strictly omits sensitive code patches and secrets.
 */
export function formatDiscordPayload(options: NotificationPayloadOptions): any {
  const { pr, findings, risk } = options;

  let color = 0x10b981; // green
  if (risk.tier === "high") {
    color = 0xef4444; // red
  } else if (risk.tier === "medium") {
    color = 0xf59e0b; // amber
  }

  const criticalOrHigh = findings.filter(
    (f) => f.severity.toLowerCase() === "critical" || f.severity.toLowerCase() === "high"
  );
  const displayFindings = criticalOrHigh.length > 0 ? criticalOrHigh : findings.slice(0, 5);

  const fields = [
    {
      name: "Risk Score",
      value: `${risk.score}/100 (${risk.label})`,
      inline: true,
    },
    {
      name: "Author",
      value: `@${pr.author}`,
      inline: true,
    },
    {
      name: "Total Findings",
      value: `${findings.length} issue(s)`,
      inline: true,
    },
    {
      name: "Top Security Findings",
      value:
        displayFindings
          .map(
            (f) =>
              `• **[${f.severity.toUpperCase()}]** ${f.title}${
                f.filePath ? ` (\`${f.filePath}\`)` : ""
              }`
          )
          .join("\n") || "No critical findings.",
      inline: false,
    },
  ];

  return {
    username: "PRAXD Bot",
    avatar_url: "https://praxd.dev/icon.png",
    embeds: [
      {
        title: `🚨 Security Alert: [${pr.repoFullName}] #${pr.number} ${pr.title}`,
        url: pr.htmlUrl,
        description: `Automated PR Policy Scan detected potential issues requiring engineering triage before merge.`,
        color,
        fields,
        footer: {
          text: "PRAXD Autonomous CI/CD Guard • Code excerpts omitted for confidentiality",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Dispatches webhook notifications to configured Slack and/or Discord channels.
 */
export async function dispatchReviewNotifications(
  options: NotificationPayloadOptions
): Promise<NotificationResult> {
  const result: NotificationResult = {
    slack: { sent: false },
    discord: { sent: false },
  };

  const { policy, findings } = options;
  const shouldNotify = meetsNotificationThreshold(policy.notificationThreshold, findings);

  if (!shouldNotify) {
    result.slack.skippedReason = "Findings did not meet severity threshold.";
    result.discord.skippedReason = "Findings did not meet severity threshold.";
    return result;
  }

  // Slack dispatch
  if (policy.slackWebhookUrl) {
    if (policy.slackWebhookUrl.includes("example.com") || policy.slackWebhookUrl.includes("dummy")) {
      result.slack.sent = true;
      result.slack.skippedReason = "Mock delivery (test webhook URL)";
    } else {
      try {
        const payload = formatSlackPayload(options);
        const res = await fetch(policy.slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          result.slack.sent = true;
        } else {
          result.slack.error = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        }
      } catch (err: any) {
        result.slack.error = err?.message || "Failed to deliver Slack notification.";
      }
    }
  } else {
    result.slack.skippedReason = "Slack webhook URL not configured.";
  }

  // Discord dispatch
  if (policy.discordWebhookUrl) {
    if (policy.discordWebhookUrl.includes("example.com") || policy.discordWebhookUrl.includes("dummy")) {
      result.discord.sent = true;
      result.discord.skippedReason = "Mock delivery (test webhook URL)";
    } else {
      try {
        const payload = formatDiscordPayload(options);
        const res = await fetch(policy.discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          result.discord.sent = true;
        } else {
          result.discord.error = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        }
      } catch (err: any) {
        result.discord.error = err?.message || "Failed to deliver Discord notification.";
      }
    }
  } else {
    result.discord.skippedReason = "Discord webhook URL not configured.";
  }

  return result;
}
