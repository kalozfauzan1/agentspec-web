import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { StoreHydrator } from "@/components/shell/store-hydrator";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentSpec — Specification builder for coding agents",
  description:
    "Turn a software idea into a structured, coding-agent-ready specification package: PRD, feature specs, architecture, data model, API, tasks, and AGENTS.md.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-canvas font-sans text-foreground">
        <StoreHydrator />
        {children}
      </body>
    </html>
  );
}
