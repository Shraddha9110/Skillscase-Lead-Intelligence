import { runDeskPipeline } from "@/lib/runDesk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  try {
    const result = await runDeskPipeline();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
