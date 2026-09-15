"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  History,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionSourceBadge } from "@/components/review/tech-decisions";
import { SubHeading } from "@/components/spec/section-header";
import {
  ARTIFACT_KEYS,
  ARTIFACT_META,
  IMPLEMENTATION_STRATEGY_LABEL,
  type ArtifactKey,
} from "@/lib/schemas";
import { useProjectStore } from "@/lib/store/project-store";
import { formatRelative } from "@/lib/utils";

const ARTIFACT_ROUTES: Record<ArtifactKey, string> = {
  prd: "/prd",
  features: "/features",
  flows: "/flows",
  uiDesign: "/design",
  assetPlan: "/assets",
  architecture: "/architecture",
  dataModel: "/data-model",
  api: "/api",
  tasks: "/tasks",
  agentInstructions: "/agents",
};

export default function OverviewPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active, busy } = useProjectStore();

  if (!active) return null;
  const definition = active.definition;

  if (!definition) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">Project definition belum lengkap</p>
          <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Selesaikan klarifikasi dan review dulu supaya semua dokumen bisa diturunkan dari definisi
            yang sama.
          </p>
          <Button asChild className="mt-1">
            <Link href={`/project/${projectId}/review`}>
              Lanjut ke Review
              <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const readyCount = ARTIFACT_KEYS.filter(
    (key) => active.artifactStatus[key]?.status === "ready",
  ).length;
  const issues = active.validation?.issues ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Project Overview
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {definition.name}
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-[1.75] text-foreground-soft">
          {definition.summary}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={readyCount === ARTIFACT_KEYS.length ? "success" : "primary"}>
            {readyCount}/{ARTIFACT_KEYS.length} dokumen siap
          </Badge>
          <Badge tone="neutral">
            {IMPLEMENTATION_STRATEGY_LABEL[definition.implementation.strategy]}
          </Badge>
          <Badge tone="neutral">{definition.features.length} fitur</Badge>
          <Badge tone="neutral">{active.artifacts.tasks.length} task</Badge>
        </div>
      </header>

      {issues.length > 0 && (
        <Card className="border-warning-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              Consistency check · {issues.length} temuan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="rounded-card border border-border bg-surface-muted px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      issue.severity === "high"
                        ? "danger"
                        : issue.severity === "medium"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {issue.severity}
                  </Badge>
                  <span className="text-[13px] font-medium text-foreground">{issue.summary}</span>
                  {issue.artifacts.length > 0 && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {issue.artifacts.join(", ")}
                    </span>
                  )}
                </div>
                {issue.detail && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {issue.detail}
                  </p>
                )}
                {issue.suggestion && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-foreground-soft">
                    <span className="font-medium">Saran:</span> {issue.suggestion}
                  </p>
                )}
              </div>
            ))}
            {active.validation && (
              <p className="text-[11px] text-muted-foreground">
                Diperiksa {formatRelative(active.validation.checkedAt)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Product</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div>
                <SubHeading>Platform</SubHeading>
                <p className="mt-1 text-[13px] text-foreground-soft">
                  {definition.platform.join(", ") || "—"}
                </p>
              </div>
              <div>
                <SubHeading>Users</SubHeading>
                <p className="mt-1 text-[13px] text-foreground-soft">
                  {definition.users.join(", ") || "—"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <SubHeading>Core Features</SubHeading>
                <ul className="mt-2 space-y-2">
                  {definition.features.map((feature) => (
                    <li key={feature.name} className="text-[13px] leading-relaxed text-foreground-soft">
                      <span className="font-medium text-foreground">{feature.name}</span>
                      {feature.description ? ` — ${feature.description}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sm:col-span-2">
                <SubHeading>Scope Constraints</SubHeading>
                <div className="mt-2 space-y-3">
                  {definition.nonGoals.length > 0 && (
                    <div>
                      <p className="text-[12px] font-medium text-muted-foreground">Non-Goals</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-foreground-soft">
                        {definition.nonGoals.join(" · ")}
                      </p>
                    </div>
                  )}
                  {definition.constraints.length > 0 && (
                    <div>
                      <p className="text-[12px] font-medium text-muted-foreground">Constraints</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-foreground-soft">
                        {definition.constraints.join(" · ")}
                      </p>
                    </div>
                  )}
                  {definition.nonGoals.length === 0 && definition.constraints.length === 0 && (
                    <p className="text-[13px] text-muted-foreground">
                      Belum ada non-goal atau constraint yang dinyatakan.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Technical Stack</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {definition.technicalPreferences.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Belum ada keputusan teknologi pada definisi.
                </p>
              ) : (
                <ul className="space-y-2">
                  {definition.technicalPreferences.map((preference, index) => (
                    <li
                      key={`${preference.component}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface-muted px-3 py-2"
                    >
                      <span className="text-[13px] font-medium text-foreground">
                        {preference.component}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] text-foreground-soft">
                          {preference.technology ?? "—"}
                        </span>
                        <DecisionSourceBadge source={preference.source} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {active.artifacts.architecture && (
                <Link
                  href={`/project/${projectId}/architecture`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
                >
                  Lihat architecture lengkap
                  <ArrowRight className="size-3.5" />
                </Link>
              )}
            </CardContent>
          </Card>

          {active.editHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <History className="size-4 text-faint-foreground" />
                  Riwayat perubahan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {active.editHistory.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <p className="text-[13px] text-foreground-soft">
                      <span className="font-medium text-foreground">
                        {entry.scope === "definition" ? "Project definition" : entry.scope}
                      </span>{" "}
                      — {entry.summary}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      “{entry.instruction}” · {formatRelative(entry.at)}
                      {entry.succeeded ? "" : " · gagal"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Specification package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {ARTIFACT_KEYS.map((key) => {
                const status = active.artifactStatus[key]?.status ?? "empty";
                return (
                  <Link
                    key={key}
                    href={`/project/${projectId}${ARTIFACT_ROUTES[key]}`}
                    className="flex items-center justify-between gap-2 rounded-control px-2 py-2 transition-colors hover:bg-surface-muted"
                  >
                    <span className="text-[13px] text-foreground-soft">
                      {ARTIFACT_META[key].label}
                    </span>
                    {status === "ready" ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : status === "failed" ? (
                      <AlertTriangle className="size-4 text-danger" />
                    ) : status === "stale" ? (
                      <AlertTriangle className="size-4 text-warning" />
                    ) : (
                      <CircleDashed className="size-4 text-faint-foreground" />
                    )}
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-surface-muted">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Info className="size-4 text-faint-foreground" />
                Cara pakai
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
              <p>
                Setiap dokumen berasal dari project definition yang sama, jadi tidak ada kontradiksi
                antar dokumen.
              </p>
              <p>
                Gunakan kolom di bawah untuk meminta perubahan. AgentSpec akan memperbarui definisi dan
                meregenerasi dokumen yang terdampak.
              </p>
              {busy && <p className="text-primary">Sedang memproses perubahan…</p>}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
