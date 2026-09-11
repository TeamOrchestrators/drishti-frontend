import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet } from "react-router-dom";
import { colors, font } from "./theme";
import { ThemeProvider } from "./context/ThemeContext";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Overview from "./components/pages/Overview";
import Expedition from "./components/pages/Expedition";
import Personnel from "./components/pages/Personnel";
import Cargo from "./components/pages/Cargo";
import Inventory from "./components/pages/Inventory";
import Emergency from "./components/pages/Emergency";
import EmergencyDeviceSimulator from "./components/pages/EmergencyDeviceSimulator";

function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className="min-h-screen w-full flex transition-colors duration-200"
      style={{ background: colors.bg, ...font }}
    >
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function OverviewRoute() {
  const navigate = useNavigate();
  return <Overview go={(view) => navigate(`/${view}`)} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Routes>
          <Route path="/emergency/device/simulate" element={<EmergencyDeviceSimulator />} />
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewRoute />} />
            <Route path="/expeditions" element={<Expedition />} />
            <Route path="/personnel" element={<Personnel />} />
            <Route path="/cargo" element={<Cargo />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}
