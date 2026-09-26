import {
  Check,
  Clock,
  AlertTriangle,
  XCircle,
  Package,
  Truck,
  Compass,
  CheckCircle2,
} from "lucide-react";
import {colors, mono} from "../../theme.js";
import {formatDateTime, formatStatus} from "../../utils/cargoUtils.js";

// Canonical ordered progression of logistics cargo lifecycle:
// 1. draft -> Registered
// 2. packed -> Packed
// 3. dispatched / in_transit -> Dispatched/In transit
// 4. received -> Received
const STAGES = [
  {id: "draft", label: "Registered", sublabel: "Manifest created", icon: Compass},
  {id: "packed", label: "Packed", sublabel: "Staged at origin", icon: Package},
  {id: "dispatched", label: "Dispatched / In transit", sublabel: "Traverse underway", icon: Truck},
  {id: "received", label: "Received", sublabel: "Station arrival", icon: CheckCircle2},
];

export default function CargoTimeline({cargo}) {
  if (!cargo) return null;

  const currentStatus = String(cargo.status || "draft").toLowerCase().trim();
  const isDelayed = currentStatus === "delayed";
  const isCancelled = currentStatus === "cancelled";

  // Scan history milestone timestamps
  const historyTimestamps = {};
  let hasTransitScan = false;
  let hasPackedScan = false;

  if (Array.isArray(cargo.scan_history) && cargo.scan_history.length > 0) {
    cargo.scan_history.forEach((sh) => {
      const et = String(sh.event_type || "").toLowerCase().trim();
      if (et === "received") {
        if (!historyTimestamps.received) historyTimestamps.received = sh.scanned_at;
      } else if (et === "dispatched" || et === "in_transit" || et === "scanned") {
        hasTransitScan = true;
        if (!historyTimestamps.dispatched) historyTimestamps.dispatched = sh.scanned_at;
      } else if (et === "packed") {
        hasPackedScan = true;
        if (!historyTimestamps.packed) historyTimestamps.packed = sh.scanned_at;
      } else if (et === "created" || et === "draft") {
        if (!historyTimestamps.draft) historyTimestamps.draft = sh.scanned_at;
      }
    });
  }

  if (cargo.received_at) historyTimestamps.received = cargo.received_at;
  if (cargo.dispatched_at) historyTimestamps.dispatched = cargo.dispatched_at;
  if (cargo.created_at && !historyTimestamps.draft) historyTimestamps.draft = cargo.created_at;

  // The Consignment Lifecycle timeline must derive its active stage from the returned cargo.status,
  // not only scan-history logs:
  // - draft / created / planned -> 0 (Registered)
  // - packed -> 1 (Packed)
  // - dispatched / in_transit -> 2 (Dispatched / In transit)
  // - received -> 3 (Received)
  // - delayed -> stage where delay occurred; completed stages remain visible with only the delayed stage highlighted
  let currentIndex = 0;
  if (isCancelled) {
    currentIndex = -1;
  } else if (currentStatus === "received") {
    currentIndex = 3;
  } else if (currentStatus === "dispatched" || currentStatus === "in_transit" || currentStatus === "transit") {
    currentIndex = 2;
  } else if (currentStatus === "packed") {
    currentIndex = 1;
  } else if (currentStatus === "draft" || currentStatus === "created" || currentStatus === "planned") {
    currentIndex = 0;
  } else if (isDelayed) {
    // When delayed, pinpoint current stage: completed prior stages remain visible
    if (cargo.received_at || historyTimestamps.received) {
      currentIndex = 3;
    } else if (cargo.dispatched_at || hasTransitScan) {
      currentIndex = 2;
    } else if (cargo.packed_at || hasPackedScan) {
      currentIndex = 1;
    } else {
      currentIndex = 0;
    }
  } else {
    // Fallback based on timestamps if status is non-standard
    if (cargo.received_at) currentIndex = 3;
    else if (cargo.dispatched_at || hasTransitScan) currentIndex = 2;
    else if (cargo.packed_at || hasPackedScan) currentIndex = 1;
    else currentIndex = 0;
  }

  // Get milestone timestamps
  const getStageTimestamp = (stageId) => {
    if (stageId === "draft") return cargo.created_at || historyTimestamps.draft;
    if (stageId === "packed") return cargo.packed_at || historyTimestamps.packed;
    if (stageId === "dispatched") return cargo.dispatched_at || historyTimestamps.dispatched;
    if (stageId === "received") return cargo.received_at || historyTimestamps.received;
    return null;
  };

  // Header stage label
  const getActiveStageText = () => {
    if (isDelayed) return "Delayed";
    if (currentStatus === "dispatched") return "Dispatched";
    if (currentStatus === "in_transit") return "In Transit";
    if (currentStatus === "packed") return "Packed";
    if (currentStatus === "received") return "Received";
    if (currentStatus === "draft" || currentStatus === "created") return "Registered";
    return STAGES[currentIndex]?.label || formatStatus(currentStatus);
  };

  const progressPercent =
    currentIndex <= 0
      ? 0
      : Math.min(100, Math.round((currentIndex / (STAGES.length - 1)) * 100));

  return (
    <div
      className="p-4 sm:p-5 rounded-xl flex flex-col gap-4 shadow-xs"
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Timeline Header */}
      <div
        className="flex items-center justify-between gap-2 flex-wrap pb-3"
        style={{borderBottom: `1px solid ${colors.borderSoft}`}}
      >
        <div className="flex items-center gap-2">
          <Clock size={16} style={{color: colors.ice}}/>
          <h3 className="text-sm font-semibold" style={{color: colors.text}}>
            Consignment Lifecycle & Timeline
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDelayed && (
            <div
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse"
              style={{
                background: colors.flareBg,
                color: colors.flare,
                border: `1px solid ${colors.flareDim}`,
              }}
            >
              <AlertTriangle size={13}/>
              <span>Delayed</span>
            </div>
          )}

          {isCancelled && (
            <div
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: colors.panelAlt,
                color: colors.textMuted,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <XCircle size={13}/>
              <span>Consignment Cancelled</span>
            </div>
          )}

          {!isCancelled && (
            <span
              className="text-xs font-medium"
              style={{color: colors.textMuted}}
            >
              Stage {Math.min(currentIndex + 1, STAGES.length)} of {STAGES.length} ·{" "}
              <strong style={{color: isDelayed ? colors.flare : colors.text}}>
                {getActiveStageText()}
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* Stepper with progress bar */}
      <div className="relative w-full py-2">
        {/* Horizontal connecting bar for tablet/desktop */}
        <div
          className="hidden sm:block absolute top-[28px] left-[12.5%] right-[12.5%] h-[3px] -translate-y-1/2 z-0 rounded-full"
          style={{background: colors.borderSoft}}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg, ${colors.aurora}, ${isDelayed ? colors.flare : colors.ice})`,
              boxShadow: `0 0 8px ${isDelayed ? colors.flare : colors.ice}44`,
            }}
          />
        </div>

        {/* 4 Standard Stages */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-2 relative z-10">
          {STAGES.map((stage, idx) => {
            const isCompleted = !isCancelled && idx < currentIndex;
            const isCurrent = !isCancelled && idx === currentIndex;
            const ts = getStageTimestamp(stage.id);
            const Icon = stage.icon;

            // Tone resolution
            let circleBg = colors.panelAlt;
            let circleBorder = colors.borderSoft;
            let circleColor = colors.textFaint;

            if (isCompleted) {
              circleBg = colors.auroraBg;
              circleBorder = colors.auroraDim;
              circleColor = colors.aurora;
            } else if (isCurrent) {
              if (isDelayed) {
                circleBg = colors.flareBg;
                circleBorder = colors.flare;
                circleColor = colors.flare;
              } else if (idx === 3 && currentStatus === "received") {
                circleBg = colors.auroraBg;
                circleBorder = colors.aurora;
                circleColor = colors.aurora;
              } else {
                circleBg = colors.iceBg;
                circleBorder = colors.ice;
                circleColor = colors.ice;
              }
            }

            // Display label for stage (e.g. "Dispatched" when active and status is dispatched)
            let displayLabel = stage.label;
            let displaySublabel = stage.sublabel;

            if (isCurrent && isDelayed) {
              displayLabel = "Delayed";
              displaySublabel = "Consignment delayed";
            } else if (stage.id === "dispatched") {
              if (currentStatus === "dispatched") displayLabel = "Dispatched";
              else if (currentStatus === "in_transit") displayLabel = "In Transit";
              else displayLabel = "Dispatched / In transit";
            }

            return (
              <div
                key={stage.id}
                className="relative flex sm:flex-col items-center sm:items-center text-left sm:text-center gap-3 sm:gap-2 p-2.5 sm:p-2 rounded-lg transition-colors min-w-0"
                style={{
                  background: isCurrent ? colors.bgRaised : "transparent",
                  border: isCurrent
                    ? `1px solid ${isDelayed ? colors.flareDim : colors.iceDim}`
                    : "1px solid transparent",
                }}
              >
                {/* Step Node Icon */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${
                    isCurrent ? "scale-105 shadow-sm" : ""
                  }`}
                  style={{
                    background: circleBg,
                    border: `2px solid ${circleBorder}`,
                    color: circleColor,
                  }}
                >
                  {isCompleted ? (
                    <Check size={18} strokeWidth={2.5}/>
                  ) : isCurrent && isDelayed ? (
                    <AlertTriangle size={18}/>
                  ) : isCurrent && idx === 3 && currentStatus === "received" ? (
                    <CheckCircle2 size={18}/>
                  ) : (
                    <Icon size={18}/>
                  )}
                </div>

                {/* Stage Info */}
                <div className="flex flex-col min-w-0 w-full sm:items-center">
                  <div className="flex items-center gap-1.5 sm:justify-center flex-wrap">
                    <span
                      className="text-xs font-semibold leading-tight break-words"
                      style={{
                        color: isCurrent
                          ? isDelayed
                            ? colors.flare
                            : colors.text
                          : isCompleted
                            ? colors.text
                            : colors.textFaint,
                      }}
                    >
                      {displayLabel}
                    </span>
                    {isCurrent && (
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase tracking-wider flex-shrink-0"
                        style={{
                          background: isDelayed
                            ? colors.flareBg
                            : colors.iceBg,
                          color: isDelayed ? colors.flare : colors.ice,
                          border: `1px solid ${
                            isDelayed ? colors.flareDim : colors.iceDim
                          }`,
                        }}
                      >
                        {isDelayed ? "Delayed" : "Current"}
                      </span>
                    )}
                    {isCompleted && (
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.2 rounded uppercase tracking-wider flex-shrink-0"
                        style={{
                          background: colors.auroraBg,
                          color: colors.aurora,
                          border: `1px solid ${colors.auroraDim}`,
                        }}
                      >
                        Done
                      </span>
                    )}
                  </div>

                  <span
                    className="text-[10px] leading-tight break-words mt-0.5"
                    style={{color: colors.textMuted}}
                  >
                    {displaySublabel}
                  </span>

                  {ts && (
                    <span
                      className="text-[10px] leading-tight font-mono mt-1"
                      style={{
                        ...mono,
                        color: isCompleted ? colors.aurora : colors.textFaint,
                      }}
                      title={formatDateTime(ts)}
                    >
                      {new Date(ts).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
