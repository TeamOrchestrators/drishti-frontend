import { create } from "zustand";
import { personnelApi } from "../services/api";

export const usePersonnelStore = create((set, get) => ({
  movingPersonnel: [],
  totalPersonnel: [],
  movementHistory: [],
  formOptions: {
    expeditions: [],
    personnel: [],
    movement_status: [],
  },
  loading: false,
  formLoading: false,
  submitting: false,
  error: null,
  initialized: false,

  fetchPersonnel: async () => {
    set({ loading: true, error: null });
    try {
      const data = await personnelApi.getAll();

      if (data && typeof data === "object") {
        set({
          movingPersonnel: Array.isArray(data.moving_personnel) ? data.moving_personnel : [],
          totalPersonnel: Array.isArray(data.total_personnel) ? data.total_personnel : [],
          movementHistory: Array.isArray(data.movement_history) ? data.movement_history : [],
          loading: false,
          initialized: true,
          error: null,
        });
        return;
      }

      set({
        movingPersonnel: [],
        totalPersonnel: [],
        movementHistory: [],
        loading: false,
        initialized: true,
      });
    } catch (err) {
      set({
        movingPersonnel: [],
        totalPersonnel: [],
        movementHistory: [],
        loading: false,
        initialized: true,
        error: err.message || "Failed to load personnel data from API",
      });
    }
  },

  fetchAssignmentFormOptions: async () => {
    set({ formLoading: true });
    try {
      const data = await personnelApi.getAssignmentFormOptions();
      if (data && typeof data === "object") {
        const movementStatusData =
          data.movement_status ??
          data.movement_statuses ??
          data.movementStatus ??
          data.movementStatuses ??
          data.movement_status_enum ??
          data.movement_status_options ??
          data.movement_statuses_enum ??
          data.status_enum ??
          data.status_enums ??
          data.statuses ??
          data.status ??
          [];

        set({
          formOptions: {
            expeditions: Array.isArray(data.expeditions) ? data.expeditions : [],
            personnel: Array.isArray(data.personnel) ? data.personnel : [],
            movement_status: Array.isArray(movementStatusData)
              ? movementStatusData
              : typeof movementStatusData === "object" && movementStatusData !== null
              ? Object.values(movementStatusData)
              : [],
          },
          formLoading: false,
        });
      } else {
        set({ formLoading: false });
      }
    } catch (err) {
      console.warn("Failed to load assignment form options from API:", err.message);
      set({ formLoading: false });
    }
  },

  assignPersonnel: async (payload) => {
    set({ submitting: true, error: null });
    try {
      const result = await personnelApi.assignExpedition(payload);
      await get().fetchPersonnel();
      set({ submitting: false });
      return result;
    } catch (err) {
      set({ submitting: false, error: err.message || "Failed to assign personnel" });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
