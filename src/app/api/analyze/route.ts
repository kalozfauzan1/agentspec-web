import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { z } from 'zod';

const analyzeSchema = z.object({
  idea: z.string().min(10, 'Idea must be at least 10 characters')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = analyzeSchema.parse(body);

    const analysis = await aiService.analyzeIdea(validated.idea);
    
    return NextResponse.json({ analysis });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze idea' }, { status: 500 });
  }
}
