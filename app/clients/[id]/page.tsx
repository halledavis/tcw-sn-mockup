import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ServiceRow = { status: string; source: string; service: { code: string; name: string } | null };
type ModuleRow = { enabled: boolean; source: string | null; module: { code: string; name: string } | null };

export default async function ClientSummary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: entity } = await supabase
    .from("entity")
    .select("id, legal_name, kind, status, default_eor_id")
    .eq("id", id)
    .single();

  if (!entity) notFound();

  const [{ data: svcData }, { data: modData }] = await Promise.all([
    supabase.from("entity_service").select("status, source, service:service_id(code, name)").eq("entity_id", id),
    supabase.from("entity_module").select("enabled, source, module:module_id(code, name)").eq("entity_id", id),
  ]);

  const services = (svcData ?? []) as unknown as ServiceRow[];
  const modules = (modData ?? []) as unknown as ModuleRow[];

  let eorName: string | null = null;
  if (entity.default_eor_id) {
    const { data: eor } = await supabase
      .from("entity")
      .select("legal_name, dba_name")
      .eq("id", entity.default_eor_id)
      .single();
    eorName = eor?.dba_name ?? eor?.legal_name ?? null;
  }

  return (
    <>
      <div className="mock-banner">Internal · Mockup only</div>
      <div className="wrap">
        <h1>{entity.legal_name}</h1>
        <p className="muted small">
          <span className="pill on">{entity.status}</span>
          <span className="pill">{entity.kind}</span> Prospect provisioned from AI intake.
        </p>

        <div className="panel">
          <h2>Provisioned services</h2>
          {services.length === 0 && <p className="muted">None.</p>}
          {services.map((s, i) => (
            <div key={i} className="spread" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span>{s.service?.name ?? "—"}</span>
              <span className="small muted">
                <span className="pill">{s.status}</span>
                <span className={`pill ${s.source === "ai" ? "on" : ""}`}>{s.source}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Resolved module toggles</h2>
          {modules.length === 0 && <p className="muted">None.</p>}
          {modules.map((m, i) => (
            <div key={i} className="spread" style={{ padding: "6px 0" }}>
              <span>
                {m.module?.name ?? "—"}{" "}
                <span className="pill on">{m.enabled ? "on" : "off"}</span>
              </span>
              <span className="small muted">{m.source}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Employer of Record</h2>
          {eorName ? (
            <p>
              Defaulted to <strong>{eorName}</strong> (master EoR).
            </p>
          ) : (
            <p className="muted">No EoR defaulted (EoR service not selected).</p>
          )}
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <Link href={`/clients/${entity.id}/setup`}>
            <button className="primary">Continue setup →</button>
          </Link>
          <Link href="/clients/new">
            <button>Create another</button>
          </Link>
        </div>
      </div>
    </>
  );
}
