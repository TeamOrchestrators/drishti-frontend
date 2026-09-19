import { Boxes, Compass, Package, TriangleAlert, Users, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useExpeditionStore } from "../../store/useExpeditionStore.js";
import { usePersonnelStore } from "../../store/usePersonnelStore.js";
import { useCargoStore } from "../../store/useCargoStore.js";
import { useInventoryStore, selectInventoryAlertCount } from "../../store/useInventoryStore.js";
import { useEmergencyStore } from "../../store/useEmergencyStore.js";
import { colors } from "../../theme.js";
import drishtiLogo from "../../assets/logo.png";

const Sidebar = ({ mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const expeditionCount = useExpeditionStore((s) => s.expeditions.length);
  const personnelCount = usePersonnelStore((s) => s.totalPersonnel.length);
  const cargoCount = useCargoStore((s) => s.cargo.length);
  const inventoryAlertCount = useInventoryStore(selectInventoryAlertCount);
  const inventoryInitialized = useInventoryStore((s) => s.initialized);
  const fetchInventory = useInventoryStore((s) => s.fetchInventory);
  const emergencyAlertCount = useEmergencyStore((s) => s.activeCount);
  const fetchActiveEmergencies = useEmergencyStore((s) => s.fetchActive);

  useEffect(() => {
    if (!inventoryInitialized) {
      fetchInventory();
    }
  }, [inventoryInitialized, fetchInventory]);

  useEffect(() => {
    fetchActiveEmergencies();
    const interval = setInterval(fetchActiveEmergencies, 15000);
    return () => clearInterval(interval);
  }, [fetchActiveEmergencies]);

  const navigation = [
    { path: "/overview", label: "Overview", icon: Compass },
    { path: "/expeditions", label: "Expeditions", icon: Compass, badge: expeditionCount },
    { path: "/personnel", label: "Personnel", icon: Users, badge: personnelCount },
    { path: "/cargo", label: "Cargo & Logistics", icon: Package, badge: cargoCount },
    {
      path: "/inventory",
      label: "Inventory",
      icon: Boxes,
      alert: inventoryAlertCount > 0 ? inventoryAlertCount : undefined,
    },
    {
      path: "/emergency",
      label: "Emergency",
      icon: TriangleAlert,
      alert: emergencyAlertCount > 0 ? emergencyAlertCount : undefined,
    },
  ];

  const handleNavClick = (path) => {
    navigate(path);
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  const navList = (
    <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5 overflow-y-auto">
      {navigation.map((n) => {
        const active =
          n.path === "/overview"
            ? location.pathname === "/" || location.pathname === "/overview"
            : location.pathname.startsWith(n.path);

        return (
          <button
            key={n.path}
            onClick={() => handleNavClick(n.path)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-left transition-colors cursor-pointer"
            style={{
              background: active ? colors.panelAlt : "transparent",
              color: active ? colors.text : colors.textMuted,
            }}
          >
            <n.icon size={16} color={active ? colors.ice : colors.textFaint} strokeWidth={1.75} />
            <span className="flex-1">{n.label}</span>
            {n.badge !== undefined && n.badge !== null && (
              <span className="text-xs" style={{ color: colors.textFaint, fontFamily: "monospace" }}>
                {n.badge}
              </span>
            )}
            {Boolean(n.alert) && (
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
        <div>
          <img className="w-40 h-auto" src={drishtiLogo} alt="Drishti logo" />
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
