import { Boxes, Compass, Snowflake, TriangleAlert, Truck, Users, X } from "lucide-react";
import mockExpeditions from "../../data/mockExpeditions.js";
import { personnel } from "../../data/mockPersonnels.js";
import { colors } from "../../theme.js";

const Navigation = [
  { key: "overview", label: "Overview", icon: Compass },
  { key: "expeditions", label: "Expeditions", icon: Compass, badge: mockExpeditions.length },
  { key: "personnel", label: "Personnel", icon: Users, badge: personnel.length },
  { key: "cargo", label: "Cargo & Logistics", icon: Truck },
  { key: "inventory", label: "Inventory", icon: Boxes, alert: 2 },
  { key: "emergency", label: "Emergency", icon: TriangleAlert, alert: 1 },
];

const Sidebar = ({ view, setView, mobileOpen, setMobileOpen }) => {
  const handleNavClick = (key) => {
    setView(key);
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  const navList = (
    <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5 overflow-y-auto">
      {Navigation.map((n) => {
        const active = view === n.key;
        return (
          <button
            key={n.key}
            onClick={() => handleNavClick(n.key)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-left transition-colors cursor-pointer"
            style={{
              background: active ? colors.panelAlt : "transparent",
              color: active ? colors.text : colors.textMuted,
            }}
          >
            <n.icon size={16} color={active ? colors.ice : colors.textFaint} strokeWidth={1.75} />
            <span className="flex-1">{n.label}</span>
            {n.badge && (
              <span className="text-xs" style={{ color: colors.textFaint, fontFamily: "monospace" }}>
                {n.badge}
              </span>
            )}
            {n.alert && (
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold"
                style={{ background: colors.flare, color: "#fff" }}
              >
                {n.alert}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const brandHeader = (showClose = false) => (
    <div
      className="px-5 py-5 flex items-center justify-between gap-2.5"
      style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/*<div*/}
        {/*  className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"*/}
        {/*  style={{ background: colors.iceBg, border: `1px solid ${colors.iceDim}` }}*/}
        {/*>*/}
        {/*  <Snowflake size={16} color={colors.ice} />*/}
        {/*</div>*/}
        <div>
          <img class="w-40 h-auto" src={"src/assets/Black and White Modern Corporate Letter D Logo.png"}/>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-wide" style={{ color: colors.text }}>DRISHTI</div>
          <div className="text-xs wrap" style={{ color: colors.textFaint }}>
            Data Reporting & Intelligent Surveillance for High-impact Tracking Interface
          </div>
        </div>
      </div>
      {showClose && (
        <button
          onClick={() => setMobileOpen(false)}
          className="p-1.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
          style={{ color: colors.textMuted }}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className="hidden md:flex w-60 flex-shrink-0 flex-col h-screen sticky top-0"
        style={{ borderRight: `1px solid ${colors.border}`, background: colors.panel }}
      >
        {brandHeader(false)}
        {navList}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer content */}
          <div
            className="relative w-64 max-w-[85vw] h-full flex flex-col z-10 shadow-2xl transition-transform"
            style={{
              background: colors.panel,
              borderRight: `1px solid ${colors.border}`,
            }}
          >
            {brandHeader(true)}
            {navList}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;