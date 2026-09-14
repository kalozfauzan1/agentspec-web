"use client";

import { useParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { ArtifactContextPanel, ArtifactEmptyState } from "@/components/spec/artifact-states";
import { useProjectStore } from "@/lib/store/project-store";

export default function DataModelPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();
  const dataModel = active?.artifacts.dataModel ?? null;

  if (!dataModel) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Data Model</h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="dataModel" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Technical
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Data Model</h1>
          {dataModel.overview && (
            <p className="mt-2 max-w-3xl text-[14px] leading-[1.75] text-foreground-soft">
              {dataModel.overview}
            </p>
          )}
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Entities &amp; relationships</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dataModel.entities.map((entity) => (
                <div
                  key={entity.name}
                  className="rounded-card border border-border bg-surface-muted px-4 py-3"
                >
                  <p className="font-mono text-[13px] font-medium text-foreground">{entity.name}</p>
                  <ul className="mt-2 space-y-1">
                    {dataModel.relationships
                      .filter((relationship) => relationship.from === entity.name)
                      .map((relationship, index) => (
                        <li
                          key={`${relationship.to}-${index}`}
                          className="text-[12px] leading-relaxed text-muted-foreground"
                        >
                          ├── {relationship.type}{" "}
                          <span className="font-mono text-foreground-soft">{relationship.to}</span>
                          {relationship.description ? ` — ${relationship.description}` : ""}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {dataModel.entities.map((entity) => (
          <Card key={entity.name}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-mono text-[14px]">{entity.name}</CardTitle>
                <span className="text-[12px] text-muted-foreground">
                  {entity.fields.length} field
                </span>
              </div>
              {entity.purpose && (
                <p className="text-[13px] leading-relaxed text-muted-foreground">{entity.purpose}</p>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Field</TableHeaderCell>
                    <TableHeaderCell>Type</TableHeaderCell>
                    <TableHeaderCell>Purpose</TableHeaderCell>
                    <TableHeaderCell>Constraints</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entity.fields.map((field) => (
                    <TableRow key={field.name}>
                      <TableCell className="font-mono text-[12px] text-foreground">
                        {field.name}
                      </TableCell>
                      <TableCell className="font-mono text-[12px]">{field.type}</TableCell>
                      <TableCell className="text-muted-foreground">{field.purpose || "—"}</TableCell>
                      <TableCell>
                        {field.constraints.length > 0 ? (
                          <span className="flex flex-wrap gap-1.5">
                            {field.constraints.map((constraint) => (
                              <span
                                key={constraint}
                                className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                              >
                                {constraint.toLowerCase().includes("key") && (
                                  <KeyRound className="size-3" />
                                )}
                                {constraint}
                              </span>
                            ))}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {entity.notes && (
                <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{entity.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}

        {dataModel.relationships.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Relationships</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {dataModel.relationships.map((relationship, index) => (
                  <li key={`${relationship.from}-${relationship.to}-${index}`} className="text-[13px]">
                    <span className="font-mono text-foreground">{relationship.from}</span>
                    <span className="mx-2 text-muted-foreground">{relationship.type}</span>
                    <span className="font-mono text-foreground">{relationship.to}</span>
                    {relationship.description && (
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {relationship.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ArtifactContextPanel
          artifact="dataModel"
          extra={
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Entity</span>
              <span className="text-foreground-soft">{dataModel.entities.length}</span>
            </div>
          }
        />
      </aside>
    </div>
  );
}
