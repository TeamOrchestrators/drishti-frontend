import {
  ChevronRight,
  Compass,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react";
import { colors, mono } from "../../theme";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import Bar from "../ui/Bar";
import StatCard from "../ui/StatCard";
import mockEmergencies from "../../data/mockEmergencies.js";
import mockExpeditions from "../../data/mockExpeditions.js";
import { personnel, personnel_movements, getStationName } from "../../data/mockPersonnels.js";
import mockInventory from "../../data/mockInventory.js";
import { mockVoyage } from "../../data/mockCargo.js";

const Overview = ({ go }) => {
  const activeEmergency = mockEmergencies.find((e) => e.status === "Active");

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {activeEmergency && (
        <div
          className="rounded-lg px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
          style={{
            background: colors.flareBg,
            border: `1px solid ${colors.flareDim}`,
          }}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <TriangleAlert size={18} color={colors.flare} strokeWidth={2} className="flex-shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <span
                className="text-sm font-semibold"
                style={{ color: colors.flare }}
              >
                {activeEmergency.type}
              </span>
              <span className="text-xs sm:text-sm ml-2" style={{ color: colors.textMuted }}>
                {activeEmergency.location} · {activeEmergency.affected} people
                affected · {activeEmergency.when}
              </span>
            </div>
          </div>
          <button
            onClick={() => go("emergency")}
            className="text-sm font-medium px-3 py-1.5 rounded cursor-pointer self-start sm:self-auto flex-shrink-0"
            style={{
              color: colors.flare,
              background: colors.flareTint,
              border: `1px solid ${colors.flareDim}`,
            }}
          >
            View response
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Compass}
          label="Active expeditions"
          value="4"
          sub="38 people deployed"
          tone="ice"
        />
        <StatCard
          icon={Users}
          label="Personnel in motion"
          value={String(personnel_movements.filter((m) => m.status === "in_transit").length || personnel_movements.length)}
          sub={`of ${personnel.length} total station staff`}
          tone="aurora"
        />
        <StatCard
          icon={Truck}
          label="Cargo in transit"
          value="412.5"
          unit="/ 680 MT"
          sub="60.6% of capacity"
          tone="ice"
        />
        <StatCard
          icon={TriangleAlert}
          label="Open incidents"
          value="1"
          sub="1 active · 1 resolved"
          tone="flare"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Panel
            title="Active expeditions"
          >
            <div className="flex flex-col gap-4">
              {mockExpeditions.slice(0, 3).map((e) => (
                <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-0" style={{ borderBottom: `1px solid ${colors.borderSoft}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-medium"
                        style={{ color: colors.text }}
                      >
                        {e.name}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: colors.textFaint, ...mono }}
                      >
                        {e.id}
                      </span>
                    </div>
                    <span
                      className="text-xs block"
                      style={{ color: colors.textMuted }}
                    >
                      {e.route}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 justify-between sm:justify-start">
                    <div className="w-28 flex-1 sm:flex-none">
                      <Bar value={e.readiness} tone={e.tone} />
                    </div>
                    <Pill tone={e.tone}>{e.status}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel
          title="Personnel movement"
        >
          <div className="flex flex-col gap-3.5">
            {personnel_movements.slice(0, 4).map((m) => {
              const person = personnel.find((p) => p.id === m.personnel_id);
              const displayName = person ? (person.full_name || person.name) : (m.personnel_name || m.name);
              const fromStation = getStationName(m.origin_station_id) || m.from || "—";
              const toStation = getStationName(m.destination_station_id) || m.to || "—";
              const statusTone =
                m.status === "waiting_for_weather" || m.status === "Waiting for weather" || m.status === "planned"
                  ? "amber"
                  : m.status === "arrived_safely" || m.status === "Arrived safely"
                  ? "aurora"
                  : "ice";
              const statusLabel =
                m.status === "in_transit"
                  ? "In transit"
                  : m.status === "planned"
                  ? "Planned"
                  : m.status === "waiting_for_weather"
                  ? "Waiting for weather"
                  : m.status === "arrived_safely"
                  ? "Arrived safely"
                  : m.status;

              return (
                <div key={m.id || displayName} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: colors.text }}
                    >
                      {displayName}
                    </div>
                    <div className="text-xs truncate" style={{ color: colors.textMuted }}>
                      {fromStation} → {toStation}
                    </div>
                  </div>
                  <Pill tone={statusTone}>
                    {statusLabel}
                  </Pill>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel
          title="Critical inventory"
        >
          <div className="flex flex-col gap-4">
            {mockInventory
              .filter((i) => i.criticality === "Critical")
              .map((i) => (
                <div key={i.item}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-sm truncate" style={{ color: colors.text }}>
                      {i.item}
                    </span>
                    <span
                      className="text-sm flex-shrink-0"
                      style={{ color: colors.flare, ...mono }}
                    >
                      {i.current} / {i.min} {i.unit}
                    </span>
                  </div>
                  <Bar value={(i.current / i.min) * 100} tone="flare" />
                  <span className="text-xs mt-1 block" style={{ color: colors.textFaint }}>
                    {i.station}
                  </span>
                </div>
              ))}
          </div>
        </Panel>

        <Panel
          title="Supplies on the way"
        >
          <div className="flex flex-col gap-4">
            {mockVoyage.map((v) => (
              <div key={v.vessel} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: colors.text }}
                  >
                    {v.vessel}
                  </div>
                  <div className="text-xs truncate" style={{ color: colors.textMuted }}>
                    {v.route} · {v.cargo}
                  </div>
                </div>
                <Pill tone={v.status === "Grounded" ? "flare" : "ice"}>
                  {v.status === "Grounded" ? v.status : `ETA ${v.eta}`}
                </Pill>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default Overview;
