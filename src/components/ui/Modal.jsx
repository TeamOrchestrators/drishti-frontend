import { X } from "lucide-react";
import { colors } from "../../theme.js";

// A simple centered dialog. Pass `onClose` and put a <form> inside as children.
const Modal = ({ title, onClose, children, width = 480 }) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs"
            style={{ background: colors.modalOverlay }}
            onClick={onClose}
        >
            <div
                className="rounded-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                style={{ background: colors.panel, border: `1px solid ${colors.border}`, maxWidth: width }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 sticky top-0 z-10"
                    style={{ borderBottom: `1px solid ${colors.borderSoft}`, background: colors.panel }}
                >
                    <h3 className="text-[15px] font-semibold" style={{ color: colors.text }}>{title}</h3>
                    <button onClick={onClose} className="p-1 cursor-pointer hover:opacity-80 transition-opacity" style={{ color: colors.textMuted }} aria-label="Close dialog">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 sm:p-5">{children}</div>
            </div>
        </div>
    );
}

export default Modal;