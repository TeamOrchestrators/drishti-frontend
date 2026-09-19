import { create } from "zustand";
import { expeditionsApi, inventoryApi, BHARTI_STATION_ID } from "../services/api";

export const useInventoryStore = create((set, get) => ({
  // Resolve the ID from the live backend instead of carrying a UUID from a
  // previous database seed into a fresh deployment.
  bhartiStationId: null,
  items: [],
  history: [],
  alerts: [],
  analyticsAvailable: false,
  loading: false,
  error: null,
  initialized: false,

  resolveBhartiStationId: async (forceRefresh = false) => {
    const existing = get().bhartiStationId;
    if (existing && !forceRefresh) return existing;

    try {
      const formOptions = await expeditionsApi.getFormOptions();
      const stationsList = formOptions?.stations || [];
      const bharti = stationsList.find((s) => {
        const name = (s.name || "").toLowerCase();
        const code = (s.code || "").toUpperCase();
        return (
          name.includes("bharti") ||
          name.includes("bharati") ||
          code === "BHARTI" ||
          code === "BHARATI"
        );
      });
      const stationId = bharti?.id || (stationsList.length > 0 ? stationsList[0].id : BHARTI_STATION_ID);
      set({ bhartiStationId: stationId });
      return stationId;
    } catch (err) {
      console.warn("Could not resolve Bharti station from form-options, using fallback ID:", err);
      set({ bhartiStationId: BHARTI_STATION_ID });
      return BHARTI_STATION_ID;
    }
  },

  fetchInventory: async (customStationId, isRetry = false) => {
    // If called by an event handler like onClick={fetchInventory}, customStationId is an event object!
    const targetId =
      typeof customStationId === "string" &&
      customStationId.trim() &&
      customStationId !== "undefined" &&
      customStationId !== "null" &&
      !customStationId.includes("object")
        ? customStationId.trim()
        : null;

    let stationId = targetId || get().bhartiStationId;
    if (!stationId) {
      stationId = await get().resolveBhartiStationId();
    }

    set({ loading: true, error: null });
    try {
      const data = await inventoryApi.getInventory(stationId);
      if (data && typeof data === "object") {
        set({
          items: Array.isArray(data.items) ? data.items : [],
          history: Array.isArray(data.history) ? data.history : [],
          alerts: Array.isArray(data.alerts) ? data.alerts : [],
          analyticsAvailable: Boolean(data.analytics_available),
          loading: false,
          initialized: true,
          error: null,
        });
      } else {
        set({
          items: [],
          history: [],
          alerts: [],
          analyticsAvailable: false,
          loading: false,
          initialized: true,
          error: null,
        });
      }
    } catch (err) {
      console.warn("Fetch inventory error:", err.message);
      if (!isRetry && err.message?.includes("invalid station_id")) {
        const freshId = await get().resolveBhartiStationId(true);
        if (freshId && freshId !== stationId) {
          return await get().fetchInventory(freshId, true);
        }
      }
      const isExpectedError =
        err.message?.includes("501") ||
        err.message?.includes("404") ||
        err.message?.includes("invalid station_id");
      set({
        items: [],
        history: [],
        alerts: [],
        analyticsAvailable: false,
        loading: false,
        initialized: true,
        error: isExpectedError ? null : err.message || "Failed to load inventory data",
      });
    }
  },

  setItems: (updater) =>
    set((state) => ({
      items: typeof updater === "function" ? updater(state.items) : updater,
    })),

  setHistory: (updater) =>
    set((state) => ({
      history: typeof updater === "function" ? updater(state.history) : updater,
    })),
}));

/**
 * Selector to compute the inventory alert count for notification badges.
 * Excludes any items or alerts with "Normal" stock status.
 * Only counts Critical or Low stock alerts that genuinely require operator attention.
 */
export const selectInventoryAlertCount = (state) => {
  const alertList = Array.isArray(state.alerts) ? state.alerts : [];
  const nonNormalAlerts = alertList.filter((a) => {
    const status = (a.status || "").toLowerCase();
    return status === "critical" || status === "low" || (status !== "normal" && status !== "");
  });

  const nonNormalItems = (state.items || []).filter((item) => {
    const level = (item.stock_level || item.criticality || "").toLowerCase();
    return level === "critical" || level === "low";
  });

  // If analytics alerts are provided, use their count; otherwise fall back to non-normal items count
  if (state.analyticsAvailable && alertList.length > 0) {
    return nonNormalAlerts.length;
  }
  return nonNormalItems.length;
};
