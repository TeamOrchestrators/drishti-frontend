import { colors, mono } from "../../theme";
import { Plus, History, UserCheck, Search } from "lucide-react";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import SectionHeading from "../ui/SectionHeading";
import { personnel, personnel_movements, getStationName } from "../../data/mockPersonnels.js";
import { useMemo, useState } from "react";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";

const statusOptions = ["in_transit", "waiting_for_weather", "planned", "arrived_safely"];

const emptyForm = {
  personnel_id: "", name: "", role: "", currentStation: "", from: "", to: "", departure: "", arrival: "", status: "in_transit",
};

function formatStatus(status) {
  if (status === "in_transit") return "In transit";
  if (status === "planned") return "Planned";
  if (status === "waiting_for_weather") return "Waiting for weather";
  if (status === "arrived_safely") return "Arrived safely";
  return status;
}

function statusTone(status) {
  if (status === "Waiting for weather" || status === "waiting_for_weather" || status === "planned") return "amber";
  if (status === "Arrived safely" || status === "arrived_safely" || status === "cleared") return "aurora";
  return "ice";
}

const Personnel = () => {
  const [movements, setMovements] = useState(personnel_movements);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const busyPersonIds = useMemo(() => {
    return new Set(
      movements
        .filter((m) => m.status === "in_transit" || m.status === "waiting_for_weather" || m.status === "planned")
        .map((m) => m.personnel_id || m.personnel_name || m.name)
    );
  }, [movements]);

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return personnel;
    return personnel.filter((p) => {
      const pName = p.full_name || p.name || "";
      const pRole = p.role || "";
      const pStation = getStationName(p.current_station_id) || p.currentStation || "";
      const pCode = p.personnel_code || p.id || "";
      return (
        pName.toLowerCase().includes(q) ||
        pRole.toLowerCase().includes(q) ||
        pStation.toLowerCase().includes(q) ||
        pCode.toLowerCase().includes(q)
      );
    });
  }, [search]);

  function handleNameSelect(name) {
    const person = personnel.find((p) => (p.full_name || p.name) === name);
    const stationName = person ? (getStationName(person.current_station_id) || person.currentStation) : "";
    setForm((f) => ({
      ...f,
      name,
      personnel_id: person ? person.id : "",
      role: person ? person.role : f.role,
      currentStation: stationName,
      from: stationName,
    }));
  }

  function openAssign(person) {
    const personName = person.full_name || person.name;
    const stationName = getStationName(person.current_station_id) || person.currentStation;
    setForm({
      personnel_id: person.id,
      name: personName,
      role: person.role,
      currentStation: stationName,
      from: stationName,
      to: "",
      departure: "",
      arrival: "",
      status: "in_transit",
    });
    setModalOpen(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const newMovement = {
      id: `MOV-${Math.floor(1000 + Math.random() * 9000)}`,
      personnel_id: form.personnel_id,
      name: form.name,
      personnel_name: form.name,
      role: form.role,
      currentStation: form.currentStation,
      from: form.from,
      to: form.to,
      departure: form.departure || "Today",
      arrival: form.arrival || "Pending",
      status: form.status,
    };
    setMovements((list) => [newMovement, ...list]);
    setForm(emptyForm);
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        right={
          <button
            onClick={() => { setForm(emptyForm); setModalOpen(true); }}
            className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded cursor-pointer"
            style={{ color: colors.iceButtonText, background: colors.ice }}
          >
            <Plus size={15} /> Assign personnel
          </button>
        }
      >
        Personnel movement
      </SectionHeading>

      <Panel title="Current movements">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
            <tr style={{ color: colors.textFaint }}>
              {["Personnel", "Role", "Current station", "From → To", "Departure", "Arrival", "Status"].map((h) => (
                <th key={h} className="text-left font-medium pb-3 text-xs whitespace-nowrap">{h}</th>
              ))}
            </tr>
            </thead>
            <tbody>
            {movements.map((p, i) => {
              const person = personnel.find((item) => item.id === p.personnel_id);
              const displayName = person ? (person.full_name || person.name) : (p.personnel_name || p.name);
              const displayRole = person ? person.role : p.role;
              const displayStation = person
                ? (getStationName(person.current_station_id) || person.currentStation)
                : (getStationName(p.origin_station_id) || p.from || "—");
              const fromStation = getStationName(p.origin_station_id) || p.from || "—";
              const toStation = getStationName(p.destination_station_id) || p.to || "—";
              const departureTime = p.departure || (p.departed_at ? new Date(p.departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—");
              const arrivalTime = p.arrival || (p.estimated_arrival_at ? new Date(p.estimated_arrival_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—");

              return (
                <tr key={p.id || (displayName + i)} style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
                  <td className="py-3.5 whitespace-nowrap" style={{ color: colors.text, fontWeight: 500 }}>{displayName}</td>
                  <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted }}>{displayRole}</td>
                  <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted }}>{displayStation}</td>
                  <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted, ...mono, fontSize: 13 }}>{fromStation} → {toStation}</td>
                  <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted, ...mono, fontSize: 12 }}>{departureTime}</td>
                  <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted, ...mono, fontSize: 12 }}>{arrivalTime}</td>
                  <td className="py-3.5 whitespace-nowrap"><Pill tone={statusTone(p.status)}>{formatStatus(p.status)}</Pill></td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title={`Total Personnel - ${personnel.length}`}
        action={
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded w-full sm:w-auto" style={{ background: colors.bgRaised, border: `1px solid ${colors.border}` }}>
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
          {filteredRoster.map((p) => {
            const personName = p.full_name || p.name;
            const busy = busyPersonIds.has(p.id) || busyPersonIds.has(personName);
            const stationName = getStationName(p.current_station_id) || p.currentStation;
            return (
              <div key={p.id} className="flex items-center justify-between py-2.5 gap-2" style={{ borderBottom: `1px solid ${colors.borderSoft}` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: colors.text }}>
                      {personName} <span className="text-xs font-normal opacity-70" style={{ ...mono }}>({p.personnel_code || p.id.slice(0, 5)})</span>
                    </div>
                    <div className="text-xs truncate" style={{ color: colors.textMuted }}>{p.role} · {stationName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <Pill tone={busy ? "amber" : "aurora"}>{busy ? "On a movement" : "Available"}</Pill>
                  {busy === false && (
                    <button
                      onClick={() => openAssign(p)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded cursor-pointer"
                      style={{ color: colors.ice, border: `1px solid ${colors.iceDim}` }}
                    >
                      <UserCheck size={12} /> <span className="hidden xs:inline sm:inline">Assign</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filteredRoster.length === 0 && (
            <div className="text-sm py-6 text-center" style={{ color: colors.textFaint }}>No one matches "{search}".</div>
          )}
        </div>
      </Panel>

      <Panel title="Movement history" action={<History size={15} color={colors.textFaint} />}>
        <div className="flex flex-col gap-3.5">
          {movements.map((h, i) => {
            const isCompleted = h.status === "arrived_safely" || h.status === "Arrived safely" || h.status === "completed";
            if (!isCompleted) return null;

            const person = personnel.find((item) => item.id === h.personnel_id);
            const displayName = person ? (person.full_name || person.name) : (h.personnel_name || h.name);
            const fromStation = getStationName(h.origin_station_id) || h.from || "—";
            const toStation = getStationName(h.destination_station_id) || h.to || "—";
            const departureTime = h.departure || (h.departed_at ? new Date(h.departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—");
            const arrivalTime = h.arrival || (h.estimated_arrival_at ? new Date(h.estimated_arrival_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—");

            return (
              <div key={h.id || (displayName + i)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 text-sm pb-2.5 sm:pb-0" style={{ borderBottom: `1px solid ${colors.borderSoft}` }}>
                <div>
                  <span style={{ color: colors.text }}>{displayName}</span>
                  <span style={{ color: colors.textFaint }}> · </span>
                  <span style={{ color: colors.textMuted }}>{fromStation} → {toStation}</span>
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-start">
                  <span style={{ color: colors.textFaint, ...mono, fontSize: 12 }}>{departureTime} → {arrivalTime}</span>
                  <Pill tone="muted">{formatStatus(h.status)}</Pill>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {modalOpen && (
        <Modal title="Assign personnel to a movement" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField
              label="Personnel"
              as="select"
              options={personnel.map((p) => p.full_name || p.name)}
              value={form.name}
              onChange={handleNameSelect}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Role" value={form.role} onChange={set("role")} />
              <FormField label="Current station" value={form.currentStation} onChange={set("currentStation")} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="From" value={form.from} onChange={set("from")} required />
              <FormField label="To" value={form.to} onChange={set("to")} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Departure date / time" value={form.departure} onChange={set("departure")} placeholder="e.g. 08:00 AM" />
              <FormField label="Arrival date / time" value={form.arrival} onChange={set("arrival")} placeholder="e.g. 03:30 PM" />
            </div>
            <FormField label="Movement status" as="select" options={statusOptions} value={form.status} onChange={set("status")} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded cursor-pointer" style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}>
                Cancel
              </button>
              <button type="submit" className="text-sm font-medium px-4 py-2 rounded cursor-pointer" style={{ color: colors.iceButtonText, background: colors.ice }}>
                Assign
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Personnel;
