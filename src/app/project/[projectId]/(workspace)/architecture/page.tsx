"use client";

import { useParams } from "next/navigation";
import { ArrowDown, Globe, Server, Database as DatabaseIcon, Cloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArtifactContextPanel, ArtifactEmptyState } from "@/components/spec/artifact-states";
import { DecisionSourceBadge } from "@/components/review/tech-decisions";
import { SubHeading } from "@/components/spec/section-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { useProjectStore } from "@/lib/store/project-store";
import { DECISION_SOURCE_LABEL } from "@/lib/schemas";

export default function ArchitecturePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();
  const architecture = active?.artifacts.architecture ?? null;

  if (!architecture) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Technical Architecture
          </h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="architecture" />
      </div>
    );
  }

  const layer = (component: string) =>
    architecture.decisions.find((decision) => decision.component.toLowerCase().includes(component));

  const client = layer("front");
  const server = layer("back");
  const database = layer("data");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Technical
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            Technical Architecture
          </h1>
          {architecture.overview && (
            <p className="mt-2 max-w-3xl text-[14px] leading-[1.75] text-foreground-soft">
              {architecture.overview}
            </p>
          )}
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>System overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-stretch gap-3">
              <ArchitectureNode
                icon={<Globe className="size-4" />}
                label="Client"
                value={client?.technology ?? "—"}
                source={client?.source}
                detail={active?.definition?.platform.join(" · ")}
              />
              <ArrowDown className="mx-auto size-4 text-faint-foreground" />
              <ArchitectureNode
                icon={<Server className="size-4" />}
                label="Backend / API"
                value={server?.technology ?? "—"}
                source={server?.source}
                detail={
                  active?.artifacts.api
                    ? `${active.artifacts.api.endpoints.length} endpoint terdokumentasi`
                    : undefined
                }
              />
              <ArrowDown className="mx-auto size-4 text-faint-foreground" />
              <ArchitectureNode
                icon={<DatabaseIcon className="size-4" />}
                label="Database"
                value={database?.technology ?? "—"}
                source={database?.source}
                detail={
                  active?.artifacts.dataModel
                    ? `${active.artifacts.dataModel.entities.length} entity`
                    : undefined
                }
              />
              {architecture.externalServices.length > 0 && (
                <>
                  <ArrowDown className="mx-auto size-4 text-faint-foreground" />
                  <div className="rounded-card border border-dashed border-border-strong bg-surface-muted px-4 py-3">
                    <p className="flex items-center gap-2 text-[12px] font-medium text-foreground-soft">
                      <Cloud className="size-4" />
                      Layanan eksternal
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {architecture.externalServices.map((service) => (
                        <li key={service.name} className="flex flex-wrap items-center gap-2 text-[13px]">
                          <span className="font-medium text-foreground">{service.name}</span>
                          {service.purpose && (
                            <span className="text-muted-foreground">— {service.purpose}</span>
                          )}
                          <Badge tone="neutral">{DECISION_SOURCE_LABEL[service.source]}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Technology decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Component</TableHeaderCell>
                  <TableHeaderCell>Technology</TableHeaderCell>
                  <TableHeaderCell>Source</TableHeaderCell>
                  <TableHeaderCell>Rationale</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {architecture.decisions.map((decision, index) => (
                  <TableRow key={`${decision.component}-${index}`}>
                    <TableCell className="font-medium text-foreground">{decision.component}</TableCell>
                    <TableCell>{decision.technology ?? "—"}</TableCell>
                    <TableCell>
                      <DecisionSourceBadge source={decision.source} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{decision.rationale || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>System boundaries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <SubHeading>Inside</SubHeading>
                <ul className="mt-1.5 space-y-1.5">
                  {architecture.systemBoundaries.inside.map((item) => (
                    <li key={item} className="text-[13px] leading-relaxed text-foreground-soft">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <SubHeading>Outside</SubHeading>
                <ul className="mt-1.5 space-y-1.5">
                  {architecture.systemBoundaries.outside.map((item) => (
                    <li key={item} className="text-[13px] leading-relaxed text-muted-foreground">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>High-level data flow</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {architecture.dataFlow.map((step, index) => (
                  <li key={`${step}-${index}`} className="flex gap-3 text-[13px] leading-relaxed text-foreground-soft">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-muted text-[11px] font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {architecture.rules.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Architecture rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {architecture.rules.map((rule) => (
                  <li key={rule} className="text-[13px] leading-relaxed text-foreground-soft">
                    • {rule}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ArtifactContextPanel artifact="architecture" />
      </aside>
    </div>
  );
}

function ArchitectureNode({
  icon,
  label,
  value,
  source,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  source?: "user-selected" | "recommended" | "undecided";
  detail?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-control bg-primary-soft text-primary">
          {icon}
        </span>
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
          <p className="text-[14px] font-medium text-foreground">{value}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {detail && <span className="text-[12px] text-muted-foreground">{detail}</span>}
        {source && <DecisionSourceBadge source={source} />}
      </div>
    </div>
  );
}
