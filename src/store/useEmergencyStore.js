import { create } from "zustand";
import { emergencyApi } from "../services/api";

const TELEMETRY_CHANNEL_NAME = "polar_ops_telemetry_channel";
const TRACKS_STORAGE_KEY = "polar_ops_telemetry_tracks";
const LAST_TELEMETRY_KEY = "polar_ops_last_telemetry";

function loadStoredTracks() {
  try {
    const raw = localStorage.getItem(TRACKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredTracks(tracks) {
  try {
    localStorage.setItem(TRACKS_STORAGE_KEY, JSON.stringify(tracks));
  } catch (e) {
    console.warn("Could not save telemetry tracks to localStorage:", e);
  }
}

function loadLastTelemetry() {
  try {
    const raw = localStorage.getItem(LAST_TELEMETRY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let broadcastChannel = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(TELEMETRY_CHANNEL_NAME);
  } catch (err) {
    console.warn("BroadcastChannel not supported:", err);
  }
}

export const useEmergencyStore = create((set, get) => ({
  emergencies: [],
  activeEmergencies: [],
  activeCount: 0,
  loading: false,
  initialized: false,
  telemetryTracks: loadStoredTracks(),
  latestTelemetry: loadLastTelemetry(),

  fetchAll: async () => {
    try {
      const data = await emergencyApi.getAll();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.emergencies)
        ? data.emergencies
        : [];

      // Update emergency coordinates if we have live telemetry tracks for them
      const tracks = get().telemetryTracks;
      const enrichedList = list.map((e) => {
        const tr = tracks[e.id] || tracks[e.device_id] || [];
        if (tr.length > 0) {
          const lastPoint = tr[tr.length - 1];
          return {
            ...e,
            latitude: lastPoint.lat,
            longitude: lastPoint.lng,
            location_accuracy_m: lastPoint.accuracy || e.location_accuracy_m,
            heading_deg: lastPoint.heading ?? e.heading_deg,
            speed_mps: lastPoint.speed ?? e.speed_mps,
            last_heartbeat_at: lastPoint.timestamp || e.last_heartbeat_at,
          };
        }
        return e;
      });

      const enrichedActive = enrichedList.filter((e) => {
        const s = (e.status || "").toLowerCase();
        return s !== "resolved" && s !== "cancelled";
      });

      set({
        emergencies: enrichedList,
        activeEmergencies: enrichedActive,
        activeCount: enrichedActive.length,
        initialized: true,
      });

      return enrichedList;
    } catch (err) {
      console.warn("Failed to fetch all emergencies:", err);
      return [];
    }
  },

  fetchActive: async () => {
    try {
      const data = await emergencyApi.getActive();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.emergencies)
          ? data.emergencies
          : [];

      const activeList = list.filter((e) => {
        const s = (e.status || "").toLowerCase();
        return s !== "resolved" && s !== "cancelled";
      });

      // Enrich with any live telemetry in store
      const tracks = get().telemetryTracks;
      const enriched = activeList.map((e) => {
        const tr = tracks[e.id] || tracks[e.device_id] || [];
        if (tr.length > 0) {
          const lastPoint = tr[tr.length - 1];
          return {
            ...e,
            latitude: lastPoint.lat,
            longitude: lastPoint.lng,
            location_accuracy_m: lastPoint.accuracy || e.location_accuracy_m,
            heading_deg: lastPoint.heading ?? e.heading_deg,
            speed_mps: lastPoint.speed ?? e.speed_mps,
            last_heartbeat_at: lastPoint.timestamp || e.last_heartbeat_at,
          };
        }
        return e;
      });

      set({
        activeEmergencies: enriched,
        activeCount: enriched.length,
        initialized: true,
      });
      return enriched;
    } catch (err) {
      console.warn("Failed to fetch active emergencies, falling back to all:", err.message);
      return get().fetchAll();
    }
  },

  decrementActiveCount: () => {
    set((state) => ({
      activeCount: Math.max(0, state.activeCount - 1),
    }));
  },

  // Record a new location coordinate and trace path
  recordTelemetry: (payload) => {
    if (!payload || payload.latitude == null || payload.longitude == null) return;

    const lat = Number(payload.latitude);
    const lng = Number(payload.longitude);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

    const timestamp = payload.timestamp || payload.occurred_at || new Date().toISOString();
    const accuracy = Number(payload.accuracy || payload.location_accuracy_m || 8);
    const deviceId = payload.deviceId || payload.device_id || "default_device";
    const emergencyId = payload.emergencyId || payload.emergency_id;

    const newPoint = {
      lat,
      lng,
      timestamp,
      accuracy,
      speed: payload.speed_mps ?? payload.speed ?? null,
      heading: payload.heading_deg ?? payload.heading ?? null,
    };

    const currentTracks = {...get().telemetryTracks};
    const targetKeys = [deviceId, emergencyId, "global_live_track"].filter(Boolean);

    // If an existing emergency matches this device or reporter, associate it
    const matchingEmergency =
      get().activeEmergencies.find((e) => e.device_id === deviceId || e.id === emergencyId) ||
      get().emergencies.find((e) => e.device_id === deviceId || e.id === emergencyId) ||
      get().activeEmergencies[0] ||
      get().emergencies[0];

    if (matchingEmergency) {
      if (matchingEmergency.id && !targetKeys.includes(matchingEmergency.id)) {
        targetKeys.push(matchingEmergency.id);
      }
      if (matchingEmergency.device_id && !targetKeys.includes(matchingEmergency.device_id)) {
        targetKeys.push(matchingEmergency.device_id);
      }
    }

    targetKeys.forEach((key) => {
      const existing = currentTracks[key] || [];
      const last = existing[existing.length - 1];
      // Append if first point or if moved beyond 0.00001 deg (~1m)
      if (!last || Math.abs(last.lat - lat) > 0.00001 || Math.abs(last.lng - lng) > 0.00001) {
        currentTracks[key] = [...existing.slice(-200), newPoint];
      } else {
        // Keep the route free of duplicate points while still advancing the
        // live heartbeat metadata for a stationary device.
        currentTracks[key] = [...existing.slice(0, -1), {...last, ...newPoint}];
      }
    });

    saveStoredTracks(currentTracks);

    const updateEmergencyObj = (e) => {
      const isTarget =
        targetKeys.includes(e.id) ||
        targetKeys.includes(e.device_id) ||
        (get().activeEmergencies.length === 1 && e.id === get().activeEmergencies[0].id);

      if (isTarget) {
        return {
          ...e,
          latitude: lat,
          longitude: lng,
          location_accuracy_m: accuracy,
          heading_deg: payload.heading_deg ?? e.heading_deg,
          speed_mps: payload.speed_mps ?? e.speed_mps,
          battery_percent: payload.battery_percent ?? e.battery_percent,
          last_heartbeat_at: timestamp,
        };
      }
      return e;
    };

    const updatedActive = get().activeEmergencies.map(updateEmergencyObj);
    const updatedAll = get().emergencies.map(updateEmergencyObj);
    let finalActive = updatedActive;
    if (finalActive.length === 0) {
      const syntheticEmergency = {
        id: emergencyId || deviceId || "live-telemetry",
        emergency_code: "LIVE-FIELD-01",
        emergency_type: payload.emergency_type || "field_tracking",
        severity: payload.severity || "immediate_response",
        status: "active",
        summary: payload.summary || `Live tracking active · ${payload.device_label || deviceId || "Device"}`,
        latitude: lat,
        longitude: lng,
        location_accuracy_m: accuracy,
        heading_deg: payload.heading_deg ?? null,
        speed_mps: payload.speed_mps ?? null,
        battery_percent: payload.battery_percent ?? 85,
        reported_by_name: payload.reported_by_name || payload.personnel_name || "Field Team / Simulator",
        device_label: payload.device_label || deviceId || "SIM-BHARTI-01",
        device_id: deviceId,
        last_heartbeat_at: timestamp,
        reported_at: timestamp,
      };
      finalActive = [syntheticEmergency];
    }

    const latestTelem = {
      ...payload,
      latitude: lat,
      longitude: lng,
      timestamp,
      targetKeys,
    };

    try {
      localStorage.setItem(LAST_TELEMETRY_KEY, JSON.stringify(latestTelem));
    } catch (err) {
      console.warn("Could not save latest telemetry:", err);
    }

    set({
      telemetryTracks: currentTracks,
      activeEmergencies: finalActive,
      emergencies: updatedAll.length > 0 ? updatedAll : finalActive,
      latestTelemetry: latestTelem,
      activeCount: finalActive.length,
    });

    // Broadcast in real-time to other open tabs
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: "TELEMETRY_UPDATE",
          payload: latestTelem,
        });
      } catch (err) {
        console.warn("Failed to broadcast telemetry:", err);
      }
    }
  },

  getTrack: (id) => {
    if (!id) return get().telemetryTracks["global_live_track"] || [];
    const tracks = get().telemetryTracks;
    return tracks[id] || tracks["global_live_track"] || [];
  },
}));

// Cross-tab message receiver
if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    if (event?.data?.type === "TELEMETRY_UPDATE") {
      const p = event.data.payload;
      const store = useEmergencyStore.getState();
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const currentTracks = {...store.telemetryTracks};
      const newPoint = {
        lat,
        lng,
        timestamp: p.timestamp,
        accuracy: Number(p.accuracy || p.location_accuracy_m || 8),
        speed: p.speed_mps ?? null,
        heading: p.heading_deg ?? null,
      };

      const keys = p.targetKeys || [p.deviceId, p.emergencyId, "global_live_track"].filter(Boolean);
      keys.forEach((key) => {
        const existing = currentTracks[key] || [];
        const last = existing[existing.length - 1];
        if (!last || Math.abs(last.lat - lat) > 0.00001 || Math.abs(last.lng - lng) > 0.00001) {
          currentTracks[key] = [...existing.slice(-200), newPoint];
        } else {
          currentTracks[key] = [...existing.slice(0, -1), {...last, ...newPoint}];
        }
      });

      saveStoredTracks(currentTracks);

      const updateEmergencyObj = (e) => {
        const isTarget =
          keys.includes(e.id) ||
          keys.includes(e.device_id) ||
          (store.activeEmergencies.length === 1 && e.id === store.activeEmergencies[0].id);

        if (isTarget) {
          return {
            ...e,
            latitude: lat,
            longitude: lng,
            location_accuracy_m: p.accuracy || e.location_accuracy_m,
            heading_deg: p.heading_deg ?? e.heading_deg,
            speed_mps: p.speed_mps ?? e.speed_mps,
            battery_percent: p.battery_percent ?? e.battery_percent,
            last_heartbeat_at: p.timestamp,
          };
        }
        return e;
      };

      let updatedActive = store.activeEmergencies.map(updateEmergencyObj);
      if (updatedActive.length === 0) {
        updatedActive = [{
          id: p.emergencyId || p.deviceId || "live-telemetry",
          emergency_code: "LIVE-FIELD-01",
          emergency_type: p.emergency_type || "field_tracking",
          severity: p.severity || "immediate_response",
          status: "active",
          summary: p.summary || `Live tracking active · ${p.device_label || p.deviceId || "Device"}`,
          latitude: lat,
          longitude: lng,
          location_accuracy_m: p.accuracy || 8,
          heading_deg: p.heading_deg ?? null,
          speed_mps: p.speed_mps ?? null,
          battery_percent: p.battery_percent ?? 85,
          reported_by_name: p.reported_by_name || p.personnel_name || "Field Team / Simulator",
          device_label: p.device_label || p.deviceId || "SIM-BHARTI-01",
          device_id: p.deviceId || "default_device",
          last_heartbeat_at: p.timestamp,
          reported_at: p.timestamp,
        }];
      }

      useEmergencyStore.setState({
        telemetryTracks: currentTracks,
        activeEmergencies: updatedActive,
        emergencies: store.emergencies.length > 0 ? store.emergencies.map(updateEmergencyObj) : updatedActive,
        latestTelemetry: p,
        activeCount: updatedActive.length,
      });
    }
  };
}
