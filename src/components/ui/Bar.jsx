import { colors, toneColors } from "../../theme.js";

const Bar = ({ value, tone = "ice", height = 6 }) => {
  const color = toneColors[tone] || colors.ice;

  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ background: colors.borderSoft, height }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color,
        }}
      />
    </div>
  );
};

export default Bar;
