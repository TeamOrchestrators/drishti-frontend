import { create } from "zustand";
import { expeditionsApi } from "../services/api";

export const useExpeditionStore = create((set, get) => ({
  expeditions: [],
  stations: [],
  personnel: [],
  loading: false,
  formOptionsLoading: false,
  submitting: false,
  error: null,
  initialized: false,

  fetchFormOptions: async () => {
    set({ formOptionsLoading: true });
    try {
      const data = await expeditionsApi.getFormOptions();
      set({
        stations: Array.isArray(data?.stations) ? data.stations : [],
        personnel: Array.isArray(data?.personnel) ? data.personnel : [],
        formOptionsLoading: false,
      });
    } catch (err) {
      console.warn("Failed to load form options from API:", err.message);
      set({ formOptionsLoading: false });
    }
  },

  fetchExpeditions: async () => {
    set({ loading: true, error: null });
    try {
      // Fetch expeditions and form-options concurrently for fast rendering
      const [expData] = await Promise.all([
        expeditionsApi.getAll(),
        get().stations.length === 0 ? get().fetchFormOptions() : Promise.resolve(),
      ]);

      set({
        expeditions: Array.isArray(expData) ? expData : [],
        loading: false,
        initialized: true,
        error: null,
      });
    } catch (err) {
      set({
        loading: false,
        initialized: true,
        error: err.message || "Failed to load expeditions",
      });
    }
  },

  createExpedition: async (payload) => {
    set({ submitting: true, error: null });
    try {
      const created = await expeditionsApi.create(payload);
      // Re-fetch to ensure all server-generated fields and relations are up-to-date
      await get().fetchExpeditions();
      set({ submitting: false });
      return created;
    } catch (err) {
      set({ submitting: false, error: err.message || "Failed to create expedition" });
      throw err;
    }
  },

  updateExpedition: async (id, payload) => {
    set({ submitting: true, error: null });
    try {
      const updated = await expeditionsApi.update(id, payload);
      // Re-fetch to ensure all server-generated fields are up-to-date
      await get().fetchExpeditions();
      set({ submitting: false });
      return updated;
    } catch (err) {
      set({ submitting: false, error: err.message || "Failed to update expedition" });
      throw err;
    }
  },

  getStationName: (stationId) => {
    if (!stationId) return "—";
    const found = get().stations.find((s) => s.id === stationId);
    return found ? found.name : null;
  },

  getPersonnelName: (personnelId) => {
    if (!personnelId) return null;
    const found = get().personnel.find((p) => p.id === personnelId);
    return found ? found.full_name : null;
  },

  clearError: () => set({ error: null }),
}));
