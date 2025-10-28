import { NextRequest } from "next/server";
import { readServerState, writeServerState, type ServerState } from "@/lib/stateStore";

export async function GET() {
  const state = await readServerState();
  return Response.json(state, { status: 200 });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ServerState>;
    const current = await readServerState();
    const next: ServerState = {
      restaurants: Array.isArray(body.restaurants) ? body.restaurants : current.restaurants,
      cooldownWeeks: typeof body.cooldownWeeks === "number" ? body.cooldownWeeks : current.cooldownWeeks,
      activatedBy: typeof body.activatedBy === "string" ? body.activatedBy : current.activatedBy,
    };
    await writeServerState(next);
    return Response.json(next, { status: 200 });
  } catch (err: any) {
    console.error('API Error:', {
      error: err?.message,
      stack: err?.stack,
      cwd: process.cwd(),
      code: err?.code
    });
    return Response.json({
      error: err?.message ?? "Failed to save",
      type: err?.code || "UNKNOWN_ERROR",
      cwd: process.cwd()
    }, { status: 400 });
  }
}
