import express from "express";
import cors from "cors";
import { savesRouter } from "./routes/saves";
import { teamRouter } from "./routes/team";
import { recruitingRouter } from "./routes/recruiting";
import { transfersRouter } from "./routes/transfers";
import { eventsRouter } from "./routes/events";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", savesRouter);
app.use("/api", teamRouter);
app.use("/api", recruitingRouter);
app.use("/api", transfersRouter);
app.use("/api", eventsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Coach Sim backend listening on :${port}`);
});
