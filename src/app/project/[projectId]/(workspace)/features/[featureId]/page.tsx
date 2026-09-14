"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubHeading } from "@/components/spec/section-header";
import { useProjectStore } from "@/lib/store/project-store";

export default function FeatureDetailPage() {
  const params = useParams<{ projectId: string; featureId: string }>();
  const { projectId, featureId } = params;
  const { active } = useProjectStore();

  const feature = active?.artifacts.features.find((candidate) => candidate.id === featureId);

  if (!feature) {
    return (
      <EmptyState
        title="Feature tidak ditemukan"
        description="Feature ini mungkin sudah berganti nama setelah regenerate. Kembali ke daftar feature untuk melihat versi terbaru."
        action={{ label: "Kembali ke daftar feature", href: `/project/${projectId}/features` }}
      />
    );
  }

  const relatedFlows = (active?.artifacts.flows ?? []).filter((flow) => flow.featureId === feature.id);
  const relatedTasks = (active?.artifacts.tasks ?? []).filter((task) => task.featureId === feature.id);
  const relatedEndpoints = (active?.artifacts.api?.endpoints ?? []).filter(
    (endpoint) => endpoint.featureId === feature.id,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <Link
          href={`/project/${projectId}/features`}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3.5" />
          Semua feature
        </Link>

        <header className="mt-3 border-b border-border pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{feature.prefix}</Badge>
            <span className="font-mono text-[11px] text-muted-foreground">{feature.id}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {feature.name}
          </h1>
          <p className="mt-2 max-w-3xl text-[14px] leading-[1.75] text-foreground-soft">
            {feature.purpose}
          </p>
        </header>

        <div className="mt-6 space-y-7">
          <section>
            <SubHeading>Actors</SubHeading>
            <div className="mt-2 flex flex-wrap gap-2">
              {feature.actors.length > 0 ? (
                feature.actors.map((actor) => (
                  <Badge key={actor} tone="outline">
                    {actor}
                  </Badge>
                ))
              ) : (
                <span className="text-[13px] text-muted-foreground">Belum didefinisikan</span>
              )}
            </div>
          </section>

          <section>
            <SubHeading>Main Flow</SubHeading>
            <ol className="mt-2 space-y-2">
              {feature.mainFlow.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-3 text-[14px] leading-[1.7] text-foreground-soft">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-muted text-[11px] font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <SubHeading>Requirements</SubHeading>
            <ul className="mt-2 space-y-2">
              {feature.requirements.map((requirement) => (
                <li
                  key={requirement.id}
                  className="flex flex-wrap items-baseline gap-2 rounded-card border border-border bg-surface px-3 py-2"
                >
                  <span className="rounded-[6px] border border-primary-border bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary">
                    {requirement.id}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground-soft">
                    {requirement.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {feature.businessRules.length > 0 && (
            <section>
              <SubHeading>Business Rules</SubHeading>
              <ul className="mt-2 space-y-2">
                {feature.businessRules.map((rule) => (
                  <li key={rule} className="text-[14px] leading-[1.7] text-foreground-soft">
                    • {rule}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {feature.edgeCases.length > 0 && (
            <section>
              <SubHeading>Edge Cases</SubHeading>
              <ul className="mt-2 space-y-2">
                {feature.edgeCases.map((edgeCase) => (
                  <li key={edgeCase} className="text-[14px] leading-[1.7] text-foreground-soft">
                    • {edgeCase}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {feature.acceptanceCriteria.length > 0 && (
            <section>
              <SubHeading>Acceptance Criteria</SubHeading>
              <ul className="mt-2 space-y-2">
                {feature.acceptanceCriteria.map((criterion) => (
                  <li key={criterion} className="flex gap-2.5 text-[14px] leading-[1.7] text-foreground-soft">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-success" />
                    {criterion}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Related context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-[13px]">
            <div>
              <SubHeading>User flows</SubHeading>
              {relatedFlows.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {relatedFlows.map((flow) => (
                    <li key={flow.id}>
                      <Link
                        href={`/project/${projectId}/flows`}
                        className="text-foreground-soft transition-colors hover:text-primary"
                      >
                        {flow.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-muted-foreground">Belum ada flow untuk feature ini.</p>
              )}
            </div>

            <div>
              <SubHeading>Implementation tasks</SubHeading>
              {relatedTasks.length > 0 ? (
                <ul className="mt-1.5 space-y-1.5">
                  {relatedTasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2">
                      <ListChecks className="mt-0.5 size-3.5 shrink-0 text-faint-foreground" />
                      <span className="text-foreground-soft">
                        <span className="font-mono text-[11px] text-muted-foreground">{task.id}</span>{" "}
                        {task.title}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-muted-foreground">Belum ada task untuk feature ini.</p>
              )}
            </div>

            {relatedEndpoints.length > 0 && (
              <div>
                <SubHeading>API endpoints</SubHeading>
                <ul className="mt-1.5 space-y-1 font-mono text-[11px] text-foreground-soft">
                  {relatedEndpoints.map((endpoint) => (
                    <li key={endpoint.id}>
                      {endpoint.method} {endpoint.path}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <SubHeading>Requirement ids</SubHeading>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {feature.requirements.map((requirement) => requirement.id).join(" · ")}
              </p>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
