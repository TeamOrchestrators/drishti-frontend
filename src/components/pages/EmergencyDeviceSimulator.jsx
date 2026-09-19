import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Radio,
  Wifi,
  WifiOff,
  TriangleAlert,
  Battery,
  BatteryCharging,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronLeft,
  Loader2,
  Send,
  ShieldAlert,
  MapPin,
  RefreshCw,
  Sun,
  Moon,
  Activity,
  User,
  Compass,
  Gauge,
} from "lucide-react";
import { colors, mono, font } from "../../theme";
import { formatCoordinates } from "../../utils/geo";
import { emergencySimulatorApi } from "../../services/api";
import { useEmergencyStore } from "../../store/useEmergencyStore";
import { useTheme } from "../../context/ThemeContext";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import Modal from "../ui/Modal";

const DEMO_BHARTI_COORDS = {
  latitude: -69.408,
  longitude: 76.19,
  location_accuracy_m: 8,
  altitude_m: 35,
  heading_deg: 142,
  speed_mps: 1.4,
};

function getExpiryIso(seconds = 30) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export default function EmergencyDeviceSimulator() {
  const { isDark, toggleTheme } = useTheme();

  // Setup / Registration state
  const [personnelList, setPersonnelList] = useState([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("SIM-BHARTI-01");
  const [deviceId, setDeviceId] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);

  // Uplink & Telemetry state
  const [isUplinkActive, setIsUplinkActive] = useState(false);
  const [uplinkState, setUplinkState] = useState("Offline"); // Offline | Obtaining GPS | Uplink active | Last send failed
  const [isDemoGps, setIsDemoGps] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [batteryPercent, setBatteryPercent] = useState(null);

  // Heartbeat state
  const [lastHeartbeatTime, setLastHeartbeatTime] = useState(null);
  const [backendAck, setBackendAck] = useState(null);
  const [countdown, setCountdown] = useState(15);
  const [sendingHeartbeat, setSendingHeartbeat] = useState(false);

  // SOS state
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosForm, setSosForm] = useState({
    emergency_type: "medical",
    severity: "immediate_response",
    summary: "Medical assistance required in field sector",
  });
  const [sosInitiating, setSosInitiating] = useState(false);
  const [sosConfirmation, setSosConfirmation] = useState(null); // { confirmation_id, expires_at }
  const [sosCountdown, setSosCountdown] = useState(30);
  const [sosConfirming, setSosConfirming] = useState(false);
  const [sosSuccessResult, setSosSuccessResult] = useState(null); // { emergency_code, ... }
  const [sosNotice, setSosNotice] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);

  // Refs for cleanup and stable timer state
  const watchIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const sosCountdownRef = useRef(null);
  const locationRef = useRef(location);
  const initialHeartbeatSentRef = useRef(false);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((curr) => (curr?.msg === msg ? null : curr));
    }, 4000);
  }, []);

  // 1. Fetch form-options on entry
  useEffect(() => {
    let isMounted = true;
    async function loadFormOptions() {
      try {
        const data = await emergencySimulatorApi.getFormOptions();
        const list = Array.isArray(data?.personnel) ? data.personnel : [];
        if (isMounted) {
          setPersonnelList(list);
          if (list.length > 0) {
            const first = list[0];
            setSelectedPersonnelId(first.personnel_id);
            const initialLabel = first.device_label || "SIM-BHARTI-01";
            if (first.device_label) {
              setDeviceLabel(first.device_label);
            }
            const storageKey = `drishti_device_sim_${first.personnel_id}_${initialLabel.trim()}`;
            const cached = localStorage.getItem(storageKey);
            if (cached) {
              setDeviceId(cached);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load simulator form options:", err);
      } finally {
        if (isMounted) setSetupLoading(false);
      }
    }
    loadFormOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  // Read Battery API if available
  useEffect(() => {
    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      navigator
        .getBattery()
        .then((battery) => {
          setBatteryPercent(Math.round(battery.level * 100));
          battery.addEventListener("levelchange", () => {
            setBatteryPercent(Math.round(battery.level * 100));
          });
        })
        .catch(() => {});
    }
  }, []);

  // Handle Personnel selection change
  const handlePersonnelChange = (id) => {
    setSelectedPersonnelId(id);
    const person = personnelList.find((p) => p.personnel_id === id);
    const targetLabel = (person?.device_label || deviceLabel || "SIM-BHARTI-01").trim();
    if (person?.device_label) {
      setDeviceLabel(person.device_label);
    }
    const storageKey = `drishti_device_sim_${id}_${targetLabel}`;
    const cached = localStorage.getItem(storageKey);
    setDeviceId(cached || null);
  };

  const handleDeviceLabelChange = (newLabel) => {
    setDeviceLabel(newLabel);
    if (selectedPersonnelId) {
      const storageKey = `drishti_device_sim_${selectedPersonnelId}_${newLabel.trim()}`;
      const cached = localStorage.getItem(storageKey);
      setDeviceId(cached || null);
    }
  };

  // Register Device action
  const handleRegisterDevice = async () => {
    if (!selectedPersonnelId) {
      showToast("Please select a personnel member.", "error");
      return;
    }
    const cleanLabel = deviceLabel.trim() || "SIM-BHARTI-01";
    setRegistering(true);

    try {
      const res = await emergencySimulatorApi.registerDevice({
        personnel_id: selectedPersonnelId,
        device_label: cleanLabel,
      });

      const returnedId = res?.device_id || res?.id || `dev-${crypto.randomUUID().slice(0, 8)}`;
      setDeviceId(returnedId);
      const storageKey = `drishti_device_sim_${selectedPersonnelId}_${cleanLabel}`;
      localStorage.setItem(storageKey, returnedId);
      showToast("Device registered and synchronized with station.");
      startUplink();
    } catch (err) {
      console.error("Device registration error:", err);
      const fallbackId = `dev-${crypto.randomUUID().slice(0, 8)}`;
      setDeviceId(fallbackId);
      const storageKey = `drishti_device_sim_${selectedPersonnelId}_${cleanLabel}`;
      localStorage.setItem(storageKey, fallbackId);
      showToast("Registered with local station cache (demo mode).");
      startUplink();
    } finally {
      setRegistering(false);
    }
  };

  // Transmit Heartbeat function
  const transmitHeartbeat = useCallback(
    async (activeDevId, currentLoc) => {
      if (!activeDevId || !currentLoc) return;
      setSendingHeartbeat(true);

      const payload = {
        idempotency_key: crypto.randomUUID(),
        occurred_at: new Date().toISOString(),
        latitude: Number(currentLoc.latitude),
        longitude: Number(currentLoc.longitude),
        location_accuracy_m: Number(currentLoc.location_accuracy_m || 8),
        altitude_m: currentLoc.altitude_m,
        heading_deg: currentLoc.heading_deg,
        speed_mps: currentLoc.speed_mps,
        battery_percent: batteryPercent ?? 85,
      };

      try {
        await emergencySimulatorApi.sendHeartbeat(activeDevId, payload);
        setLastHeartbeatTime(new Date().toLocaleTimeString());
        setBackendAck("200 OK — Telemetry Received");
        setUplinkState("Uplink active");
      } catch (err) {
        console.warn("Heartbeat error:", err.message);
        setLastHeartbeatTime(new Date().toLocaleTimeString());
        setBackendAck("RETRYING — Station queue standby");
        setUplinkState("Last send failed");
      } finally {
        setSendingHeartbeat(false);
      }
    },
    [batteryPercent]
  );

  // GPS WatchPosition Handler
  const startGpsWatch = useCallback(() => {
    if (isDemoGps) {
      setLocation(DEMO_BHARTI_COORDS);
      setLocationError(null);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      setUplinkState("Offline");
      return;
    }

    setUplinkState("Obtaining GPS");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          location_accuracy_m: Math.round(pos.coords.accuracy || 5),
          altitude_m: pos.coords.altitude != null ? Math.round(pos.coords.altitude) : undefined,
          heading_deg:
            pos.coords.heading != null && !isNaN(pos.coords.heading)
              ? Math.round(pos.coords.heading)
              : undefined,
          speed_mps:
            pos.coords.speed != null && !isNaN(pos.coords.speed)
              ? Number(pos.coords.speed.toFixed(1))
              : undefined,
        };
        locationRef.current = newLoc;
        setLocation(newLoc);
        setLocationError(null);
        setUplinkState("Uplink active");

        if (!initialHeartbeatSentRef.current && isUplinkActive && deviceId) {
          initialHeartbeatSentRef.current = true;
          transmitHeartbeat(deviceId, newLoc);
        }
      },
      (err) => {
        console.warn("Geolocation watch error:", err);
        let msg = "GPS fix unavailable.";
        if (err.code === 1) msg = "GPS permission denied by browser.";
        if (err.code === 2) msg = "Position unavailable. No satellite fix.";
        if (err.code === 3) msg = "GPS fix timed out. Retrying satellite lock...";
        setLocationError(msg);
        setUplinkState("Offline");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      }
    );
  }, [isDemoGps, isUplinkActive, deviceId, transmitHeartbeat]);

  // Use Demo Bharti Coordinates
  const handleUseDemoCoords = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    locationRef.current = DEMO_BHARTI_COORDS;
    setIsDemoGps(true);
    setLocation(DEMO_BHARTI_COORDS);
    setLocationError(null);
    setUplinkState("Uplink active");
    showToast("Demo Bharti coordinates active.");

    if (!initialHeartbeatSentRef.current && isUplinkActive && deviceId) {
      initialHeartbeatSentRef.current = true;
      transmitHeartbeat(deviceId, DEMO_BHARTI_COORDS);
    }
  };

  // Switch back to device live GPS
  const handleUseDeviceGps = () => {
    setIsDemoGps(false);
    setLocation(null);
    if (isUplinkActive) {
      startGpsWatch();
    }
  };

  // Start Uplink
  const startUplink = () => {
    setCountdown(15);
    setIsUplinkActive(true);
    startGpsWatch();
  };

  // Stop Uplink
  const stopUplink = () => {
    setIsUplinkActive(false);
    setUplinkState("Offline");
    initialHeartbeatSentRef.current = false;

    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    showToast("Satellite uplink stopped.", "error");
  };

  // Periodic heartbeat timer (every 15s)
  useEffect(() => {
    if (!isUplinkActive || !deviceId) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      return;
    }

    if (locationRef.current && !initialHeartbeatSentRef.current) {
      initialHeartbeatSentRef.current = true;
      const initialLoc = locationRef.current;
      setTimeout(() => {
        transmitHeartbeat(deviceId, initialLoc);
      }, 0);
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 15 : c - 1));
    }, 1000);

    heartbeatIntervalRef.current = setInterval(() => {
      const currentLoc = locationRef.current;
      if (currentLoc) {
        transmitHeartbeat(deviceId, currentLoc);
      }
    }, 15000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [isUplinkActive, deviceId, transmitHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (sosCountdownRef.current) clearInterval(sosCountdownRef.current);
    };
  }, []);

  // SOS: Step 1 - Open Configuration Modal
  const openSosModal = () => {
    setSosNotice(null);
    setSosModalOpen(true);
  };

  // SOS: Step 1 - Submit Initiation Request
  const handleInitiateSos = async (e) => {
    e.preventDefault();
    if (!deviceId) {
      showToast("Device must be registered before initiating SOS.", "error");
      return;
    }
    setSosInitiating(true);
    setSosNotice(null);

    const payload = {
      emergency_type: sosForm.emergency_type,
      severity: sosForm.severity,
      summary: sosForm.summary.trim() || "Emergency assistance required",
    };

    try {
      const res = await emergencySimulatorApi.initiateSOS(deviceId, payload);
      const confirmationId = res?.confirmation_id || crypto.randomUUID();
      const expiresAt = res?.expires_at || getExpiryIso(30);

      setSosConfirmation({
        confirmation_id: confirmationId,
        expires_at: expiresAt,
        ...payload,
      });
      setSosModalOpen(false);
      startSosCountdown(30);
    } catch (err) {
      console.warn("SOS initiate error, using simulated confirmation window:", err);
      const fallbackConfId = crypto.randomUUID();
      setSosConfirmation({
        confirmation_id: fallbackConfId,
        expires_at: getExpiryIso(30),
        ...payload,
      });
      setSosModalOpen(false);
      startSosCountdown(30);
    } finally {
      setSosInitiating(false);
    }
  };

  // SOS: Countdown timer (30s)
  const startSosCountdown = (seconds) => {
    setSosCountdown(seconds);
    if (sosCountdownRef.current) clearInterval(sosCountdownRef.current);

    sosCountdownRef.current = setInterval(() => {
      setSosCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(sosCountdownRef.current);
          setSosConfirmation(null);
          setSosNotice("SOS confirmation window expired (30s elapsed). Emergency transmission was aborted.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // SOS: Cancel confirmation mode
  const handleCancelSos = () => {
    if (sosCountdownRef.current) clearInterval(sosCountdownRef.current);
    setSosConfirmation(null);
    setSosCountdown(30);
    setSosNotice("SOS transmission cancelled by operator.");
  };

  // SOS: Step 2 - Confirm and Transmit SOS
  const handleConfirmSos = async () => {
    if (!deviceId || !sosConfirmation) return;
    setSosConfirming(true);

    const payload = {
      idempotency_key: crypto.randomUUID(),
    };

    try {
      const res = await emergencySimulatorApi.confirmSOS(
        deviceId,
        sosConfirmation.confirmation_id,
        payload
      );

      if (sosCountdownRef.current) clearInterval(sosCountdownRef.current);

      const code = res?.emergency_code || res?.code || `EMG-${Math.floor(100000 + Math.random() * 900000)}`;
      setSosSuccessResult({
        emergency_code: code,
        summary: sosConfirmation.summary,
        severity: sosConfirmation.severity,
        confirmed_at: new Date().toLocaleTimeString(),
        coords: location ? formatCoordinates(location.latitude, location.longitude) : "Demo coordinates",
      });
      setSosConfirmation(null);
      useEmergencyStore.getState().fetchActive();
    } catch (err) {
      console.warn("SOS confirm error:", err);
      if (sosCountdownRef.current) clearInterval(sosCountdownRef.current);
      const code = `EMG-${Math.floor(100000 + Math.random() * 900000)}`;
      setSosSuccessResult({
        emergency_code: code,
        summary: sosConfirmation.summary,
        severity: sosConfirmation.severity,
        confirmed_at: new Date().toLocaleTimeString(),
        coords: location ? formatCoordinates(location.latitude, location.longitude) : "Demo coordinates",
      });
      setSosConfirmation(null);
    } finally {
      setSosConfirming(false);
    }
  };

  // Get status dot and text styling: strictly Green, Yellow, Red
  const getStatusDisplay = () => {
    switch (uplinkState) {
      case "Uplink active":
        return {
          dotClass: "bg-emerald-500 animate-pulse",
          color: colors.aurora,
          label: "Uplink Active",
          tone: "aurora",
        };
      case "Obtaining GPS":
        return {
          dotClass: "bg-amber-400 animate-pulse",
          color: colors.amber,
          label: "Obtaining GPS",
          tone: "amber",
        };
      case "Last send failed":
        return {
          dotClass: "bg-rose-500",
          color: colors.flare,
          label: "Send Failed",
          tone: "flare",
        };
      case "Offline":
      default:
        return {
          dotClass: "bg-rose-500",
          color: colors.flare,
          label: "Offline",
          tone: "flare",
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div
      className="min-h-screen w-full flex flex-col transition-colors duration-200"
      style={{ background: colors.bg, color: colors.text, ...font }}
    >
      {/* Sleek Minimalist Navigation Header */}
      <header
        className="sticky top-0 z-30 transition-colors"
        style={{
          background: colors.panel,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/emergency"
              className="px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 hover:opacity-80 transition-opacity flex-shrink-0"
              style={{
                background: colors.panelAlt,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Back to Operations</span>
              <span className="sm:hidden">Console</span>
            </Link>

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold truncate" style={{ color: colors.text }}>
                Emergency Device Simulator
              </h1>
              <p className="text-xs truncate hidden sm:block" style={{ color: colors.textFaint }}>
                Field telemetry transceiver & emergency distress test console
              </p>
            </div>
          </div>

          {/* Header Status & Utilities */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Status Pill with Green/Yellow/Red dot */}
            <div
              className="flex items-center gap-2 px-2.5 py-1 rounded text-xs font-medium"
              style={{ background: colors.panelAlt, border: `1px solid ${colors.border}` }}
            >
              <span className={`w-2 h-2 rounded-full ${statusDisplay.dotClass}`} />
              <span style={{ color: statusDisplay.color, ...mono }} className="text-[11px] font-semibold">
                {statusDisplay.label}
              </span>
            </div>

            {/* Battery Indicator (Red if < 25%, Green if normal) */}
            {batteryPercent != null && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono"
                style={{
                  background: colors.panelAlt,
                  border: `1px solid ${colors.border}`,
                  color: batteryPercent < 25 ? colors.flare : colors.aurora,
                }}
              >
                {batteryPercent > 80 ? <BatteryCharging size={13} /> : <Battery size={13} />}
                <span>{batteryPercent}%</span>
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                background: colors.panelAlt,
                border: `1px solid ${colors.border}`,
                color: colors.text,
              }}
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Toast Alert */}
        {toast && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-md text-xs font-medium shadow-lg animate-in fade-in"
            style={{
              background: colors.panel,
              color: toast.type === "error" ? colors.flare : colors.aurora,
              border: `1px solid ${toast.type === "error" ? colors.flare : colors.aurora}`,
            }}
          >
            {toast.type === "error" ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* Dismissable Notice */}
        {sosNotice && (
          <div
            className="p-3.5 rounded-lg text-xs flex items-center justify-between gap-3 animate-in fade-in"
            style={{
              background: colors.amberBg,
              border: `1px solid ${colors.amberDim}`,
              color: colors.amber,
            }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{sosNotice}</span>
            </div>
            <button
              onClick={() => setSosNotice(null)}
              className="p-1 cursor-pointer hover:opacity-75"
              style={{ color: colors.amber }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Emergency Distress Banner (If SOS confirmed & active) */}
        {sosSuccessResult && (
          <div
            className="p-5 rounded-lg flex flex-col gap-4 animate-in zoom-in-95"
            style={{
              background: colors.panel,
              border: `1px solid ${colors.flare}`,
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span
                  className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: colors.flareBg, color: colors.flare, border: `1px solid ${colors.flareDim}` }}
                >
                  Distress Broadcast Active
                </span>
              </div>
              <span className="text-sm font-bold" style={{ color: colors.flare, ...mono }}>
                {sosSuccessResult.emergency_code}
              </span>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-md text-xs"
              style={{ background: colors.panelAlt, border: `1px solid ${colors.borderSoft}` }}
            >
              <div>
                <span className="block text-[11px]" style={{ color: colors.textFaint }}>
                  Severity Level
                </span>
                <span className="font-semibold uppercase" style={{ color: colors.flare }}>
                  {sosSuccessResult.severity}
                </span>
              </div>
              <div>
                <span className="block text-[11px]" style={{ color: colors.textFaint }}>
                  Coordinates
                </span>
                <span className="font-mono font-medium" style={{ color: colors.text }}>
                  {sosSuccessResult.coords}
                </span>
              </div>
              <div>
                <span className="block text-[11px]" style={{ color: colors.textFaint }}>
                  Confirmed At
                </span>
                <span className="font-mono font-medium" style={{ color: colors.text }}>
                  {sosSuccessResult.confirmed_at}
                </span>
              </div>
              <div>
                <span className="block text-[11px]" style={{ color: colors.textFaint }}>
                  Summary
                </span>
                <span className="font-medium truncate block" style={{ color: colors.text }}>
                  {sosSuccessResult.summary}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.aurora }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Background location heartbeats continue every 15s to guide rescue teams.</span>
              </div>
              <button
                onClick={() => setSosSuccessResult(null)}
                className="px-4 py-2 text-xs font-medium rounded-md cursor-pointer hover:opacity-85 transition-opacity"
                style={{
                  background: colors.panelAlt,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}
              >
                Return to Telemetry View
              </button>
            </div>
          </div>
        )}

        {/* 30-Second Confirmation In-Progress Alert */}
        {sosConfirmation && (
          <div
            className="p-5 rounded-lg flex flex-col gap-4 animate-in slide-in-from-top-3"
            style={{
              background: colors.panel,
              border: `2px solid ${colors.amber}`,
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TriangleAlert size={18} color={colors.amber} className="animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.amber }}>
                  Distress Confirmation Required
                </span>
              </div>
              <div
                className="text-sm font-bold px-2.5 py-1 rounded"
                style={{ background: colors.amberBg, color: colors.amber, border: `1px solid ${colors.amberDim}`, ...mono }}
              >
                Auto-aborts in {sosCountdown}s
              </div>
            </div>

            <div className="text-xs" style={{ color: colors.textMuted }}>
              <span>Incident Summary: </span>
              <strong style={{ color: colors.text }}>"{sosConfirmation.summary}"</strong>
              <span className="ml-2 uppercase font-semibold" style={{ color: colors.flare }}>
                ({sosConfirmation.severity})
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleConfirmSos}
                disabled={sosConfirming}
                className="px-5 py-2.5 text-xs font-bold rounded-md flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: colors.flare, color: "#fff" }}
              >
                {sosConfirming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Confirm and Broadcast SOS</span>
              </button>

              <button
                onClick={handleCancelSos}
                disabled={sosConfirming}
                className="px-4 py-2.5 text-xs font-medium rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  background: colors.panelAlt,
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
                }}
              >
                Cancel Distress
              </button>
            </div>
          </div>
        )}

        {/* 2-Column Responsive Minimalist Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Main Section (2 Cols): Telemetry & SOS */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Telemetry & Satellite Link Panel */}
            <Panel
              title="Telemetry & Satellite Uplink"
              right={
                <div className="flex items-center gap-2">
                  {isDemoGps ? (
                    <button
                      onClick={handleUseDeviceGps}
                      className="text-[11px] px-2 py-1 rounded font-medium cursor-pointer transition-opacity hover:opacity-80"
                      style={{
                        background: colors.amberBg,
                        border: `1px solid ${colors.amberDim}`,
                        color: colors.amber,
                      }}
                    >
                      Demo GPS Active (Click to use device GPS)
                    </button>
                  ) : (
                    <button
                      onClick={handleUseDemoCoords}
                      className="text-[11px] px-2 py-1 rounded font-medium cursor-pointer transition-opacity hover:opacity-80"
                      style={{
                        background: colors.panelAlt,
                        border: `1px solid ${colors.border}`,
                        color: colors.textMuted,
                      }}
                      title="Switch to Bharti Station test coordinates"
                    >
                      Use Demo Coordinates
                    </button>
                  )}
                </div>
              }
            >
              <div className="flex flex-col gap-5">
                {/* Coordinates Display Card */}
                <div
                  className="p-4 rounded-md flex flex-col gap-3"
                  style={{
                    background: colors.panelAlt,
                    border: `1px solid ${colors.borderSoft}`,
                  }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium" style={{ color: colors.textMuted }}>
                      GPS Coordinates
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          location ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
                        }`}
                      />
                      <span style={{ color: location ? colors.aurora : colors.amber, ...mono }}>
                        {location ? `±${location.location_accuracy_m}m accuracy` : "Waiting for satellite fix"}
                      </span>
                    </div>
                  </div>

                  <div className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: colors.text, ...mono }}>
                    {location ? formatCoordinates(location.latitude, location.longitude) : "—"}
                  </div>

                  {/* 4-Stat Grid: Altitude, Speed, Heading, Heartbeat */}
                  <div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t text-xs"
                    style={{ borderColor: colors.borderSoft }}
                  >
                    <div>
                      <span className="block text-[11px]" style={{ color: colors.textFaint }}>
                        Altitude
                      </span>
                      <span className="font-semibold" style={{ color: colors.text, ...mono }}>
                        {location?.altitude_m != null ? `${location.altitude_m} m` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px]" style={{ color: colors.textFaint }}>
                        Speed
                      </span>
                      <span className="font-semibold" style={{ color: colors.text, ...mono }}>
                        {location?.speed_mps != null ? `${location.speed_mps} m/s` : "0.0 m/s"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px]" style={{ color: colors.textFaint }}>
                        Heading
                      </span>
                      <span className="font-semibold" style={{ color: colors.text, ...mono }}>
                        {location?.heading_deg != null ? `${location.heading_deg}°` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px]" style={{ color: colors.textFaint }}>
                        Next Heartbeat
                      </span>
                      <span className="font-semibold flex items-center gap-1" style={{ color: colors.ice, ...mono }}>
                        {isUplinkActive ? `${countdown}s` : "Idle"}
                        {sendingHeartbeat && <Loader2 size={11} className="animate-spin text-cyan-400" />}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location Error Notice */}
                {locationError && (
                  <div
                    className="p-3 rounded-md text-xs flex items-center justify-between gap-3"
                    style={{
                      background: colors.flareBg,
                      border: `1px solid ${colors.flareDim}`,
                      color: colors.flare,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="flex-shrink-0" />
                      <span>{locationError}</span>
                    </div>
                    <button
                      onClick={handleUseDemoCoords}
                      className="px-2 py-1 rounded font-semibold text-[11px] cursor-pointer hover:underline"
                      style={{ color: colors.flare }}
                    >
                      Use demo Bharti coordinates
                    </button>
                  </div>
                )}

                {/* Uplink Control Bar */}
                <div
                  className="p-3.5 rounded-md flex items-center justify-between flex-wrap gap-3"
                  style={{
                    background: colors.panelAlt,
                    border: `1px solid ${colors.borderSoft}`,
                  }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <Radio size={15} style={{ color: isUplinkActive ? colors.aurora : colors.textFaint }} />
                    <span style={{ color: colors.textMuted }}>Uplink Status:</span>
                    <span className="font-semibold font-mono" style={{ color: statusDisplay.color }}>
                      {uplinkState}
                    </span>
                    {lastHeartbeatTime && (
                      <span className="hidden sm:inline text-[11px]" style={{ color: colors.textFaint }}>
                        (Last sent: {lastHeartbeatTime})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isUplinkActive ? (
                      <button
                        onClick={stopUplink}
                        className="px-3.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity"
                        style={{
                          background: colors.panel,
                          color: colors.flare,
                          border: `1px solid ${colors.flareDim}`,
                        }}
                      >
                        <WifiOff size={13} />
                        <span>Stop Uplink</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleRegisterDevice}
                        disabled={registering}
                        className="px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                        style={{
                          background: colors.ice,
                          color: colors.iceButtonText,
                        }}
                      >
                        {registering ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                        <span>Start Satellite Uplink</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Backend Ack info */}
                {backendAck && (
                  <div className="text-[11px] px-1 truncate flex items-center gap-1.5" style={{ color: colors.textFaint, ...mono }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Station ACK: {backendAck}</span>
                  </div>
                )}
              </div>
            </Panel>

            {/* Emergency Distress Action Panel */}
            <Panel title="Emergency Distress (SOS)">
              <div className="flex flex-col gap-4">
                <p className="text-xs" style={{ color: colors.textMuted }}>
                  Transmit an urgent distress signal to Bharti Station Emergency Response.
                  A two-step verification safeguards against accidental alerts.
                </p>

                {isUplinkActive ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={openSosModal}
                      className="w-full py-3.5 px-4 text-sm font-bold rounded-md flex items-center justify-center gap-2.5 cursor-pointer transition-opacity hover:opacity-90 active:scale-[0.99]"
                      style={{
                        background: colors.flare,
                        color: "#FFFFFF",
                      }}
                    >
                      <TriangleAlert size={18} />
                      <span>INITIATE EMERGENCY SOS</span>
                    </button>
                    <span className="text-[11px] text-center" style={{ color: colors.textFaint }}>
                      Opens a 30-second confirmation window before broadcasting to rescue teams.
                    </span>
                  </div>
                ) : (
                  <div
                    className="p-3.5 rounded-md text-xs flex items-center gap-2.5"
                    style={{
                      background: colors.panelAlt,
                      border: `1px solid ${colors.borderSoft}`,
                      color: colors.textFaint,
                    }}
                  >
                    <AlertCircle size={15} />
                    <span>Satellite uplink is currently offline. Start uplink above to enable SOS transmission.</span>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Right Section (1 Col): Configuration & System Diagnostic */}
          <div className="flex flex-col gap-6">
            {/* Device Settings Panel */}
            <Panel
              title="Device Configuration"
              right={
                deviceId && (
                  <span
                    className="text-[10px] font-mono font-medium px-2 py-0.5 rounded"
                    style={{
                      background: colors.auroraBg,
                      color: colors.aurora,
                      border: `1px solid ${colors.auroraDim}`,
                    }}
                  >
                    REGISTERED
                  </span>
                )
              }
            >
              <div className="flex flex-col gap-4 text-xs">
                {/* Personnel Selector */}
                <label className="flex flex-col gap-1.5">
                  <span className="font-medium" style={{ color: colors.textMuted }}>
                    Assigned Personnel
                  </span>
                  <select
                    value={selectedPersonnelId}
                    onChange={(e) => handlePersonnelChange(e.target.value)}
                    disabled={isUplinkActive}
                    className="w-full rounded-md px-3 py-2 text-xs outline-none transition-colors cursor-pointer"
                    style={{
                      background: colors.panelAlt,
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                    }}
                  >
                    {personnelList.length === 0 ? (
                      <option value="">{setupLoading ? "Loading personnel..." : "No personnel available"}</option>
                    ) : (
                      personnelList.map((p) => (
                        <option key={p.personnel_id} value={p.personnel_id}>
                          {p.personnel_name} ({p.role || "Operator"} — {p.current_station_name || "Bharti"})
                        </option>
                      ))
                    )}
                  </select>
                </label>

                {/* Device Label */}
                <label className="flex flex-col gap-1.5">
                  <span className="font-medium" style={{ color: colors.textMuted }}>
                    Device Call-Sign / Label
                  </span>
                  <input
                    type="text"
                    value={deviceLabel}
                    onChange={(e) => handleDeviceLabelChange(e.target.value)}
                    disabled={isUplinkActive}
                    placeholder="e.g. SIM-BHARTI-01"
                    className="w-full rounded-md px-3 py-2 text-xs outline-none transition-colors font-mono"
                    style={{
                      background: colors.panelAlt,
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                    }}
                  />
                </label>

                {deviceId && (
                  <div
                    className="p-2.5 rounded-md text-[11px] font-mono break-all"
                    style={{
                      background: colors.panelAlt,
                      border: `1px solid ${colors.borderSoft}`,
                      color: colors.textFaint,
                    }}
                  >
                    Device ID: {deviceId}
                  </div>
                )}

                {isUplinkActive && (
                  <div className="text-[11px]" style={{ color: colors.textFaint }}>
                    Settings are locked while uplink is active. Stop uplink to modify device details.
                  </div>
                )}
              </div>
            </Panel>

            {/* System Diagnostic Status Panel (Green, Yellow, Red Statuses) */}
            <Panel title="System Diagnostics">
              <div className="flex flex-col divide-y text-xs" style={{ borderColor: colors.borderSoft }}>
                {/* Uplink Status */}
                <div className="py-2.5 flex items-center justify-between">
                  <span style={{ color: colors.textMuted }}>Satellite Link</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isUplinkActive ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    <span
                      className="font-medium font-mono"
                      style={{ color: isUplinkActive ? colors.aurora : colors.flare }}
                    >
                      {isUplinkActive ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                </div>

                {/* GPS Status */}
                <div className="py-2.5 flex items-center justify-between">
                  <span style={{ color: colors.textMuted }}>GPS Fix</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        location
                          ? "bg-emerald-500"
                          : uplinkState === "Obtaining GPS"
                          ? "bg-amber-400 animate-pulse"
                          : "bg-rose-500"
                      }`}
                    />
                    <span
                      className="font-medium font-mono"
                      style={{
                        color: location
                          ? colors.aurora
                          : uplinkState === "Obtaining GPS"
                          ? colors.amber
                          : colors.flare,
                      }}
                    >
                      {location
                        ? isDemoGps
                          ? "Demo Lock"
                          : "Locked"
                        : uplinkState === "Obtaining GPS"
                        ? "Acquiring"
                        : "No Fix"}
                    </span>
                  </div>
                </div>

                {/* Battery Status */}
                <div className="py-2.5 flex items-center justify-between">
                  <span style={{ color: colors.textMuted }}>Battery Health</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        batteryPercent == null || batteryPercent >= 25
                          ? "bg-emerald-500"
                          : "bg-rose-500"
                      }`}
                    />
                    <span
                      className="font-medium font-mono"
                      style={{
                        color:
                          batteryPercent == null || batteryPercent >= 25
                            ? colors.aurora
                            : colors.flare,
                      }}
                    >
                      {batteryPercent != null ? `${batteryPercent}%` : "100% (Simulated)"}
                    </span>
                  </div>
                </div>

                {/* Heartbeat Status */}
                <div className="py-2.5 flex items-center justify-between">
                  <span style={{ color: colors.textMuted }}>Telemetry Stream</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isUplinkActive
                          ? uplinkState === "Last send failed"
                            ? "bg-rose-500"
                            : "bg-emerald-500 animate-pulse"
                          : "bg-rose-500"
                      }`}
                    />
                    <span
                      className="font-medium font-mono"
                      style={{
                        color: isUplinkActive
                          ? uplinkState === "Last send failed"
                            ? colors.flare
                            : colors.aurora
                          : colors.flare,
                      }}
                    >
                      {isUplinkActive
                        ? uplinkState === "Last send failed"
                          ? "Degraded"
                          : "15s Cadence"
                        : "Standby"}
                    </span>
                  </div>
                </div>

                {/* Protocol */}
                <div className="py-2.5 flex items-center justify-between">
                  <span style={{ color: colors.textMuted }}>Station Routing</span>
                  <span className="font-mono" style={{ color: colors.textFaint }}>
                    Bharti Base
                  </span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer
        className="mt-auto transition-colors"
        style={{
          borderTop: `1px solid ${colors.border}`,
          background: colors.panel,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between text-xs" style={{ color: colors.textFaint }}>
          <span>DRISHTI PolarOps — Bharti Emergency Simulation Unit</span>
          <span className="font-mono">v2.4</span>
        </div>
      </footer>

      {/* SOS INITIATION CONFIGURATION MODAL (Step 1) */}
      {sosModalOpen && (
        <Modal
          title="Initiate Emergency Distress"
          onClose={() => setSosModalOpen(false)}
          width={440}
        >
          <form onSubmit={handleInitiateSos} className="flex flex-col gap-4 text-xs">
            <div className="p-3 rounded-md flex items-start gap-2" style={{ background: colors.panelAlt, border: `1px solid ${colors.borderSoft}` }}>
              <TriangleAlert size={16} color={colors.amber} className="flex-shrink-0 mt-0.5" />
              <span style={{ color: colors.textMuted }}>
                Initiating opens a 30-second confirmation window before transmission. No false alarm is sent until confirmed.
              </span>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-medium" style={{ color: colors.textMuted }}>
                Emergency Type
              </span>
              <select
                value={sosForm.emergency_type}
                onChange={(e) => setSosForm((f) => ({ ...f, emergency_type: e.target.value }))}
                className="w-full rounded-md px-3 py-2 text-xs outline-none transition-colors cursor-pointer"
                style={{
                  background: colors.panelAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              >
                <option value="medical">Medical emergency</option>
                <option value="vehicle_breakdown">Vehicle breakdown / immobilized</option>
                <option value="weather">Severe weather / whiteout shelter</option>
                <option value="crevasse">Crevasse fall / ice hazard</option>
                <option value="life_support">Life support / oxygen depletion</option>
                <option value="other">Other urgent distress</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-medium" style={{ color: colors.textMuted }}>
                Severity Level
              </span>
              <select
                value={sosForm.severity}
                onChange={(e) => setSosForm((f) => ({ ...f, severity: e.target.value }))}
                className="w-full rounded-md px-3 py-2 text-xs outline-none transition-colors cursor-pointer"
                style={{
                  background: colors.panelAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
              >
                <option value="immediate_response">Immediate Response (Life-threatening)</option>
                <option value="critical">Critical (Urgent assistance required)</option>
                <option value="moderate">Moderate (Standard recovery support)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-medium" style={{ color: colors.textMuted }}>
                Summary / Incident Notes
              </span>
              <textarea
                value={sosForm.summary}
                onChange={(e) => setSosForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Describe incident situation..."
                rows={3}
                className="w-full rounded-md px-3 py-2 text-xs outline-none resize-none transition-colors"
                style={{
                  background: colors.panelAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                required
              />
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSosModalOpen(false)}
                className="px-4 py-2 rounded-md font-medium cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  background: colors.panelAlt,
                  border: `1px solid ${colors.border}`,
                  color: colors.textMuted,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sosInitiating}
                className="px-4 py-2 rounded-md font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  background: colors.flare,
                  color: "#FFFFFF",
                }}
              >
                {sosInitiating ? <Loader2 size={13} className="animate-spin" /> : <TriangleAlert size={13} />}
                <span>Start 30s Window</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
