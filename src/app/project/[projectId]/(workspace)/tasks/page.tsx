"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CornerDownRight, FileText, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArtifactContextPanel, ArtifactEmptyState } from "@/components/spec/artifact-states";
import { SubHeading } from "@/components/spec/section-header";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/store/project-store";
import { IMPLEMENTATION_STRATEGY_LABEL, type ImplementationTask, type TaskType } from "@/lib/schemas";

const TYPE_LABEL: Record<TaskType, string> = {
  foundation: "Foundation",
  frontend: "Frontend",
  backend: "Backend",
  database: "Database",
  integration: "Integration",
  testing: "Testing",
  documentation: "Documentation",
};

export default function TasksPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { active } = useProjectStore();

  const tasks = active?.artifacts.tasks ?? [];
  const features = active?.artifacts.features ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(tasks[0]?.id ?? null);

  useEffect(() => {
    if (tasks.length > 0 && !tasks.some((task) => task.id === selectedId)) {
      setSelectedId(tasks[0].id);
    }
  }, [tasks, selectedId]);

  const phases = useMemo(() => {
    const order: string[] = [];
    for (const task of tasks) if (!order.includes(task.phase)) order.push(task.phase);
    return order;
  }, [tasks]);

  const selected = tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;
  const strategy = active?.definition?.implementation.strategy ?? "frontend-first";

  if (tasks.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Implementation Tasks
          </h1>
        </header>
        <ArtifactEmptyState projectId={projectId} artifact="tasks" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Implementation
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            Implementation Tasks
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {tasks.length} task dalam {phases.length} phase ·{" "}
            {IMPLEMENTATION_STRATEGY_LABEL[strategy]}
          </p>
        </div>
        <Badge tone="outline">Urutan mengikuti dependency</Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-5">
          {phases.map((phase, phaseIndex) => {
            const phaseTasks = tasks.filter((task) => task.phase === phase);
            return (
              <div key={phase}>
                <div className="flex items-center gap-2 pb-2">
                  <span className="flex size-5 items-center justify-center rounded-full border border-border-strong bg-surface-muted text-[11px] font-medium text-muted-foreground">
                    {phaseIndex + 1}
                  </span>
                  <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{phase}</h2>
                  <span className="text-[11px] text-muted-foreground">
                    {phaseTasks.length} task
                  </span>
                </div>
                <div className="space-y-1.5">
                  {phaseTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedId(task.id)}
                      className={cn(
                        "w-full rounded-card border px-3 py-2.5 text-left transition-colors",
                        selected?.id === task.id
                          ? "border-primary-border bg-primary-soft"
                          : "border-border bg-surface hover:bg-surface-muted",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{task.id}</span>
                        <Badge tone="neutral">{TYPE_LABEL[task.type]}</Badge>
                        {task.optional && <Badge tone="warning">optional</Badge>}
                      </div>
                      <p className="mt-1 text-[13px] font-medium leading-snug text-foreground">
                        {task.title}
                      </p>
                      {task.dependencies.length > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CornerDownRight className="size-3" />
                          setelah {task.dependencies.join(", ")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="lg:sticky lg:top-20 lg:self-start">
            <TaskDetail
              task={selected}
              featureName={features.find((feature) => feature.id === selected.featureId)?.name}
            />
            <div className="mt-4">
              <ArtifactContextPanel artifact="tasks" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDetail({ task, featureName }: { task: ImplementationTask; featureName?: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12px] font-medium text-primary">{task.id}</span>
          <Badge tone="primary">{TYPE_LABEL[task.type]}</Badge>
          <Badge tone="neutral">{task.phase}</Badge>
          {task.optional && <Badge tone="warning">Optional</Badge>}
        </div>
        <CardTitle className="mt-2 text-[17px] leading-snug">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <SubHeading>Feature</SubHeading>
            <p className="mt-1 text-[13px] text-foreground-soft">{featureName ?? "—"}</p>
          </div>
          <div>
            <SubHeading>Dependencies</SubHeading>
            <p className="mt-1 font-mono text-[12px] text-foreground-soft">
              {task.dependencies.join(", ") || "—"}
            </p>
          </div>
        </div>

        {task.contextDocs.length > 0 && (
          <div>
            <SubHeading>Context documents</SubHeading>
            <ul className="mt-1.5 space-y-1">
              {task.contextDocs.map((doc) => (
                <li key={doc} className="flex items-center gap-2 font-mono text-[11px] text-foreground-soft">
                  <FileText className="size-3.5 text-faint-foreground" />
                  {doc}
                </li>
              ))}
            </ul>
          </div>
        )}

        {task.references.length > 0 && (
          <div>
            <SubHeading>Requirement references</SubHeading>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {task.references.map((reference) => (
                <span
                  key={reference}
                  className="rounded-[6px] border border-primary-border bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary"
                >
                  {reference}
                </span>
              ))}
            </div>
          </div>
        )}

        {task.requirements.length > 0 && (
          <div>
            <SubHeading>Requirements</SubHeading>
            <ul className="mt-1.5 space-y-2">
              {task.requirements.map((requirement) => (
                <li key={requirement} className="text-[14px] leading-[1.7] text-foreground-soft">
                  • {requirement}
                </li>
              ))}
            </ul>
          </div>
        )}

        {task.uiStates.length > 0 && (
          <div>
            <SubHeading>UI states</SubHeading>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {task.uiStates.map((state) => (
                <Badge key={state} tone="outline">
                  <Layers className="size-3" />
                  {state}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {task.acceptanceCriteria.length > 0 && (
          <div>
            <SubHeading>Acceptance criteria</SubHeading>
            <ul className="mt-1.5 space-y-2">
              {task.acceptanceCriteria.map((criterion) => (
                <li key={criterion} className="text-[14px] leading-[1.7] text-foreground-soft">
                  • {criterion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
