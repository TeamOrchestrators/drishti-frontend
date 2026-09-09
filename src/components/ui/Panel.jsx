import { colors } from "../../theme.js";

const Panel = ({ title, action, children, style }) => {
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
          className="flex items-center justify-center px-5 py-4"
          style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
        >
          <h3
            className="text-[15px] font-semibold"
            style={{ color: colors.text }}
          >
            {title}
          </h3>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};

export default Panel;
