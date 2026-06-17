import Link from "next/link";

const clientFlow = [
  { phase: "Intake", steps: ["Persona", "Brief", "Adaptive AI Questions", "Recommended Services", "Human Confirm"] },
  { phase: "Create", steps: ["Client Profile Details", "Create Client"] },
  { phase: "Configure", steps: ["Scopes", "Job Descriptions", "Module Config"] }
];

const orderFlow = [
  { phase: "Strategy", steps: ["Roleplay", "Work Fulfillment", "Fill Source"] },
  { phase: "Details", steps: ["Engagement", "Location", "Pay Rate"] },
  { phase: "Finish", steps: ["Review & Submit"] },
];

function FlowMap({ flow, emphasize }: { flow: { phase: string; steps: string[] }[]; emphasize?: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 0, marginTop: 14 }}>
      {flow.map((group, i) => (
        <div key={group.phase} style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ minWidth: 150 }}>
            <div className="muted small" style={{ textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
              {group.phase}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              {group.steps.map((step) => {
                const bold = step === emphasize;
                return (
                  <li key={step} className={bold ? "small" : "muted small"} style={bold ? { fontWeight: 600 } : undefined}>
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
  );
}

export default function Home() {
  return (
    <>
      <div className="mock-banner">Internal · Mockup only</div>
      <div className="wrap">
        <h1>StaffingNation</h1>
        <p className="muted">Internal Product Mockups</p>

        <div className="panel">
          <h2>AI-Driven Client Intake</h2>
          <FlowMap flow={clientFlow} emphasize="Create Client" />
          <p className="muted small" style={{ marginTop: 16 }}>
            Module Config renders only the services that are on — EOR · Staffing · International · VMS — in order, skipping the rest.
          </p>
          <Link href="/clients/new">
            <button className="primary" style={{ marginTop: 12 }}>See the flow →</button>
          </Link>
        </div>

        <div className="panel">
          <h2>Order Intake</h2>
          <FlowMap flow={orderFlow} emphasize="Review & Submit" />
          <p className="muted small" style={{ marginTop: 16 }}>
            Steps adapt to the requisition — worker requisitions add Engagement, Location, and Pay; agent and project routes differ, and Work Fulfillment is skipped when only one option applies.
          </p>
          <Link href="/orders/new">
            <button className="primary" style={{ marginTop: 12 }}>See the flow →</button>
          </Link>
        </div>
      </div>
    </>
  );
}