import {useEffect} from "react";
import {
  X,
  MapPin,
  ArrowRight,
  Navigation,
  Radio,
  TriangleAlert,
  Compass,
  History,
  Calendar,
  Info,
  CheckCircle2,
} from "lucide-react";
import {colors, mono} from "../../theme.js";
import Pill from "../ui/Pill.jsx";

function formatStatus(status) {
  if (!status) return "—";
  const str = String(status).trim();
  return str
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function statusTone(status) {
  if (!status) return "ice";
  const s = String(status).toLowerCase();
  if (s === "waiting_for_weather" || s === "planned" || s === "in_transit") return "amber";
  if (s === "arrived_safely" || s === "cleared" || s === "completed" || s === "available" || s === "active" || s === "arrived") return "aurora";
  if (s === "on_leave" || s === "leave" || s === "inactive" || s === "off_duty" || s === "cancelled") return "muted";
  return "ice";
}

function getPersonnelStatusBadge(person) {
  if (person.isInTransit) {
    return {label: "In transit", tone: "amber"};
  }
  const raw = String(person.status || "").trim().toLowerCase();
  if (raw === "available" || raw === "active" || !raw) {
    return {label: "Available", tone: "aurora"};
  }
  if (raw === "assigned" || raw === "on_duty" || Boolean(person.is_assigned)) {
    return {label: "Stationed / Assigned", tone: "ice"};
  }
  if (raw === "in_transit" || raw === "moving") {
    return {label: "In transit", tone: "amber"};
  }
  if (raw === "inactive" || raw === "off_duty") {
    return {label: "Inactive", tone: "muted"};
  }
  if (raw === "unavailable" || raw === "leave" || raw === "on_leave") {
    return {label: "Unavailable", tone: "muted"};
  }
  if (raw === "medical_hold" || raw === "hold") {
    return {label: "Medical hold", tone: "flare"};
  }
  return {label: formatStatus(raw), tone: statusTone(raw)};
}

function formatDisplayDateTime(d) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const hasSpecificTime = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(hasSpecificTime ? {hour: "2-digit", minute: "2-digit"} : {}),
    });
  } catch {
    return d;
  }
}

function getInitials(name) {
  if (!name) return "??";
  const cleaned = name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PersonnelDrawer = ({person, onClose, movementHistory = []}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (person) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [person, onClose]);

  if (!person) return null;

  const statusBadge = getPersonnelStatusBadge(person);
  const targetId = person.personnel_id || person.id;
  const targetName = (person.name || person.full_name || "").trim().toLowerCase();

  // Filter movement history for this specific personnel member
  const filteredHistory = movementHistory
    .filter((h) => {
      const hId = h.personnel_id || h.id;
      if (targetId && hId && targetId === hId) return true;
      const hName = (h.name || h.full_name || h.personnel_name || "").trim().toLowerCase();
      if (targetName && hName && targetName === hName) return true;
      return false;
    })
    .sort((a, b) => {
      const dateA = new Date(a.departure_time || a.arrival_time || 0).getTime();
      const dateB = new Date(b.departure_time || b.arrival_time || 0).getTime();
      return dateB - dateA;
    });

  const activeMovement = person.activeMovement;
  const originStation =
    activeMovement?.origin_station_name ||
    activeMovement?.origin_station ||
    "Origin Station";
  const destinationStation =
    activeMovement?.destination_station_name ||
    activeMovement?.destination_station ||
    "Destination Station";
  const departureDate = activeMovement?.departure_time
    ? formatDisplayDateTime(activeMovement.departure_time)
    : "—";
  const arrivalDate = activeMovement?.arrival_time
    ? formatDisplayDateTime(activeMovement.arrival_time)
    : "—";
  const movStatus =
    activeMovement?.movement_status ||
    activeMovement?.status ||
    "in_transit";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end backdrop-blur-xs transition-opacity"
      style={{background: colors.modalOverlay}}
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[460px] max-h-[92vh] sm:max-h-none sm:h-full flex flex-col rounded-t-2xl sm:rounded-none shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom sm:slide-in-from-right duration-200"
        style={{
          background: colors.panel,
          borderLeft: `1px solid ${colors.border}`,
          borderTop: `1px solid ${colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle indicator */}
        <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mt-2.5 mb-1 sm:hidden flex-shrink-0"/>

        {/* Drawer Header */}
        <div
          className="flex items-start justify-between p-4 sm:p-5 flex-shrink-0"
          style={{borderBottom: `1px solid ${colors.borderSoft}`, background: colors.panel}}
        >
          <div className="flex items-center gap-3.5 min-w-0 pr-2">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm"
              style={{
                background: person.isInTransit ? colors.amberBg : colors.iceBg,
                color: person.isInTransit ? colors.amber : colors.ice,
                border: `1.5px solid ${person.isInTransit ? colors.amberDim : colors.iceDim}`,
              }}
            >
              {getInitials(person.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold truncate" style={{color: colors.text}}>
                  {person.name}
                </h2>
              </div>
              <div className="text-xs truncate mt-0.5" style={{color: colors.textMuted}}>
                {person.role || "Station Staff"}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Pill tone={statusBadge.tone}>{statusBadge.label}</Pill>
                {person.isInTransit ? (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium"
                    style={{color: colors.amber, ...mono}}
                  >
                    <Navigation size={11}/> En route
                  </span>
                ) : (
                  person.current_station && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px]"
                      style={{color: colors.textMuted}}
                    >
                      <MapPin size={11} className="opacity-70"/>
                      {person.current_station}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-colors flex-shrink-0 mt-0.5"
            style={{
              color: colors.textMuted,
              background: colors.panelAlt,
              border: `1px solid ${colors.borderSoft}`,
            }}
            aria-label="Close details"
          >
            <X size={17}/>
          </button>
        </div>

        {/* Drawer Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-5 custom-scrollbar">
          {/* 1. Current Placement Section */}
          <div className="flex flex-col gap-2.5">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{color: colors.textFaint}}
            >
              Current placement
            </span>

            {person.isInTransit && activeMovement ? (
              <div
                className="p-3.5 rounded-lg flex flex-col gap-3"
                style={{
                  background: colors.amberBg,
                  border: `1px solid ${colors.amberDim}`,
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm"
                       style={{color: colors.amber}}>
                    <Navigation size={14} className="flex-shrink-0"/>
                    <span>{originStation}</span>
                    <ArrowRight size={13} className="flex-shrink-0 opacity-80"/>
                    <span>{destinationStation}</span>
                  </div>
                  <Pill tone={statusTone(movStatus)}>{formatStatus(movStatus)}</Pill>
                </div>

                <div
                  className="grid grid-cols-2 gap-2 pt-2.5 text-xs"
                  style={{borderTop: `1px solid ${colors.amberDim}`, ...mono}}
                >
                  <div>
                    <div className="text-[11px] opacity-75 font-sans" style={{color: colors.textMuted}}>
                      Departure
                    </div>
                    <div className="font-medium mt-0.5" style={{color: colors.text}}>
                      {departureDate}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] opacity-75 font-sans" style={{color: colors.textMuted}}>
                      Est. Arrival
                    </div>
                    <div className="font-medium mt-0.5" style={{color: colors.text}}>
                      {arrivalDate}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="p-3.5 rounded-lg flex items-center justify-between gap-3"
                style={{
                  background: colors.panelAlt,
                  border: `1px solid ${colors.borderSoft}`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{background: colors.iceBg, color: colors.ice}}
                  >
                    <MapPin size={16}/>
                  </div>
                  <div>
                    <div className="text-xs font-semibold" style={{color: colors.text}}>
                      {person.current_station || "Unassigned Station"}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{color: colors.textMuted}}>
                      {statusBadge.label === "Available"
                        ? "Stationed and available for deployment"
                        : `Current status: ${statusBadge.label}`}
                    </div>
                  </div>
                </div>
                <Pill tone={statusBadge.tone}>{statusBadge.label}</Pill>
              </div>
            )}
          </div>

          {/* 2. Movement Timeline Section */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
                style={{color: colors.textFaint}}
              >
                <History size={13}/> Movement timeline
              </span>
              <span className="text-[11px] font-medium" style={{color: colors.textMuted}}>
                {filteredHistory.length} {filteredHistory.length === 1 ? "record" : "records"}
              </span>
            </div>

            {filteredHistory.length === 0 ? (
              <div
                className="p-4 rounded-lg text-center text-xs"
                style={{
                  background: colors.panelAlt,
                  border: `1px dashed ${colors.border}`,
                  color: colors.textMuted,
                }}
              >
                No past movement records on file for this personnel member.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 relative">
                {filteredHistory.map((h, idx) => {
                  const fromStation =
                    h.origin_station_name || h.origin_station || "Origin";
                  const toStation =
                    h.destination_station_name || h.destination_station || "Destination";
                  const dep = h.departure_time
                    ? formatDisplayDateTime(h.departure_time)
                    : "—";
                  const arr = h.arrival_time
                    ? formatDisplayDateTime(h.arrival_time)
                    : "—";
                  const status = h.movement_status || h.status || "arrived";

                  return (
                    <div
                      key={h.id || `${fromStation}-${toStation}-${idx}`}
                      className="p-3 rounded-lg flex flex-col gap-2 text-xs relative"
                      style={{
                        background: colors.panelAlt,
                        border: `1px solid ${colors.borderSoft}`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 font-medium" style={{color: colors.text}}>
                          <span className="truncate">{fromStation}</span>
                          <ArrowRight size={12} className="flex-shrink-0 opacity-60"/>
                          <span className="truncate">{toStation}</span>
                        </div>
                        <Pill tone={statusTone(status)}>{formatStatus(status)}</Pill>
                      </div>

                      <div
                        className="flex items-center justify-between text-[11px] pt-1.5"
                        style={{color: colors.textFaint, borderTop: `1px solid ${colors.borderSoft}`, ...mono}}
                      >
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="opacity-70"/> {dep}
                        </span>
                        <span>→</span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={11} className="opacity-70"/> {arr}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Future-Data Sections */}
          <div className="flex flex-col gap-3 pt-2" style={{borderTop: `1px solid ${colors.borderSoft}`}}>
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{color: colors.textFaint}}
            >
              Integrations & Telemetry
            </span>

            {/* Device Tracking */}
            <div
              className="p-3.5 rounded-lg flex flex-col gap-2"
              style={{
                background: colors.panelAlt,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium" style={{color: colors.text}}>
                  <Radio size={14} style={{color: colors.ice}}/>
                  <span>Device tracking</span>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{
                    background: colors.bgRaised,
                    color: colors.textFaint,
                    border: `1px solid ${colors.borderSoft}`
                  }}
                >
                  Telemetry
                </span>
              </div>
              <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{color: colors.textMuted}}>
                <Info size={12} className="flex-shrink-0 opacity-60"/>
                <span>Detailed data will appear here when available.</span>
              </div>
            </div>

            {/* Emergency Involvement */}
            <div
              className="p-3.5 rounded-lg flex flex-col gap-2"
              style={{
                background: colors.panelAlt,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium" style={{color: colors.text}}>
                  <TriangleAlert size={14} style={{color: colors.amber}}/>
                  <span>Emergency involvement</span>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{
                    background: colors.bgRaised,
                    color: colors.textFaint,
                    border: `1px solid ${colors.borderSoft}`
                  }}
                >
                  Safety
                </span>
              </div>
              <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{color: colors.textMuted}}>
                <Info size={12} className="flex-shrink-0 opacity-60"/>
                <span>Detailed data will appear here when available.</span>
              </div>
            </div>

            {/* Expedition Assignments */}
            <div
              className="p-3.5 rounded-lg flex flex-col gap-2"
              style={{
                background: colors.panelAlt,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium" style={{color: colors.text}}>
                  <Compass size={14} style={{color: colors.aurora}}/>
                  <span>Expedition assignments</span>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{
                    background: colors.bgRaised,
                    color: colors.textFaint,
                    border: `1px solid ${colors.borderSoft}`
                  }}
                >
                  Expeditions
                </span>
              </div>
              <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{color: colors.textMuted}}>
                <Info size={12} className="flex-shrink-0 opacity-60"/>
                <span>Detailed data will appear here when available.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonnelDrawer;
