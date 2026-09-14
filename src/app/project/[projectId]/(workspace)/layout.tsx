"use client";

import { useParams } from "next/navigation";
import { WorkspaceShell } from "@/components/shell/workspace-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string }>();
  return <WorkspaceShell projectId={params.projectId}>{children}</WorkspaceShell>;
}
