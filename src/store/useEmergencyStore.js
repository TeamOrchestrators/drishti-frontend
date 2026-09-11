import { create } from "zustand";
import { emergencyApi } from "../services/api";

export const useEmergencyStore = create((set) => ({
  activeEmergencies: [],
  activeCount: 0,
  loading: false,
  initialized: false,

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

      set({
        activeEmergencies: activeList,
        activeCount: activeList.length,
        initialized: true,
      });
      return activeList;
    } catch (err) {
      console.warn("Failed to fetch active emergencies, trying all:", err.message);
      try {
        const allData = await emergencyApi.getAll();
        const allList = Array.isArray(allData)
          ? allData
          : Array.isArray(allData?.emergencies)
          ? allData.emergencies
          : [];
        const activeList = allList.filter((e) => {
          const s = (e.status || "").toLowerCase();
          return (
            ["active", "acknowledged", "responding", "immediate_response"].includes(s) &&
            s !== "resolved" &&
            s !== "cancelled"
          );
        });
        set({
          activeEmergencies: activeList,
          activeCount: activeList.length,
          initialized: true,
        });
        return activeList;
      } catch {
        return [];
      }
    }
  },

  decrementActiveCount: () => {
    set((state) => ({
      activeCount: Math.max(0, state.activeCount - 1),
    }));
  },
}));
