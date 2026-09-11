import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { z } from 'zod';

const clarifySchema = z.object({
  idea: z.string().min(10),
  analysis: z.any()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = clarifySchema.parse(body);

    const questions = await aiService.generateClarificationQuestions(
      validated.idea,
      validated.analysis
    );

    return NextResponse.json({ questions });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Clarification error:', error);
    return NextResponse.json({ error: 'Failed to generate clarification questions' }, { status: 500 });
  }
}
