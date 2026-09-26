import {useState, useRef} from "react";
import {QRCodeCanvas} from "qrcode.react";
import {
  Download,
  Printer,
  Copy,
  Check,
  X,
  Package,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {colors, mono} from "../../theme.js";
import Pill from "../ui/Pill.jsx";
import {
  cargoStatusTone,
  priorityTone,
  formatStatus,
  formatPriority,
} from "../../utils/cargoUtils.js";
import drishtiLogo from "../../assets/logo.png";

export default function CargoQrModal({isOpen, onClose, cargo, isNewlyCreated = false}) {
  const [copied, setCopied] = useState(false);
  const qrWrapperRef = useRef(null);

  if (!isOpen || !cargo) return null;

  const qrToken = cargo.qr_token || cargo.id || "";
  const cargoCode = cargo.cargo_code || "CG-LOGISTICS";
  const originStation = cargo.origin_station_name || "Station Origin";
  const destinationStation = cargo.destination_station_name || "Station Destination";
  const priority = cargo.priority || "standard";
  const status = cargo.status || "draft";
  const expeditionName = cargo.expedition_name || cargo.expedition_code || "";

  const handleCopyUuid = () => {
    if (!qrToken) return;
    navigator.clipboard.writeText(qrToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadPng = () => {
    const qrCanvas = qrWrapperRef.current?.querySelector("canvas");
    if (!qrCanvas) return;

    // Create high-res label canvas suitable for package label affixing
    const exportCanvas = document.createElement("canvas");
    const ctx = exportCanvas.getContext("2d");
    const size = 520;
    const headerHeight = 90;
    const footerHeight = 150;
    exportCanvas.width = size;
    exportCanvas.height = size + headerHeight + footerHeight;

    // Crisp white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Subtle border on package label
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000000";
    ctx.strokeRect(12, 12, exportCanvas.width - 24, exportCanvas.height - 24);

    // Header branding
    ctx.fillStyle = "#000000";
    ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DRISHTI POLAR LOGISTICS", size / 2, 50);

    ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#444444";
    ctx.fillText("INDIAN ANTARCTIC EXPEDITION DISPATCH", size / 2, 75);

    // Draw QR canvas in center
    const qrSize = 400;
    const qrOffset = (size - qrSize) / 2;
    ctx.drawImage(qrCanvas, qrOffset, headerHeight + 10, qrSize, qrSize);

    // Cargo code in bold monospace
    ctx.fillStyle = "#000000";
    ctx.font = "bold 32px monospace";
    ctx.fillText(cargoCode, size / 2, headerHeight + qrSize + 48);

    // Route info
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#222222";
    ctx.fillText(`${originStation} → ${destinationStation}`, size / 2, headerHeight + qrSize + 80);

    // Priority & Status
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#555555";
    ctx.fillText(`PRIORITY: ${formatPriority(priority).toUpperCase()}  |  STATUS: ${formatStatus(status).toUpperCase()}`, size / 2, headerHeight + qrSize + 106);

    // UUID Token
    ctx.font = "11px monospace";
    ctx.fillStyle = "#666666";
    ctx.fillText(`UUID: ${qrToken}`, size / 2, headerHeight + qrSize + 132);

    // Trigger download
    const cleanCode = (cargoCode || "cargo").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const link = document.createElement("a");
    link.download = `drishti-${cleanCode}-qr.png`;
    link.href = exportCanvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* On-screen Interactive Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs"
        style={{background: colors.modalOverlay}}
        onClick={onClose}
      >
        <div
          className="rounded-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col"
          style={{
            background: colors.panel,
            border: `1px solid ${colors.border}`,
            maxWidth: 480,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div
            className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
            style={{
              borderBottom: `1px solid ${colors.borderSoft}`,
              background: colors.panel,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isNewlyCreated ? (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{background: colors.auroraBg, color: colors.aurora}}
                >
                  <ShieldCheck size={16}/>
                </div>
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{background: colors.iceBg, color: colors.ice}}
                >
                  <Package size={16}/>
                </div>
              )}
              <h3 className="text-base font-semibold truncate" style={{color: colors.text}}>
                {isNewlyCreated ? "Cargo QR generated" : "Cargo QR code & label"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
              style={{color: colors.textMuted}}
              aria-label="Close dialog"
            >
              <X size={18}/>
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-5 flex flex-col items-center gap-5">
            {isNewlyCreated && (
              <div
                className="w-full text-xs px-3.5 py-2 rounded-lg flex items-center gap-2"
                style={{
                  background: colors.auroraBg,
                  color: colors.aurora,
                  border: `1px solid ${colors.auroraDim}`,
                }}
              >
                <Check size={14} className="flex-shrink-0"/>
                <span>Cargo registered successfully. QR token generated for scanning.</span>
              </div>
            )}

            {/* QR Code Container with High-Contrast White Surface */}
            <div
              ref={qrWrapperRef}
              className="p-4 rounded-xl flex flex-col items-center justify-center shadow-inner"
              style={{background: "#ffffff", border: "1px solid #d1d5db"}}
            >
              <QRCodeCanvas
                value={qrToken}
                size={220}
                level="H"
                includeMargin={true}
              />
              <span className="text-[11px] font-semibold tracking-wider text-slate-500 mt-1 uppercase">
                Scan with DRISHTI Terminal
              </span>
            </div>

            {/* Identifiers and Badges */}
            <div className="w-full flex flex-col items-center gap-2 text-center">
              <div
                className="text-xl font-bold tracking-wider"
                style={{...mono, color: colors.text}}
              >
                {cargoCode}
              </div>

              {/* Badges for Priority and Status */}
              <div className="flex items-center gap-2">
                <Pill tone={priorityTone(priority)}>
                  {formatPriority(priority)} priority
                </Pill>
                <Pill tone={cargoStatusTone(status)}>
                  {formatStatus(status)}
                </Pill>
              </div>

              {/* Route */}
              <div
                className="flex items-center justify-center gap-1.5 text-xs font-medium mt-1"
                style={{color: colors.textMuted}}
              >
                <span style={{color: colors.text}}>{originStation}</span>
                <ArrowRight size={13} style={{color: colors.ice}}/>
                <span style={{color: colors.text}}>{destinationStation}</span>
              </div>

              {expeditionName && (
                <div className="text-[11px]" style={{color: colors.textFaint}}>
                  Expedition: {expeditionName}
                </div>
              )}

              {/* UUID Copy Box */}
              <div
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs mt-2"
                style={{
                  background: colors.bgRaised,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div className="flex flex-col items-start min-w-0 pr-2">
                  <span className="text-[10px] uppercase font-semibold" style={{color: colors.textFaint}}>
                    Cargo UUID / QR Token
                  </span>
                  <span
                    className="font-mono text-xs truncate max-w-[280px]"
                    style={{color: colors.text}}
                    title={qrToken}
                  >
                    {qrToken}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUuid}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded cursor-pointer transition-opacity hover:opacity-80 flex-shrink-0"
                  style={{
                    background: copied ? colors.auroraBg : colors.panelAlt,
                    color: copied ? colors.aurora : colors.textMuted,
                    border: `1px solid ${copied ? colors.auroraDim : colors.borderSoft}`,
                  }}
                  title="Copy UUID to clipboard"
                >
                  {copied ? <Check size={12}/> : <Copy size={12}/>}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons: Visible on desktop and mobile */}
            <div
              className="w-full grid grid-cols-2 gap-3 pt-3"
              style={{borderTop: `1px solid ${colors.borderSoft}`}}
            >
              <button
                type="button"
                onClick={handleDownloadPng}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer transition-opacity hover:opacity-90"
                style={{
                  background: colors.ice,
                  color: colors.iceButtonText,
                }}
              >
                <Download size={14}/>
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer transition-opacity hover:opacity-90"
                style={{
                  background: colors.bgRaised,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <Printer size={14}/>
                <span>Print label</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full text-xs font-medium py-2 rounded-lg cursor-pointer transition-colors text-center"
              style={{
                color: colors.textMuted,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Print Container: Only rendered on paper via @media print */}
      <div id="drishti-cargo-print-label" className="hidden">
        <div style={{textAlign: "center", marginBottom: 16}}>
          <img
            src={drishtiLogo}
            alt="DRISHTI"
            style={{height: 42, width: "auto", margin: "0 auto 6px auto", display: "block"}}
          />
          <div style={{fontSize: 18, fontWeight: "bold", letterSpacing: 1.5, color: "#000000"}}>
            DRISHTI POLAR LOGISTICS
          </div>
          <div style={{fontSize: 10, color: "#555555", textTransform: "uppercase", letterSpacing: 1}}>
            National Antarctic Operations · NCAOR Dispatch Label
          </div>
        </div>

        <div
          style={{
            borderTop: "2px dashed #000000",
            borderBottom: "2px dashed #000000",
            padding: "16px 0",
            margin: "12px 0",
            textAlign: "center",
          }}
        >
          <div style={{fontSize: 32, fontWeight: "bold", fontFamily: "monospace", color: "#000000"}}>
            {cargoCode}
          </div>
          <div style={{fontSize: 14, fontWeight: "bold", marginTop: 4, color: "#111111"}}>
            {originStation} → {destinationStation}
          </div>
        </div>

        <div style={{display: "flex", justifyContent: "center", margin: "16px 0"}}>
          <QRCodeCanvas
            value={qrToken}
            size={220}
            level="H"
            includeMargin={true}
          />
        </div>

        <div style={{
          fontSize: 11,
          fontFamily: "monospace",
          textAlign: "center",
          wordBreak: "break-all",
          marginBottom: 12
        }}>
          <strong>UUID:</strong> {qrToken}
        </div>

        <table style={{width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 12}}>
          <tbody>
          <tr>
            <td style={{padding: "4px 0", color: "#555555"}}>Priority:</td>
            <td style={{padding: "4px 0", textAlign: "right", fontWeight: "bold", textTransform: "uppercase"}}>
              {formatPriority(priority)}
            </td>
          </tr>
          <tr>
            <td style={{padding: "4px 0", color: "#555555"}}>Current Status:</td>
            <td style={{padding: "4px 0", textAlign: "right", fontWeight: "bold", textTransform: "uppercase"}}>
              {formatStatus(status)}
            </td>
          </tr>
          {expeditionName && (
            <tr>
              <td style={{padding: "4px 0", color: "#555555"}}>Expedition:</td>
              <td style={{padding: "4px 0", textAlign: "right", fontWeight: "bold"}}>
                {expeditionName}
              </td>
            </tr>
          )}
          <tr>
            <td style={{padding: "4px 0", color: "#555555"}}>Print Timestamp:</td>
            <td style={{padding: "4px 0", textAlign: "right"}}>
              {new Date().toLocaleString()}
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
