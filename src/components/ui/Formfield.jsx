import { colors } from "../../theme";

const baseStyle = {
    background: colors.bgRaised,
    border: `1px solid ${colors.border}`,
    color: colors.text,
};

// A labeled input, select, or textarea for use inside forms/modals.
// Usage: <FormField label="Item name" value={x} onChange={setX} />
//        <FormField label="Priority" as="select" options={["Critical","Standard"]} value={x} onChange={setX} />
const FormField = ({
    label,
    as = "input",
    options,
    value,
    onChange,
    type = "text",
    placeholder,
    required,
    disabled = false,
    readOnly = false,
    min,
    max,
    ...rest
}) => {
    const isNonEditable = disabled || readOnly;

    const style = {
        background: isNonEditable ? colors.panelAlt : colors.bgRaised,
        border: `1px solid ${colors.border}`,
        color: isNonEditable ? colors.textMuted : colors.text,
        cursor: isNonEditable ? "not-allowed" : "auto",
        opacity: isNonEditable ? 0.8 : 1,
    };

    const commonProps = {
        className: "w-full rounded-md px-3 py-2 text-sm outline-none transition-colors",
        style,
        value,
        onChange: (e) => onChange && onChange(e.target.value),
        placeholder,
        required,
        disabled,
        readOnly,
        min,
        max,
        ...rest,
    };

    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: colors.textMuted }}>{label}</span>
            {as === "select" ? (
                <select
                    className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors"
                    style={style}
                    value={value}
                    onChange={(e) => onChange && onChange(e.target.value)}
                    required={required}
                    disabled={disabled}
                >
                    <option value="" disabled>{placeholder || "Select..."}</option>
                    {options?.map((o) => {
                        const val = typeof o === "object" && o !== null ? o.value : o;
                        const lbl = typeof o === "object" && o !== null ? o.label : o;
                        return (
                            <option key={val} value={val}>
                                {lbl}
                            </option>
                        );
                    })}
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