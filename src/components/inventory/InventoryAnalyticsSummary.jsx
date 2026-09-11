import { Calendar, Clock, TrendingDown } from "lucide-react";
import { colors, mono } from "../../theme";

/**
 * Isolated InventoryAnalyticsSummary Component
 * Displays AI-calculated stock longevity and consumption analytics on inventory cards.
 */
export default function InventoryAnalyticsSummary({ analytics, unit = "units" }) {
  if (!analytics) return null;

  const {
    days_of_stock_remaining,
    predicted_depletion_date,
    average_daily_consumption,
  } = analytics;

  const hasData =
    days_of_stock_remaining != null ||
    predicted_depletion_date ||
    average_daily_consumption != null;

  if (!hasData) return null;

  return (
    <div
      className="rounded-md p-2.5 flex flex-col gap-2 text-xs"
      style={{
        background: colors.panelAlt,
        border: `1px solid ${colors.borderSoft}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold tracking-wider uppercase flex items-center gap-1.5"
          style={{ color: colors.ice }}
        >
          AI Stock Forecast
        </span>
      </div>

      <div className="flex flex-col gap-1.5 pt-0.5">
        {days_of_stock_remaining != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5" style={{ color: colors.textMuted }}>
              <Clock size={12} style={{ color: colors.textFaint }} />
              <span>Estimated stock remaining:</span>
            </span>
            <span className="font-semibold" style={{ color: colors.text, ...mono }}>
              {days_of_stock_remaining} {days_of_stock_remaining === 1 ? "day" : "days"}
            </span>
          </div>
        )}

        {predicted_depletion_date && (
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5" style={{ color: colors.textMuted }}>
              <Calendar size={12} style={{ color: colors.textFaint }} />
              <span>Predicted depletion:</span>
            </span>
            <span className="font-medium" style={{ color: colors.text, ...mono }}>
              {predicted_depletion_date}
            </span>
          </div>
        )}

        {average_daily_consumption != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5" style={{ color: colors.textMuted }}>
              <TrendingDown size={12} style={{ color: colors.textFaint }} />
              <span>Average daily consumption:</span>
            </span>
            <span className="font-medium" style={{ color: colors.text, ...mono }}>
              {average_daily_consumption} {unit}/day
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
