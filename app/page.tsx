import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="mock-banner">Internal · Mockup only</div>
      <div className="wrap">
        <h1>StaffingNation</h1>
        <p className="muted">Dev mockup.</p>
        <div className="panel">
          <h2>AI-driven client intake</h2>
          <p className="muted small">
            Persona → brief → adaptive AI questions → recommended services → human confirm.
          </p>
          <Link href="/clients/new">
            <button className="primary" style={{ marginTop: 8 }}>
              Create new client →
            </button>
          </Link>
        </div>
      </div>
    </>
  );
}
