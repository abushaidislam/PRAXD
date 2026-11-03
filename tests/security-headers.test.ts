import { describe, it, expect } from "vitest";
import nextConfig from "../next.config.mjs";

describe("Next.js Security Headers Configuration", () => {
  it("disables the x-powered-by header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("configures standard defense-in-depth security headers for all routes", async () => {
    expect(nextConfig.headers).toBeDefined();
    if (!nextConfig.headers) return;

    const headerConfigs = await nextConfig.headers();

    const wildcardConfig = headerConfigs.find((c: any) => c.source === "/:path*");
    expect(wildcardConfig).toBeDefined();
    if (!wildcardConfig) return;

    const headersMap = new Map<string, string>();
    for (const h of wildcardConfig.headers) {
      headersMap.set(h.key.toLowerCase(), h.value);
    }

    expect(headersMap.get("x-frame-options")).toBe("DENY");
    expect(headersMap.get("x-content-type-options")).toBe("nosniff");
    expect(headersMap.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headersMap.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(headersMap.get("x-dns-prefetch-control")).toBe("on");
  });
});
