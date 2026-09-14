"use client";

import { useState } from "react";
import { FileStack, RefreshCw, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ARTIFACT_META, type ArtifactKey } from "@/lib/schemas";
import { useProjectStore } from "@/lib/store/project-store";
import { formatRelative } from "@/lib/utils";

export function ArtifactEmptyState({
  projectId,
  artifact,
  note,
}: {
  projectId: string;
  artifact: ArtifactKey;
  note?: string;
}) {
  const [working, setWorking] = useState(false);
  const { active, regenerateArtifacts, busy } = useProjectStore();
  const status = active?.artifactStatus[artifact];

  const generate = async () => {
    setWorking(true);
    try {
      await regenerateArtifacts(projectId, [artifact]);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="flex size-11 items-center justify-center rounded-card bg-primary-soft text-primary">
          <FileStack className="size-5" />
        </span>
        <p className="text-sm font-semibold text-foreground">
          {ARTIFACT_META[artifact].label} belum dibuat
        </p>
        <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
          {note ?? ARTIFACT_META[artifact].description}
        </p>
        {status?.status === "failed" && status.error && (
          <Alert tone="danger" className="mt-1 max-w-lg text-left">
            {status.error}
          </Alert>
        )}
        <Button className="mt-2" onClick={generate} disabled={working || busy}>
          {working ? <Spinner /> : <Sparkles />}
          Generate {ARTIFACT_META[artifact].label}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ArtifactContextPanel({
  artifact,
  extra,
}: {
  artifact: ArtifactKey;
  extra?: React.ReactNode;
}) {
  const { active, regenerateArtifacts, busy } = useProjectStore();
  const projectId = active?.id ?? "";
  const status = active?.artifactStatus[artifact];
  const meta = ARTIFACT_META[artifact];
  const [working, setWorking] = useState(false);

  const regenerate = async () => {
    if (!projectId) return;
    setWorking(true);
    try {
      await regenerateArtifacts(projectId, [artifact]);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Document context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-[13px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Status</span>
          <StatusLabel status={status?.status} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">File export</span>
          <span className="font-mono text-[11px] text-foreground-soft">{meta.fileName}</span>
        </div>
        {status?.updatedAt && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Diperbarui</span>
            <span className="text-foreground-soft">{formatRelative(status.updatedAt)}</span>
          </div>
        )}
        {status?.warnings && status.warnings.length > 0 && (
          <div className="rounded-control border border-warning-border bg-warning-soft px-3 py-2">
            <p className="text-[12px] font-medium text-warning">Catatan generation</p>
            <ul className="mt-1 space-y-0.5">
              {status.warnings.slice(0, 4).map((warning) => (
                <li key={warning} className="text-[12px] leading-relaxed text-foreground-soft">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
        {extra}
        <Button variant="outline" size="sm" onClick={regenerate} disabled={working || busy}>
          {working ? <Spinner /> : <Sparkles />}
          Regenerate dokumen ini
        </Button>
        <div className="flex items-start gap-2 rounded-control bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          <RefreshCw className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Ubah dokumen ini lewat kolom di bawah. AgentSpec akan menjaga konsistensinya dengan
            project definition.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusLabel({ status }: { status?: "empty" | "running" | "ready" | "failed" | "stale" }) {
  if (status === "ready") return <Badge tone="success">Siap</Badge>;
  if (status === "running") return <Badge tone="primary">Proses</Badge>;
  if (status === "failed") return <Badge tone="danger">Gagal</Badge>;
  if (status === "stale") return <Badge tone="warning">Perlu regenerate</Badge>;
  return <Badge tone="neutral">Belum dibuat</Badge>;
}
