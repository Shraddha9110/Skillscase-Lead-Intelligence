import { loadRawLeads } from "@/lib/load";
import { runPipeline } from "@/lib/pipeline";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  const result = await runPipeline(loadRawLeads(), {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL,
    baseUrl: process.env.OPENAI_BASE_URL
  });
  return NextResponse.json(result);
}

export async function GET() {
  return POST();
}
