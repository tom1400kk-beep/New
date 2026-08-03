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
    coachArchetype?: string; coachBackground?: string | null;
  }) => request<any>("/saves", { method: "POST", body: JSON.stringify(data) }),
  deleteSave: (id: string) => request<void>(`/saves/${id}`, { method: "DELETE" }),

  listLeagueTeams: (division: string) => request<any[]>(`/league-teams?division=${division}`),
  getCoachOptions: () => request<any>("/coach-options"),

  getDashboard: (saveId: string) => request<any>(`/saves/${saveId}/dashboard`),
  getRoster: (saveId: string) => request<any[]>(`/saves/${saveId}/roster`),
  getSchedule: (saveId: string) => request<any[]>(`/saves/${saveId}/schedule`),
  getStandings: (saveId: string) => request<any>(`/saves/${saveId}/standings`),
  advance: (saveId: string) => request<any>(`/saves/${saveId}/advance`, { method: "POST" }),

  getRecruitingBoard: (saveId: string) => request<any[]>(`/saves/${saveId}/recruiting`),
  pursueRecruit: (saveId: string, prospectId: string, points: number) =>
    request<any>(`/saves/${saveId}/recruiting/${prospectId}/pursue`, {
      method: "POST",
      body: JSON.stringify({ points }),
    }),

  getPendingEvents: (saveId: string) => request<any[]>(`/saves/${saveId}/events/pending`),
  resolveEvent: (saveId: string, eventId: string, optionId: string) =>
    request<any>(`/saves/${saveId}/events/${eventId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ optionId }),
    }),

  getJobOffers: (saveId: string) => request<any[]>(`/saves/${saveId}/job-offers`),
  acceptJob: (saveId: string, teamId: string) =>
    request<any>(`/saves/${saveId}/accept-job`, { method: "POST", body: JSON.stringify({ teamId }) }),
};
