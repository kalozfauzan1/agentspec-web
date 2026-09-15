"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileJson,
  FileText,
  FolderTree,
  Upload,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  buildPackageFiles,
  downloadProjectJson,
  downloadSpecPackage,
  readProjectFile,
  STARTER_PROMPT,
} from "@/lib/export/package";
import { ARTIFACT_KEYS, ARTIFACT_META } from "@/lib/schemas";
import { useProjectStore } from "@/lib/store/project-store";
import { isBlockingIssue } from "@/lib/validation/issues";

interface TreeNode {
  name: string;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", children: [] };
  for (const path of paths) {
    const parts = path.split("/");
    let current = root;
    for (const part of parts) {
      let next = current.children.find((child) => child.name === part);
      if (!next) {
        next = { name: part, children: [] };
        current.children.push(next);
      }
      current = next;
    }
  }
  const sort = (node: TreeNode) => {
    node.children.sort((a, b) => {
      const aFolder = a.children.length > 0;
      const bFolder = b.children.length > 0;
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

function TreeView({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={`${node.name}-${depth}`}>
          <div
            className="flex items-center gap-2 font-mono text-[12px]"
            style={{ paddingLeft: depth * 16 }}
          >
            {node.children.length > 0 ? (
              <FolderTree className="size-3.5 text-primary" />
            ) : (
              <FileText className="size-3.5 text-faint-foreground" />
            )}
            <span className={node.children.length > 0 ? "text-foreground" : "text-foreground-soft"}>
              {node.name}
            </span>
          </div>
          {node.children.length > 0 && <TreeView nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export default function ExportPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;
  const { active, importProject } = useProjectStore();

  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!active) return null;

  const files = buildPackageFiles(active);
  const tree = buildTree(files.map((file) => file.path));
  const missing = ARTIFACT_KEYS.filter((key) => active.artifactStatus[key]?.status !== "ready");
  const totalKb = Math.round(files.reduce((sum, file) => sum + file.content.length, 0) / 1024);

  const visualBlockers = [
    { key: "uiDesign" as const, label: "UI Design" },
    { key: "assetPlan" as const, label: "Asset Plan" },
  ].filter((entry) => active.artifactStatus[entry.key]?.status !== "ready");

  const highSeverityIssues = (active.validation?.issues ?? []).filter(isBlockingIssue);

  const blockedReason =
    visualBlockers.length > 0
      ? `Package belum bisa di-download sebagai Markdown ZIP karena ${visualBlockers
          .map((entry) => entry.label)
          .join(" dan ")} belum siap.`
      : highSeverityIssues.length > 0
        ? `Package belum bisa diunduh karena ada ${highSeverityIssues.length} hal yang perlu dibereskan. Buka Overview, lalu jalankan "Perbaiki otomatis" atau minta perubahannya lewat kolom AI.`
        : null;

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportZip = async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadSpecPackage(active);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export gagal.");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setError(null);
    try {
      const text = await readProjectFile(file);
      const project = await importProject(text);
      router.push(`/project/${project.id}/review`);
    } catch {
      setError("File project tidak bisa dibaca.");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Implementation
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          Export Specification
        </h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Package Markdown ini bisa langsung diberikan ke coding agent mana pun. Tidak ada sintaks
          khusus AgentSpec di dalamnya.
        </p>
      </header>

      {missing.length > 0 && (
        <Alert tone="warning" title={`${missing.length} dokumen belum siap`}>
          Yang belum ada: {missing.map((key) => ARTIFACT_META[key].label).join(", ")}. Package tetap
          bisa di-export, tapi coding agent akan kehilangan bagian tersebut.
        </Alert>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {blockedReason && (
        <Alert tone="warning" title="Markdown package belum siap">
          {blockedReason} Kamu tetap bisa mengunduh project JSON untuk backup.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="size-4 text-primary" />
                Markdown specification package
              </CardTitle>
              <CardDescription>
                {files.length} file · sekitar {totalKb} KB · diunduh sebagai satu file ZIP.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button size="lg" onClick={exportZip} disabled={exporting || blockedReason !== null}>
                {exporting ? <Spinner /> : <Download />}
                {exporting ? "Menyiapkan ZIP…" : "Download specification package"}
              </Button>
              <div className="flex flex-wrap gap-2">
                {["Portable", "Tool neutral", "Plain Markdown", "Tidak butuh AgentSpec"].map((tag) => (
                  <Badge key={tag} tone="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AgentSpec project JSON</CardTitle>
              <CardDescription>
                Untuk menyimpan atau memindahkan project ini ke browser lain. Berisi seluruh state
                terstruktur, bukan dokumen final.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadProjectJson(active)}>
                <FileJson />
                Download project JSON
              </Button>
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload />
                Import project JSON
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Starter prompt</CardTitle>
              <CardDescription>
                Tempel ini sebagai pesan pertama saat membuka coding agent di repository project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="scrollbar-slim max-h-72 overflow-auto rounded-card border border-border bg-surface-muted p-4 font-mono text-[12px] leading-relaxed text-foreground-soft">
                {STARTER_PROMPT}
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(STARTER_PROMPT, "starter")}
              >
                {copied === "starter" ? <Check /> : <Copy />}
                {copied === "starter" ? "Tersalin" : "Copy starter prompt"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Package preview</CardTitle>
            </CardHeader>
            <CardContent>
              <TreeView nodes={tree} />
            </CardContent>
          </Card>

          <Card className="bg-surface-muted">
            <CardHeader className="pb-3">
              <CardTitle>Kesiapan package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ARTIFACT_KEYS.map((key) => {
                const ready = active.artifactStatus[key]?.status === "ready";
                return (
                  <div key={key} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-foreground-soft">{ARTIFACT_META[key].label}</span>
                    {ready ? (
                      <Check className="size-4 text-success" />
                    ) : (
                      <AlertTriangle className="size-4 text-warning" />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
