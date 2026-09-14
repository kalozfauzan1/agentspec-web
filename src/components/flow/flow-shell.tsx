import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  { key: "idea", label: "Idea" },
  { key: "clarify", label: "Clarification" },
  { key: "review", label: "Project Review" },
  { key: "generate", label: "Generate" },
] as const;

export function FlowProgress({ current }: { current: (typeof STEPS)[number]["key"] }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[11px] font-medium",
                  done && "border-primary bg-primary text-white",
                  active && "border-primary bg-primary-soft text-primary",
                  !done && !active && "border-border-strong bg-surface text-faint-foreground",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-[13px]",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </span>
            {index < STEPS.length - 1 && <span className="hidden h-px w-6 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

export function FlowHeader({
  projectName,
  idea,
  current,
  right,
}: {
  projectName: string;
  idea: string;
  current: (typeof STEPS)[number]["key"];
  right?: React.ReactNode;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/"
              className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              ← Semua project
            </Link>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
              {projectName}
            </h1>
            <p className="mt-1 line-clamp-1 max-w-2xl text-[13px] text-muted-foreground">{idea}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone="neutral">Draft</Badge>
            {right}
          </div>
        </div>
        <div className="mt-4">
          <FlowProgress current={current} />
        </div>
      </div>
    </header>
  );
}
