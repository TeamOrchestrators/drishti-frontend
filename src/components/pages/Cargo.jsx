import { useState, useMemo, useEffect } from "react";
import {useNavigate} from "react-router-dom";
import {
  Plus,
  Package,
  Search,
  X,
  Layers,
  Calendar,
  ArrowRight,
  Compass,
  AlertCircle,
  RefreshCw,
  Tag,
  Loader2,
  QrCode,
  Scan,
  MapPin,
  GitBranch,
  Route,
} from "lucide-react";
import { colors, mono } from "../../theme";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import SectionHeading from "../ui/SectionHeading";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";
import { TableSkeleton, CardSkeleton } from "../ui/Skeleton.jsx";
import { useCargoStore } from "../../store/useCargoStore.js";
import { useExpeditionStore } from "../../store/useExpeditionStore.js";
import {cargoApi} from "../../services/api.js";
import CargoQrModal from "../cargo/CargoQrModal.jsx";
import BatchMap from "../cargo/BatchMap.jsx";
import {
  matchCargoToBatch,
  resolveBatchStatus,
  batchStatusTone,
} from "../../utils/cargoUtils.js";
import {formatDisplayDateTime, toDateTimeLocalValue, toUtcISOString} from "../../utils/dateTime.js";
import {
  normalizeShipmentRoutes,
  shipmentRouteColor,
  shipmentStatusTone,
  transportModeOptions,
} from "../../utils/shipmentUtils.js";

const priorityOptions = [
  { value: "standard", label: "Standard" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const cargoStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "packed", label: "Packed" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in_transit", label: "In Transit" },
  { value: "received", label: "Received" },
  { value: "delayed", label: "Delayed" },
  { value: "cancelled", label: "Cancelled" },
];

const batchStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "planned", label: "Planned" },
  { value: "packed", label: "Packed" },
  { value: "dispatched", label: "Dispatched" },
  { value: "received", label: "Received" },
  { value: "delayed", label: "Delayed" },
  { value: "cancelled", label: "Cancelled" },
];

function cargoStatusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "draft") return "muted";
  if (s === "packed") return "amber";
  if (s === "dispatched" || s === "in_transit") return "ice";
  if (s === "received") return "aurora";
  if (s === "delayed") return "flare";
  if (s === "cancelled") return "muted";
  return "ice";
}

function priorityTone(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "critical") return "flare";
  if (p === "high") return "amber";
  return "muted";
}

function formatStatus(status) {
  if (!status) return "—";
  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPriority(priority) {
  if (!priority) return "Standard";
  return String(priority).charAt(0).toUpperCase() + String(priority).slice(1);
}

function formatBatchOption(b) {
  const code = b.batch_code || "LB-—";
  const origin = b.origin_station_name || "—";
  const dest = b.destination_station_name || "—";
  const status = b.status || "planned";
  return `${code} · ${origin} → ${dest} · ${status}`;
}

const emptyCargoForm = {
  cargo_code: "",
  origin_station_id: "",
  destination_station_id: "",
  expedition_id: "",
  priority: "standard",
  status: "draft",
  notes: "",
};

const emptyBatchForm = {
  batch_code: "",
  expedition_id: "",
  status: "planned",
  planned_dispatch_at: "",
  estimated_arrival_at: "",
  notes: "",
};

const emptyShipmentForm = {
  shipment_code: "",
  transport_mode: "airlift",
  priority: "critical",
  status: "planned",
  planned_dispatch_at: "",
  estimated_arrival_at: "",
  notes: "",
};

const emptySplitForm = {
  new_cargo_code: "",
  shipment_id: "",
  priority: "critical",
  notes: "",
  items: [],
};

const Cargo = () => {
  const {
    cargo,
    batches,
    batchTracking = {},
    loading,
    submitting,
    assigningCargoId,
    error,
    initialized,
    fetchCargo,
    fetchBatchTracking,
    createCargo,
    createBatch,
    createShipment,
    splitCargo,
    assignShipment,
    assignLogisticsBatch,
    clearError,
  } = useCargoStore();

  const {stations, expeditions} = useExpeditionStore();

  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalCargo, setQrModalCargo] = useState(null);
  const [isNewlyCreatedQr, setIsNewlyCreatedQr] = useState(false);
  const [form, setForm] = useState(emptyCargoForm);
  const [batchForm, setBatchForm] = useState(emptyBatchForm);
  const [formError, setFormError] = useState(null);
  const [batchFormError, setBatchFormError] = useState(null);
  const [search, setSearch] = useState("");
  const [expandedBatchMapId, setExpandedBatchMapId] = useState(null);
  const [shipmentModalBatch, setShipmentModalBatch] = useState(null);
  const [shipmentForm, setShipmentForm] = useState(emptyShipmentForm);
  const [shipmentFormError, setShipmentFormError] = useState(null);
  const [splitCargoSource, setSplitCargoSource] = useState(null);
  const [splitForm, setSplitForm] = useState(emptySplitForm);
  const [splitFormError, setSplitFormError] = useState(null);
  const [splitLoading, setSplitLoading] = useState(false);

  const openCargoQr = (cargoItem) => {
    setQrModalCargo(cargoItem);
    setIsNewlyCreatedQr(false);
    setQrModalOpen(true);
  };

  useEffect(() => {
    if (!initialized) {
      fetchCargo();
    } else if (batches.length > 0 && fetchBatchTracking) {
      batches.forEach((b) => {
        if (b.id && !batchTracking[b.id]) {
          fetchBatchTracking(b.id);
        }
      });
    }
  }, [initialized, batches, batchTracking, fetchCargo, fetchBatchTracking]);

  // Search filtering over cargo items
  const filteredCargo = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cargo;
    return cargo.filter((c) => {
      const id = (c.id || "").toLowerCase();
      const code = (c.cargo_code || "").toLowerCase();
      const origin = (c.origin_station_name || "").toLowerCase();
      const dest = (c.destination_station_name || "").toLowerCase();
      const expedition = (c.expedition_name || "").toLowerCase();
      const batchCode = (c.logistics_batch_code || "").toLowerCase();
      const priority = (c.priority || "").toLowerCase();
      const status = (c.status || "").toLowerCase();
      const notes = (c.notes || "").toLowerCase();
      return (
        id.includes(q) ||
        code.includes(q) ||
        origin.includes(q) ||
        dest.includes(q) ||
        expedition.includes(q) ||
        batchCode.includes(q) ||
        priority.includes(q) ||
        status.includes(q) ||
        notes.includes(q)
      );
    });
  }, [cargo, search]);

  const setC = (key) => (value) => {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      // Autofill origin and destination if expedition is chosen and stations exist on it
      if (key === "expedition_id") {
        if (value) {
          const currentExpeditions = useExpeditionStore.getState().expeditions;
          const currentStations = useExpeditionStore.getState().stations;
          const exp =
            currentExpeditions.find((e) => e.id === value) ||
            expeditions.find((e) => e.id === value);
          if (exp) {
            const allStations =
              currentStations.length > 0 ? currentStations : stations;
            const originStation = allStations.find(
              (s) =>
                s.id === exp.origin_station_id ||
                (exp.origin_station_name &&
                  s.name?.toLowerCase() ===
                  exp.origin_station_name.toLowerCase()) ||
                (s.code &&
                  exp.origin_station_code &&
                  s.code.toLowerCase() ===
                  exp.origin_station_code.toLowerCase()),
            );
            const destStation = allStations.find(
              (s) =>
                s.id === exp.destination_station_id ||
                (exp.destination_station_name &&
                  s.name?.toLowerCase() ===
                  exp.destination_station_name.toLowerCase()) ||
                (s.code &&
                  exp.destination_station_code &&
                  s.code.toLowerCase() ===
                  exp.destination_station_code.toLowerCase()),
            );

            updated.origin_station_id =
              originStation?.id ||
              exp.origin_station_id ||
              exp.originStationId ||
              "";
            updated.destination_station_id =
              destStation?.id ||
              exp.destination_station_id ||
              exp.destinationStationId ||
              "";
          }
        } else {
          // Expedition deselected: clear and unlock origin & destination
          updated.origin_station_id = "";
          updated.destination_station_id = "";
        }
      }
      return updated;
    });
  };

  const setB = (key) => (value) => {
    setBatchForm((f) => {
      const updated = { ...f, [key]: value };
      if (key === "expedition_id" && value) {
        const exp = expeditions.find((e) => e.id === value);
        if (exp) {
          const startDate = exp.start_date || exp.startDate;
          const endDate = exp.end_date || exp.endDate;
          if (startDate) {
            updated.planned_dispatch_at = toDateTimeLocalValue(startDate);
          }
          if (endDate) {
            updated.estimated_arrival_at = toDateTimeLocalValue(endDate);
          }
          if (
            updated.planned_dispatch_at &&
            updated.estimated_arrival_at &&
            updated.estimated_arrival_at < updated.planned_dispatch_at
          ) {
            updated.estimated_arrival_at = "";
          }
        }
      }
      if (
        key === "planned_dispatch_at" &&
        value &&
        updated.estimated_arrival_at &&
        updated.estimated_arrival_at < value
      ) {
        updated.estimated_arrival_at = "";
      }
      if (
        key === "estimated_arrival_at" &&
        value &&
        updated.planned_dispatch_at &&
        value < updated.planned_dispatch_at
      ) {
        updated.estimated_arrival_at = "";
      }
      return updated;
    });
  };

  function openCreateCargo() {
    setFormError(null);
    let nextNum = 2000;
    const existingCodes = new Set(cargo.map((c) => c.cargo_code));
    while (existingCodes.has(`CG-${nextNum}`)) {
      nextNum++;
    }
    setForm({
      ...emptyCargoForm,
      cargo_code: `CG-${nextNum}`,
    });
    if (useExpeditionStore.getState().expeditions.length === 0) {
      useExpeditionStore.getState().fetchExpeditions();
    }
    if (useExpeditionStore.getState().stations.length === 0) {
      useExpeditionStore.getState().fetchFormOptions();
    }
    setModalOpen(true);
  }

  function openCreateBatch() {
    setBatchFormError(null);
    let nextNum = 1;
    const existingCodes = new Set(batches.map((b) => b.batch_code));
    while (existingCodes.has(`LB-2026-${String(nextNum).padStart(3, "0")}`)) {
      nextNum++;
    }
    const defaultBatchCode = `LB-2026-${String(nextNum).padStart(3, "0")}`;

    setBatchForm({
      ...emptyBatchForm,
      batch_code: defaultBatchCode,
    });
    if (useExpeditionStore.getState().expeditions.length === 0) {
      useExpeditionStore.getState().fetchExpeditions();
    }
    setBatchModalOpen(true);
  }

  async function handleCargoSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!form.origin_station_id) {
      setFormError("Please select an origin station.");
      return;
    }
    if (!form.destination_station_id) {
      setFormError("Please select a destination station.");
      return;
    }
    if (form.origin_station_id === form.destination_station_id) {
      setFormError("Origin and destination stations cannot be the same.");
      return;
    }

    const trimmedCode = form.cargo_code.trim();
    if (
      cargo.some(
        (c) =>
          c.cargo_code &&
          c.cargo_code.toLowerCase() === trimmedCode.toLowerCase(),
      )
    ) {
      setFormError(`A cargo item with code "${trimmedCode}" already exists.`);
      return;
    }

    const payload = {
      cargo_code: trimmedCode || `CG-${Math.floor(2000 + Math.random() * 900)}`,
      origin_station_id: form.origin_station_id,
      destination_station_id: form.destination_station_id,
      expedition_id: form.expedition_id || undefined,
      priority: form.priority || "standard",
      status: form.status || "draft",
      notes: form.notes ? form.notes.trim() : "",
    };

    try {
      const res = await createCargo(payload);
      setModalOpen(false);
      setForm(emptyCargoForm);

      // Immediately show polished Cargo QR generated modal
      const currentStations =
        useExpeditionStore.getState().stations.length > 0 ?
          useExpeditionStore.getState().stations
          : stations;
      const currentExpeditions =
        useExpeditionStore.getState().expeditions.length > 0 ?
          useExpeditionStore.getState().expeditions
          : expeditions;
      const originStation = currentStations.find(
        (s) => s.id === payload.origin_station_id,
      );
      const destStation = currentStations.find(
        (s) => s.id === payload.destination_station_id,
      );
      const linkedExp = currentExpeditions.find(
        (e) => e.id === payload.expedition_id,
      );

      setQrModalCargo({
        id: res?.cargo_id || res?.qr_token || payload.cargo_code,
        qr_token: res?.qr_token || res?.cargo_id || payload.cargo_code,
        cargo_code: payload.cargo_code,
        origin_station_name: originStation?.name || "Station Origin",
        destination_station_name: destStation?.name || "Station Destination",
        priority: payload.priority || "standard",
        status: payload.status || "draft",
        expedition_name: linkedExp?.expedition_name || linkedExp?.name,
        notes: payload.notes,
      });
      setIsNewlyCreatedQr(true);
      setQrModalOpen(true);
    } catch (err) {
      setFormError(err.message || "Failed to create cargo request.");
    }
  }

  async function handleBatchSubmit(e) {
    e.preventDefault();
    setBatchFormError(null);

    const trimmedCode = batchForm.batch_code.trim();
    if (!trimmedCode) {
      setBatchFormError("Please enter a batch code.");
      return;
    }

    // Prevent duplicate batch code immediately
    if (
      batches.some(
        (b) =>
          b.batch_code &&
          b.batch_code.toLowerCase() === trimmedCode.toLowerCase(),
      )
    ) {
      setBatchFormError(
        `A batch with code "${trimmedCode}" already exists. Please choose a unique batch code.`,
      );
      return;
    }

    if (!batchForm.expedition_id) {
      setBatchFormError("A logistics batch must belong to an expedition.");
      return;
    }
    if (!batchForm.planned_dispatch_at) {
      setBatchFormError("Please select a planned dispatch date and time.");
      return;
    }
    if (!batchForm.estimated_arrival_at) {
      setBatchFormError("Please select an estimated arrival date and time.");
      return;
    }

    const dispatchTime = new Date(batchForm.planned_dispatch_at).getTime();
    const arrivalTime = new Date(batchForm.estimated_arrival_at).getTime();
    if (arrivalTime < dispatchTime) {
      setBatchFormError(
        "Estimated arrival date and time cannot be earlier than planned dispatch date and time.",
      );
      return;
    }

    const selectedExpedition = expeditions.find(
      (expedition) => expedition.id === batchForm.expedition_id,
    );
    const expeditionStart = toDateTimeLocalValue(
      selectedExpedition?.start_date || selectedExpedition?.startDate,
    );
    const expeditionEnd = toDateTimeLocalValue(
      selectedExpedition?.end_date || selectedExpedition?.endDate,
    );
    if (expeditionStart && batchForm.planned_dispatch_at < expeditionStart) {
      setBatchFormError("Planned dispatch cannot be before the expedition starts.");
      return;
    }
    if (expeditionEnd && batchForm.estimated_arrival_at > expeditionEnd) {
      setBatchFormError("Estimated arrival cannot be after the expedition ends.");
      return;
    }

    const payload = {
      batch_code: trimmedCode,
      expedition_id: batchForm.expedition_id,
      status: batchForm.status || "planned",
      planned_dispatch_at: toUtcISOString(batchForm.planned_dispatch_at),
      estimated_arrival_at: toUtcISOString(batchForm.estimated_arrival_at),
      notes: batchForm.notes ? batchForm.notes.trim() : "",
    };

    try {
      await createBatch(payload);
      setBatchModalOpen(false);
      setBatchForm(emptyBatchForm);
    } catch (err) {
      setBatchFormError(err.message || "Failed to create logistics batch.");
    }
  }

  async function handleBatchAssignment(cargoId, selectedBatchId) {
    try {
      await assignLogisticsBatch(cargoId, selectedBatchId || null);
    } catch (err) {
      console.error("Batch assignment error:", err);
    }
  }

  function openCreateShipment(batch) {
    const tracking =
      (batch.id && batchTracking[batch.id]) ||
      (batch.batch_code && batchTracking[batch.batch_code]);
    const routeNumber = normalizeShipmentRoutes(tracking).length + 1;
    setShipmentModalBatch(batch);
    setShipmentForm({
      ...emptyShipmentForm,
      shipment_code: `${batch.batch_code || "SHIP"}-${String(routeNumber).padStart(2, "0")}`,
      planned_dispatch_at: toDateTimeLocalValue(batch.planned_dispatch_at),
      estimated_arrival_at: toDateTimeLocalValue(batch.estimated_arrival_at),
    });
    setShipmentFormError(null);
  }

  const setShipmentField = (key) => (value) => {
    setShipmentForm((current) => ({...current, [key]: value}));
  };

  async function handleShipmentSubmit(event) {
    event.preventDefault();
    setShipmentFormError(null);
    if (!shipmentModalBatch?.id) {
      setShipmentFormError("The selected batch does not have a valid identifier.");
      return;
    }
    if (!shipmentForm.shipment_code.trim()) {
      setShipmentFormError("Please enter a shipment code.");
      return;
    }
    if (!shipmentForm.planned_dispatch_at || !shipmentForm.estimated_arrival_at) {
      setShipmentFormError("Please select dispatch and arrival date-times.");
      return;
    }
    if (shipmentForm.estimated_arrival_at < shipmentForm.planned_dispatch_at) {
      setShipmentFormError("Shipment arrival cannot be before dispatch.");
      return;
    }
    const parentExpedition = expeditions.find(
      (expedition) => expedition.id === shipmentModalBatch.expedition_id,
    );
    const expeditionStart = toDateTimeLocalValue(
      parentExpedition?.start_date || parentExpedition?.startDate,
    );
    const expeditionEnd = toDateTimeLocalValue(
      parentExpedition?.end_date || parentExpedition?.endDate,
    );
    if (expeditionStart && shipmentForm.planned_dispatch_at < expeditionStart) {
      setShipmentFormError("Shipment dispatch cannot be before the parent expedition starts.");
      return;
    }
    if (expeditionEnd && shipmentForm.estimated_arrival_at > expeditionEnd) {
      setShipmentFormError("Shipment arrival cannot be after the parent expedition ends.");
      return;
    }

    try {
      await createShipment(shipmentModalBatch.id, {
        shipment_code: shipmentForm.shipment_code.trim(),
        transport_mode: shipmentForm.transport_mode,
        priority: shipmentForm.priority,
        status: shipmentForm.status,
        planned_dispatch_at: toUtcISOString(shipmentForm.planned_dispatch_at),
        estimated_arrival_at: toUtcISOString(shipmentForm.estimated_arrival_at),
        notes: shipmentForm.notes.trim(),
      });
      setShipmentModalBatch(null);
      setShipmentForm(emptyShipmentForm);
    } catch (err) {
      setShipmentFormError(err.message || "Failed to create shipment route.");
    }
  }

  async function handleShipmentAssignment(cargoId, shipmentId) {
    try {
      await assignShipment(cargoId, shipmentId || null);
    } catch {
      // The store exposes the API error in the page-level error banner.
    }
  }

  async function openSplitCargo(cargoItem, routes) {
    setSplitLoading(true);
    setSplitFormError(null);
    try {
      const detail = await cargoApi.getByQrToken(cargoItem.id || cargoItem.cargo_code);
      const source = detail && typeof detail === "object" ? {...cargoItem, ...detail} : cargoItem;
      const availableItems = Array.isArray(source.items) ? source.items : [];
      const urgentRoute = routes.find(
        (route) => route.priority === "critical" || route.transport_mode === "airlift",
      );
      setSplitCargoSource({...source, availableRoutes: routes});
      setSplitForm({
        ...emptySplitForm,
        new_cargo_code: `${source.cargo_code || "CARGO"}-URG`,
        shipment_id: urgentRoute?.id || routes[0]?.id || "",
        priority: "critical",
        items: availableItems.map((item) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          unit: item.unit,
          available_quantity: Number(item.quantity || 0),
          quantity: "",
        })),
      });
    } catch (err) {
      setSplitFormError(err.message || "Could not load the cargo manifest.");
      setSplitCargoSource({...cargoItem, availableRoutes: routes});
      setSplitForm({...emptySplitForm, new_cargo_code: `${cargoItem.cargo_code || "CARGO"}-URG`});
    } finally {
      setSplitLoading(false);
    }
  }

  const setSplitField = (key) => (value) => {
    setSplitForm((current) => ({...current, [key]: value}));
  };

  function setSplitItemQuantity(itemId, value) {
    setSplitForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.item_id === itemId ? {...item, quantity: value} : item
      ),
    }));
  }

  async function handleSplitSubmit(event) {
    event.preventDefault();
    setSplitFormError(null);
    if (!splitCargoSource?.id) {
      setSplitFormError("The source cargo does not have a valid identifier.");
      return;
    }
    if (!splitForm.shipment_id) {
      setSplitFormError("Select the shipment route that will carry the split cargo.");
      return;
    }
    const allocations = splitForm.items
      .map((item) => ({...item, quantity: Number(item.quantity)}))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
    if (allocations.length === 0) {
      setSplitFormError("Enter a positive quantity for at least one manifest item.");
      return;
    }
    const invalidAllocation = allocations.find(
      (item) => item.quantity > item.available_quantity,
    );
    if (invalidAllocation) {
      setSplitFormError(
        `${invalidAllocation.item_name || "Item"} exceeds the available quantity of ${invalidAllocation.available_quantity}.`,
      );
      return;
    }

    try {
      await splitCargo(splitCargoSource.id, {
        new_cargo_code: splitForm.new_cargo_code.trim(),
        shipment_id: splitForm.shipment_id,
        priority: splitForm.priority,
        notes: splitForm.notes.trim(),
        items: allocations.map(({item_id, quantity}) => ({item_id, quantity})),
      });
      setSplitCargoSource(null);
      setSplitForm(emptySplitForm);
    } catch (err) {
      setSplitFormError(err.message || "Failed to split cargo manifest.");
    }
  }

  // Station dropdown options populated with fallback for linked expedition stations
  const stationOptions = useMemo(() => {
    const opts = stations.map((s) => ({
      value: s.id,
      label: s.code ? `${s.name} (${s.code})` : s.name,
    }));

    const selectedExp = expeditions.find((e) => e.id === form.expedition_id);
    const ensureOption = (id, fallbackName) => {
      if (id && !opts.some((o) => o.value === id)) {
        opts.push({
          value: id,
          label: fallbackName || id,
        });
      }
    };

    if (form.origin_station_id) {
      ensureOption(form.origin_station_id, selectedExp?.origin_station_name);
    }
    if (form.destination_station_id) {
      ensureOption(
        form.destination_station_id,
        selectedExp?.destination_station_name,
      );
    }

    return opts;
  }, [
    stations,
    expeditions,
    form.expedition_id,
    form.origin_station_id,
    form.destination_station_id,
  ]);

  // Expedition dropdown options
  const expeditionOptions = expeditions.map((e) => {
    const code = e.expedition_code || e.code || "";
    const name = e.expedition_name || e.name || "Untitled Expedition";
    return {
      value: e.id,
      label: code ? `${code} · ${name}` : name,
    };
  });

  // Preview selected expedition for batch creation
  const selectedExpeditionForBatch = expeditions.find(
    (e) => e.id === batchForm.expedition_id,
  );
  const batchWindowStart = toDateTimeLocalValue(
    selectedExpeditionForBatch?.start_date || selectedExpeditionForBatch?.startDate,
  );
  const batchWindowEnd = toDateTimeLocalValue(
    selectedExpeditionForBatch?.end_date || selectedExpeditionForBatch?.endDate,
  );
  const dispatchMaximum = [batchForm.estimated_arrival_at, batchWindowEnd]
    .filter(Boolean)
    .sort()[0];
  const arrivalMinimum = [batchForm.planned_dispatch_at, batchWindowStart]
    .filter(Boolean)
    .sort()
    .at(-1);
  const selectedExpeditionForShipment = expeditions.find(
    (expedition) => expedition.id === shipmentModalBatch?.expedition_id,
  );
  const shipmentWindowStart = toDateTimeLocalValue(
    selectedExpeditionForShipment?.start_date || selectedExpeditionForShipment?.startDate,
  );
  const shipmentWindowEnd = toDateTimeLocalValue(
    selectedExpeditionForShipment?.end_date || selectedExpeditionForShipment?.endDate,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <SectionHeading
        right={
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => fetchCargo()}
              disabled={loading}
              title="Refresh cargo & logistics"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""}/>
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => navigate("/cargo/scan")}
              className="md:hidden flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded cursor-pointer transition-opacity hover:opacity-80"
              style={{
                background: colors.auroraBg,
                color: colors.aurora,
                border: `1px solid ${colors.auroraDim}`,
              }}
              title="Scan cargo QR code"
            >
              <Scan size={14}/> Scan cargo QR
            </button>
            <button
              onClick={openCreateBatch}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded cursor-pointer transition-opacity hover:opacity-80"
              style={{
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
            >
              <Layers size={14} /> New Logistics Batch
            </button>
            <button
              onClick={openCreateCargo}
              className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded cursor-pointer transition-opacity hover:opacity-90"
              style={{ color: colors.iceButtonText, background: colors.ice }}
            >
              <Plus size={15} /> New Cargo Request
            </button>
          </div>
        }
      >
        Cargo & logistics
      </SectionHeading>

      {/* Global Error Banner if API call failed */}
      {error && (
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
            onClick={() => {
              clearError();
              fetchCargo();
            }}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded cursor-pointer transition-opacity hover:opacity-80 font-medium"
            style={{
              background: colors.bgRaised,
              color: colors.text,
              border: `1px solid ${colors.border}`,
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Logistics Batches Section */}
      <Panel
        title={`Logistics Batches (${batches.length})`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateBatch}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
              style={{
                background: colors.auroraBg,
                color: colors.aurora,
              }}
            >
              <Plus size={13}/> New Logistics Batch
            </button>
          </div>
        }
      >
        {loading && !initialized ?
          <CardSkeleton count={2}/>
          : batches.length === 0 ?
            <div
              className="py-10 text-center text-xs rounded-lg"
              style={{
                color: colors.textMuted,
                border: `1px dashed ${colors.borderSoft}`,
              }}
            >
              No logistics batches created yet. Click "New Logistics Batch" above
              to plan a batch for an expedition.
            </div>
            : <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-start">
              {batches.map((b) => {
                const assignedCargoList = cargo.filter((c) =>
                  matchCargoToBatch(c, b),
                );
                const cargoCount = assignedCargoList.length || b.cargo_count || 0;
                const batchKey = b.id || b.batch_code;
                const isMapExpanded = expandedBatchMapId === batchKey;

                const tracking =
                  (b.id && batchTracking[b.id]) ||
                  (b.batch_code && batchTracking[b.batch_code]) ||
                  null;
                const checkpoints =
                  Array.isArray(tracking?.checkpoints) ?
                    tracking.checkpoints
                    : [];
                const shipments = normalizeShipmentRoutes(tracking);
                const shipmentCheckpointCount = shipments.reduce(
                  (total, shipment) => total + shipment.checkpoints.length,
                  0,
                );
                const hasCheckpoints = checkpoints.length > 0 || shipmentCheckpointCount > 0;
                const hasPropagated = [...checkpoints, ...shipments.flatMap((shipment) => shipment.checkpoints)].some(
                  (cp) => Number(cp.affected_cargo_count) > 1,
                );

                const effectiveBatchStatus = resolveBatchStatus(
                  b,
                  cargo,
                  tracking,
                );

                // Calculate batch propagation statistics
                const receivedCount = assignedCargoList.filter(
                  (c) => c.status === "received",
                ).length;
                const inTransitCount = assignedCargoList.filter(
                  (c) => c.status === "in_transit",
                ).length;
                const dispatchedCount = assignedCargoList.filter(
                  (c) => c.status === "dispatched",
                ).length;
                const packedCount = assignedCargoList.filter(
                  (c) => c.status === "packed",
                ).length;
                const delayedCount = assignedCargoList.filter(
                  (c) => c.status === "delayed",
                ).length;

                return (
                  <div
                    key={batchKey}
                    className="rounded-lg p-4 sm:p-5 flex flex-col gap-3.5 transition-colors shadow-xs h-auto self-start"
                    style={{
                      background: colors.bgRaised,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {/* Batch Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-sm font-semibold tracking-wide"
                          style={{...mono, color: colors.text}}
                        >
                          {b.batch_code}
                        </span>
                          <Pill tone={batchStatusTone(effectiveBatchStatus)}>
                            {formatStatus(effectiveBatchStatus)}
                          </Pill>
                          {hasPropagated && (
                            <span
                              className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded"
                              style={{
                                background: colors.iceBg,
                                color: colors.ice,
                                border: `1px solid ${colors.iceDim}`,
                              }}
                            >
                            Propagated
                          </span>
                          )}
                        </div>
                        <div
                          className="flex items-center gap-1.5 text-xs font-medium truncate"
                          style={{color: colors.text}}
                        >
                        <span>
                          {b.origin_station_name ||
                            assignedCargoList[0]?.origin_station_name ||
                            "—"}
                        </span>
                          <ArrowRight
                            size={12}
                            style={{color: colors.textFaint}}
                          />
                          <span>
                          {b.destination_station_name ||
                            assignedCargoList[0]?.destination_station_name ||
                            "—"}
                        </span>
                        </div>
                      </div>

                      {/* Actions: Cargo count badge & Batch Map button */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openCreateShipment(b)}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded cursor-pointer transition-opacity hover:opacity-85"
                          style={{
                            background: colors.panelAlt,
                            color: colors.aurora,
                            border: `1px solid ${colors.borderSoft}`,
                          }}
                          title="Add an independently tracked shipment route"
                        >
                          <Route size={12}/>
                          <span className="hidden sm:inline">Add route</span>
                        </button>
                        {hasCheckpoints ?
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBatchMapId(
                                isMapExpanded ? null : batchKey,
                              )
                            }
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded cursor-pointer transition-opacity hover:opacity-85"
                            style={{
                              background:
                                isMapExpanded ? colors.ice : colors.panelAlt,
                              color:
                                isMapExpanded ? colors.iceButtonText : colors.ice,
                              border: `1px solid ${isMapExpanded ? colors.ice : colors.borderSoft}`,
                            }}
                            title={
                              isMapExpanded ? "Collapse route map" : (
                                "View route map"
                              )
                            }
                          >
                            <MapPin size={12}/>
                            <span>{isMapExpanded ? "Hide map" : "Show map"}</span>
                          </button>
                          : <div
                            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded select-none cursor-default opacity-60"
                            style={{
                              background: colors.panelAlt,
                              color: colors.textMuted,
                              border: `1px solid ${colors.borderSoft}`,
                            }}
                            title="No GPS checkpoints recorded yet"
                          >
                            <MapPin
                              size={12}
                              style={{color: colors.textFaint}}
                            />
                            <span>No GPS</span>
                          </div>
                        }

                        <div
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: colors.panelAlt,
                            color: colors.ice,
                            border: `1px solid ${colors.borderSoft}`,
                          }}
                        >
                          <Package size={13}/>
                          <span style={{...mono}}>{cargoCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Batch Propagation Progress Bar & Summary */}
                    {assignedCargoList.length > 0 && (
                      <div
                        className="p-2.5 rounded-lg flex flex-col gap-1.5 text-xs"
                        style={{
                          background: colors.panelAlt,
                          border: `1px solid ${colors.borderSoft}`,
                        }}
                      >
                        <div className="flex items-center justify-between text-[11px] font-medium flex-wrap gap-1">
                        <span style={{color: colors.textMuted}}>
                          Batch Propagation
                        </span>
                          <span style={{color: colors.text}}>
                          {receivedCount === assignedCargoList.length ?
                            "All items received · Complete"
                            : [
                              dispatchedCount > 0 ?
                                `${dispatchedCount} dispatched`
                                : null,
                              inTransitCount > 0 ?
                                `${inTransitCount} in transit`
                                : null,
                              packedCount > 0 ? `${packedCount} packed` : null,
                              receivedCount > 0 ?
                                `${receivedCount} received`
                                : null,
                              delayedCount > 0 ?
                                `${delayedCount} delayed`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") ||
                            `${assignedCargoList.length} items`
                          }
                        </span>
                        </div>

                        {/* Multi-segment propagation bar */}
                        <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-800/40">
                          {receivedCount > 0 && (
                            <div
                              style={{
                                width: `${(receivedCount / assignedCargoList.length) * 100}%`,
                                background: "#059669",
                              }}
                              title={`${receivedCount} received`}
                            />
                          )}
                          {inTransitCount > 0 && (
                            <div
                              style={{
                                width: `${(inTransitCount / assignedCargoList.length) * 100}%`,
                                background: "#0284C7",
                              }}
                              title={`${inTransitCount} in transit`}
                            />
                          )}
                          {dispatchedCount > 0 && (
                            <div
                              style={{
                                width: `${(dispatchedCount / assignedCargoList.length) * 100}%`,
                                background: "#38BDF8",
                              }}
                              title={`${dispatchedCount} dispatched`}
                            />
                          )}
                          {packedCount > 0 && (
                            <div
                              style={{
                                width: `${(packedCount / assignedCargoList.length) * 100}%`,
                                background: "#D97706",
                              }}
                              title={`${packedCount} packed`}
                            />
                          )}
                          {delayedCount > 0 && (
                            <div
                              style={{
                                width: `${(delayedCount / assignedCargoList.length) * 100}%`,
                                background: "#DC2626",
                              }}
                              title={`${delayedCount} delayed`}
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {shipments.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold uppercase tracking-wide" style={{color: colors.textFaint}}>
                            Independent shipment routes
                          </span>
                          <span style={{...mono, color: colors.textMuted}}>{shipments.length}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {shipments.map((shipment, shipmentIndex) => {
                            const routeColor = shipmentRouteColor(shipment, shipmentIndex);
                            return (
                              <div
                                key={shipment.id}
                                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                                style={{background: colors.panelAlt, border: `1px solid ${colors.borderSoft}`}}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: routeColor}} />
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold truncate" style={{color: colors.text, ...mono}}>
                                      {shipment.shipment_code}
                                    </div>
                                    <div className="text-[10px] capitalize truncate" style={{color: colors.textMuted}}>
                                      {String(shipment.transport_mode || "route").replace(/_/g, " ")} · {shipment.priority || "standard"} priority
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[10px]" style={{color: colors.textMuted, ...mono}}>
                                    {shipment.cargo_count ?? 0} cargo · {shipment.total_quantity ?? "—"} units
                                  </span>
                                  <Pill tone={shipmentStatusTone(shipment.status)}>
                                    {formatStatus(shipment.status || "planned")}
                                  </Pill>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* For batches with no GPS data, show compact inline empty state */}
                    {!hasCheckpoints && (
                      <div
                        className="px-3 py-2 rounded-lg flex items-center gap-2 text-xs"
                        style={{
                          background: colors.panelAlt,
                          color: colors.textMuted,
                          border: `1px dashed ${colors.borderSoft}`,
                        }}
                      >
                        <MapPin
                          size={13}
                          style={{color: colors.textFaint}}
                          className="flex-shrink-0"
                        />
                        <span>No GPS checkpoints recorded yet</span>
                      </div>
                    )}

                    {/* Expandable Batch Map */}
                    {hasCheckpoints && isMapExpanded && (
                      <div className="pt-1 pb-1 animate-in fade-in duration-200">
                        <BatchMap
                          batch={b}
                          checkpoints={checkpoints}
                          shipments={shipments}
                          cargoList={assignedCargoList}
                          stations={stations}
                          height="260px"
                        />
                      </div>
                    )}

                    {/* Batch Details Grid */}
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 text-xs"
                      style={{borderTop: `1px solid ${colors.borderSoft}`}}
                    >
                      {/* Linked expedition */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Compass
                          size={13}
                          className="flex-shrink-0"
                          style={{color: colors.textFaint}}
                        />
                        <span
                          className="truncate"
                          style={{color: colors.textMuted}}
                        >
                        {b.expedition_name ?
                          <span style={{color: colors.text, fontWeight: 500}}>
                            {b.expedition_name}
                          </span>
                          : <span style={{color: colors.textFaint}}>
                            Unlinked expedition
                          </span>
                        }
                      </span>
                      </div>

                      {/* Planned Dispatch & Est. Arrival */}
                      <div className="flex items-center gap-1.5 min-w-0 sm:justify-end">
                        <Calendar
                          size={13}
                          className="flex-shrink-0"
                          style={{color: colors.textFaint}}
                        />
                        <span style={{color: colors.textMuted, fontSize: 12}}>
                        {formatDisplayDateTime(b.planned_dispatch_at)} →{" "}
                          {formatDisplayDateTime(b.estimated_arrival_at)}
                      </span>
                      </div>
                    </div>

                    {/* Assigned items tag list if any */}
                    {assignedCargoList.length > 0 && (
                      <div
                        className="flex flex-wrap gap-1.5 pt-2"
                        style={{borderTop: `1px solid ${colors.borderSoft}`}}
                      >
                        {assignedCargoList.map((c) => {
                          const shipment = shipments.find(
                            (route) =>
                              route.id === c.logistics_shipment_id ||
                              route.shipment_code === c.logistics_shipment_code,
                          );
                          const shipmentIndex = shipment ? shipments.indexOf(shipment) : -1;
                          return (
                          <span
                            key={c.id}
                            className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1"
                            style={{
                              background: colors.panelAlt,
                              color: colors.textMuted,
                              border: `1px solid ${colors.borderSoft}`,
                            }}
                          >
                          <Tag size={10} style={{color: colors.textFaint}}/>
                          <span
                            className="font-medium"
                            style={{color: colors.text, ...mono}}
                          >
                            {c.cargo_code || c.id}
                          </span>
                            {c.status && (
                              <span className="text-[10px] uppercase font-semibold text-slate-400">
                              ({formatStatus(c.status)})
                            </span>
                            )}
                            {shipment && (
                              <span
                                className="text-[10px] font-semibold"
                                style={{color: shipmentRouteColor(shipment, shipmentIndex)}}
                              >
                                · {shipment.shipment_code}
                              </span>
                            )}
                            {c.notes && (
                              <span className="max-w-[120px] truncate">
                              · {c.notes}
                            </span>
                            )}
                          </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
        }
      </Panel>

      {/* Cargo Requests Table Panel */}
      <Panel
        title={`Cargo requests (${cargo.length})`}
        action={
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded w-full sm:w-auto"
            style={{
              background: colors.bgRaised,
              border: `1px solid ${colors.border}`,
            }}
          >
            <Search
              size={13}
              color={colors.textFaint}
              className="flex-shrink-0"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, route, expedition, batch..."
              className="text-xs outline-none bg-transparent w-full sm:w-60"
              style={{ color: colors.text }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="cursor-pointer hover:opacity-80 p-0.5 text-xs flex-shrink-0"
                style={{ color: colors.textFaint }}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        }
      >
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          {loading && !initialized ?
            <TableSkeleton rows={5} cols={7} />
            : <table className="w-full text-sm border-collapse min-w-[1050px]">
              <thead>
                <tr style={{ color: colors.textFaint }}>
                  {[
                    "Cargo Code",
                    "Expedition",
                    "Route (Origin → Destination)",
                    "Priority",
                    "Dispatch Batch",
                    "Status",
                    "Notes",
                    "QR Label",
                  ].map((h, idx) => (
                    <th
                      key={h}
                      className={`text-left font-medium pb-3 text-xs whitespace-nowrap px-4 ${
                        idx === 0 ? "pl-2" : ""
                      } ${idx === 7 ? "pr-2 text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
              {filteredCargo.length === 0 ?
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-xs"
                      style={{ color: colors.textMuted }}
                    >
                      {search ?
                        `No cargo requests match "${search}".`
                        : 'No cargo requests recorded. Click "New Cargo Request" to create one.'
                      }
                    </td>
                  </tr>
                : filteredCargo.map((c) => {
                    // Match batch by batch_code or logistics_batch_id
                  const assignedBatch = batches.find((b) =>
                      matchCargoToBatch(c, b),
                    );
                  const currentBatchId =
                    assignedBatch?.id ||
                    c.logistics_batch_id ||
                    c.batch_id ||
                    "";
                  const assignedTracking = assignedBatch
                    ? (assignedBatch.id && batchTracking[assignedBatch.id]) ||
                      (assignedBatch.batch_code && batchTracking[assignedBatch.batch_code])
                    : null;
                  const availableShipments = normalizeShipmentRoutes(assignedTracking);
                  const currentShipmentId =
                    c.logistics_shipment_id ||
                    availableShipments.find(
                      (shipment) => shipment.shipment_code === c.logistics_shipment_code,
                    )?.id ||
                    "";
                    const isAssigningThisRow = assigningCargoId === c.id;

                    return (
                      <tr
                        key={c.id}
                        style={{ borderTop: `1px solid ${colors.borderSoft}` }}
                      >
                        {/* Cargo Code with compact QR button */}
                        <td
                          className="py-3.5 px-4 pl-2 whitespace-nowrap font-medium"
                          style={{ color: colors.text, ...mono, fontSize: 13 }}
                        >
                          <div className="flex items-center gap-2">
                            <span>{c.cargo_code || c.id}</span>
                          </div>
                        </td>

                        {/* Expedition */}
                        <td
                          className="py-3.5 px-4 whitespace-nowrap"
                          style={{ color: colors.textMuted, fontSize: 13 }}
                        >
                          {c.expedition_name ?
                            <span className="flex items-center gap-1.5">
                              <Compass
                                size={13}
                                style={{color: colors.textFaint}}
                              />
                              <span style={{color: colors.text}}>
                                {c.expedition_name}
                              </span>
                            </span>
                            : <span style={{color: colors.textFaint}}>—</span>}
                        </td>

                        {/* Origin -> Destination Route */}
                        <td
                          className="py-3.5 px-4 whitespace-nowrap"
                          style={{ color: colors.textMuted, fontSize: 13 }}
                        >
                          <span
                            className="font-medium"
                            style={{color: colors.text}}
                          >
                            {c.origin_station_name || "—"}
                          </span>
                          <span
                            style={{color: colors.textFaint}}
                            className="mx-1.5"
                          >
                            →
                          </span>
                          <span
                            className="font-medium"
                            style={{color: colors.text}}
                          >
                            {c.destination_station_name || "—"}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Pill tone={priorityTone(c.priority)}>
                            {formatPriority(c.priority)}
                          </Pill>
                        </td>

                        {/* Dispatch Batch Dropdown */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1.5 min-w-[245px]">
                            <div className="flex items-center gap-2">
                            <select
                              value={currentBatchId}
                              disabled={isAssigningThisRow}
                              onChange={(ev) =>
                                handleBatchAssignment(c.id, ev.target.value)
                              }
                              className="text-xs rounded px-2.5 py-1.5 outline-none max-w-[320px] truncate cursor-pointer transition-opacity"
                              style={{
                                background: colors.bgRaised,
                                color:
                                  currentBatchId ?
                                    colors.text
                                    : colors.textFaint,
                                border: `1px solid ${colors.border}`,
                                opacity: isAssigningThisRow ? 0.6 : 1,
                              }}
                              title="Assign to a logistics dispatch batch"
                            >
                              <option value="">Unassigned</option>
                              {batches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {formatBatchOption(b)}
                                </option>
                              ))}
                            </select>
                            {isAssigningThisRow && (
                              <Loader2
                                size={13}
                                className="animate-spin"
                                style={{ color: colors.ice }}
                              />
                            )}
                            </div>
                            {availableShipments.length > 0 && (
                              <select
                                value={currentShipmentId}
                                disabled={isAssigningThisRow}
                                onChange={(event) => handleShipmentAssignment(c.id, event.target.value)}
                                className="text-[11px] rounded px-2.5 py-1.5 outline-none max-w-[320px] truncate cursor-pointer"
                                style={{
                                  background: colors.panelAlt,
                                  color: currentShipmentId ? colors.text : colors.textFaint,
                                  border: `1px solid ${colors.borderSoft}`,
                                }}
                                title="Assign this cargo to an independently tracked shipment route"
                              >
                                <option value="">No child shipment</option>
                                {availableShipments.map((shipment) => (
                                  <option key={shipment.id} value={shipment.id}>
                                    {shipment.shipment_code} · {shipment.transport_mode || "route"} · {shipment.priority || "standard"}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Pill tone={cargoStatusTone(c.status)}>
                            {formatStatus(c.status)}
                          </Pill>
                        </td>

                        {/* Notes */}
                        <td
                          className="py-3.5 px-4 pr-2 max-w-[220px] truncate text-xs"
                          style={{ color: colors.textMuted }}
                          title={c.notes || ""}
                        >
                          {c.notes || "—"}
                        </td>

                        {/* QR Action */}
                        <td className="py-3.5 px-4 pr-2 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {availableShipments.length > 0 && !["received", "cancelled"].includes(c.status) && (
                              <button
                                type="button"
                                onClick={() => openSplitCargo(c, availableShipments)}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80 font-medium"
                                style={{
                                  background: colors.amberBg,
                                  color: colors.amber,
                                  border: `1px solid ${colors.amberDim}`,
                                }}
                                title={`Split part of ${c.cargo_code || c.id} onto another route`}
                              >
                                <GitBranch size={13}/>
                                <span>Split</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openCargoQr(c)}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80 font-medium"
                              style={{
                                background: colors.panelAlt,
                                color: colors.ice,
                                border: `1px solid ${colors.borderSoft}`,
                              }}
                              title={`View & print QR label for ${c.cargo_code || c.id}`}
                            >
                              <QrCode size={13}/>
                              <span>QR</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                })
              }
              </tbody>
            </table>
          }
        </div>
      </Panel>

      {/* Modal: Create Cargo Request */}
      {modalOpen && (
        <Modal title="New cargo request" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCargoSubmit} className="flex flex-col gap-4">
            {formError && (
              <div
                className="flex items-center gap-2 p-3 rounded text-xs"
                style={{
                  background: colors.flareBg,
                  color: colors.flare,
                  border: `1px solid ${colors.flareDim}`,
                }}
              >
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Cargo code"
                value={form.cargo_code}
                onChange={setC("cargo_code")}
                placeholder="e.g. CG-2302"
                required
              />
              <FormField
                label="Linked expedition (optional)"
                as="select"
                options={[
                  { value: "", label: "None / General station logistics" },
                  ...expeditionOptions,
                ]}
                value={form.expedition_id}
                onChange={setC("expedition_id")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label={
                  form.expedition_id ?
                    "Origin station (auto-filled)"
                    : "Origin station"
                }
                as="select"
                options={stationOptions}
                value={form.origin_station_id}
                onChange={setC("origin_station_id")}
                placeholder={
                  form.expedition_id ?
                    "Auto-assigned from expedition..."
                    : "Select origin station..."
                }
                disabled={Boolean(form.expedition_id)}
                required
              />
              <FormField
                label={
                  form.expedition_id ?
                    "Destination station (auto-filled)"
                    : "Destination station"
                }
                as="select"
                options={stationOptions}
                value={form.destination_station_id}
                onChange={setC("destination_station_id")}
                placeholder={
                  form.expedition_id ?
                    "Auto-assigned from expedition..."
                    : "Select destination station..."
                }
                disabled={Boolean(form.expedition_id)}
                required
              />
            </div>

            {form.expedition_id && (
              <div
                className="text-[11px] px-2.5 py-1.5 rounded flex items-center gap-1.5 -mt-2"
                style={{
                  background: colors.panelAlt,
                  color: colors.textMuted,
                  border: `1px solid ${colors.borderSoft}`,
                }}
              >
                <ArrowRight size={11} style={{ color: colors.aurora }} />
                <span>
                  Origin & destination automatically aligned and locked to
                  linked expedition route.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Priority"
                as="select"
                options={priorityOptions}
                value={form.priority}
                onChange={setC("priority")}
                required
              />
              <FormField
                label="Status"
                as="select"
                options={cargoStatusOptions}
                value={form.status}
                onChange={setC("status")}
                required
              />
            </div>

            <FormField
              label="Cargo notes / description"
              as="textarea"
              value={form.notes}
              onChange={setC("notes")}
              placeholder="e.g. Seismic sensor kits, core sample boxes..."
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm px-4 py-2 rounded cursor-pointer"
                style={{
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded cursor-pointer transition-opacity"
                style={{
                  color: colors.iceButtonText,
                  background: colors.ice,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>Create cargo</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Create Logistics Batch */}
      {batchModalOpen && (
        <Modal
          title="Create logistics batch"
          onClose={() => setBatchModalOpen(false)}
        >
          <form onSubmit={handleBatchSubmit} className="flex flex-col gap-4">
            {batchFormError && (
              <div
                className="flex items-center gap-2 p-3 rounded text-xs"
                style={{
                  background: colors.flareBg,
                  color: colors.flare,
                  border: `1px solid ${colors.flareDim}`,
                }}
              >
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{batchFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Batch code"
                value={batchForm.batch_code}
                onChange={setB("batch_code")}
                placeholder="e.g. LB-2026-001"
                required
              />
              <FormField
                label="Initial status"
                as="select"
                options={batchStatusOptions}
                value={batchForm.status}
                onChange={setB("status")}
                required
              />
            </div>

            <div>
              <FormField
                label="Assigned expedition (required)"
                as="select"
                options={expeditionOptions}
                value={batchForm.expedition_id}
                onChange={setB("expedition_id")}
                placeholder="Select linked expedition..."
                required
              />
              {selectedExpeditionForBatch ?
                <div
                  className="mt-1.5 text-[11px] px-2.5 py-1.5 rounded flex items-center gap-1.5"
                  style={{
                    background: colors.panelAlt,
                    color: colors.textMuted,
                    border: `1px solid ${colors.borderSoft}`,
                  }}
                >
                  <ArrowRight size={11} style={{ color: colors.aurora }} />
                  <span className="flex flex-col">
                    <span>
                      Route automatically aligned to:{" "}
                      <strong style={{ color: colors.text }}>
                        {selectedExpeditionForBatch.origin_station_name ||
                          "Origin Station"}
                      </strong>{" "}
                      →{" "}
                      <strong style={{ color: colors.text }}>
                        {selectedExpeditionForBatch.destination_station_name ||
                          "Destination Station"}
                      </strong>
                    </span>
                    {(selectedExpeditionForBatch.start_date ||
                      selectedExpeditionForBatch.end_date) && (
                      <span
                        className="text-[10px] mt-0.5 font-medium"
                        style={{color: colors.aurora}}
                      >
                        Dispatch & arrival dates autofilled:{" "}
                        {formatDisplayDateTime(
                          selectedExpeditionForBatch.start_date,
                        )}{" "}
                        →{" "}
                        {formatDisplayDateTime(selectedExpeditionForBatch.end_date)}
                      </span>
                    )}
                  </span>
                </div>
                : <span
                  className="text-[11px] mt-1 block"
                  style={{color: colors.textFaint}}
                >
                  The backend automatically assigns origin and destination
                  stations from this expedition.
                </span>
              }
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Planned dispatch date and time"
                type="datetime-local"
                value={batchForm.planned_dispatch_at}
                onChange={setB("planned_dispatch_at")}
                min={batchWindowStart || undefined}
                max={dispatchMaximum || undefined}
                required
              />
              <FormField
                label="Estimated arrival date and time"
                type="datetime-local"
                value={batchForm.estimated_arrival_at}
                onChange={setB("estimated_arrival_at")}
                min={arrivalMinimum || undefined}
                max={batchWindowEnd || undefined}
                required
              />
            </div>

            <FormField
              label="Batch notes (optional)"
              as="textarea"
              value={batchForm.notes}
              onChange={setB("notes")}
              placeholder="e.g. Temperature-sensitive payload, scientific equipment consignment..."
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="text-sm px-4 py-2 rounded cursor-pointer"
                style={{
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded cursor-pointer transition-opacity"
                style={{
                  color: colors.iceButtonText,
                  background: colors.ice,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                <span>Create batch</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {shipmentModalBatch && (
        <Modal
          title={`Add shipment route · ${shipmentModalBatch.batch_code}`}
          onClose={() => setShipmentModalBatch(null)}
          width={620}
        >
          <form onSubmit={handleShipmentSubmit} className="flex flex-col gap-4">
            {shipmentFormError && (
              <div className="flex items-center gap-2 p-3 rounded text-xs" style={{background: colors.flareBg, color: colors.flare, border: `1px solid ${colors.flareDim}`}}>
                <AlertCircle size={14}/><span>{shipmentFormError}</span>
              </div>
            )}
            <div className="text-xs p-3 rounded" style={{background: colors.iceBg, color: colors.textMuted, border: `1px solid ${colors.iceDim}`}}>
              This creates an independently tracked route inside the parent batch. Airlift and planned cargo will keep separate checkpoints, ETAs, and map lines.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Shipment code"
                value={shipmentForm.shipment_code}
                onChange={setShipmentField("shipment_code")}
                required
              />
              <FormField
                label="Transport mode"
                as="select"
                options={transportModeOptions}
                value={shipmentForm.transport_mode}
                onChange={setShipmentField("transport_mode")}
                required
              />
              <FormField
                label="Priority"
                as="select"
                options={priorityOptions}
                value={shipmentForm.priority}
                onChange={setShipmentField("priority")}
                required
              />
              <FormField
                label="Initial status"
                as="select"
                options={batchStatusOptions}
                value={shipmentForm.status}
                onChange={setShipmentField("status")}
                required
              />
              <FormField
                label="Dispatch date and time"
                type="datetime-local"
                value={shipmentForm.planned_dispatch_at}
                onChange={setShipmentField("planned_dispatch_at")}
                min={shipmentWindowStart || undefined}
                max={shipmentForm.estimated_arrival_at || shipmentWindowEnd || undefined}
                required
              />
              <FormField
                label="Estimated arrival date and time"
                type="datetime-local"
                value={shipmentForm.estimated_arrival_at}
                onChange={setShipmentField("estimated_arrival_at")}
                min={shipmentForm.planned_dispatch_at || shipmentWindowStart || undefined}
                max={shipmentWindowEnd || undefined}
                required
              />
            </div>
            <FormField
              label="Route notes"
              as="textarea"
              value={shipmentForm.notes}
              onChange={setShipmentField("notes")}
              placeholder="e.g. Urgent medical crates airlifted ahead of the surface convoy"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShipmentModalBatch(null)} className="text-sm px-4 py-2 rounded cursor-pointer" style={{color: colors.textMuted, border: `1px solid ${colors.border}`}}>Cancel</button>
              <button type="submit" disabled={submitting} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded cursor-pointer" style={{color: colors.iceButtonText, background: colors.ice, opacity: submitting ? 0.7 : 1}}>
                {submitting && <Loader2 size={14} className="animate-spin"/>}
                Create shipment route
              </button>
            </div>
          </form>
        </Modal>
      )}

      {splitCargoSource && (
        <Modal
          title={`Split cargo manifest · ${splitCargoSource.cargo_code || splitCargoSource.id}`}
          onClose={() => setSplitCargoSource(null)}
          width={680}
        >
          <form onSubmit={handleSplitSubmit} className="flex flex-col gap-4">
            {splitFormError && (
              <div className="flex items-center gap-2 p-3 rounded text-xs" style={{background: colors.flareBg, color: colors.flare, border: `1px solid ${colors.flareDim}`}}>
                <AlertCircle size={14}/><span>{splitFormError}</span>
              </div>
            )}
            <div className="text-xs p-3 rounded" style={{background: colors.amberBg, color: colors.textMuted, border: `1px solid ${colors.amberDim}`}}>
              The selected quantities will move into a new QR-tracked cargo manifest. The remaining quantities stay on the original route.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="New cargo code"
                value={splitForm.new_cargo_code}
                onChange={setSplitField("new_cargo_code")}
                required
              />
              <FormField
                label="Destination shipment route"
                as="select"
                options={(splitCargoSource.availableRoutes || []).map((route) => ({
                  value: route.id,
                  label: `${route.shipment_code} · ${route.transport_mode || "route"} · ${route.priority || "standard"}`,
                }))}
                value={splitForm.shipment_id}
                onChange={setSplitField("shipment_id")}
                placeholder="Select route..."
                required
              />
              <FormField
                label="Priority"
                as="select"
                options={priorityOptions}
                value={splitForm.priority}
                onChange={setSplitField("priority")}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold" style={{color: colors.text}}>Quantities to move</div>
              {splitLoading ? (
                <div className="flex items-center gap-2 text-xs p-4" style={{color: colors.textMuted}}><Loader2 size={14} className="animate-spin"/> Loading manifest...</div>
              ) : splitForm.items.length === 0 ? (
                <div className="text-xs p-3 rounded" style={{color: colors.textMuted, border: `1px dashed ${colors.borderSoft}`}}>
                  This cargo has no item quantities available to split.
                </div>
              ) : splitForm.items.map((item) => (
                <div key={item.item_id} className="grid grid-cols-[1fr_140px] gap-3 items-center px-3 py-2 rounded" style={{background: colors.panelAlt, border: `1px solid ${colors.borderSoft}`}}>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate" style={{color: colors.text}}>{item.item_name || item.item_id}</div>
                    <div className="text-[10px]" style={{color: colors.textMuted}}>Available: {item.available_quantity} {item.unit || "units"}</div>
                  </div>
                  <FormField
                    label="Move quantity"
                    type="number"
                    min="0"
                    max={item.available_quantity}
                    step="any"
                    value={item.quantity}
                    onChange={(value) => setSplitItemQuantity(item.item_id, value)}
                  />
                </div>
              ))}
            </div>

            <FormField
              label="Split notes"
              as="textarea"
              value={splitForm.notes}
              onChange={setSplitField("notes")}
              placeholder="Reason for the urgent partial shipment..."
            />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setSplitCargoSource(null)} className="text-sm px-4 py-2 rounded cursor-pointer" style={{color: colors.textMuted, border: `1px solid ${colors.border}`}}>Cancel</button>
              <button type="submit" disabled={submitting || splitLoading || splitForm.items.length === 0} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded cursor-pointer" style={{color: colors.iceButtonText, background: colors.ice, opacity: submitting || splitLoading ? 0.7 : 1}}>
                {submitting && <Loader2 size={14} className="animate-spin"/>}
                Create split cargo
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Cargo QR Generated / View */}
      {qrModalOpen && (
        <CargoQrModal
          isOpen={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          cargo={qrModalCargo}
          isNewlyCreated={isNewlyCreatedQr}
        />
      )}
    </div>
  );
};

export default Cargo;
