import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import nextConfig from "@/next.config.mjs";
import { CheckRunList } from "@/components/summary/check-run-list";
import { CheckRun } from "@/types/pr";

describe("Security Headers & Link Hardening Suite", () => {
  it("configures required global HTTP security headers on all routes", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    const headerConfigs = await nextConfig.headers!();

    expect(headerConfigs).toBeInstanceOf(Array);
    const globalRule = headerConfigs.find((rule: any) => rule.source === "/(.*)");
    expect(globalRule).toBeDefined();
    if (!globalRule) throw new Error("Expected global headers rule to be defined");

    const headersMap = new Map(
      globalRule.headers.map((h: { key: string; value: string }) => [h.key, h.value])
    );

    // Frame protection
    expect(headersMap.get("X-Frame-Options")).toBe("DENY");
    // MIME-sniffing prevention
    expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");
    // Referrer policy
    expect(headersMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    // Permissions policy
    expect(headersMap.get("Permissions-Policy")).toContain("camera=()");
  });

  it("renders check run external link when detailsUrl is a safe https protocol", () => {
    const checks: CheckRun[] = [
      {
        id: "check-1",
        name: "Test Suite",
        status: "completed",
        conclusion: "success",
        detailsUrl: "https://github.com/praxd/praxd/actions/runs/123",
      },
    ];

    render(<CheckRunList checks={checks} />);

    const link = screen.getByRole("link", { name: /View details for Test Suite/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://github.com/praxd/praxd/actions/runs/123");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render link when detailsUrl uses dangerous javascript: or data: schemes", () => {
    const checks: CheckRun[] = [
      {
        id: "check-xss-1",
        name: "Malicious JS Check",
        status: "completed",
        conclusion: "failure",
        detailsUrl: "javascript:alert(document.cookie)",
      },
      {
        id: "check-xss-2",
        name: "Malicious Data Check",
        status: "completed",
        conclusion: "failure",
        detailsUrl: "data:text/html,<script>alert(1)</script>",
      },
    ];

    render(<CheckRunList checks={checks} />);

    expect(screen.queryByRole("link", { name: /View details for Malicious JS Check/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View details for Malicious Data Check/i })).not.toBeInTheDocument();
  });
});
