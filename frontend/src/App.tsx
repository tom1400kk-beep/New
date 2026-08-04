import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
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

function Shell() {
  const { activeSaveId } = useSave();
  const location = useLocation();
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    if (!activeSaveId) {
      setHasTeam(false);
      return;
    }
    api.getDashboard(activeSaveId).then((d) => setHasTeam(!!d.team));
  }, [activeSaveId, location.pathname]);

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">🏀 Coach Sim</div>
        <NavLink to="/" end>
          Saves
        </NavLink>
        {activeSaveId && <NavLink to="/dashboard">Dashboard</NavLink>}
        {activeSaveId && hasTeam && (
          <>
            <NavLink to="/contract">Contract</NavLink>
            <NavLink to="/roster">Roster</NavLink>
            <NavLink to="/schedule">Schedule</NavLink>
            <NavLink to="/edit-schedule">Edit Schedule</NavLink>
            <NavLink to="/standings">Standings</NavLink>
            <NavLink to="/recruiting">Recruiting</NavLink>
            <NavLink to="/transfers">Transfers</NavLink>
          </>
        )}
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<SaveSelectPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/contract" element={<ContractPage />} />
          <Route path="/roster" element={<RosterPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/edit-schedule" element={<EditSchedulePage />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/recruiting" element={<RecruitingPage />} />
          <Route path="/transfers" element={<TransfersPage />} />
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
