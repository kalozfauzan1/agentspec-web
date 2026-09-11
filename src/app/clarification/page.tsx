"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { useState, useEffect } from "react";

interface ClarificationQuestion {
  id: string;
  question: string;
  description: string;
  type: 'radio' | 'checkbox' | 'text';
  options?: string[];
}

export default function ClarificationPage() {
  const { 
    currentIdea, 
    clarificationAnswers, 
    setClarificationAnswer, 
    completeClarification,
    dynamicClarificationQuestions,
    isGenerating,
    generationStep,
    generationError,
    generateClarification
  } = useStore();
  
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [hasGenerated, setHasGenerated] = useState(false);

  // Auto-generate questions when entering the page
  useEffect(() => {
    if (currentIdea && !hasGenerated && !isGenerating) {
      setHasGenerated(true);
      generateClarification().catch(console.error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Use dynamic questions from AI, fallback to empty
  const questions: ClarificationQuestion[] = dynamicClarificationQuestions.length > 0 
    ? dynamicClarificationQuestions 
    : [];

  const handleRadioChange = (questionId: string, value: string) => {
    setClarificationAnswer({ questionId, answer: value, type: 'radio' });
  };

  const handleCheckboxChange = (questionId: string, value: string, checked: boolean) => {
    const existing = clarificationAnswers.find(a => a.questionId === questionId);
    let newValues: string[];
    
    if (existing) {
      const currentValues = existing.answer.split(', ').filter((v: string) => v.trim());
      newValues = checked 
        ? [...currentValues, value]
        : currentValues.filter((v: string) => v !== value);
    } else {
      newValues = checked ? [value] : [];
    }
    
    if (newValues.length > 0) {
      setClarificationAnswer({ questionId, answer: newValues.join(', '), type: 'checkbox' });
    } else {
      // Remove answer if no values selected
      setClarificationAnswer({ questionId, answer: '', type: 'checkbox' });
    }
  };

  const handleCustomAnswer = (questionId: string, value: string) => {
    setCustomAnswers(prev => ({ ...prev, [questionId]: value }));
    // Also update store for text-type questions
    if (value.trim()) {
      setClarificationAnswer({ questionId, answer: value, type: 'text' });
    }
  };

  const isFormValid = () => {
    if (questions.length === 0) return true; // Allow skipping if no questions generated
    return questions.every((q: ClarificationQuestion) => {
      const answer = clarificationAnswers.find((a: any) => a.questionId === q.id);
      if (q.type === 'radio') return !!answer?.answer;
      if (q.type === 'checkbox') return (answer?.answer || '').length > 0;
      return true; // text fields are optional
    });
  };

  const handleNext = () => {
    completeClarification();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-start justify-center p-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Page Header */}
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
            ← Back to New Project
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900">Clarification</h1>
          <p className="text-gray-500 mt-2">
            {questions.length > 0 
              ? 'Answer these questions to help us understand your project better.'
              : 'Let AI analyze your idea and ask clarifying questions.'
            }
          </p>
        </div>

        {/* Project Context Card */}
        <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Project Context</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Idea:</span> {currentIdea || 'No idea provided'}
            </p>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isGenerating && (
          <Card className="shadow-md border border-blue-200 bg-blue-50 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="font-medium text-blue-900">{generationStep || 'Generating questions...'}</p>
                  <p className="text-sm text-blue-600">AI is analyzing your idea</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {generationError && (
          <Card className="shadow-md border border-red-200 bg-red-50 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-6">
              <p className="text-red-700">{generationError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => {
                  setHasGenerated(false);
                  generateClarification().catch(console.error);
                }}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty State - No questions generated */}
        {!isGenerating && questions.length === 0 && !generationError && (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
            <CardContent className="p-6 text-center">
              <p className="text-gray-500 mb-4">No clarification questions generated. You can proceed directly.</p>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                Skip Questions →
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Clarification Questions */}
        {questions.length > 0 && (
          <div className="space-y-4">
            {questions.map((q: ClarificationQuestion) => (
              <Card key={q.id} className="shadow-md border border-gray-200 rounded-xl overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">{q.question}</CardTitle>
                  <CardDescription>{q.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {q.type === 'radio' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((option) => {
                        const selected = clarificationAnswers.find((a: any) => a.questionId === q.id)?.answer === option;
                        return (
                          <label key={option} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                            <input 
                              type="radio" 
                              name={q.id} 
                              checked={selected}
                              onChange={() => handleRadioChange(q.id, option)}
                              className="h-4 w-4 text-blue-600" 
                            />
                            <span className="text-sm text-gray-700">{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'checkbox' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((option) => {
                        const selected = clarificationAnswers
                          .find((a: any) => a.questionId === q.id)
                          ?.answer?.split(', ')
                          .includes(option);
                        return (
                          <label key={option} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                            <input 
                              type="checkbox" 
                              checked={selected}
                              onChange={(e) => handleCheckboxChange(q.id, option, e.target.checked)}
                              className="h-4 w-4 text-blue-600 rounded" 
                            />
                            <span className="text-sm text-gray-700">{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {(q.type === 'radio' || q.type === 'checkbox') && (
                    <Input 
                      placeholder="Or type a custom answer..." 
                      className="h-9"
                      value={customAnswers[q.id] || ''}
                      onChange={(e) => handleCustomAnswer(q.id, e.target.value)}
                    />
                  )}

                  {q.type === 'text' && (
                    <Input
                      placeholder="Type your answer..."
                      className="h-9"
                      value={clarificationAnswers.find((a: any) => a.questionId === q.id)?.answer || ''}
                      onChange={(e) => handleCustomAnswer(q.id, e.target.value)}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex gap-3">
          <Link href="/" className="flex-1">
            <Button variant="outline" className="w-full h-10">
              Back
            </Button>
          </Link>
          <Link href="/review" className="flex-1">
            <Button 
              className="w-full h-10 bg-blue-600 hover:bg-blue-700"
              disabled={!isFormValid() || isGenerating}
              onClick={handleNext}
            >
              {isGenerating ? 'Generating...' : 'Next'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
