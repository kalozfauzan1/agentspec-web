"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";

export default function FeaturesPage() {
  const { currentProject, loadLatestProject } = useStore();
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLatestProject().finally(() => setIsLoading(false));
  }, [loadLatestProject]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading project...</p>
      </div>
    );
  }

  // Use real features from store, fallback to empty
  const features = currentProject?.features || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6 py-12">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/workspace" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
            ← Back to Workspace
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900">Feature Specifications</h1>
          <p className="text-gray-500 mt-2">
            Detailed specifications for each feature with actors, flows, and acceptance criteria.
          </p>
        </div>

        {/* No Features State */}
        {features.length === 0 ? (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 mb-4">No features generated yet.</p>
              <Link href="/review">
                <Button className="bg-blue-600 hover:bg-blue-700">Generate Project First</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          /* Features Grid */
          <div className="space-y-4">
            {features.map((feature) => (
              <Card key={feature.id} className="shadow-md border border-gray-200 rounded-xl overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="font-bold text-blue-600 text-sm">{feature.id?.split('-')[0] || 'F'}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{feature.purpose}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {feature.actors.map((actor) => (
                            <span key={actor} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              {actor}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                    >
                      {expandedFeature === feature.id ? 'Less' : 'More'}
                    </Button>
                  </div>

                  {expandedFeature === feature.id && (
                    <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Main Flow</h4>
                        <ol className="space-y-1 text-sm text-gray-600">
                          {feature.mainFlow.map((step, idx) => (
                            <li key={idx}>
                              <span className="font-medium">{idx + 1}.</span> {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Requirements</h4>
                        <ul className="space-y-1 text-sm text-gray-600">
                          {feature.requirements.map((req, idx) => (
                            <li key={idx}>• {req}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Business Rules</h4>
                        <ul className="space-y-1 text-sm text-gray-600">
                          {feature.businessRules?.map((rule, idx) => (
                            <li key={idx}>• {rule}</li>
                          )) || <li className="text-gray-400">None specified</li>}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Acceptance Criteria</h4>
                        <ul className="space-y-1 text-sm text-gray-600">
                          {feature.acceptanceCriteria.map((criterion, idx) => (
                            <li key={idx}>• {criterion}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between">
          <Link href="/workspace">
            <Button variant="outline">Back to Workspace</Button>
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
