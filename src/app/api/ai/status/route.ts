import { NextResponse } from "next/server";
import { serverProviderStatus } from "@/lib/ai/provider";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(serverProviderStatus());
}
