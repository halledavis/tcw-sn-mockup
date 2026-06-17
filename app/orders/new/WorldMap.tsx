"use client";

import { centroidFor, countryCentroid, project } from "./geo";
import type { OrderLocation } from "./actions";

// Display-only world map. Plots the client's offices and a few remote-worker
// pins derived from in-scope countries. Cosmetic — no click-to-select.
export default function WorldMap({
  locations,
  scopeCountries,
}: {
  locations: OrderLocation[];
  scopeCountries: string[];
}) {
  const offices = locations
    .map((l) => ({ label: l.name || l.city || l.country || "Office", c: centroidFor(l.country, l.state) }))
    .filter((p): p is { label: string; c: [number, number] } => p.c !== null);

  // One remote pin per in-scope country (deduped), distinct from offices.
  const remotes = Array.from(new Set(scopeCountries.map((c) => c.toUpperCase())))
    .map((code) => ({ label: code, c: countryCentroid(code) }))
    .filter((p): p is { label: string; c: [number, number] } => p.c !== null);

  const pin = (left: number, top: number, color: string, ring = false): React.CSSProperties => ({
    position: "absolute",
    left: `${left}%`,
    top: `${top}%`,
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: "50%",
    background: ring ? "transparent" : color,
    border: ring ? `2px solid ${color}` : "2px solid #fff",
    boxShadow: "0 0 0 1px rgba(0,0,0,.15)",
  });

  return (
    <div>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "2 / 1",
          maxHeight: 240,
          border: "1px solid var(--line)",
          borderRadius: 8,
          overflow: "hidden",
          // eslint-disable-next-line @next/next/no-img-element
          backgroundImage: "url(/world.svg)",
          backgroundSize: "100% 100%",
        }}
      >
        {offices.map((p, i) => {
          const { left, top } = project(p.c);
          return <span key={`o${i}`} title={`Office: ${p.label}`} style={pin(left, top, "var(--accent, #2563eb)")} />;
        })}
        {remotes.map((p, i) => {
          const { left, top } = project(p.c);
          return <span key={`r${i}`} title={`Remote scope: ${p.label}`} style={pin(left, top, "#e0791b", true)} />;
        })}
      </div>
      <div className="row small muted" style={{ marginTop: 6, gap: 16 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent, #2563eb)", border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.15)" }} />
          Office locations
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "transparent", border: "2px solid #e0791b" }} />
          Remote scope (in-scope countries)
        </span>
      </div>
    </div>
  );
}
