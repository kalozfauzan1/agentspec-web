"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";

export default function WorkspacePage() {
  const { currentProject, recentProjects, loadProject, loadLatestProject, prdContent, architectureData, features, tasks } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLatestProject().finally(() => setIsLoading(false));
  }, [loadLatestProject]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading project...</p>
      </div>
    );
  }

  const sidebarItems = [
    { title: "Overview", link: "/workspace" },
    { 
      title: "Product", 
      items: [
        { name: "PRD", link: "/workspace" }, 
        { name: "Features", link: "/features" }, 
        { name: "User Flows", link: "/workspace" }
      ] 
    },
    { 
      title: "Technical", 
      items: [
        { name: "Architecture", link: "/architecture" }, 
        { name: "Data Model", link: "/workspace" }, 
        { name: "API", link: "/workspace" }
      ] 
    },
    { 
      title: "Implementation", 
      items: [
        { name: "Tasks", link: "/tasks" }, 
        { name: "Agent Instructions", link: "/workspace" }
      ] 
    },
    { title: "Export", link: "/export" },
  ];

  const hasGeneratedContent =
    Boolean(prdContent) ||
    Boolean(architectureData) ||
    features.length > 0 ||
    tasks.length > 0;

  const completionStats = {
    prd: prdContent ? 100 : 0,
    features: features.length || currentProject?.features?.length || 0,
    architecture: architectureData ? 100 : 0,
    tasks: tasks.length,
    export: currentProject ? 100 : 0
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left Sidebar */}
      <aside className="w-64 border-r bg-white p-4 fixed h-full overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">AgentSpec</h2>
          <p className="text-xs text-gray-500 mt-1">Specification Generator</p>
        </div>
        
        <nav className="space-y-6">
          {sidebarItems.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group.title}
              </h3>
              {group.items ? (
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.name}>
                      <Link 
                        href={item.link} 
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Link 
                  href={group.link} 
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {group.title}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="mt-8 pt-8 border-t">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-700">
            ← New Project
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{currentProject?.name || 'Your Project'}</h1>
            <p className="text-gray-500 mt-1">Workspace</p>
          </div>
          <div className="flex gap-2">
            <Link href="/review">
              <Button variant="outline" size="sm">
                Regenerate
              </Button>
            </Link>
            <Link href="/export">
              <Button size="sm">Export</Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search specifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* No Project State */}
        {!currentProject && (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 mb-4">No project loaded. Start by creating a new project.</p>
              <Link href="/">
                <Button className="bg-blue-600 hover:bg-blue-700">Create New Project</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        {currentProject && hasGeneratedContent && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4">
              <div className="text-2xl font-bold text-blue-600">{completionStats.prd}%</div>
              <div className="text-sm text-gray-500">PRD</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-green-600">{completionStats.features}</div>
              <div className="text-sm text-gray-500">Features</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-purple-600">{completionStats.architecture}%</div>
              <div className="text-sm text-gray-500">Architecture</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-orange-600">{completionStats.tasks}</div>
              <div className="text-sm text-gray-500">Tasks</div>
            </Card>
          </div>
        )}

        {/* No generated content yet */}
        {currentProject && !hasGeneratedContent && (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 mb-4">This project has no generated specification yet. Generate it to see PRD, features, architecture, and tasks here.</p>
              <Link href="/review">
                <Button className="bg-blue-600 hover:bg-blue-700">Go to Review & Generate</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Project Summary */}
        {currentProject && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Project Overview</h3>
              <p className="text-gray-600 mb-4">{currentProject.summary}</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Platform:</span> {currentProject.platform?.join(', ') || 'Web'}
                </div>
                <div>
                  <span className="font-medium">Users:</span> {currentProject.users?.join(', ') || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Tech Stack:</span> {currentProject.technicalPreferences?.frontend}, {currentProject.technicalPreferences?.backend}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Recent Projects</h3>
              <div className="space-y-2">
                {recentProjects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    onClick={() => loadProject(project.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        loadProject(project.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-sm text-gray-500">{new Date(project.createdAt).toLocaleDateString()}</div>
                    </div>
                    <Button variant="ghost" size="sm">Open</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
