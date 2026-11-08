export const TYPES = Object.freeze({
  friendly: "a-f-G-U-C",
  hostile: "a-h-G-U-C",
  neutral: "a-n-G-U-C",
  unknown: "a-u-G-U-C"
});

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[c]);
}

function checkId(value, label) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new Error(label + " must contain 1-64 letters, digits, _ or -");
  }
}

export function buildCot(event, now = new Date()) {
  const {sessionId, objectId, callsign, affiliation, lat, lon} = event || {};
  checkId(sessionId, "sessionId");
  checkId(objectId, "objectId");
  if (typeof callsign !== "string" || !callsign.trim() || callsign.length > 80) {
    throw new Error("callsign is required and must be at most 80 characters");
  }
  if (!Object.hasOwn(TYPES, affiliation)) {
    throw new Error("affiliation must be friendly, hostile, neutral or unknown");
  }
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error("lat/lon must be valid numeric WGS84 coordinates");
  }
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) {
    throw new Error("invalid event timestamp");
  }
  const time = now.toISOString();
  const stale = new Date(now.valueOf() + 120000).toISOString();
  const uid = "TDG-" + sessionId + "-" + objectId;
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<event version="2.0" uid="' + xmlEscape(uid) + '" type="' + TYPES[affiliation] +
    '" how="m-g" time="' + time + '" start="' + time + '" stale="' + stale + '">' +
    '<point lat="' + lat + '" lon="' + lon +
    '" hae="9999999.0" ce="9999999.0" le="9999999.0"/>' +
    '<detail><contact callsign="' + xmlEscape(callsign) +
    '"/><remarks>SIMULATED TRAINING CONTACT - NOT LIVE</remarks></detail></event>';
}
