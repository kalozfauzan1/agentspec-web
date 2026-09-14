"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArtifactContextPanel, ArtifactEmptyState } from "@/components/spec/artifact-states";
import { useProjectStore } from "@/lib/store/project-store";

export default function FeaturesPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();
  const features = active?.artifacts.features ?? [];

  if (features.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Feature Specifications
          </h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="features" />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-4">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Product</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            Feature Specifications
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {features.length} fitur dengan requirement ber-ID. ID inilah yang dirujuk oleh task
            implementasi.
          </p>
        </header>

        {features.map((feature) => (
          <Card key={feature.id} className="transition-colors hover:border-border-strong">
            <CardContent className="py-4">
              <Link href={`/project/${projectId}/features/${feature.id}`} className="block">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-[6px] border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {feature.prefix}
                      </span>
                      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                        {feature.name}
                      </h2>
                    </div>
                    <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                      {feature.purpose}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{feature.requirements.length} requirement</Badge>
                      {feature.actors.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                          <Users className="size-3.5" />
                          {feature.actors.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-faint-foreground" />
                </div>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <ArtifactContextPanel artifact="features" />
      </aside>
    </div>
  );
}
