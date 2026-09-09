import { colors, mono, toneColors } from "../../theme.js";

const StatCard = ({ icon: Icon, label, value, unit, sub, tone = "ice" }) => {
  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-3"
      style={{ background: colors.panel, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: colors.textMuted }}>
          {label}
        </span>
        <Icon size={16} color={toneColors[tone]} strokeWidth={1.75} />
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[26px] font-semibold leading-none"
          style={{ color: colors.text, ...mono }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm" style={{ color: colors.textMuted }}>
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <span className="text-xs" style={{ color: colors.textFaint }}>
          {sub}
        </span>
      )}
    </div>
  );
};

export default StatCard;
