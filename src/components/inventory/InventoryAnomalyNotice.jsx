import { AlertTriangle } from "lucide-react";
import { colors } from "../../theme";

/**
 * Isolated InventoryAnomalyNotice Component
 * Displays an amber warning banner if consumption anomaly is detected by AI analytics.
 */
export default function InventoryAnomalyNotice({ anomalyDetected, anomalyMessage }) {
  if (!anomalyDetected || !anomalyMessage) {
    return null;
  }

  return (
    <div
      className="flex items-start gap-2.5 p-2.5 rounded-md text-xs"
      style={{
        background: colors.amberBg,
        border: `1px solid ${colors.amberDim}`,
        color: colors.amber,
      }}
    >
      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" color={colors.amber} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-[11px] uppercase tracking-wider">
          Anomaly Detected
        </span>
        <span className="text-xs leading-relaxed" style={{ color: colors.text }}>
          {anomalyMessage}
        </span>
      </div>
    </div>
  );
}
