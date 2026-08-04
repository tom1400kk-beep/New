import express from "express";
import cors from "cors";
import { savesRouter } from "./routes/saves";
import { teamRouter } from "./routes/team";
import { recruitingRouter } from "./routes/recruiting";
import { transfersRouter } from "./routes/transfers";
import { eventsRouter } from "./routes/events";
import { preseasonTournamentsRouter } from "./routes/preseasonTournaments";
import { rankingsRouter } from "./routes/rankings";
import { internationalTourRouter } from "./routes/internationalTour";
import { gamePreviewRouter } from "./routes/gamePreview";
import { coachStatsRouter } from "./routes/coachStats";
import { calendarRouter } from "./routes/calendar";
import { hotSeatRouter } from "./routes/hotSeat";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", savesRouter);
app.use("/api", teamRouter);
app.use("/api", recruitingRouter);
app.use("/api", transfersRouter);
app.use("/api", eventsRouter);
app.use("/api", preseasonTournamentsRouter);
app.use("/api", rankingsRouter);
app.use("/api", internationalTourRouter);
app.use("/api", gamePreviewRouter);
app.use("/api", coachStatsRouter);
app.use("/api", calendarRouter);
app.use("/api", hotSeatRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Coach Sim backend listening on :${port}`);
});
