import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

const TABLE_NAME = 'lunch_roulette_state';

export async function readServerState(): Promise<ServerState> {
  try {
    const { data } = await supabase
      .from(TABLE_NAME)
      .select('state')
      .single();

    if (data?.state) {
      return normalizeState(JSON.parse(data.state));
    }

    return { restaurants: [], cooldownWeeks: 2 };
  } catch (err: any) {
    console.error('Supabase read error:', err);
    return { restaurants: [], cooldownWeeks: 2 };
  }
}

export async function writeServerState(state: ServerState): Promise<void> {
  const normalized = normalizeState(state);

  try {
    await supabase
      .from(TABLE_NAME)
      .upsert({
        id: 1,
        state: JSON.stringify(normalized),
        updated_at: new Date().toISOString()
      });
  } catch (err: any) {
    console.error('Supabase write error:', err);
    throw new Error(`Database write failed: ${err.message || 'Unknown error'}`);
  }
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
