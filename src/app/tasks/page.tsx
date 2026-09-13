"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";

type TaskStatus = 'pending' | 'in-progress' | 'completed';
type Priority = 'low' | 'medium' | 'high' | 'critical';

export default function TasksPage() {
  const { currentProject, tasks, loadLatestProject } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLatestProject().finally(() => setIsLoading(false));
  }, [loadLatestProject]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading project...</p>
      </div>
    );
  }

  // Use real tasks from store, fallback to empty
  const tasksList = tasks.length > 0 
    ? tasks 
    : (currentProject ? generateMockTasks(currentProject) : []);

  const filteredTasks = tasksList.filter((task: any) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  const phases = [...new Set(tasksList.map((t: any) => t.phase || 'General'))];
  const totalTasks = tasksList.length;
  const completedTasks = tasksList.filter((t: any) => t.status === 'completed').length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const statusColors = {
    'pending': 'bg-gray-100 text-gray-600',
    'in-progress': 'bg-blue-100 text-blue-600',
    'completed': 'bg-green-100 text-green-600',
  };

  const priorityColors = {
    'low': 'bg-gray-100 text-gray-600',
    'medium': 'bg-yellow-100 text-yellow-700',
    'high': 'bg-orange-100 text-orange-600',
    'critical': 'bg-red-100 text-red-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6 py-12">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/workspace" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
            ← Back to Workspace
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900">Implementation Tasks</h1>
          <p className="text-gray-500 mt-2">
            Ordered task list following the {currentProject?.implementationStrategy || 'frontend-first'} implementation strategy.
          </p>
        </div>

        {/* No Tasks State */}
        {tasksList.length === 0 ? (
          <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 mb-4">No tasks generated yet. Generate a project first.</p>
              <Link href="/review">
                <Button className="bg-blue-600 hover:bg-blue-700">Generate Project</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Progress Overview */}
            <Card className="shadow-md border border-gray-200 rounded-xl overflow-hidden mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Implementation Progress</h3>
                    <p className="text-sm text-gray-500">{completedTasks} of {totalTasks} tasks completed</p>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{Math.round(progress)}%</div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Tasks by Phase */}
            <div className="space-y-6">
              {phases.map((phase) => (
                <div key={phase}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{phase}</h3>
                  <div className="space-y-2">
                    {filteredTasks.filter((t: any) => t.phase === phase).map((task: any) => (
                      <Card 
                        key={task.id} 
                        className={`shadow-md border rounded-xl overflow-hidden cursor-pointer transition-all ${expandedTask === task.id ? 'border-blue-500' : 'border-gray-200'}`}
                        onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-mono text-gray-500">{task.id}</span>
                              <div>
                                <h4 className="font-medium text-gray-900">{task.title}</h4>
                                <p className="text-sm text-gray-500">{task.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[task.status as TaskStatus] || statusColors['pending']}`}>
                                {task.status || 'pending'}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[task.priority as Priority] || priorityColors['medium']}`}>
                                {task.priority || 'medium'}
                              </span>
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={expandedTask === task.id ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                              </svg>
                            </div>
                          </div>

                          {expandedTask === task.id && (
                            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                              {task.dependencies.length > 0 && (
                                <div>
                                  <span className="font-medium text-gray-700">Dependencies:</span>
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {task.dependencies.map((dep: string) => (
                                      <span key={dep} className="px-2 py-1 bg-gray-100 rounded text-xs">{dep}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {task.references.length > 0 && (
                                <div>
                                  <span className="font-medium text-gray-700">References:</span>
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {task.references.map((ref: string) => (
                                      <span key={ref} className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">{ref}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="col-span-2">
                                <span className="font-medium text-gray-700">Acceptance Criteria:</span>
                                <ul className="mt-1 space-y-1">
                                  {task.acceptanceCriteria.map((criterion: string, idx: number) => (
                                    <li key={idx} className="text-gray-600">• {criterion}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between">
          <Link href="/architecture">
            <Button variant="outline">← Back to Architecture</Button>
          </Link>
          <Link href="/export">
            <Button className="bg-blue-600 hover:bg-blue-700">
              Next: Export →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Fallback mock tasks generator for when no AI-generated tasks exist
function generateMockTasks(project: any): any[] {
  return [
    {
      id: 'TASK-001',
      title: 'Initialize project structure',
      description: 'Set up the basic project structure with TypeScript and configuration',
      type: 'frontend',
      featureId: 'GENERAL',
      dependencies: [],
      references: ['architecture.md'],
      requirements: ['Project builds successfully', 'TypeScript configured'],
      acceptanceCriteria: ['npm run dev works', 'TypeScript compiles'],
      status: 'pending' as TaskStatus,
      priority: 'critical' as Priority,
      phase: 'Project Foundation'
    },
    {
      id: 'TASK-002',
      title: 'Create main layout',
      description: 'Build the responsive layout with navigation and footer',
      type: 'frontend',
      featureId: 'GENERAL',
      dependencies: ['TASK-001'],
      references: ['architecture.md'],
      requirements: ['Layout is responsive', 'Navigation works'],
      acceptanceCriteria: ['Layout works on all screen sizes'],
      status: 'pending' as TaskStatus,
      priority: 'high' as Priority,
      phase: 'Frontend Foundation'
    }
  ];
}
