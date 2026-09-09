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
      bg: colors.iceBg,
      b: colors.iceDim,
    },
    amber: {
      c: colors.amber,
      bg: colors.amberBg,
      b: colors.amberDim,
    },
    flare: {
      c: colors.flare,
      bg: colors.flareTint,
      b: colors.flareDim,
    },
    aurora: {
      c: colors.aurora,
      bg: colors.auroraBg,
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
