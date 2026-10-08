function padDateTimePart(value) {
  return String(value).padStart(2, "0");
}

export function toDateTimeLocalValue(value) {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    padDateTimePart(date.getMonth() + 1),
    padDateTimePart(date.getDate()),
  ].join("-") + `T${padDateTimePart(date.getHours())}:${padDateTimePart(date.getMinutes())}`;
}

export function toUtcISOString(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function formatDisplayDateTime(value, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
