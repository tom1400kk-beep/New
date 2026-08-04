import { Router } from "express";
import { prisma } from "../db";
import { clamp } from "../engine/rng";
import { parseAdRelationships, adRelationshipScore } from "../engine/athleticDirector";
import type { EventEffects, EventOption } from "../engine/events";

export const eventsRouter = Router();

eventsRouter.get("/saves/:id/events/pending", async (req, res) => {
  const events = await prisma.gameEvent.findMany({ where: { saveGameId: req.params.id, status: "PENDING" }, orderBy: { date: "desc" } });
  res.json(events.map((e) => ({ ...e, options: JSON.parse(e.optionsJson) as EventOption[] })));
});

eventsRouter.post("/saves/:id/events/:eventId/resolve", async (req, res) => {
  const event = await prisma.gameEvent.findUniqueOrThrow({ where: { id: req.params.eventId } });
  const options = JSON.parse(event.optionsJson) as EventOption[];
  const chosen = options.find((o) => o.id === req.body.optionId);
  if (!chosen) return res.status(400).json({ error: "Invalid option" });

  await applyEffects(event.saveGameId, event.teamId, event.playerId, chosen.effects);

  await prisma.gameEvent.update({ where: { id: event.id }, data: { status: "RESOLVED", chosenOptionId: chosen.id } });
  res.json({ resolved: true });
});

async function applyEffects(saveGameId: string, teamId: string | null, playerId: string | null, effects: EventEffects) {
  let sourceTeamName: string | null = null;
  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, include: { headCoach: true, athleticDirector: true } });
    if (team) {
      sourceTeamName = team.name;
      if (effects.prestigeDelta) {
        await prisma.team.update({ where: { id: team.id }, data: { prestige: Math.round(clamp(team.prestige + effects.prestigeDelta, 5, 99)) } });
      }
      if (effects.nilBudgetDelta) {
        await prisma.team.update({ where: { id: team.id }, data: { nilBudget: Math.max(0, team.nilBudget + effects.nilBudgetDelta) } });
      }
      if (effects.hotSeatDelta && team.headCoach) {
        await prisma.coach.update({ where: { id: team.headCoach.id }, data: { hotSeatLevel: Math.round(clamp(team.headCoach.hotSeatLevel + effects.hotSeatDelta, 0, 100)) } });
      }
      if (effects.legalityDelta && team.headCoach) {
        await prisma.coach.update({
          where: { id: team.headCoach.id },
          data: { legalityReputation: Math.round(clamp(team.headCoach.legalityReputation + effects.legalityDelta, 5, 99)) },
        });
      }
      if (effects.teamPerceptionDelta && team.headCoach) {
        await prisma.coach.update({
          where: { id: team.headCoach.id },
          data: { teamPerception: Math.round(clamp(team.headCoach.teamPerception + effects.teamPerceptionDelta, 1, 100)) },
        });
      }
      if (effects.nationalPerceptionDelta && team.headCoach) {
        await prisma.coach.update({
          where: { id: team.headCoach.id },
          data: { nationalPerception: Math.round(clamp(team.headCoach.nationalPerception + effects.nationalPerceptionDelta, 1, 100)) },
        });
      }
      if (effects.localPerceptionDelta && team.headCoach) {
        await prisma.coach.update({
          where: { id: team.headCoach.id },
          data: { localPerception: Math.round(clamp(team.headCoach.localPerception + effects.localPerceptionDelta, 1, 100)) },
        });
      }
      if (effects.adRelationshipDelta && team.headCoach && team.athleticDirector) {
        const relationships = parseAdRelationships(team.headCoach.adRelationshipsJson);
        const current = adRelationshipScore(relationships, team.athleticDirector.id);
        const updated = { ...relationships, [team.athleticDirector.id]: Math.round(clamp(current + effects.adRelationshipDelta, 5, 99)) };
        await prisma.coach.update({ where: { id: team.headCoach.id }, data: { adRelationshipsJson: JSON.stringify(updated) } });
      }
      if (effects.chemistryDelta) {
        const roster = await prisma.player.findMany({ where: { teamId: team.id } });
        for (const p of roster) {
          await prisma.player.update({
            where: { id: p.id },
            data: { characterRating: Math.round(clamp(p.characterRating + effects.chemistryDelta!, 5, 99)) },
          });
        }
      }
    }
  }

  if (playerId) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (player) {
      const data: Record<string, unknown> = {};
      if (effects.playerCharacterDelta) data.characterRating = Math.round(clamp(player.characterRating + effects.playerCharacterDelta, 5, 99));
      if (effects.injuryWeeks) {
        data.isInjured = true;
        data.injuryWeeksLeft = effects.injuryWeeks * 7;
      }
      if (effects.suspensionDays) {
        data.isSuspended = true;
        data.suspensionDaysLeft = effects.suspensionDays;
      }
      if (effects.transferToTeamId) {
        data.teamId = effects.transferToTeamId;
        data.previousSchool = sourceTeamName;
      } else if (effects.removePlayer) {
        data.teamId = null;
      }
      if (Object.keys(data).length > 0) {
        await prisma.player.update({ where: { id: player.id }, data });
      }
    }
  }
}
