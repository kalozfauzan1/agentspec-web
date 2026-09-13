"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";

type DecisionStatus = 'User Selected' | 'Recommended' | 'Undecided';

function archValueToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item : archValueToString(item))).join(', ');
  }
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.name === 'string' && o.name) return o.name;
    if (typeof o.recommended === 'string' && o.recommended) return o.recommended;
    if (typeof o.userSelected === 'string' && o.userSelected) return o.userSelected;
    return '-';
  }
  if (value == null) return '';
  return String(value);
}

function toDisplayList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => archValueToString(v)).filter((s) => s.length > 0);
  if (typeof value === 'string' && value) return [value];
  return [];
}

export default function ArchitecturePage() {
  const { currentProject, loadLatestProject } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLatestProject().finally(() => setIsLoading(false));
  }, [loadLatestProject]);
  const [editingDecision, setEditingDecision] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editStatus, setEditStatus] = useState<DecisionStatus>('Recommended');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading project...</p>
      </div>
    );
  }

  // Build decisions from architecture data or project tech stack
  const rawArchitectureData = (currentProject as any)?.architectureData || {};
  const architectureData = rawArchitectureData?.architecture && typeof rawArchitectureData.architecture === 'object' ? rawArchitectureData.architecture : rawArchitectureData;
  const techPrefs = currentProject?.technicalPreferences as { frontend?: string; backend?: string; database?: string; realtime?: string } || {};
  
  const decisions = {
    frontend: { 
      component: 'Frontend', 
      technology: archValueToString(architectureData.frontend) || archValueToString(techPrefs.frontend) || 'Next.js', 
      source: (architectureData.frontendSource || 'User Selected') as DecisionStatus 
    },
    backend: { 
      component: 'Backend', 
      technology: archValueToString(architectureData.backend) || archValueToString(techPrefs.backend) || 'Node.js', 
      source: (architectureData.backendSource || 'User Selected') as DecisionStatus 
    },
    database: { 
      component: 'Database', 
      technology: archValueToString(architectureData.database) || archValueToString(techPrefs.database) || 'PostgreSQL', 
      source: (architectureData.databaseSource || 'Recommended') as DecisionStatus 
    },
    realtime: { 
      component: 'Realtime', 
      technology: archValueToString(architectureData.realtime) || archValueToString(techPrefs.realtime) || 'WebSocket', 
      source: (architectureData.realtimeSource || 'Recommended') as DecisionStatus 
    },
    auth: { 
      component: 'Authentication', 
      technology: archValueToString(architectureData.auth ?? architectureData.authentication) || 'JWT/Session', 
      source: (architectureData.authSource || 'Undecided') as DecisionStatus 
    },
    storage: { 
      component: 'Storage', 
      technology: archValueToString(architectureData.storage) || 'Cloud Storage', 
      source: (architectureData.storageSource || 'Recommended') as DecisionStatus 
    },
  };

  const systemBoundariesRaw = (architectureData as any)?.systemBoundaries;
  const systemInside = Array.isArray(systemBoundariesRaw?.inside) ? toDisplayList(systemBoundariesRaw.inside) : [];
  const systemOutside = Array.isArray(systemBoundariesRaw?.outside) ? toDisplayList(systemBoundariesRaw.outside) : [];
  const hasSystemBoundaries = systemInside.length > 0 || systemOutside.length > 0;

  const dataFlowRaw = (architectureData as any)?.highLevelDataFlow;
  const dataFlowSteps = Array.isArray(dataFlowRaw)
    ? toDisplayList(dataFlowRaw)
    : Array.isArray((dataFlowRaw as any)?.steps)
      ? toDisplayList((dataFlowRaw as any).steps)
      : [];

  const handleEdit = (component: string) => {
    const decision = decisions[component as keyof typeof decisions];
    setEditingDecision(component);
    setEditValue(decision.technology);
    setEditStatus(decision.source);
  };

  const handleSave = () => {
    // In a real app, this would update the architecture data
    setEditingDecision(null);
  };

  const sourceColors = {
    'User Selected': 'bg-green-100 text-green-700',
    'Recommended': 'bg-blue-100 text-blue-700',
    'Undecided': 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6 py-12">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/workspace" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
            ← Back to Workspace
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900">Technical Architecture</h1>
          <p className="text-gray-500 mt-2">
            Technology stack decisions with source tracking. Decisions can be User Selected, Recommended, or Undecided.
          </p>
        </div>

        {/* No Data State */}
        {!currentProject && (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 mb-4">No architecture data available. Generate a project first.</p>
              <Link href="/review">
                <Button className="bg-blue-600 hover:bg-blue-700">Generate Project</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Architecture Decisions */}
        <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
          <CardHeader className="pb-4">
            <CardTitle>Technology Stack Decisions</CardTitle>
            <CardDescription>Review and modify technology choices for each component.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Component</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Technology</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Source</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(decisions).map(([key, decision]) => (
                    <tr key={key} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{decision.component}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {editingDecision === key ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="px-2 py-1 border rounded text-sm w-full"
                          />
                        ) : (
                          decision.technology
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {editingDecision === key ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as DecisionStatus)}
                            className="px-2 py-1 border rounded text-sm"
                          >
                            <option value="User Selected">User Selected</option>
                            <option value="Recommended">Recommended</option>
                            <option value="Undecided">Undecided</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${sourceColors[decision.source]}`}>
                            {decision.source}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {editingDecision === key ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSave}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingDecision(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleEdit(key)}>Edit</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Architecture Overview */}
        <div className="grid grid-cols-2 gap-6">
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">System Boundaries</CardTitle>
            </CardHeader>
            <CardContent>
              {hasSystemBoundaries ? (
                <div className="text-sm text-gray-600 space-y-3">
                  {systemInside.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-700">Inside</p>
                      <ul className="space-y-1 mt-1">
                        {systemInside.map((item, i) => (
                          <li key={`inside-${i}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {systemOutside.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-700">Outside</p>
                      <ul className="space-y-1 mt-1">
                        {systemOutside.map((item, i) => (
                          <li key={`outside-${i}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Frontend: {decisions.frontend.technology} application</li>
                <li>• Backend: {decisions.backend.technology} API server</li>
                <li>• Database: {decisions.database.technology} for persistence</li>
                <li>• Realtime: {decisions.realtime.technology} for live updates</li>
                <li>• Authentication: {decisions.auth.technology}</li>
              </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">High-Level Data Flow</CardTitle>
            </CardHeader>
            <CardContent>
              {dataFlowSteps.length > 0 ? (
              <div className="text-sm text-gray-600 space-y-2">
                {dataFlowSteps.map((step, i) => (
                  <div key={i}>{i + 1}. {step}</div>
                ))}
              </div>
              ) : (
              <div className="text-sm text-gray-600 space-y-2">
                <div>1. Client → API Gateway</div>
                <div>2. API → Business Logic</div>
                <div>3. Business Logic → Database</div>
                <div>4. WebSocket → Realtime Updates</div>
                <div>5. Notifications → Users</div>
              </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between">
          <Link href="/features">
            <Button variant="outline">← Back to Features</Button>
          </Link>
          <Link href="/tasks">
            <Button className="bg-blue-600 hover:bg-blue-700">
              Next: Implementation Tasks →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
