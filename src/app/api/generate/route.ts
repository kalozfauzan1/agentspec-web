import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { z } from 'zod';

const generateSchema = z.object({
  idea: z.string(),
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
    type: z.enum(['radio', 'checkbox', 'text'])
  })).optional().default([]),
  analysis: z.any().optional(),
  strategy: z.enum(['frontend-first', 'module-first']).default('frontend-first')
});

// Helper for sequential API calls with retry
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 2000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === maxRetries - 1) throw error;
      // Check for rate limit errors
      const msg = error?.message || '';
      if (msg.includes('402') || msg.includes('503')) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Failed after retries');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = generateSchema.parse(body);

    // Build comprehensive project definition from idea, answers, and analysis
    const baseDefinition = {
      name: validated.idea.split(' ').slice(0, 5).join(' '),
      summary: validated.idea,
      platform: ['Web'],
      users: ['User', 'Admin'],
      roles: ['User', 'Admin'],
      implementationStrategy: validated.strategy
    };

    // Enrich with answers
    const answersMap = new Map<string, string>(validated.answers?.map(a => [a.questionId, a.answer]) || []);
    
    if (answersMap.has('users')) {
      baseDefinition.users = answersMap.get('users')?.split(', ') || baseDefinition.users;
    }
    if (answersMap.has('platform')) {
      const platformAnswer = answersMap.get('platform') || '';
      if (platformAnswer.includes('Mobile')) {
        baseDefinition.platform = ['Web', 'Mobile'];
      }
    }

    // Combine with analysis if available
    const fullDefinition = validated.analysis 
      ? { ...baseDefinition, ...validated.analysis }
      : baseDefinition;

    // Generate sequentially to avoid rate limiting
    const prd = await callWithRetry(() => aiService.generatePRD(fullDefinition));
    const features = await callWithRetry(() => aiService.generateFeatures(fullDefinition));
    const architecture = await callWithRetry(() => aiService.generateArchitecture(fullDefinition));
    const tasks = await callWithRetry(() => aiService.generateTasks(fullDefinition, features));
    const agentInstructions = await callWithRetry(() => aiService.generateAgentInstructions(fullDefinition, tasks));

    return NextResponse.json({
      projectDefinition: fullDefinition,
      prd,
      features,
      architecture,
      tasks,
      agentInstructions
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Generation error:', error);
    return NextResponse.json({ error: 'Failed to generate specifications' }, { status: 500 });
  }
}
