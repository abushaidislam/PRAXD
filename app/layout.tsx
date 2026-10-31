import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRAXD — AI-Powered GitHub Pull Request Workspace",
  description: "Dense, professional AI-powered GitHub PR review workspace.",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-praxd-bg text-praxd-text antialiased">
        {children}
      </body>
    </html>
  );
}
