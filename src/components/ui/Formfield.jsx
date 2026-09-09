import { colors } from "../../theme";

const baseStyle = {
    background: colors.bgRaised,
    border: `1px solid ${colors.border}`,
    color: colors.text,
};

// A labeled input, select, or textarea for use inside forms/modals.
// Usage: <FormField label="Item name" value={x} onChange={setX} />
//        <FormField label="Priority" as="select" options={["Critical","Standard"]} value={x} onChange={setX} />
const FormField = ({ label, as = "input", options, value, onChange, type = "text", placeholder, required }) => {
    const commonProps = {
        className: "w-full rounded-md px-3 py-2 text-sm outline-none",
        style: baseStyle,
        value,
        onChange: (e) => onChange(e.target.value),
        placeholder,
        required,
    };

    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: colors.textMuted }}>{label}</span>
            {as === "select" ? (
                <select {...commonProps}>
                    <option value="" disabled>Select...</option>
                    {options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                    ))}
                </select>
            ) : as === "textarea" ? (
                <textarea {...commonProps} rows={2} />
            ) : (
                <input {...commonProps} type={type} />
            )}
        </label>
    );
}

export default FormField;