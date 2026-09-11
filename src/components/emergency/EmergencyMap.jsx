import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { AlertCircle, RefreshCw, Radio, MapPin } from "lucide-react";
import { colors, mono } from "../../theme";

// Configure Web Worker for Vite bundler
if (typeof window !== "undefined" && maplibregl.setWorkerUrl && maplibreWorkerUrl) {
  try {
    maplibregl.setWorkerUrl(maplibreWorkerUrl);
  } catch (err) {
    console.warn("Could not set MapLibre workerUrl:", err);
  }
}

// Standard OpenFreeMap liberty vector style (completely free, no API key required)
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Creates a GeoJSON Polygon approximating a geodesic circle on Earth
 * using spherical trigonometry.
 *
 * @param {[number, number]} center [longitude, latitude]
 * @param {number} radiusInMeters Radius in meters
 * @param {number} points Number of polygon vertices (default 64)
 */
function createGeoJSONCircle(center, radiusInMeters, points = 64) {
  const [lng, lat] = center;
  const coordinates = [];
  const earthRadius = 6378137; // WGS84 equatorial radius in meters
  const dByR = radiusInMeters / earthRadius;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points;
    const pointLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(dByR) +
        Math.cos(latRad) * Math.sin(dByR) * Math.cos(bearing)
    );
    const pointLngRad =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(dByR) * Math.cos(latRad),
        Math.cos(dByR) - Math.sin(latRad) * Math.sin(pointLatRad)
      );
    coordinates.push([
      (pointLngRad * 180) / Math.PI,
      (pointLatRad * 180) / Math.PI,
    ]);
  }

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
    properties: {},
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

export default function EmergencyMap({ emergency }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const rawLat = Number(emergency?.latitude);
  const rawLng = Number(emergency?.longitude);
  const isValidCoords =
    !isNaN(rawLat) &&
    !isNaN(rawLng) &&
    rawLat >= -90 &&
    rawLat <= 90 &&
    rawLng >= -180 &&
    rawLng <= 180 &&
    !(rawLat === 0 && rawLng === 0);

  const accuracyMeters =
    emergency?.location_accuracy_m != null &&
    !isNaN(Number(emergency.location_accuracy_m)) &&
    Number(emergency.location_accuracy_m) > 0
      ? Number(emergency.location_accuracy_m)
      : 15; // default reasonable fallback radius if missing

  const handleRetry = useCallback(() => {
    setHasError(false);
    setErrorMessage("");
    setMapLoaded(false);
    setRetryCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isValidCoords || !mapContainerRef.current) return;

    let map = null;
    let resizeObserver = null;

    try {
      // Initialize MapLibre GL instance
      // Longitude MUST always come first in center: [lng, lat]
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: OPENFREEMAP_STYLE,
        center: [rawLng, rawLat],
        zoom: 13,
        attributionControl: true,
      });
      mapInstanceRef.current = map;

      // Add navigation controls (zoom in/out, compass reset)
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: false,
        }),
        "top-right"
      );

      // Add fullscreen control
      map.addControl(new maplibregl.FullscreenControl(), "top-right");

      // Handle map error gracefully
      map.on("error", (e) => {
        const msg = e?.error?.message || "";
        if (
          msg.includes("WebGL") ||
          msg.includes("Failed to fetch") ||
          msg.includes("NetworkError")
        ) {
          setHasError(true);
          setErrorMessage(
            msg.includes("WebGL")
              ? "WebGL is not supported or enabled in your browser."
              : "Could not connect to OpenFreeMap tile service. Please check network connectivity."
          );
        }
      });

      // Construct popup content
      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; line-height: 1.45; color: #0f172a; min-width: 220px; max-width: 290px; padding: 2px;">
          <div style="font-weight: 700; color: #dc2626; font-size: 13px; margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <span style="font-family: monospace; font-size: 12px; font-weight: 800; letter-spacing: 0.02em;">${escapeHtml(
              emergency.emergency_code || emergency.id || "INCIDENT"
            )}</span>
            <span style="font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: #fee2e2; color: #991b1b; text-transform: uppercase;">
              ${escapeHtml(emergency.status || "Active")}
            </span>
          </div>
          <div style="font-weight: 600; color: #1e293b; margin-bottom: 6px; font-size: 12px;">
            ${escapeHtml(emergency.summary || emergency.emergency_type || "Emergency incident")}
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; display: grid; gap: 4px; font-size: 11px;">
            <div>
              <span style="color: #64748b;">Reporting Personnel:</span>
              <strong style="color: #0f172a; margin-left: 4px;">${escapeHtml(
                emergency.reported_by_name || "Unassigned"
              )}</strong>
            </div>
            <div>
              <span style="color: #64748b;">Device Label:</span>
              <code style="font-family: monospace; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 10.5px; color: #334155; margin-left: 4px;">${escapeHtml(
                emergency.device_label || "—"
              )}</code>
            </div>
            <div>
              <span style="color: #64748b;">Coordinates:</span>
              <code style="font-family: monospace; font-size: 10.5px; margin-left: 4px; color: #0284c7;">${rawLat.toFixed(
                6
              )}°, ${rawLng.toFixed(6)}°</code>
            </div>
            <div>
              <span style="color: #64748b;">GPS Accuracy:</span>
              <span style="font-weight: 600; color: #0f172a; margin-left: 4px;">±${accuracyMeters} m</span>
            </div>
            <div>
              <span style="color: #64748b;">Last Heartbeat:</span>
              <span style="color: #334155; margin-left: 4px;">${formatTimestamp(
                emergency.last_heartbeat_at
              )}</span>
            </div>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({
        offset: [0, -10],
        closeButton: true,
        closeOnClick: false,
        maxWidth: "320px",
      }).setHTML(popupHtml);

      // Create custom pulsing red marker element
      const markerEl = document.createElement("div");
      markerEl.className = "emergency-pulse-marker";
      markerEl.setAttribute(
        "title",
        `Emergency Location: ${emergency.emergency_code || "Incident"}`
      );
      markerEl.innerHTML = `
        <div class="marker-pulse-ring"></div>
        <div class="marker-pulse-ring-inner"></div>
        <div class="marker-center-dot"></div>
      `;

      const marker = new maplibregl.Marker({
        element: markerEl,
        anchor: "center",
      })
        .setLngLat([rawLng, rawLat])
        .setPopup(popup)
        .addTo(map);

      // Once map loads style, add accuracy circle
      map.on("load", () => {
        setMapLoaded(true);

        // Add translucent red accuracy circle GeoJSON polygon
        const circleData = createGeoJSONCircle(
          [rawLng, rawLat],
          accuracyMeters,
          64
        );

        if (!map.getSource("emergency-accuracy-circle")) {
          map.addSource("emergency-accuracy-circle", {
            type: "geojson",
            data: circleData,
          });

          map.addLayer({
            id: "emergency-accuracy-circle-fill",
            type: "fill",
            source: "emergency-accuracy-circle",
            paint: {
              "fill-color": "#ef4444",
              "fill-opacity": 0.18,
            },
          });

          map.addLayer({
            id: "emergency-accuracy-circle-stroke",
            type: "line",
            source: "emergency-accuracy-circle",
            paint: {
              "line-color": "#dc2626",
              "line-width": 1.75,
              "line-opacity": 0.7,
              "line-dasharray": [2, 1],
            },
          });
        }
      });

      // Observe container resize to trigger map.resize() smoothly
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);

      // Ensure canvas is properly sized after DOM expansion
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      }, 150);
    } catch (err) {
      console.error("Map initialization failure:", err);
      setHasError(true);
      setErrorMessage(err.message || "Failed to initialize map engine.");
    }

    // Comprehensive cleanup when component unmounts or card closes
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore cleanup errors during teardown
        }
        mapInstanceRef.current = null;
      }
    };
  }, [isValidCoords, rawLat, rawLng, accuracyMeters, retryCount, emergency]);

  if (!isValidCoords) {
    return (
      <div
        className="rounded-lg p-3 text-xs flex items-center gap-2"
        style={{
          background: colors.panelAlt,
          color: colors.textMuted,
          border: `1px solid ${colors.border}`,
        }}
      >
        <AlertCircle size={14} style={{ color: colors.amber }} />
        <span>Valid GPS coordinates are not available for this emergency incident.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Pulse Marker & Map popup CSS */}
      <style>{`
        .emergency-pulse-marker {
          position: relative;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .marker-pulse-ring {
          position: absolute;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.45);
          animation: marker-pulse-anim 1.8s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        }
        .marker-pulse-ring-inner {
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.35);
          animation: marker-pulse-anim 1.8s cubic-bezier(0.25, 1, 0.5, 1) infinite 0.4s;
        }
        .marker-center-dot {
          position: relative;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ef4444;
          border: 2.5px solid #ffffff;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.95), 0 2px 4px rgba(0, 0, 0, 0.35);
          z-index: 2;
        }
        @keyframes marker-pulse-anim {
          0% {
            transform: scale(0.35);
            opacity: 0.95;
          }
          70% {
            transform: scale(2.2);
            opacity: 0;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .maplibregl-popup-content {
          border-radius: 8px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
          padding: 10px 12px !important;
        }
      `}</style>

      {/* Map Canvas Container */}
      <div
        className="w-full h-[260px] sm:h-[320px] rounded-lg overflow-hidden relative"
        style={{
          border: `1px solid ${colors.border}`,
          background: colors.bgRaised,
        }}
      >
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Inline Error Notice */}
        {hasError && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center gap-2 backdrop-blur-sm"
            style={{
              background: "rgba(15, 23, 42, 0.85)",
              color: colors.text,
            }}
          >
            <AlertCircle size={24} style={{ color: colors.flare }} />
            <div className="text-sm font-semibold" style={{ color: colors.flare }}>
              Map display unavailable
            </div>
            <div className="text-xs max-w-sm" style={{ color: colors.textMuted }}>
              {errorMessage || "Unable to load map tiles. Please check your internet connection."}
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-1 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded cursor-pointer transition-opacity hover:opacity-85"
              style={{
                background: colors.panelAlt,
                color: colors.text,
                border: `1px solid ${colors.border}`,
              }}
            >
              <RefreshCw size={12} />
              <span>Retry map</span>
            </button>
          </div>
        )}

        {/* Loading Spinner overlay before style is ready */}
        {!mapLoaded && !hasError && (
          <div
            className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs backdrop-blur-md shadow-sm"
            style={{
              background: "rgba(15, 23, 42, 0.75)",
              color: colors.textMuted,
              border: `1px solid ${colors.borderSoft}`,
            }}
          >
            <RefreshCw size={11} className="animate-spin" style={{ color: colors.ice }} />
            <span style={{ fontSize: "11px" }}>Loading map...</span>
          </div>
        )}
      </div>

      {/* Required Subtitle & Telemetry Notice */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] px-0.5"
        style={{ color: colors.textFaint }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Radio size={12} className="flex-shrink-0" style={{ color: colors.ice }} />
          <span className="truncate">Location from last HTTP device heartbeat</span>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
          {emergency.location_accuracy_m != null && (
            <span>
              Accuracy radius:{" "}
              <strong style={{ color: colors.text, ...mono }}>
                ±{emergency.location_accuracy_m} m
              </strong>
            </span>
          )}
          <span style={{ ...mono, color: colors.textMuted }}>
            {rawLat.toFixed(6)}°, {rawLng.toFixed(6)}°
          </span>
        </div>
      </div>
    </div>
  );
}
