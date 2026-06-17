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

          <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {flow.map((group) => (
              <li key={group.phase}>
                <div className="muted small" style={{ textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                  {group.phase}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {group.steps.map((step, i) => (
                    <span key={step} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--line)",
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          fontWeight: step === "Create Client" ? 600 : 400,
                        }}
                      >
                        {step}
                      </span>
                      {i < group.steps.length - 1 && <span className="muted" style={{ fontSize: 12 }}>→</span>}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <p className="muted small" style={{ marginTop: 12 }}>
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