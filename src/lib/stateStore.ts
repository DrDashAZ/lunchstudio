import { promises as fs } from "fs";
import path from "path";

export type Restaurant = {
  id: string;
  name: string;
  blacklisted: boolean;
  lastSelectedDate?: number;
};

export type ServerState = {
  restaurants: Restaurant[];
  cooldownWeeks: number;
  activatedBy?: string; // Session ID of who activated
};

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

export async function readServerState(): Promise<ServerState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (err: any) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      // Return defaults when file does not exist yet
      return { restaurants: [], cooldownWeeks: 2 };
    }
    throw err;
  }
}

export async function writeServerState(state: ServerState): Promise<void> {
  const normalized = normalizeState(state);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(normalized, null, 2), "utf8");
}

function normalizeState(input: any): ServerState {
  const restaurants: Restaurant[] = Array.isArray(input?.restaurants)
    ? input.restaurants
        .filter((r: any) => r && typeof r.id === "string" && typeof r.name === "string")
        .map((r: any) => ({
          id: String(r.id),
          name: String(r.name),
          blacklisted: Boolean(r.blacklisted),
          lastSelectedDate: typeof r.lastSelectedDate === "number" ? r.lastSelectedDate : undefined,
        }))
    : [];

  const cooldownWeeksNumber = Number(input?.cooldownWeeks);
  const cooldownWeeks = Number.isFinite(cooldownWeeksNumber) && cooldownWeeksNumber > 0 ? cooldownWeeksNumber : 2;

  const activatedBy = typeof input?.activatedBy === "string" ? input.activatedBy : undefined;

  return { restaurants, cooldownWeeks, activatedBy };
}



