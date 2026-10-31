import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MarkdownContent, renderInlineMarkdown } from "@/components/markdown-content";

describe("Markdown Content & Comment Viewer Suite", () => {
  it("renders bold text, links, and inline code properly", () => {
    const raw = "Switch to **Reactive Mode** via [Jules settings](https://jules.google.com) or `@jules`.";
    render(<MarkdownContent content={raw} />);

    expect(screen.getByText("Reactive Mode")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Jules settings/i });
    expect(link).toHaveAttribute("href", "https://jules.google.com");
    expect(screen.getByText("@jules")).toBeInTheDocument();
  });

  it("strips hidden bot metadata like [vc]: #hash and HTML comments", () => {
    const raw = `[vc]: #9YptFdxpAuDIolLgHvk1ptTVUwk3zE/mSp/ZKJ/vCg=
<!-- hidden comment -->
The latest updates on your projects. Learn more about [Vercel](https://vercel.link).`;

    render(<MarkdownContent content={raw} />);

    expect(screen.queryByText(/9YptFdxpAu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden comment/i)).not.toBeInTheDocument();
    expect(screen.getByText(/The latest updates on your projects/i)).toBeInTheDocument();
  });

  it("renders markdown tables cleanly", () => {
    const raw = `| Project | Deployment | Actions | Updated |
|---|---|---|---|
| my-app | https://app.vercel.app | Inspect | 2h |`;

    render(<MarkdownContent content={raw} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Deployment")).toBeInTheDocument();
    expect(screen.getByText("my-app")).toBeInTheDocument();
    expect(screen.getByText("https://app.vercel.app")).toBeInTheDocument();
  });

  it("renders bullet lists and blockquotes", () => {
    const raw = `> Attention: this is a note
- First feature
- Second feature`;

    render(<MarkdownContent content={raw} />);

    expect(screen.getByText("Attention: this is a note")).toBeInTheDocument();
    expect(screen.getByText("First feature")).toBeInTheDocument();
    expect(screen.getByText("Second feature")).toBeInTheDocument();
  });
});
