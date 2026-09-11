import { useEffect, useState } from "react";
import { Plus, MapPin, Pencil, Calendar, AlertCircle, RefreshCw, Compass } from "lucide-react";
import Panel from "../ui/Panel";
import Pill from "../ui/Pill";
import SectionHeading from "../ui/SectionHeading";
import FormField from "../ui/Formfield.jsx";
import Modal from "../ui/Modal.jsx";
import { CardSkeleton } from "../ui/Skeleton.jsx";
import { colors, mono } from "../../theme.js";
import { useExpeditionStore } from "../../store/useExpeditionStore.js";

const statusOptions = [
  "Draft",
  "Planned",
  "Ready",
  "Active",
  "Sheltered",
  "Completed",
  "Cancelled",
];

const statusTone = {
  Active: "ice",
  Draft: "amber",
  Planned: "amber",
  Ready: "amber",
  Sheltered: "flare",
  Cancelled: "muted",
  Completed: "aurora",
};

const getTone = (status) => {
  if (!status) return "ice";
  const normalized = String(status).trim().toLowerCase();
  for (const [key, tone] of Object.entries(statusTone)) {
    if (key.toLowerCase() === normalized) return tone;
  }
  return "ice";
};

const emptyForm = {
  expedition_code: "",
  name: "",
  purpose: "",
  origin_station_id: "",
  destination_station_id: "",
  start_date: "",
  end_date: "",
  team_leader_id: "",
  status: "",
};

function formatDisplayDate(d) {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function formatDateInput(d) {
  if (!d) return "";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function computeTimeline(startDate, endDate) {
  if (!startDate) return "—";
  try {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    const now = new Date();
    if (isNaN(start.getTime())) return "—";

    if (now < start) {
      const daysUntil = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
      return `Starts in ${daysUntil}d`;
    }
    const daysElapsed = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1);
    if (end && !isNaN(end.getTime())) {
      const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      return `Day ${daysElapsed} of ${totalDays}`;
    }
    return `Day ${daysElapsed}`;
  } catch {
    return "—";
  }
}

const Expedition = () => {
  const {
    expeditions,
    stations: apiStations,
    personnel: apiPersonnel,
    loading,
    submitting,
    error,
    initialized,
    fetchExpeditions,
    createExpedition,
    updateExpedition,
  } = useExpeditionStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    fetchExpeditions();
  }, [fetchExpeditions]);

  // Use live form options from API
  const stationOptions = apiStations.map((s) => ({
    value: s.id,
    label: `${s.name}${s.code ? ` (${s.code})` : ""}`,
  }));

  const personnelOptions = apiPersonnel.map((p) => ({
    value: p.id,
    label: `${p.full_name} (${p.role || p.personnel_code || "Personnel"})`,
  }));

  const resolveStationName = (id) => {
    if (!id) return "—";
    const found = apiStations.find((s) => s.id === id);
    return found ? found.name : id;
  };

  const resolveLeaderName = (leaderId, fallbackLead) => {
    if (fallbackLead) return fallbackLead;
    if (!leaderId) return "Unassigned";
    const found = apiPersonnel.find((p) => p.id === leaderId);
    return found ? found.full_name : "Unassigned";
  };

  const set = (key) => (value) => {
    setForm((f) => ({
      ...f,
      [key]: value,
    }));
  };

  // Open creation modal with completely blank fields — user selects everything manually
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(exp) {
    setEditingId(exp.id);
    const matchedOrigin = exp.origin_station_id || apiStations.find(s => s.name === exp.origin_station_name)?.id || "";
    const matchedDest = exp.destination_station_id || apiStations.find(s => s.name === exp.destination_station_name)?.id || "";
    const matchedLeader = exp.team_leader_id || apiPersonnel.find(p => p.full_name === exp.team_lead_name)?.id || "";

    const currentStatus = exp.status ? String(exp.status) : "";
    const foundStatus = statusOptions.find(
      (opt) => opt.toLowerCase() === currentStatus.toLowerCase()
    ) || "";

    setForm({
      expedition_code: exp.expedition_code || exp.id || "",
      name: exp.expedition_name || exp.name || "",
      purpose: exp.purpose || "",
      origin_station_id: matchedOrigin,
      destination_station_id: matchedDest,
      start_date: formatDateInput(exp.start_date || exp.startDate),
      end_date: formatDateInput(exp.end_date || exp.endDate),
      team_leader_id: matchedLeader,
      status: foundStatus,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!form.expedition_code.trim()) {
      setFormError("Please enter an expedition code.");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Please enter an expedition name.");
      return;
    }
    if (!form.origin_station_id) {
      setFormError("Please select an origin station.");
      return;
    }
    if (!form.destination_station_id) {
      setFormError("Please select a destination station.");
      return;
    }
    if (!form.start_date) {
      setFormError("Please select a start date.");
      return;
    }
    if (!form.end_date) {
      setFormError("Please select an end date.");
      return;
    }
    if (!form.team_leader_id) {
      setFormError("Please select a team leader.");
      return;
    }
    if (!form.status) {
      setFormError("Please select a status.");
      return;
    }

    const payload = {
      expedition_code: form.expedition_code.trim(),
      name: form.name.trim(),
      expedition_name: form.name.trim(),
      purpose: form.purpose.trim(),
      origin_station_id: form.origin_station_id,
      destination_station_id: form.destination_station_id,
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      team_leader_id: form.team_leader_id,
      status: form.status,
    };

    try {
      if (editingId) {
        await updateExpedition(editingId, payload);
      } else {
        await createExpedition(payload);
      }
      setModalOpen(false);
      setForm(emptyForm);
    } catch (err) {
      setFormError(err.message || "Failed to submit expedition");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchExpeditions}
              disabled={loading}
              title="Refresh expeditions"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded cursor-pointer transition-opacity hover:opacity-90"
              style={{ color: colors.iceButtonText, background: colors.ice }}
            >
              <Plus size={15} /> New expedition
            </button>
          </div>
        }
      >
        Expedition planning
      </SectionHeading>

      {/* Error alert if any */}
      {error && (
        <div
          className="rounded-lg p-4 flex items-center justify-between gap-3 text-sm"
          style={{ background: colors.flareBg, border: `1px solid ${colors.flareDim}`, color: colors.flare }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchExpeditions}
            className="text-xs px-2.5 py-1 rounded font-medium cursor-pointer"
            style={{ background: colors.flareDim, color: colors.flare }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state with CardSkeleton */}
      {(loading && !initialized) || (loading && expeditions.length === 0) ? (
        <CardSkeleton count={3} />
      ) : expeditions.length === 0 ? (
        /* Empty state */
        <div
          className="rounded-lg p-12 flex flex-col items-center justify-center gap-3 text-center"
          style={{ background: colors.panel, border: `1px solid ${colors.border}` }}
        >
          <Compass size={36} style={{ color: colors.textFaint }} />
          <div>
            <div className="text-base font-semibold mb-1" style={{ color: colors.text }}>
              No expeditions yet
            </div>
            <div className="text-xs max-w-sm" style={{ color: colors.textMuted }}>
              Start by scheduling your first polar crossing or research journey.
            </div>
          </div>
          <button
            onClick={openCreate}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded cursor-pointer"
            style={{ color: colors.iceButtonText, background: colors.ice }}
          >
            <Plus size={14} /> Create first expedition
          </button>
        </div>
      ) : (
        /* Expeditions list */
        <div className="flex flex-col gap-4">
          {expeditions.map((e) => {
            const expId = e.expedition_code || e.id;
            const expName = e.expedition_name || e.name || "Untitled Expedition";
            const route =
              e.origin_station_name && e.destination_station_name
                ? `${e.origin_station_name} → ${e.destination_station_name}`
                : e.route ||
                  (e.origin_station_id || e.destination_station_id
                    ? `${resolveStationName(e.origin_station_id)} → ${resolveStationName(e.destination_station_id)}`
                    : "Station Route Unspecified");

            const leadName = e.team_lead_name || resolveLeaderName(e.team_leader_id, e.lead);
            const crewCount = e.crew_assigned ?? e.crew ?? 0;
            const startDate = e.start_date || e.startDate;
            const endDate = e.end_date || e.endDate;
            const startDateFormatted = formatDisplayDate(startDate);
            const endDateFormatted = formatDisplayDate(endDate);
            const timeline = e.day || computeTimeline(startDate, endDate);
            const tone = e.tone || getTone(e.status);
            const displayStatus = e.status
              ? e.status.charAt(0).toUpperCase() + e.status.slice(1)
              : "Planned";

            return (
              <Panel key={e.id || expId} style={{ padding: 0 }}>
                <div className="p-4 sm:p-5 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-base font-semibold" style={{ color: colors.text }}>
                          {expName}
                        </span>
                        <span className="text-xs" style={{ color: colors.textFaint, ...mono }}>
                          {expId}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: colors.textMuted }}>
                        <MapPin size={13} className="flex-shrink-0" /> {route}
                      </div>
                      {e.purpose && (
                        <div className="text-sm mt-1.5" style={{ color: colors.textMuted }}>
                          {e.purpose}
                        </div>
                      )}
                      {(startDateFormatted || endDateFormatted) && (
                        <div
                          className="flex items-center gap-1.5 text-xs mt-1.5"
                          style={{ color: colors.textFaint, ...mono }}
                        >
                          <Calendar size={12} className="flex-shrink-0" /> {startDateFormatted || "—"} →{" "}
                          {endDateFormatted || "—"}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
                      <Pill tone={tone}>{displayStatus}</Pill>
                      <button
                        onClick={() => openEdit(e)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-80"
                        style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </div>
                  </div>

                  {e.note && (
                    <div
                      className="text-xs px-3 py-2 rounded"
                      style={{
                        background: colors.flareBg,
                        color: colors.flare,
                        border: `1px solid ${colors.flareDim}`,
                      }}
                    >
                      {e.note}
                    </div>
                  )}

                  {e.resources && e.resources.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {e.resources.map((r) => (
                        <span
                          key={r}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: colors.panelAlt,
                            color: colors.textMuted,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}

                  <div
                    className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3"
                    style={{ borderTop: `1px solid ${colors.borderSoft}` }}
                  >
                    <div>
                      <div className="text-xs mb-1" style={{ color: colors.textFaint }}>
                        Team lead
                      </div>
                      <div className="text-sm font-medium" style={{ color: colors.text }}>
                        {leadName}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: colors.textFaint }}>
                        Crew assigned
                      </div>
                      <div className="text-sm font-medium" style={{ color: colors.text, ...mono }}>
                        {crewCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: colors.textFaint }}>
                        Timeline
                      </div>
                      <div className="text-sm font-medium" style={{ color: colors.text, ...mono }}>
                        {timeline}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <Modal
          title={editingId ? "Edit expedition" : "Create expedition"}
          onClose={() => setModalOpen(false)}
          width={520}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {formError && (
              <div
                className="text-xs p-2.5 rounded flex items-center gap-1.5"
                style={{ background: colors.flareBg, color: colors.flare, border: `1px solid ${colors.flareDim}` }}
              >
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Expedition code"
                value={form.expedition_code}
                onChange={set("expedition_code")}
                placeholder="e.g. EXP-8821"
                required
              />
              <FormField
                label="Expedition name"
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. Queen Maud Land Crossing"
                required
              />
            </div>

            <FormField
              label="Purpose"
              as="textarea"
              value={form.purpose}
              onChange={set("purpose")}
              placeholder="Primary scientific or logistical objective..."
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Origin station"
                as="select"
                options={stationOptions}
                value={form.origin_station_id}
                onChange={set("origin_station_id")}
                placeholder="Select origin station..."
                required
              />
              <FormField
                label="Destination station"
                as="select"
                options={stationOptions}
                value={form.destination_station_id}
                onChange={set("destination_station_id")}
                placeholder="Select destination station..."
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Start date"
                type="date"
                value={form.start_date}
                onChange={set("start_date")}
                required
              />
              <FormField
                label="End date"
                type="date"
                value={form.end_date}
                onChange={set("end_date")}
                required
              />
            </div>

            <FormField
              label="Team leader"
              as="select"
              options={personnelOptions}
              value={form.team_leader_id}
              onChange={set("team_leader_id")}
              placeholder="Select team leader..."
              required
            />

            <FormField
              label="Status"
              as="select"
              options={statusOptions}
              value={form.status}
              onChange={set("status")}
              placeholder="Select status..."
              required
            />

            <div className="flex justify-end gap-3 pt-3" style={{ borderTop: `1px solid ${colors.borderSoft}` }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm px-4 py-2 rounded cursor-pointer"
                style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-sm font-medium px-4 py-2 rounded cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                style={{ color: colors.iceButtonText, background: colors.ice }}
              >
                {submitting && <RefreshCw size={13} className="animate-spin" />}
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
