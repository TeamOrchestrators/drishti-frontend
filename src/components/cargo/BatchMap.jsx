import {useEffect, useRef, useState, useCallback, useMemo} from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {AlertCircle, RefreshCw, MapPin, Navigation, ArrowRight} from "lucide-react";
import {colors, mono} from "../../theme.js";
import {resolveStationCoords, isValidCoordinate, formatCoordinates} from "../../utils/geo.js";
import {formatEnumLabel} from "../../utils/formatLabel.js";
import {
  shipmentMarkerPrefix,
  shipmentRouteColor,
  shipmentRouteLabel,
} from "../../utils/shipmentUtils.js";

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

function routeLayerIds(routeId) {
  const safeId = String(routeId).replace(/[^a-zA-Z0-9_-]/g, "-");
  return {
    source: `batch-route-${safeId}`,
    glow: `batch-route-glow-${safeId}`,
    core: `batch-route-core-${safeId}`,
  };
}

export default function BatchMap({
                                   batch,
                                   cargo,
                                   cargoList = [],
                                   checkpoints = [],
                                   shipments = [],
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
  const [hiddenRouteIds, setHiddenRouteIds] = useState(() => new Set());
  const hiddenRouteIdsRef = useRef(hiddenRouteIds);

  // Extract Route Metadata
  const originName = batch?.origin_station_name || cargo?.origin_station_name || "";
  const destName = batch?.destination_station_name || cargo?.destination_station_name || "";
  const batchCode = batch?.batch_code || cargo?.logistics_batch_code || "";

  // Resolve Station Coordinates
  const originCoords = useMemo(
    () => resolveStationCoords(originName, stations),
    [originName, stations]
  );
  const destCoords = useMemo(
    () => resolveStationCoords(destName, stations),
    [destName, stations]
  );

  // Collect All Checkpoint Waypoints (must be real GPS coordinates)
  const waypoints = useMemo(() => {
    const collected = [];
    const appendWaypoint = (point, cargoCode) => {
      const lat = Number(point.latitude);
      const lng = Number(point.longitude);
      if (!isValidCoordinate(lat, lng)) return;

      collected.push({
        lat,
        lng,
        cargoCode,
        eventType: point.event_type || "checkpoint",
        timestamp: point.scanned_at,
        notes: point.notes,
        stationName: point.station_name,
        personnelName: point.personnel_name || point.scanned_by_personnel_name,
        affectedCargoCount: point.affected_cargo_count,
        sourceOrder: collected.length,
      });
    };

    const batchCheckpoints = Array.isArray(checkpoints) && checkpoints.length > 0
      ? checkpoints
      : Array.isArray(batch?.checkpoints) && batch.checkpoints.length > 0
        ? batch.checkpoints
        : [];
    batchCheckpoints.forEach((checkpoint) => {
      appendWaypoint(checkpoint, batch?.batch_code || "BATCH");
    });

    if (cargo && Array.isArray(cargo.scan_history)) {
      cargo.scan_history.forEach((scan) => {
        appendWaypoint(scan, cargo.cargo_code || "CG");
      });
    }

    if (Array.isArray(cargoList)) {
      cargoList.forEach((cargoItem) => {
        if (!Array.isArray(cargoItem.scan_history)) return;
        cargoItem.scan_history.forEach((scan) => {
          const lat = Number(scan.latitude);
          const lng = Number(scan.longitude);
          const isDuplicate = collected.some(
            (waypoint) =>
              Math.abs(waypoint.lat - lat) < 0.0001 &&
              Math.abs(waypoint.lng - lng) < 0.0001 &&
              waypoint.timestamp === scan.scanned_at
          );
          if (!isDuplicate) {
            appendWaypoint(scan, cargoItem.cargo_code || cargoItem.id || "CG");
          }
        });
      });
    }

    return collected
      .sort((left, right) => {
        const leftTime = Date.parse(left.timestamp);
        const rightTime = Date.parse(right.timestamp);
        if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
          return leftTime - rightTime;
        }
        if (!Number.isNaN(leftTime) && Number.isNaN(rightTime)) return -1;
        if (Number.isNaN(leftTime) && !Number.isNaN(rightTime)) return 1;
        return left.sourceOrder - right.sourceOrder;
      })
      .map((waypoint, index) => ({...waypoint, sequence: index + 1}));
  }, [checkpoints, batch?.checkpoints, batch?.batch_code, cargo, cargoList]);

  const routes = useMemo(() => {
    if (Array.isArray(shipments) && shipments.length > 0) {
      return shipments.map((shipment, routeIndex) => {
        const shipmentCheckpoints = (Array.isArray(shipment.checkpoints) ? shipment.checkpoints : [])
          .map((checkpoint, sourceOrder) => ({
            ...checkpoint,
            lat: Number(checkpoint.latitude),
            lng: Number(checkpoint.longitude),
            sourceOrder,
          }))
          .filter((checkpoint) => isValidCoordinate(checkpoint.lat, checkpoint.lng))
          .sort((left, right) => {
            const leftTime = Date.parse(left.scanned_at);
            const rightTime = Date.parse(right.scanned_at);
            if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
              return leftTime - rightTime;
            }
            return left.sourceOrder - right.sourceOrder;
          })
          .map((checkpoint, index) => ({
            ...checkpoint,
            cargoCode: checkpoint.cargo_code || shipment.shipment_code || "SHIPMENT",
            eventType: checkpoint.event_type || "checkpoint",
            timestamp: checkpoint.scanned_at,
            personnelName: checkpoint.personnel_name || checkpoint.scanned_by_personnel_name,
            sequence: index + 1,
          }));

        return {
          ...shipment,
          id: shipment.id || shipment.shipment_id || shipment.shipment_code || `shipment-${routeIndex + 1}`,
          label: shipmentRouteLabel(shipment),
          color: shipmentRouteColor(shipment, routeIndex),
          markerPrefix: shipmentMarkerPrefix(shipment, routeIndex),
          originCoords: resolveStationCoords(
            shipment.origin_station_name || originName,
            stations,
          ) || originCoords,
          destCoords: resolveStationCoords(
            shipment.destination_station_name || destName,
            stations,
          ) || destCoords,
          waypoints: shipmentCheckpoints,
        };
      });
    }

    return [{
      id: batchCode || "batch-route",
      label: batchCode || "Batch route",
      color: "#0284C7",
      markerPrefix: "",
      originCoords,
      destCoords,
      waypoints,
      status: batch?.status,
      transport_mode: "planned",
    }];
  }, [shipments, originName, destName, stations, originCoords, destCoords, batchCode, waypoints, batch?.status]);

  const checkpointCount = routes.reduce((total, route) => total + route.waypoints.length, 0);
  const hasRealCheckpoints = checkpointCount > 0;

  const toggleRouteVisibility = useCallback((routeId) => {
    setHiddenRouteIds((current) => {
      const next = new Set(current);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      hiddenRouteIdsRef.current = next;

      const visible = !next.has(routeId);
      const map = mapInstanceRef.current;
      if (map && !map._removed) {
        const layerIds = routeLayerIds(routeId);
        [layerIds.glow, layerIds.core].forEach((layerId) => {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
          }
        });
      }
      markersRef.current.forEach((marker) => {
        const element = marker.getElement();
        if (element?.dataset?.routeId === String(routeId)) {
          element.style.display = visible ? "flex" : "none";
        }
      });
      return next;
    });
  }, []);

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
      else if (routes[0]?.waypoints.length > 0) {
        center = [routes[0].waypoints[0].lng, routes[0].waypoints[0].lat];
      }

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

        const allRoutePoints = [];

        // Each child shipment is its own source and line. Routes intentionally
        // remain separate so the end of an airlift is never connected to the
        // beginning of the planned surface shipment.
        routes.forEach((route) => {
          const routePoints = [];
          if (route.originCoords) {
            routePoints.push([route.originCoords.lng, route.originCoords.lat]);
          }
          route.waypoints.forEach((waypoint) => {
            routePoints.push([waypoint.lng, waypoint.lat]);
          });
          if (route.destCoords) {
            routePoints.push([route.destCoords.lng, route.destCoords.lat]);
          }
          allRoutePoints.push(...routePoints);

          if (routePoints.length < 2) return;
          try {
            const ids = routeLayerIds(route.id);
            const visibility = hiddenRouteIdsRef.current.has(route.id) ? "none" : "visible";
            map.addSource(ids.source, {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: {type: "LineString", coordinates: routePoints},
                properties: {},
              },
            });
            map.addLayer({
              id: ids.glow,
              type: "line",
              source: ids.source,
              layout: {visibility},
              paint: {
                "line-color": route.color,
                "line-width": 7,
                "line-opacity": 0.2,
              },
            });
            const coreLayer = {
              id: ids.core,
              type: "line",
              source: ids.source,
              layout: {visibility},
              paint: {
                "line-color": route.color,
                "line-width": String(route.transport_mode || "").toLowerCase() === "airlift" ? 4 : 3,
                "line-opacity": 0.95,
              },
            };
            if (String(route.transport_mode || "").toLowerCase() !== "airlift") {
              coreLayer.paint["line-dasharray"] = [2, 1.5];
            }
            map.addLayer(coreLayer);
          } catch (lineErr) {
            console.warn(`Could not add route line ${route.label}:`, lineErr);
          }
        });

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

        // Add independently numbered checkpoint pins for every shipment route.
        routes.forEach((route) => route.waypoints.forEach((waypoint) => {
          const element = document.createElement("div");
          element.className = "batch-map-pin waypoint-pin";
          element.dataset.routeId = String(route.id);
          element.style.display = hiddenRouteIdsRef.current.has(route.id) ? "none" : "flex";
          element.innerHTML = `
            <div style="background: ${route.color}; color: #ffffff; min-width: 24px; height: 24px; padding: 0 4px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 9px; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.3);">
              ${escapeHtml(`${route.markerPrefix}${waypoint.sequence || ""}`)}
            </div>
          `;

          const popup = new maplibregl.Popup({offset: [0, -12], closeButton: true}).setHTML(`
            <div style="font-family: sans-serif; font-size: 12px; color: #0F172A; min-width: 190px;">
              <div style="font-weight: 700; color: ${route.color}; margin-bottom: 4px;">${escapeHtml(route.label)}</div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 3px;">
                <span style="background: #F1F5F9; color: #334155; font-weight: 600; font-size: 10px; padding: 1px 6px; border-radius: 4px; text-transform: uppercase;">${escapeHtml(formatEnumLabel(waypoint.eventType, "Checkpoint"))}</span>
                <span style="font-family: monospace; font-size: 11px; font-weight: 600; color: ${route.color};">${escapeHtml(waypoint.cargoCode)}</span>
              </div>
              <div style="font-size: 11px; color: #64748B; margin-bottom: 2px;">${waypoint.timestamp ? new Date(waypoint.timestamp).toLocaleString() : ""}</div>
              <div style="font-family: monospace; font-size: 11px; color: #334155; margin-bottom: 4px;">${formatCoordinates(waypoint.lat, waypoint.lng) || ""}</div>
              ${waypoint.personnelName ? `<div style="font-size: 11px; color: #475569;">Operator: <strong>${escapeHtml(waypoint.personnelName)}</strong></div>` : ""}
              ${waypoint.notes ? `<div style="font-size: 11px; color: #1E293B; margin-top: 3px; font-style: italic; background: #F8FAFC; padding: 4px 6px; border-radius: 4px; border: 1px solid #E2E8F0;">"${escapeHtml(waypoint.notes)}"</div>` : ""}
            </div>
          `);
          const marker = new maplibregl.Marker({element})
            .setLngLat([waypoint.lng, waypoint.lat])
            .setPopup(popup)
            .addTo(map);
          markersRef.current.push(marker);
        }));

        // Fit map bounds to encompass all points comfortably
        if (allRoutePoints.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          allRoutePoints.forEach((point) => bounds.extend(point));
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
  }, [retryCount, hasRealCheckpoints, originCoords, destCoords, originName, destName, routes]);

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
          {checkpointCount > 0 && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: colors.amberBg,
                color: colors.amber,
                border: `1px solid ${colors.amberDim}`,
              }}
            >
              {checkpointCount} GPS {checkpointCount === 1 ? "checkpoint" : "checkpoints"}
            </span>
          )}
        </div>
      </div>

      {routes.length > 1 && (
        <div
          className="flex items-center gap-2 px-3 py-2 overflow-x-auto"
          style={{background: colors.panelAlt, borderBottom: `1px solid ${colors.borderSoft}`}}
        >
          <span className="text-[10px] uppercase font-semibold flex-shrink-0" style={{color: colors.textFaint}}>
            Route layers
          </span>
          {routes.map((route) => {
            const hidden = hiddenRouteIds.has(route.id);
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => toggleRouteVisibility(route.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] whitespace-nowrap cursor-pointer transition-opacity"
                style={{
                  color: hidden ? colors.textFaint : colors.text,
                  background: colors.bgRaised,
                  border: `1px solid ${hidden ? colors.borderSoft : route.color}`,
                  opacity: hidden ? 0.55 : 1,
                }}
                title={`${hidden ? "Show" : "Hide"} ${route.label}`}
              >
                <span className="w-2 h-2 rounded-full" style={{background: route.color}} />
                <span className="font-medium">{route.label}</span>
                <span style={{...mono, color: colors.textMuted}}>{route.waypoints.length}</span>
              </button>
            );
          })}
        </div>
      )}

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
