"use client";

import { useParams } from "next/navigation";
import { ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArtifactContextPanel, ArtifactEmptyState } from "@/components/spec/artifact-states";
import { useProjectStore } from "@/lib/store/project-store";

export default function FlowsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();
  const flows = active?.artifacts.flows ?? [];

  if (flows.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">User Flows</h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="flows" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Product</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">User Flows</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {flows.length} alur utama. Langkah-langkahnya konsisten dengan feature specification.
          </p>
        </header>

        {flows.map((flow) => (
          <Card key={flow.id}>
            <CardContent className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                    {flow.name}
                  </h2>
                  {flow.primaryActor && (
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Actor: {flow.primaryActor}
                      {flow.featureId ? ` · feature: ${flow.featureId}` : ""}
                    </p>
                  )}
                </div>
                {flow.featureId && <Badge tone="outline">{flow.featureId}</Badge>}
              </div>

              {flow.trigger && (
                <p className="mt-3 rounded-control bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                  Trigger: {flow.trigger}
                </p>
              )}

              <ol className="mt-4 space-y-2">
                {flow.steps.map((step, index) => (
                  <li key={`${step}-${index}`}>
                    <div className="flex gap-3 text-[14px] leading-[1.7] text-foreground-soft">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-muted text-[11px] font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      {step}
                    </div>
                    {index < flow.steps.length - 1 && (
                      <ArrowDown className="my-1 ml-2 size-3.5 text-faint-foreground" />
                    )}
                  </li>
                ))}
              </ol>

              {flow.outcome && (
                <p className="mt-4 rounded-card border border-success-border bg-success-soft px-3 py-2 text-[13px] leading-relaxed text-foreground-soft">
                  Outcome: {flow.outcome}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ArtifactContextPanel artifact="flows" />
      </aside>
    </div>
  );
}
