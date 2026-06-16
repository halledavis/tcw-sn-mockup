import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ServiceRow = { status: string; source: string; service: { code: string; name: string } | null };
type ModuleRow = { enabled: boolean; source: string | null; module: { code: string; name: string } | null };
type ContactRow = { kind: string; first_name: string; last_name: string; email: string; phone: string | null };
type Address = { street?: string; city?: string; state?: string; zip?: string; country?: string } | null;
type CountryRow = { country_code: string; addendum_status: string; addendum_ref: string | null };
type SubRow = { country_code: string; subdivision_code: string; subdivision_type: string };
type LocationRow = {
  name: string | null; street: string | null; city: string | null; state: string | null;
  country: string | null; postal: string | null; internal_id: string | null; is_primary: boolean;
};
type DeptRow = { name: string; internal_id: string | null };

const ADDENDUM_BADGE: Record<string, string> = {
  not_applicable: "n/a",
  pending: "addendum pending",
  draft: "addendum draft",
  sent: "addendum sent",
  signed: "addendum signed",
};

const locName = (l: LocationRow) =>
  l.name?.trim() || [l.street, [l.city, l.state, l.country].filter(Boolean).join(", ")].filter(Boolean).join(" – ");

export default async function ClientSummary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: entity } = await supabase
    .from("entity")
    .select(
      "id, legal_name, dba_name, kind, status, default_eor_id, address, fein, duns, website, default_currency, description, logo_url",
    )
    .eq("id", id)
    .single();

  if (!entity) notFound();

  const [
    { data: svcData },
    { data: modData },
    { data: contactData },
    { data: countryData },
    { data: subData },
    { data: locData },
    { data: deptData },
  ] = await Promise.all([
    supabase.from("entity_service").select("status, source, service:service_id(code, name)").eq("entity_id", id),
    supabase.from("entity_module").select("enabled, source, module:module_id(code, name)").eq("entity_id", id),
    supabase.from("entity_contact").select("kind, first_name, last_name, email, phone").eq("entity_id", id),
    supabase.from("client_country_scope").select("country_code, addendum_status, addendum_ref").eq("entity_id", id).order("country_code"),
    supabase.from("client_subdivision_scope").select("country_code, subdivision_code, subdivision_type").eq("entity_id", id).order("country_code"),
    supabase.from("location").select("name, street, city, state, country, postal, internal_id, is_primary").eq("entity_id", id),
    supabase.from("department").select("name, internal_id").eq("entity_id", id).order("name"),
  ]);

  const services = (svcData ?? []) as unknown as ServiceRow[];
  const modules = (modData ?? []) as unknown as ModuleRow[];
  const contacts = (contactData ?? []) as unknown as ContactRow[];
  const countries = (countryData ?? []) as unknown as CountryRow[];
  const subdivisions = (subData ?? []) as unknown as SubRow[];
  const locations = (locData ?? []) as unknown as LocationRow[];
  const departments = (deptData ?? []) as unknown as DeptRow[];
  const addr = (entity.address ?? null) as Address;
  const addrLine = addr
    ? [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(", ")
    : "";

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
          <h2>Client profile</h2>
          {entity.logo_url && (
            <img src={entity.logo_url} alt="logo" style={{ height: 48, borderRadius: 6, border: "1px solid var(--line)", marginBottom: 8 }} />
          )}
          <div className="small">
            {entity.dba_name && <div className="spread" style={{ padding: "4px 0" }}><span className="muted">DBA</span><span>{entity.dba_name}</span></div>}
            {addrLine && <div className="spread" style={{ padding: "4px 0" }}><span className="muted">Office</span><span>{addrLine}</span></div>}
            {entity.fein && <div className="spread" style={{ padding: "4px 0" }}><span className="muted">FEIN</span><span>{entity.fein}</span></div>}
            {entity.duns && <div className="spread" style={{ padding: "4px 0" }}><span className="muted">DUNS</span><span>{entity.duns}</span></div>}
            {entity.website && <div className="spread" style={{ padding: "4px 0" }}><span className="muted">Website</span><span>{entity.website}</span></div>}
            {entity.default_currency && <div className="spread" style={{ padding: "4px 0" }}><span className="muted">Currency</span><span>{entity.default_currency}</span></div>}
          </div>
          {entity.description && <p className="muted" style={{ marginTop: 8 }}>{entity.description}</p>}
        </div>

        <div className="panel">
          <h2>Contacts</h2>
          {contacts.length === 0 && <p className="muted">None.</p>}
          {contacts.map((c, i) => (
            <div key={i} className="spread" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <span>
                {c.first_name} {c.last_name}{" "}
                <span className="pill">{c.kind === "signatory" ? "Signatory" : "Primary"}</span>
              </span>
              <span className="small muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span>
            </div>
          ))}
        </div>

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

        <div className="panel">
          <h2>In-scope countries</h2>
          {countries.length === 0 && <p className="muted">None.</p>}
          {countries.map((c, i) => (
            <div key={i} className="spread" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <span>{c.country_code}</span>
              <span className="small muted">
                <span className={`pill ${c.addendum_status === "signed" ? "on" : ""}`}>
                  {ADDENDUM_BADGE[c.addendum_status] ?? c.addendum_status}
                </span>
                {c.addendum_ref ? ` · ${c.addendum_ref}` : ""}
              </span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Subdivisions</h2>
          {subdivisions.length === 0 && <p className="muted">None.</p>}
          {subdivisions.map((s, i) => (
            <div key={i} className="spread" style={{ padding: "4px 0" }}>
              <span>
                {s.country_code} · {s.subdivision_code}
              </span>
              <span className="small muted">{s.subdivision_type}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Locations</h2>
          {locations.length === 0 && <p className="muted">None.</p>}
          {locations.map((l, i) => (
            <div key={i} className="spread" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <span>
                {locName(l)} {l.is_primary && <span className="pill on">primary</span>}
              </span>
              <span className="small muted">{l.internal_id ?? ""}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Departments</h2>
          {departments.length === 0 && <p className="muted">None.</p>}
          {departments.map((d, i) => (
            <div key={i} className="spread" style={{ padding: "4px 0" }}>
              <span>{d.name}</span>
              <span className="small muted">{d.internal_id ?? ""}</span>
            </div>
          ))}
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
