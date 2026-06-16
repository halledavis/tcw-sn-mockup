import Link from "next/link";

export default async function ContinueSetup({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="mock-banner">Internal · Mockup only</div>
      <div className="wrap">
        <h1>Continue setup</h1>
        <p className="muted">
          Placeholder. The intake recorded the client&apos;s services and module toggles; the
          remaining back-half branches off those selections and is stubbed for now.
        </p>
        <div className="panel">
          <h2>Stubbed for later</h2>
          <ul className="tight muted">
            <li>Profile, subsidiaries &amp; first-admin</li>
            <li>International compliance → countries</li>
            <li>VMS → agencies</li>
            <li>IC / 1099 → IC evaluation</li>
            <li>Onboarding &amp; prescreening</li>
          </ul>
          <p className="small muted">Selections are already recorded — these screens branch off them.</p>
        </div>
        <Link href={`/clients/${id}`}>
          <button style={{ marginTop: 16 }}>← Back to summary</button>
        </Link>
      </div>
    </>
  );
}
