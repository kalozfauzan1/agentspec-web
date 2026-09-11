"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useState } from "react";

export default function ExportPage() {
  const { currentProject, prdContent, architectureData, agentInstructions, tasks, features } = useStore();
  const [exportFormat, setExportFormat] = useState<'zip' | 'individual'>('zip');
  const [exporting, setExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const documents = [
    { name: 'README.md', description: 'Project overview and setup', size: '~1-2 KB' },
    { name: 'AGENTS.md', description: 'AI agent instructions', size: '~2-4 KB' },
    { name: 'docs/PRD.md', description: 'Product Requirements Document', size: '~3-5 KB' },
    { name: 'docs/architecture.md', description: 'Technical architecture', size: '~2-3 KB' },
    { name: 'docs/features/', description: 'Feature specifications', size: '~5-10 KB' },
    { name: 'tasks/README.md', description: 'Implementation tasks index', size: '~1 KB' },
    { name: 'tasks/*.md', description: 'Individual task specifications', size: '~3-5 KB each' },
  ];

  const handleExport = async () => {
    if (!currentProject) return;
    
    setExporting(true);
    setExportError(null);
    
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectDefinition: currentProject,
          prd: prdContent,
          features: features,
          architecture: architectureData,
          tasks: tasks,
          agentInstructions: agentInstructions
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentProject.name.toLowerCase().replace(/\s+/g, '-')}-spec.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportComplete(true);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6 py-12">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/tasks" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
            ← Back to Tasks
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900">Export Specification</h1>
          <p className="text-gray-500 mt-2">
            Download the complete specification package to give to your AI coding agent.
          </p>
        </div>

        {/* No Project State */}
        {!currentProject && (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 mb-4">No project to export. Generate a project first.</p>
              <Link href="/review">
                <Button className="bg-blue-600 hover:bg-blue-700">Generate Project</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Project Summary */}
        {currentProject && (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
            <CardHeader className="pb-3">
              <CardTitle>Project Summary</CardTitle>
              <CardDescription>{currentProject.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{currentProject.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Export Options */}
        {currentProject && (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
            <CardHeader className="pb-3">
              <CardTitle>Export Format</CardTitle>
              <CardDescription>Choose how you want to receive your specification files.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="format" 
                    value="zip"
                    checked={exportFormat === 'zip'}
                    onChange={(e) => setExportFormat(e.target.value as 'zip')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">ZIP Archive (recommended)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="format" 
                    value="individual"
                    checked={exportFormat === 'individual'}
                    onChange={(e) => setExportFormat(e.target.value as 'individual')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Individual Files</span>
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generated Files */}
        {currentProject && (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
            <CardHeader className="pb-3">
              <CardTitle>Generated Files</CardTitle>
              <CardDescription>The following specification documents will be included in your export.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <div className="font-medium text-gray-900">{doc.name}</div>
                        <div className="text-sm text-gray-500">{doc.description}</div>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">{doc.size}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Error */}
        {exportError && (
          <Card className="shadow-md border border-red-200 bg-red-50 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-6">
              <p className="text-red-700">{exportError}</p>
            </CardContent>
          </Card>
        )}

        {/* Export Button */}
        {currentProject && (
          <div className="flex justify-center">
            <Button
              onClick={handleExport}
              disabled={exporting || !currentProject}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : exportComplete ? (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Export Complete!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Specification Package
                </>
              )}
            </Button>
          </div>
        )}

        {exportComplete && (
          <div className="mt-4 text-center">
            <p className="text-sm text-green-600">
              ✓ Your specification package has been downloaded. Give it to your AI coding agent to start building!
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between">
          <Link href="/tasks">
            <Button variant="outline">← Back to Tasks</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost">Start New Project</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
