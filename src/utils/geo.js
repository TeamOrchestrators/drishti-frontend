/**
 * Format latitude and longitude coordinates into polar standard display:
 * e.g. 69.408000° S, 76.190000° E
 * Correctly uses N/S for latitude and E/W for longitude with 6 decimal places.
 */
export function formatCoordinates(lat, lon) {
  if (lat == null || lon == null || isNaN(Number(lat)) || isNaN(Number(lon))) {
    return null;
  }
  const latNum = Number(lat);
  const lonNum = Number(lon);
  const latDir = latNum >= 0 ? "N" : "S";
  const lonDir = lonNum >= 0 ? "E" : "W";
  const latStr = Math.abs(latNum).toFixed(6);
  const lonStr = Math.abs(lonNum).toFixed(6);
  return `${latStr}° ${latDir}, ${lonStr}° ${lonDir}`;
}

export const KNOWN_STATION_COORDS = {
  bharti: {lat: -69.408, lng: 76.187, name: "Bharti Station"},
  maitri: {lat: -70.767, lng: 11.733, name: "Maitri Station"},
  "dakshin gangotri": {lat: -70.755, lng: 11.739, name: "Dakshin Gangotri"},
  himadri: {lat: 78.927, lng: 11.933, name: "Himadri Station"},
  "india hq": {lat: 15.402, lng: 73.805, name: "National Centre for Polar & Ocean Research (NCAOR)"},
  ncaor: {lat: 15.402, lng: 73.805, name: "NCAOR Goa"},
  "cape town": {lat: -33.9249, lng: 18.4241, name: "Cape Town Transit Depot"},
};

export function isValidCoordinate(lat, lng) {
  if (lat == null || lng == null) return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  return (
    !isNaN(numLat) &&
    !isNaN(numLng) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180 &&
    !(numLat === 0 && numLng === 0)
  );
}

export function resolveStationCoords(stationNameOrCode, stationsList = []) {
  if (!stationNameOrCode) return null;
  const str = String(stationNameOrCode).trim().toLowerCase();

  // 1. Check if matching station in passed list has valid lat/lng
  if (Array.isArray(stationsList)) {
    const found = stationsList.find(
      (s) =>
        s.id === stationNameOrCode ||
        s.name?.toLowerCase() === str ||
        s.code?.toLowerCase() === str ||
        str.includes(s.name?.toLowerCase() || "___")
    );
    if (found) {
      const lat = found.latitude ?? found.lat;
      const lng = found.longitude ?? found.lng ?? found.lon;
      if (isValidCoordinate(lat, lng)) {
        return {lat: Number(lat), lng: Number(lng), name: found.name || stationNameOrCode};
      }
    }
  }

  // 2. Check known station coords dictionary
  for (const [key, coords] of Object.entries(KNOWN_STATION_COORDS)) {
    if (str.includes(key) || key.includes(str)) {
      return {lat: coords.lat, lng: coords.lng, name: coords.name};
    }
  }

  return null;
}
