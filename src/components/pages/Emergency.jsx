import {TriangleAlert, MapPin, CheckCircle2} from "lucide-react";
import { colors, mono } from "../../theme";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import SectionHeading from "../ui/SectionHeading";
import {mockEmergencies} from "../../data/mockEmergencies.js";
import {useState} from "react";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";

const severityOptions = ["Need Immediate Response", "Extremely Critical", "Critical (Not Extreme)"];

const emptyForm = {
  type: "", location: "", severity: "Need Immediate Response", affected: "", resources: "",
};


const Emergency = () => {
  const [emergencies, setEmergencies] = useState(mockEmergencies);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  function handleSubmit(e) {
    e.preventDefault();
    const newEmergency = {
      id: `EMG-${Math.floor(100 + Math.random() * 900)}`,
      ...form,
      affected: Number(form.affected) || 0,
      when: new Date().toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }),
      status: "Active",
    };
    setEmergencies((list) => [newEmergency, ...list]);
    setForm(emptyForm);
    setModalOpen(false);
  }

  function resolve(id) {
    setEmergencies((list) => list.map((e) => (e.id === id ? { ...e, status: "Resolved" } : e)));
  }


  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        right={
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded cursor-pointer"
            style={{ color: "#fff", background: colors.flare }}
          >
            <TriangleAlert size={15} /> Report emergency
          </button>
        }
      >
        Emergencies
      </SectionHeading>

      <div className="flex flex-col gap-4">
        {emergencies.map((e) => (
          <Panel key={e.id} style={{ padding: 0 }}>
            <div className="p-4 sm:p-5 flex flex-col gap-4" style={e.status === "Active" ? { background: colors.flareBg } : {}}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-base font-semibold" style={{ color: colors.text }}>{e.type}</span>
                    <span className="text-xs" style={{ color: colors.textFaint, ...mono }}>{e.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: colors.textMuted }}>
                    <MapPin size={13} className="flex-shrink-0" /> {e.location}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
                  <Pill tone={e.status === "Active" ? "flare" : "aurora"}>{e.status}</Pill>
                  {e.status === "Active" && (
                    <button
                      onClick={() => resolve(e.id)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded cursor-pointer"
                      style={{ color: colors.aurora, border: `1px solid ${colors.auroraDim}` }}
                    >
                      <CheckCircle2 size={12} /> Mark resolved
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3" style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
                <div>
                  <div className="text-xs mb-1" style={{ color: colors.textFaint }}>Severity</div>
                  <div className="text-sm" style={{ color: e.severity?.includes("Immediate") || e.severity?.includes("Extremely") ? colors.flare : colors.amber }}>
                    {e.severity}
                  </div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: colors.textFaint }}>Reported</div>
                  <div className="text-sm" style={{ color: colors.text }}>{e.when}</div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: colors.textFaint }}>People affected</div>
                  <div className="text-sm" style={{ color: colors.text, ...mono }}>{e.affected}</div>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: colors.textFaint }}>Resources needed</div>
                  <div className="text-sm" style={{ color: colors.text }}>{e.resources}</div>
                </div>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {modalOpen && (
        <Modal title="Report emergency" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Emergency type" value={form.type} onChange={set("type")} placeholder="e.g. Vehicle breakdown, medical injury" required />
            <FormField label="Location / station" value={form.location} onChange={set("location")} required />
            <FormField label="Severity" as="select" options={severityOptions} value={form.severity} onChange={set("severity")} />
            <FormField label="People affected" type="number" value={form.affected} onChange={set("affected")} />
            <FormField label="Resources required" as="textarea" value={form.resources} onChange={set("resources")} placeholder="e.g. Medical kit, extra vehicle" />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded cursor-pointer" style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}>
                Cancel
              </button>
              <button type="submit" className="text-sm font-medium px-4 py-2 rounded cursor-pointer" style={{ color: "#fff", background: colors.flare }}>
                Submit report
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>

  );
};

export default Emergency;
