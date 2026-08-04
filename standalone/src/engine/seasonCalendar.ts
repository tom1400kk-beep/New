import type { Division } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function prevPowerOfTwo(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

// Every postseason round in this game's simulation is played exactly one
// calendar day apart (see season/postseason.ts + season/advance.ts), so a
// single-elimination bracket's total length in days is just its round count.
function roundsFor(fieldSize: number): number {
  if (fieldSize <= 1) return 0;
  return Math.log2(prevPowerOfTwo(fieldSize));
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SeasonCalendarInput {
  seasonYear: number;
  division: Division;
  // Non-tournament (regular season) games for this division/season — null if
  // the schedule hasn't been generated yet for some reason.
  regularSeasonRange: DateRange | null;
  // Earliest PRESEASON_INVITATIONAL game date for this division/season, if any exist.
  preseasonEventsStart: Date | null;
  // Team count per conference in this division — used to estimate conference
  // tournament length (bracket rounds) before the brackets actually exist.
  conferenceTeamCounts: number[];
  // Total teams in the division — used to estimate the national tournament's
  // field size (capped at 64, mirroring selectTournamentField) before it exists.
  divisionTeamCount: number;
  // Actual CONFERENCE_TOURNAMENT game date range for this division/season, once
  // the brackets have been created (i.e. the season has reached that phase).
  confTourneyRange: DateRange | null;
  // Actual national-tournament (NCAA_TOURNAMENT / D2_NATIONAL / D3_NATIONAL) game
  // date range for this division/season, once the bracket has been created.
  nationalRange: DateRange | null;
}

export interface CalendarMilestone {
  key: string;
  label: string;
  date: Date;
  // True when this date is a computed estimate (the underlying bracket hasn't
  // been generated yet) rather than read from an actual generated game/tournament.
  estimated: boolean;
}

const NATIONAL_TOURNAMENT_LABEL: Record<Division, string> = {
  D1: "NCAA Tournament",
  D2: "D2 National Tournament",
  D3: "D3 National Tournament",
};

export function buildSeasonCalendar(input: SeasonCalendarInput): CalendarMilestone[] {
  const {
    seasonYear, division, regularSeasonRange, preseasonEventsStart,
    conferenceTeamCounts, divisionTeamCount, confTourneyRange, nationalRange,
  } = input;

  const milestones: CalendarMilestone[] = [];

  // Fixed anchor: the offseason always resets the calendar to Oct 1 for the
  // upcoming season (see season/offseason.ts and seed/createSaveWorld.ts).
  milestones.push({ key: "PRESEASON_BEGINS", label: "Preseason Begins", date: new Date(Date.UTC(seasonYear, 9, 1)), estimated: false });

  if (preseasonEventsStart) {
    milestones.push({ key: "PRESEASON_EVENTS_BEGIN", label: "Preseason Events Begin", date: preseasonEventsStart, estimated: false });
  }

  if (regularSeasonRange) {
    milestones.push({ key: "REGULAR_SEASON_BEGINS", label: "Regular Season Begins", date: regularSeasonRange.start, estimated: false });
    milestones.push({ key: "REGULAR_SEASON_ENDS", label: "Regular Season Ends", date: regularSeasonRange.end, estimated: false });

    let confStart: Date;
    let confEnd: Date;
    if (confTourneyRange) {
      confStart = confTourneyRange.start;
      confEnd = confTourneyRange.end;
    } else {
      // Conference tournaments start the day after the regular season ends,
      // and every field is capped at 16 teams (see season/postseason.ts) —
      // the slowest (largest) bracket determines when they're all complete.
      confStart = addDays(regularSeasonRange.end, 1);
      const maxRounds = conferenceTeamCounts.length > 0
        ? Math.max(...conferenceTeamCounts.map((n) => roundsFor(Math.min(n, 16))))
        : 0;
      confEnd = addDays(confStart, Math.max(0, maxRounds - 1));
    }
    milestones.push({ key: "CONF_TOURNEY_BEGINS", label: "Conference Tournaments Begin", date: confStart, estimated: !confTourneyRange });
    milestones.push({ key: "CONF_TOURNEY_ENDS", label: "Conference Championships", date: confEnd, estimated: !confTourneyRange });

    const nationalLabel = NATIONAL_TOURNAMENT_LABEL[division];
    let natStart: Date;
    let natEnd: Date;
    if (nationalRange) {
      natStart = nationalRange.start;
      natEnd = nationalRange.end;
    } else {
      // National tournament starts 2 days after conference tournaments wrap
      // (see season/advance.ts), with a field capped at 64 teams.
      natStart = addDays(confEnd, 2);
      const rounds = Math.max(1, roundsFor(Math.min(divisionTeamCount, 64)));
      natEnd = addDays(natStart, rounds - 1);
    }
    milestones.push({ key: "NATIONAL_TOURNEY_BEGINS", label: `${nationalLabel} Begins`, date: natStart, estimated: !nationalRange });
    milestones.push({ key: "NATIONAL_CHAMPIONSHIP", label: "National Championship", date: natEnd, estimated: !nationalRange });
  }

  milestones.push({ key: "NEXT_PRESEASON_BEGINS", label: "Next Preseason Begins", date: new Date(Date.UTC(seasonYear + 1, 9, 1)), estimated: false });

  return milestones.sort((a, b) => a.date.getTime() - b.date.getTime());
}
