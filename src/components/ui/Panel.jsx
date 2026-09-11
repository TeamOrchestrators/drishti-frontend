import { colors } from "../../theme.js";

const Panel = ({ title, action, right, children, style }) => {
  return (
    <div
      className="rounded-lg"
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
        ...style,
      }}
    >
      {title && (
        <div
          className="flex items-center justify-between flex-wrap gap-2 px-4 sm:px-5 py-3.5 sm:py-4"
          style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
        >
          <h3
            className="text-[15px] font-semibold"
            style={{ color: colors.text }}
          >
            {title}
          </h3>
          {action || right}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
};

export default Panel;
