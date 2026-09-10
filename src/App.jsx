import { useState } from "react";
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

// This component only does two jobs:
// 1. Keep track of which tab is active (`view`)
// 2. Render the layout (sidebar + header) and drop the right view inside it
function Dashboard() {
  const [view, setView] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const views = {
    overview: <Overview go={setView} />,
    expeditions: <Expedition />,
    personnel: <Personnel />,
    cargo: <Cargo />,
    inventory: <Inventory />,
    emergency: <Emergency />,
  };

  return (
    <div
      className="min-h-screen w-full flex transition-colors duration-200"
      style={{ background: colors.bg, ...font }}
    >
      <Sidebar
        view={view}
        setView={setView}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-7">{views[view]}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Dashboard />
    </ThemeProvider>
  );
}
