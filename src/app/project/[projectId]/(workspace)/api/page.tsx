"use client";

import { useParams } from "next/navigation";
import { Lock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArtifactContextPanel, ArtifactEmptyState } from "@/components/spec/artifact-states";
import { SubHeading } from "@/components/spec/section-header";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/store/project-store";
import type { Endpoint } from "@/lib/schemas";

const METHOD_TONES: Record<Endpoint["method"], string> = {
  GET: "border-primary-border bg-primary-soft text-primary",
  POST: "border-success-border bg-success-soft text-success",
  PUT: "border-warning-border bg-warning-soft text-warning",
  PATCH: "border-warning-border bg-warning-soft text-warning",
  DELETE: "border-danger-border bg-danger-soft text-danger",
};

const AUTH_LABEL: Record<Endpoint["authentication"], string> = {
  required: "Auth required",
  optional: "Auth optional",
  none: "Public",
};

export default function ApiPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();
  const api = active?.artifacts.api ?? null;

  if (!api) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">API Specification</h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="api" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Technical
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            API Specification
          </h1>
          {api.overview && (
            <p className="mt-2 max-w-3xl text-[14px] leading-[1.75] text-foreground-soft">
              {api.overview}
            </p>
          )}
          {api.authentication && (
            <p className="mt-3 flex items-start gap-2 rounded-card border border-border bg-surface-muted px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              {api.authentication}
            </p>
          )}
        </header>

        {api.endpoints.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-[13px] text-muted-foreground">
              Arsitektur project ini tidak memerlukan API.
            </CardContent>
          </Card>
        )}

        {api.endpoints.map((endpoint) => (
          <Card key={endpoint.id}>
            <CardContent className="py-5">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "rounded-[8px] border px-2 py-1 font-mono text-[11px] font-semibold",
                    METHOD_TONES[endpoint.method],
                  )}
                >
                  {endpoint.method}
                </span>
                <code className="font-mono text-[13px] text-foreground">{endpoint.path}</code>
                <Badge tone={endpoint.authentication === "none" ? "neutral" : "outline"}>
                  {AUTH_LABEL[endpoint.authentication]}
                </Badge>
              </div>

              <p className="mt-3 text-[14px] leading-relaxed text-foreground-soft">
                {endpoint.purpose}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                {endpoint.actor && (
                  <span className="inline-flex items-center gap-1.5">
                    <User className="size-3.5" />
                    {endpoint.actor}
                  </span>
                )}
                {endpoint.featureId && (
                  <span className="font-mono text-[11px]">feature: {endpoint.featureId}</span>
                )}
              </div>

              {(endpoint.request || endpoint.response) && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {endpoint.request && (
                    <div>
                      <SubHeading>Request</SubHeading>
                      <pre className="mt-1.5 overflow-x-auto rounded-card border border-border bg-surface-muted p-3 font-mono text-[11px] leading-relaxed text-foreground-soft">
                        {endpoint.request}
                      </pre>
                    </div>
                  )}
                  {endpoint.response && (
                    <div>
                      <SubHeading>Response</SubHeading>
                      <pre className="mt-1.5 overflow-x-auto rounded-card border border-border bg-surface-muted p-3 font-mono text-[11px] leading-relaxed text-foreground-soft">
                        {endpoint.response}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {endpoint.errors.length > 0 && (
                <div className="mt-4">
                  <SubHeading>Errors</SubHeading>
                  <ul className="mt-1.5 space-y-1">
                    {endpoint.errors.map((error) => (
                      <li key={`${error.status}-${error.meaning}`} className="text-[13px] text-foreground-soft">
                        <code className="mr-2 rounded-[6px] border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {error.status}
                        </code>
                        {error.meaning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ArtifactContextPanel
          artifact="api"
          extra={
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Endpoint</span>
              <span className="text-foreground-soft">{api.endpoints.length}</span>
            </div>
          }
        />
      </aside>
    </div>
  );
}
