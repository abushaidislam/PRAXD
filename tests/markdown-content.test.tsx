import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MarkdownContent } from "@/components/markdown-content";

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

  it("renders HTML details and summary as an interactive collapsible accordion without exposing raw markup", () => {
    const raw = `<details> <summary> ℹ️ About Codex in GitHub</summary> <br/>
Your team has set up Codex to review pull requests in this repo.
* Open a pull request for review
* Mark a draft as ready
</details>`;

    const { container } = render(<MarkdownContent content={raw} />);

    // Should NOT expose raw HTML tags as text
    expect(screen.queryByText(/<details>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<summary>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<\/details>/i)).not.toBeInTheDocument();

    // Should render a real <details> and <summary> element
    const details = container.querySelector("details");
    expect(details).toBeInTheDocument();

    const summary = container.querySelector("summary");
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent("About Codex in GitHub");

    expect(screen.getByText("Open a pull request for review")).toBeInTheDocument();
  });

  it("renders embedded HTML tags like <a>, <sup>, and <img> inside tables cleanly", () => {
    const raw = `| Project | Deployment | Actions |
| :--- | :--- | :--- |
| <a href="https://vercel.com/project"><sup><img src="https://vercel.com/avatar.png" width="16" height="16" alt="Avatar" /></sup></a> praxd | ![Ready](https://vercel.com/ready.ico) [Ready](https://praxd.vercel.app) | [Preview](https://praxd.vercel.app) |`;

    const { container } = render(<MarkdownContent content={raw} />);

    // Raw tags must NOT appear as literal text
    expect(screen.queryByText(/<a href=/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<sup>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<img src=/i)).not.toBeInTheDocument();

    // Check that link to project exists
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "https://vercel.com/project")).toBe(true);

    // Check that images are rendered as real img elements
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(2); // avatar + ready icon
    expect(screen.getByText("praxd")).toBeInTheDocument();
  });

  it("renders GitHub <relative-time> component cleanly as formatted time", () => {
    const raw = `✅ Completed <relative-time datetime="2026-10-31T12:24:07.199398Z">2026-10-31T12:24:07.199398Z</relative-time>`;

    const { container } = render(<MarkdownContent content={raw} />);

    // Should NOT show raw XML/HTML tag
    expect(screen.queryByText(/<relative-time/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<\/relative-time>/i)).not.toBeInTheDocument();

    // Should render a <time> tag with datetime
    const timeEl = container.querySelector("time");
    expect(timeEl).toBeInTheDocument();
    expect(timeEl).toHaveAttribute("datetime", "2026-10-31T12:24:07.199398Z");
  });

  it("renders GitHub Alerts with icons and styled callouts", () => {
    const raw = `> [!NOTE]
> Crucial information to keep in mind.`;

    render(<MarkdownContent content={raw} />);

    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Crucial information to keep in mind.")).toBeInTheDocument();
  });

  it("renders task lists with checkboxes", () => {
    const raw = `- [ ] Pending item
- [x] Completed item`;

    const { container } = render(<MarkdownContent content={raw} />);

    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    expect(checkboxes.length).toBe(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
  });

  it("strips Dependabot metadata comments like [//]: # (dependabot-automerge-start)", () => {
    const raw = `Bumps [motion](https://github.com/motion) from 13 to 14.
[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)`;

    render(<MarkdownContent content={raw} />);

    expect(screen.queryByText(/dependabot-automerge/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Bumps/i)).toBeInTheDocument();
  });

  it("normalizes HTML blocks (<blockquote>, <h2>, <ul>, <li>, <p>) inside changelogs without exposing raw markup", () => {
    const raw = `<details>
<summary>Changelog</summary>
<p><em>Sourced from motion's changelog.</em></p>
<blockquote>
<h2>[14.7.1] 2026-10-27</h2>
<h3>Fixed</h3>
<ul>
<li>Demote transforms to CPU when interrupted by layout animations.</li>
</ul>
</blockquote>
</details>`;

    const { container } = render(<MarkdownContent content={raw} />);

    // Raw tags must NOT appear as literal text
    expect(screen.queryByText(/<p>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<\/p>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<blockquote>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<\/blockquote>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<h2>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<ul>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<li>/i)).not.toBeInTheDocument();

    // Elements must render properly
    expect(screen.getByText("Demote transforms to CPU when interrupted by layout animations.")).toBeInTheDocument();
    expect(screen.getByText("[14.7.1] 2026-10-27")).toBeInTheDocument();
  });

  it("renders linked badge images [![alt](img)](url) properly", () => {
    const raw = `[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?test=1)](https://docs.github.com/compatibility-scores)`;

    const { container } = render(<MarkdownContent content={raw} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://docs.github.com/compatibility-scores");
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "Dependabot compatibility score");
  });

  describe("Security: URL Sanitization & XSS Mitigation", () => {
    it("sanitizes dangerous data:text/html links to #", () => {
      const raw = `[Malicious HTML](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)`;
      render(<MarkdownContent content={raw} />);

      const link = screen.getByRole("link", { name: /Malicious HTML/i });
      expect(link).toHaveAttribute("href", "#");
    });

    it("sanitizes javascript:, vbscript:, and control-character obfuscated links to #", () => {
      const raw = `[Exploit 1](javascript:alert(1))
[Exploit 2](  jav\u0000ascript:alert(2)  )
[Exploit 3](vbscript:msgbox(1))
[Exploit 4](file:///etc/passwd)`;

      render(<MarkdownContent content={raw} />);

      const link1 = screen.getByRole("link", { name: /Exploit 1/i });
      const link2 = screen.getByRole("link", { name: /Exploit 2/i });
      const link3 = screen.getByRole("link", { name: /Exploit 3/i });
      const link4 = screen.getByRole("link", { name: /Exploit 4/i });

      expect(link1).toHaveAttribute("href", "#");
      expect(link2).toHaveAttribute("href", "#");
      expect(link3).toHaveAttribute("href", "#");
      expect(link4).toHaveAttribute("href", "#");
    });

    it("allows safe http, https, mailto, and relative links", () => {
      const raw = `[Docs](https://example.com/docs)
[Contact](mailto:security@example.com)
[Section](#overview)`;

      render(<MarkdownContent content={raw} />);

      expect(screen.getByRole("link", { name: /Docs/i })).toHaveAttribute("href", "https://example.com/docs");
      expect(screen.getByRole("link", { name: /Contact/i })).toHaveAttribute("href", "mailto:security@example.com");
      expect(screen.getByRole("link", { name: /Section/i })).toHaveAttribute("href", "#overview");
    });
  });
});
