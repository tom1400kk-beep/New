const BASE = "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  listSaves: () => request<any[]>("/saves"),
  createSave: (data: {
    name: string; division: string; teamSchoolName: string; coachName: string;
    coachArchetype?: string; coachBackground?: string | null; playingCareer?: any;
  }) => request<any>("/saves", { method: "POST", body: JSON.stringify(data) }),
  deleteSave: (id: string) => request<void>(`/saves/${id}`, { method: "DELETE" }),

  listLeagueTeams: (division: string) => request<any[]>(`/league-teams?division=${division}`),
  getCoachOptions: () => request<any>("/coach-options"),
  getAllTeams: () => request<any[]>("/all-teams"),
  generateCoachOffers: (data: { coachArchetype: string; coachBackground: string | null; playingCareer: any }) =>
    request<any>("/coach-offers", { method: "POST", body: JSON.stringify(data) }),

  getDashboard: (saveId: string) => request<any>(`/saves/${saveId}/dashboard`),
  getRoster: (saveId: string) => request<any[]>(`/saves/${saveId}/roster`),
  getWalkOns: (saveId: string) => request<any>(`/saves/${saveId}/walkons`),
  addWalkOn: (saveId: string, candidateId: string) =>
    request<any>(`/saves/${saveId}/walkons/${candidateId}/add`, { method: "POST" }),
  getSchedule: (saveId: string) => request<any[]>(`/saves/${saveId}/schedule`),
  getStandings: (saveId: string) => request<any>(`/saves/${saveId}/standings`),
  getKenPom: (saveId: string) => request<any[]>(`/saves/${saveId}/kenpom`),
  getRPI: (saveId: string) => request<any[]>(`/saves/${saveId}/rpi`),
  getBracketology: (saveId: string) => request<any>(`/saves/${saveId}/bracketology`),
  getRivalries: (saveId: string) => request<any[]>(`/saves/${saveId}/rivalries`),
  advance: (saveId: string) => request<any>(`/saves/${saveId}/advance`, { method: "POST" }),

  getRecruitingBoard: (saveId: string) => request<any[]>(`/saves/${saveId}/recruiting`),
  pursueRecruit: (saveId: string, prospectId: string, points: number) =>
    request<any>(`/saves/${saveId}/recruiting/${prospectId}/pursue`, {
      method: "POST",
      body: JSON.stringify({ points }),
    }),

  getTransferBoard: (saveId: string) => request<any[]>(`/saves/${saveId}/transfers`),
  pursueTransfer: (saveId: string, playerId: string, points: number) =>
    request<any>(`/saves/${saveId}/transfers/${playerId}/pursue`, {
      method: "POST",
      body: JSON.stringify({ points }),
    }),

  getPreseasonTournaments: (saveId: string) => request<any>(`/saves/${saveId}/preseason-tournaments`),
  joinPreseasonTournament: (saveId: string, tournamentId: string) =>
    request<any>(`/saves/${saveId}/preseason-tournaments/${tournamentId}/join`, { method: "POST" }),
  leavePreseasonTournament: (saveId: string) =>
    request<any>(`/saves/${saveId}/preseason-tournaments/leave`, { method: "POST" }),

  getInternationalTour: (saveId: string) => request<any>(`/saves/${saveId}/international-tour`),
  bookInternationalTour: (saveId: string, country: string) =>
    request<any>(`/saves/${saveId}/international-tour`, { method: "POST", body: JSON.stringify({ country }) }),

  getPendingEvents: (saveId: string) => request<any[]>(`/saves/${saveId}/events/pending`),
  resolveEvent: (saveId: string, eventId: string, optionId: string) =>
    request<any>(`/saves/${saveId}/events/${eventId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ optionId }),
    }),

  getJobOffers: (saveId: string) => request<any[]>(`/saves/${saveId}/job-offers`),
  acceptJob: (saveId: string, teamId: string) =>
    request<any>(`/saves/${saveId}/accept-job`, { method: "POST", body: JSON.stringify({ teamId }) }),
  requestRaise: (saveId: string) => request<any>(`/saves/${saveId}/request-raise`, { method: "POST" }),
  resignAndAccept: (saveId: string, teamId: string) =>
    request<any>(`/saves/${saveId}/resign-and-accept`, { method: "POST", body: JSON.stringify({ teamId }) }),
  upgradeArena: (saveId: string) => request<any>(`/saves/${saveId}/upgrade-arena`, { method: "POST" }),
};
