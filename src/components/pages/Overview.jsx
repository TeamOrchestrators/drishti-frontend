import {
  Compass,
  Package,
  TriangleAlert,
  Users,
} from "lucide-react";
import { colors, mono } from "../../theme";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import Bar from "../ui/Bar";
import StatCard from "../ui/StatCard";
import SectionHeading from "../ui/SectionHeading";
import { OverviewSkeleton } from "../ui/Skeleton";
import { useNavigate } from "react-router-dom";
import { useExpeditionStore } from "../../store/useExpeditionStore.js";
import { usePersonnelStore } from "../../store/usePersonnelStore.js";
import { useCargoStore } from "../../store/useCargoStore.js";
import { useInventoryStore } from "../../store/useInventoryStore.js";
import { useState, useEffect, useCallback } from "react";
import { emergencyApi } from "../../services/api.js";
import { formatCoordinates } from "../../utils/geo";

const Overview = ({ go }) => {
  const navigate = useNavigate();
  const navigateTo = (view) => {
    if (go) go(view);
    else navigate(`/${view}`);
  };

  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [emergenciesLoading, setEmergenciesLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchActive() {
      try {
        const data = await emergencyApi.getActive();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.emergencies)
          ? data.emergencies
          : [];
        if (isMounted) {
          setActiveEmergencies(list);
        }
      } catch (err) {
        console.warn("Failed to fetch active emergencies:", err);
      } finally {
        if (isMounted) {
          setEmergenciesLoading(false);
        }
      }
    }

    fetchActive();
    const interval = setInterval(fetchActive, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const activeEmergenciesCount = activeEmergencies.length;
  const newestActiveEmergency = activeEmergencies.length > 0 ? activeEmergencies[0] : null;

  const {
    expeditions,
    stations,
    loading: expeditionsLoading,
    initialized: expeditionsInitialized,
    fetchExpeditions,
  } = useExpeditionStore();

  const {
    movingPersonnel,
    totalPersonnel,
    loading: personnelLoading,
    initialized: personnelInitialized,
    fetchPersonnel: fetchStorePersonnel,
  } = usePersonnelStore();

  const {
    batches,
    loading: cargoLoading,
    initialized: cargoInitialized,
    fetchCargo,
  } = useCargoStore();

  const {
    items: inventoryItems,
    loading: inventoryLoading,
    initialized: inventoryInitialized,
    resolveBhartiStationId,
    fetchInventory,
  } = useInventoryStore();

  useEffect(() => {
    if (!expeditionsInitialized) {
      fetchExpeditions();
    }
    if (!personnelInitialized) {
      fetchStorePersonnel();
    }
    if (!cargoInitialized) {
      fetchCargo();
    }
    if (!inventoryInitialized) {
      (async () => {
        const id = await resolveBhartiStationId();
        fetchInventory(id);
      })();
    }
  }, [
    expeditionsInitialized,
    personnelInitialized,
    cargoInitialized,
    inventoryInitialized,
    fetchExpeditions,
    fetchStorePersonnel,
    fetchCargo,
    resolveBhartiStationId,
    fetchInventory,
  ]);

  const resolveStationName = useCallback(
    (id) => {
      if (!id) return "—";
      const found = stations?.find((s) => s.id === id);
      return found ? found.name : id;
    },
    [stations]
  );

  // Show skeleton loading page while stores and initial emergency requests are pending
  const isInitialLoading =
    !timedOut &&
    ((!expeditionsInitialized && expeditionsLoading) ||
      !expeditionsInitialized ||
      (!personnelInitialized && personnelLoading) ||
      !personnelInitialized ||
      (!cargoInitialized && cargoLoading) ||
      !cargoInitialized ||
      (!inventoryInitialized && inventoryLoading) ||
      !inventoryInitialized ||
      emergenciesLoading);

  if (isInitialLoading) {
    return <OverviewSkeleton />;
  }

  const activeExpeditionsCount = (expeditions || []).filter((e) => {
    const s = (e.status || "").toLowerCase();
    return s === "active" || s.includes("way") || s === "planned";
  }).length;

  const displayedExpeditions = (expeditions || []).slice(0, 3);
  const displayedPersonnel = (movingPersonnel || []).slice(0, 4);
  const displayedBatches = (batches || []).slice(0, 4);

  const criticalInventory = (inventoryItems || [])
    .filter((i) => {
      const level = (i.stock_level || i.criticality || "").toLowerCase();
      return i.is_critical || level === "critical" || level === "low";
    })
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <SectionHeading>Operational overview</SectionHeading>

      {/* Active Emergency Alert Banner */}
      {newestActiveEmergency && (
        <div
          className="rounded-lg px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
          style={{
            background: colors.flareBg,
            border: `1px solid ${colors.flareDim}`,
          }}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <TriangleAlert
              size={18}
              color={colors.flare}
              strokeWidth={2}
              className="flex-shrink-0 mt-0.5 sm:mt-0"
            />
            <div className="min-w-0">
              <span
                className="text-sm font-semibold"
                style={{ color: colors.flare }}
              >
                {newestActiveEmergency.summary || newestActiveEmergency.emergency_type || "Emergency incident"}
              </span>
              <span className="text-xs sm:text-sm ml-2" style={{ color: colors.textMuted }}>
                {formatCoordinates(newestActiveEmergency.latitude, newestActiveEmergency.longitude) || "Coordinates unavailable"}
                {newestActiveEmergency.people_affected != null ? ` · ${newestActiveEmergency.people_affected} affected` : ""}
                {newestActiveEmergency.reported_at ? ` · ${new Date(newestActiveEmergency.reported_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigateTo("emergency")}
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

      {/* Key Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Compass}
          label="Active expeditions"
          value={String(activeExpeditionsCount)}
          sub={`${expeditions.length} total registered`}
          tone="ice"
        />
        <StatCard
          icon={Users}
          label="Personnel in motion"
          value={String(movingPersonnel.length)}
          sub={`of ${totalPersonnel.length} total station staff`}
          tone="aurora"
        />
        <StatCard
          icon={Package}
          label="Active dispatch batches"
          value={String(batches.length)}
          sub="QR-managed station transfers"
          tone="ice"
        />
        <StatCard
          icon={TriangleAlert}
          label="Open incidents"
          value={String(activeEmergenciesCount)}
          sub={activeEmergenciesCount === 1 ? "1 active incident" : `${activeEmergenciesCount} active incidents`}
          tone={activeEmergenciesCount > 0 ? "flare" : "aurora"}
        />
      </div>

      {/* Expeditions & Personnel Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Panel
            title="Active expeditions"
            right={
              <button
                onClick={() => navigateTo("expeditions")}
                className="text-xs font-medium cursor-pointer transition-opacity hover:opacity-80"
                style={{ color: colors.ice }}
              >
                View all →
              </button>
            }
          >
            {displayedExpeditions.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                <Compass size={28} style={{ color: colors.textFaint }} />
                <div className="text-sm font-medium" style={{ color: colors.textMuted }}>
                  No active expeditions
                </div>
                <div className="text-xs max-w-xs" style={{ color: colors.textFaint }}>
                  All polar crossing routes and expeditions are currently idle or completed.
                </div>
                <button
                  onClick={() => navigateTo("expeditions")}
                  className="mt-2 text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-90"
                  style={{
                    color: colors.ice,
                    background: colors.panelAlt,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  Schedule expedition →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {displayedExpeditions.map((e) => {
                  const expId = e.expedition_code || e.code || e.id;
                  const expName = e.expedition_name || e.name || "Untitled Expedition";
                  const route =
                    e.origin_station_name && e.destination_station_name
                      ? `${e.origin_station_name} → ${e.destination_station_name}`
                      : e.route ||
                        (e.origin_station_id || e.destination_station_id
                          ? `${resolveStationName(e.origin_station_id)} → ${resolveStationName(e.destination_station_id)}`
                          : "Route unspecified");
                  const rawStatus = (e.status || "").toLowerCase();
                  const tone =
                    e.tone ||
                    (rawStatus === "active" || rawStatus.includes("way")
                      ? "ice"
                      : rawStatus === "completed"
                      ? "aurora"
                      : rawStatus.includes("shelter") || rawStatus === "delayed"
                      ? "flare"
                      : "amber");
                  const readiness =
                    e.readiness ??
                    (rawStatus === "completed"
                      ? 100
                      : rawStatus === "active" || rawStatus.includes("way")
                      ? 80
                      : 45);
                  const displayStatus = e.status
                    ? e.status.charAt(0).toUpperCase() + e.status.slice(1)
                    : "Planned";

                  return (
                    <div
                      key={expId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-0"
                      style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: colors.text }}
                          >
                            {expName}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: colors.textFaint, ...mono }}
                          >
                            {expId}
                          </span>
                        </div>
                        <span
                          className="text-xs block mt-0.5"
                          style={{ color: colors.textMuted }}
                        >
                          {route}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 justify-between sm:justify-start">
                        <div className="w-28 flex-1 sm:flex-none">
                          <Bar value={readiness} tone={tone} />
                        </div>
                        <Pill tone={tone}>{displayStatus}</Pill>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="Personnel movement"
          right={
            <button
              onClick={() => navigateTo("personnel")}
              className="text-xs font-medium cursor-pointer transition-opacity hover:opacity-80"
              style={{ color: colors.ice }}
            >
              View all →
            </button>
          }
        >
          {displayedPersonnel.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
              <Users size={28} style={{ color: colors.textFaint }} />
              <div className="text-sm font-medium" style={{ color: colors.textMuted }}>
                No personnel in motion
              </div>
              <div className="text-xs max-w-xs" style={{ color: colors.textFaint }}>
                All field operatives and researchers are stationed at base.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {displayedPersonnel.map((m, idx) => {
                const person = totalPersonnel.find((p) => p.id === m.personnel_id);
                const displayName =
                  m.full_name ||
                  m.personnel_name ||
                  (person ? person.full_name || person.name : m.name) ||
                  "—";
                const fromStation =
                  m.origin_station_name || resolveStationName(m.origin_station_id) || m.from || "—";
                const toStation =
                  m.destination_station_name ||
                  resolveStationName(m.destination_station_id) ||
                  m.to ||
                  "—";
                const rawStatus = (m.movement_status || m.status || "").toLowerCase();
                const statusTone =
                  rawStatus === "waiting_for_weather" || rawStatus === "planned"
                    ? "amber"
                    : rawStatus === "arrived_safely" ||
                      rawStatus === "completed" ||
                      rawStatus === "received"
                    ? "aurora"
                    : "ice";
                const statusLabel =
                  rawStatus === "in_transit"
                    ? "In transit"
                    : rawStatus === "planned"
                    ? "Planned"
                    : rawStatus === "waiting_for_weather"
                    ? "Waiting for weather"
                    : rawStatus === "arrived_safely"
                    ? "Arrived safely"
                    : m.movement_status || m.statusLabel || m.status || "In transit";

                return (
                  <div
                    key={m.id || `${displayName}-${idx}`}
                    className="flex items-center justify-between gap-2"
                  >
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
                    <Pill tone={statusTone}>{statusLabel}</Pill>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Inventory & Dispatch Batches Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel
          title="Critical inventory"
          right={
            <button
              onClick={() => navigateTo("inventory")}
              className="text-xs font-medium cursor-pointer transition-opacity hover:opacity-80"
              style={{ color: colors.ice }}
            >
              View all →
            </button>
          }
        >
          {criticalInventory.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
              <Package size={28} style={{ color: colors.aurora }} />
              <div className="text-sm font-medium" style={{ color: colors.text }}>
                No critical inventory alerts
              </div>
              <div className="text-xs max-w-xs" style={{ color: colors.textMuted }}>
                All monitored supplies are currently within safe reserve thresholds.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {criticalInventory.map((i) => {
                const itemId = i.id || i.inventory_id || i.item_id || i.name || i.item;
                const itemName = i.name || i.item || "Unknown Item";
                const current = i.available_quantity ?? i.current ?? 0;
                const min = i.minimum_quantity ?? i.min ?? 1;
                const unit = i.unit || "units";
                const stationName =
                  i.station ||
                  (i.station_id ? resolveStationName(i.station_id) : "Bharti Station");
                const rawLevel = (i.stock_level || i.criticality || "").toLowerCase();
                const tone = rawLevel === "low" ? "amber" : "flare";
                const pct = min > 0 ? Math.min(100, Math.round((current / min) * 100)) : 100;

                return (
                  <div key={itemId}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-sm truncate" style={{ color: colors.text }}>
                        {itemName}
                      </span>
                      <span
                        className="text-sm flex-shrink-0 font-medium"
                        style={{ color: tone === "amber" ? colors.amber : colors.flare, ...mono }}
                      >
                        {current} / {min} {unit}
                      </span>
                    </div>
                    <Bar value={pct} tone={tone} />
                    <span className="text-xs mt-1 block" style={{ color: colors.textFaint }}>
                      {stationName}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title={`Active dispatch batches (${batches.length})`}
          right={
            <button
              onClick={() => navigateTo("cargo")}
              className="text-xs font-medium cursor-pointer transition-opacity hover:opacity-80"
              style={{ color: colors.ice }}
            >
              View all →
            </button>
          }
        >
          {displayedBatches.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
              <Package size={28} style={{ color: colors.textFaint }} />
              <div className="text-sm font-medium" style={{ color: colors.textMuted }}>
                No active dispatch batches
              </div>
              <div className="text-xs max-w-xs" style={{ color: colors.textFaint }}>
                No supply batches are currently in transit between stations.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {displayedBatches.map((b) => {
                const code = b.batch_code || b.code || b.id;
                const origin = b.origin_station_name || b.origin || "—";
                const destination = b.destination_station_name || b.destination || "—";
                const expName = b.expedition_name || b.expeditionCode || "";
                const rawStatus = (b.status || "").toLowerCase();
                const statusTone =
                  rawStatus === "received" || rawStatus === "arrived"
                    ? "aurora"
                    : rawStatus === "delayed"
                    ? "flare"
                    : rawStatus === "planned"
                    ? "amber"
                    : "ice";
                const displayStatus = b.status
                  ? b.status.charAt(0).toUpperCase() + b.status.slice(1)
                  : "Planned";

                return (
                  <div key={b.id || code} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className="text-sm font-medium truncate"
                        style={{ color: colors.text, ...mono }}
                      >
                        {code}
                      </div>
                      <div className="text-xs truncate" style={{ color: colors.textMuted }}>
                        {origin} → {destination}
                        {expName ? ` · ${expName}` : ""}
                      </div>
                    </div>
                    <Pill tone={statusTone}>{displayStatus}</Pill>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default Overview;
