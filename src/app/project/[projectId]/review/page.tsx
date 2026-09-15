"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Loader2, RefreshCw } from "lucide-react";
import { FlowHeader } from "@/components/flow/flow-shell";
import { ChipListEditor, ObjectListEditor } from "@/components/review/editable-list";
import { TechDecisionsEditor } from "@/components/review/tech-decisions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  ARTIFACT_META,
  ARTIFACT_KEYS,
  IMPLEMENTATION_STRATEGY_LABEL,
  type ImplementationStrategy,
  type ProjectDefinition,
} from "@/lib/schemas";
import { ARTIFACT_ORDER } from "@/lib/pipeline/run";
import { useProjectStore } from "@/lib/store/project-store";

const STRATEGY_COPY: Record<ImplementationStrategy, string> = {
  "frontend-first":
    "Default. Frontend diselesaikan dulu dengan mock service, backend menyusul setelah pengalaman produk bisa direview.",
  "module-first":
    "Dipakai hanya kalau kamu memang minta dikerjakan per module / vertical slice sampai selesai end-to-end.",
};

const THEME_MODES = ["light", "dark", "both"] as const;

const THEME_MODE_LABEL: Record<(typeof THEME_MODES)[number], string> = {
  light: "Light",
  dark: "Dark",
  both: "Light & Dark",
};

export default function ProjectReviewPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;

  const { active, patchProject, generateSpecification, busy, progress, error } = useProjectStore();
  const [generating, setGenerating] = useState(false);

  const definition = active?.definition ?? null;

  const statuses = useMemo(() => active?.artifactStatus ?? null, [active]);

  const update = (patch: Partial<ProjectDefinition>) => {
    void patchProject((project) =>
      project.definition ? { ...project, definition: { ...project.definition, ...patch } } : project,
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateSpecification(projectId);
      router.push(`/project/${projectId}`);
    } catch {
      setGenerating(false);
    }
  };

  if (!active) return null;

  if (!definition) {
    return (
      <>
        <FlowHeader
          projectName={active.analysis?.suggestedName ?? "Project baru"}
          idea={active.idea}
          current="review"
        />
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
          <Alert tone="warning" title="Project definition belum dibuat">
            Selesaikan langkah klarifikasi dulu supaya AgentSpec bisa menyusun pemahaman awal tentang
            produkmu.
            <div className="mt-3">
              <Button size="sm" onClick={() => router.push(`/project/${projectId}/clarify`)}>
                Kembali ke Clarification
              </Button>
            </div>
          </Alert>
        </div>
      </>
    );
  }

  const readyArtifacts = ARTIFACT_KEYS.filter(
    (key) => active.artifactStatus[key]?.status === "ready",
  );
  const hasOutput = readyArtifacts.length > 0;

  return (
    <>
      <FlowHeader
        projectName={definition.name}
        idea={active.idea}
        current={hasOutput ? "generate" : "review"}
        right={
          hasOutput ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/project/${projectId}`}>Buka Workspace</Link>
            </Button>
          ) : null
        }
      />

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Definition</CardTitle>
              <CardDescription>
                Perbaiki dulu di sini. Semua dokumen yang di-generate mengikuti isi bagian ini, jadi
                kesalahan di sini akan menular ke seluruh spesifikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={definition.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Implementation Strategy</Label>
                  <div className="flex gap-2">
                    {(Object.keys(STRATEGY_COPY) as ImplementationStrategy[]).map((strategy) => (
                      <button
                        key={strategy}
                        type="button"
                        onClick={() => update({ implementation: { strategy } })}
                        className={`flex-1 rounded-control border px-3 py-2 text-[13px] transition-colors ${
                          definition.implementation.strategy === strategy
                            ? "border-primary-border bg-primary-soft font-medium text-primary"
                            : "border-border bg-surface text-foreground-soft hover:bg-surface-muted"
                        }`}
                      >
                        {IMPLEMENTATION_STRATEGY_LABEL[strategy]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {STRATEGY_COPY[definition.implementation.strategy]}
              </p>

              <div className="space-y-2">
                <Label htmlFor="summary">Product Summary</Label>
                <Textarea
                  id="summary"
                  rows={3}
                  value={definition.summary}
                  onChange={(event) => update({ summary: event.target.value })}
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <ChipListEditor
                  label="Platform"
                  items={definition.platform}
                  onChange={(platform) => update({ platform })}
                  placeholder="web, mobile, desktop…"
                />
                <ChipListEditor
                  label="Users"
                  items={definition.users}
                  onChange={(users) => update({ users })}
                  placeholder="Resident, Administrator…"
                />
              </div>

              <div>
                <p className="text-[13px] font-medium text-foreground-soft">Roles</p>
                <ul className="mt-2 space-y-2">
                  {definition.roles.map((role, index) => (
                    <li
                      key={`${role.name}-${index}`}
                      className="rounded-card border border-border bg-surface-muted px-3 py-2"
                    >
                      <p className="text-[13px] font-medium text-foreground">{role.name}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                        {role.description || role.responsibilities.join(", ") || "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <ObjectListEditor
                label="Core Features"
                items={definition.features}
                onChange={(features) => update({ features })}
                nameLabel="Nama fitur"
                descriptionLabel="Apa yang dilakukan fitur ini"
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <ChipListEditor
                  label="Non-Goals"
                  items={definition.nonGoals}
                  onChange={(nonGoals) => update({ nonGoals })}
                  placeholder="Visitor management…"
                  emptyLabel="Belum ada — sebaiknya diisi"
                />
                <ChipListEditor
                  label="Constraints"
                  items={definition.constraints}
                  onChange={(constraints) => update({ constraints })}
                  placeholder="Tim 2 orang, deadline 6 minggu…"
                />
              </div>

              <ChipListEditor
                label="Integrations"
                items={definition.integrations}
                onChange={(integrations) => update({ integrations })}
                placeholder="Payment gateway, WhatsApp…"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technology Stack</CardTitle>
              <CardDescription>
                Keputusan teknologi beserta sumbernya. AgentSpec tidak akan mengganti pilihanmu diam-diam.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {definition.technicalPreferences.length === 0 ? (
                <Alert tone="info">
                  Belum ada keputusan teknologi. Arsitektur nanti akan diisi rekomendasi (Recommended)
                  dan yang belum jelas dibiarkan Undecided.
                </Alert>
              ) : (
                <TechDecisionsEditor
                  decisions={definition.technicalPreferences}
                  onChange={(technicalPreferences) => update({ technicalPreferences })}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Arah Visual</CardTitle>
              <CardDescription>
                Menentukan tampilan yang akan diikuti UI design specification. Coding agent memakai
                bagian ini, jadi perbaiki kalau belum sesuai keinginanmu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="visual-style">Gaya visual</Label>
                <Textarea
                  id="visual-style"
                  rows={3}
                  value={definition.visualDirection.style}
                  onChange={(event) =>
                    update({
                      visualDirection: {
                        ...definition.visualDirection,
                        style: event.target.value,
                      },
                    })
                  }
                  placeholder="Minimalis, satu warna aksen, hierarki tipografi kuat…"
                />
              </div>

              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="flex gap-2">
                  {THEME_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        update({
                          visualDirection: { ...definition.visualDirection, themeMode: mode },
                        })
                      }
                      className={`flex-1 rounded-control border px-3 py-2 text-[13px] transition-colors ${
                        definition.visualDirection.themeMode === mode
                          ? "border-primary-border bg-primary-soft font-medium text-primary"
                          : "border-border bg-surface text-foreground-soft hover:bg-surface-muted"
                      }`}
                    >
                      {THEME_MODE_LABEL[mode]}
                    </button>
                  ))}
                </div>
              </div>

              <ChipListEditor
                label="Referensi tampilan"
                items={definition.visualDirection.references}
                onChange={(references) =>
                  update({ visualDirection: { ...definition.visualDirection, references } })
                }
                placeholder="Linear, Notion, Stripe Dashboard…"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="visual-personality">Karakter</Label>
                  <Input
                    id="visual-personality"
                    value={definition.visualDirection.personality}
                    onChange={(event) =>
                      update({
                        visualDirection: {
                          ...definition.visualDirection,
                          personality: event.target.value,
                        },
                      })
                    }
                    placeholder="Tenang, presisi, dan tegas…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visual-emotion">Emosi yang diinginkan</Label>
                  <Input
                    id="visual-emotion"
                    value={definition.visualDirection.desiredEmotion}
                    onChange={(event) =>
                      update({
                        visualDirection: {
                          ...definition.visualDirection,
                          desiredEmotion: event.target.value,
                        },
                      })
                    }
                    placeholder="Tenang dan terkendali saat situasi genting…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visual-audience">Konteks audiens</Label>
                  <Input
                    id="visual-audience"
                    value={definition.visualDirection.audienceContext}
                    onChange={(event) =>
                      update({
                        visualDirection: {
                          ...definition.visualDirection,
                          audienceContext: event.target.value,
                        },
                      })
                    }
                    placeholder="Dipakai operator sepanjang hari…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visual-density">Kepadatan informasi</Label>
                  <Input
                    id="visual-density"
                    value={definition.visualDirection.informationDensity}
                    onChange={(event) =>
                      update({
                        visualDirection: {
                          ...definition.visualDirection,
                          informationDensity: event.target.value,
                        },
                      })
                    }
                    placeholder="Nyaman dibaca, satu fokus per layar…"
                  />
                </div>
              </div>

              <ChipListEditor
                label="Preferensi media"
                items={definition.visualDirection.mediaPreferences}
                onChange={(mediaPreferences) =>
                  update({ visualDirection: { ...definition.visualDirection, mediaPreferences } })
                }
                placeholder="Fotografi asli, ilustrasi garis untuk empty state…"
              />

              <ChipListEditor
                label="Batasan brand"
                items={definition.visualDirection.brandConstraints}
                onChange={(brandConstraints) =>
                  update({ visualDirection: { ...definition.visualDirection, brandConstraints } })
                }
                placeholder="Warna brand, logo, tipografi wajib…"
              />

              <ChipListEditor
                label="Pola yang harus dihindari"
                items={definition.visualDirection.avoidPatterns}
                onChange={(avoidPatterns) =>
                  update({ visualDirection: { ...definition.visualDirection, avoidPatterns } })
                }
                placeholder="Dashboard KPI, glassmorphism, emoji sebagai ikon…"
              />

              <div className="space-y-2">
                <Label htmlFor="visual-notes">Catatan tambahan</Label>
                <Textarea
                  id="visual-notes"
                  rows={2}
                  value={definition.visualDirection.notes}
                  onChange={(event) =>
                    update({
                      visualDirection: {
                        ...definition.visualDirection,
                        notes: event.target.value,
                      },
                    })
                  }
                  placeholder="Warna brand, ikon, atau hal lain yang harus diikuti…"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generation</CardTitle>
              <CardDescription>
                Setiap dokumen disimpan begitu selesai, jadi kalau satu langkah gagal, hasil
                sebelumnya tidak hilang.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {progress && generating && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>Sedang membuat: {progress.label}</span>
                    <span>{progress.value}%</span>
                  </div>
                  <Progress value={progress.value} />
                </div>
              )}

              <ul className="space-y-2">
                {ARTIFACT_ORDER.map((key) => {
                  const artifactStatus = statuses?.[key];
                  const status = artifactStatus?.status ?? "empty";
                  return (
                    <li
                      key={key}
                      className="flex items-start justify-between gap-3 rounded-card border border-border bg-surface-muted px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground">
                          {ARTIFACT_META[key].label}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                          {ARTIFACT_META[key].description}
                        </p>
                        {artifactStatus?.error && (
                          <p className="mt-1 text-[12px] leading-relaxed text-danger">
                            {artifactStatus.error}
                          </p>
                        )}
                        {artifactStatus && artifactStatus.warnings.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {artifactStatus.warnings.slice(0, 3).map((warning) => (
                              <li key={warning} className="text-[12px] leading-relaxed text-warning">
                                {warning}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <StatusPill status={status} error={artifactStatus?.error ?? null} />
                    </li>
                  );
                })}
              </ul>

              {error && (
                <Alert tone="danger" title="Generation gagal">
                  {error.message}
                </Alert>
              )}

              {active.validation && active.validation.issues.length > 0 && (
                <Alert tone="warning" title={`${active.validation.issues.length} temuan konsistensi`}>
                  Buka Overview di workspace untuk melihat daftar temuan dan cara memperbaikinya.
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? <Spinner /> : <RefreshCw />}
                  {generating
                    ? "Membuat spesifikasi…"
                    : hasOutput
                      ? "Generate ulang semua"
                      : "Generate Specification"}
                </Button>
                {hasOutput && (
                  <Button variant="outline" asChild>
                    <Link href={`/project/${projectId}`}>
                      Buka Workspace
                      <ArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Dokumen yang akan dibuat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ARTIFACT_KEYS.map((key) => (
                <div key={key} className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-4 shrink-0 text-faint-foreground" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{ARTIFACT_META[key].label}</p>
                    <p className="text-[11px] text-muted-foreground">{ARTIFACT_META[key].fileName}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-surface-muted">
            <CardHeader className="pb-3">
              <CardTitle>Scope</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px] leading-relaxed text-foreground-soft">
              <p>
                <span className="font-medium text-foreground">Fitur:</span>{" "}
                {definition.features.length} item
              </p>
              <p>
                <span className="font-medium text-foreground">Strategi:</span>{" "}
                {IMPLEMENTATION_STRATEGY_LABEL[definition.implementation.strategy]}
              </p>
              <p>
                <span className="font-medium text-foreground">Non-goals:</span>{" "}
                {definition.nonGoals.length > 0 ? definition.nonGoals.join(", ") : "belum ada"}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function StatusPill({
  status,
  error,
}: {
  status: "empty" | "running" | "ready" | "failed" | "stale";
  error: string | null;
}) {
  if (status === "ready") {
    return (
      <Badge tone="success">
        <CheckCircle2 className="size-3" />
        Siap
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge tone="primary">
        <Loader2 className="size-3 animate-spin" />
        Proses
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge tone="danger" title={error ?? undefined}>
        <AlertTriangle className="size-3" />
        Gagal
      </Badge>
    );
  }
  if (status === "stale") {
    return (
      <Badge tone="warning">
        <AlertTriangle className="size-3" />
        Perlu regenerate
      </Badge>
    );
  }
  return <Badge tone="neutral">Belum</Badge>;
}
