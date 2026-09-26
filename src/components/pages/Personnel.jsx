import {useMemo, useState, useEffect, useCallback} from "react";
import { colors, mono } from "../../theme";
import {
  Plus,
  History,
  Search,
  RefreshCw,
  AlertCircle,
  MapPin,
  ArrowRight,
  Navigation,
  ChevronRight,
  X,
} from "lucide-react";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import SectionHeading from "../ui/SectionHeading";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";
import { TableSkeleton, ListSkeleton } from "../ui/Skeleton.jsx";
import { usePersonnelStore } from "../../store/usePersonnelStore.js";
import { useExpeditionStore } from "../../store/useExpeditionStore.js";
import PersonnelDrawer from "../personnel/PersonnelDrawer.jsx";

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
  if (s === "waiting_for_weather" || s === "planned" || s === "in_transit") return "amber";
  if (s === "arrived_safely" || s === "cleared" || s === "completed" || s === "available" || s === "active" || s === "arrived") return "aurora";
  if (s === "on_leave" || s === "leave" || s === "inactive" || s === "off_duty" || s === "cancelled") return "muted";
  return "ice";
}

function getPersonnelStatusBadge(person) {
  if (person.isInTransit) {
    return {label: "In transit", tone: "amber"};
  }
  const raw = String(person.status || "").trim().toLowerCase();
  if (raw === "available" || raw === "active" || !raw) {
    return {label: "Available", tone: "aurora"};
  }
  if (raw === "assigned" || raw === "on_duty" || Boolean(person.is_assigned)) {
    return {label: "Stationed / Assigned", tone: "ice"};
  }
  if (raw === "in_transit" || raw === "moving") {
    return {label: "In transit", tone: "amber"};
  }
  if (raw === "inactive" || raw === "off_duty") {
    return { label: "Inactive", tone: "muted" };
  }
  if (raw === "unavailable" || raw === "leave" || raw === "on_leave") {
    return {label: "Unavailable", tone: "muted"};
  }
  if (raw === "medical_hold" || raw === "hold") {
    return { label: "Medical hold", tone: "flare" };
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

function getInitials(name) {
  if (!name) return "??";
  const cleaned = name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  const [locationFilter, setLocationFilter] = useState("all");
  const [selectedPerson, setSelectedPerson] = useState(null);

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
  const resolveStation = useCallback((id) => {
    if (!id) return "—";
    const found = liveStations.find((s) => s.id === id);
    return found ? found.name : id;
  }, [liveStations]);

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
  }, [liveStations, availableExpeditions, form.expedition_id, form.origin_station_id, form.destination_station_id, resolveStation]);

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
        .map((m) => m.personnel_id || m.personnelId || m.person_id || m.id)
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
        .map((m) => (m.personnel_name || m.full_name || m.name || "").trim().toLowerCase())
        .filter(Boolean)
    );
  }, [movingPersonnel]);

  // Personnel dropdown options for assignment modal
  const personnelDropdownOptions = useMemo(() => {
    const map = new Map();
    (totalPersonnel || []).forEach((p) => {
      const id = p.personnel_id || p.id;
      if (id) map.set(id, p);
    });
    (formOptions.personnel || []).forEach((p) => {
      const id = p.personnel_id || p.id;
      if (id && !map.has(id)) map.set(id, p);
    });

    const allList = Array.from(map.values());

    return allList.map((p) => {
      const id = p.personnel_id || p.id;
      const personName = p.full_name || p.name || "Personnel";
      const isBusy = busyPersonIds.has(id) || busyPersonNames.has(personName.toLowerCase());
      const rawStatus = String(p.status || p.duty_status || p.assignment_status || "").trim().toLowerCase();
      const isAssigned = rawStatus === "assigned" || Boolean(p.is_assigned);

      let statusTag = "";
      if (isBusy) {
        statusTag = " · In motion";
      } else if (isAssigned) {
        statusTag = " · Assigned";
      }

      return {
        value: id,
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

  // Construct unified personnel roster merging total_personnel and moving_personnel
  const unifiedRoster = useMemo(() => {
    const map = new Map();

    const movingByPersonId = new Map();
    const movingByName = new Map();

    movingPersonnel.forEach((m) => {
      const id = m.personnel_id || m.id;
      const name = (m.name || m.full_name || m.personnel_name || "").trim();
      if (id) movingByPersonId.set(id, m);
      if (name) movingByName.set(name.toLowerCase(), m);
    });

    // Ingest totalPersonnel
    totalPersonnel.forEach((p) => {
      const id = p.personnel_id || p.id;
      const name = (p.name || p.full_name || p.personnel_name || "Personnel").trim();
      const activeMov = (id && movingByPersonId.get(id)) || movingByName.get(name.toLowerCase()) || null;
      const isInTransit = Boolean(activeMov);
      const station = p.current_station || p.current_station_name || resolveStation(p.current_station_id) || "";

      const key = id || name;
      map.set(key, {
        ...p,
        personnel_id: id,
        name,
        role: p.role || (activeMov && activeMov.role) || "Station Staff",
        current_station: station,
        isInTransit,
        activeMovement: activeMov,
        status: isInTransit ? (activeMov.status || activeMov.movement_status || "in_transit") : (p.status || "available"),
        personnel_code: p.personnel_code || (id ? id.slice(0, 8) : ""),
        rawPerson: p,
      });
    });

    // Ingest any staff in movingPersonnel that were not listed in totalPersonnel
    movingPersonnel.forEach((m) => {
      const id = m.personnel_id || m.id;
      const name = (m.name || m.full_name || m.personnel_name || "Personnel").trim();
      const key = id || name;
      if (!map.has(key) && !movingByName.has(name.toLowerCase())) {
        map.set(key, {
          ...m,
          personnel_id: id,
          name,
          role: m.role || "Station Staff",
          current_station: m.current_station || "",
          isInTransit: true,
          activeMovement: m,
          status: m.status || m.movement_status || "in_transit",
          personnel_code: m.personnel_code || (id ? id.slice(0, 8) : ""),
          rawPerson: m,
        });
      }
    });

    return Array.from(map.values());
  }, [totalPersonnel, movingPersonnel, resolveStation]);

  // Compute counts for location chips according to requirements:
  // - "In transit" derived from moving_personnel
  // - "India HQ", "Bharti", "Maitri" derived from total_personnel.current_station
  const filterCounts = useMemo(() => {
    let allCount = unifiedRoster.length;
    let inTransitCount = 0;
    let indiaCount = 0;
    let bhartiCount = 0;
    let maitriCount = 0;

    unifiedRoster.forEach((p) => {
      if (p.isInTransit) {
        inTransitCount++;
      } else {
        const station = (p.current_station || "").toLowerCase();
        if (station.includes("india") || station.includes("hq")) {
          indiaCount++;
        } else if (station.includes("bharti")) {
          bhartiCount++;
        } else if (station.includes("maitri")) {
          maitriCount++;
        }
      }
    });

    return {
      all: allCount,
      india_hq: indiaCount,
      bharti: bhartiCount,
      maitri: maitriCount,
      in_transit: inTransitCount,
    };
  }, [unifiedRoster]);

  const filterChips = [
    {id: "all", label: "All staff", count: filterCounts.all},
    {id: "india_hq", label: "India HQ", count: filterCounts.india_hq},
    {id: "bharti", label: "Bharti", count: filterCounts.bharti},
    {id: "maitri", label: "Maitri", count: filterCounts.maitri},
    {id: "in_transit", label: "In transit", count: filterCounts.in_transit},
  ];

  // Filter roster by location chip AND search string
  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();

    return unifiedRoster.filter((p) => {
      // 1. Location filter chip check
      if (locationFilter === "in_transit") {
        if (!p.isInTransit) return false;
      } else if (locationFilter === "india_hq") {
        if (p.isInTransit) return false;
        const s = (p.current_station || "").toLowerCase();
        if (!s.includes("india") && !s.includes("hq")) return false;
      } else if (locationFilter === "bharti") {
        if (p.isInTransit) return false;
        const s = (p.current_station || "").toLowerCase();
        if (!s.includes("bharti")) return false;
      } else if (locationFilter === "maitri") {
        if (p.isInTransit) return false;
        const s = (p.current_station || "").toLowerCase();
        if (!s.includes("maitri")) return false;
      }

      // 2. Search filter (name, role, station, route, code)
      if (q) {
        const nameMatch = (p.name || "").toLowerCase().includes(q);
        const roleMatch = (p.role || "").toLowerCase().includes(q);
        const stationMatch = (p.current_station || "").toLowerCase().includes(q);
        const codeMatch = (p.personnel_code || "").toLowerCase().includes(q);
        const originMatch = (p.activeMovement?.origin_station_name || "").toLowerCase().includes(q);
        const destMatch = (p.activeMovement?.destination_station_name || "").toLowerCase().includes(q);

        if (!nameMatch && !roleMatch && !stationMatch && !codeMatch && !originMatch && !destMatch) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedRoster, locationFilter, search]);

  // Handler when clicking a row in Current movements table
  const handleSelectFromMovement = (m) => {
    const movId = m.personnel_id || m.id;
    const movName = (m.name || m.personnel_name || m.full_name || "").trim().toLowerCase();

    const found = unifiedRoster.find((item) => {
      const itemId = item.personnel_id || item.id;
      if (movId && itemId && movId === itemId) return true;
      const itemName = (item.name || item.full_name || "").trim().toLowerCase();
      if (movName && itemName && movName === itemName) return true;
      return false;
    });

    if (found) {
      setSelectedPerson(found);
    } else {
      setSelectedPerson({
        personnel_id: movId,
        name: m.name || m.personnel_name || m.full_name || "Personnel",
        role: m.role || "Station Staff",
        current_station: m.current_station || "",
        isInTransit: true,
        activeMovement: m,
        status: m.status || m.movement_status || "in_transit",
      });
    }
  };

  // Handler when clicking a row in Personnel Directory
  const handleSelectPersonnel = (p) => {
    setSelectedPerson(p);
  };

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

      {/* 1. Current Movements Section */}
      <Panel
        title={`Current movements (${movingPersonnel.length})`}
        right={
          <span className="text-xs hidden sm:inline" style={{color: colors.textFaint}}>
            Click row to view personnel profile
          </span>
        }
      >
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
                    const person = totalPersonnel.find((item) => item.id === p.personnel_id || item.personnel_id === p.personnel_id);
                    const displayName = p.full_name || p.personnel_name || (person ? (person.full_name || person.name) : p.name) || "—";
                    const displayRole = p.role || (person ? person.role : "—");
                    const displayStation = p.current_station_name || (person ? (person.current_station_name || resolveStation(person.current_station_id)) : resolveStation(p.origin_station_id));
                    const fromStation = p.origin_station_name || resolveStation(p.origin_station_id) || "—";
                    const toStation = p.destination_station_name || resolveStation(p.destination_station_id) || "—";
                    const departure = p.departure_time ? formatDisplayDateTime(p.departure_time) : (p.departure || "—");
                    const arrival = p.arrival_time ? formatDisplayDateTime(p.arrival_time) : (p.arrival || "—");
                    const status = p.movement_status || p.status || "in_transit";

                    return (
                      <tr
                        key={p.id || p.personnel_id || `${displayName}-${i}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectFromMovement(p)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectFromMovement(p);
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-white/[0.04] group outline-none"
                        style={{borderTop: `1px solid ${colors.borderSoft}`}}
                      >
                        <td
                          className="py-3.5 px-4 pl-2 whitespace-nowrap font-medium group-hover:text-[var(--color-ice)] transition-colors"
                          style={{color: colors.text}}>
                          {displayName}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap" style={{ color: colors.textMuted }}>
                          {displayRole}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap" style={{ color: colors.textMuted }}>
                          {displayStation}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap"
                            style={{color: colors.amber, ...mono, fontSize: 13}}>
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

      {/* 2. Personnel Directory Section */}
      <Panel
        title={`Personnel Directory (${filteredRoster.length})`}
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
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-0.5 rounded cursor-pointer hover:opacity-75"
                style={{color: colors.textMuted}}
                aria-label="Clear search"
              >
                <X size={12}/>
              </button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-3.5">
          {/* Location Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {filterChips.map((chip) => {
              const active = locationFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setLocationFilter(chip.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    background: active ? colors.iceBg : colors.panelAlt,
                    color: active ? colors.ice : colors.textMuted,
                    border: `1px solid ${active ? colors.iceDim : colors.borderSoft}`,
                  }}
                >
                  <span>{chip.label}</span>
                  <span
                    className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold"
                    style={{
                      background: active ? colors.ice : colors.border,
                      color: active ? colors.iceButtonText : colors.textMuted,
                    }}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Directory Personnel List */}
          <div className="flex flex-col gap-1.5 max-h-[520px] overflow-y-auto custom-scrollbar pt-1 pr-1">
            {(loading && !initialized) || (loading && unifiedRoster.length === 0) ? (
              <ListSkeleton rows={5}/>
            ) : filteredRoster.length === 0 ? (
              <div
                className="text-sm py-10 text-center rounded-lg flex flex-col items-center gap-2"
                style={{background: colors.panelAlt, border: `1px dashed ${colors.border}`, color: colors.textMuted}}
              >
                <span>
                  {search
                    ? `No personnel matching "${search}" in this location.`
                    : "No personnel records found for this filter."}
                </span>
                {(search || locationFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setLocationFilter("all");
                    }}
                    className="text-xs px-3 py-1 rounded font-medium cursor-pointer transition-opacity hover:opacity-85 mt-1"
                    style={{background: colors.iceBg, color: colors.ice, border: `1px solid ${colors.iceDim}`}}
                  >
                    Reset filters
                  </button>
                )}
              </div>
            ) : (
              filteredRoster.map((person) => {
                const isSelected = selectedPerson && (
                  (selectedPerson.personnel_id && selectedPerson.personnel_id === person.personnel_id) ||
                  (selectedPerson.name && selectedPerson.name === person.name)
                );
                const statusBadge = getPersonnelStatusBadge(person);

                return (
                  <div
                    key={person.personnel_id || person.id || person.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectPersonnel(person)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectPersonnel(person);
                      }
                    }}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg gap-2.5 sm:gap-4 cursor-pointer transition-all duration-150 outline-none hover:bg-white/[0.04]"
                    style={{
                      background: isSelected ? colors.panelAlt : colors.panel,
                      border: `1px solid ${isSelected ? colors.iceDim : colors.borderSoft}`,
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Initials Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-transform group-hover:scale-105"
                        style={{
                          background: person.isInTransit ? colors.amberBg : colors.iceBg,
                          color: person.isInTransit ? colors.amber : colors.ice,
                          border: `1px solid ${person.isInTransit ? colors.amberDim : colors.iceDim}`,
                        }}
                      >
                        {getInitials(person.name)}
                      </div>

                      {/* Name, Role, Current Station or Movement Route */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-semibold truncate group-hover:text-[var(--color-ice)] transition-colors"
                            style={{color: colors.text}}
                          >
                            {person.name}
                          </span>
                          {person.personnel_code && (
                            <span className="text-[11px] opacity-60" style={{...mono}}>
                              ({person.personnel_code})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs truncate mt-0.5"
                             style={{color: colors.textMuted}}>
                          <span className="truncate">{person.role || "Station Staff"}</span>
                          <span style={{color: colors.textFaint}}>•</span>
                          {person.isInTransit ? (
                            <span
                              className="inline-flex items-center gap-1 font-medium truncate"
                              style={{color: colors.amber, ...mono, fontSize: 11}}
                            >
                              <Navigation size={11} className="flex-shrink-0"/>
                              <span className="truncate">{person.activeMovement?.origin_station_name || "Origin"}</span>
                              <ArrowRight size={10} className="flex-shrink-0"/>
                              <span
                                className="truncate">{person.activeMovement?.destination_station_name || "Destination"}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin size={11} className="flex-shrink-0 opacity-70"/>
                              <span className="truncate">{person.current_station || "Unassigned"}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Chevron Affordance */}
                    <div
                      className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0 pl-12 sm:pl-0">
                      <Pill tone={statusBadge.tone}>{statusBadge.label}</Pill>
                      <ChevronRight
                        size={15}
                        className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all hidden sm:block"
                        style={{color: colors.textMuted}}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Panel>

      {/* 3. Movement History Section */}
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
              const person = totalPersonnel.find((item) => item.id === h.personnel_id || item.personnel_id === h.personnel_id);
              const displayName = h.full_name || h.personnel_name || (person ? (person.full_name || person.name) : h.name) || "—";
              const fromStation = h.origin_station_name || resolveStation(h.origin_station_id) || "—";
              const toStation = h.destination_station_name || resolveStation(h.destination_station_id) || "—";
              const departure = h.departure_time ? formatDisplayDateTime(h.departure_time) : (h.departure || "—");
              const arrival = h.arrival_time ? formatDisplayDateTime(h.arrival_time) : (h.arrival || "—");
              const status = h.movement_status || h.status || "completed";

              return (
                <div
                  key={h.id || `${displayName}-${i}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const match = unifiedRoster.find(
                      (u) => (h.personnel_id && (u.personnel_id === h.personnel_id || u.id === h.personnel_id)) ||
                        (displayName && u.name.toLowerCase() === displayName.toLowerCase())
                    );
                    if (match) setSelectedPerson(match);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const match = unifiedRoster.find(
                        (u) => (h.personnel_id && (u.personnel_id === h.personnel_id || u.id === h.personnel_id)) ||
                          (displayName && u.name.toLowerCase() === displayName.toLowerCase())
                      );
                      if (match) setSelectedPerson(match);
                    }
                  }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 text-sm pb-2.5 sm:pb-0 cursor-pointer hover:opacity-85 transition-opacity"
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

      {/* 4. Personnel Detail Drawer (Right side over page on desktop, bottom sheet on mobile) */}
      <PersonnelDrawer
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
        movementHistory={movementHistory}
      />

      {/* 5. Assign Personnel Modal */}
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
