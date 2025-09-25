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
    return Response.json({ error: err?.message ?? "Failed to save" }, { status: 400 });
  }
}



