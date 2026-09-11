import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Minus,
  History,
  AlertCircle,
  CheckCircle2,
  Package,
  RefreshCw,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { colors, mono } from "../../theme";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import Bar from "../ui/Bar";
import SectionHeading from "../ui/SectionHeading";
import Modal from "../ui/Modal";
import FormField from "../ui/Formfield";
import InventoryAlerts from "../inventory/InventoryAlerts";
import InventoryAnalyticsSummary from "../inventory/InventoryAnalyticsSummary";
import InventoryAnomalyNotice from "../inventory/InventoryAnomalyNotice";
import { inventoryApi } from "../../services/api";
import { useInventoryStore } from "../../store/useInventoryStore";

const emptyItemForm = {
  item_code: "",
  name: "",
  category: "Medical",
  unit: "tanks",
  is_critical: false,
  opening_quantity: "",
  minimum_quantity: "",
  maximum_quantity: "",
  notes: "",
};

const emptyStockForm = {
  operation: "add",
  quantity: "",
  notes: "",
};

// Map backend stock_level to theme status tone
function getToneFromStockLevel(stockLevel) {
  const level = (stockLevel || "").toLowerCase();
  if (level === "critical") return "flare";
  if (level === "low") return "amber";
  return "aurora";
}

function formatStockLevelLabel(stockLevel) {
  const level = (stockLevel || "").toLowerCase();
  if (level === "critical") return "Critical";
  if (level === "low") return "Low stock";
  return "Normal";
}

function formatTransactionType(type) {
  if (!type) return "Adjustment";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return `${d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}, ${d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return ts;
  }
}

export default function InventoryView() {
  const {
    bhartiStationId,
    items,
    history,
    alerts,
    analyticsAvailable,
    loading,
    error,
    resolveBhartiStationId,
    fetchInventory,
    setItems,
    setHistory,
  } = useInventoryStore();

  // Modal states
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [itemFormError, setItemFormError] = useState(null);
  const [itemSubmitting, setItemSubmitting] = useState(false);

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [stockFormError, setStockFormError] = useState(null);
  const [stockSubmitting, setStockSubmitting] = useState(false);

  // Success toast state
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    (async () => {
      const id = await resolveBhartiStationId();
      if (isSubscribed && id) {
        await fetchInventory(id);
      }
    })();
    return () => {
      isSubscribed = false;
    };
  }, [resolveBhartiStationId, fetchInventory]);

  // 3. Add Item modal handler: POST /api/inventory/items?station_id={bhartiStationId}
  function openAddItemModal() {
    setItemFormError(null);
    setItemForm({
      ...emptyItemForm,
      item_code: `MED-${Math.floor(100 + Math.random() * 900)}`,
    });
    setAddItemModalOpen(true);
  }

  async function handleAddItemSubmit(e) {
    e.preventDefault();
    setItemFormError(null);

    if (!itemForm.item_code.trim()) {
      setItemFormError("Please enter an item code.");
      return;
    }
    if (!itemForm.name.trim()) {
      setItemFormError("Please enter an item name.");
      return;
    }
    if (!itemForm.category.trim()) {
      setItemFormError("Please enter a category.");
      return;
    }
    if (!itemForm.unit.trim()) {
      setItemFormError("Please enter a measurement unit.");
      return;
    }

    const openingQty = Number(itemForm.opening_quantity);
    const minQty = Number(itemForm.minimum_quantity);
    const maxQty =
      itemForm.maximum_quantity !== "" && itemForm.maximum_quantity != null
        ? Number(itemForm.maximum_quantity)
        : null;

    if (isNaN(openingQty) || openingQty < 0) {
      setItemFormError("Opening quantity must be a non-negative number.");
      return;
    }
    if (isNaN(minQty) || minQty < 0) {
      setItemFormError("Minimum quantity must be a non-negative number.");
      return;
    }
    if (maxQty !== null && maxQty < minQty) {
      setItemFormError("Maximum quantity cannot be less than minimum quantity.");
      return;
    }

    setItemSubmitting(true);

    const payload = {
      item_code: itemForm.item_code.trim(),
      name: itemForm.name.trim(),
      category: itemForm.category.trim(),
      unit: itemForm.unit.trim(),
      is_critical: Boolean(itemForm.is_critical),
      opening_quantity: openingQty,
      minimum_quantity: minQty,
      maximum_quantity: maxQty,
      notes: itemForm.notes ? itemForm.notes.trim() : "Initial Bharti stock",
    };

    try {
      await inventoryApi.addItem(bhartiStationId, payload);
      setAddItemModalOpen(false);
      setItemForm(emptyItemForm);
      showToast(`Item "${payload.name}" added successfully.`);
      await fetchInventory();
    } catch (err) {
      console.error("Add item error:", err);
      setItemFormError(err.message || "Failed to add inventory item.");

      // Graceful local fallback simulation if endpoint returns 501 / 404
      if (
        err.message.includes("501") ||
        err.message.includes("404") ||
        err.message.includes("Failed to fetch")
      ) {
        const stockLevel =
          openingQty <= minQty / 2
            ? "critical"
            : openingQty <= minQty
            ? "low"
            : "normal";

        const newItem = {
          inventory_id: `inv-${Date.now()}`,
          item_id: `item-${Date.now()}`,
          item_code: payload.item_code,
          name: payload.name,
          category: payload.category,
          unit: payload.unit,
          is_critical: payload.is_critical,
          on_hand_quantity: openingQty,
          reserved_quantity: 0,
          available_quantity: openingQty,
          minimum_quantity: minQty,
          maximum_quantity: maxQty,
          stock_level: stockLevel,
        };

        const newTx = {
          id: `tx-${Date.now()}`,
          item_name: payload.name,
          unit: payload.unit,
          transaction_type: "initial_stock",
          on_hand_delta: openingQty,
          reserved_delta: 0,
          occurred_at: new Date().toISOString(),
          notes: payload.notes || "Initial Bharti stock",
        };

        setItems((prev) => [newItem, ...prev]);
        setHistory((prev) => [newTx, ...prev]);
        setAddItemModalOpen(false);
        setItemForm(emptyItemForm);
        showToast(`Item "${payload.name}" added to Bharti inventory.`);
      }
    } finally {
      setItemSubmitting(false);
    }
  }

  // Stock Adjustment (Add / Remove stock)
  function openAdjust(item, operation) {
    setActiveItem(item);
    setStockForm({
      operation,
      quantity: "",
      notes: "",
    });
    setStockFormError(null);
    setAdjustModalOpen(true);
  }

  async function handleStockSubmit(e) {
    e.preventDefault();
    setStockFormError(null);

    const qty = Number(stockForm.quantity);
    if (!qty || qty <= 0) {
      setStockFormError("Please enter a valid quantity greater than 0.");
      return;
    }

    if (
      stockForm.operation === "remove" &&
      qty > (activeItem.available_quantity ?? activeItem.on_hand_quantity)
    ) {
      setStockFormError(
        `Cannot remove ${qty} ${activeItem.unit}. Available quantity is only ${
          activeItem.available_quantity ?? activeItem.on_hand_quantity
        } ${activeItem.unit}.`
      );
      return;
    }

    setStockSubmitting(true);

    const payload = {
      operation: stockForm.operation,
      quantity: qty,
      notes: stockForm.notes ? stockForm.notes.trim() : undefined,
    };

    try {
      await inventoryApi.adjustStock(bhartiStationId, activeItem.inventory_id, payload);
      setAdjustModalOpen(false);
      showToast(
        stockForm.operation === "add"
          ? `Successfully added ${qty} ${activeItem.unit} to ${activeItem.name}.`
          : `Successfully issued ${qty} ${activeItem.unit} from ${activeItem.name}.`
      );
      await fetchInventory();
    } catch (err) {
      console.error("Adjust stock error:", err);
      // Keep backend error visible
      setStockFormError(err.message || "Failed to update stock.");

      // Graceful local update if backend stock route returns 501 / 404
      if (
        err.message.includes("404") ||
        err.message.includes("501") ||
        err.message.includes("Failed to fetch")
      ) {
        const delta = stockForm.operation === "add" ? qty : -qty;
        setItems((list) =>
          list.map((it) => {
            if (it.inventory_id === activeItem.inventory_id) {
              const newOnHand = Math.max(0, it.on_hand_quantity + delta);
              const newAvail = Math.max(0, it.available_quantity + delta);
              const newLevel =
                newAvail <= it.minimum_quantity / 2
                  ? "critical"
                  : newAvail <= it.minimum_quantity
                  ? "low"
                  : "normal";
              return {
                ...it,
                on_hand_quantity: newOnHand,
                available_quantity: newAvail,
                stock_level: newLevel,
              };
            }
            return it;
          })
        );
        setHistory((hist) => [
          {
            id: `tx-${Date.now()}`,
            item_name: activeItem.name,
            unit: activeItem.unit,
            transaction_type: stockForm.operation === "add" ? "resupply" : "consumption",
            on_hand_delta: delta,
            reserved_delta: 0,
            occurred_at: new Date().toISOString(),
            notes:
              stockForm.notes ||
              (stockForm.operation === "add" ? "Resupply received" : "Stock issued"),
          },
          ...hist,
        ]);
        setAdjustModalOpen(false);
        showToast(
          stockForm.operation === "add"
            ? `Added ${qty} ${activeItem.unit} to ${activeItem.name}.`
            : `Issued ${qty} ${activeItem.unit} from ${activeItem.name}.`
        );
      }
    } finally {
      setStockSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm transition-all animate-in fade-in slide-in-from-top-4"
          style={{
            background: colors.bgRaised,
            color: colors.aurora,
            border: `1px solid ${colors.auroraDim}`,
          }}
        >
          <CheckCircle2 size={16} className="flex-shrink-0" />
          <span style={{ color: colors.text }}>{toastMessage}</span>
        </div>
      )}

      {/* Header: Bharti Station Inventory with + Add item button */}
      <SectionHeading
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInventory()}
              disabled={loading}
              title="Refresh inventory"
              className="p-2 rounded cursor-pointer transition-opacity hover:opacity-80"
              style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={openAddItemModal}
              className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded cursor-pointer transition-opacity hover:opacity-90"
              style={{ color: colors.iceButtonText, background: colors.ice }}
            >
              <Plus size={15} /> Add item
            </button>
          </div>
        }
      >
        Bharti Station Inventory
      </SectionHeading>

      {/* Error alert banner */}
      {!loading && error && (
        <div
          className="flex items-center justify-between p-3.5 rounded-lg text-sm"
          style={{
            background: colors.flareBg,
            color: colors.flare,
            border: `1px solid ${colors.flareDim}`,
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchInventory()}
            className="text-xs px-2.5 py-1 rounded cursor-pointer font-medium"
            style={{
              background: colors.bgRaised,
              color: colors.text,
              border: `1px solid ${colors.border}`,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* AI Inventory Alerts */}
      {/*<InventoryAlerts alerts={alerts} analyticsAvailable={analyticsAvailable} />*/}

      {/* Main Inventory Items Section */}
      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-lg p-5 animate-pulse"
              style={{ background: colors.bgRaised, border: `1px solid ${colors.border}` }}
            >
              <div className="h-5 w-40 rounded mb-3" style={{ background: colors.panelAlt }} />
              <div className="h-8 w-24 rounded mb-2" style={{ background: colors.panelAlt }} />
              <div className="h-2 w-full rounded mt-4" style={{ background: colors.panelAlt }} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty State: "No inventory items at Bharti yet. Add the first item to start tracking station stock." */
        <div
          className="py-14 px-6 text-center rounded-xl flex flex-col items-center justify-center gap-3"
          style={{
            background: colors.bgRaised,
            border: `1px dashed ${colors.borderSoft}`,
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: colors.panelAlt, color: colors.textMuted }}
          >
            <Package size={22} />
          </div>
          <div className="max-w-md">
            <p className="text-sm font-semibold" style={{ color: colors.text }}>
              No inventory items at Bharti yet. Add the first item to start tracking station stock.
            </p>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              Manage station supplies, minimum thresholds, and consumption history specifically for Bharti Station.
            </p>
          </div>
          <button
            onClick={openAddItemModal}
            className="mt-2 flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded cursor-pointer transition-opacity hover:opacity-90"
            style={{ color: colors.iceButtonText, background: colors.ice }}
          >
            <Plus size={15} /> Add item
          </button>
        </div>
      ) : (
        /* Inventory Item Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {items.map((i) => {
            const tone = getToneFromStockLevel(i.stock_level);
            const statusLabel = formatStockLevelLabel(i.stock_level);

            // Progress percentage calculation based on available_quantity
            let pct = 100;
            if (i.maximum_quantity != null && i.maximum_quantity > 0) {
              pct = Math.min(100, Math.max(0, (i.available_quantity / i.maximum_quantity) * 100));
            } else if (i.minimum_quantity > 0) {
              pct = Math.min(100, Math.max(0, (i.available_quantity / (i.minimum_quantity * 1.5)) * 100));
            }

            return (
              <Panel key={i.inventory_id || i.item_id || i.item_code}>
                {/* Header: Item Name, Code, Category · Unit, Status Pill */}
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                        {i.name}
                      </span>
                      {i.item_code && (
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                          style={{
                            background: colors.panelAlt,
                            color: colors.textFaint,
                            ...mono,
                          }}
                        >
                          {i.item_code}
                        </span>
                      )}
                      {i.is_critical && (
                        <span
                          title="Critical item"
                          className="flex items-center"
                          style={{ color: colors.flare }}
                        >
                          <ShieldAlert size={13} />
                        </span>
                      )}
                    </div>
                    {/* Under item name show category · unit */}
                    <div className="text-xs truncate mt-0.5" style={{ color: colors.textMuted }}>
                      {i.category || "General"} · {i.unit || "units"}
                    </div>
                  </div>
                  <Pill tone={tone}>{statusLabel}</Pill>
                </div>

                {/* Available Quantity Highlight and On-hand Breakdown */}
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold" style={{ color: colors.text, ...mono }}>
                      {i.available_quantity}
                    </span>
                    <span className="text-xs font-medium" style={{ color: colors.textMuted }}>
                      {i.unit} available
                    </span>
                  </div>
                  <div className="text-xs text-right" style={{ color: colors.textFaint }}>
                    <span>{i.on_hand_quantity} on-hand</span>
                    {i.reserved_quantity > 0 && (
                      <span className="ml-1" style={{ color: colors.amber }}>
                        ({i.reserved_quantity} reserved)
                      </span>
                    )}
                  </div>
                </div>

                {/* Visual Stock Bar */}
                <Bar value={pct} tone={tone} height={8} />

                {/* Thresholds line: min and optional max */}
                <div
                  className="flex items-center justify-between text-xs mt-1.5"
                  style={{ color: colors.textFaint }}
                >
                  <span>
                    min {i.minimum_quantity}
                    {i.maximum_quantity != null ? ` · max ${i.maximum_quantity}` : ""}{" "}
                    {i.unit}
                  </span>
                  <span style={{ color: colors.textMuted }}>
                    {pct.toFixed(0)}% capacity
                  </span>
                </div>

                {/* AI Predictive Analytics & Anomaly Notice */}
                {analyticsAvailable && i.analytics && (
                  <div className="mt-3 flex flex-col gap-2">
                    <InventoryAnalyticsSummary
                      analytics={i.analytics}
                      unit={i.unit}
                    />
                    <InventoryAnomalyNotice
                      anomalyDetected={i.analytics.anomaly_detected}
                      anomalyMessage={i.analytics.anomaly_message}
                    />
                  </div>
                )}

                {/* Action buttons on card */}
                <div
                  className="flex items-center gap-2 mt-4 pt-3"
                  style={{ borderTop: `1px solid ${colors.borderSoft}` }}
                >
                  <button
                    onClick={() => openAdjust(i, "add")}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded cursor-pointer transition-opacity hover:opacity-80"
                    style={{
                      color: colors.aurora,
                      background: colors.auroraBg,
                      border: `1px solid ${colors.auroraDim}`,
                    }}
                  >
                    <Plus size={12} /> Add stock
                  </button>
                  <button
                    onClick={() => openAdjust(i, "remove")}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded cursor-pointer transition-opacity hover:opacity-80"
                    style={{
                      color: colors.flare,
                      background: colors.flareBg,
                      border: `1px solid ${colors.flareDim}`,
                    }}
                  >
                    <Minus size={12} /> Remove stock
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Inventory History Section */}
      <Panel
        title={`Inventory history (${history.length})`}
        action={<History size={15} color={colors.textFaint} />}
      >
        <div className="flex flex-col gap-3 max-h-[255px] overflow-y-auto pr-2 custom-scrollbar">
          {history.length === 0 ? (
            <div className="text-xs py-6 text-center" style={{ color: colors.textMuted }}>
              No inventory transactions recorded yet.
            </div>
          ) : (
            history.map((h, idx) => {
              const delta = h.on_hand_delta ?? h.change ?? 0;
              const isPositive = delta > 0;
              const deltaColor = isPositive ? colors.aurora : delta < 0 ? colors.flare : colors.textMuted;
              const formattedDelta = isPositive ? `+${delta}` : `${delta}`;

              return (
                <div
                  key={h.id || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 text-sm pb-2.5 sm:pb-2"
                  style={{ borderBottom: `1px solid ${colors.borderSoft}` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium" style={{ color: colors.text }}>
                        {h.item_name}
                      </span>
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded"
                        style={{
                          background: colors.panelAlt,
                          color: colors.textMuted,
                        }}
                      >
                        {formatTransactionType(h.transaction_type)}
                      </span>
                    </div>
                    {h.notes && (
                      <div className="text-xs mt-0.5 truncate max-w-xl" style={{ color: colors.textMuted }}>
                        {h.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 justify-between sm:justify-end flex-shrink-0">
                    <span style={{ color: colors.textFaint, ...mono, fontSize: 11 }}>
                      {formatTimestamp(h.occurred_at || h.when)}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{
                        color: deltaColor,
                        background: colors.panelAlt,
                        ...mono,
                      }}
                    >
                      {formattedDelta} {h.unit || ""}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>

      {/* 3. Add Item Modal */}
      {addItemModalOpen && (
        <Modal
          title="Add inventory item — Bharti Station"
          onClose={() => setAddItemModalOpen(false)}
        >
          <form onSubmit={handleAddItemSubmit} className="flex flex-col gap-4">
            {itemFormError && (
              <div
                className="flex items-center gap-2 p-3 rounded text-xs"
                style={{
                  background: colors.flareBg,
                  color: colors.flare,
                  border: `1px solid ${colors.flareDim}`,
                }}
              >
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{itemFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Item code"
                value={itemForm.item_code}
                onChange={(val) => setItemForm((f) => ({ ...f, item_code: val }))}
                placeholder="e.g. MED-O2"
                required
              />
              <FormField
                label="Item name"
                value={itemForm.name}
                onChange={(val) => setItemForm((f) => ({ ...f, name: val }))}
                placeholder="e.g. Medical oxygen tanks"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Category"
                value={itemForm.category}
                onChange={(val) => setItemForm((f) => ({ ...f, category: val }))}
                placeholder="e.g. Medical, Fuel, Rations..."
                required
              />
              <FormField
                label="Unit"
                value={itemForm.unit}
                onChange={(val) => setItemForm((f) => ({ ...f, unit: val }))}
                placeholder="e.g. tanks, drums, units..."
                required
              />
            </div>

            {/* Critical item toggle switch */}
            <div
              className="flex items-center justify-between p-3 rounded-md"
              style={{
                background: colors.panelAlt,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <div className="flex flex-col">
                <span className="text-xs font-medium" style={{ color: colors.text }}>
                  Critical item
                </span>
                <span className="text-[11px]" style={{ color: colors.textMuted }}>
                  Flag as high-priority critical life-support supply
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemForm.is_critical}
                  onChange={(e) => setItemForm((f) => ({ ...f, is_critical: e.target.checked }))}
                  className="sr-only peer"
                />
                <div
                  className="w-10 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                  style={{
                    backgroundColor: itemForm.is_critical ? colors.flare : undefined,
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                label="Opening quantity"
                type="number"
                min="0"
                value={itemForm.opening_quantity}
                onChange={(val) => setItemForm((f) => ({ ...f, opening_quantity: val }))}
                placeholder="0"
                required
              />
              <FormField
                label="Minimum quantity"
                type="number"
                min="0"
                value={itemForm.minimum_quantity}
                onChange={(val) => setItemForm((f) => ({ ...f, minimum_quantity: val }))}
                placeholder="e.g. 50"
                required
              />
              <FormField
                label="Maximum quantity (optional)"
                type="number"
                min="0"
                value={itemForm.maximum_quantity}
                onChange={(val) => setItemForm((f) => ({ ...f, maximum_quantity: val }))}
                placeholder="e.g. 120"
              />
            </div>

            <FormField
              label="Notes (optional)"
              as="textarea"
              value={itemForm.notes}
              onChange={(val) => setItemForm((f) => ({ ...f, notes: val }))}
              placeholder="e.g. Initial Bharti stock"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAddItemModalOpen(false)}
                className="text-sm px-4 py-2 rounded cursor-pointer"
                style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={itemSubmitting}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded cursor-pointer transition-opacity"
                style={{
                  color: colors.iceButtonText,
                  background: colors.ice,
                  opacity: itemSubmitting ? 0.7 : 1,
                }}
              >
                {itemSubmitting && <Loader2 size={14} className="animate-spin" />}
                <span>Add item</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Adjust Stock Modal (Add / Remove) */}
      {adjustModalOpen && activeItem && (
        <Modal
          title={`${stockForm.operation === "add" ? "Add stock" : "Remove stock"} — ${activeItem.name}`}
          onClose={() => setAdjustModalOpen(false)}
        >
          <form onSubmit={handleStockSubmit} className="flex flex-col gap-4">
            {stockFormError && (
              <div
                className="flex items-center gap-2 p-3 rounded text-xs"
                style={{
                  background: colors.flareBg,
                  color: colors.flare,
                  border: `1px solid ${colors.flareDim}`,
                }}
              >
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{stockFormError}</span>
              </div>
            )}

            <div
              className="p-3 rounded text-xs flex items-center justify-between"
              style={{
                background: colors.panelAlt,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <div>
                <span style={{ color: colors.textMuted }}>Current available: </span>
                <span className="font-semibold" style={{ color: colors.text, ...mono }}>
                  {activeItem.available_quantity} {activeItem.unit}
                </span>
              </div>
              <div>
                <span style={{ color: colors.textMuted }}>On-hand: </span>
                <span className="font-semibold" style={{ color: colors.text, ...mono }}>
                  {activeItem.on_hand_quantity} {activeItem.unit}
                </span>
              </div>
            </div>

            <FormField
              label={`Quantity to ${stockForm.operation === "add" ? "add" : "remove"}`}
              type="number"
              min="1"
              value={stockForm.quantity}
              onChange={(val) => setStockForm((f) => ({ ...f, quantity: val }))}
              placeholder="Enter quantity..."
              required
            />

            <FormField
              label="Notes"
              value={stockForm.notes}
              onChange={(val) => setStockForm((f) => ({ ...f, notes: val }))}
              placeholder={
                stockForm.operation === "add"
                  ? "e.g. Resupply received"
                  : "e.g. Issued to field team"
              }
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="text-sm px-4 py-2 rounded cursor-pointer"
                style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={stockSubmitting}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded cursor-pointer transition-opacity"
                style={{
                  color: "#fff",
                  background: stockForm.operation === "add" ? colors.aurora : colors.flare,
                  opacity: stockSubmitting ? 0.7 : 1,
                }}
              >
                {stockSubmitting && <Loader2 size={14} className="animate-spin" />}
                <span>
                  Confirm {stockForm.operation === "add" ? "addition" : "removal"}
                </span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}