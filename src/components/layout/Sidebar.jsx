import {Boxes, Compass, Snowflake, TriangleAlert, Truck, Users} from "lucide-react";
import mockExpeditions from "../../data/mockExpeditions.js";
import {mockPersonnels} from "../../data/mockPersonnels.js";
import {colors} from "../../theme.js";


const Navigation = [
  {key: "overview", label: "Overview", icon: Compass},
  {key: "expeditions", label: "Expeditions", icon: Compass, badge: mockExpeditions.length},
  {key: "personnel", label: "Personnel", icon: Users, badge: mockPersonnels.length},
  {key: "cargo", label: "Cargo & Logistics", icon: Truck},
  {key: "inventory", label: "Inventory", icon: Boxes, alert: 2},
  {key: "emergency", label: "Emergency", icon: TriangleAlert, alert: 1},
]

const Sidebar = ({view, setView}) => {
  return (
    <aside className="w-60 flex-shrink-0 flex flex-col" style={{borderRight: `1px solid ${colors.border}`}}>
      <div className="px-5 py-5 flex items-center gap-2.5" style={{borderBottom: `1px solid ${colors.borderSoft}`}}>
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{background: "rgba(99,196,214,0.12)", border: `1px solid ${colors.iceDim}`}}
        >
          <Snowflake size={16} color={colors.ice}/>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{color: colors.text}}>DRISHTI</div>
          <div className="text-xs wrap" style={{color: colors.textFaint}}>Data Reporting & Intelligent Surveillance for High-impact Tracking Interface</div>
        </div>
      </div>

      <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5">
        {Navigation.map((n) => {
          const active = view === n.key;
          return (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-left transition-colors"
              style={{
                background: active ? colors.panelAlt : "transparent",
                color: active ? colors.text : colors.textMuted
              }}
            >
              <n.icon size={16} color={active ? colors.ice : colors.textFaint} strokeWidth={1.75}/>
              <span className="flex-1">{n.label}</span>
              {n.badge &&
                <span className="text-xs" style={{color: colors.textFaint, fontFamily: "monospace"}}>{n.badge}</span>}
              {n.alert && (
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold"
                  style={{background: colors.flare, color: "#fff"}}
                >
                  {n.alert}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/*<div className="px-5 py-4 flex flex-col gap-1.5" style={{borderTop: `1px solid ${colors.borderSoft}`}}>*/}
      {/*  <div className="flex items-center justify-between text-xs">*/}
      {/*    <span style={{color: colors.textFaint}}>Satellite link</span>*/}
      {/*    <span style={{color: colors.aurora}}>99.8%</span>*/}
      {/*  </div>*/}
      {/*  <div className="flex items-center justify-between text-xs">*/}
      {/*    <span style={{color: colors.textFaint}}>Power grid</span>*/}
      {/*    <span style={{color: colors.aurora}}>Normal</span>*/}
      {/*  </div>*/}
      {/*</div>*/}
    </aside>

  )
}

export default Sidebar;