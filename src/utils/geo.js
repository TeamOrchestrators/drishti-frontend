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
