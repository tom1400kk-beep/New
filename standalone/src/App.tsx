import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { SaveProvider, useSave } from "./SaveContext";
import { api } from "./api";
import SaveSelectPage from "./pages/SaveSelectPage";
import DashboardPage from "./pages/DashboardPage";
import RosterPage from "./pages/RosterPage";
import SchedulePage from "./pages/SchedulePage";
import EditSchedulePage from "./pages/EditSchedulePage";
import RecruitingPage from "./pages/RecruitingPage";
import TransfersPage from "./pages/TransfersPage";
import StandingsPage from "./pages/StandingsPage";
import ContractPage from "./pages/ContractPage";
import CalendarPage from "./pages/CalendarPage";
import HotSeatPage from "./pages/HotSeatPage";
import StatsPage from "./pages/StatsPage";
import DepthChartPage from "./pages/DepthChartPage";
import AwardsPage from "./pages/AwardsPage";
import PracticePage from "./pages/PracticePage";

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const PHASE_LABELS: Record<string, string> = {
  PRESEASON: "Preseason",
  REGULAR_SEASON: "Regular Season",
  CONFERENCE_TOURNAMENT: "Conference Tournament",
  NCAA_TOURNAMENT: "NCAA Tournament",
  NIT: "NIT",
  OFFSEASON: "Offseason",
};

function Shell() {
  const { activeSaveId, setActiveSaveId } = useSave();
  const location = useLocation();
  const [hasTeam, setHasTeam] = useState(false);
  const [isPreseason, setIsPreseason] = useState(false);
  const [saveDate, setSaveDate] = useState<{ currentDate: string | Date; currentSeasonYear: number; currentPhase: string } | null>(null);

  useEffect(() => {
    if (!activeSaveId) {
      setHasTeam(false);
      setIsPreseason(false);
      setSaveDate(null);
      return;
    }
    api.getDashboard(activeSaveId).then((d) => {
      setHasTeam(!!d.team);
      setIsPreseason(d.save?.currentPhase === "PRESEASON");
      if (d.save) {
        setSaveDate({ currentDate: d.save.currentDate, currentSeasonYear: d.save.currentSeasonYear, currentPhase: d.save.currentPhase });
      }
    }).catch(() => {
      // activeSaveId points at a save that no longer exists (e.g. deleted
      // from another tab, or leftover from a previous browser session) —
      // clear it instead of leaving every page stuck trying to load it.
      setHasTeam(false);
      setIsPreseason(false);
      setSaveDate(null);
      setActiveSaveId(null);
    });
  }, [activeSaveId, location.pathname]);

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">🏀 Coach Sim</div>
        {saveDate && (
          <div className="text-muted" style={{ fontSize: "0.8rem", padding: "0 4px 12px", lineHeight: 1.4 }}>
            <div>{fmtDate(saveDate.currentDate)}</div>
            <div>{PHASE_LABELS[saveDate.currentPhase] ?? saveDate.currentPhase} · {saveDate.currentSeasonYear}–{saveDate.currentSeasonYear + 1}</div>
          </div>
        )}
        <NavLink to="/" end>
          Saves
        </NavLink>
        {activeSaveId && <NavLink to="/dashboard">Dashboard</NavLink>}
        {activeSaveId && hasTeam && (
          <>
            <NavLink to="/contract">Contract</NavLink>
            <NavLink to="/roster">Roster</NavLink>
            <NavLink to="/depth-chart">Depth Chart</NavLink>
            <NavLink to="/practice">Practice</NavLink>
            <NavLink to="/schedule">Schedule</NavLink>
            {isPreseason && <NavLink to="/edit-schedule">Edit Schedule</NavLink>}
            <NavLink to="/standings">Standings</NavLink>
            <NavLink to="/stats">Stat Leaders</NavLink>
            <NavLink to="/awards">Awards</NavLink>
            <NavLink to="/recruiting">Recruiting</NavLink>
            <NavLink to="/transfers">Transfers</NavLink>
            <NavLink to="/calendar">Calendar</NavLink>
            <NavLink to="/hot-seat">Hot Seat</NavLink>
          </>
        )}
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<SaveSelectPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/contract" element={<ContractPage />} />
          <Route path="/roster" element={<RosterPage />} />
          <Route path="/depth-chart" element={<DepthChartPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/awards" element={<AwardsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/edit-schedule" element={<EditSchedulePage />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/recruiting" element={<RecruitingPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/hot-seat" element={<HotSeatPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SaveProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </SaveProvider>
  );
}
