import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet, useLocation } from "react-router-dom";
import { colors, font } from "./theme";
import { ThemeProvider } from "./context/ThemeContext";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Overview from "./components/pages/Overview";
import Expedition from "./components/pages/Expedition";
import Personnel from "./components/pages/Personnel";
import Cargo from "./components/pages/Cargo";
import CargoScan from "./components/pages/CargoScan";
import Inventory from "./components/pages/Inventory";
import Emergency from "./components/pages/Emergency";
import EmergencyDeviceSimulator from "./components/pages/EmergencyDeviceSimulator";

function PageTitleHandler() {
  const location = useLocation();

  useEffect(() => {
    const routeTitles = {
      "/": "Overview",
      "/overview": "Overview",
      "/expeditions": "Expeditions",
      "/personnel": "Personnel",
      "/cargo": "Cargo & Logistics",
      "/cargo/scan": "Cargo QR Scanner",
      "/inventory": "Inventory",
      "/emergency": "Emergency",
      "/emergency/device/simulate": "Emergency Device Simulator",
    };

    const pathname = location.pathname;
    let pageName = routeTitles[pathname];

    if (!pageName) {
      if (pathname.startsWith("/cargo/scan")) pageName = "Cargo QR Scanner";
      else if (pathname.startsWith("/expeditions")) pageName = "Expeditions";
      else if (pathname.startsWith("/personnel")) pageName = "Personnel";
      else if (pathname.startsWith("/cargo")) pageName = "Cargo & Logistics";
      else if (pathname.startsWith("/inventory")) pageName = "Inventory";
      else if (pathname.startsWith("/emergency/device/simulate")) pageName = "Emergency Device Simulator";
      else if (pathname.startsWith("/emergency")) pageName = "Emergency";
      else pageName = "Operations";
    }

    document.title = `Drishti - ${pageName}`;
  }, [location.pathname]);

  return null;
}

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
      <PageTitleHandler />
      <ThemeProvider>
        <Routes>
          <Route path="/emergency/device/simulate" element={<EmergencyDeviceSimulator />} />
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewRoute />} />
            <Route path="/expeditions" element={<Expedition />} />
            <Route path="/personnel" element={<Personnel />} />
            <Route path="/cargo" element={<Cargo />} />
            <Route path="/cargo/scan" element={<CargoScan/>}/>
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}

