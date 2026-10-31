import crypto from "crypto";
import { decryptKeyIfEnveloped } from "@/lib/security/kms";

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<number, CachedToken>();

/**
 * Generates an RS256 JWT signed with the GitHub App private key.
 * Used exclusively on the server to authenticate as the GitHub App.
 */
export function generateAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyBase64 = process.env.GITHUB_APP_PRIVATE_KEY_BASE64;

  if (!appId || !privateKeyBase64) {
    throw new Error(
      "GitHub App configuration missing: GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY_BASE64 is not set."
    );
  }

  const { key: resolvedKey, purge } = decryptKeyIfEnveloped(privateKeyBase64);
  let privateKey = resolvedKey;
  if (
    !resolvedKey.includes("-----BEGIN RSA PRIVATE KEY-----") &&
    !resolvedKey.includes("-----BEGIN PRIVATE KEY-----")
  ) {
    try {
      privateKey = Buffer.from(resolvedKey, "base64").toString("utf8");
    } catch {
      privateKey = resolvedKey;
    }
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const payload = {
      iat: now - 60, // Issued 60 seconds in the past to allow for clock drift
      exp: now + 9 * 60, // Expires in 9 minutes (max allowed by GitHub is 10 min)
      iss: appId,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const message = `${encodedHeader}.${encodedPayload}`;

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(message);
    const signature = signer.sign(privateKey, "base64url");

    return `${message}.${signature}`;
  } finally {
    purge();
  }
}

/**
 * Obtains a short-lived installation access token for a given GitHub App installation.
 * Uses an in-memory cache to prevent unnecessary token generation round-trips.
 */
export async function getInstallationAccessToken(
  installationId: number
): Promise<string> {
  // Check cache first (with 5 minute safety buffer before expiry)
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }

  const jwt = generateAppJwt();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to obtain installation access token for installation ${installationId}: ${response.status} ${errorText}`
    );
  }

  const data = (await response.json()) as {
    token: string;
    expires_at: string;
    permissions: Record<string, string>;
  };

  const expiresAt = new Date(data.expires_at).getTime();
  tokenCache.set(installationId, {
    token: data.token,
    expiresAt,
  });

  return data.token;
}

export interface InstallationInfo {
  id: number;
  account: { login: string; type: string };
  repositorySelection: string;
}

/**
 * Validates an installation ID against GitHub API using App JWT authentication.
 * Confirms account login, account type, and repository selection.
 */
export async function getInstallationDetails(
  installationId: number
): Promise<InstallationInfo | null> {
  try {
    const jwt = generateAppJwt();
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "PRAXD-PR-Workspace/0.1.0",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      account: {
        login: data.account?.login || "unknown",
        type: data.account?.type || "User",
      },
      repositorySelection: data.repository_selection || "all",
    };
  } catch {
    return null;
  }
}
