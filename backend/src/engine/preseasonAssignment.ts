import { PRESEASON_EVENTS } from "./preseasonEvents";

export interface PreseasonTeamCandidate {
  id: string;
  prestige: number;
}

// Fills every event's field from a shared pool of D1 teams, highest
// prestige first, MAJOR-tier events (Maui, Battle 4 Atlantis, ...) getting
// first pick — mirrors how real MTE invites skew toward blue-bloods and
// top-25 types for the glamour events, mid-majors for the smaller ones. A
// little jitter keeps the same programs from getting stuck in the same
// event every single season.
export function assignTeamsToPreseasonEvents(rng: () => number, d1Teams: PreseasonTeamCandidate[]): Map<string, string[]> {
  const jittered = d1Teams.map((t) => ({ id: t.id, score: t.prestige + (rng() - 0.5) * 12 }));
  jittered.sort((a, b) => b.score - a.score);

  const tierOrder: Record<string, number> = { MAJOR: 0, MID: 1, SMALL: 2 };
  const events = [...PRESEASON_EVENTS].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

  const assigned = new Set<string>();
  const fields = new Map<string, string[]>();
  let cursor = 0;
  for (const event of events) {
    const field: string[] = [];
    while (field.length < event.fieldSize && cursor < jittered.length) {
      const candidate = jittered[cursor];
      cursor++;
      if (assigned.has(candidate.id)) continue;
      assigned.add(candidate.id);
      field.push(candidate.id);
    }
    fields.set(event.key, field);
  }
  return fields;
}
