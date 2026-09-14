"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Check, Copy, Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentOutline, DocumentView } from "@/components/spec/document-view";
import { ArtifactContextPanel, ArtifactEmptyState } from "@/components/spec/artifact-states";
import { STARTER_PROMPT } from "@/lib/export/package";
import { renderDocument } from "@/lib/export/markdown";
import { useProjectStore } from "@/lib/store/project-store";

export default function AgentInstructionsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();
  const document = active?.artifacts.agentInstructions ?? null;

  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadAgents = () => {
    if (!document) return;
    const blob = new Blob([renderDocument(document)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = "AGENTS.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!document) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Agent Instructions</h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="agentInstructions" />
      </div>
    );
  }

  const strategy = active?.definition?.implementation.strategy ?? "frontend-first";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Implementation
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">AGENTS.md</h1>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Aturan global yang harus diikuti coding agent. Strategy aktif:{" "}
              {strategy === "module-first" ? "Module First" : "Frontend First"}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadAgents}>
            <Download />
            Download AGENTS.md
          </Button>
        </header>

        <DocumentView document={document} />

        <Card className="mt-8">
          <CardHeader className="pb-3">
            <CardTitle>Starter prompt untuk coding agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="scrollbar-slim max-h-64 overflow-auto rounded-card border border-border bg-surface-muted p-4 font-mono text-[12px] leading-relaxed text-foreground-soft">
              {STARTER_PROMPT}
            </pre>
            <Button variant="outline" size="sm" onClick={() => copy(STARTER_PROMPT, "prompt")}>
              {copied === "prompt" ? <Check /> : <Copy />}
              {copied === "prompt" ? "Tersalin" : "Copy starter prompt"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ArtifactContextPanel artifact="agentInstructions" />
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Isi dokumen
          </p>
          <DocumentOutline document={document} />
        </div>
        <Alert tone="info">
          File ini di-export sebagai <code className="font-mono text-[12px]">AGENTS.md</code> di root
          package.
        </Alert>
      </aside>
    </div>
  );
}
