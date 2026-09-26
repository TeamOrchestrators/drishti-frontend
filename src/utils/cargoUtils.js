export const priorityOptions = [
  {value: "standard", label: "Standard"},
  {value: "high", label: "High"},
  {value: "critical", label: "Critical"},
];

export const cargoStatusOptions = [
  {value: "draft", label: "Draft"},
  {value: "packed", label: "Packed"},
  {value: "dispatched", label: "Dispatched"},
  {value: "in_transit", label: "In Transit"},
  {value: "received", label: "Received"},
  {value: "delayed", label: "Delayed"},
  {value: "cancelled", label: "Cancelled"},
];

export const eventTypeOptions = [
  {value: "scanned", label: "Scanned (Checkpoint)"},
  {value: "created", label: "Created"},
  {value: "packed", label: "Packed"},
  {value: "dispatched", label: "Dispatched"},
  {value: "received", label: "Received"},
  {value: "damaged", label: "Damaged"},
  {value: "missing", label: "Missing"},
];

export function cargoStatusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "draft") return "muted";
  if (s === "packed") return "amber";
  if (s === "dispatched" || s === "in_transit") return "ice";
  if (s === "received") return "aurora";
  if (s === "delayed") return "flare";
  if (s === "cancelled") return "muted";
  return "ice";
}

export function priorityTone(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "critical") return "flare";
  if (p === "high") return "amber";
  return "muted";
}

export function eventTypeTone(eventType) {
  const e = String(eventType || "").toLowerCase();
  if (e === "received") return "aurora";
  if (e === "dispatched" || e === "in_transit" || e === "scanned") return "ice";
  if (e === "packed" || e === "created") return "amber";
  if (e === "damaged" || e === "missing") return "flare";
  return "muted";
}

export function formatStatus(status) {
  if (!status) return "—";
  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPriority(priority) {
  if (!priority) return "Standard";
  return String(priority).charAt(0).toUpperCase() + String(priority).slice(1);
}

export function formatEventType(eventType) {
  if (!eventType) return "Scanned";
  return String(eventType)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDateTime(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function batchStatusTone(status) {
  const s = String(status || "").toLowerCase().trim();
  if (s === "draft") return "muted";
  if (s === "planned" || s === "packed") return "amber";
  if (s === "dispatched" || s === "in_transit") return "ice";
  if (s === "received") return "aurora";
  if (s === "delayed") return "flare";
  if (s === "cancelled") return "muted";
  return "ice";
}

/**
 * Robust matching between a cargo item and a logistics batch.
 * Handles match by batch_code or batch id, case-insensitively with whitespace trimmed.
 */
export function matchCargoToBatch(cargoItem, batch) {
  if (!cargoItem || !batch) return false;

  const cargoBatchCode = String(
    cargoItem.logistics_batch_code || cargoItem.batch_code || ""
  ).trim().toLowerCase();
  const batchCode = String(
    batch.batch_code || batch.code || ""
  ).trim().toLowerCase();

  if (cargoBatchCode && batchCode && cargoBatchCode === batchCode) {
    return true;
  }

  const cargoBatchId = String(
    cargoItem.logistics_batch_id || cargoItem.batch_id || ""
  ).trim().toLowerCase();
  const batchId = String(batch.id || "").trim().toLowerCase();

  if (cargoBatchId && batchId && cargoBatchId === batchId) {
    return true;
  }

  return false;
}

const statusRank = {
  cancelled: -1,
  draft: 0,
  planned: 1,
  packed: 2,
  dispatched: 3,
  in_transit: 4,
  received: 5,
};

/**
 * Resolves the effective status of a logistics batch based on:
 * - Its raw database status
 * - The actual status of all cargo items assigned to it (e.g. dispatched, in_transit, received)
 * - Tracking checkpoints and events (e.g. GPS scans, dispatched checkpoints)
 */
export function resolveBatchStatus(batch, cargoList = [], tracking = null) {
  if (!batch) return "planned";
  const rawStatus = String(batch.raw_status || batch.status || "").toLowerCase().trim();
  if (rawStatus === "cancelled") return "cancelled";

  const assigned = Array.isArray(cargoList)
    ? cargoList.filter((c) => matchCargoToBatch(c, batch))
    : [];

  const checkpoints = Array.isArray(tracking?.checkpoints) ? tracking.checkpoints : [];
  const hasDispatchedCp = checkpoints.some((cp) => {
    const et = String(cp.event_type || "").toLowerCase().trim();
    return et === "dispatched";
  });
  const hasTransitCp = checkpoints.some((cp) => {
    const et = String(cp.event_type || "").toLowerCase().trim();
    return et === "in_transit" || et === "transit" || (et === "scanned" && cp.latitude != null);
  });
  const hasReceivedCp = checkpoints.some((cp) => {
    const et = String(cp.event_type || "").toLowerCase().trim();
    return et === "received";
  });

  let derived = null;

  if (assigned.length > 0) {
    const statuses = assigned.map((c) => String(c.status || "").toLowerCase().trim());

    if (statuses.every((s) => s === "received")) {
      derived = "received";
    } else if (
      statuses.some((s) => s === "in_transit") ||
      (hasTransitCp && statuses.some((s) => s === "dispatched" || s === "in_transit"))
    ) {
      derived = "in_transit";
    } else if (
      statuses.some((s) => s === "dispatched") ||
      hasDispatchedCp
    ) {
      derived = "dispatched";
    } else if (statuses.every((s) => s === "packed")) {
      derived = "packed";
    } else if (
      statuses.some((s) => s === "packed") &&
      (rawStatus === "draft" || rawStatus === "planned" || !rawStatus)
    ) {
      derived = "packed";
    } else if (
      statuses.some((s) => s === "delayed") &&
      rawStatus !== "dispatched" &&
      rawStatus !== "in_transit"
    ) {
      derived = "delayed";
    }
  } else {
    if (hasReceivedCp) derived = "received";
    else if (hasTransitCp) derived = "in_transit";
    else if (hasDispatchedCp) derived = "dispatched";
  }

  if (!derived) return rawStatus || "planned";

  if (rawStatus === "cancelled" || rawStatus === "delayed") return rawStatus;

  const rawRank = statusRank[rawStatus] ?? 0;
  const derivedRank = statusRank[derived] ?? 0;

  return derivedRank >= rawRank ? derived : rawStatus;
}
