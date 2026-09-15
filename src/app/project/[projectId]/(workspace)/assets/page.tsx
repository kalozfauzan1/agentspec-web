"use client";

import { useParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

export default function AssetPlanPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();
  const plan = active?.artifacts.assetPlan ?? null;
  const design = active?.artifacts.uiDesign ?? null;

  if (!plan) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Asset Plan</h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="assetPlan" />
      </div>
    );
  }

  const screensById = new Map((design?.screens ?? []).map((screen) => [screen.id, screen.name]));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Product</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Asset Plan</h1>
          {plan.strategy && (
            <p className="mt-2 max-w-3xl text-[14px] leading-[1.75] text-foreground-soft">
              {plan.strategy}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="primary">{plan.iconSystems.length} icon system</Badge>
            <Badge tone="neutral">{plan.assets.length} aset</Badge>
            <Badge tone="neutral">{plan.sources.length} sumber</Badge>
            {plan.sourcePolicy.freeOnly && plan.sourcePolicy.legalOnly && (
              <Badge tone="outline">Gratis &amp; legal</Badge>
            )}
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Source policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.sourcePolicy.rationale && (
              <p className="text-[13px] leading-relaxed text-foreground-soft">
                {plan.sourcePolicy.rationale}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge tone={plan.sourcePolicy.freeOnly ? "success" : "warning"}>
                {plan.sourcePolicy.freeOnly ? "Free only" : "Paid allowed"}
              </Badge>
              <Badge tone={plan.sourcePolicy.legalOnly ? "success" : "danger"}>
                {plan.sourcePolicy.legalOnly ? "Legal only" : "License unchecked"}
              </Badge>
              <Badge tone={plan.sourcePolicy.localOnly ? "success" : "warning"}>
                {plan.sourcePolicy.localOnly ? "Stored locally" : "External allowed"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {plan.iconSystems.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Icon systems</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.iconSystems.map((system) => (
                <div key={system.platform} className="rounded-card border border-border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-foreground">
                      {system.platform} · {system.family}
                    </p>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {system.size} · stroke {system.stroke}
                    </span>
                  </div>
                  {system.mappings.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {system.mappings.map((mapping) => (
                        <span
                          key={`${system.platform}-${mapping.action}`}
                          className="rounded-pill border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {mapping.action} → {mapping.icon}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                    {system.accessibility}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {plan.sources.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Sumber aset</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Source</TableHeaderCell>
                    <TableHeaderCell>URL</TableHeaderCell>
                    <TableHeaderCell>License</TableHeaderCell>
                    <TableHeaderCell>Attribution</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plan.sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell className="text-foreground">{source.name || source.id}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {source.officialUrl}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{source.license}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {source.attributionRequired ? "Required" : "Not required"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {plan.assets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.assets.map((asset) => (
                <div key={asset.id} className="rounded-card border border-border px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-semibold tracking-tight text-foreground">
                        {asset.purpose}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {asset.id} · {asset.type}
                      </p>
                    </div>
                    <Badge tone="outline">{asset.license}</Badge>
                  </div>

                  <p className="mt-2 font-mono text-[12px] text-foreground-soft">
                    {asset.destinationPath}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                    {asset.placement}
                  </p>
                  {asset.screenIds.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Screens:{" "}
                      {asset.screenIds
                        .map((id) => screensById.get(id) ?? id)
                        .join(", ")}
                    </p>
                  )}
                  {asset.fallback && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground-soft">Fallback: </span>
                      {asset.fallback}
                    </p>
                  )}
                  {asset.attribution && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{asset.attribution}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ArtifactContextPanel
          artifact="assetPlan"
          extra={
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Icon systems</span>
                <span className="text-foreground-soft">{plan.iconSystems.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Assets</span>
                <span className="text-foreground-soft">{plan.assets.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Sources</span>
                <span className="text-foreground-soft">{plan.sources.length}</span>
              </div>
            </>
          }
        />
        <Alert tone="info">
          File ini di-export sebagai <code className="font-mono text-[12px]">docs/asset-plan.md</code>{" "}
          dan dirujuk oleh task frontend serta AGENTS.md.
        </Alert>
      </aside>
    </div>
  );
}
