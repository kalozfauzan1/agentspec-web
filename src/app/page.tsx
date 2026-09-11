"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';

export default function NewProjectPage() {
  const { currentIdea, setCurrentIdea, recentProjects, deleteProject, initialize } = useStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initialize().then(() => setIsLoading(false));
  }, [initialize]);

  const handleStartPlanning = () => {
    if (currentIdea.trim()) {
      // Navigate to clarification page via Link
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Start Building
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            What do you want to build?
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Turn your software idea into a detailed specification package with AI assistance.
          </p>
        </div>

        {/* Main Input Card */}
        <Card className="shadow-lg border-0 bg-white rounded-2xl p-8 mb-8">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Describe your product idea
            </label>
            <p className="text-sm text-gray-500 mb-2">
              You can write in Indonesian, English, or a mixture — whichever feels most natural to you.
            </p>
            <textarea
              value={currentIdea}
              onChange={(e) => setCurrentIdea(e.target.value)}
              placeholder="e.g., 'A residential community app that has IPL payments for monthly rent/utility collection, a marketplace, announcements, complaints, and a panic button'"
              className="w-full h-32 resize-none border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-gray-50 hover:bg-white transition-colors"
            />
            <p className="text-sm text-gray-400 mt-2">
              Accepted: short descriptions, long paragraphs, bullet lists, with or without technical preferences.
            </p>
          </div>

          <Link href="/clarification">
            <Button 
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all font-medium py-3 px-6 rounded-xl shadow-md hover:shadow-lg"
              disabled={!currentIdea.trim()}
            >
              Start Planning
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Button>
          </Link>
        </Card>

        {/* Recent Projects Section */}
        {!isLoading && recentProjects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Recent Projects
              </h3>
              <span className="text-sm text-gray-500">{recentProjects.length} projects</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentProjects.map((project) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow border-0 bg-white rounded-xl overflow-hidden group relative">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{project.name}</h4>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.summary}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {/* Delete button */}
                    <button
                      onClick={() => setShowDeleteConfirm(project.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                    >
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </CardContent>
                  
                  {showDeleteConfirm === project.id && (
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center gap-2 p-4">
                      <span className="text-sm text-gray-600">Delete?</span>
                      <Button size="sm" variant="destructive" onClick={() => { deleteProject(project.id); setShowDeleteConfirm(null); }}>
                        Delete
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center text-gray-400 py-8">Loading projects...</div>
        )}
      </main>
    </div>
  );
}
