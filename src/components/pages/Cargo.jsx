import { Plus, Truck, PackageCheck } from "lucide-react";
import { colors, mono } from "../../theme";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import SectionHeading from "../ui/SectionHeading";
import {mockCargo as initialCargo, mockVoyage} from "../../data/mockCargo.js";
import {useState} from "react";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";

const priorityOptions = ["Critical", "Standard"];
const emptyForm = { item: "", qty: "", weight: "", volume: "", source: "", dest: "", priority: "Standard" };

function cargoStatusTone(status) {
  if (status === "Delivered") return "aurora";
  if (status === "Requested") return "muted";
  return "ice";
}

const Cargo = () => {
  const [cargo, setCargo] = useState(initialCargo);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  function handleSubmit(e) {
    e.preventDefault();
    const newCargo = {
      id: `CG-${Math.floor(2000 + Math.random() * 900)}`,
      ...form,
      status: "Requested",
      voyage: null,
    };
    setCargo((list) => [newCargo, ...list]);
    setForm(emptyForm);
    setModalOpen(false);
  }

  function assignVoyage(id, voyageName) {
    setCargo((list) =>
      list.map((c) => (c.id === id ? { ...c, voyage: voyageName || null, status: voyageName ? "In transit" : "Requested" } : c))
    );
  }

  function markReceived(id) {
    setCargo((list) => list.map((c) => (c.id === id ? { ...c, status: "Delivered" } : c)));
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        right={
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded cursor-pointer"
            style={{ color: colors.iceButtonText, background: colors.ice }}
          >
            <Plus size={15} /> New cargo indent
          </button>
        }
      >
        Cargo & logistics
      </SectionHeading>

      <Panel title="Cargo requests">
        <table className="w-full text-sm border-collapse">
          <thead>
          <tr style={{ color: colors.textFaint }}>
            {["ID", "Item", "Qty", "Weight", "Volume", "Source → Destination", "Priority", "Voyage", "Status", ""].map((h) => (
              <th key={h} className="text-left font-medium pb-3 text-xs">{h}</th>
            ))}
          </tr>
          </thead>
          <tbody>
          {cargo.map((c) => (
            <tr key={c.id} style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
              <td className="py-3" style={{ color: colors.textFaint, ...mono, fontSize: 12 }}>{c.id}</td>
              <td className="py-3" style={{ color: colors.text }}>{c.item}</td>
              <td className="py-3" style={{ color: colors.textMuted, ...mono, fontSize: 13 }}>{c.qty}</td>
              <td className="py-3" style={{ color: colors.textMuted, ...mono, fontSize: 13 }}>{c.weight}</td>
              <td className="py-3" style={{ color: colors.textMuted, ...mono, fontSize: 13 }}>{c.volume}</td>
              <td className="py-3" style={{ color: colors.textMuted, fontSize: 13 }}>{c.source} → {c.dest}</td>
              <td className="py-3"><Pill tone={c.priority === "Critical" ? "flare" : "muted"}>{c.priority}</Pill></td>
              <td className="py-3">
                <select
                  value={c.voyage || ""}
                  onChange={(ev) => assignVoyage(c.id, ev.target.value)}
                  disabled={c.status === "Delivered"}
                  className="text-xs rounded px-2 py-1"
                  style={{ background: colors.bgRaised, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  <option value="">Unassigned</option>
                  {mockVoyage.map((v) => (
                    <option key={v.vessel} value={v.vessel}>{v.vessel}</option>
                  ))}
                </select>
              </td>
              <td className="py-3"><Pill tone={cargoStatusTone(c.status)}>{c.status}</Pill></td>
              <td className="py-3">
                {c.status === "In transit" && (
                  <button
                    onClick={() => markReceived(c.id)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                    style={{ color: colors.aurora, border: `1px solid ${colors.auroraDim}` }}
                  >
                    <PackageCheck size={12} /> Receive
                  </button>
                )}
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Ships & planes">
        <div className="flex flex-col gap-5">
          {mockVoyage.map((v) => {
            const assigned = cargo.filter((c) => c.voyage === v.vessel);
            return (
              <div key={v.vessel} className="flex flex-col gap-2.5" style={{ borderBottom: `1px solid ${colors.borderSoft}`, paddingBottom: 16 }}>
                <div className="flex items-center gap-4">
                  <Truck size={16} color={v.status === "Grounded" ? colors.flare : colors.ice} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: colors.text }}>{v.vessel}</span>
                      <span className="text-xs" style={{ color: colors.textFaint }}>{v.type}</span>
                    </div>
                    <span className="text-xs" style={{ color: colors.textMuted }}>
                      {v.route} · departs {v.departure} · {v.cargo} cargo
                    </span>
                  </div>
                  <Pill tone={v.status === "Grounded" ? "flare" : "ice"}>
                    {v.status === "Grounded" ? v.status : `ETA ${v.eta}`}
                  </Pill>
                </div>
                {assigned.length > 0 && (
                  <div className="ml-8 flex flex-wrap gap-2">
                    {assigned.map((c) => (
                      <span key={c.id} className="text-xs px-2 py-1 rounded" style={{ background: colors.panelAlt, color: colors.textMuted, border: `1px solid ${colors.border}` }}>
                        {c.item} → {c.dest}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {modalOpen && (
        <Modal title="New cargo indent" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Item" value={form.item} onChange={set("item")} required />
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Quantity" value={form.qty} onChange={set("qty")} placeholder="e.g. 20 boxes" required />
              <FormField label="Weight" value={form.weight} onChange={set("weight")} placeholder="e.g. 5 MT" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Volume" value={form.volume} onChange={set("volume")} placeholder="e.g. 10 m³" />
              <FormField label="Priority" as="select" options={priorityOptions} value={form.priority} onChange={set("priority")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Source" value={form.source} onChange={set("source")} required />
              <FormField label="Destination" value={form.dest} onChange={set("dest")} required />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded" style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}>
                Cancel
              </button>
              <button type="submit" className="text-sm font-medium px-4 py-2 rounded cursor-pointer" style={{ color: colors.iceButtonText, background: colors.ice }}>
                Create request
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Cargo;
