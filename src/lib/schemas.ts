import { z } from 'zod';

export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Project name is required'),
  summary: z.string().min(10, 'Project summary must be at least 10 characters'),
  platform: z.array(z.string()),
  users: z.array(z.string()),
  roles: z.array(z.string()).optional(),
  features: z.array(z.object({
    id: z.string(),
    name: z.string(),
    purpose: z.string(),
    actors: z.array(z.string()),
    mainFlow: z.array(z.string()),
    requirements: z.array(z.string()),
    businessRules: z.array(z.string()).optional(),
    edgeCases: z.array(z.string()).optional(),
    acceptanceCriteria: z.array(z.string()).optional(),
  })),
  requirements: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  nonGoals: z.array(z.string()).optional(),
  technicalPreferences: z.object({
    frontend: z.string(),
    backend: z.string(),
    database: z.string(),
    realtime: z.string().optional(),
  }),
  implementationStrategy: z.enum(['frontend-first', 'module-first']).default('frontend-first'),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Task title is required'),
  description: z.string(),
  status: z.enum(['pending', 'in-progress', 'completed']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  featureId: z.string(),
  dependencies: z.array(z.string()).optional(),
  references: z.array(z.string()).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
