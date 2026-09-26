import { create } from "zustand";
import {expeditionsApi, personnelApi} from "../services/api";

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
      const [formData, personnelData] = await Promise.allSettled([
        expeditionsApi.getFormOptions(),
        personnelApi.getAll(),
      ]);

      const formRes = formData.status === "fulfilled" ? formData.value : null;
      const rawPersonnel = Array.isArray(formRes?.personnel) ? formRes.personnel : [];
      const stationsList = Array.isArray(formRes?.stations) ? formRes.stations : [];

      let totalPersonnelList = [];
      if (personnelData.status === "fulfilled" && personnelData.value) {
        totalPersonnelList = Array.isArray(personnelData.value.total_personnel)
          ? personnelData.value.total_personnel
          : [];
      }

      const enrichedPersonnel = rawPersonnel.map((p) => {
        const match = totalPersonnelList.find(
          (tp) =>
            tp.personnel_id === p.id ||
            tp.id === p.id ||
            String(tp.name || "").trim().toLowerCase() === String(p.full_name || "").trim().toLowerCase()
        );
        return {
          ...p,
          current_station: match?.current_station || match?.current_station_name || p.current_station || null,
          current_station_id: match?.current_station_id || p.current_station_id || null,
          status: match?.status || p.status || null,
        };
      });

      set({
        stations: stationsList,
        personnel: enrichedPersonnel,
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
        get().fetchFormOptions(),
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
