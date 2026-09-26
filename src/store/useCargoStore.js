import { create } from "zustand";
import { cargoApi } from "../services/api";
import {resolveBatchStatus} from "../utils/cargoUtils";

export const useCargoStore = create((set, get) => ({
  cargo: [],
  batches: [],
  batchTracking: {},
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
        const cargoList = Array.isArray(data.cargo) ? data.cargo : [];
        const rawBatchList = Array.isArray(data.batches) ? data.batches : [];
        const currentTracking = get().batchTracking || {};

        const batchList = rawBatchList.map((b) => ({
          ...b,
          raw_status: b.status,
          status: resolveBatchStatus(
            b,
            cargoList,
            (b.id && currentTracking[b.id]) || (b.batch_code && currentTracking[b.batch_code])
          ),
        }));

        set({
          cargo: cargoList,
          batches: batchList,
          loading: false,
          initialized: true,
          error: null,
        });

        // Fetch tracking for each batch in parallel
        if (batchList.length > 0) {
          try {
            const trackingPromises = batchList
              .filter((b) => b.id)
              .map(async (b) => {
                try {
                  const tr = await cargoApi.getBatchTracking(b.id);
                  return {id: b.id, batch_code: b.batch_code, data: tr};
                } catch {
                  return {id: b.id, batch_code: b.batch_code, data: null};
                }
              });
            const results = await Promise.allSettled(trackingPromises);
            const trackingMap = {};
            results.forEach((res) => {
              if (res.status === "fulfilled" && res.value?.data) {
                if (res.value.id) trackingMap[res.value.id] = res.value.data;
                if (res.value.batch_code) trackingMap[res.value.batch_code] = res.value.data;
              }
            });
            const mergedTracking = {...get().batchTracking, ...trackingMap};
            set((state) => ({
              batchTracking: mergedTracking,
              batches: state.batches.map((b) => ({
                ...b,
                status: resolveBatchStatus(
                  b,
                  state.cargo,
                  (b.id && mergedTracking[b.id]) || (b.batch_code && mergedTracking[b.batch_code])
                ),
              })),
            }));
          } catch (trackingErr) {
            console.warn("Could not fetch batch tracking data:", trackingErr);
          }
        }
        return;
      }

      set({
        cargo: [],
        batches: [],
        batchTracking: {},
        loading: false,
        initialized: true,
        error: null,
      });
    } catch (err) {
      set({
        cargo: [],
        batches: [],
        batchTracking: {},
        loading: false,
        initialized: true,
        error: err.message || "Failed to load cargo & logistics data from API",
      });
    }
  },

  fetchBatchTracking: async (batchId) => {
    if (!batchId) return null;
    try {
      const tr = await cargoApi.getBatchTracking(batchId);
      if (tr) {
        set((state) => {
          const updatedTracking = {
            ...state.batchTracking,
            [batchId]: tr,
            ...(tr.batch_code ? {[tr.batch_code]: tr} : {}),
          };
          return {
            batchTracking: updatedTracking,
            batches: state.batches.map((b) => {
              if (b.id === batchId || (tr.batch_code && b.batch_code === tr.batch_code)) {
                return {
                  ...b,
                  status: resolveBatchStatus(b, state.cargo, tr),
                };
              }
              return b;
            }),
          };
        });
      }
      return tr;
    } catch (err) {
      console.warn(`Could not fetch tracking for batch ${batchId}:`, err);
      return null;
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
