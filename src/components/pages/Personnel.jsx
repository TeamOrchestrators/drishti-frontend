import { useMemo, useState, useEffect } from "react";
import { colors, mono } from "../../theme";
import { Plus, History, UserCheck, Search, RefreshCw, AlertCircle } from "lucide-react";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import SectionHeading from "../ui/SectionHeading";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";
import { TableSkeleton, ListSkeleton } from "../ui/Skeleton.jsx";
import { usePersonnelStore } from "../../store/usePersonnelStore.js";
import { useExpeditionStore } from "../../store/useExpeditionStore.js";

function formatStatus(status) {
  if (!status) return "—";
  const str = String(status).trim();
  return str
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function statusTone(status) {
  if (!status) return "ice";
  const s = String(status).toLowerCase();
  if (s === "waiting_for_weather" || s === "planned") return "amber";
  if (s === "arrived_safely" || s === "cleared" || s === "completed" || s === "available" || s === "active") return "aurora";
  if (s === "on_leave" || s === "leave" || s === "inactive" || s === "off_duty") return "muted";
  return "ice";
}

function getPersonnelStatus(p, isBusy) {
  if (isBusy) {
    return { label: "On a movement", tone: "amber" };
  }
  const raw = String(p.status || p.duty_status || p.assignment_status || "").trim().toLowerCase();
  if (raw === "assigned" || raw === "on_duty" || Boolean(p.is_assigned)) {
    return { label: "Assigned", tone: "ice" };
  }
  if (raw === "on_leave" || raw === "leave") {
    return { label: "On leave", tone: "muted" };
  }
  if (raw === "inactive" || raw === "off_duty") {
    return { label: "Inactive", tone: "muted" };
  }
  if (raw === "medical_hold" || raw === "hold") {
    return { label: "Medical hold", tone: "flare" };
  }
  if (raw === "available" || raw === "active" || !raw) {
    return { label: "Available", tone: "aurora" };
  }
  return { label: formatStatus(raw), tone: statusTone(raw) };
}

function formatDisplayDateTime(d) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const hasSpecificTime = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(hasSpecificTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
  } catch {
    return d;
  }
}

const emptyForm = {
  expedition_id: "",
  personnel_id: "",
  origin_station_id: "",
  destination_station_id: "",
  departure_time: "",
  arrival_time: "",
  movement_status: "",
};

const Personnel = () => {
  const {
    movingPersonnel,
    totalPersonnel,
    movementHistory,
    formOptions,
    loading,
    formLoading,
    submitting,
    error,
    initialized,
    fetchPersonnel,
    fetchAssignmentFormOptions,
    assignPersonnel,
  } = usePersonnelStore();

  const {
    expeditions: liveExpeditions,
    stations: liveStations,
  } = useExpeditionStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPersonnel();
    fetchAssignmentFormOptions();
  }, [fetchPersonnel, fetchAssignmentFormOptions]);

  const set = (key) => (value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "departure_time" && value && next.arrival_time && next.arrival_time < value) {
        next.arrival_time = "";
      }
      if (key === "arrival_time" && value && next.departure_time && value < next.departure_time) {
        next.arrival_time = "";
      }
      return next;
    });
  };

  // Helper to resolve station names from live API stations
  const resolveStation = (id) => {
    if (!id) return "—";
    const found = liveStations.find((s) => s.id === id);
    return found ? found.name : id;
  };

  // Expeditions list from formOptions or live store
  const availableExpeditions = useMemo(() => {
    return formOptions.expeditions?.length > 0 ? formOptions.expeditions : liveExpeditions;
  }, [formOptions.expeditions, liveExpeditions]);

  // Station dropdown options populated from live API data and selected expedition
  const stationOptions = useMemo(() => {
    const opts = liveStations.map((s) => ({
      value: s.id,
      label: `${s.name}${s.code ? ` (${s.code})` : ""}`,
    }));

    const selectedExp = availableExpeditions.find((e) => e.id === form.expedition_id);
    const ensureOption = (id, fallbackName) => {
      if (id && !opts.some((o) => o.value === id)) {
        opts.push({
          value: id,
          label: fallbackName || resolveStation(id) || id,
        });
      }
    };

    if (form.origin_station_id) {
      ensureOption(form.origin_station_id, selectedExp?.origin_station_name);
    }
    if (form.destination_station_id) {
      ensureOption(form.destination_station_id, selectedExp?.destination_station_name);
    }

    return opts;
  }, [liveStations, availableExpeditions, form.expedition_id, form.origin_station_id, form.destination_station_id]);

  // Expedition dropdown options from API formOptions or live store
  const expeditionOptions = useMemo(() => {
    return availableExpeditions.map((e) => ({
      value: e.id,
      label: `${e.expedition_name || e.name || "Expedition"} (${e.expedition_code || e.id.slice(0, 8)})`,
    }));
  }, [availableExpeditions]);

  // When an expedition is selected, autofill origin and destination stations
  const handleExpeditionChange = (expeditionId) => {
    const selectedExp = availableExpeditions.find((e) => e.id === expeditionId);
    if (selectedExp) {
      const originId =
        selectedExp.origin_station_id ||
        selectedExp.originStationId ||
        liveStations.find((s) => s.name === selectedExp.origin_station_name || s.id === selectedExp.origin_station_id)?.id ||
        "";

      const destId =
        selectedExp.destination_station_id ||
        selectedExp.destinationStationId ||
        liveStations.find((s) => s.name === selectedExp.destination_station_name || s.id === selectedExp.destination_station_id)?.id ||
        "";

      setForm((prev) => ({
        ...prev,
        expedition_id: expeditionId,
        origin_station_id: originId,
        destination_station_id: destId,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        expedition_id: expeditionId,
        origin_station_id: "",
        destination_station_id: "",
      }));
    }
  };

  // Busy personnel ids and names (currently on an active movement)
  const busyPersonIds = useMemo(() => {
    return new Set(
      movingPersonnel
        .filter((m) => {
          const s = (m.movement_status || m.status || "").toLowerCase();
          return s === "in_transit" || s === "waiting_for_weather" || s === "planned";
        })
        .map((m) => m.personnel_id || m.personnelId || m.person_id)
        .filter(Boolean)
    );
  }, [movingPersonnel]);

  const busyPersonNames = useMemo(() => {
    return new Set(
      movingPersonnel
        .filter((m) => {
          const s = (m.movement_status || m.status || "").toLowerCase();
          return s === "in_transit" || s === "waiting_for_weather" || s === "planned";
        })
        .map((m) => m.personnel_name || m.full_name || m.name)
        .filter(Boolean)
    );
  }, [movingPersonnel]);

  // Personnel dropdown options: provides the full roster so all staff can be selected for assignment
  const personnelDropdownOptions = useMemo(() => {
    const map = new Map();
    (totalPersonnel || []).forEach((p) => {
      if (p && p.id) map.set(p.id, p);
    });
    (formOptions.personnel || []).forEach((p) => {
      if (p && p.id && !map.has(p.id)) map.set(p.id, p);
    });

    const allList = Array.from(map.values());

    return allList.map((p) => {
      const personName = p.full_name || p.name || "Personnel";
      const isBusy = busyPersonIds.has(p.id) || busyPersonNames.has(personName);
      const rawStatus = String(p.status || p.duty_status || p.assignment_status || "").trim().toLowerCase();
      const isAssigned = rawStatus === "assigned" || Boolean(p.is_assigned);

      let statusTag = "";
      if (isBusy) {
        statusTag = " · In motion";
      } else if (isAssigned) {
        statusTag = " · Assigned";
      }

      return {
        value: p.id,
        label: `${personName} (${p.role || p.personnel_code || "Personnel"})${statusTag}`,
      };
    });
  }, [formOptions.personnel, totalPersonnel, busyPersonIds, busyPersonNames]);

  // Movement status options directly from API formOptions
  const movementStatusOptions = useMemo(() => {
    const raw =
      formOptions.movement_status ||
      formOptions.movement_statuses ||
      formOptions.movementStatus ||
      formOptions.statuses ||
      [];

    let list = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === "object") {
      list = Object.entries(raw).map(([k, v]) => {
        if (typeof v === "object" && v !== null) return v;
        return { value: v, label: k };
      });
    }

    return list.map((s) => {
      if (typeof s === "object" && s !== null) {
        const val = s.value ?? s.id ?? s.code ?? s.name ?? "";
        const lbl = s.label ?? s.name ?? s.display_name ?? formatStatus(val);
        return { value: val, label: lbl };
      }
      return {
        value: s,
        label: formatStatus(s),
      };
    });
  }, [formOptions]);

  // Filtered roster based on search input
  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return totalPersonnel;
    return totalPersonnel.filter((p) => {
      const pName = p.full_name || p.name || "";
      const pRole = p.role || "";
      const pStation = p.current_station_name || resolveStation(p.current_station_id) || "";
      const pCode = p.personnel_code || p.id || "";
      return (
        pName.toLowerCase().includes(q) ||
        pRole.toLowerCase().includes(q) ||
        pStation.toLowerCase().includes(q) ||
        pCode.toLowerCase().includes(q)
      );
    });
  }, [search, totalPersonnel, liveStations]);

  // Modal opener: Form data does NOT autofill; starts completely unselected
  function openCreateModal() {
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!form.expedition_id) {
      setFormError("Please select an expedition.");
      return;
    }
    if (!form.personnel_id) {
      setFormError("Please select a personnel member.");
      return;
    }
    if (!form.origin_station_id) {
      setFormError("Selected expedition has no origin station configured.");
      return;
    }
    if (!form.destination_station_id) {
      setFormError("Selected expedition has no destination station configured.");
      return;
    }
    if (!form.departure_time) {
      setFormError("Please select a departure date.");
      return;
    }
    if (!form.arrival_time) {
      setFormError("Please select an arrival date.");
      return;
    }

    const depDate = new Date(form.departure_time.includes("T") ? form.departure_time : `${form.departure_time}T00:00:00Z`);
    const arrDate = new Date(form.arrival_time.includes("T") ? form.arrival_time : `${form.arrival_time}T00:00:00Z`);
    if (arrDate < depDate) {
      setFormError("Arrival date cannot be before departure date.");
      return;
    }

    if (!form.movement_status) {
      setFormError("Please select a movement status.");
      return;
    }

    const payload = {
      expedition_id: form.expedition_id,
      personnel_id: form.personnel_id,
      origin_station_id: form.origin_station_id,
      destination_station_id: form.destination_station_id,
      departure_time: depDate.toISOString(),
      arrival_time: arrDate.toISOString(),
      movement_status: form.movement_status,
    };

    try {
      await assignPersonnel(payload);
      setModalOpen(false);
      setForm(emptyForm);
    } catch (err) {
      setFormError(err.message || "Failed to assign personnel");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPersonnel}
              disabled={loading}
              title="Refresh personnel"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded cursor-pointer transition-opacity hover:opacity-90"
              style={{ color: colors.iceButtonText, background: colors.ice }}
            >
              <Plus size={15} /> Assign personnel
            </button>
          </div>
        }
      >
        Personnel movement
      </SectionHeading>

      {/* Error alert if any */}
      {error && (
        <div
          className="rounded-lg p-4 flex items-center justify-between gap-3 text-sm"
          style={{ background: colors.flareBg, border: `1px solid ${colors.flareDim}`, color: colors.flare }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchPersonnel}
            className="text-xs px-2.5 py-1 rounded font-medium cursor-pointer"
            style={{ background: colors.flareDim, color: colors.flare }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Current Movements Table */}
      <Panel title={`Current movements (${movingPersonnel.length})`}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          {(loading && !initialized) || (loading && movingPersonnel.length === 0) ? (
            <TableSkeleton rows={4} cols={7} />
          ) : (
            <table className="w-full text-sm border-collapse min-w-[760px]">
              <thead>
                <tr style={{ color: colors.textFaint }}>
                  {["Personnel", "Role", "Current station", "From → To", "Departure", "Arrival", "Status"].map((h, idx) => (
                    <th
                      key={h}
                      className={`text-left font-medium pb-3 text-xs whitespace-nowrap px-4 ${
                        idx === 0 ? "pl-2" : ""
                      } ${idx === 6 ? "pr-2" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movingPersonnel.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs" style={{ color: colors.textMuted }}>
                      No personnel currently in motion.
                    </td>
                  </tr>
                ) : (
                  movingPersonnel.map((p, i) => {
                    const person = totalPersonnel.find((item) => item.id === p.personnel_id);
                    const displayName = p.full_name || p.personnel_name || (person ? (person.full_name || person.name) : p.name) || "—";
                    const displayRole = p.role || (person ? person.role : "—");
                    const displayStation = p.current_station_name || (person ? (person.current_station_name || resolveStation(person.current_station_id)) : resolveStation(p.origin_station_id));
                    const fromStation = p.origin_station_name || resolveStation(p.origin_station_id) || "—";
                    const toStation = p.destination_station_name || resolveStation(p.destination_station_id) || "—";
                    const departure = p.departure_time ? formatDisplayDateTime(p.departure_time) : (p.departure || "—");
                    const arrival = p.arrival_time ? formatDisplayDateTime(p.arrival_time) : (p.arrival || "—");
                    const status = p.movement_status || p.status || "in_transit";

                    return (
                      <tr key={p.id || `${displayName}-${i}`} style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
                        <td className="py-3.5 px-4 pl-2 whitespace-nowrap" style={{ color: colors.text, fontWeight: 500 }}>
                          {displayName}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap" style={{ color: colors.textMuted }}>
                          {displayRole}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap" style={{ color: colors.textMuted }}>
                          {displayStation}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap" style={{ color: colors.textMuted, ...mono, fontSize: 13 }}>
                          {fromStation} → {toStation}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap" style={{ color: colors.textMuted, ...mono, fontSize: 12 }}>
                          {departure}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap" style={{ color: colors.textMuted, ...mono, fontSize: 12 }}>
                          {arrival}
                        </td>
                        <td className="py-3.5 px-4 pr-2 whitespace-nowrap">
                          <Pill tone={statusTone(status)}>{formatStatus(status)}</Pill>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      {/* Total Personnel Roster */}
      <Panel
        title={`Total Personnel - ${totalPersonnel.length}`}
        action={
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded w-full sm:w-auto"
            style={{ background: colors.bgRaised, border: `1px solid ${colors.border}` }}
          >
            <Search size={13} color={colors.textFaint} className="flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role, station..."
              className="text-xs outline-none bg-transparent w-full sm:w-48"
              style={{ color: colors.text }}
            />
          </div>
        }
      >
        <div className="flex flex-col" style={{ maxHeight: 320, overflowY: "auto" }}>
          {(loading && !initialized) || (loading && totalPersonnel.length === 0) ? (
            <ListSkeleton rows={5} />
          ) : (
            <>
              {filteredRoster.map((p) => {
                const personName = p.full_name || p.name;
                const isBusy = busyPersonIds.has(p.id) || busyPersonNames.has(personName);
                const statusInfo = getPersonnelStatus(p, isBusy);
                const stationName = p.current_station_name || resolveStation(p.current_station_id) || "Station Unassigned";
                const code = p.personnel_code || (p.id ? p.id.slice(0, 8) : "STAFF");

                return (
                  <div
                    key={p.id || personName}
                    className="flex items-center justify-between py-2.5 gap-2"
                    style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: colors.text }}>
                          {personName}{" "}
                          <span className="text-xs font-normal opacity-70" style={{ ...mono }}>
                            ({code})
                          </span>
                        </div>
                        <div className="text-xs truncate" style={{ color: colors.textMuted }}>
                          {p.role || "Station Staff"} · {stationName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <Pill tone={statusInfo.tone}>{statusInfo.label}</Pill>
                    </div>
                  </div>
                );
              })}
              {filteredRoster.length === 0 && (
                <div className="text-sm py-6 text-center" style={{ color: colors.textFaint }}>
                  {search ? `No one matches "${search}".` : "No personnel records found."}
                </div>
              )}
            </>
          )}
        </div>
      </Panel>

      {/* Movement History */}
      <Panel title="Movement history" action={<History size={15} color={colors.textFaint} />}>
        <div className="flex flex-col gap-3.5">
          {(loading && !initialized) || (loading && movementHistory.length === 0) ? (
            <ListSkeleton rows={3} />
          ) : movementHistory.length === 0 ? (
            <div className="text-sm py-4 text-center" style={{ color: colors.textMuted }}>
              No past movement records found.
            </div>
          ) : (
            movementHistory.map((h, i) => {
              const person = totalPersonnel.find((item) => item.id === h.personnel_id);
              const displayName = h.full_name || h.personnel_name || (person ? (person.full_name || person.name) : h.name) || "—";
              const fromStation = h.origin_station_name || resolveStation(h.origin_station_id) || "—";
              const toStation = h.destination_station_name || resolveStation(h.destination_station_id) || "—";
              const departure = h.departure_time ? formatDisplayDateTime(h.departure_time) : (h.departure || "—");
              const arrival = h.arrival_time ? formatDisplayDateTime(h.arrival_time) : (h.arrival || "—");
              const status = h.movement_status || h.status || "completed";

              return (
                <div
                  key={h.id || `${displayName}-${i}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 text-sm pb-2.5 sm:pb-0"
                  style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
                >
                  <div>
                    <span style={{ color: colors.text, fontWeight: 500 }}>{displayName}</span>
                    <span style={{ color: colors.textFaint }}> · </span>
                    <span style={{ color: colors.textMuted }}>
                      {fromStation} → {toStation}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 justify-between sm:justify-start">
                    <span style={{ color: colors.textFaint, ...mono, fontSize: 12 }}>
                      {departure} → {arrival}
                    </span>
                    <Pill tone={statusTone(status)}>{formatStatus(status)}</Pill>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>

      {/* Assign Personnel Modal */}
      {modalOpen && (
        <Modal title="Assign personnel to expedition movement" onClose={() => setModalOpen(false)} width={520}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {formError && (
              <div
                className="text-xs p-2.5 rounded flex items-center gap-1.5"
                style={{ background: colors.flareBg, color: colors.flare, border: `1px solid ${colors.flareDim}` }}
              >
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <FormField
              label="Expedition"
              as="select"
              options={expeditionOptions}
              value={form.expedition_id}
              onChange={handleExpeditionChange}
              placeholder="Select expedition..."
              required
            />

            <FormField
              label="Personnel to assign"
              as="select"
              options={personnelDropdownOptions}
              value={form.personnel_id}
              onChange={set("personnel_id")}
              placeholder="Select personnel..."
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Origin station (auto-filled)"
                as="select"
                options={stationOptions}
                value={form.origin_station_id}
                placeholder={form.expedition_id ? "No origin station set" : "Select expedition first..."}
                required
                disabled
              />
              <FormField
                label="Destination station (auto-filled)"
                as="select"
                options={stationOptions}
                value={form.destination_station_id}
                placeholder={form.expedition_id ? "No destination station set" : "Select expedition first..."}
                required
                disabled
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Departure date"
                type="date"
                value={form.departure_time}
                onChange={set("departure_time")}
                max={form.arrival_time || undefined}
                required
              />
              <FormField
                label="Arrival date"
                type="date"
                value={form.arrival_time}
                onChange={set("arrival_time")}
                min={form.departure_time || undefined}
                required
              />
            </div>

            <FormField
              label="Movement status"
              as="select"
              options={movementStatusOptions}
              value={form.movement_status}
              onChange={set("movement_status")}
              placeholder={formLoading ? "Loading status options..." : "Select status..."}
              required
            />

            <div className="flex justify-end gap-3 pt-3" style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm px-4 py-2 rounded cursor-pointer"
                style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-sm font-medium px-4 py-2 rounded cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                style={{ color: colors.iceButtonText, background: colors.ice }}
              >
                {submitting && <RefreshCw size={13} className="animate-spin" />}
                Assign personnel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Personnel;
