"use client";

import { useParams } from "next/navigation";
import { ArtifactContextPanel, ArtifactEmptyState } from "@/components/spec/artifact-states";
import { DocumentOutline, DocumentView } from "@/components/spec/document-view";
import { useProjectStore } from "@/lib/store/project-store";

export default function PrdPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();
  const prd = active?.artifacts.prd ?? null;

  if (!prd) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Product Requirements Document
          </h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="prd" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Product Requirements Document
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{prd.title}</h1>
        </header>
        <DocumentView document={prd} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ArtifactContextPanel artifact="prd" />
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Isi dokumen
          </p>
          <DocumentOutline document={prd} />
        </div>
      </aside>
    </div>
  );
}
