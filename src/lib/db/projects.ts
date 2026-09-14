import { z } from "zod";
import { projectStorage } from "./database";
import {
  createDefaultArtifactStatus,
  projectRecordSchema,
  type ProjectRecord,
} from "@/lib/schemas";

export async function listProjects(): Promise<ProjectRecord[]> {
  const raw = await projectStorage.getAll<unknown>();
  const projects: ProjectRecord[] = [];
  for (const candidate of raw) {
    const parsed = projectRecordSchema.safeParse(candidate);
    if (parsed.success) projects.push(parsed.data);
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const raw = await projectStorage.get<unknown>(id);
  if (!raw) return null;
  const parsed = projectRecordSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function saveProject(project: ProjectRecord): Promise<ProjectRecord> {
  const normalized: ProjectRecord = { ...project, updatedAt: Date.now() };
  await projectStorage.put(projectRecordSchema.parse(normalized));
  return normalized;
}

export async function deleteProject(id: string): Promise<void> {
  await projectStorage.remove(id);
}

export const projectExportSchema = z.object({
  kind: z.literal("agentspec-project"),
  version: z.literal(1),
  exportedAt: z.number(),
  project: projectRecordSchema,
});
export type ProjectExportFile = z.infer<typeof projectExportSchema>;

export function serializeProject(project: ProjectRecord) {
  const payload: ProjectExportFile = {
    kind: "agentspec-project",
    version: 1,
    exportedAt: Date.now(),
    project,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseProjectFile(json: string): ProjectRecord {
  const parsed = projectExportSchema.parse(JSON.parse(json));
  return projectRecordSchema.parse(parsed.project);
}

export function createEmptyArtifactStatus(): ProjectRecord["artifactStatus"] {
  return createDefaultArtifactStatus();
}
