import { Router } from "express";
import { prisma } from "../db";
import { overall, type SimPlayer } from "../engine/simulate";
import { parseDepthChart, serializeDepthChart, type DepthChart } from "../engine/depthChart";

export const depthChartRouter = Router();

// Only the user's own team ever gets a manual depth chart — AI teams always
// auto-select (see buildRotation), so this always operates on save.coachTeamId
// rather than taking a teamId param.
async function buildPayload(saveId: string) {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: saveId } });
  if (!save.coachTeamId) return null;
  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId } });
  const players = await prisma.player.findMany({ where: { teamId: team.id } });
  const chart = parseDepthChart(team.depthChartJson);
  const roster = players.map((p) => ({
    playerId: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, classYear: p.classYear,
    overall: Math.round(overall(p as unknown as SimPlayer)),
    isInjured: p.isInjured, isSuspended: p.isSuspended,
  }));
  return { chart, roster };
}

depthChartRouter.get("/saves/:id/depth-chart", async (req, res) => {
  const result = await buildPayload(req.params.id);
  if (!result) return res.status(400).json({ error: "No team for this save" });
  res.json(result);
});

depthChartRouter.post("/saves/:id/depth-chart", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No team for this save" });

  const body = req.body as Partial<DepthChart>;
  const chart: DepthChart = {
    pg: typeof body.pg === "string" ? body.pg : null,
    sg: typeof body.sg === "string" ? body.sg : null,
    sf: typeof body.sf === "string" ? body.sf : null,
    pf: typeof body.pf === "string" ? body.pf : null,
    c: typeof body.c === "string" ? body.c : null,
    bench: Array.isArray(body.bench) ? body.bench.filter((x): x is string => typeof x === "string") : [],
  };
  await prisma.team.update({ where: { id: save.coachTeamId }, data: { depthChartJson: serializeDepthChart(chart) } });

  const result = await buildPayload(req.params.id);
  res.json(result);
});
