import {useState, useEffect, useRef, useCallback} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {Html5Qrcode} from "html5-qrcode";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Search,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Package,
  Layers,
  Compass,
  ArrowRight,
  Clock,
  QrCode,
  Loader2,
  Smartphone,
  Navigation,
  Check,
  Send,
  Calendar,
  User,
  Sliders,
  Upload,
} from "lucide-react";
import {colors, mono} from "../../theme.js";
import Pill from "../ui/Pill.jsx";
import SectionHeading from "../ui/SectionHeading.jsx";
import FormField from "../ui/Formfield.jsx";
import {cargoApi} from "../../services/api.js";
import {formatCoordinates, isValidCoordinate} from "../../utils/geo.js";
import {
  eventTypeOptions,
  cargoStatusTone,
  priorityTone,
  eventTypeTone,
  formatStatus,
  formatPriority,
  formatEventType,
  formatDateTime,
} from "../../utils/cargoUtils.js";
import CargoQrModal from "../cargo/CargoQrModal.jsx";
import CargoTimeline from "../cargo/CargoTimeline.jsx";
import BatchMap from "../cargo/BatchMap.jsx";
import {useCargoStore} from "../../store/useCargoStore.js";
import {useExpeditionStore} from "../../store/useExpeditionStore.js";

export default function CargoScan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Store stations for map geocoding if needed
  const stations = useExpeditionStore((s) => s.stations);

  // QR Token & Lookup State
  const initialToken = searchParams.get("token") || "";
  const [manualToken, setManualToken] = useState(initialToken);
  const [activeToken, setActiveToken] = useState(initialToken);
  const [cargoData, setCargoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  // Camera & Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [scanningFile, setScanningFile] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Checkpoint Form State
  const [checkpointEvent, setCheckpointEvent] = useState("scanned");
  const [checkpointNotes, setCheckpointNotes] = useState("");
  const [applyToBatch, setApplyToBatch] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [coords, setCoords] = useState(null); // { latitude, longitude }
  const [manualLatInput, setManualLatInput] = useState("");
  const [manualLngInput, setManualLngInput] = useState("");
  const [showManualCoords, setShowManualCoords] = useState(false);

  const [locationStatus, setLocationStatus] = useState("idle"); // "idle" | "acquiring" | "ready" | "denied" | "timeout" | "error"
  const [locating, setLocating] = useState(false);
  const [locatingError, setLocatingError] = useState(null);
  const [submittingCheckpoint, setSubmittingCheckpoint] = useState(false);
  const [checkpointSuccess, setCheckpointSuccess] = useState(null);
  const [checkpointError, setCheckpointError] = useState(null);

  // QR Modal state (to view QR of retrieved cargo)
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Safe camera stopper
  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {
        console.warn("Error stopping html5-qrcode scanner:", err);
      }
      try {
        scanner.clear();
      } catch (err) {
        console.warn("Error clearing html5-qrcode scanner DOM:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setIsStarting(false);
  }, []);

  // Fetch cargo details by token or cargoId
  const fetchCargoDetails = useCallback(async (tokenOrId) => {
    if (!tokenOrId || !tokenOrId.trim()) return;
    const cleanToken = tokenOrId.trim().split("/").pop(); // Handles raw UUID or full URL
    setLoading(true);
    setLookupError(null);
    setCheckpointSuccess(null);
    setCheckpointError(null);
    setApplyToBatch(false);
    setLastScanResult(null);

    try {
      const data = await cargoApi.getByQrToken(cleanToken);
      if (data && typeof data === "object") {
        setCargoData(data);
        setActiveToken(data.id || cleanToken);
        setManualToken(data.id || cleanToken);
      } else {
        throw new Error("Invalid response format from server.");
      }
    } catch (err) {
      setCargoData(null);
      const errMsg = err.message || "";
      if (errMsg.includes("404") || errMsg.toLowerCase().includes("not found")) {
        setLookupError("Cargo QR not found. Please verify the code or check if the consignment was archived.");
      } else if (errMsg.includes("400") || errMsg.toLowerCase().includes("invalid")) {
        setLookupError("Invalid QR code or token format. Please ensure you are scanning a valid DRISHTI cargo QR.");
      } else {
        setLookupError(errMsg || "Failed to lookup cargo details. Please check network connection.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Start camera scanner
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsStarting(true);
    await stopCamera();

    // 1. Verify mediaDevices support and secure context
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setCameraError(
        "Camera access requires a secure context (HTTPS or localhost). Please access over HTTPS or localhost."
      );
      setIsStarting(false);
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError("Camera API is not supported on this browser or environment.");
      setIsStarting(false);
      return;
    }

    // Set scanning to expand the container before mounting
    setIsScanning(true);
    // Allow React DOM render pass so container clientWidth is available
    await new Promise((r) => setTimeout(r, 80));

    const containerEl = document.getElementById("cargo-qr-reader");
    if (!containerEl) {
      setCameraError("Camera container element could not be found.");
      setIsScanning(false);
      setIsStarting(false);
      return;
    }

    try {
      const qrConfig = {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(Math.floor(minEdge * 0.72), 150);
          return {width: boxSize, height: boxSize};
        },
        aspectRatio: 1.0,
      };

      const onScanSuccess = (decodedText) => {
        stopCamera();
        fetchCargoDetails(decodedText);
      };

      // Determine camera candidates to try in order
      const candidates = [];
      try {
        const cameraList = await Html5Qrcode.getCameras();
        if (Array.isArray(cameraList) && cameraList.length > 0) {
          // If a rear / back camera is identified, prioritize it
          const rearCam = cameraList.find((c) =>
            /back|rear|environment|world/i.test(c.label || "")
          );
          if (rearCam) {
            candidates.push(rearCam.id);
          }
          // Add first camera from list
          if (!candidates.includes(cameraList[0].id)) {
            candidates.push(cameraList[0].id);
          }
          // Add any remaining cameras
          for (const c of cameraList) {
            if (!candidates.includes(c.id)) {
              candidates.push(c.id);
            }
          }
        }
      } catch (listErr) {
        console.warn("Could not enumerate camera devices:", listErr);
      }

      // If no candidates found through enumeration, fallback to facingMode constraints
      if (candidates.length === 0) {
        candidates.push({facingMode: "environment"});
        candidates.push({facingMode: "user"});
      }

      let activeScanner = null;
      let lastErr = null;

      for (const candidate of candidates) {
        try {
          const qrInstance = new Html5Qrcode("cargo-qr-reader");
          scannerRef.current = qrInstance;
          await qrInstance.start(candidate, qrConfig, onScanSuccess, () => {
          });
          activeScanner = qrInstance;
          break;
        } catch (candidateErr) {
          console.warn("Candidate camera failed:", candidate, candidateErr);
          lastErr = candidateErr;
          if (scannerRef.current) {
            try {
              scannerRef.current.clear();
            } catch (_) {
            }
            scannerRef.current = null;
          }
        }
      }

      if (!activeScanner) {
        throw lastErr || new Error("Failed to start camera with available devices.");
      }

      setIsScanning(true);
      setIsStarting(false);
    } catch (err) {
      console.error("Camera start failure:", err);
      await stopCamera();
      setIsScanning(false);
      setIsStarting(false);
      const msg = err?.message || String(err);
      if (
        msg.includes("NotAllowedError") ||
        msg.includes("PermissionDeniedError") ||
        msg.toLowerCase().includes("permission")
      ) {
        setCameraError(
          "Camera permission was denied. Please allow camera access in your browser settings to scan cargo QR codes."
        );
      } else if (
        msg.includes("NotFoundError") ||
        msg.includes("DevicesNotFoundError") ||
        msg.toLowerCase().includes("not found")
      ) {
        setCameraError(
          "No camera device was detected on your system. Use manual UUID lookup or upload a QR image below."
        );
      } else if (
        msg.includes("NotReadableError") ||
        msg.includes("TrackStartError")
      ) {
        setCameraError(
          "Camera hardware is in use by another application or tab. Please close other camera apps and retry."
        );
      } else if (msg.includes("OverconstrainedError")) {
        setCameraError(
          "Camera device constraints could not be satisfied. Please check your camera settings."
        );
      } else {
        setCameraError(`Unable to start camera: ${msg}`);
      }
    }
  }, [stopCamera, fetchCargoDetails]);

  // Handle image file QR scan
  const handleFileScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningFile(true);
    setCameraError(null);
    try {
      const html5Qr = new Html5Qrcode("cargo-qr-reader");
      const decodedText = await html5Qr.scanFile(file, true);
      try {
        html5Qr.clear();
      } catch (_) {
      }
      fetchCargoDetails(decodedText);
    } catch (err) {
      console.warn("File QR scan failed:", err);
      setCameraError(
        "Could not detect a valid QR code in the uploaded image. Please try another image or enter the token manually."
      );
    } finally {
      setScanningFile(false);
      if (e.target) e.target.value = "";
    }
  };

  // Initial lookup if token was passed in query params
  useEffect(() => {
    let active = true;
    if (initialToken) {
      const timer = setTimeout(() => {
        if (active) {
          fetchCargoDetails(initialToken);
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [initialToken, fetchCargoDetails]);

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Handle manual submit
  const handleManualLookup = (e) => {
    e?.preventDefault();
    if (!manualToken.trim()) return;
    fetchCargoDetails(manualToken);
  };

  // Check if GPS coordinates are valid and not placeholder 0,0
  const hasValidCoords = Boolean(
    coords &&
    coords.latitude != null &&
    coords.longitude != null &&
    isValidCoordinate(coords.latitude, coords.longitude) &&
    !(Number(coords.latitude) === 0 && Number(coords.longitude) === 0)
  );

  // Check if confirmed batch propagation exists (response confirmation or scan history)
  const hasPropagatedCheckpoint = Boolean(
    (lastScanResult?.applied_to_batch === true && Number(lastScanResult?.affected_cargo_count) > 1) ||
    (Array.isArray(cargoData?.scan_history) &&
      cargoData.scan_history.some(
        (sh) => sh.applied_to_batch === true && Number(sh.affected_cargo_count) > 1
      ))
  );

  // Clear coordinates helper
  const handleClearCoords = () => {
    setCoords(null);
    setManualLatInput("");
    setManualLngInput("");
    setLocationStatus("idle");
    setLocatingError(null);
  };

  // Get current device location via browser Geolocation API
  const handleGetLocation = () => {
    setLocationStatus("acquiring");
    setLocating(true);
    setLocatingError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("error");
      setLocatingError("Geolocation is not supported by your browser or device.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (isValidCoordinate(lat, lng) && !(lat === 0 && lng === 0)) {
          setCoords({latitude: lat, longitude: lng});
          setManualLatInput(String(lat));
          setManualLngInput(String(lng));
          setLocationStatus("ready");
          setLocatingError(null);
        } else {
          setLocationStatus("error");
          setLocatingError("Device returned invalid GPS coordinates (0,0). Please retry or enter coordinates manually.");
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setLocationStatus("denied");
          setLocatingError("Location permission denied. Please allow location access or input coordinates manually below.");
        } else if (err.code === 3) {
          setLocationStatus("timeout");
          setLocatingError("GPS request timed out. High-accuracy polar satellite lock could not be established.");
        } else {
          setLocationStatus("error");
          setLocatingError(err.message || "Position unavailable. Please retry or enter coordinates manually.");
        }
      },
      {enableHighAccuracy: true, timeout: 12000, maximumAge: 0}
    );
  };

  // Set manual coordinates helper
  const handleApplyManualCoords = (e) => {
    e?.preventDefault();
    const lat = parseFloat(manualLatInput);
    const lng = parseFloat(manualLngInput);
    if (!isNaN(lat) && !isNaN(lng) && isValidCoordinate(lat, lng) && !(lat === 0 && lng === 0)) {
      setCoords({latitude: lat, longitude: lng});
      setLocationStatus("ready");
      setLocatingError(null);
    } else {
      setLocationStatus("error");
      setLocatingError("Invalid coordinates entered. Latitude must be -90 to 90, Longitude -180 to 180, and not placeholder 0,0.");
    }
  };

  const handleSetPresetCoords = (lat, lng) => {
    if (isValidCoordinate(lat, lng) && !(lat === 0 && lng === 0)) {
      setCoords({latitude: lat, longitude: lng});
      setManualLatInput(String(lat));
      setManualLngInput(String(lng));
      setLocationStatus("ready");
      setLocatingError(null);
    }
  };

  // Submit scan checkpoint: POST /api/cargo/qr/{cargoId}/scan
  const handleRecordCheckpoint = async (e) => {
    e.preventDefault();
    const targetId = cargoData?.id || activeToken;
    if (!targetId) return;

    // GPS coordinates are mandatory; placeholder 0,0 rejected
    if (
      !coords ||
      coords.latitude == null ||
      coords.longitude == null ||
      !isValidCoordinate(coords.latitude, coords.longitude) ||
      (Number(coords.latitude) === 0 && Number(coords.longitude) === 0)
    ) {
      setCheckpointError(
        "GPS coordinates are mandatory to record a checkpoint. Please acquire device location or enter coordinates."
      );
      return;
    }

    setCheckpointError(null);
    setCheckpointSuccess(null);
    setSubmittingCheckpoint(true);

    const hasBatch = Boolean(cargoData?.logistics_batch_id || cargoData?.logistics_batch_code);

    // Exact backend contract:
    // event_type, latitude, longitude, notes (never message), apply_to_batch
    const payload = {
      event_type: checkpointEvent || "scanned",
      latitude: Number(coords.latitude),
      longitude: Number(coords.longitude),
      notes: checkpointNotes ? checkpointNotes.trim() : "",
      apply_to_batch: Boolean(hasBatch && applyToBatch),
    };

    try {
      const scanResponse = await cargoApi.recordScan(targetId, payload);
      setLastScanResult(scanResponse);

      // Success message handling based on batch propagation confirmation:
      if (scanResponse?.applied_to_batch && Number(scanResponse?.affected_cargo_count) > 1) {
        setCheckpointSuccess(
          `Checkpoint applied to ${scanResponse.affected_cargo_count} cargo items in ${scanResponse.logistics_batch_code || cargoData?.logistics_batch_code || "batch"}.`
        );
      } else {
        const statusNote = scanResponse?.cargo_status
          ? ` Cargo status updated to ${formatStatus(scanResponse.cargo_status)}.`
          : "";
        setCheckpointSuccess(
          `GPS checkpoint scan recorded successfully.${statusNote}`
        );
      }

      setCheckpointNotes("");
      setApplyToBatch(false);

      // Immediately refetch: GET /api/cargo/qr/{cargoId}
      const freshCargo = await cargoApi.getByQrToken(targetId);
      if (freshCargo && typeof freshCargo === "object") {
        if (scanResponse?.cargo_status && !freshCargo.status) {
          freshCargo.status = scanResponse.cargo_status;
        }
        setCargoData(freshCargo);
      }

      // Also refresh parent cargo-list/store state so status badges update without a full reload
      await useCargoStore.getState().fetchCargo();
    } catch (err) {
      setCheckpointError(err.message || "Failed to record checkpoint.");
    } finally {
      setSubmittingCheckpoint(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
      {/* Top Header & Back Link */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate("/cargo")}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
          style={{
            background: colors.bgRaised,
            color: colors.textMuted,
            border: `1px solid ${colors.border}`,
          }}
        >
          <ArrowLeft size={14}/> Back to Cargo & Logistics
        </button>

        {cargoData && (
          <button
            onClick={() => setQrModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
            style={{
              background: colors.iceBg,
              color: colors.ice,
              border: `1px solid ${colors.iceDim}`,
            }}
          >
            <QrCode size={14}/> View / Print QR Label
          </button>
        )}
      </div>

      <SectionHeading>Cargo QR Scanner</SectionHeading>

      {/* Desktop Notice (Camera scanning is mobile-only; manual UUID is standard on desktop) */}
      <div
        className="hidden md:flex items-start gap-3 p-4 rounded-xl text-xs"
        style={{
          background: colors.panelAlt,
          color: colors.textMuted,
          border: `1px solid ${colors.border}`,
        }}
      >
        <Smartphone size={18} className="flex-shrink-0 mt-0.5" style={{color: colors.ice}}/>
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-sm" style={{color: colors.text}}>
            Mobile Camera Scanner Available
          </span>
          <span>
            Open this page on a mobile field terminal to use live camera barcode scanning.
            On desktop workstations, enter the cargo UUID or QR token below to inspect checkpoints,
            visualize batch maps, and record GPS updates.
          </span>
        </div>
      </div>

      {/* Scanner Control & Camera Viewport Card */}
      <div
        className="rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm"
        style={{
          background: colors.panel,
          border: `1px solid ${colors.border}`,
        }}
      >
        {/* Hidden file input for uploading QR image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileScan}
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Camera size={18} style={{color: colors.ice}}/>
            <h3 className="text-sm font-semibold" style={{color: colors.text}}>
              Optical QR Scanner
            </h3>
            {isScanning && (
              <span
                className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: `${colors.aurora}22`,
                  color: colors.aurora,
                  border: `1px solid ${colors.auroraDim}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                Live Camera Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isStarting || scanningFile}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: colors.panelAlt,
                color: colors.text,
                border: `1px solid ${colors.border}`,
              }}
              title="Upload an image file containing a QR code"
            >
              <Upload size={14} style={{color: colors.ice}}/>
              <span>Upload QR</span>
            </button>

            {!isScanning ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={isStarting || scanningFile}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: colors.ice,
                  color: colors.iceButtonText,
                }}
              >
                {isStarting ? (
                  <Loader2 size={14} className="animate-spin"/>
                ) : (
                  <Camera size={14}/>
                )}
                <span>{isStarting ? "Starting..." : "Start camera"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  background: colors.flareBg,
                  color: colors.flare,
                  border: `1px solid ${colors.flareDim}`,
                }}
              >
                <CameraOff size={14}/>
                <span>Stop camera</span>
              </button>
            )}
          </div>
        </div>

        {/* Camera container */}
        <div
          className={`relative rounded-xl overflow-hidden flex flex-col items-center justify-center transition-all ${
            isScanning || isStarting || scanningFile
              ? "min-h-[300px] sm:min-h-[340px]"
              : "h-auto py-6"
          }`}
          style={{
            background: colors.bgRaised,
            border: `1px dashed ${
              isScanning ? colors.ice : colors.borderSoft
            }`,
          }}
        >
          {/* HTML5 QR Code DOM mount point */}
          <div
            id="cargo-qr-reader"
            className={`w-full max-w-[360px] mx-auto ${
              isScanning ? "block" : "hidden"
            }`}
          />

          {/* Camera Starting / Initializing Overlay */}
          {isStarting && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black/70 backdrop-blur-xs">
              <Loader2
                size={30}
                className="animate-spin"
                style={{color: colors.ice}}
              />
              <div className="flex flex-col gap-1 max-w-xs">
                <span className="text-xs font-semibold text-white">
                  Initializing camera feed...
                </span>
                <span className="text-[11px] text-slate-300 leading-relaxed">
                  Please allow camera access if prompted by your browser.
                </span>
              </div>
            </div>
          )}

          {/* Decoding File QR Overlay */}
          {scanningFile && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black/70 backdrop-blur-xs">
              <Loader2
                size={30}
                className="animate-spin"
                style={{color: colors.ice}}
              />
              <div className="flex flex-col gap-1 max-w-xs">
                <span className="text-xs font-semibold text-white">
                  Decoding QR from image...
                </span>
                <span className="text-[11px] text-slate-300">
                  Scanning uploaded file for cargo bar codes.
                </span>
              </div>
            </div>
          )}

          {/* Inactive Camera Empty State */}
          {!isScanning && !isStarting && !scanningFile && (
            <div className="flex flex-col items-center gap-2 text-center p-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-1"
                style={{background: colors.panelAlt, color: colors.textFaint}}
              >
                <QrCode size={24}/>
              </div>
              <span className="text-xs font-medium" style={{color: colors.text}}>
                Camera is currently inactive
              </span>
              <span
                className="text-[11px] max-w-xs"
                style={{color: colors.textMuted}}
              >
                Tap "Start camera" to scan a cargo package QR code using your webcam or mobile camera, or upload a QR image.
              </span>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={isStarting}
                  className="text-xs font-semibold px-3.5 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  style={{
                    background: colors.ice,
                    color: colors.iceButtonText,
                  }}
                >
                  <Camera size={13}/>
                  <span>Start camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-90 flex items-center gap-1.5"
                  style={{
                    background: colors.panelAlt,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <Upload size={13} style={{color: colors.ice}}/>
                  <span>Upload QR</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Camera Error Message */}
        {cameraError && (
          <div
            className="flex items-start gap-2.5 p-3 rounded-lg text-xs"
            style={{
              background: colors.flareBg,
              color: colors.flare,
              border: `1px solid ${colors.flareDim}`,
            }}
          >
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5"/>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">Camera Access Notice</span>
              <span>{cameraError}</span>
            </div>
          </div>
        )}

        {/* Manual Lookup Input */}
        <form
          onSubmit={handleManualLookup}
          className="pt-3 flex flex-col sm:flex-row items-center gap-2"
          style={{borderTop: `1px solid ${colors.borderSoft}`}}
        >
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 w-full"
            style={{
              background: colors.bgRaised,
              border: `1px solid ${colors.border}`,
            }}
          >
            <Search size={14} style={{color: colors.textFaint}} className="flex-shrink-0"/>
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Enter cargo UUID or scan token (e.g. 700da340-8b3b-4ebb-81e8-2fa966e59437)"
              className="text-xs outline-none bg-transparent w-full"
              style={{color: colors.text, ...mono}}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !manualToken.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-opacity flex-shrink-0"
            style={{
              background: colors.ice,
              color: colors.iceButtonText,
              opacity: loading || !manualToken.trim() ? 0.6 : 1,
            }}
          >
            {loading && <Loader2 size={13} className="animate-spin"/>}
            <span>Look up cargo</span>
          </button>
        </form>
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div
          className="flex items-center justify-center gap-2 p-8 rounded-xl text-xs"
          style={{
            background: colors.panel,
            border: `1px solid ${colors.border}`,
            color: colors.textMuted,
          }}
        >
          <Loader2 size={16} className="animate-spin" style={{color: colors.ice}}/>
          <span>Retrieving cargo records & checkpoint history...</span>
        </div>
      )}

      {/* Lookup Error Banner */}
      {lookupError && !loading && (
        <div
          className="flex items-start justify-between gap-3 p-4 rounded-xl text-xs"
          style={{
            background: colors.flareBg,
            color: colors.flare,
            border: `1px solid ${colors.flareDim}`,
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5"/>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-sm">Cargo QR Not Found</span>
              <span>{lookupError}</span>
            </div>
          </div>
          <button
            onClick={() => handleManualLookup()}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded cursor-pointer transition-opacity hover:opacity-80 font-medium flex-shrink-0"
            style={{
              background: colors.bgRaised,
              color: colors.text,
              border: `1px solid ${colors.border}`,
            }}
          >
            <RefreshCw size={12}/> Retry
          </button>
        </div>
      )}

      {/* Scan Results Screen */}
      {cargoData && !loading && (
        <div className="flex flex-col gap-6">
          {/* Main Cargo Details Card */}
          <div
            className="rounded-xl p-5 flex flex-col gap-5 shadow-sm"
            style={{
              background: colors.panel,
              border: `1px solid ${colors.border}`,
            }}
          >
            {/* Header / Identifiers */}
            <div className="flex items-start justify-between gap-4 flex-wrap pb-4"
                 style={{borderBottom: `1px solid ${colors.borderSoft}`}}>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className="text-2xl font-bold tracking-wider"
                    style={{...mono, color: colors.text}}
                  >
                    {cargoData.cargo_code || cargoData.id}
                  </span>
                  <Pill tone={priorityTone(cargoData.priority)}>
                    {formatPriority(cargoData.priority)}
                  </Pill>
                  <Pill tone={cargoStatusTone(cargoData.status)}>
                    {formatStatus(cargoData.status)}
                  </Pill>
                </div>
                <div className="text-xs" style={{color: colors.textMuted}}>
                  <span className="font-mono">UUID: {cargoData.id || cargoData.qr_token}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-90"
                  style={{
                    background: colors.bgRaised,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <QrCode size={13}/>
                  <span>Show QR code</span>
                </button>
              </div>
            </div>

            {/* Route & Expedition Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              {/* Route */}
              <div
                className="p-3 rounded-lg flex flex-col gap-1"
                style={{background: colors.bgRaised, border: `1px solid ${colors.borderSoft}`}}
              >
                <span className="text-[10px] uppercase font-semibold" style={{color: colors.textFaint}}>
                  Transit Route
                </span>
                <div className="flex items-center gap-1.5 font-medium" style={{color: colors.text}}>
                  <span>{cargoData.origin_station_name || "—"}</span>
                  <ArrowRight size={13} style={{color: colors.ice}}/>
                  <span>{cargoData.destination_station_name || "—"}</span>
                </div>
              </div>

              {/* Expedition */}
              <div
                className="p-3 rounded-lg flex flex-col gap-1"
                style={{background: colors.bgRaised, border: `1px solid ${colors.borderSoft}`}}
              >
                <span className="text-[10px] uppercase font-semibold" style={{color: colors.textFaint}}>
                  Linked Expedition
                </span>
                <div className="flex items-center gap-1.5 font-medium truncate" style={{color: colors.text}}>
                  <Compass size={13} style={{color: colors.aurora}} className="flex-shrink-0"/>
                  <span className="truncate">
                    {cargoData.expedition_name
                      ? `${cargoData.expedition_code ? `${cargoData.expedition_code} · ` : ""}${cargoData.expedition_name}`
                      : "Unlinked expedition"}
                  </span>
                </div>
              </div>

              {/* Batch */}
              <div
                className="p-3 rounded-lg flex flex-col gap-1"
                style={{background: colors.bgRaised, border: `1px solid ${colors.borderSoft}`}}
              >
                <span className="text-[10px] uppercase font-semibold" style={{color: colors.textFaint}}>
                  Logistics Batch
                </span>
                <div className="flex items-center gap-1.5 font-medium" style={{color: colors.text}}>
                  <Layers size={13} style={{color: colors.amber}} className="flex-shrink-0"/>
                  <span className="font-mono">
                    {cargoData.logistics_batch_code || "No batch assigned"}
                  </span>
                </div>
              </div>
            </div>

            {/* Timestamps and Notes */}
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs"
              style={{borderTop: `1px solid ${colors.borderSoft}`, color: colors.textMuted}}
            >
              <div className="flex items-center gap-1.5">
                <Calendar size={13} style={{color: colors.textFaint}}/>
                <span>Created: {formatDateTime(cargoData.created_at)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={13} style={{color: colors.textFaint}}/>
                <span>Dispatched: {formatDateTime(cargoData.dispatched_at)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} style={{color: colors.textFaint}}/>
                <span>Received: {formatDateTime(cargoData.received_at)}</span>
              </div>
            </div>

            {cargoData.notes && (
              <div
                className="text-xs p-3 rounded-lg"
                style={{background: colors.panelAlt, border: `1px solid ${colors.borderSoft}`}}
              >
                <span className="font-semibold block mb-0.5" style={{color: colors.text}}>Notes:</span>
                <span style={{color: colors.textMuted}}>{cargoData.notes}</span>
              </div>
            )}
          </div>

          {/* Assigned Batch Card (Informational Only) */}
          {cargoData.logistics_batch_code && (
            <div
              className="rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-xs"
              style={{
                background: colors.bgRaised,
                border: `1px solid ${colors.iceDim}`,
              }}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{background: colors.iceBg, color: colors.ice}}
                >
                  <Layers size={16}/>
                </div>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-semibold text-sm break-normal" style={{color: colors.text}}>
                      Assigned to Batch:{" "}
                      <span
                        className="font-mono font-bold break-normal whitespace-nowrap inline-block"
                        style={{color: colors.ice}}
                      >
                        {cargoData.logistics_batch_code}
                      </span>
                    </span>
                    {hasPropagatedCheckpoint && (
                      <Pill tone="ice">Batch Propagated</Pill>
                    )}
                  </div>
                  <span className="break-normal leading-relaxed text-[11px]" style={{color: colors.textMuted}}>
                    Part of logistics batch {cargoData.logistics_batch_code}. Track batch progress and route manifests in Cargo.
                  </span>
                </div>
              </div>

              <div
                className="w-full sm:w-auto flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0"
                style={{borderColor: colors.borderSoft}}
              >
                <button
                  type="button"
                  onClick={() => navigate("/cargo")}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90"
                  style={{
                    background: colors.panelAlt,
                    color: colors.ice,
                    border: `1px solid ${colors.borderSoft}`,
                  }}
                >
                  <span>View batch in Cargo</span>
                  <ArrowRight size={13}/>
                </button>
              </div>
            </div>
          )}

          {/* Correct Timeline States: Lifecycle Stepper */}
          <CargoTimeline cargo={cargoData}/>

          {/* Record GPS-Backed Checkpoint Card */}
          <div
            className="rounded-xl p-5 flex flex-col gap-4 shadow-sm"
            style={{
              background: colors.panel,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Navigation size={17} style={{color: colors.aurora}}/>
                <h3 className="text-sm font-semibold" style={{color: colors.text}}>
                  Record GPS Checkpoint Scan
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualCoords(!showManualCoords)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    background: colors.panelAlt,
                    color: colors.textMuted,
                    border: `1px solid ${colors.borderSoft}`,
                  }}
                >
                  <Sliders size={12}/>
                  <span>{showManualCoords ? "Hide custom GPS" : "Custom GPS input"}</span>
                </button>
              </div>
            </div>

            {/* Checkpoint Success Message */}
            {checkpointSuccess && (
              <div
                className="flex items-center gap-2 p-3.5 rounded-lg text-xs"
                style={{
                  background: colors.auroraBg,
                  color: colors.aurora,
                  border: `1px solid ${colors.auroraDim}`,
                }}
              >
                <CheckCircle2 size={16} className="flex-shrink-0"/>
                <span className="font-medium leading-relaxed">{checkpointSuccess}</span>
              </div>
            )}

            {/* Checkpoint Backend Error Alert */}
            {checkpointError && (
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-lg text-xs"
                style={{
                  background: colors.flareBg,
                  color: colors.flare,
                  border: `1px solid ${colors.flareDim}`,
                }}
              >
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5"/>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="font-semibold text-xs">Failed to Record Checkpoint</span>
                  <span className="break-words leading-relaxed">{checkpointError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleRecordCheckpoint} className="flex flex-col gap-4">
              <FormField
                label="Event type (required)"
                as="select"
                options={eventTypeOptions}
                value={checkpointEvent}
                onChange={setCheckpointEvent}
                required
              />

              {/* Batch Propagation Checkbox / Subtle Note */}
              {cargoData.logistics_batch_id ? (
                <div
                  className="p-3.5 rounded-lg flex flex-col gap-2 transition-colors"
                  style={{
                    background: colors.bgRaised,
                    border: `1px solid ${applyToBatch ? colors.iceDim : colors.border}`,
                  }}
                >
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="apply-checkpoint-to-batch"
                      checked={applyToBatch}
                      onChange={(e) => setApplyToBatch(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-cyan-500 cursor-pointer flex-shrink-0"
                      style={{accentColor: colors.ice}}
                    />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-xs font-semibold break-words" style={{color: colors.text}}>
                        Apply this checkpoint to all cargo in{" "}
                        <span className="font-mono font-bold" style={{color: colors.ice}}>
                          {cargoData.logistics_batch_code || "batch"}
                        </span>
                      </span>
                      <span className="text-[11px] leading-relaxed" style={{color: colors.textMuted}}>
                        GPS coordinates, event type, notes, and any status update apply to all eligible cargo in the batch.
                      </span>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="text-[11px] px-1 italic" style={{color: colors.textFaint}}>
                  Not assigned to a logistics batch
                </div>
              )}

              {/* Geolocation Section */}
              <div
                className="p-3.5 rounded-lg flex flex-col gap-3"
                style={{
                  background: colors.bgRaised,
                  border: `1px solid ${hasValidCoords ? colors.auroraDim : colors.border}`,
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <MapPin size={15} style={{color: hasValidCoords ? colors.aurora : colors.ice}}/>
                    <span className="text-xs font-semibold" style={{color: colors.text}}>
                      GPS Coordinates <span style={{color: colors.flare}}>*</span>
                    </span>
                    <span
                      className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded"
                      style={{background: colors.panelAlt, color: colors.textFaint}}
                    >
                      Mandatory
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={locating}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{
                        background: colors.iceBg,
                        color: colors.ice,
                        border: `1px solid ${colors.iceDim}`,
                      }}
                    >
                      {locating ? <Loader2 size={13} className="animate-spin"/> : <Navigation size={13}/>}
                      <span>{locating ? "Acquiring GPS..." : coords ? "Re-acquire GPS" : "Use device location"}</span>
                    </button>

                    {coords && (
                      <button
                        type="button"
                        onClick={handleClearCoords}
                        className="text-xs px-2 py-1 rounded cursor-pointer transition-opacity hover:opacity-80"
                        style={{color: colors.textFaint}}
                        title="Clear coordinates"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* State: Acquiring */}
                {locating && (
                  <div
                    className="flex items-center gap-2.5 p-2.5 rounded-lg text-xs"
                    style={{background: colors.panelAlt, border: `1px solid ${colors.iceDim}`}}
                  >
                    <Loader2 size={15} className="animate-spin flex-shrink-0" style={{color: colors.ice}}/>
                    <span style={{color: colors.text}}>
                      Acquiring device GPS satellite fix... please wait.
                    </span>
                  </div>
                )}

                {/* State: Location Ready */}
                {!locating && hasValidCoords && (
                  <div
                    className="flex items-center justify-between text-xs px-3 py-2 rounded-lg font-mono flex-wrap gap-2"
                    style={{background: colors.panelAlt, border: `1px solid ${colors.auroraDim}`, color: colors.text}}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin size={14} style={{color: colors.aurora}} className="flex-shrink-0"/>
                      <span className="truncate font-semibold">
                        {formatCoordinates(coords.latitude, coords.longitude) || `${coords.latitude}, ${coords.longitude}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-sans font-semibold flex items-center gap-1">
                      <Check size={12}/> GPS Ready & Anchored
                    </span>
                  </div>
                )}

                {/* State: Denied */}
                {!locating && locationStatus === "denied" && (
                  <div
                    className="flex items-start justify-between gap-3 p-3 rounded-lg text-xs"
                    style={{
                      background: colors.flareBg,
                      color: colors.flare,
                      border: `1px solid ${colors.flareDim}`,
                    }}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5"/>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-xs">GPS Permission Denied</span>
                        <span className="text-[11px] leading-relaxed">
                          Browser location permission was denied. Please allow location access or select a preset/custom GPS below.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded cursor-pointer flex-shrink-0 transition-opacity hover:opacity-80"
                      style={{background: colors.bgRaised, color: colors.text, border: `1px solid ${colors.border}`}}
                    >
                      <RefreshCw size={11}/> Retry GPS
                    </button>
                  </div>
                )}

                {/* State: Timeout */}
                {!locating && locationStatus === "timeout" && (
                  <div
                    className="flex items-start justify-between gap-3 p-3 rounded-lg text-xs"
                    style={{
                      background: colors.flareBg,
                      color: colors.flare,
                      border: `1px solid ${colors.flareDim}`,
                    }}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5"/>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-xs">GPS Request Timed Out</span>
                        <span className="text-[11px] leading-relaxed">
                          High-accuracy polar satellite lock could not be established in time. Retry or select a station preset below.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded cursor-pointer flex-shrink-0 transition-opacity hover:opacity-80"
                      style={{background: colors.bgRaised, color: colors.text, border: `1px solid ${colors.border}`}}
                    >
                      <RefreshCw size={11}/> Retry GPS
                    </button>
                  </div>
                )}

                {/* State: Generic Error */}
                {!locating && locationStatus === "error" && locatingError && (
                  <div
                    className="flex items-start justify-between gap-3 p-3 rounded-lg text-xs"
                    style={{
                      background: colors.flareBg,
                      color: colors.flare,
                      border: `1px solid ${colors.flareDim}`,
                    }}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5"/>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-xs">GPS Error</span>
                        <span className="text-[11px] leading-relaxed">{locatingError}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded cursor-pointer flex-shrink-0 transition-opacity hover:opacity-80"
                      style={{background: colors.bgRaised, color: colors.text, border: `1px solid ${colors.border}`}}
                    >
                      <RefreshCw size={11}/> Retry GPS
                    </button>
                  </div>
                )}

                {/* State: Idle & No Coords */}
                {!locating && !hasValidCoords && locationStatus === "idle" && (
                  <span className="text-[11px] leading-relaxed" style={{color: colors.textFaint}}>
                    No GPS coordinates attached. Latitude and longitude are mandatory to record a checkpoint. Tap "Use device location" or choose a station preset below.
                  </span>
                )}

                {/* Manual Coordinate Inputs & Quick Presets */}
                {showManualCoords && (
                  <div
                    className="pt-2.5 flex flex-col gap-2"
                    style={{borderTop: `1px solid ${colors.borderSoft}`}}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] block mb-1 font-medium" style={{color: colors.textMuted}}>
                          Latitude (e.g. 23.014 or -69.408)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={manualLatInput}
                          onChange={(e) => setManualLatInput(e.target.value)}
                          placeholder="Latitude"
                          className="w-full text-xs px-2.5 py-1.5 rounded outline-none font-mono"
                          style={{
                            background: colors.panelAlt,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] block mb-1 font-medium" style={{color: colors.textMuted}}>
                          Longitude (e.g. 72.471 or 76.187)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={manualLngInput}
                          onChange={(e) => setManualLngInput(e.target.value)}
                          placeholder="Longitude"
                          className="w-full text-xs px-2.5 py-1.5 rounded outline-none font-mono"
                          style={{
                            background: colors.panelAlt,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                      {/* Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px]" style={{color: colors.textFaint}}>Presets:</span>
                        <button
                          type="button"
                          onClick={() => handleSetPresetCoords(-70.767, 11.733)}
                          className="text-[10px] px-2 py-0.5 rounded cursor-pointer transition-opacity hover:opacity-80 font-mono"
                          style={{
                            background: colors.panelAlt,
                            color: colors.ice,
                            border: `1px solid ${colors.borderSoft}`
                          }}
                        >
                          Maitri Station (-70.767, 11.733)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetPresetCoords(-69.408, 76.187)}
                          className="text-[10px] px-2 py-0.5 rounded cursor-pointer transition-opacity hover:opacity-80 font-mono"
                          style={{
                            background: colors.panelAlt,
                            color: colors.ice,
                            border: `1px solid ${colors.borderSoft}`
                          }}
                        >
                          Bharti Station (-69.408, 76.187)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetPresetCoords(15.402, 73.805)}
                          className="text-[10px] px-2 py-0.5 rounded cursor-pointer transition-opacity hover:opacity-80 font-mono"
                          style={{
                            background: colors.panelAlt,
                            color: colors.ice,
                            border: `1px solid ${colors.borderSoft}`
                          }}
                        >
                          NCAOR Goa (15.402, 73.805)
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyManualCoords}
                        className="text-xs px-3 py-1 rounded font-medium cursor-pointer transition-opacity hover:opacity-90"
                        style={{
                          background: colors.ice,
                          color: colors.iceButtonText,
                        }}
                      >
                        Apply GPS
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <FormField
                label="Checkpoint notes (optional)"
                as="textarea"
                value={checkpointNotes}
                onChange={setCheckpointNotes}
                placeholder="e.g. Waypoint traverse scan, seal intact, container securely anchored..."
              />

              {/* Submit Button Section */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                {!hasValidCoords ? (
                  <span className="text-[11px] flex items-center gap-1.5" style={{color: colors.flare}}>
                    <AlertTriangle size={13} className="flex-shrink-0"/>
                    <span>GPS coordinates required before checkpoint can be recorded.</span>
                  </span>
                ) : (
                  <span className="text-[11px] flex items-center gap-1" style={{color: colors.aurora}}>
                    <Check size={12}/>
                    <span>GPS locked. Ready to record checkpoint.</span>
                  </span>
                )}

                <button
                  type="submit"
                  disabled={submittingCheckpoint || !hasValidCoords}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: colors.ice,
                    color: colors.iceButtonText,
                  }}
                >
                  {submittingCheckpoint ? (
                    <>
                      <Loader2 size={14} className="animate-spin"/>
                      <span>Recording checkpoint...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14}/>
                      <span>Record checkpoint</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Cargo Checkpoint Journey Map */}
          <BatchMap
            cargo={cargoData}
            stations={stations}
            height="320px"
            title={`Checkpoint Journey Corridor · ${cargoData.cargo_code || cargoData.id}`}
          />

          {/* Cargo Manifest / Items Section */}
          <div
            className="rounded-xl p-5 flex flex-col gap-4 shadow-sm"
            style={{
              background: colors.panel,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={17} style={{color: colors.ice}}/>
                <h3 className="text-sm font-semibold" style={{color: colors.text}}>
                  Cargo Manifest / Items ({cargoData.items?.length || 0})
                </h3>
              </div>
            </div>

            {(!cargoData.items || cargoData.items.length === 0) ? (
              <div
                className="py-8 text-center text-xs rounded-lg"
                style={{
                  color: colors.textMuted,
                  border: `1px dashed ${colors.borderSoft}`,
                  background: colors.bgRaised,
                }}
              >
                No specific inventory items listed in this cargo manifest.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-xs border-collapse min-w-[540px]">
                  <thead>
                  <tr style={{color: colors.textFaint, borderBottom: `1px solid ${colors.borderSoft}`}}>
                    <th className="text-left font-medium pb-2.5 px-3">Item Code</th>
                    <th className="text-left font-medium pb-2.5 px-3">Name</th>
                    <th className="text-right font-medium pb-2.5 px-3">Qty</th>
                    <th className="text-right font-medium pb-2.5 px-3">Weight (kg)</th>
                    <th className="text-left font-medium pb-2.5 px-3">Notes</th>
                  </tr>
                  </thead>
                  <tbody>
                  {cargoData.items.map((it, idx) => (
                    <tr
                      key={it.item_id || idx}
                      style={{borderBottom: `1px solid ${colors.borderSoft}`}}
                    >
                      <td className="py-2.5 px-3 font-mono" style={{color: colors.text}}>
                        {it.item_code || "—"}
                      </td>
                      <td className="py-2.5 px-3 font-medium" style={{color: colors.text}}>
                        {it.item_name || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right" style={{color: colors.text}}>
                        {it.quantity ?? 1} {it.unit || ""}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono" style={{color: colors.textMuted}}>
                        {it.declared_weight_kg != null ? `${it.declared_weight_kg} kg` : "—"}
                      </td>
                      <td className="py-2.5 px-3 truncate max-w-[180px]" style={{color: colors.textFaint}}>
                        {it.notes || "—"}
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Scan History / Timeline Section */}
          <div
            className="rounded-xl p-5 flex flex-col gap-4 shadow-sm"
            style={{
              background: colors.panel,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-center gap-2">
              <Clock size={17} style={{color: colors.ice}}/>
              <h3 className="text-sm font-semibold" style={{color: colors.text}}>
                Scan Checkpoint History ({cargoData.scan_history?.length || 0})
              </h3>
            </div>

            {(!cargoData.scan_history || cargoData.scan_history.length === 0) ? (
              <div
                className="py-8 text-center text-xs rounded-lg"
                style={{
                  color: colors.textMuted,
                  border: `1px dashed ${colors.borderSoft}`,
                  background: colors.bgRaised,
                }}
              >
                No scan events recorded yet for this cargo. Use the form above to record the first checkpoint.
              </div>
            ) : (
              <div
                className="relative pl-6 flex flex-col gap-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--color-border)]">
                {cargoData.scan_history.map((sh, idx) => {
                  const hasGeo = sh.latitude != null && sh.longitude != null && !isNaN(Number(sh.latitude)) && !isNaN(Number(sh.longitude));
                  const geoStr = hasGeo ? formatCoordinates(sh.latitude, sh.longitude) : null;

                  return (
                    <div
                      key={sh.id || idx}
                      className="relative flex flex-col gap-1.5 p-3 rounded-lg text-xs"
                      style={{
                        background: colors.bgRaised,
                        border: `1px solid ${colors.borderSoft}`,
                      }}
                    >
                      {/* Timeline dot */}
                      <div
                        className="absolute -left-[27px] top-3.5 w-3 h-3 rounded-full border-2"
                        style={{
                          background: colors.bg,
                          borderColor: colors.ice,
                        }}
                      />

                      {/* Header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Pill tone={eventTypeTone(sh.event_type)}>
                            {formatEventType(sh.event_type)}
                          </Pill>
                          {((sh.applied_to_batch === true && Number(sh.affected_cargo_count) > 1) ||
                            (idx === 0 && lastScanResult?.applied_to_batch === true && Number(lastScanResult?.affected_cargo_count) > 1)) && (
                            <Pill tone="ice">
                              Propagated to Batch
                              ({sh.affected_cargo_count || lastScanResult?.affected_cargo_count} items)
                            </Pill>
                          )}
                          {sh.station_name && (
                            <span className="font-semibold" style={{color: colors.text}}>
                              {sh.station_name}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px]" style={{color: colors.textFaint}}>
                          {formatDateTime(sh.scanned_at)}
                        </span>
                      </div>

                      {/* Details row: Personnel & Geolocation */}
                      <div className="flex items-center gap-4 flex-wrap text-[11px] pt-1"
                           style={{color: colors.textMuted}}>
                        {sh.scanned_by_personnel_name && (
                          <div className="flex items-center gap-1">
                            <User size={12} style={{color: colors.textFaint}}/>
                            <span>Operator: {sh.scanned_by_personnel_name}</span>
                          </div>
                        )}
                        {geoStr && (
                          <div className="flex items-center gap-1 font-mono">
                            <MapPin size={12} style={{color: colors.aurora}}/>
                            <span>{geoStr}</span>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {sh.notes && (
                        <div className="text-[11px] pt-1" style={{color: colors.text}}>
                          "{sh.notes}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cargo QR Modal (if user wants to view or download QR from scan page) */}
      {cargoData && (
        <CargoQrModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          cargo={cargoData}
        />
      )}
    </div>
  );
}
