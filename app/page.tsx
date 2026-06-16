import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="mock-banner">Internal · Mockup only</div>
      <div className="wrap">
        <h1>StaffingNation</h1>
        <p className="muted">Internal Product Mockups</p>
        <div className="panel">
          <h2>AI-Driven Client Intake</h2>
          <p className="muted small">
            Persona → Brief → Adaptive AI Questions → Recommended Services → Human Confirm → Create Client → Client Profile Details → Scopes
          </p>
          <Link href="/clients/new">
            <button className="primary" style={{ marginTop: 8 }}>
              See The Flow →
            </button>
          </Link>
        </div>
      </div>
    </>
  );
}
