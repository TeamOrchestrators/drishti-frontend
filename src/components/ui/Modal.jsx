import { X } from "lucide-react";
import { colors } from "../../theme.js";

// A simple centered dialog. Pass `onClose` and put a <form> inside as children.
const Modal = ({ title, onClose, children, width = 480 }) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(6,8,12,0.7)" }}
            onClick={onClose}
        >
            <div
                className="rounded-lg w-full max-h-[85vh] overflow-auto"
                style={{ background: colors.panel, border: `1px solid ${colors.border}`, maxWidth: width }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="flex items-center justify-between px-5 py-4 sticky top-0"
                    style={{ borderBottom: `1px solid ${colors.borderSoft}`, background: colors.panel }}
                >
                    <h3 className="text-[15px] font-semibold" style={{ color: colors.text }}>{title}</h3>
                    <button onClick={onClose} style={{ color: colors.textMuted }}>
                        <X size={18} />
                    </button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

export default Modal;