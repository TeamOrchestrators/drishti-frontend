import { TriangleAlert, CheckCircle2 } from "lucide-react";
import { colors, mono } from "../../theme";

/**
 * Isolated InventoryAlerts Component
 * Renders Critical-stock and Low-stock AI alert panels from the Go backend endpoint response.
 * Completely hidden when analytics_available is false.
 */
export default function InventoryAlerts({ alerts = [], analyticsAvailable = false }) {
  // If analytics service is unavailable, hide AI alert panels entirely
  if (!analyticsAvailable) {
    return null;
  }

  // If analytics is available but no alerts exist, show confirmation
  if (!alerts || alerts.length === 0) {
    return (
      <div
        className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-xs"
        style={{
          background: colors.panelAlt,
          border: `1px solid ${colors.borderSoft}`,
          color: colors.textMuted,
        }}
      >
        <CheckCircle2 size={15} color={colors.aurora} className="flex-shrink-0" />
        <span className="font-medium" style={{ color: colors.text }}>
          No active AI inventory alerts
        </span>
        <span className="text-[11px]" style={{ color: colors.textFaint }}>
          — Station stock levels are currently within safe operational boundaries.
        </span>
      </div>
    );
  }

  const criticalAlerts = alerts.filter(
    (a) => (a.status || "").toLowerCase() === "critical"
  );
  const lowAlerts = alerts.filter(
    (a) => (a.status || "").toLowerCase() !== "critical"
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
      {/* Critical Stock Alert Panel */}
      <div
        className="rounded-lg p-4 flex flex-col justify-between"
        style={{
          background: colors.flareBg,
          border: `1px solid ${colors.flareDim}`,
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <TriangleAlert size={15} color={colors.flare} className="flex-shrink-0" />
            <span className="text-sm font-semibold" style={{ color: colors.flare }}>
              Critical-stock alerts ({criticalAlerts.length})
            </span>
          </div>
          {criticalAlerts.length === 0 ? (
            <span className="text-xs" style={{ color: colors.textFaint }}>
              No critical stock alerts right now.
            </span>
          ) : (
            <div className="flex flex-col gap-2">
              {criticalAlerts.map((alert, idx) => (
                <div
                  key={alert.inventory_id || idx}
                  className="py-1.5 border-b last:border-b-0 flex flex-col gap-0.5"
                  style={{ borderColor: colors.flareDim }}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold truncate" style={{ color: colors.text }}>
                      {alert.item_name}
                    </span>
                    <span
                      className="flex-shrink-0 font-medium"
                      style={{ color: colors.flare, ...mono }}
                    >
                      {alert.available_quantity} / {alert.minimum_quantity}
                    </span>
                  </div>
                  {alert.message && (
                    <span className="text-[11px] leading-relaxed" style={{ color: colors.textMuted }}>
                      {alert.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alert Panel */}
      <div
        className="rounded-lg p-4 flex flex-col justify-between"
        style={{
          background: colors.amberBg,
          border: `1px solid ${colors.amberDim}`,
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <TriangleAlert size={15} color={colors.amber} className="flex-shrink-0" />
            <span className="text-sm font-semibold" style={{ color: colors.amber }}>
              Low-stock alerts ({lowAlerts.length})
            </span>
          </div>
          {lowAlerts.length === 0 ? (
            <span className="text-xs" style={{ color: colors.textFaint }}>
              All other items are currently above minimum threshold.
            </span>
          ) : (
            <div className="flex flex-col gap-2">
              {lowAlerts.map((alert, idx) => (
                <div
                  key={alert.inventory_id || idx}
                  className="py-1.5 border-b last:border-b-0 flex flex-col gap-0.5"
                  style={{ borderColor: colors.amberDim }}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold truncate" style={{ color: colors.text }}>
                      {alert.item_name}
                    </span>
                    <span
                      className="flex-shrink-0 font-medium"
                      style={{ color: colors.amber, ...mono }}
                    >
                      {alert.available_quantity} / {alert.minimum_quantity}
                    </span>
                  </div>
                  {alert.message && (
                    <span className="text-[11px] leading-relaxed" style={{ color: colors.textMuted }}>
                      {alert.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
