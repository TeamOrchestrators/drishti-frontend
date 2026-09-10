import { colors } from "../../theme.js";

const SectionHeading = ({ children, right }) => {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
      <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
        {children}
      </h2>
      {right}
    </div>
  );
};

export default SectionHeading;
