import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AiError, resolveProvider } from "@/lib/ai/provider";
import { runStep, STEP_KEYS, stepRequestSchema, type StepKey } from "@/lib/ai/steps";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ step: string }> },
) {
  const { step } = await context.params;

  if (!(STEP_KEYS as readonly string[]).includes(step)) {
    return NextResponse.json(
      { error: `Step "${step}" tidak dikenal.`, code: "unknown-step" },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body request bukan JSON yang valid.", code: "invalid-body" },
      { status: 400 },
    );
  }

  try {
    const parsed = stepRequestSchema.parse(body);
    const provider = resolveProvider(request.headers, parsed.mode);
    const result = await runStep(step as StepKey, parsed, provider);

    return NextResponse.json({
      step: result.step,
      warnings: result.warnings,
      ...(result.payload as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Request tidak sesuai skema.",
          code: "invalid-request",
          details: error.issues.slice(0, 5).map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    if (error instanceof AiError) {
      console.warn(`[agentspec] step ${step} failed (${error.code}): ${error.message}`);
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.httpStatus },
      );
    }

    console.error(`[agentspec] step ${step} failed`, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.",
        code: "internal-error",
      },
      { status: 500 },
    );
  }
}
