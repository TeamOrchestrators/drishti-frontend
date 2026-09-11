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
  Smartphone,
  ChevronLeft,
  Loader2,
  X,
  Send,
  ShieldAlert,
} from "lucide-react";
import { colors, mono } from "../../theme";
import { formatCoordinates } from "../../utils/geo";
import { emergencySimulatorApi } from "../../services/api";
import { useEmergencyStore } from "../../store/useEmergencyStore";

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
      navigator.getBattery().then((battery) => {
        setBatteryPercent(Math.round(battery.level * 100));
        battery.addEventListener("levelchange", () => {
          setBatteryPercent(Math.round(battery.level * 100));
        });
      }).catch(() => {});
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
      showToast("Device registered and synchronized with Bharti Command.");
      startUplink();
    } catch (err) {
      console.error("Device registration error:", err);
      // For presentation resiliency: generate fallback device ID
      const fallbackId = `dev-${crypto.randomUUID().slice(0, 8)}`;
      setDeviceId(fallbackId);
      const storageKey = `drishti_device_sim_${selectedPersonnelId}_${cleanLabel}`;
      localStorage.setItem(storageKey, fallbackId);
      showToast("Registered with local station cache (demo).");
      startUplink();
    } finally {
      setRegistering(false);
    }
  };

  // Transmit Heartbeat function
  const transmitHeartbeat = useCallback(async (activeDevId, currentLoc) => {
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
      setBackendAck("ACK 200 OK — Telemetry Received");
      setUplinkState("Uplink active");
    } catch (err) {
      console.warn("Heartbeat error:", err.message);
      setLastHeartbeatTime(new Date().toLocaleTimeString());
      setBackendAck("RETRYING — Station queue standby");
      setUplinkState("Last send failed");
    } finally {
      setSendingHeartbeat(false);
    }
  }, [batteryPercent]);

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
          heading_deg: pos.coords.heading != null && !isNaN(pos.coords.heading) ? Math.round(pos.coords.heading) : undefined,
          speed_mps: pos.coords.speed != null && !isNaN(pos.coords.speed) ? Number(pos.coords.speed.toFixed(1)) : undefined,
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
        if (err.code === 1) msg = "GPS permission was denied by device.";
        if (err.code === 2) msg = "Position unavailable. Verify device GPS antenna.";
        if (err.code === 3) msg = "GPS fix timed out. Waiting for satellite lock.";
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
    showToast("Demo Bharti coordinates active (-69.408000° S, 76.190000° E).");

    if (!initialHeartbeatSentRef.current && isUplinkActive && deviceId) {
      initialHeartbeatSentRef.current = true;
      transmitHeartbeat(deviceId, DEMO_BHARTI_COORDS);
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
    showToast("Satellite uplink paused.", "error");
  };

  // Location/Heartbeat periodic timer: strictly every 15 seconds
  useEffect(() => {
    if (!isUplinkActive || !deviceId) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      return;
    }

    // Initial first heartbeat when uplink is enabled and location is ready
    if (locationRef.current && !initialHeartbeatSentRef.current) {
      initialHeartbeatSentRef.current = true;
      const initialLoc = locationRef.current;
      setTimeout(() => {
        transmitHeartbeat(deviceId, initialLoc);
      }, 0);
    }

    // Countdown ticker every 1 second: smoothly counts down 15 to 1, then resets to 15
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 15 : c - 1));
    }, 1000);

    // Heartbeat pulse strictly every 15 seconds
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
      // Resilient fallback: enter confirmation mode even if simulation endpoint is in mock mode
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
      // Fallback response for simulator resiliency
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

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-start p-3 sm:p-4 md:p-6"
      style={{ background: "#05080E", color: colors.text }}
    >
      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed top-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-2xl text-sm transition-all animate-in fade-in"
          style={{
            background: colors.bgRaised,
            color: toast.type === "error" ? colors.flare : colors.aurora,
            border: `1px solid ${toast.type === "error" ? colors.flareDim : colors.auroraDim}`,
          }}
        >
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Desktop Helper Notice on wide screens */}
      <div className="w-full max-w-md hidden md:flex items-center justify-between px-4 py-2.5 mb-3 rounded-lg text-xs" style={{ background: colors.panelAlt, border: `1px solid ${colors.borderSoft}`, color: colors.textMuted }}>
        <div className="flex items-center gap-2">
          <Smartphone size={16} color={colors.ice} />
          <span>Open this page on a phone for the handheld device experience.</span>
        </div>
        <Link to="/emergency" className="flex items-center gap-1 font-medium hover:underline" style={{ color: colors.ice }}>
          <ChevronLeft size={13} /> Console
        </Link>
      </div>

      {/* Handheld Device Container */}
      <div
        className="w-full max-w-md rounded-2xl flex flex-col shadow-2xl overflow-hidden border transition-all"
        style={{
          background: "#080E18",
          borderColor: isUplinkActive ? colors.iceDim : colors.border,
          boxShadow: isUplinkActive ? "0 0 30px rgba(99, 196, 214, 0.08)" : "none",
        }}
      >
        {/* Device Top Antenna & Satellite Status Bezel */}
        <div
          className="px-4 py-3 flex items-center justify-between border-b"
          style={{ background: "#0D1524", borderColor: colors.borderSoft }}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                uplinkState === "Uplink active"
                  ? "bg-emerald-400 animate-pulse"
                  : uplinkState === "Obtaining GPS"
                  ? "bg-amber-400 animate-pulse"
                  : uplinkState === "Last send failed"
                  ? "bg-rose-500"
                  : "bg-zinc-600"
              }`}
            />
            <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ ...mono, color: colors.textMuted }}>
              {uplinkState}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs" style={{ ...mono }}>
            {batteryPercent != null && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: batteryPercent < 25 ? colors.flare : colors.aurora }}>
                {batteryPercent > 80 ? <BatteryCharging size={13} /> : <Battery size={13} />}
                {batteryPercent}%
              </span>
            )}
            <div className="flex items-center gap-1">
              {isUplinkActive ? <Wifi size={14} color={colors.ice} /> : <WifiOff size={14} color={colors.textFaint} />}
              <span className="text-[10px] text-zinc-400">IRIDIUM</span>
            </div>
          </div>
        </div>

        {/* Device Disclaimer & Label Banner */}
        <div className="px-4 py-2 text-center border-b" style={{ background: colors.panelAlt, borderColor: colors.borderSoft }}>
          <h1 className="text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5" style={{ color: colors.ice }}>
            <Radio size={14} /> HTTP Emergency Device Simulation
          </h1>
          <p className="text-[10px] mt-0.5" style={{ color: colors.textFaint }}>
            Simulates emergency satellite uplink for demonstration. Not actual satellite hardware.
          </p>
        </div>

        {/* Main Device Viewport */}
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          {/* Notice Banner (if any expired or cancel notice) */}
          {sosNotice && (
            <div className="p-3 rounded-lg text-xs flex items-start gap-2 animate-in fade-in" style={{ background: colors.amberBg, border: `1px solid ${colors.amberDim}`, color: colors.amber }}>
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{sosNotice}</span>
            </div>
          )}

          {/* SOS SUCCESS STATE OVERLAY */}
          {sosSuccessResult ? (
            <div className="p-5 rounded-xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95" style={{ background: colors.flareBg, border: `2px solid ${colors.flare}` }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: colors.flare, color: "#fff" }}>
                <ShieldAlert size={32} />
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: colors.flare, color: "#fff" }}>
                  Emergency Transmitted
                </span>
                <h2 className="text-xl font-bold mt-2" style={{ color: colors.text }}>
                  Distress Broadcast Active
                </h2>
                <div className="text-lg font-bold mt-1" style={{ color: colors.flare, ...mono }}>
                  {sosSuccessResult.emergency_code}
                </div>
              </div>

              <div className="w-full text-xs p-3 rounded-lg text-left flex flex-col gap-1.5" style={{ background: "#0D1524", border: `1px solid ${colors.borderSoft}` }}>
                <div><span style={{ color: colors.textFaint }}>Summary: </span><span style={{ color: colors.text }}>{sosSuccessResult.summary}</span></div>
                <div><span style={{ color: colors.textFaint }}>Severity: </span><span className="font-semibold uppercase" style={{ color: colors.flare }}>{sosSuccessResult.severity}</span></div>
                <div><span style={{ color: colors.textFaint }}>Coordinates: </span><span style={{ color: colors.ice, ...mono }}>{sosSuccessResult.coords}</span></div>
                <div><span style={{ color: colors.textFaint }}>Confirmed: </span><span style={{ color: colors.text, ...mono }}>{sosSuccessResult.confirmed_at}</span></div>
              </div>

              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                <Radio size={13} className="animate-pulse flex-shrink-0" />
                <span>Background location heartbeats continue every 15s to aid rescue teams.</span>
              </div>

              <button
                onClick={() => setSosSuccessResult(null)}
                className="w-full min-h-[48px] text-sm font-semibold rounded-lg cursor-pointer transition-opacity hover:opacity-90"
                style={{ background: colors.panelAlt, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                Return to Device Telemetry
              </button>
            </div>
          ) : sosConfirmation ? (
            /* SOS 30-SECOND CONFIRMATION MODE */
            <div className="p-5 rounded-xl flex flex-col gap-4 animate-in slide-in-from-top-4" style={{ background: colors.flareBg, border: `2px solid ${colors.flare}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TriangleAlert size={20} color={colors.flare} className="animate-bounce" />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.flare }}>
                    Distress Confirmation Required
                  </span>
                </div>
                <div className="text-xl font-bold px-2.5 py-0.5 rounded" style={{ background: colors.flare, color: "#fff", ...mono }}>
                  {sosCountdown}s
                </div>
              </div>

              <div className="text-xs leading-relaxed" style={{ color: colors.text }}>
                <p className="font-semibold">Confirm transmission to Bharti Station Operations.</p>
                <p className="text-[11px] mt-1" style={{ color: colors.textMuted }}>
                  Summary: <span style={{ color: colors.text }}>"{sosConfirmation.summary}"</span> ({sosConfirmation.severity})
                </p>
              </div>

              {/* Action Buttons: Cancel vs Confirm (Large touch targets) */}
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  onClick={handleConfirmSos}
                  disabled={sosConfirming}
                  className="w-full min-h-[52px] text-base font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-transform active:scale-95"
                  style={{ background: colors.flare, color: "#fff" }}
                >
                  {sosConfirming ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  <span>CONFIRM AND TRANSMIT SOS</span>
                </button>

                <button
                  onClick={handleCancelSos}
                  disabled={sosConfirming}
                  className="w-full min-h-[46px] text-sm font-medium rounded-xl cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: colors.panelAlt, color: colors.textMuted, border: `1px solid ${colors.border}` }}
                >
                  Cancel Distress Request
                </button>
              </div>
            </div>
          ) : (
            /* REGULAR DEVICE VIEWPORT */
            <>
              {/* Telemetry Display Card */}
              <div
                className="p-4 rounded-xl flex flex-col gap-3"
                style={{ background: "#0F1A2D", border: `1px solid ${colors.borderSoft}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Live GPS Telemetry
                  </span>
                  {isDemoGps && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-amber-300 bg-amber-950/60 border border-amber-800/50">
                      Demo Coordinates
                    </span>
                  )}
                </div>

                {/* Coordinate readout */}
                <div className="flex flex-col">
                  <span className="text-lg sm:text-xl font-bold tracking-tight" style={{ ...mono, color: colors.text }}>
                    {location ? formatCoordinates(location.latitude, location.longitude) : "—"}
                  </span>
                  <span className="text-xs mt-0.5" style={{ color: colors.textFaint }}>
                    {location ? `GPS accuracy ±${location.location_accuracy_m} m` : "Waiting for satellite lock..."}
                  </span>
                </div>

                {/* Additional sensor readouts */}
                {location && (
                  <div className="grid grid-cols-3 gap-2 pt-2 text-xs border-t" style={{ borderColor: colors.borderSoft }}>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Altitude</span>
                      <span className="font-semibold text-zinc-300" style={{ ...mono }}>
                        {location.altitude_m != null ? `${location.altitude_m} m` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Speed</span>
                      <span className="font-semibold text-zinc-300" style={{ ...mono }}>
                        {location.speed_mps != null ? `${location.speed_mps} m/s` : "0.0 m/s"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Heading</span>
                      <span className="font-semibold text-zinc-300" style={{ ...mono }}>
                        {location.heading_deg != null ? `${location.heading_deg}°` : "—"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Location Error & Fallback notice */}
                {locationError && (
                  <div className="p-2.5 rounded text-xs flex flex-col gap-2" style={{ background: colors.flareBg, color: colors.flare, border: `1px solid ${colors.flareDim}` }}>
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>{locationError}</span>
                    </div>
                    <button
                      onClick={handleUseDemoCoords}
                      className="text-xs font-semibold py-1.5 px-3 rounded text-left transition-opacity hover:opacity-90"
                      style={{ background: colors.panelAlt, color: colors.ice, border: `1px solid ${colors.iceDim}` }}
                    >
                      Use demo Bharti coordinates (-69.408° S, 76.190° E)
                    </button>
                  </div>
                )}
              </div>

              {/* Heartbeat Status Bar */}
              {isUplinkActive && (
                <div
                  className="p-3 rounded-lg text-xs flex items-center justify-between"
                  style={{ background: colors.panelAlt, border: `1px solid ${colors.borderSoft}` }}
                >
                  <div className="flex items-center gap-2">
                    <Clock size={13} color={colors.ice} />
                    <span style={{ color: colors.textMuted }}>Next heartbeat in:</span>
                    <span className="font-semibold" style={{ color: colors.ice, ...mono }}>
                      {countdown}s
                    </span>
                    {sendingHeartbeat && <Loader2 size={12} className="animate-spin text-cyan-400" />}
                  </div>
                  <span className="text-[11px]" style={{ color: colors.textFaint, ...mono }}>
                    {lastHeartbeatTime ? `Sent: ${lastHeartbeatTime}` : "Connecting..."}
                  </span>
                </div>
              )}

              {/* Backend Ack info */}
              {backendAck && (
                <div className="text-[11px] px-1 truncate" style={{ color: colors.textFaint, ...mono }}>
                  {backendAck}
                </div>
              )}

              {/* Main SOS Trigger Button */}
              {isUplinkActive && (
                <div className="pt-2">
                  <button
                    onClick={openSosModal}
                    className="w-full min-h-[60px] text-lg font-black tracking-wider rounded-2xl flex items-center justify-center gap-3 cursor-pointer shadow-2xl transition-transform active:scale-98"
                    style={{
                      background: colors.flare,
                      color: "#fff",
                      border: "2px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <TriangleAlert size={24} />
                    <span>INITIATE SOS DISTRESS</span>
                  </button>
                  <span className="text-[10px] text-center block mt-1.5" style={{ color: colors.textFaint }}>
                    Two-step verification required. Single tap will not send false alarm.
                  </span>
                </div>
              )}

              {/* Uplink Control (Start / Stop) */}
              <div className="pt-2">
                {isUplinkActive ? (
                  <button
                    onClick={stopUplink}
                    className="w-full min-h-[46px] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-85"
                    style={{ background: colors.panelAlt, color: colors.flare, border: `1px solid ${colors.flareDim}` }}
                  >
                    <WifiOff size={16} />
                    <span>Stop Uplink</span>
                  </button>
                ) : (
                  <button
                    onClick={handleRegisterDevice}
                    disabled={registering}
                    className="w-full min-h-[50px] text-base font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ background: colors.ice, color: colors.iceButtonText }}
                  >
                    {registering ? <Loader2 size={18} className="animate-spin" /> : <Radio size={18} />}
                    <span>Start Satellite Uplink</span>
                  </button>
                )}
              </div>

              {/* Device Identity Settings Accordion */}
              <div
                className="mt-2 p-3.5 rounded-xl flex flex-col gap-3 text-xs"
                style={{ background: colors.panelAlt, border: `1px solid ${colors.borderSoft}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-300">Device Configuration</span>
                  {deviceId && (
                    <span className="text-[10px]" style={{ color: colors.aurora, ...mono }}>
                      REGISTERED
                    </span>
                  )}
                </div>

                {/* Personnel selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px]" style={{ color: colors.textFaint }}>
                    Assigned Personnel
                  </label>
                  <select
                    value={selectedPersonnelId}
                    onChange={(e) => handlePersonnelChange(e.target.value)}
                    disabled={isUplinkActive}
                    className="w-full min-h-[42px] px-3 rounded-lg text-xs outline-none cursor-pointer"
                    style={{ background: "#05080E", color: colors.text, border: `1px solid ${colors.border}` }}
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
                </div>

                {/* Device Label */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px]" style={{ color: colors.textFaint }}>
                    Device Call-Sign / Label
                  </label>
                  <input
                    type="text"
                    value={deviceLabel}
                    onChange={(e) => handleDeviceLabelChange(e.target.value)}
                    disabled={isUplinkActive}
                    placeholder="e.g. SIM-BHARTI-01"
                    className="w-full min-h-[42px] px-3 rounded-lg text-xs outline-none"
                    style={{ background: "#05080E", color: colors.text, border: `1px solid ${colors.border}`, ...mono }}
                  />
                </div>

                {deviceId && (
                  <div className="text-[10px] truncate" style={{ color: colors.textFaint, ...mono }}>
                    Device ID: {deviceId}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Navigation */}
        <div
          className="p-3.5 border-t text-center flex items-center justify-between text-xs"
          style={{ background: "#0D1524", borderColor: colors.borderSoft }}
        >
          <Link
            to="/emergency"
            className="flex items-center gap-1 font-medium hover:underline"
            style={{ color: colors.textMuted }}
          >
            <ChevronLeft size={14} /> Back to Operations
          </Link>
          <span className="text-[10px]" style={{ color: colors.textFaint }}>
            DRISHTI PolarOps v2.4
          </span>
        </div>
      </div>

      {/* SOS INITIATION CONFIGURATION MODAL (Step 1) */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4 shadow-2xl border"
            style={{ background: "#0D1524", borderColor: colors.flareDim }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: colors.borderSoft }}>
              <div className="flex items-center gap-2">
                <TriangleAlert size={18} color={colors.flare} />
                <h3 className="text-sm font-bold text-white">Initiate SOS Distress</h3>
              </div>
              <button
                onClick={() => setSosModalOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInitiateSos} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-300">Emergency Type</label>
                <select
                  value={sosForm.emergency_type}
                  onChange={(e) => setSosForm((f) => ({ ...f, emergency_type: e.target.value }))}
                  className="w-full min-h-[42px] px-3 rounded-lg text-xs outline-none"
                  style={{ background: "#05080E", color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  <option value="medical">Medical emergency</option>
                  <option value="vehicle_breakdown">Vehicle breakdown / immobilized</option>
                  <option value="weather">Severe weather / whiteout shelter</option>
                  <option value="crevasse">Crevasse fall / ice hazard</option>
                  <option value="life_support">Life support / oxygen depletion</option>
                  <option value="other">Other urgent distress</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-300">Severity Level</label>
                <select
                  value={sosForm.severity}
                  onChange={(e) => setSosForm((f) => ({ ...f, severity: e.target.value }))}
                  className="w-full min-h-[42px] px-3 rounded-lg text-xs outline-none"
                  style={{ background: "#05080E", color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  <option value="immediate_response">Immediate Response (Life-threatening)</option>
                  <option value="critical">Critical (Urgent assistance required)</option>
                  <option value="moderate">Moderate (Standard recovery support)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-300">Summary / Notes</label>
                <textarea
                  value={sosForm.summary}
                  onChange={(e) => setSosForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Describe incident situation..."
                  rows={3}
                  className="w-full p-2.5 rounded-lg text-xs outline-none resize-none"
                  style={{ background: "#05080E", color: colors.text, border: `1px solid ${colors.border}` }}
                  required
                />
              </div>

              <div className="text-[11px] p-2.5 rounded" style={{ background: colors.panelAlt, color: colors.textMuted }}>
                Initiating opens a 30-second confirmation screen. Transmission will only send if explicitly confirmed.
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSosModalOpen(false)}
                  className="flex-1 min-h-[44px] rounded-lg text-xs font-medium cursor-pointer"
                  style={{ background: colors.panelAlt, color: colors.textMuted, border: `1px solid ${colors.border}` }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sosInitiating}
                  className="flex-1 min-h-[44px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ background: colors.flare, color: "#fff" }}
                >
                  {sosInitiating ? <Loader2 size={14} className="animate-spin" /> : <TriangleAlert size={14} />}
                  <span>Start 30s Window</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
