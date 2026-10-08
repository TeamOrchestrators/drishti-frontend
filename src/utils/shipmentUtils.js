export const transportModeOptions = [
  {value: "air", label: "Air lift"},
  {value: "sea", label: "Sea freight"},
  {value: "road", label: "Road convoy"},
  {value: "traverse", label: "Polar traverse"},
  {value: "rail", label: "Rail freight"},
  {value: "other", label: "Other"},
];

const routePalette = ["#0284C7", "#F97316", "#8B5CF6", "#14B8A6", "#EAB308", "#EC4899"];

export function normalizeShipmentRoutes(tracking) {
  if (!Array.isArray(tracking?.shipments)) return [];
  return tracking.shipments.map((shipment, index) => ({
    ...shipment,
    id: shipment.id || shipment.shipment_id || shipment.shipment_code || `shipment-${index + 1}`,
    shipment_code: shipment.shipment_code || shipment.code || `Route ${index + 1}`,
    checkpoints: Array.isArray(shipment.checkpoints) ? shipment.checkpoints : [],
  }));
}

export function shipmentRouteColor(shipment, index = 0) {
  const priority = String(shipment?.priority || "").toLowerCase();
  const mode = String(shipment?.transport_mode || "").toLowerCase();
  if (priority === "critical" || mode === "air") return "#F97316";
  if (mode === "sea") return "#0284C7";
  if (mode === "traverse") return "#8B5CF6";
  if (mode === "road") return "#14B8A6";
  return routePalette[index % routePalette.length];
}

export function shipmentRouteLabel(shipment) {
  const code = shipment?.shipment_code || shipment?.code || "Shipment";
  const mode = String(shipment?.transport_mode || "route").replace(/_/g, " ");
  return `${code} · ${mode}`;
}

export function shipmentMarkerPrefix(shipment, index = 0) {
  const mode = String(shipment?.transport_mode || "").toUpperCase();
  if (mode === "AIR") return "A";
  if (mode === "SEA") return "S";
  if (mode === "ROAD") return "R";
  if (mode === "TRAVERSE") return "T";
  return String(index + 1);
}

export function shipmentStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "received") return "aurora";
  if (["dispatched", "in_transit", "partially_received"].includes(normalized)) return "ice";
  if (["delayed", "cancelled"].includes(normalized)) return "flare";
  if (["packed", "planned", "partially_dispatched"].includes(normalized)) return "amber";
  return "muted";
}
