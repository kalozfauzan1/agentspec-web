import JSZip from "jszip";
import { slugify } from "@/lib/utils";
import { serializeProject } from "@/lib/db/projects";
import type { ProjectRecord } from "@/lib/schemas";
import { buildPackageFiles, STARTER_PROMPT } from "./markdown";

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function packageFileName(project: ProjectRecord) {
  return `${slugify(project.definition?.name ?? project.idea.slice(0, 30), "project-spec")}-spec.zip`;
}

export function jsonFileName(project: ProjectRecord) {
  return `${slugify(project.definition?.name ?? project.idea.slice(0, 30), "agentspec-project")}.agentspec.json`;
}

export async function downloadSpecPackage(project: ProjectRecord) {
  const zip = new JSZip();
  for (const file of buildPackageFiles(project)) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, packageFileName(project));
  return buildPackageFiles(project);
}

export function downloadProjectJson(project: ProjectRecord) {
  const blob = new Blob([serializeProject(project)], { type: "application/json" });
  triggerDownload(blob, jsonFileName(project));
}

export function readProjectFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsText(file);
  });
}

export { STARTER_PROMPT, buildPackageFiles };
