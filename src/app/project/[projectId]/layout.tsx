"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { useProjectStore } from "@/lib/store/project-store";
import { EmptyState } from "@/components/ui/empty-state";
import { useRouter } from "next/navigation";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId;

  const { active, openProject, error } = useProjectStore();
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    openProject(projectId).then((project) => {
      if (cancelled) return;
      setState(project ? "ready" : "missing");
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, openProject]);

  if (state === "loading") {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <LoadingBlock label="Memuat project…" />
      </div>
    );
  }

  if (state === "missing" || !active) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <EmptyState
            title="Project tidak ditemukan"
            description="Project ini mungkin sudah dihapus dari browser ini, atau file-nya berasal dari browser lain. Kamu bisa import ulang dari file JSON project."
            action={{ label: "Kembali ke New Project", href: "/" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {error && (
        <div className="mx-auto w-full max-w-5xl px-6 pt-6">
          <Alert
            tone="danger"
            title="Langkah terakhir gagal"
            action={
              <Button size="sm" variant="outline" onClick={() => router.push("/settings")}>
                Buka Settings
              </Button>
            }
          >
            {error.message}
          </Alert>
        </div>
      )}
      {children}
    </div>
  );
}
