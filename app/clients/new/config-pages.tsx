"use client";

import { useEffect, useState } from "react";
import type { ServiceCode } from "@/lib/catalog";
import {
  deriveBillCards,
  listBillCards,
  listRiskTiers,
  saveBillCards,
  type BillCardServiceType,
} from "@/app/clients/[id]/job-titles/actions";
import { setEorExclusive } from "@/app/clients/[id]/config/actions";

// Module-gated config-page registry.
//
// Each entry declares a config page that the wizard renders AFTER the base
// flow, but only when its `gateService` is among the client's selected
// services. Pages render in ascending `order`, are skippable, and write
// entity_config_status as they're completed/skipped.
//
// Adding a future module's config page = one entry here + its component.

export type ConfigPageProps = {
  entityId: string;
  isLast: boolean;
  busy: boolean; // wizard-level busy (during the status write)
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
};

export type ConfigPageDef = {
  key: string;
  label: string;
  gateService: ServiceCode;
  order: number;
  component: React.ComponentType<ConfigPageProps>;
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: 10,
  marginTop: 4,
  border: "1px solid var(--line)",
  borderRadius: 8,
  font: "inherit",
};

// Shared footer nav for every config page.
function ConfigNav({
  isLast,
  busy,
  onBack,
  onSkip,
  onComplete,
}: {
  isLast: boolean;
  busy: boolean;
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="row" style={{ marginTop: 20 }}>
      <button disabled={busy} onClick={onBack}>← Back</button>
      <button disabled={busy} onClick={onSkip}>{busy ? "…" : "Skip"}</button>
      <button className="primary" disabled={busy} onClick={onComplete}>
        {busy ? "Saving…" : isLast ? "Finish →" : "Mark complete →"}
      </button>
    </div>
  );
}

// --- Shared bill-card editor (used by EoR + Staffing) -----------------------
type CardRow = { id: string; risk_tier_id: string | null; markup_pct: number | null; states: string; status: "draft" | "active" };

const parseStates = (s: string) => {
  const parts = s.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
  return parts.length ? parts : ["ALL"];
};
const statesToString = (states: unknown) => (Array.isArray(states) ? (states as string[]).join(", ") : "ALL");

// Loads any existing cards for (entity, serviceType) so the page resumes, and
// exposes generate/edit/save scoped to that service type.
function useBillCards(entityId: string, serviceType: BillCardServiceType) {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [tierName, setTierName] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tiers, existing] = await Promise.all([listRiskTiers(), listBillCards(entityId, serviceType)]);
      if (cancelled) return;
      setTierName(Object.fromEntries(tiers.map((t) => [t.id, t.name])));
      setCards(
        existing.map((c) => ({
          id: c.id,
          risk_tier_id: c.risk_tier_id,
          markup_pct: c.markup_pct,
          states: statesToString(c.states),
          status: c.status as "draft" | "active",
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, serviceType]);

  async function generate() {
    setError("");
    setGenerating(true);
    const res = await deriveBillCards(entityId, serviceType);
    setGenerating(false);
    if (!res.ok) return setError(res.error);
    setCards((prev) => {
      const have = new Set(prev.map((c) => c.id));
      const fresh = res.cards
        .filter((c) => !have.has(c.id))
        .map((c) => ({
          id: c.id,
          risk_tier_id: c.risk_tier_id,
          markup_pct: c.markup_pct,
          states: statesToString(c.states),
          status: c.status as "draft" | "active",
        }));
      return [...prev, ...fresh];
    });
  }

  const patch = (i: number, p: Partial<CardRow>) => setCards((prev) => prev.map((c, j) => (j === i ? { ...c, ...p } : c)));

  async function save(): Promise<boolean> {
    if (cards.length === 0) return true;
    const res = await saveBillCards(
      cards.map((c) => ({ id: c.id, markup_pct: c.markup_pct, states: parseStates(c.states), status: c.status })),
    );
    if (!res.ok) {
      setError(res.error ?? "Save failed.");
      return false;
    }
    return true;
  }

  return { cards, tierName, generating, error, generate, patch, save };
}

function BillCardsSection({
  bc,
  serviceLabel,
}: {
  bc: ReturnType<typeof useBillCards>;
  serviceLabel: string;
}) {
  return (
    <>
      <p className="muted small">
        One draft card per risk tier present across your confirmed page-6 titles, seeded with the tier&apos;s default
        markup. Bill rate = pay × (1 + markup). These cards are tagged <span className="pill">{serviceLabel}</span>.
      </p>
      <button className="primary" disabled={bc.generating} onClick={bc.generate}>
        {bc.generating ? "Generating…" : "Generate bill cards"}
      </button>

      {bc.cards.length === 0 && (
        <p className="muted small" style={{ marginTop: 8 }}>
          No cards yet — confirm titles with risk tiers on the Job descriptions page, then generate.
        </p>
      )}

      {bc.cards.map((c, i) => (
        <div key={c.id} className="rec" style={{ marginTop: 10 }}>
          <div className="row">
            <strong style={{ flex: 1, marginTop: 20 }}>{c.risk_tier_id ? bc.tierName[c.risk_tier_id] ?? "Tier" : "No tier"}</strong>
            <div style={{ flex: 1 }}>
              <label className="small muted">Markup %</label>
              <input
                style={inp}
                type="number"
                value={c.markup_pct ?? ""}
                onChange={(e) => bc.patch(i, { markup_pct: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="small muted">States (comma, or ALL)</label>
              <input style={inp} value={c.states} onChange={(e) => bc.patch(i, { states: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="small muted">Status</label>
              <select style={inp} value={c.status} onChange={(e) => bc.patch(i, { status: e.target.value as "draft" | "active" })}>
                <option value="draft">draft</option>
                <option value="active">active</option>
              </select>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// --- EoR config page --------------------------------------------------------
function EorConfig(props: ConfigPageProps) {
  const bc = useBillCards(props.entityId, "eor");
  const [exclusive, setExclusive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function complete() {
    setSaving(true);
    setError("");
    if (!(await bc.save())) {
      setSaving(false);
      return setError(bc.error || "Save failed.");
    }
    const r = await setEorExclusive({ entityId: props.entityId, exclusive });
    setSaving(false);
    if (!r.ok) return setError(r.error ?? "Save failed.");
    props.onComplete();
  }

  const busy = saving || props.busy;
  return (
    <>
      <h2>Employer of Record configuration</h2>

      <h3 style={{ marginTop: 16 }}>Bill cards</h3>
      <BillCardsSection bc={bc} serviceLabel="eor" />

      <h3 style={{ marginTop: 24 }}>Payroll employer</h3>
      <label className="small" style={{ display: "block", marginTop: 6 }}>
        <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} /> TargetCW exclusive
        for payroll
      </label>
      <p className="muted small" style={{ marginTop: 4 }}>
        {exclusive
          ? "TargetCW is the sole EoR (other EoRs barred); the client's default EoR stays TargetCW."
          : "Other EoRs allowed — the existing default EoR is left as-is for this mockup."}
      </p>

      <div className="panel mock" style={{ marginTop: 16 }}>
        <p className="small" style={{ marginTop: 0 }}>
          Stub — deeper EoR settings (pay frequency, payroll currency, benefits billing) aren&apos;t built in this
          mockup. They&apos;d be configured here.
        </p>
      </div>

      {error && <div className="err">{error}</div>}
      <ConfigNav isLast={props.isLast} busy={busy} onBack={props.onBack} onSkip={props.onSkip} onComplete={complete} />
    </>
  );
}

// --- Staffing config page ---------------------------------------------------
function StaffingConfig(props: ConfigPageProps) {
  const bc = useBillCards(props.entityId, "staffing");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function complete() {
    setSaving(true);
    setError("");
    const ok = await bc.save();
    setSaving(false);
    if (!ok) return setError(bc.error || "Save failed.");
    props.onComplete();
  }

  const busy = saving || props.busy;
  return (
    <>
      <h2>Staffing configuration</h2>

      <h3 style={{ marginTop: 16 }}>Bill cards</h3>
      <BillCardsSection bc={bc} serviceLabel="staffing" />

      <div className="panel mock" style={{ marginTop: 16 }}>
        <p className="small" style={{ marginTop: 0 }}>
          Stub — deeper staffing settings (sourcing groups, marketplace tiers, staffing-difficulty markup) aren&apos;t
          built in this mockup. They&apos;d be configured here.
        </p>
      </div>

      {error && <div className="err">{error}</div>}
      <ConfigNav isLast={props.isLast} busy={busy} onBack={props.onBack} onSkip={props.onSkip} onComplete={complete} />
    </>
  );
}

// --- International config page (gated placeholder) --------------------------
// Gated on globalized_compliance; body intentionally blank for now.
function InternationalConfig(props: ConfigPageProps) {
  return (
    <>
      <h2>International configuration</h2>
      <div className="panel mock" style={{ marginTop: 8 }}>
        <p className="small" style={{ marginTop: 0 }}>Configuration coming soon.</p>
      </div>
      <ConfigNav
        isLast={props.isLast}
        busy={props.busy}
        onBack={props.onBack}
        onSkip={props.onSkip}
        onComplete={props.onComplete}
      />
    </>
  );
}

// --- VMS / MSP config page (gated placeholder) ------------------------------
// The real VMS build (standardized bill rate, vendor-neutral, managed
// internally/externally, agency/vendor groups, tiered order release, vetting,
// and the billing-model setting that decides whether VMS rate cards are
// created) is its own session.
function VmsConfig(props: ConfigPageProps) {
  return (
    <>
      <h2>VMS / MSP configuration</h2>
      <div className="panel mock" style={{ marginTop: 8 }}>
        <p className="small" style={{ marginTop: 0 }}>Full VMS settings are coming in a later build.</p>
      </div>
      <ConfigNav
        isLast={props.isLast}
        busy={props.busy}
        onBack={props.onBack}
        onSkip={props.onSkip}
        onComplete={props.onComplete}
      />
    </>
  );
}

export const CONFIG_PAGES: ConfigPageDef[] = [
  { key: "eor", label: "EoR configuration", gateService: "eor", order: 10, component: EorConfig },
  { key: "staffing", label: "Staffing configuration", gateService: "staffing", order: 20, component: StaffingConfig },
  { key: "international", label: "International configuration", gateService: "globalized_compliance", order: 30, component: InternationalConfig },
  { key: "vms", label: "VMS / MSP configuration", gateService: "vms", order: 40, component: VmsConfig },
];

// The ordered config pages whose gating service is enabled for this client.
export function enabledConfigPages(selectedServices: Iterable<string>): ConfigPageDef[] {
  const set = selectedServices instanceof Set ? selectedServices : new Set(selectedServices);
  return CONFIG_PAGES.filter((p) => set.has(p.gateService)).sort((a, b) => a.order - b.order);
}
