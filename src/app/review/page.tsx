"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useState } from "react";

export default function ProjectReviewPage() {
  const { 
    currentIdea, 
    clarificationAnswers, 
    isClarificationComplete, 
    generateProject, 
    isGenerating, 
    generationProgress,
    generationStep,
    generationError
  } = useStore();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateProject();
    } finally {
      setGenerating(false);
    }
  };

  // Get clarification answers for display
  const getAnswer = (questionId: string) => {
    return clarificationAnswers.find(a => a.questionId === questionId)?.answer || 'Not specified';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-start justify-center p-6 py-12">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/clarification" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
            ← Back to Clarification
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900">Project Review</h1>
          <p className="text-gray-500 mt-2">
            Review and confirm the project definition before generating specifications.
          </p>
        </div>

        {/* Generation Error */}
        {generationError && (
          <Card className="shadow-md border border-red-200 bg-red-50 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-6">
              <p className="text-red-700">{generationError}</p>
            </CardContent>
          </Card>
        )}

        {/* Generation Progress */}
        {isGenerating && (
          <Card className="shadow-md border border-blue-200 bg-blue-50 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900">{generationStep || 'Generating your specification...'}</p>
                  <p className="text-sm text-blue-600">{generationProgress}% complete</p>
                </div>
              </div>
              <div className="mt-4 w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Project Card */}
        <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold">Project Definition</CardTitle>
            <CardDescription>Review your project details below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Project Name</span>
                <p className="text-base font-medium">{currentIdea?.split(' ').slice(0, 5).join(' ') || 'Your Project'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Platform</span>
                <p className="text-base">{getAnswer('platform')}</p>
              </div>
            </div>
            
            <div>
              <span className="text-sm font-medium text-gray-500">Project Summary</span>
              <p className="text-base mt-1">{currentIdea || 'No idea provided'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-500">Target Users</span>
                <p className="text-base">{getAnswer('users')}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Payment System</span>
                <p className="text-base">{getAnswer('payment')}</p>
              </div>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-500">Key Features</span>
              <p className="text-base mt-1">{getAnswer('features')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <div className="flex justify-center">
          <Button 
            onClick={handleGenerate}
            disabled={generating || isGenerating || !currentIdea}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
          >
            {isGenerating ? `${generationStep || 'Generating...'}` : 'Generate Specification'}
          </Button>
        </div>

        {/* Note */}
        <p className="text-center text-sm text-gray-500 mt-4">
          This will generate a complete specification package including PRD, features, architecture, and implementation tasks.
        </p>
      </div>
    </div>
  );
}
