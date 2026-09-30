import {useEffect, useRef, useState, useCallback, useMemo} from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {AlertCircle, RefreshCw, Radio, MapPin, Navigation, Maximize2} from "lucide-react";
import { colors, mono } from "../../theme";
import {useEmergencyStore} from "../../store/useEmergencyStore";
import MapErrorBoundary from "../ui/MapErrorBoundary";

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
 * Calculates haversine distance in meters between two coordinates.
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Creates a GeoJSON Polygon approximating a geodesic circle on Earth
 * using spherical trigonometry.
 */
function createGeoJSONCircle(center, radiusInMeters, points = 64) {
  const [lng, lat] = center;
  const coordinates = [];
  const earthRadius = 6378137;
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

function generatePopupHtml(emergency, lat, lng, accuracyMeters, pointsCount) {
  return `
    <div style="font-family: inherit; font-size: 12px; line-height: 1.45; color: #0f172a; min-width: 220px; max-width: 290px; padding: 2px;">
      <div style="font-weight: 700; color: #dc2626; font-size: 13px; margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <span style="font-family: monospace; font-size: 12px; font-weight: 800; letter-spacing: 0.02em;">${escapeHtml(
          emergency?.emergency_code || emergency?.id || "INCIDENT"
        )}</span>
        <span style="font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: #fee2e2; color: #991b1b; text-transform: uppercase;">
          ${escapeHtml(emergency?.status || "Active")}
        </span>
      </div>
      <div style="font-weight: 600; color: #1e293b; margin-bottom: 6px; font-size: 12px;">
        ${escapeHtml(emergency?.summary || emergency?.emergency_type || "Emergency incident")}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; display: grid; gap: 4px; font-size: 11px;">
        <div>
          <span style="color: #64748b;">Reporting Personnel:</span>
          <strong style="color: #0f172a; margin-left: 4px;">${escapeHtml(
            emergency?.reported_by_name || "Unassigned"
          )}</strong>
        </div>
        <div>
          <span style="color: #64748b;">Device Label:</span>
          <code style="font-family: monospace; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 10.5px; color: #334155; margin-left: 4px;">${escapeHtml(
            emergency?.device_label || "—"
          )}</code>
        </div>
        <div>
          <span style="color: #64748b;">Live Coordinates:</span>
          <code style="font-family: monospace; font-size: 10.5px; margin-left: 4px; color: #0284c7;">${lat.toFixed(
            6
          )}°, ${lng.toFixed(6)}°</code>
        </div>
        <div>
          <span style="color: #64748b;">GPS Accuracy:</span>
          <span style="font-weight: 600; color: #0f172a; margin-left: 4px;">±${accuracyMeters} m</span>
        </div>
        <div>
          <span style="color: #64748b;">Last Heartbeat:</span>
          <span style="color: #334155; margin-left: 4px;">${formatTimestamp(
            emergency?.last_heartbeat_at
          )}</span>
        </div>
        ${
          pointsCount > 1
            ? `<div>
                <span style="color: #64748b;">Telemetry Trail:</span>
                <span style="font-weight: 600; color: #d97706; margin-left: 4px;">${pointsCount} waypoints traced</span>
              </div>`
            : ""
        }
      </div>
    </div>
  `;
}

function EmergencyMapInner({emergency}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const popupRef = useRef(null);

  // Movement & Annotation tracking refs
  const trackPointsRef = useRef([]);
  const lastCoordsRef = useRef({ lng: null, lat: null });

  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [movementAnnotation, setMovementAnnotation] = useState(null);
  const [trackCount, setTrackCount] = useState(1);
  const [totalMetersTraveled, setTotalMetersTraveled] = useState(0);

  // Read stored telemetry tracks safely from global store
  const emergencyKey = emergency?.id || emergency?.device_id || "global_live_track";
  const storeTracks = useEmergencyStore(
    (s) => {
      const tracks = s?.telemetryTracks;
      if (!tracks) return [];
      return (
        tracks[emergencyKey] ||
        (emergency?.device_id && tracks[emergency.device_id]) ||
        tracks["global_live_track"] ||
        []
      );
    }
  );

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
      : 15;

  const handleRetry = useCallback(() => {
    setHasError(false);
    setErrorMessage("");
    setMapLoaded(false);
    setRetryCount((prev) => prev + 1);
  }, []);

  // Update GeoJSON layers (accuracy circle, movement track line, waypoint dots)
  const updateGeoJsonLayers = useCallback((map, lng, lat, accuracy, trackPoints) => {
    if (!map || map._removed || !map.getCanvas()) return;
    if (!map.isStyleLoaded()) {
      map.once("styledata", () => {
        if (!map || map._removed || !map.getCanvas()) return;
        updateGeoJsonLayers(map, lng, lat, accuracy, trackPoints);
      });
      return;
    }

    try {
      // 1. Update Accuracy Circle
      const circleSource = map.getSource("emergency-accuracy-circle");
      if (circleSource) {
        circleSource.setData(createGeoJSONCircle([lng, lat], accuracy, 64));
      }

      // 2. Update Movement Track Line
      const trackSource = map.getSource("emergency-movement-track");
      if (trackSource) {
        const safeCoords = (trackPoints || [])
          .filter((p) => p && !isNaN(Number(p.lng)) && !isNaN(Number(p.lat)))
          .map((p) => [Number(p.lng), Number(p.lat)]);

        trackSource.setData({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: safeCoords.length > 1 ? safeCoords : [],
          },
          properties: {},
        });
      }

      // 3. Update Movement Waypoint Points
      const pointsSource = map.getSource("emergency-movement-points");
      if (pointsSource) {
        const validPoints = (trackPoints || []).filter(
          (p) => p && !isNaN(Number(p.lng)) && !isNaN(Number(p.lat))
        );
        const pointFeatures = validPoints.slice(0, -1).map((p, idx) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [Number(p.lng), Number(p.lat)],
          },
          properties: {
            title: `Waypoint #${idx + 1}`,
            timestamp: p.timestamp,
            accuracy: p.accuracy,
            coordsFormatted: `${Number(p.lat).toFixed(6)}°, ${Number(p.lng).toFixed(6)}°`,
          },
        }));

        pointsSource.setData({
          type: "FeatureCollection",
          features: pointFeatures,
        });
      }
    } catch (layerErr) {
      console.warn("Could not update GeoJSON layers:", layerErr);
    }
  }, []);

  // 1. MAP INITIALIZATION EFFECT — ONLY RUNS ONCE ON MOUNT (or on retry)
  // Does NOT reload map on heartbeat or location change!
  useEffect(() => {
    if (!isValidCoords || !mapContainerRef.current) return;

    let map = null;
    let resizeObserver = null;

    try {
      // Seed initial track points from storeTracks or current coords
      if (trackPointsRef.current.length === 0) {
        if (storeTracks && storeTracks.length > 0) {
          trackPointsRef.current = [...storeTracks];
          const last = storeTracks[storeTracks.length - 1];
          lastCoordsRef.current = {lng: last.lng, lat: last.lat};
        } else {
          trackPointsRef.current = [
            {
              lng: rawLng,
              lat: rawLat,
              timestamp: emergency?.last_heartbeat_at || new Date().toISOString(),
              accuracy: accuracyMeters,
            },
          ];
          lastCoordsRef.current = {lng: rawLng, lat: rawLat};
        }
        setTrackCount(trackPointsRef.current.length);
      }

      // Initialize MapLibre GL instance
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: OPENFREEMAP_STYLE,
        center: [rawLng, rawLat],
        zoom: 13,
        attributionControl: true,
      });
      mapInstanceRef.current = map;

      // Add navigation controls
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

      // Construct popup
      const popupHtml = generatePopupHtml(
        emergency,
        rawLat,
        rawLng,
        accuracyMeters,
        trackPointsRef.current.length
      );

      const popup = new maplibregl.Popup({
        offset: [0, -10],
        closeButton: true,
        closeOnClick: false,
        maxWidth: "320px",
      }).setHTML(popupHtml);
      popupRef.current = popup;

      // Create custom pulsing red marker element
      const markerEl = document.createElement("div");
      markerEl.className = "emergency-pulse-marker";
      markerEl.setAttribute(
        "title",
        `Emergency Location: ${emergency?.emergency_code || "Incident"}`
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

      markerRef.current = marker;

      // On map load, register sources and layers for accuracy and telemetry track
      map.on("load", () => {
        setMapLoaded(true);

        // 1. Accuracy Circle source & layers
        if (!map.getSource("emergency-accuracy-circle")) {
          map.addSource("emergency-accuracy-circle", {
            type: "geojson",
            data: createGeoJSONCircle([rawLng, rawLat], accuracyMeters, 64),
          });

          map.addLayer({
            id: "emergency-accuracy-circle-fill",
            type: "fill",
            source: "emergency-accuracy-circle",
            paint: {
              "fill-color": "#ef4444",
              "fill-opacity": 0.16,
            },
          });

          map.addLayer({
            id: "emergency-accuracy-circle-stroke",
            type: "line",
            source: "emergency-accuracy-circle",
            paint: {
              "line-color": "#dc2626",
              "line-width": 1.5,
              "line-opacity": 0.7,
              "line-dasharray": [2, 1],
            },
          });
        }

        // 2. Movement Track source & layers (connects heartbeats when location moves)
        if (!map.getSource("emergency-movement-track")) {
          map.addSource("emergency-movement-track", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates:
                  trackPointsRef.current.length > 1
                    ? trackPointsRef.current.map((p) => [p.lng, p.lat])
                    : [],
              },
              properties: {},
            },
          });

          // Casing for contrast against snow / terrain
          map.addLayer({
            id: "emergency-movement-track-casing",
            type: "line",
            source: "emergency-movement-track",
            paint: {
              "line-color": "#0f172a",
              "line-width": 4.5,
              "line-opacity": 0.65,
            },
          });

          // Vibrant dashed track line
          map.addLayer({
            id: "emergency-movement-track-line",
            type: "line",
            source: "emergency-movement-track",
            paint: {
              "line-color": "#f97316", // Amber-orange tracking trail
              "line-width": 2.5,
              "line-opacity": 0.95,
              "line-dasharray": [2, 1.5],
            },
          });
        }

        // 3. Movement Waypoints source & layers (dots at each previous heartbeat)
        if (!map.getSource("emergency-movement-points")) {
          map.addSource("emergency-movement-points", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          });

          map.addLayer({
            id: "emergency-movement-points-circle",
            type: "circle",
            source: "emergency-movement-points",
            paint: {
              "circle-radius": 4,
              "circle-color": "#f59e0b",
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.9,
            },
          });

          // Waypoint click popup
          map.on("click", "emergency-movement-points-circle", (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const props = e.features[0].properties;
            new maplibregl.Popup({ offset: [0, -5], closeButton: true })
              .setLngLat(coordinates)
              .setHTML(`
                <div style="font-size:11px; font-family:sans-serif; padding:2px; min-width:140px;">
                  <strong style="color:#d97706;">${escapeHtml(props.title)}</strong>
                  <div style="color:#64748b; font-size:10px; margin-top:2px;">${formatTimestamp(props.timestamp)}</div>
                  <div style="color:#0284c7; font-family:monospace; font-size:10px; margin-top:2px;">${escapeHtml(props.coordsFormatted)}</div>
                </div>
              `)
              .addTo(map);
          });

          map.on("mouseenter", "emergency-movement-points-circle", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "emergency-movement-points-circle", () => {
            map.getCanvas().style.cursor = "";
          });
        }

        // Apply current track
        updateGeoJsonLayers(
          map,
          rawLng,
          rawLat,
          accuracyMeters,
          trackPointsRef.current
        );
      });

      // ResizeObserver
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);

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

    // Cleanup ONLY runs on unmount or retry — NEVER on periodic heartbeat!
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
      markerRef.current = null;
      popupRef.current = null;
    };
  }, [isValidCoords, retryCount]); // <-- STRICTLY STABLE DEPENDENCIES!

  // Calculate total meters traveled whenever track points change
  useEffect(() => {
    try {
      const pts = trackPointsRef.current;
      if (pts && pts.length >= 2) {
        let d = 0;
        for (let i = 1; i < pts.length; i++) {
          const p1 = pts[i - 1];
          const p2 = pts[i];
          if (p1 && p2 && !isNaN(Number(p1.lat)) && !isNaN(Number(p2.lat))) {
            d += getDistanceMeters(Number(p1.lat), Number(p1.lng), Number(p2.lat), Number(p2.lng));
          }
        }
        setTotalMetersTraveled(Math.round(d));
      } else {
        setTotalMetersTraveled(0);
      }
    } catch {
      setTotalMetersTraveled(0);
    }
  }, [trackCount]);

  // Synchronize with global store telemetry tracks
  useEffect(() => {
    if (!isValidCoords) return;
    if (storeTracks && storeTracks.length > 0) {
      if (storeTracks.length > trackPointsRef.current.length) {
        trackPointsRef.current = [...storeTracks];
        setTrackCount(storeTracks.length);
        const last = storeTracks[storeTracks.length - 1];
        if (last) {
          lastCoordsRef.current = {lng: Number(last.lng), lat: Number(last.lat)};

          if (mapInstanceRef.current && !mapInstanceRef.current._removed) {
            updateGeoJsonLayers(
              mapInstanceRef.current,
              Number(last.lng),
              Number(last.lat),
              accuracyMeters,
              trackPointsRef.current
            );
            if (markerRef.current) {
              markerRef.current.setLngLat([Number(last.lng), Number(last.lat)]);
            }
            try {
              mapInstanceRef.current.easeTo({
                center: [Number(last.lng), Number(last.lat)],
                duration: 800,
              });
            } catch {
            }
          }
        }
      }
    }
  }, [storeTracks, isValidCoords, accuracyMeters, updateGeoJsonLayers]);

  const handleFitTrail = useCallback(() => {
    try {
      const map = mapInstanceRef.current;
      const pts = trackPointsRef.current || [];
      if (!map || pts.length === 0) return;
      if (pts.length === 1) {
        map.easeTo({center: [rawLng, rawLat], zoom: 14, duration: 600});
        return;
      }
      const bounds = new maplibregl.LngLatBounds();
      pts.forEach((pt) => {
        if (pt && !isNaN(Number(pt.lng)) && !isNaN(Number(pt.lat))) {
          bounds.extend([Number(pt.lng), Number(pt.lat)]);
        }
      });
      map.fitBounds(bounds, {padding: 45, maxZoom: 16, duration: 800});
    } catch (e) {
      console.warn("Could not fit trail bounds:", e);
    }
  }, [rawLng, rawLat]);

  const handleRecenter = useCallback(() => {
    try {
      const map = mapInstanceRef.current;
      if (!map || !isValidCoords) return;
      map.easeTo({center: [rawLng, rawLat], zoom: 14, duration: 600});
    } catch (e) {
      console.warn("Could not recenter map:", e);
    }
  }, [isValidCoords, rawLng, rawLat]);

  // 2. HEARTBEAT & LOCATION UPDATE EFFECT — ANNOTATES MAP WITHOUT RELOADING
  useEffect(() => {
    if (!isValidCoords || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const prev = lastCoordsRef.current;
    const isFirstCoord = prev.lng === null || prev.lat === null;

    // Check if coordinates have moved (threshold: ~1 meter / 0.00001 deg)
    const hasMoved =
      !isFirstCoord &&
      (Math.abs(prev.lng - rawLng) > 0.00001 ||
        Math.abs(prev.lat - rawLat) > 0.00001);

    if (isFirstCoord || hasMoved) {
      let distanceMoved = 0;
      if (hasMoved) {
        distanceMoved = Math.round(
          getDistanceMeters(prev.lat, prev.lng, rawLat, rawLng)
        );
      }

      lastCoordsRef.current = { lng: rawLng, lat: rawLat };

      // Append new coordinate to movement history trail
      const newPoint = {
        lng: rawLng,
        lat: rawLat,
        timestamp: emergency?.last_heartbeat_at || new Date().toISOString(),
        accuracy: accuracyMeters,
      };

      // Check if duplicate of last point
      const lastPt = trackPointsRef.current[trackPointsRef.current.length - 1];
      if (!lastPt || Math.abs(lastPt.lat - rawLat) > 0.00001 || Math.abs(lastPt.lng - rawLng) > 0.00001) {
        trackPointsRef.current = [...trackPointsRef.current, newPoint];
        setTrackCount(trackPointsRef.current.length);
      }

      // Show temporary movement annotation badge on map
      if (hasMoved && distanceMoved > 0) {
        setMovementAnnotation(`Device moved +${distanceMoved}m • Telemetry updated`);
        const timer = setTimeout(() => {
          setMovementAnnotation(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }

    // Smoothly update marker position without reloading map
    if (markerRef.current) {
      markerRef.current.setLngLat([rawLng, rawLat]);
    }

    // Update popup HTML content with latest data
    if (popupRef.current) {
      popupRef.current.setHTML(
        generatePopupHtml(
          emergency,
          rawLat,
          rawLng,
          accuracyMeters,
          trackPointsRef.current.length
        )
      );
    }

    // Smoothly ease camera to new position when location moves (does not reset zoom!)
    if (hasMoved) {
      map.easeTo({
        center: [rawLng, rawLat],
        duration: 900,
      });
    }

    // Update GeoJSON track line, accuracy circle, and waypoint annotations
    updateGeoJsonLayers(
      map,
      rawLng,
      rawLat,
      accuracyMeters,
      trackPointsRef.current
    );
  }, [isValidCoords, rawLat, rawLng, accuracyMeters, emergency, updateGeoJsonLayers]);

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

        {/* Live Movement Annotation Banner on Map */}
        {movementAnnotation && (
          <div
            className="absolute bottom-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2"
            style={{
              background: "rgba(15, 23, 42, 0.88)",
              color: colors.aurora,
              border: `1px solid ${colors.auroraDim}`,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{movementAnnotation}</span>
          </div>
        )}

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

        {/* Floating Map Controls for Trail & Recenter */}
        {mapLoaded && !hasError && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleFitTrail}
              title="Fit entire movement trail into view"
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium cursor-pointer shadow-md backdrop-blur-md transition-all hover:brightness-125"
              style={{
                background: "rgba(15, 23, 42, 0.85)",
                color: colors.text,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <Maximize2 size={12} style={{color: colors.amber}}/>
              <span className="hidden sm:inline">Fit trail</span>
            </button>
            <button
              type="button"
              onClick={handleRecenter}
              title="Recenter camera on latest coordinates"
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium cursor-pointer shadow-md backdrop-blur-md transition-all hover:brightness-125"
              style={{
                background: "rgba(15, 23, 42, 0.85)",
                color: colors.text,
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <Navigation size={12} style={{color: colors.ice}}/>
              <span className="hidden sm:inline">Follow live</span>
            </button>
          </div>
        )}

        {/* Loading Spinner overlay before initial style is ready */}
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
            <span style={{ fontSize: "11px" }}>Initializing map...</span>
          </div>
        )}
      </div>

      {/* Subtitle & Telemetry Trail Status */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] px-0.5"
        style={{ color: colors.textFaint }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Radio size={12} className="flex-shrink-0" style={{ color: colors.ice }} />
          <span className="truncate">Live telemetry stream (persists & traces route in real-time)</span>
          {trackCount > 1 && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
              style={{
                background: colors.amberBg,
                color: colors.amber,
                border: `1px solid ${colors.amberDim}`,
              }}
            >
              {trackCount} fixes traced {totalMetersTraveled > 0 ? `(${totalMetersTraveled}m route)` : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
          {emergency?.location_accuracy_m != null && (
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

export default function EmergencyMap(props) {
  return (
    <MapErrorBoundary>
      <EmergencyMapInner {...props} />
    </MapErrorBoundary>
  );
}
