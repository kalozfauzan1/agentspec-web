import Link from "next/link";
import { FileStack } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-[10px] bg-primary text-white shadow-card",
        className,
      )}
    >
      <FileStack className="size-4" />
    </span>
  );
}

export function AppHeader({
  right,
  subtitle,
}: {
  right?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-foreground">AgentSpec</span>
            <span className="text-[11px] text-muted-foreground">
              {subtitle ?? "Spesifikasi siap pakai untuk coding agent"}
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
