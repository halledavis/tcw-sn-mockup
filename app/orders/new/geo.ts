// Inline centroid lookup + equirectangular projection for the cosmetic world
// map on the Location-details step. No DB coords, no map library — just enough
// country / US-state / CA-province centroids to plausibly plot the seed data.

type LatLng = [number, number]; // [lat, lng]

// Countries offered in the builder (mirrors catalog COUNTRIES) + a few extras.
const COUNTRY_CENTROIDS: Record<string, LatLng> = {
  US: [39.5, -98.35], CA: [56.13, -106.35], GB: [54, -2], MX: [23.63, -102.55],
  DE: [51.16, 10.45], FR: [46.6, 2.45], IE: [53.4, -8], AU: [-25.27, 133.77],
  IN: [22, 79], JP: [36.2, 138.25], BR: [-14.24, -51.93], SG: [1.35, 103.82],
  PH: [12.88, 121.77],
};

const US_STATE_CENTROIDS: Record<string, LatLng> = {
  AL: [32.8, -86.8], AK: [64.2, -149.5], AZ: [34.3, -111.7], AR: [34.8, -92.4],
  CA: [37.2, -119.4], CO: [39, -105.5], CT: [41.6, -72.7], DE: [39, -75.5],
  DC: [38.9, -77.0], FL: [28.6, -82.4], GA: [32.6, -83.4], HI: [20.3, -156.4],
  ID: [44.4, -114.6], IL: [40, -89.2], IN: [39.9, -86.3], IA: [42, -93.5],
  KS: [38.5, -98.4], KY: [37.5, -85.3], LA: [31, -92], ME: [45.4, -69.2],
  MD: [39, -76.8], MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3],
  MS: [32.7, -89.7], MO: [38.4, -92.5], MT: [47, -109.6], NE: [41.5, -99.8],
  NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.2, -74.7], NM: [34.4, -106.1],
  NY: [42.9, -75.5], NC: [35.5, -79.4], ND: [47.5, -100.3], OH: [40.3, -82.8],
  OK: [35.6, -97.5], OR: [43.9, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.5],
  SC: [33.9, -80.9], SD: [44.4, -100.2], TN: [35.9, -86.4], TX: [31.5, -99.3],
  UT: [39.3, -111.7], VT: [44.1, -72.7], VA: [37.5, -78.8], WA: [47.4, -120.5],
  WV: [38.6, -80.6], WI: [44.6, -90], WY: [43, -107.5],
};

const CA_PROVINCE_CENTROIDS: Record<string, LatLng> = {
  AB: [53.9, -116.6], BC: [53.7, -127.6], MB: [53.8, -98.8], NB: [46.5, -66.5],
  NL: [53.1, -57.7], NS: [45, -63], NT: [64.8, -124.8], NU: [70.3, -83.1],
  ON: [50, -85.3], PE: [46.4, -63.2], QC: [52, -71.4], SK: [54.5, -105.5],
  YT: [64.3, -135],
};

// Best centroid for a location: prefer the US-state / CA-province centroid,
// fall back to the country, else null (unplottable).
export function centroidFor(country: string | null, state: string | null): LatLng | null {
  const cc = (country ?? "").toUpperCase();
  const sc = (state ?? "").toUpperCase();
  if (cc === "US" && US_STATE_CENTROIDS[sc]) return US_STATE_CENTROIDS[sc];
  if (cc === "CA" && CA_PROVINCE_CENTROIDS[sc]) return CA_PROVINCE_CENTROIDS[sc];
  return COUNTRY_CENTROIDS[cc] ?? null;
}

export function countryCentroid(code: string): LatLng | null {
  return COUNTRY_CENTROIDS[(code ?? "").toUpperCase()] ?? null;
}

// Equirectangular projection -> percentage offsets for absolute positioning.
export function project([lat, lng]: LatLng): { left: number; top: number } {
  return { left: ((lng + 180) / 360) * 100, top: ((90 - lat) / 180) * 100 };
}
