import { create } from "zustand";
import { cargoApi } from "../services/api";

export const useCargoStore = create((set, get) => ({
  cargo: [],
  batches: [],
  loading: false,
  submitting: false,
  assigningCargoId: null,
  error: null,
  initialized: false,

  fetchCargo: async () => {
    set({ loading: true, error: null });
    try {
      const data = await cargoApi.getAll();
      if (data && typeof data === "object") {
        set({
          cargo: Array.isArray(data.cargo) ? data.cargo : [],
          batches: Array.isArray(data.batches) ? data.batches : [],
          loading: false,
          initialized: true,
          error: null,
        });
        return;
      }

      set({
        cargo: [],
        batches: [],
        loading: false,
        initialized: true,
        error: null,
      });
    } catch (err) {
      set({
        cargo: [],
        batches: [],
        loading: false,
        initialized: true,
        error: err.message || "Failed to load cargo & logistics data from API",
      });
    }
  },

  createCargo: async (payload) => {
    set({ submitting: true, error: null });
    try {
      const created = await cargoApi.create(payload);
      await get().fetchCargo();
      set({ submitting: false });
      return created;
    } catch (err) {
      set({ submitting: false, error: err.message || "Failed to create cargo request" });
      throw err;
    }
  },

  createBatch: async (payload) => {
    set({ submitting: true, error: null });
    try {
      const created = await cargoApi.createBatch(payload);
      await get().fetchCargo();
      set({ submitting: false });
      return created;
    } catch (err) {
      set({ submitting: false, error: err.message || "Failed to create logistics batch" });
      throw err;
    }
  },

  assignLogisticsBatch: async (cargoId, batchId) => {
    set({ assigningCargoId: cargoId, error: null });
    try {
      const result = await cargoApi.assignLogisticsBatch(cargoId, batchId);
      await get().fetchCargo();
      set({ assigningCargoId: null });
      return result;
    } catch (err) {
      set({ assigningCargoId: null, error: err.message || "Failed to assign logistics batch" });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
