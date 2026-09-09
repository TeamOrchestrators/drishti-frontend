import { useState } from "react";
import { colors, font } from "./theme";
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
export default function App() {
  const [view, setView] = useState("overview");

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
      className="min-h-screen w-full flex"
      style={{ background: colors.bg, ...font }}
    >
      <Sidebar view={view} setView={setView} />
      <main className="flex-1 flex flex-col min-w-0">
        <Header />
        <div className="flex-1 overflow-auto p-7">{views[view]}</div>
      </main>
    </div>
  );
}
