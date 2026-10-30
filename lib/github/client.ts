export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export class GitHubApiError extends Error {
  status: number;
  rateLimit?: RateLimitInfo;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    rateLimit?: RateLimitInfo,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.rateLimit = rateLimit;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Extracts pagination links from GitHub's Link header.
 */
export function parseLinkHeader(header: string | null): {
  next?: string;
  last?: string;
  prev?: string;
  first?: string;
} {
  if (!header) return {};

  const links: Record<string, string> = {};
  const parts = header.split(",");

  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      links[match[2]] = match[1];
    }
  }

  return links;
}

/**
 * Executes an authenticated GitHub API request with error handling,
 * rate limit inspection, and JSON decoding.
 */
export async function githubFetch<T>(
  endpoint: string,
  token: string,
  options?: RequestInit
): Promise<{ data: T; nextUrl?: string; rateLimit: RateLimitInfo }> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://api.github.com${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(options?.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  headers.set("User-Agent", "PRAXD-PR-Workspace/0.1.0");

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const rateLimit: RateLimitInfo = {
    limit: parseInt(response.headers.get("x-ratelimit-limit") || "5000", 10),
    remaining: parseInt(response.headers.get("x-ratelimit-remaining") || "5000", 10),
    reset: parseInt(response.headers.get("x-ratelimit-reset") || "0", 10),
  };

  if (!response.ok) {
    const errorBody = await response.text();
    let retryAfter: number | undefined;

    const retryHeader = response.headers.get("retry-after");
    if (retryHeader) {
      retryAfter = parseInt(retryHeader, 10);
    } else if (response.status === 429 || rateLimit.remaining === 0) {
      retryAfter = Math.max(0, rateLimit.reset - Math.floor(Date.now() / 1000));
    }

    let errorMessage = `GitHub API error: ${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.message) {
        errorMessage = `GitHub API error (${response.status}): ${parsed.message}`;
      }
    } catch {
      // Body not JSON
    }

    throw new GitHubApiError(errorMessage, response.status, rateLimit, retryAfter);
  }

  const data = (await response.json()) as T;
  const linkHeader = response.headers.get("link");
  const parsedLinks = parseLinkHeader(linkHeader);

  return {
    data,
    nextUrl: parsedLinks.next,
    rateLimit,
  };
}

/**
 * Automatically pages through GitHub endpoints to fetch all available records
 * up to a bounded safety limit (e.g. 3,000 files as specified in ROADMAP P1-06 / P1-07).
 */
export async function githubFetchAllPages<T>(
  initialEndpoint: string,
  token: string,
  maxItems = 3000
): Promise<T[]> {
  const results: T[] = [];
  let currentUrl: string | undefined = initialEndpoint;

  while (currentUrl && results.length < maxItems) {
    const res: { data: T[]; nextUrl?: string } = await githubFetch<T[]>(currentUrl, token);
    if (Array.isArray(res.data)) {
      results.push(...res.data);
    } else {
      break;
    }
    currentUrl = res.nextUrl;
  }

  return results.slice(0, maxItems);
}
