// Hand-built, dependency-free schematic US map — no mapping library is
// available in this bundle (the standalone build ships as a single self
// contained HTML file with no external assets), so states are plotted as
// circles at their approximate geographic position using a flat lon/lat
// projection. Alaska and Hawaii sit in real geography's usual inset corner
// rather than their true (far-off) coordinates, matching how printed US maps
// conventionally handle them.
const STATE_POSITIONS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AZ: [34.2, -111.9], AR: [34.9, -92.4], CA: [37.2, -119.6],
  CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5], DC: [38.9, -77.0], FL: [28.6, -82.4],
  GA: [32.6, -83.4], ID: [44.4, -114.6], IL: [40.0, -89.2], IN: [39.9, -86.3],
  IA: [42.0, -93.5], KS: [38.5, -98.4], KY: [37.5, -85.3], LA: [31.0, -92.0], ME: [45.4, -69.2],
  MD: [39.0, -76.7], MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7],
  MO: [38.5, -92.5], MT: [47.0, -109.6], NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6],
  NJ: [40.2, -74.7], NM: [34.5, -106.1], NY: [42.9, -75.5], NC: [35.6, -79.4], ND: [47.5, -100.5],
  OH: [40.3, -82.8], OK: [35.6, -97.5], OR: [44.0, -120.6], PA: [40.9, -77.7], RI: [41.7, -71.5],
  SC: [33.9, -80.9], SD: [44.5, -100.2], TN: [35.9, -86.3], TX: [31.5, -99.3], UT: [39.4, -111.6],
  VT: [44.0, -72.7], VA: [37.5, -78.8], WA: [47.4, -120.5], WV: [38.6, -80.6], WI: [44.6, -89.9],
  WY: [43.0, -107.5],
};
// Alaska/Hawaii aren't part of the continental projection below — fixed inset positions instead.
const INSET_POSITIONS: Record<string, [number, number]> = { AK: [520, 330], HI: [580, 330] };

const LON_MIN = -125, LON_MAX = -66, LAT_MIN = 24, LAT_MAX = 50;
const W = 620, H = 340;

function project(lat: number, lon: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W;
  const y = H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * H;
  return [x, y];
}

function flatDistance(a: [number, number], b: [number, number]): number {
  const dLat = a[0] - b[0];
  const dLon = (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

function colorForDistance(d: number, maxD: number): string {
  const t = maxD > 0 ? Math.min(1, d / maxD) : 0;
  // Green (close) -> yellow (mid) -> red (far)
  if (t < 0.5) {
    const k = t / 0.5;
    return `rgb(${Math.round(60 + k * 180)}, ${Math.round(160 + k * 30)}, 60)`;
  }
  const k = (t - 0.5) / 0.5;
  return `rgb(${Math.round(240 - k * 20)}, ${Math.round(190 - k * 140)}, 60)`;
}

export default function USMap({
  homeState, homeCity, selectedState, onSelectState,
}: {
  homeState: string;
  homeCity?: string;
  selectedState: string | null;
  onSelectState: (state: string) => void;
}) {
  const homePos = STATE_POSITIONS[homeState];
  const states = Object.keys(STATE_POSITIONS);
  const distances = new Map<string, number>();
  let maxD = 1;
  if (homePos) {
    for (const s of states) {
      const d = flatDistance(homePos, STATE_POSITIONS[s]);
      distances.set(s, d);
      if (d > maxD) maxD = d;
    }
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W + 80} ${H + 20}`} style={{ width: "100%", maxWidth: 720, height: "auto" }}>
        <rect x={0} y={0} width={W + 80} height={H + 20} fill="none" />
        {states.map((s) => {
          const [lat, lon] = STATE_POSITIONS[s];
          const [x, y] = project(lat, lon);
          const isHome = s === homeState;
          const isSelected = s === selectedState;
          const d = distances.get(s) ?? 0;
          const fill = isHome ? "var(--accent, #d9670c)" : colorForDistance(d, maxD);
          return (
            <g key={s} onClick={() => onSelectState(s)} style={{ cursor: "pointer" }}>
              <circle
                cx={x} cy={y} r={isHome ? 11 : isSelected ? 10 : 8}
                fill={fill}
                stroke={isSelected ? "#fff" : isHome ? "#fff" : "rgba(0,0,0,0.25)"}
                strokeWidth={isSelected || isHome ? 2.5 : 1}
              />
              <text x={x} y={y + 3} textAnchor="middle" fontSize={7} fill="#111" style={{ pointerEvents: "none", fontWeight: isHome ? 700 : 400 }}>
                {s}
              </text>
            </g>
          );
        })}
        {Object.entries(INSET_POSITIONS).map(([s, [x, y]]) => {
          const isHome = s === homeState;
          const isSelected = s === selectedState;
          return (
            <g key={s} onClick={() => onSelectState(s)} style={{ cursor: "pointer" }}>
              <circle
                cx={x} cy={y} r={isHome ? 11 : isSelected ? 10 : 8}
                fill={isHome ? "var(--accent, #d9670c)" : "rgb(150,150,150)"}
                stroke={isSelected || isHome ? "#fff" : "rgba(0,0,0,0.25)"}
                strokeWidth={isSelected || isHome ? 2.5 : 1}
              />
              <text x={x} y={y + 3} textAnchor="middle" fontSize={7} fill="#111" style={{ pointerEvents: "none", fontWeight: isHome ? 700 : 400 }}>
                {s}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-muted" style={{ fontSize: "0.76rem", marginTop: 4 }}>
        <span style={{ color: "var(--accent, #d9670c)" }}>●</span> {homeCity ? `${homeCity}, ${homeState}` : homeState} (your school)
        {" · "}<span style={{ color: "rgb(60,160,60)" }}>●</span> closer
        {" · "}<span style={{ color: "rgb(220,120,60)" }}>●</span> farther
        {" · click a state to filter"}
      </p>
    </div>
  );
}
