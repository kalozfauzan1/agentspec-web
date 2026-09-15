"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  Compass,
  Database,
  Download,
  GitBranch,
  Image,
  Layers,
  ListChecks,
  Palette,
  Route,
  ScrollText,
  Send,
  Settings2,
  Sparkles,
  Terminal,
} from "lucide-react";
import { BrandMark } from "@/components/shell/app-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ARTIFACT_KEYS, type ArtifactKey, type ArtifactStatus } from "@/lib/schemas";
import { useProjectStore } from "@/lib/store/project-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { isBlockingIssue } from "@/lib/validation/issues";

const NAV_GROUPS: {
  label: string | null;
  items: { href: string; label: string; icon: React.ElementType; artifact?: ArtifactKey }[];
}[] = [
  {
    label: null,
    items: [{ href: "", label: "Overview", icon: Compass }],
  },
  {
    label: "Product",
    items: [
      { href: "/prd", label: "PRD", icon: ScrollText, artifact: "prd" },
      { href: "/features", label: "Features", icon: Layers, artifact: "features" },
      { href: "/flows", label: "User Flows", icon: Route, artifact: "flows" },
      { href: "/design", label: "UI Design", icon: Palette, artifact: "uiDesign" },
      { href: "/assets", label: "Asset Plan", icon: Image, artifact: "assetPlan" },
    ],
  },
  {
    label: "Technical",
    items: [
      { href: "/architecture", label: "Architecture", icon: Boxes, artifact: "architecture" },
      { href: "/data-model", label: "Data Model", icon: Database, artifact: "dataModel" },
      { href: "/api", label: "API", icon: GitBranch, artifact: "api" },
    ],
  },
  {
    label: "Implementation",
    items: [
      { href: "/tasks", label: "Tasks", icon: ListChecks, artifact: "tasks" },
      { href: "/agents", label: "Agent Instructions", icon: Terminal, artifact: "agentInstructions" },
    ],
  },
  {
    label: null,
    items: [{ href: "/export", label: "Export", icon: Download }],
  },
];

const PATH_TARGETS: { match: RegExp; target: ArtifactKey | "definition"; label: string }[] = [
  { match: /\/prd$/, target: "prd", label: "PRD" },
  { match: /\/features/, target: "features", label: "Feature Specifications" },
  { match: /\/flows$/, target: "flows", label: "User Flows" },
  { match: /\/design$/, target: "uiDesign", label: "UI Design" },
  { match: /\/assets$/, target: "assetPlan", label: "Asset Plan" },
  { match: /\/architecture$/, target: "architecture", label: "Architecture" },
  { match: /\/data-model$/, target: "dataModel", label: "Data Model" },
  { match: /\/api$/, target: "api", label: "API Specification" },
  { match: /\/tasks$/, target: "tasks", label: "Implementation Tasks" },
  { match: /\/agents$/, target: "agentInstructions", label: "AGENTS.md" },
];

function StatusDot({ status }: { status: ArtifactStatus["status"] | undefined }) {
  const tone =
    status === "ready"
      ? "bg-success"
      : status === "failed"
        ? "bg-danger"
        : status === "stale"
          ? "bg-warning"
          : status === "running"
            ? "bg-primary"
            : "bg-border-strong";
  return <span className={cn("size-1.5 shrink-0 rounded-full", tone)} />;
}

export function WorkspaceShell({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { active, busy, applyInstruction, error, setError } = useProjectStore();
  const providerMode = useSettingsStore((state) => state.settings.provider.mode);

  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);

  if (!active) return null;

  const base = `/project/${projectId}`;
  const currentPath = pathname.replace(base, "") || "";
  // The overview edits the project definition itself, which is what every
  // document is derived from.
  const target =
    PATH_TARGETS.find((entry) => entry.match.test(pathname)) ??
    (currentPath === "" ? { target: "definition" as const, label: "Project Definition" } : undefined);
  const showAiBar = Boolean(target) && currentPath !== "/export";
  const lastEdit = active.editHistory[0];

  const submit = async () => {
    const value = instruction.trim();
    if (!value || !target) return;
    setSending(true);
    setError(null);
    try {
      await applyInstruction(projectId, target.target, value);
      setInstruction("");
      router.refresh();
    } catch {
      // The store already exposes the error message.
    } finally {
      setSending(false);
    }
  };

  const problemArtifacts = ARTIFACT_KEYS.filter((key) => {
    const status = active.artifactStatus[key]?.status;
    return status === "stale" || status === "failed";
  });
  const failedCount = ARTIFACT_KEYS.filter(
    (key) => active.artifactStatus[key]?.status === "failed",
  ).length;
  const blockingCount = (active.validation?.issues ?? []).filter(isBlockingIssue).length;

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-border bg-surface lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-4">
          <BrandMark />
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-foreground">AgentSpec</span>
            <span className="text-[11px] text-muted-foreground">Specification workspace</span>
          </span>
        </Link>

        <div className="border-y border-border px-5 py-3">
          <p className="truncate text-[13px] font-medium text-foreground">
            {active.definition?.name ?? "Untitled project"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {active.definition?.features.length ?? 0} feature · {active.artifacts.tasks.length} task
          </p>
        </div>

        <nav className="scrollbar-slim flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className={index > 0 ? "mt-5" : undefined}>
              {group.label && (
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint-foreground">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const href = `${base}${item.href}`;
                  const activeItem = currentPath === item.href;
                  const status = item.artifact ? active.artifactStatus[item.artifact]?.status : undefined;
                  return (
                    <li key={item.label}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] transition-colors",
                          activeItem
                            ? "bg-primary-soft font-medium text-primary"
                            : "text-foreground-soft hover:bg-surface-muted hover:text-foreground",
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.artifact && <StatusDot status={status} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-3 py-3">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] text-foreground-soft transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <Settings2 className="size-4" />
            Settings
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] text-foreground-soft transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <BookOpen className="size-4" />
            Semua project
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-col lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/90 px-6 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-[13px] font-medium text-foreground">
              {active.definition?.name ?? "Untitled project"}
            </span>
            <Badge tone={providerMode === "live" ? "success" : "warning"}>
              {providerMode === "live" ? "AI Live" : "Demo"}
            </Badge>
            {failedCount > 0 && (
              <Badge tone="danger">
                <AlertTriangle className="size-3" />
                {failedCount} dokumen gagal
              </Badge>
            )}
            {blockingCount > 0 && (
              <Badge tone="warning">
                <AlertTriangle className="size-3" />
                {blockingCount} perlu diperbaiki
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {problemArtifacts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void useProjectStore.getState().regenerateArtifacts(projectId, problemArtifacts)
                }
                disabled={busy}
              >
                <Sparkles />
                Regenerate {problemArtifacts.length} dokumen
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link href={`${base}/export`}>
                <Download />
                Export
              </Link>
            </Button>
          </div>
        </header>

        <main className={cn("flex-1", showAiBar && "pb-28")}>
          <div className="mx-auto w-full max-w-[1100px] px-6 py-8">{children}</div>
        </main>

        {showAiBar && (
          <div className="sticky bottom-0 z-20 border-t border-border bg-surface/95 px-6 py-3 backdrop-blur">
            <div className="mx-auto w-full max-w-[1100px]">
              {error && (
                <Alert tone="danger" className="mb-3">
                  {error.message}
                </Alert>
              )}
              {!error && lastEdit && (
                <p className="mb-2 text-[12px] text-muted-foreground">
                  Perubahan terakhir · <span className="text-foreground-soft">{lastEdit.summary}</span>
                </p>
              )}
              <div className="flex items-center gap-3">
                <Badge tone="primary" className="hidden sm:inline-flex">
                  {target?.label}
                </Badge>
                <Input
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                  placeholder={
                    target?.target === "definition"
                      ? "Minta perubahan pada project definition (mis. tambah Google login)…"
                      : "Ask AI to update this specification…"
                  }
                  disabled={sending || busy}
                  className="flex-1"
                />
                <Button onClick={submit} disabled={sending || busy || !instruction.trim()}>
                  {sending ? <Spinner /> : <Send />}
                  <span className="hidden sm:inline">Update</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
