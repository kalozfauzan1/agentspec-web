import { CircleAlert, Layers, Monitor, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubHeading } from "@/components/spec/section-header";
import type { IdeaAnalysis } from "@/lib/schemas";
import { cn } from "@/lib/utils";

function Row({ icon, label, values }: { icon: React.ReactNode; label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-faint-foreground">{icon}</span>
      <div className="min-w-0">
        <SubHeading>{label}</SubHeading>
        <p className="mt-1 text-[13px] leading-relaxed text-foreground-soft">{values.join(" · ")}</p>
      </div>
    </div>
  );
}

export function DetectedContext({
  analysis,
  className,
}: {
  analysis: IdeaAnalysis | null;
  className?: string;
}) {
  if (!analysis) {
    return (
      <Card className={cn("bg-surface-muted", className)}>
        <CardHeader>
          <CardTitle>Detected Project</CardTitle>
        </CardHeader>
        <CardContent className="text-[13px] text-muted-foreground">
          Analisis ide belum tersedia.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <CardTitle>Detected Project</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <SubHeading>Nama usulan</SubHeading>
          <p className="mt-1 text-sm font-medium text-foreground">{analysis.suggestedName}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{analysis.summary}</p>
        </div>

        <Row icon={<Monitor className="size-4" />} label="Platform" values={analysis.platform} />
        <Row icon={<Users className="size-4" />} label="Target users" values={analysis.targetUsers} />
        <Row
          icon={<Layers className="size-4" />}
          label="Roles"
          values={analysis.roles.map((role) => role.name)}
        />

        {analysis.coreFeatures.length > 0 && (
          <div>
            <SubHeading>Fitur terdeteksi</SubHeading>
            <ul className="mt-2 space-y-1.5">
              {analysis.coreFeatures.map((feature) => (
                <li key={feature.name} className="text-[13px] leading-relaxed text-foreground-soft">
                  <span className="font-medium text-foreground">{feature.name}</span>
                  {feature.description ? ` — ${feature.description}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.technicalPreferences.length > 0 && (
          <div>
            <SubHeading>Preferensi teknologi</SubHeading>
            <ul className="mt-2 space-y-1.5">
              {analysis.technicalPreferences.map((preference) => (
                <li key={preference.component} className="text-[13px] text-foreground-soft">
                  <span className="font-medium text-foreground">{preference.component}:</span>{" "}
                  {preference.technology ?? "—"}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    ({preference.source === "user-selected" ? "User Selected" : "Recommended"})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.ambiguities.length > 0 && (
          <div className="rounded-card border border-warning-border bg-warning-soft p-3">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-warning">
              <CircleAlert className="size-3.5" />
              Perlu diputuskan
            </span>
            <ul className="mt-2 space-y-1.5">
              {analysis.ambiguities.map((ambiguity) => (
                <li key={ambiguity} className="text-[13px] leading-relaxed text-foreground-soft">
                  {ambiguity}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.nonGoals.length > 0 && (
          <Row icon={<CircleAlert className="size-4" />} label="Di luar cakupan" values={analysis.nonGoals} />
        )}
      </CardContent>
    </Card>
  );
}
