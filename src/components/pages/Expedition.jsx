import { Plus, MapPin, Pencil, Calendar } from "lucide-react";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import Bar from "../ui/Bar";
import SectionHeading from "../ui/SectionHeading";
import mockExpeditions from "../../data/mockExpeditions.js";
import {useState} from "react";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";
import {colors, mono} from "../../theme.js";

const statusOptions = ["Getting ready", "On the way", "Taking shelter", "Waiting for flight", "Completed"];
const statusTone = {
    "On the way": "ice",
    "Getting ready": "amber",
    "Taking shelter": "flare",
    "Waiting for flight": "muted",
    "Completed": "aurora",
};

const emptyForm = {
    name: "", purpose: "", route: "", startDate: "", endDate: "",
    lead: "", crew: "", status: "Getting ready", resources: "",
};


const Expedition = () => {
  const [expeditions, setExpeditions] = useState(mockExpeditions);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const set = (key) => (value) => {
    setForm((f) => ({
      ...f, [key]: value
    }))
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(exp) {
    setEditingId(exp.id);
    setForm({
      name: exp.name, purpose: exp.purpose || "", route: exp.route,
      startDate: exp.startDate || "", endDate: exp.endDate || "",
      lead: exp.lead, crew: exp.crew, status: exp.status,
      resources: (exp.resources || []).join(", "),
    });
    setModalOpen(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const resources = form.resources.split(",").map((r) => r.trim()).filter(Boolean);
    const tone = statusTone[form.status] || "ice";

    if (editingId) {
      setExpeditions((list) =>
        list.map((exp) => (exp.id === editingId ? { ...exp, ...form, resources, tone } : exp))
      );
    } else {
      const newExp = {
        id: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
        ...form,
        crew: Number(form.crew) || 0,
        resources,
        readiness: 10,
        fuel: 0,
        rations: 0,
        day: "Day 1",
        tone,
      };
      setExpeditions((list) => [newExp, ...list]);
    }
    setModalOpen(false);
  }


  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        right={
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded"
            style={{ color: "#081014", background: colors.ice }}
          >
            <Plus size={15} /> New expedition
          </button>
        }
      >
        Expedition planning
      </SectionHeading>

      <div className="flex flex-col gap-4">
        {expeditions.map((e) => (
          <Panel key={e.id} style={{ padding: 0 }}>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-semibold" style={{ color: colors.text }}>{e.name}</span>
                    <span className="text-xs" style={{ color: colors.textFaint, ...mono }}>{e.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: colors.textMuted }}>
                    <MapPin size={13} /> {e.route}
                  </div>
                  {e.purpose && (
                    <div className="text-sm mt-1.5" style={{ color: colors.textMuted }}>{e.purpose}</div>
                  )}
                  {(e.startDate || e.endDate) && (
                    <div className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: colors.textFaint, ...mono }}>
                      <Calendar size={12} /> {e.startDate} → {e.endDate}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={e.tone}>{e.status}</Pill>
                  <button
                    onClick={() => openEdit(e)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded"
                    style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                </div>
              </div>

              {e.note && (
                <div className="text-xs px-3 py-2 rounded" style={{ background: colors.flareBg, color: colors.flare, border: `1px solid ${colors.flareDim}` }}>
                  {e.note}
                </div>
              )}

              {e.resources && e.resources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {e.resources.map((r) => (
                    <span key={r} className="text-xs px-2 py-1 rounded" style={{ background: colors.panelAlt, color: colors.textMuted, border: `1px solid ${colors.border}` }}>
                      {r}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-4 gap-6 pt-3" style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
                <div>
                  <div className="text-xs mb-1" style={{ color: colors.textFaint }}>Team lead</div>
                  <div className="text-sm" style={{ color: colors.text }}>{e.lead}</div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: colors.textFaint }}>Crew assigned</div>
                  <div className="text-sm" style={{ color: colors.text, ...mono }}>{e.crew}</div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: colors.textFaint }}>Timeline</div>
                  <div className="text-sm" style={{ color: colors.text, ...mono }}>{e.day}</div>
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {modalOpen && (
        <Modal title={editingId ? "Edit expedition" : "Create expedition"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Expedition name" value={form.name} onChange={set("name")} required />
            <FormField label="Purpose" as="textarea" value={form.purpose} onChange={set("purpose")} />
            <FormField label="Destination / stations" value={form.route} onChange={set("route")} placeholder="e.g. McMurdo → Vostok Station" required />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start date" type="date" value={form.startDate} onChange={set("startDate")} />
              <FormField label="End date" type="date" value={form.endDate} onChange={set("endDate")} />
            </div>
            <FormField label="Team lead / personnel assigned" value={form.lead} onChange={set("lead")} required />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Crew size" type="number" value={form.crew} onChange={set("crew")} />
              <FormField label="Status" as="select" options={statusOptions} value={form.status} onChange={set("status")} />
            </div>
            <FormField label="Required resources (comma separated)" value={form.resources} onChange={set("resources")} placeholder="e.g. Snowcat, Fuel drums, Radio" />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded" style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}>
                Cancel
              </button>
              <button type="submit" className="text-sm font-medium px-4 py-2 rounded" style={{ color: "#081014", background: colors.ice }}>
                {editingId ? "Save changes" : "Create expedition"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>

  );
};

export default Expedition;
