import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { z } from 'zod';

const editSchema = z.object({
  content: z.string(),
  instruction: z.string()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = editSchema.parse(body);

    const result = await aiService.editSpecification(
      validated.content,
      validated.instruction
    );

    return NextResponse.json({ content: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Edit error:', error);
    return NextResponse.json({ error: 'Failed to edit specification' }, { status: 500 });
  }
}
