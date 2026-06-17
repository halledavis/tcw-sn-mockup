import Link from "next/link";

const flow = [
  { phase: "Intake", steps: ["Persona", "Brief", "Adaptive AI Questions", "Recommended Services", "Human Confirm"] },
  { phase: "Create", steps: ["Client Profile Details", "Create Client"] },
  { phase: "Configure", steps: ["Scopes", "Job Descriptions", "Module Config"] },
  { phase: "Finish", steps: ["Summary"] },
];

export default function Home() {
  return (
    <>
      <div className="mock-banner">Internal · Mockup only</div>
      <div className="wrap">
        <h1>StaffingNation</h1>
        <p className="muted">Internal Product Mockups</p>

        <div className="panel">
          <h2>AI-Driven Client Intake</h2>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 0, marginTop: 14 }}>
            {flow.map((group, i) => (
              <div key={group.phase} style={{ display: "flex", alignItems: "stretch" }}>
                <div style={{ minWidth: 150 }}>
                  <div className="muted small" style={{ textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                    {group.phase}
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    {group.steps.map((step) => {
                      const emphasize = step === "Create Client";
                      return (
                        <li
                          key={step}
                          className={emphasize ? "small" : "muted small"}
                          style={emphasize ? { fontWeight: 600 } : undefined}
                        >
                          {step}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {i < flow.length - 1 && (
                  <div className="muted" style={{ display: "flex", alignItems: "center", padding: "0 18px", fontSize: 18 }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="muted small" style={{ marginTop: 16 }}>
            Module Config renders only the services that are on — EOR · Staffing · International · VMS — in order, skipping the rest.
          </p>

          <Link href="/clients/new">
            <button className="primary" style={{ marginTop: 12 }}>See the flow →</button>
          </Link>
        </div>

        <div className="panel">
          <h2>Order Intake</h2>
          <p className="muted small">Coming soon.</p>
          <Link href="/orders/new">
            <button className="primary" style={{ marginTop: 12 }}>See the flow →</button>
          </Link>
        </div>
      </div>
    </>
  );
}