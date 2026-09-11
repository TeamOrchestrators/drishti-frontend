import { TriangleAlert } from "lucide-react";
import { colors, mono } from "../../theme";

/**
 * Isolated StockAlerts Component
 * Derives critical and low-stock alerts from item.stock_level.
 * Isolated so it can be easily replaced/enriched by the Python warning-service later.
 */
export default function StockAlerts({ items = [] }) {
  const criticalAlerts = items.filter(
    (i) => (i.stock_level || "").toLowerCase() === "critical"
  );
  const lowAlerts = items.filter(
    (i) => (i.stock_level || "").toLowerCase() === "low"
  );

  if (criticalAlerts.length === 0 && lowAlerts.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
      {/* Critical Stock Alert Panel */}
      <div
        className="rounded-lg p-4"
        style={{
          background: colors.flareBg,
          border: `1px solid ${colors.flareDim}`,
        }}
      >
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
          <div className="flex flex-col gap-1.5">
            {criticalAlerts.map((i) => (
              <div
                key={i.inventory_id || i.item_code || i.name}
                className="text-xs flex items-center justify-between py-1 gap-2"
                style={{ color: colors.textMuted }}
              >
                <div className="truncate">
                  <span className="font-medium" style={{ color: colors.text }}>
                    {i.name}
                  </span>
                  <span className="ml-1.5" style={{ color: colors.textFaint }}>
                    ({i.category})
                  </span>
                </div>
                <span className="flex-shrink-0 font-medium" style={{ color: colors.flare, ...mono }}>
                  {i.available_quantity} / {i.minimum_quantity} {i.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Low Stock Alert Panel */}
      <div
        className="rounded-lg p-4"
        style={{
          background: colors.amberBg,
          border: `1px solid ${colors.amberDim}`,
        }}
      >
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
          <div className="flex flex-col gap-1.5">
            {lowAlerts.map((i) => (
              <div
                key={i.inventory_id || i.item_code || i.name}
                className="text-xs flex items-center justify-between py-1 gap-2"
                style={{ color: colors.textMuted }}
              >
                <div className="truncate">
                  <span className="font-medium" style={{ color: colors.text }}>
                    {i.name}
                  </span>
                  <span className="ml-1.5" style={{ color: colors.textFaint }}>
                    ({i.category})
                  </span>
                </div>
                <span className="flex-shrink-0 font-medium" style={{ color: colors.amber, ...mono }}>
                  {i.available_quantity} / {i.minimum_quantity} {i.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
