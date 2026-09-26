import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  TriangleAlert,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
  User,
  Cpu,
  BatteryCharging,
  Gauge,
  Compass,
  Radio,
  RefreshCw,
} from "lucide-react";
import { colors, mono } from "../../theme";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import SectionHeading from "../ui/SectionHeading";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";
import { emergencyApi } from "../../services/api";
import { useEmergencyStore } from "../../store/useEmergencyStore";
import { formatCoordinates } from "../../utils/geo";

const EmergencyMap = lazy(() => import("../emergency/EmergencyMap"));

function hasValidCoordinates(emergency) {
  const lat = Number(emergency?.latitude);
  const lng = Number(emergency?.longitude);
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

const severityOptions = ["Need Immediate Response", "Extremely Critical", "Critical (Not Extreme)"];

const emptyForm = {
  type: "",
  location: "",
  severity: "Need Immediate Response",
  affected: "",
  resources: "",
};

function getStatusTone(status) {
  const s = (status || "").toLowerCase();
  if (s === "active" || s === "immediate_response") return "flare";
  if (s === "acknowledged") return "amber";
  if (s === "responding") return "ice";
  if (s === "resolved") return "aurora";
  return "muted";
}

function formatStatusLabel(status) {
  if (!status) return "Unknown";
  const s = status.toLowerCase();
  if (s === "immediate_response") return "Immediate response";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getSeverityColor(severity) {
  const s = (severity || "").toLowerCase();
  if (s.includes("immediate") || s.includes("critical")) return colors.flare;
  if (s.includes("moderate") || s.includes("low")) return colors.amber;
  return colors.text;
}

function formatSeverityLabel(severity) {
  if (!severity) return "Moderate";
  return severity
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

const Emergency = () => {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [expandedMapIds, setExpandedMapIds] = useState({});

  const toggleMap = useCallback((id) => {
    setExpandedMapIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // Report Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  const fetchEmergencies = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await emergencyApi.getAll();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.emergencies)
        ? data.emergencies
        : [];
      setEmergencies(list);
      useEmergencyStore.getState().fetchActive();
    } catch (err) {
      console.warn("Failed to fetch emergencies:", err);
      if (isInitial) {
        setEmergencies([]);
      }
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted) {
        await fetchEmergencies(true);
      }
    })();

    const intervalId = setInterval(() => {
      if (isMounted) {
        fetchEmergencies(false);
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [fetchEmergencies]);

  const handleResolve = async (id) => {
    setResolvingId(id);
    try {
      await emergencyApi.resolve(id);
      showToast("Emergency resolved");
      useEmergencyStore.getState().fetchActive();
      await fetchEmergencies(false);
    } catch (err) {
      console.error("Resolve emergency error:", err);
      showToast(err.message || "Failed to resolve emergency.", "error");
    } finally {
      setResolvingId(null);
    }
  };

  const setFormField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  function handleReportSubmit(e) {
    e.preventDefault();
    const newEmergency = {
      id: `EMG-${Math.floor(100 + Math.random() * 900)}`,
      emergency_code: `EMG-${Math.floor(1000 + Math.random() * 9000)}`,
      summary: form.type,
      emergency_type: form.type,
      severity: form.severity,
      status: "active",
      people_affected: Number(form.affected) || 0,
      resources_needed: form.resources,
      reported_at: new Date().toISOString(),
    };
    setEmergencies((list) => [newEmergency, ...list]);
    useEmergencyStore.getState().fetchActive();
    setForm(emptyForm);
    setModalOpen(false);
    showToast("Incident report submitted successfully.");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm transition-all animate-in fade-in slide-in-from-top-4"
          style={{
            background: colors.bgRaised,
            color: toast.type === "error" ? colors.flare : colors.aurora,
            border: `1px solid ${toast.type === "error" ? colors.flareDim : colors.auroraDim}`,
          }}
        >
          {toast.type === "error" ? (
            <AlertCircle size={16} className="flex-shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="flex-shrink-0" />
          )}
          <span style={{ color: colors.text }}>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <SectionHeading
        right={
          <div className="flex items-center gap-2">
            <Link
              to="/emergency/device/simulate"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded cursor-pointer transition-colors hover:opacity-90"
              style={{
                color: colors.ice,
                border: `1px solid ${colors.iceBorder}`,
                background: "rgba(56, 189, 248, 0.08)",
              }}
              title="Open mobile GPS device simulator in new tab"
            >
              <Radio size={14} className="animate-pulse" />
              <span className="hidden sm:inline">Simulate Device</span>
              <span className="sm:hidden">Simulate</span>
            </Link>
            <button
              onClick={() => fetchEmergencies(false)}
              disabled={loading || refreshing}
              title="Refresh incidents"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
            >
              <RefreshCw size={13} className={refreshing || loading ? "animate-spin" : ""}/>
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded cursor-pointer"
              style={{ color: "#fff", background: colors.flare }}
            >
              <TriangleAlert size={15} /> Report emergency
            </button>
          </div>
        }
      >
        Emergencies
      </SectionHeading>

      {/* Loading Skeleton */}
      {loading && emergencies.length === 0 ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((idx) => (
            <div
              key={idx}
              className="rounded-lg p-5 animate-pulse"
              style={{ background: colors.bgRaised, border: `1px solid ${colors.border}` }}
            >
              <div className="h-5 w-48 rounded mb-3" style={{ background: colors.panelAlt }} />
              <div className="h-4 w-72 rounded mb-4" style={{ background: colors.panelAlt }} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t" style={{ borderColor: colors.borderSoft }}>
                <div className="h-4 w-20 rounded" style={{ background: colors.panelAlt }} />
                <div className="h-4 w-20 rounded" style={{ background: colors.panelAlt }} />
                <div className="h-4 w-20 rounded" style={{ background: colors.panelAlt }} />
                <div className="h-4 w-20 rounded" style={{ background: colors.panelAlt }} />
              </div>
            </div>
          ))}
        </div>
      ) : emergencies.length === 0 ? (
        /* Empty State */
        <div
          className="py-14 px-6 text-center rounded-xl flex flex-col items-center justify-center gap-3"
          style={{
            background: colors.bgRaised,
            border: `1px dashed ${colors.borderSoft}`,
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: colors.auroraBg, color: colors.aurora }}
          >
            <ShieldCheck size={24} />
          </div>
          <div className="max-w-md">
            <p className="text-sm font-semibold" style={{ color: colors.text }}>
              No active emergencies reported
            </p>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              All polar station sectors, research expeditions, and personnel are operating safely within normal parameters.
            </p>
          </div>
        </div>
      ) : (
        /* Emergency Cards */
        <div className="flex flex-col gap-4">
          {emergencies.map((e) => {
            const rawStatus = (e.status || "active").toLowerCase();
            const isActive = rawStatus === "active" || rawStatus === "immediate_response";
            const canResolve = ["active", "acknowledged", "responding"].includes(rawStatus) && !["resolved", "cancelled"].includes(rawStatus);
            const statusTone = getStatusTone(e.status);
            const statusLabel = formatStatusLabel(e.status);
            const coords = formatCoordinates(e.latitude, e.longitude);
            const title = e.summary || e.emergency_type || "Emergency incident";
            const code = e.emergency_code || e.id;

            const hasMetadata =
              e.reported_by_name ||
              e.device_label ||
              e.battery_percent != null ||
              e.speed_mps != null ||
              e.heading_deg != null ||
              e.last_heartbeat_at;

            const resourcesText =
              (e.resources_needed || e.resources || "").trim() || "No resources requested yet";
            const hasCustomResources = Boolean((e.resources_needed || e.resources || "").trim());

            return (
              <Panel key={e.id} style={{ padding: 0 }}>
                <div
                  className="p-4 sm:p-5 flex flex-col gap-4"
                  style={isActive ? { background: colors.flareBg } : {}}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-base font-semibold" style={{ color: colors.text }}>
                          {title}
                        </span>
                        {code && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: colors.panelAlt, color: colors.textFaint, ...mono }}>
                            {code}
                          </span>
                        )}
                      </div>

                      {/* GPS Coordinates & Accuracy */}
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: colors.textMuted }}>
                        <MapPin size={13} className="flex-shrink-0" />
                        <span style={{ ...mono, fontSize: "13px" }}>
                          {coords || e.location || "Coordinates unavailable"}
                        </span>
                      </div>
                      {e.location_accuracy_m != null && (
                        <div className="text-[11px] mt-0.5 ml-5" style={{ color: colors.textFaint }}>
                          GPS accuracy ±{e.location_accuracy_m} m
                        </div>
                      )}
                      {hasValidCoordinates(e) && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => toggleMap(e.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
                            style={{
                              color: expandedMapIds[e.id] ? colors.ice : colors.text,
                              background: expandedMapIds[e.id]
                                ? (colors.iceTint || colors.panelAlt)
                                : colors.panelAlt,
                              border: `1px solid ${
                                expandedMapIds[e.id]
                                  ? (colors.iceDim || colors.border)
                                  : colors.border
                              }`,
                            }}
                          >
                            <MapPin
                              size={12}
                              style={{ color: expandedMapIds[e.id] ? colors.ice : colors.flare }}
                            />
                            <span>{expandedMapIds[e.id] ? "Hide map" : "View location on map"}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
                      <Pill tone={statusTone}>{statusLabel}</Pill>
                      {canResolve && (
                        <button
                          onClick={() => handleResolve(e.id)}
                          disabled={resolvingId === e.id}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-85"
                          style={{
                            color: colors.aurora,
                            background: colors.auroraBg,
                            border: `1px solid ${colors.auroraDim}`,
                            opacity: resolvingId === e.id ? 0.6 : 1,
                          }}
                        >
                          {resolvingId === e.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          <span>Resolve</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Compact Metadata Chips */}
                  {hasMetadata && (
                    <div
                      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-xs"
                      style={{ borderTop: `1px solid ${colors.borderSoft}` }}
                    >
                      {e.reported_by_name && (
                        <span className="flex items-center gap-1">
                          <User size={12} style={{ color: colors.textFaint }} />
                          <span style={{ color: colors.textFaint }}>Reporter:</span>
                          <span style={{ color: colors.text }}>{e.reported_by_name}</span>
                        </span>
                      )}
                      {e.device_label && (
                        <span className="flex items-center gap-1">
                          <Cpu size={12} style={{ color: colors.textFaint }} />
                          <span style={{ color: colors.textFaint }}>Device:</span>
                          <span style={{ color: colors.text, ...mono }}>{e.device_label}</span>
                        </span>
                      )}
                      {e.battery_percent != null && (
                        <span className="flex items-center gap-1">
                          <BatteryCharging
                            size={12}
                            style={{ color: e.battery_percent < 25 ? colors.flare : colors.aurora }}
                          />
                          <span style={{ color: colors.textFaint }}>Battery:</span>
                          <span style={{ color: colors.text, ...mono }}>{e.battery_percent}%</span>
                        </span>
                      )}
                      {e.speed_mps != null && (
                        <span className="flex items-center gap-1">
                          <Gauge size={12} style={{ color: colors.textFaint }} />
                          <span style={{ color: colors.textFaint }}>Speed:</span>
                          <span style={{ color: colors.text, ...mono }}>{e.speed_mps} m/s</span>
                        </span>
                      )}
                      {e.heading_deg != null && (
                        <span className="flex items-center gap-1">
                          <Compass size={12} style={{ color: colors.textFaint }} />
                          <span style={{ color: colors.textFaint }}>Heading:</span>
                          <span style={{ color: colors.text, ...mono }}>{e.heading_deg}°</span>
                        </span>
                      )}
                      {e.last_heartbeat_at && (
                        <span className="flex items-center gap-1">
                          <Radio size={12} style={{ color: colors.textFaint }} />
                          <span style={{ color: colors.textFaint }}>Heartbeat:</span>
                          <span style={{ color: colors.text, ...mono }}>{formatTimestamp(e.last_heartbeat_at)}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Interactive Map Section (only rendered when expanded) */}
                  {expandedMapIds[e.id] && hasValidCoordinates(e) && (
                    <div
                      className="pt-3 pb-1"
                      style={{ borderTop: `1px solid ${colors.borderSoft}` }}
                    >
                      <Suspense
                        fallback={
                          <div
                            className="w-full h-[260px] sm:h-[320px] rounded-lg flex items-center justify-center text-xs gap-2"
                            style={{
                              background: colors.bgRaised,
                              border: `1px solid ${colors.border}`,
                              color: colors.textMuted,
                            }}
                          >
                            <Loader2 size={16} className="animate-spin" style={{ color: colors.ice }} />
                            <span>Loading map engine...</span>
                          </div>
                        }
                      >
                        <EmergencyMap emergency={e} />
                      </Suspense>
                    </div>
                  )}

                  {/* Prominent 4-Column Metrics Grid */}
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3"
                    style={{ borderTop: `1px solid ${colors.borderSoft}` }}
                  >
                    <div>
                      <div className="text-xs mb-1" style={{ color: colors.textFaint }}>Severity</div>
                      <div className="text-sm font-medium" style={{ color: getSeverityColor(e.severity) }}>
                        {formatSeverityLabel(e.severity)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: colors.textFaint }}>Reported</div>
                      <div className="text-sm" style={{ color: colors.text }}>
                        {formatTimestamp(e.reported_at || e.when)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: colors.textFaint }}>People affected</div>
                      <div className="text-sm font-medium" style={{ color: colors.text, ...mono }}>
                        {e.people_affected ?? e.affected ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: colors.textFaint }}>Resources needed</div>
                      <div
                        className="text-sm truncate"
                        style={{
                          color: hasCustomResources ? colors.text : colors.textMuted,
                          fontStyle: hasCustomResources ? "normal" : "italic",
                        }}
                      >
                        {resourcesText}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Report Modal */}
      {modalOpen && (
        <Modal title="Report emergency" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleReportSubmit} className="flex flex-col gap-4">
            <FormField
              label="Emergency type"
              value={form.type}
              onChange={setFormField("type")}
              placeholder="e.g. Vehicle breakdown, medical injury"
              required
            />
            <FormField
              label="Location / station"
              value={form.location}
              onChange={setFormField("location")}
              placeholder="e.g. 69.408000° S, 76.190000° E or Bharti Station"
              required
            />
            <FormField
              label="Severity"
              as="select"
              options={severityOptions}
              value={form.severity}
              onChange={setFormField("severity")}
            />
            <FormField
              label="People affected"
              type="number"
              value={form.affected}
              onChange={setFormField("affected")}
            />
            <FormField
              label="Resources required"
              as="textarea"
              value={form.resources}
              onChange={setFormField("resources")}
              placeholder="e.g. Medical kit, extra vehicle"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm px-4 py-2 rounded cursor-pointer"
                style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-sm font-medium px-4 py-2 rounded cursor-pointer"
                style={{ color: "#fff", background: colors.flare }}
              >
                Submit report
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Emergency;
