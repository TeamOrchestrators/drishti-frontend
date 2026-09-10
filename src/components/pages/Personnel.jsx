import { colors, mono } from "../../theme";
import { Plus, History, UserCheck, Search } from "lucide-react";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import SectionHeading from "../ui/SectionHeading";
import {mockAllPersonnels, mockPersonnels} from "../../data/mockPersonnels.js";
import {useMemo, useState} from "react";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";

const statusOptions = ["On the way", "In the air", "Waiting for weather", "Arrived safely"];

const emptyForm = {
  name: "", role: "", currentStation: "", from: "", to: "", departure: "", arrival: "", status: "On the way",
};

function statusTone(status) {
  if (status === "Waiting for weather") return "amber";
  if (status === "Arrived safely") return "aurora";
  return "ice";
}

const Personnel = () => {
  const [personnel, setPersonnel] = useState(mockPersonnels);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const busyNames = useMemo(() => new Set(personnel.map((p) => p.name)), [personnel]);

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mockAllPersonnels;
    return mockAllPersonnels.filter(
      (p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.currentStation.toLowerCase().includes(q)
    );
  }, [search]);

  function handleNameSelect(name) {
    const person = mockAllPersonnels.find((p) => p.name === name);
    setForm((f) => ({
      ...f,
      name,
      role: person ? person.role : f.role,
      currentStation: person ? person.currentStation : f.currentStation,
    }));
  }

  function openAssign(person) {
    setForm({
      name: person.name, role: person.role, currentStation: person.currentStation,
      from: person.currentStation, to: "", departure: "", arrival: "", status: "On the way",
    });
    setModalOpen(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setPersonnel((list) => [{ ...form }, ...list]);
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
            {personnel.map((p, i) => (
              <tr key={p.name + i} style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
                <td className="py-3.5 whitespace-nowrap" style={{ color: colors.text, fontWeight: 500 }}>{p.name}</td>
                <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted }}>{p.role}</td>
                <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted }}>{p.currentStation}</td>
                <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted, ...mono, fontSize: 13 }}>{p.from} → {p.to}</td>
                <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted, ...mono, fontSize: 12 }}>{p.departure}</td>
                <td className="py-3.5 whitespace-nowrap" style={{ color: colors.textMuted, ...mono, fontSize: 12 }}>{p.arrival}</td>
                <td className="py-3.5 whitespace-nowrap"><Pill tone={statusTone(p.status)}>{p.status}</Pill></td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title={`Total Personnels - ${mockAllPersonnels.length}`}
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
            const busy = busyNames.has(p.name);
            return (
              <div key={p.id} className="flex items-center justify-between py-2.5 gap-2" style={{ borderBottom: `1px solid ${colors.borderSoft}` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: colors.text }}>{p.name}</div>
                    <div className="text-xs truncate" style={{ color: colors.textMuted }}>{p.role} · {p.currentStation}</div>
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
          {mockPersonnels.map((h, i) =>
            h.status === "Arrived safely" && (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 text-sm pb-2.5 sm:pb-0" style={{ borderBottom: `1px solid ${colors.borderSoft}` }}>
                <div>
                  <span style={{ color: colors.text }}>{h.name}</span>
                  <span style={{ color: colors.textFaint }}> · </span>
                  <span style={{ color: colors.textMuted }}>{h.from} → {h.to}</span>
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-start">
                  <span style={{ color: colors.textFaint, ...mono, fontSize: 12 }}>{h.departure} → {h.arrival}</span>
                  <Pill tone="muted">{h.status}</Pill>
                </div>
              </div>
            )
          )}
        </div>
      </Panel>

      {modalOpen && (
        <Modal title="Assign personnel to a movement" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField
              label="Personnel"
              as="select"
              options={mockAllPersonnels.map((p) => p.name)}
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
              <FormField label="Departure date" type="date" value={form.departure} onChange={set("departure")} />
              <FormField label="Arrival date" type="date" value={form.arrival} onChange={set("arrival")} />
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
}


export default Personnel;
