import { colors } from "../../theme.js";

const Pill = ({ children, tone = "muted" }) => {
  const tones = {
    muted: {
      c: colors.textMuted,
      bg: colors.panelAlt,
      b: colors.border,
    },
    ice: {
      c: colors.ice,
      bg: "rgba(99, 196, 214, 0.1)",
      b: colors.iceDim,
    },
    amber: { c: colors.amber, bg: "rgba(232,160,61,0.12)", b: colors.amberDim },
    flare: { c: colors.flare, bg: "rgba(232,93,93,0.14)", b: colors.flareDim },
    aurora: {
      c: colors.aurora,
      bg: "rgba(127,224,168,0.12)",
      b: colors.auroraDim,
    },
  };

  const s = tones[tone] || tones.muted;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium"
      style={{ color: s.c, background: s.bg, border: `1px solid ${s.b}` }}
    >
      {children}
    </span>
  );
};

export default Pill;
