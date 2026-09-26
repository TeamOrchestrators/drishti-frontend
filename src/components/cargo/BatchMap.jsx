import {useEffect, useRef, useState, useCallback, useMemo} from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {AlertCircle, RefreshCw, MapPin, Navigation, ArrowRight} from "lucide-react";
import {colors} from "../../theme.js";
import {resolveStationCoords, isValidCoordinate, formatCoordinates} from "../../utils/geo.js";

// Configure Web Worker for Vite bundler
if (typeof window !== "undefined" && maplibregl.setWorkerUrl && maplibreWorkerUrl) {
  try {
    maplibregl.setWorkerUrl(maplibreWorkerUrl);
  } catch (err) {
    console.warn("Could not set MapLibre workerUrl in BatchMap:", err);
  }
}

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function BatchMap({
                                   batch,
                                   cargo,
                                   cargoList = [],
                                   checkpoints = [],
                                   stations = [],
                                   height = "320px",
                                   title,
                                 }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // Extract Route Metadata
  const originName = batch?.origin_station_name || cargo?.origin_station_name || "";
  const destName = batch?.destination_station_name || cargo?.destination_station_name || "";
  const batchCode = batch?.batch_code || cargo?.logistics_batch_code || "";

  // Resolve Station Coordinates
  const originCoords = resolveStationCoords(originName, stations);
  const destCoords = resolveStationCoords(destName, stations);

  // Collect All Checkpoint Waypoints (must be real GPS coordinates)
  const waypoints = [];

  // 1. From batch tracking checkpoints (e.g. from /api/logistics-batches/{id}/tracking)
  const batchCheckpoints = Array.isArray(checkpoints) && checkpoints.length > 0
    ? checkpoints
    : Array.isArray(batch?.checkpoints) && batch.checkpoints.length > 0
      ? batch.checkpoints
      : [];

  batchCheckpoints.forEach((cp, idx) => {
    const lat = Number(cp.latitude);
    const lng = Number(cp.longitude);
    if (isValidCoordinate(lat, lng)) {
      waypoints.push({
        lat,
        lng,
        cargoCode: batch?.batch_code || "BATCH",
        eventType: cp.event_type || "checkpoint",
        timestamp: cp.scanned_at,
        notes: cp.notes,
        stationName: cp.station_name,
        personnelName: cp.personnel_name || cp.scanned_by_personnel_name,
        sequence: idx + 1,
        affectedCargoCount: cp.affected_cargo_count,
      });
    }
  });

  // 2. From single cargo scan_history
  if (cargo && Array.isArray(cargo.scan_history)) {
    cargo.scan_history.forEach((sh, idx) => {
      const lat = Number(sh.latitude);
      const lng = Number(sh.longitude);
      if (isValidCoordinate(lat, lng)) {
        waypoints.push({
          lat,
          lng,
          cargoCode: cargo.cargo_code || "CG",
          eventType: sh.event_type || "scanned",
          timestamp: sh.scanned_at,
          notes: sh.notes,
          stationName: sh.station_name,
          personnelName: sh.scanned_by_personnel_name,
          sequence: idx + 1,
        });
      }
    });
  }

  // 3. From cargoList assigned to batch
  if (Array.isArray(cargoList)) {
    cargoList.forEach((c) => {
      if (Array.isArray(c.scan_history)) {
        c.scan_history.forEach((sh) => {
          const lat = Number(sh.latitude);
          const lng = Number(sh.longitude);
          if (isValidCoordinate(lat, lng)) {
            const isDuplicate = waypoints.some(
              (w) => Math.abs(w.lat - lat) < 0.0001 && Math.abs(w.lng - lng) < 0.0001
            );
            if (!isDuplicate) {
              waypoints.push({
                lat,
                lng,
                cargoCode: c.cargo_code || c.id || "CG",
                eventType: sh.event_type || "scanned",
                timestamp: sh.scanned_at,
                notes: sh.notes,
                stationName: sh.station_name,
                personnelName: sh.scanned_by_personnel_name,
                sequence: waypoints.length + 1,
              });
            }
          }
        });
      }
    });
  }

  const hasRealCheckpoints = waypoints.length > 0;

  const handleRetry = useCallback(() => {
    setHasError(false);
    setErrorMessage("");
    setMapLoaded(false);
    setRetryCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || !hasRealCheckpoints) return;

    let map = null;
    let resizeObserver = null;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    try {
      // Determine default center
      let center = [76.187, -69.408]; // Default: Bharti Station
      if (originCoords) center = [originCoords.lng, originCoords.lat];
      else if (destCoords) center = [destCoords.lng, destCoords.lat];
      else if (waypoints.length > 0) center = [waypoints[0].lng, waypoints[0].lat];

      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: OPENFREEMAP_STYLE,
        center,
        zoom: 3.5,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      // Add navigation controls
      map.addControl(new maplibregl.NavigationControl({showCompass: true}), "top-right");

      map.on("error", (e) => {
        console.warn("MapLibre error in BatchMap:", e?.error?.message || e);
      });

      map.on("load", () => {
        setMapLoaded(true);

        // Gather all coordinate points for route polyline
        const routePoints = [];
        if (originCoords) routePoints.push([originCoords.lng, originCoords.lat]);
        waypoints.forEach((w) => routePoints.push([w.lng, w.lat]));
        if (destCoords) routePoints.push([destCoords.lng, destCoords.lat]);

        // Draw Route LineString if at least 2 points
        if (routePoints.length >= 2) {
          try {
            map.addSource("batch-route-line", {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: routePoints,
                },
                properties: {},
              },
            });

            // Outer glow line
            map.addLayer({
              id: "batch-route-glow",
              type: "line",
              source: "batch-route-line",
              paint: {
                "line-color": "#63C4D6",
                "line-width": 6,
                "line-opacity": 0.25,
              },
            });

            // Core dashed transit line
            map.addLayer({
              id: "batch-route-core",
              type: "line",
              source: "batch-route-line",
              paint: {
                "line-color": "#0284C7",
                "line-width": 3,
                "line-dasharray": [2, 1.5],
              },
            });
          } catch (lineErr) {
            console.warn("Could not add route line to map:", lineErr);
          }
        }

        // Add Origin Marker Pin
        if (originCoords) {
          const el = document.createElement("div");
          el.className = "batch-map-pin origin-pin";
          el.innerHTML = `
            <div style="background: #0284C7; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
              DEP
            </div>
          `;
          const popup = new maplibregl.Popup({offset: [0, -14], closeButton: true}).setHTML(`
            <div style="font-family: sans-serif; font-size: 12px; color: #0F172A; padding: 2px;">
              <strong style="color: #0284C7; text-transform: uppercase; font-size: 10px; display: block; letter-spacing: 0.5px;">Departure Origin</strong>
              <div style="font-weight: 600; font-size: 13px; margin: 2px 0;">${escapeHtml(originName || "Origin Station")}</div>
              <div style="color: #64748B; font-family: monospace; font-size: 11px;">${formatCoordinates(originCoords.lat, originCoords.lng) || ""}</div>
            </div>
          `);
          const marker = new maplibregl.Marker({element: el})
            .setLngLat([originCoords.lng, originCoords.lat])
            .setPopup(popup)
            .addTo(map);
          markersRef.current.push(marker);
        }

        // Add Destination Marker Pin
        if (destCoords) {
          const el = document.createElement("div");
          el.className = "batch-map-pin dest-pin";
          el.innerHTML = `
            <div style="background: #059669; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
              ARR
            </div>
          `;
          const popup = new maplibregl.Popup({offset: [0, -14], closeButton: true}).setHTML(`
            <div style="font-family: sans-serif; font-size: 12px; color: #0F172A; padding: 2px;">
              <strong style="color: #059669; text-transform: uppercase; font-size: 10px; display: block; letter-spacing: 0.5px;">Destination Station</strong>
              <div style="font-weight: 600; font-size: 13px; margin: 2px 0;">${escapeHtml(destName || "Destination Station")}</div>
              <div style="color: #64748B; font-family: monospace; font-size: 11px;">${formatCoordinates(destCoords.lat, destCoords.lng) || ""}</div>
            </div>
          `);
          const marker = new maplibregl.Marker({element: el})
            .setLngLat([destCoords.lng, destCoords.lat])
            .setPopup(popup)
            .addTo(map);
          markersRef.current.push(marker);
        }

        // Add Intermediate GPS Checkpoint Pins
        waypoints.forEach((wp) => {
          const el = document.createElement("div");
          el.className = "batch-map-pin waypoint-pin";
          el.innerHTML = `
            <div style="background: #D97706; color: #ffffff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 10px; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.3);">
              ${wp.sequence || "CP"}
            </div>
          `;

          const popupHtml = `
            <div style="font-family: sans-serif; font-size: 12px; color: #0F172A; min-width: 170px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 3px;">
                <span style="background: #FEF3C7; color: #B45309; font-weight: 600; font-size: 10px; padding: 1px 6px; border-radius: 4px; text-transform: uppercase;">
                  ${escapeHtml(wp.eventType)}
                </span>
                <span style="font-family: monospace; font-size: 11px; font-weight: 600; color: #0284C7;">
                  ${escapeHtml(wp.cargoCode)}
                </span>
              </div>
              <div style="font-size: 11px; color: #64748B; margin-bottom: 2px;">
                ${wp.timestamp ? new Date(wp.timestamp).toLocaleString() : ""}
              </div>
              <div style="font-family: monospace; font-size: 11px; color: #334155; margin-bottom: 4px;">
                ${formatCoordinates(wp.lat, wp.lng) || ""}
              </div>
              ${wp.personnelName ? `<div style="font-size: 11px; color: #475569;">Operator: <strong>${escapeHtml(wp.personnelName)}</strong></div>` : ""}
              ${wp.notes ? `<div style="font-size: 11px; color: #1E293B; margin-top: 3px; font-style: italic; background: #F8FAFC; padding: 4px 6px; border-radius: 4px; border: 1px solid #E2E8F0;">"${escapeHtml(wp.notes)}"</div>` : ""}
            </div>
          `;

          const popup = new maplibregl.Popup({offset: [0, -12], closeButton: true}).setHTML(popupHtml);
          const marker = new maplibregl.Marker({element: el})
            .setLngLat([wp.lng, wp.lat])
            .setPopup(popup)
            .addTo(map);
          markersRef.current.push(marker);
        });

        // Fit map bounds to encompass all points comfortably
        if (routePoints.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          routePoints.forEach((pt) => bounds.extend(pt));
          map.fitBounds(bounds, {
            padding: {top: 40, bottom: 40, left: 40, right: 40},
            maxZoom: 9,
            duration: 800,
          });
        }
      });

      // Auto-resize handler
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          if (map) map.resize();
        });
        resizeObserver.observe(mapContainerRef.current);
      }
    } catch (err) {
      console.error("BatchMap initialization failed:", err);
      setTimeout(() => {
        setHasError(true);
        setErrorMessage(err?.message || "Failed to initialize map canvas");
      }, 0);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount, hasRealCheckpoints, originName, destName, waypoints.length]);

  if (!hasRealCheckpoints) {
    return (
      <div
        className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 text-xs"
        style={{
          background: colors.panelAlt,
          color: colors.textMuted,
          border: `1px dashed ${colors.borderSoft}`,
        }}
      >
        <MapPin size={14} style={{color: colors.textFaint}} className="flex-shrink-0"/>
        <span>No GPS checkpoints recorded yet</span>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-xl overflow-hidden flex flex-col relative shadow-xs"
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Map Header Bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 text-xs"
        style={{
          background: colors.bgRaised,
          borderBottom: `1px solid ${colors.borderSoft}`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Navigation size={14} style={{color: colors.ice}} className="flex-shrink-0"/>
          <span className="font-semibold truncate" style={{color: colors.text}}>
            {title || `Batch Route Corridor ${batchCode ? `· ${batchCode}` : ""}`}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {originName && destName && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium" style={{color: colors.textMuted}}>
              <span style={{color: colors.text}}>{originName}</span>
              <ArrowRight size={12} style={{color: colors.ice}}/>
              <span style={{color: colors.text}}>{destName}</span>
            </div>
          )}
          {waypoints.length > 0 && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: colors.amberBg,
                color: colors.amber,
                border: `1px solid ${colors.amberDim}`,
              }}
            >
              {waypoints.length} GPS {waypoints.length === 1 ? "checkpoint" : "checkpoints"}
            </span>
          )}
        </div>
      </div>

      {/* Map Container Viewport */}
      <div className="w-full relative" style={{height}}>
        <div ref={mapContainerRef} className="w-full h-full"/>

        {/* Loading Spinner */}
        {!mapLoaded && !hasError && hasRealCheckpoints && (
          <div
            className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs backdrop-blur-md shadow-sm"
            style={{
              background: "rgba(15, 23, 42, 0.75)",
              color: colors.textMuted,
              border: `1px solid ${colors.borderSoft}`,
            }}
          >
            <RefreshCw size={11} className="animate-spin" style={{color: colors.ice}}/>
            <span style={{fontSize: "11px"}}>Loading route map...</span>
          </div>
        )}

        {/* Error Fallback */}
        {hasError && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center gap-2 backdrop-blur-sm"
            style={{
              background: "rgba(15, 23, 42, 0.85)",
              color: colors.text,
            }}
          >
            <AlertCircle size={24} style={{color: colors.flare}}/>
            <div className="text-sm font-semibold" style={{color: colors.flare}}>
              Map display unavailable
            </div>
            <div className="text-xs max-w-sm" style={{color: colors.textMuted}}>
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
              <RefreshCw size={12}/>
              <span>Retry map</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
