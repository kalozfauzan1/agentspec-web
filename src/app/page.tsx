"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpen, Import, Settings2, Sparkles, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/shell/app-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { useProjectStore } from "@/lib/store/project-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { formatRelative } from "@/lib/utils";
import type { ProjectRecord } from "@/lib/schemas";

const EXAMPLES = [
  "Aplikasi komunitas perumahan dengan IPL, marketplace warga, pengumuman, pengaduan, dan tombol darurat",
  "POS untuk kafe kecil: menu, transaksi, stok bahan, dan laporan harian",
  "Marketplace jasa les privat: profil tutor, jadwal, pembayaran, dan ulasan",
  "Aplikasi absensi karyawan dengan shift, izin, dan rekap bulanan",
];

const STATUS_LABEL: Record<ProjectRecord["status"], string> = {
  draft: "Draft",
  clarifying: "Klarifikasi",
  review: "Review",
  generating: "Generating",
  ready: "Siap",
};

export default function NewProjectPage() {
  const router = useRouter();
  const { projects, hydrated, createProject, analyzeIdea, generateQuestions, removeProject, importProject } =
    useProjectStore();
  const provider = useSettingsStore((state) => state.settings.provider);

  const [idea, setIdea] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const canStart = idea.trim().length >= 10 && !starting;

  const handleStart = async () => {
    if (!canStart) return;
    setStarting(true);
    setError(null);
    try {
      const project = await createProject(idea);
      await analyzeIdea(project.id);
      await generateQuestions(project.id);
      router.push(`/project/${project.id}/clarify`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memulai perencanaan.");
      setStarting(false);
    }
  };

  const handleImport = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const project = await importProject(text);
      router.push(`/project/${project.id}/review`);
    } catch {
      setError("File project tidak bisa dibaca. Pastikan itu hasil export JSON dari AgentSpec.");
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader
        right={
          <>
            <Badge tone={provider.mode === "live" ? "success" : "warning"}>
              {provider.mode === "live" ? "AI Live" : "Mode Demo"}
            </Badge>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">
                <Settings2 />
                Settings
              </Link>
            </Button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-14">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-primary-border bg-primary-soft px-3 py-1 text-[12px] font-medium text-primary">
            <Sparkles className="size-3.5" />
            Dari ide menjadi spesifikasi yang bisa dieksekusi
          </span>
          <h1 className="mt-5 text-[34px] font-semibold leading-tight tracking-tight text-foreground">
            What do you want to build?
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Tulis idemu dalam Bahasa Indonesia atau English. AgentSpec akan menyusun PRD, feature
            specification, arsitektur, data model, API, task implementasi, dan AGENTS.md yang konsisten.
          </p>
        </div>

        <Card className="mt-9">
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="idea" className="text-[13px] font-medium text-foreground-soft">
                Deskripsi produk
              </label>
              <Textarea
                id="idea"
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                rows={6}
                placeholder="Contoh: Saya ingin membuat aplikasi komunitas perumahan dengan fitur pembayaran IPL, marketplace warga, pengumuman, pengaduan, dan tombol darurat. Backend pakai Laravel, database MySQL."
                className="mt-2 resize-y"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void handleStart();
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Boleh singkat, panjang, berupa poin-poin, dengan atau tanpa preferensi teknologi.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setIdea(example)}
                  className="rounded-pill border border-border bg-surface-muted px-3 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:border-primary-border hover:bg-primary-soft hover:text-primary"
                >
                  {example.length > 64 ? `${example.slice(0, 62)}…` : example}
                </button>
              ))}
            </div>

            {error && (
              <Alert tone="danger" title="Tidak bisa memulai">
                {error}
                {provider.mode === "live" ? null : (
                  <>
                    {" "}
                    Mode demo tidak butuh API key, jadi error ini berarti ada masalah lain.
                  </>
                )}
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Langkah berikutnya: pertanyaan klarifikasi, lalu review project definition.
              </p>
              <Button size="lg" onClick={handleStart} disabled={!canStart}>
                {starting ? <Spinner /> : null}
                {starting ? "Menganalisis ide…" : "Start Planning"}
                {!starting && <ArrowRight />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <section className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                Recent Projects
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Proyek tersimpan lokal di browser ini.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <Import />
              Import Project
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                event.target.value = "";
              }}
            />
          </div>

          <div className="mt-4 space-y-3">
            {!hydrated && (
              <Card>
                <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Spinner />
                  Memuat project lokal…
                </CardContent>
              </Card>
            )}

            {hydrated && projects.length === 0 && (
              <EmptyState
                icon={<FolderOpen className="size-5" />}
                title="Belum ada project"
                description="Mulai dari ide di atas. Setelah dibuat, project akan muncul di sini dan tetap tersimpan walau browser di-refresh."
              />
            )}

            {projects.map((project) => (
              <Card key={project.id} className="transition-colors hover:border-border-strong">
                <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => router.push(`/project/${project.id}/review`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {project.definition?.name ?? project.idea.slice(0, 60)}
                      </span>
                      <Badge tone={project.status === "ready" ? "success" : "neutral"}>
                        {STATUS_LABEL[project.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                      {project.definition?.summary ?? project.idea}
                    </p>
                    <p className="mt-2 text-[11px] text-faint-foreground">
                      {project.artifacts.features.length} feature · {project.artifacts.tasks.length} task ·
                      diperbarui {formatRelative(project.updatedAt)}
                    </p>
                  </button>

                  <div className="flex items-center gap-2">
                    {project.status === "ready" ? (
                      <Button size="sm" asChild>
                        <Link href={`/project/${project.id}`}>Buka Workspace</Link>
                      </Button>
                    ) : (
                      <Button size="sm" asChild>
                        <Link href={`/project/${project.id}/review`}>Lanjutkan</Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Hapus project"
                      onClick={() => setDeleteTarget(project)}
                    >
                      <Trash2 className="text-danger" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus project ini?</DialogTitle>
            <DialogDescription>
              Project beserta seluruh dokumen yang sudah dihasilkan akan dihapus dari browser ini.
              Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleteTarget) await removeProject(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Hapus project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
