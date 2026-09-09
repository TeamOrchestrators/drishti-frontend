import { useState } from "react";
import { Plus, Minus, TriangleAlert, History } from "lucide-react";
import { colors, mono } from "../../theme";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import Bar from "../ui/Bar";
import SectionHeading from "../ui/SectionHeading";
import Modal from "../ui/Modal";
import FormField from "../ui/Formfield";
import { mockInventory as initialInventory, inventoryHistory as initialHistory } from "../../data/mockInventory";

function toneFor(criticality) {
  if (criticality === "Critical") return "flare";
  if (criticality === "Low stock") return "amber";
  return "aurora";
}

const emptyForm = { direction: "add", amount: "", reason: "" };

export default function InventoryView() {
  const [inventory, setInventory] = useState(initialInventory);
  const [history, setHistory] = useState(initialHistory);
  const [activeItem, setActiveItem] = useState(null); // the item currently being adjusted
  const [form, setForm] = useState(emptyForm);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // Items below their minimum required quantity need a resupply.
  const lowStockAlerts = inventory.filter((i) => i.current < i.min && i.criticality !== "Critical");
  // Items that are both below minimum AND flagged critical need it urgently.
  const criticalStockAlerts = inventory.filter((i) => i.current < i.min && i.criticality === "Critical");

  function openAdjust(item, direction) {
    setActiveItem(item);
    setForm({ direction, amount: "", reason: "" });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const amount = Number(form.amount) || 0;
    const delta = form.direction === "add" ? amount : -amount;

    setInventory((list) =>
      list.map((i) =>
        i.id === activeItem.id ? { ...i, current: Math.max(0, i.current + delta) } : i
      )
    );

    setHistory((list) => [
      {
        item: activeItem.item,
        station: activeItem.station,
        change: delta,
        reason: form.reason || (form.direction === "add" ? "Stock added" : "Stock consumed"),
        when: new Date().toISOString().slice(0, 10),
      },
      ...list,
    ]);

    setActiveItem(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading>Station inventory</SectionHeading>

      {(lowStockAlerts.length > 0 || criticalStockAlerts.length > 0) && (
        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-lg p-4" style={{ background: colors.flareBg, border: `1px solid ${colors.flareDim}` }}>
            <div className="flex items-center gap-2 mb-2">
              <TriangleAlert size={14} color={colors.flare} />
              <span className="text-sm font-semibold" style={{ color: colors.flare }}>
                Critical-stock alerts ({criticalStockAlerts.length})
              </span>
            </div>
            {criticalStockAlerts.length === 0 ? (
              <span className="text-xs" style={{ color: colors.textFaint }}>Nothing critical right now.</span>
            ) : (
              criticalStockAlerts.map((i) => (
                <div key={i.id} className="text-xs flex justify-between py-0.5" style={{ color: colors.textMuted }}>
                  <span>{i.item} — {i.station}</span>
                  <span style={{ ...mono }}>{i.current} / {i.min} {i.unit}</span>
                </div>
              ))
            )}
          </div>
          <div className="rounded-lg p-4" style={{ background: colors.amberBg, border: `1px solid ${colors.amberDim}` }}>
            <div className="flex items-center gap-2 mb-2">
              <TriangleAlert size={14} color={colors.amber} />
              <span className="text-sm font-semibold" style={{ color: colors.amber }}>
                Low-stock alerts ({lowStockAlerts.length})
              </span>
            </div>
            {lowStockAlerts.length === 0 ? (
              <span className="text-xs" style={{ color: colors.textFaint }}>Everything else is above the minimum.</span>
            ) : (
              lowStockAlerts.map((i) => (
                <div key={i.id} className="text-xs flex justify-between py-0.5" style={{ color: colors.textMuted }}>
                  <span>{i.item} — {i.station}</span>
                  <span style={{ ...mono }}>{i.current} / {i.min} {i.unit}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {inventory.map((i) => {
          const pct = Math.min(100, (i.current / i.max) * 100);
          const tone = toneFor(i.criticality);
          return (
            <Panel key={i.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-medium" style={{ color: colors.text }}>{i.item}</div>
                  <div className="text-xs" style={{ color: colors.textFaint }}>{i.station}</div>
                </div>
                <Pill tone={tone}>{i.criticality}</Pill>
              </div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-lg font-semibold" style={{ color: colors.text, ...mono }}>{i.current}</span>
                <span className="text-xs" style={{ color: colors.textFaint }}>min {i.min} · max {i.max} {i.unit}</span>
              </div>
              <Bar value={pct} tone={tone} height={8} />
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => openAdjust(i, "add")}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded"
                  style={{ color: colors.aurora, border: `1px solid ${colors.auroraDim}` }}
                >
                  <Plus size={12} /> Add stock
                </button>
                <button
                  onClick={() => openAdjust(i, "remove")}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded"
                  style={{ color: colors.flare, border: `1px solid ${colors.flareDim}` }}
                >
                  <Minus size={12} /> Remove stock
                </button>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel title="Inventory history" action={<History size={15} color={colors.textFaint} />}>
        <div className="flex flex-col gap-3">
          {history.map((h, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <div>
                <span style={{ color: colors.text }}>{h.item}</span>
                <span style={{ color: colors.textFaint }}> · </span>
                <span style={{ color: colors.textMuted }}>{h.station}</span>
                <span style={{ color: colors.textFaint }}> — {h.reason}</span>
              </div>
              <div className="flex items-center gap-3">
                <span style={{ color: colors.textFaint, ...mono, fontSize: 12 }}>{h.when}</span>
                <span
                  className="text-xs font-medium"
                  style={{ color: h.change >= 0 ? colors.aurora : colors.flare, ...mono }}
                >
                  {h.change >= 0 ? `+${h.change}` : h.change}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {activeItem && (
        <Modal
          title={`${form.direction === "add" ? "Add" : "Remove"} stock — ${activeItem.item}`}
          onClose={() => setActiveItem(null)}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="text-xs" style={{ color: colors.textFaint }}>
              Current quantity: <span style={{ color: colors.text, ...mono }}>{activeItem.current} {activeItem.unit}</span> at {activeItem.station}
            </div>
            <FormField
              label={`Amount to ${form.direction === "add" ? "add" : "remove"}`}
              type="number"
              value={form.amount}
              onChange={set("amount")}
              required
            />
            <FormField
              label="Reason"
              value={form.reason}
              onChange={set("reason")}
              placeholder={form.direction === "add" ? "e.g. Resupply delivery received" : "e.g. Used for expedition EXP-8821"}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setActiveItem(null)} className="text-sm px-4 py-2 rounded" style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}>
                Cancel
              </button>
              <button
                type="submit"
                className="text-sm font-medium px-4 py-2 rounded cursor-pointer"
                style={{ color: "#fff", background: form.direction === "add" ? colors.aurora : colors.flare }}
              >
                Confirm {form.direction === "add" ? "addition" : "removal"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}