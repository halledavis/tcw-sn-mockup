"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  SERVICES,
  COUNTRIES,
  subdivisionsFor,
  RISK_TIERS,
  type Persona,
  type Recommendation,
  type TranscriptTurn,
} from "@/lib/catalog";
import { interviewAction, synthesizeAction, confirmIntakeAction, describeAction } from "./actions";
import { saveScopeAndOrg, enableGlobalizedCompliance } from "@/app/clients/[id]/scope/actions";
import {
  categorizeJobTitle,
  saveJobTitles,
  deriveBillCards,
  listRiskTiers,
  saveBillCards,
} from "@/app/clients/[id]/job-titles/actions";

type Step = "persona" | "brief" | "qa" | "recs" | "builder" | "scope" | "jobtitles";

const inp: React.CSSProperties = {
  width: "100%",
  padding: 10,
  marginTop: 4,
  border: "1px solid var(--line)",
  borderRadius: 8,
  font: "inherit",
};

const emptyContact = { first_name: "", last_name: "", email: "", phone: "" };
type Contact = typeof emptyContact;

const emptyLoc = { name: "", street: "", city: "", state: "", country: "", postal: "", internal_id: "", is_primary: false };
type Loc = typeof emptyLoc;

type Clarify = { question: string; answer: string };
type TitleRow = {
  title: string;
  blurb: string;
  clarifications: Clarify[];
  tier: string | null; // risk_tier code, or null = needs review
  why: string;
  needs_review: boolean;
  confirmed: boolean;
  question: string | null; // pending clarifying question
  answerDraft: string;
  busy: boolean;
};
type CardRow = { id: string; risk_tier_id: string; markup_pct: number | null; states: string; status: "draft" | "active" };

const newTitleRow = (title: string): TitleRow => ({
  title,
  blurb: "",
  clarifications: [],
  tier: null,
  why: "",
  needs_review: false,
  confirmed: false,
  question: null,
  answerDraft: "",
  busy: false,
});

export default function NewClientWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("persona");

  const [persona, setPersona] = useState<Persona | null>(null);
  const [brief, setBrief] = useState("");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState(false);

  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [signals, setSignals] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState(false); // skipped the AI interview

  // Page 4 — client builder profile
  const [legalName, setLegalName] = useState("");
  const [dba, setDba] = useState("");
  const [fein, setFein] = useState("");
  const [feinLater, setFeinLater] = useState(false);
  const [duns, setDuns] = useState("");
  const [dunsLater, setDunsLater] = useState(false);
  const [website, setWebsite] = useState("");
  const [currency, setCurrency] = useState("");
  const [description, setDescription] = useState("");
  const [autofilling, setAutofilling] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [spoc, setSpoc] = useState<Contact>(emptyContact);
  const [ppoc, setPpoc] = useState<Contact>(emptyContact);
  const [ppocSame, setPpocSame] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  // Page 5 — operating scope & org structure
  const [entityId, setEntityId] = useState<string | null>(null);
  const [complianceOn, setComplianceOn] = useState(false);
  const [scopeCountries, setScopeCountries] = useState<string[]>([]);
  const [subs, setSubs] = useState<Record<string, string[]>>({});
  const [locations, setLocations] = useState<Loc[]>([]);
  const [locForm, setLocForm] = useState<Loc>({ ...emptyLoc });
  const [departments, setDepartments] = useState<{ name: string; internal_id: string }[]>([]);
  const [deptForm, setDeptForm] = useState({ name: "", internal_id: "" });
  const [scopeNotes, setScopeNotes] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [enabling, setEnabling] = useState(false);

  // Page 6 — job types & bill cards
  const [titleRows, setTitleRows] = useState<TitleRow[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [cards, setCards] = useState<CardRow[]>([]);
  const [tierById, setTierById] = useState<Record<string, { code: string; name: string }>>({});
  const [generating, setGenerating] = useState(false);
  const [savingFinal, setSavingFinal] = useState(false);

  const recommendedReasons = new Map<string, string>((recs ?? []).map((r) => [r.service_code, r.reason]));

  async function startInterview() {
    if (!persona) return;
    setStep("qa");
    setThinking(true);
    const stepRes = await interviewAction({ persona, brief, transcript: [] });
    setThinking(false);
    if ("done" in stepRes) return goToRecs([]);
    setQuestion(stepRes.next_question);
  }

  async function sendAnswer() {
    if (!persona || !question || !answer.trim()) return;
    const next: TranscriptTurn[] = [
      ...transcript,
      { role: "ai", content: question },
      { role: "user", content: answer.trim() },
    ];
    setTranscript(next);
    setQuestion(null);
    setAnswer("");
    setThinking(true);
    const stepRes = await interviewAction({ persona, brief, transcript: next });
    setThinking(false);
    if ("done" in stepRes) return goToRecs(next);
    setQuestion(stepRes.next_question);
  }

  async function goToRecs(finalTranscript: TranscriptTurn[]) {
    if (!persona) return;
    setStep("recs");
    setThinking(true);
    const res = await synthesizeAction({ persona, brief, transcript: finalTranscript });
    setRecs(res.recommendations);
    setSignals(res.inferred_signals ?? {});
    setSelected(new Set(res.recommendations.map((r) => r.service_code)));
    setThinking(false);
  }

  // Skip the AI interview entirely and pick services/modules by hand.
  function skipToServices() {
    setManual(true);
    setRecs([]); // empty (not null) so the recs screen renders with nothing pre-checked
    setSignals({});
    setSelected(new Set());
    setStep("recs");
  }

  function toggle(code: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  }

  // Page 3 -> Page 4
  function goToBuilder() {
    setError("");
    if (selected.size === 0) return setError("Select at least one service.");
    setStep("builder");
  }

  async function autofillDescription() {
    setAutofilling(true);
    const { description: d } = await describeAction({ website, legalName });
    if (d) setDescription(d);
    setAutofilling(false);
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(f);
  }

  async function confirm() {
    setError("");
    if (!persona) return;
    if (!legalName.trim()) return setError("Legal entity name is required.");
    setConfirming(true);
    const primary = ppocSame ? spoc : ppoc;
    const selections = [...selected].map((code) => ({
      service_code: code as Recommendation["service_code"],
      source: (recommendedReasons.has(code) ? "ai" : "manual") as "ai" | "manual",
    }));
    const res = await confirmIntakeAction({
      legalName,
      dba,
      fein: feinLater ? "" : fein,
      duns: dunsLater ? "" : duns,
      website,
      currency,
      description,
      logoUrl,
      persona,
      brief,
      transcript,
      inferredSignals: signals,
      selections,
      contacts: [
        { kind: "signatory", ...spoc },
        { kind: "primary", ...primary },
      ],
    });
    if (res.ok) {
      // Client created — continue to page 5 (operating scope & org) instead of
      // jumping straight to the summary.
      setEntityId(res.entityId);
      setComplianceOn(selected.has("globalized_compliance"));
      setConfirming(false);
      setError("");
      setStep("scope");
    } else {
      setConfirming(false);
      setError(res.error);
    }
  }

  // --- Page 5 helpers ---
  const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
  const hasNonUS = scopeCountries.some((c) => c !== "US");

  function addCountry(code: string) {
    if (!code) return;
    setScopeCountries((prev) => (prev.includes(code) ? prev : [...prev, code]));
  }
  function removeCountry(code: string) {
    setScopeCountries((prev) => prev.filter((c) => c !== code));
    setSubs((prev) => {
      const n = { ...prev };
      delete n[code];
      return n;
    });
  }
  function toggleCountry(code: string) {
    if (scopeCountries.includes(code)) removeCountry(code);
    else addCountry(code);
  }
  function toggleSub(country: string, code: string) {
    setSubs((prev) => {
      const cur = prev[country] ?? [];
      return { ...prev, [country]: cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code] };
    });
  }
  function selectAllSubs(country: string, list: { code: string }[]) {
    setSubs((prev) => ({ ...prev, [country]: list.map((s) => s.code) }));
  }
  function clearSubs(country: string) {
    setSubs((prev) => ({ ...prev, [country]: [] }));
  }
  const locLabel = (l: Loc) => l.name.trim() || `${l.street} – ${l.city}, ${l.state}, ${l.country}`;

  function addLocation() {
    if (!locForm.country && !locForm.city && !locForm.street) return;
    const l = { ...locForm };
    setLocations((prev) => {
      // Single primary: if this one is primary, clear the others; if nothing is
      // primary yet, make this new one primary.
      const base = l.is_primary ? prev.map((p) => ({ ...p, is_primary: false })) : prev;
      const next = [...base, l];
      if (!next.some((p) => p.is_primary)) next[next.length - 1] = { ...next[next.length - 1], is_primary: true };
      return next;
    });
    // Mirror the server's auto-add: surface a note when a location's country/
    // state isn't already in scope, and add it to scope so the UI stays in sync.
    const notes: string[] = [];
    if (l.country && !scopeCountries.includes(l.country)) {
      setScopeCountries((prev) => (prev.includes(l.country) ? prev : [...prev, l.country]));
      notes.push(`Auto-added ${countryName(l.country)} to scope${l.country !== "US" ? " (addendum pending)" : ""}, from ${locLabel(l)}.`);
    }
    if (l.country && l.state && !(subs[l.country] ?? []).includes(l.state)) {
      setSubs((prev) => ({ ...prev, [l.country]: [...(prev[l.country] ?? []), l.state] }));
      notes.push(`Auto-added ${l.country} subdivision ${l.state} to scope, from ${locLabel(l)}.`);
    }
    if (notes.length) setScopeNotes((prev) => [...prev, ...notes]);
    setLocForm({ ...emptyLoc });
  }

  function setPrimary(index: number) {
    setLocations((prev) => prev.map((p, i) => ({ ...p, is_primary: i === index })));
  }

  function addDept() {
    if (!deptForm.name.trim()) return;
    setDepartments((prev) => [...prev, { ...deptForm }]);
    setDeptForm({ name: "", internal_id: "" });
  }

  async function enableCompliance() {
    if (!entityId) return;
    setEnabling(true);
    const res = await enableGlobalizedCompliance(entityId);
    setEnabling(false);
    if (res.ok) setComplianceOn(true);
    else setError(res.error ?? "Failed to enable Globalized Compliance.");
  }

  async function finishScope() {
    if (!entityId) return;
    setError("");
    if (locations.length === 0) return setError("Add at least one location, and mark one as primary.");
    if (!locations.some((l) => l.is_primary)) return setError("Mark one location as primary.");
    setFinishing(true);
    const subdivisions = Object.entries(subs).flatMap(([cc, codes]) =>
      codes.map((code) => ({
        country_code: cc,
        subdivision_code: code,
        subdivision_type: (cc === "CA" ? "province" : "state") as "state" | "province",
      })),
    );
    const res = await saveScopeAndOrg(entityId, {
      countries: scopeCountries.map((c) => ({ country_code: c })),
      subdivisions,
      locations,
      departments,
    });
    if (res.ok) {
      // Advance to page 6 (job types & bill cards) instead of the summary.
      setFinishing(false);
      setStep("jobtitles");
    } else {
      setFinishing(false);
      setError(res.warnings[0] ?? "Save failed.");
    }
  }

  // --- Page 6 helpers ---
  const patchRow = (i: number, patch: Partial<TitleRow>) =>
    setTitleRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function addPastedTitles() {
    const lines = pasteText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    setTitleRows((prev) => [...prev, ...lines.map(newTitleRow)]);
    setPasteText("");
  }

  async function categorizeRow(i: number) {
    const r = titleRows[i];
    if (!r || !r.title.trim()) return;
    patchRow(i, { busy: true });
    const res = await categorizeJobTitle({ title: r.title, blurb: r.blurb || undefined, clarifications: r.clarifications });
    if ("clarifying_question" in res) {
      patchRow(i, { busy: false, question: res.clarifying_question });
    } else {
      patchRow(i, { busy: false, question: null, tier: res.risk_tier_code, why: res.why, needs_review: res.needs_review, confirmed: false });
    }
  }

  async function categorizeAll() {
    for (let i = 0; i < titleRows.length; i++) {
      if (!titleRows[i].tier && !titleRows[i].question) await categorizeRow(i);
    }
  }

  async function submitClarify(i: number) {
    const r = titleRows[i];
    if (!r.question || !r.answerDraft.trim()) return;
    const clarifications = [...r.clarifications, { question: r.question, answer: r.answerDraft.trim() }];
    patchRow(i, { clarifications, question: null, answerDraft: "", busy: true });
    const res = await categorizeJobTitle({ title: r.title, blurb: r.blurb || undefined, clarifications });
    if ("clarifying_question" in res) patchRow(i, { busy: false, question: res.clarifying_question });
    else patchRow(i, { busy: false, question: null, tier: res.risk_tier_code, why: res.why, needs_review: res.needs_review });
  }

  function setRowTier(i: number, code: string) {
    patchRow(i, { tier: code || null, needs_review: !code });
  }
  const titlePayload = () =>
    titleRows.map((r) => ({
      title: r.title,
      blurb: r.blurb || undefined,
      risk_tier_code: (r.tier ?? null) as null | string,
      ai_rationale: r.why || undefined,
      needs_review: !r.tier,
      clarifications: r.clarifications,
    }));
  const parseStates = (s: string) => {
    const parts = s.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
    return parts.length ? parts : ["ALL"];
  };

  async function generateCards() {
    if (!entityId) return;
    setError("");
    if (titleRows.length === 0) return setError("Add at least one job title.");
    if (!titleRows.every((r) => r.confirmed)) return setError("Confirm every title before generating bill cards.");
    setGenerating(true);
    const saved = await saveJobTitles(entityId, titlePayload());
    if (!saved.ok) {
      setGenerating(false);
      return setError(saved.error);
    }
    const [tiers, derived] = await Promise.all([listRiskTiers(), deriveBillCards(entityId)]);
    setTierById(Object.fromEntries(tiers.map((t) => [t.id, { code: t.code, name: t.name }])));
    if (!derived.ok) {
      setGenerating(false);
      return setError(derived.error);
    }
    setCards((prev) => {
      const have = new Set(prev.map((c) => c.id));
      const fresh: CardRow[] = derived.cards
        .filter((c) => !have.has(c.id))
        .map((c) => ({
          id: c.id,
          risk_tier_id: c.risk_tier_id,
          markup_pct: c.markup_pct,
          states: Array.isArray(c.states) ? (c.states as string[]).join(", ") : "ALL",
          status: c.status as "draft" | "active",
        }));
      return [...prev, ...fresh];
    });
    setGenerating(false);
  }

  const patchCard = (i: number, patch: Partial<CardRow>) =>
    setCards((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  async function finishJobTitles() {
    if (!entityId) return;
    setError("");
    setSavingFinal(true);
    if (titleRows.length) {
      const sr = await saveJobTitles(entityId, titlePayload());
      if (!sr.ok) {
        setSavingFinal(false);
        return setError(sr.error);
      }
    }
    if (cards.length) {
      const cr = await saveBillCards(
        cards.map((c) => ({ id: c.id, markup_pct: c.markup_pct, states: parseStates(c.states), status: c.status })),
      );
      if (!cr.ok) {
        setSavingFinal(false);
        return setError(cr.error ?? "Save failed.");
      }
    }
    router.push(`/clients/${entityId}`);
  }

  // Small reusable contact field group.
  const contactFields = (c: Contact, set: (c: Contact) => void, disabled = false) => (
    <>
      <div className="row">
        <div style={{ flex: 1 }}>
          <label className="small muted">First name</label>
          <input style={inp} disabled={disabled} value={c.first_name} onChange={(e) => set({ ...c, first_name: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="small muted">Last name</label>
          <input style={inp} disabled={disabled} value={c.last_name} onChange={(e) => set({ ...c, last_name: e.target.value })} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="small muted">Email</label>
          <input style={inp} disabled={disabled} value={c.email} onChange={(e) => set({ ...c, email: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="small muted">Phone (optional)</label>
          <input style={inp} disabled={disabled} value={c.phone} onChange={(e) => set({ ...c, phone: e.target.value })} />
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="mock-banner">Internal · Mockup only — no real data</div>
      <div className="wrap">
        <h1>Create New Client</h1>

        {/* Screen 1 — persona */}
        {step === "persona" && (
          <div className="panel mock">
            <div className="steps">PRE-CREATE CONFIG</div>
            <h2>INTERNAL MOCKUP PAGE ONLY: What are you roleplaying as?</h2>
            <button className={`choice ${persona === "cra" ? "selected" : ""}`} onClick={() => setPersona("cra")}>
              <strong>Prospect with CRA</strong>
              <div className="muted small">A client connected with TCWGlobal and the CRA is walking them through onboarding.</div>
            </button>
            <button className={`choice ${persona === "prospect" ? "selected" : ""}`} onClick={() => setPersona("prospect")}>
              <strong>Prospect Only</strong>
              <div className="muted small">A prospect found staffingnation.com and is trying to sign up.</div>
            </button>
            <button className="primary" disabled={!persona} onClick={() => setStep("brief")}>
              Continue →
            </button>
          </div>
        )}

        {/* Screen 2 — brief */}
        {step === "brief" && (
          <div className="panel">
            <div className="steps">Step 1 of 6</div>
    <h2
      style={{
        textAlign: "center",
        fontWeight: "bold",
        marginTop: 24,
        marginBottom: 24,
      }}
    >
      What do you want from an HR solution engine / service provider?
    </h2>            
    <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="In your own words…" autoFocus />
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={() => setStep("persona")}>← Back</button>
              <button className="primary" disabled={!brief.trim()} onClick={startInterview}>
                Start →
              </button>
              <button onClick={skipToServices} title="Skip the AI interview and choose services yourself">
                Skip to services →
              </button>
            </div>
          </div>
        )}

        {/* Screen 3 — adaptive Q&A */}
        {step === "qa" && (
          <div className="panel">
            <div className="steps">Step 2 of 6 · AI HR Consultant</div>
            {transcript.map((t, i) => (
              <div key={i} className={`bubble ${t.role}`}>
                {t.content}
              </div>
            ))}
            {question && <div className="bubble ai">{question}</div>}
            {thinking && <div className="muted small">Thinking…</div>}
            {question && !thinking && (
              <>
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus />
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="primary" disabled={!answer.trim()} onClick={sendAnswer}>
                    Send answer →
                  </button>
                  <button onClick={() => goToRecs(transcript)} title="Skip remaining questions">
                    I&apos;m done — recommend
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Screen 4 — services + modules */}
        {step === "recs" && (
          <div className="panel">
            <div className="steps">Step 3 of 6 · Services</div>
            {thinking && !recs && <p className="muted">Analyzing the conversation…</p>}
            {recs && (
              <>
                <h2>{manual ? "Select services" : "Recommended services"}</h2>
                <p className="muted small">
                  {manual
                    ? "Choose the services and modules to provision."
                    : "Your AI HR Assistant has preselected services and modules based on your conversation. Please confirm your selections."}
                </p>

                {SERVICES.map((s) => {
                  const reason = recommendedReasons.get(s.code);
                  const checked = selected.has(s.code);
                  return (
                    <div key={s.code} className={`rec ${checked ? "checked" : ""}`}>
                      <label>
                        <input type="checkbox" checked={checked} onChange={() => toggle(s.code)} />
                        <span>
                          <h3>
                            {s.name}{" "}
                            {reason ? (
                              <span className="pill on">AI recommended</span>
                            ) : manual ? null : (
                              <span className="pill">not recommended</span>
                            )}
                          </h3>
                          <div className="muted small">{reason ?? s.blurb}</div>
                        </span>
                      </label>
                    </div>
                  );
                })}

                {error && <div className="err">{error}</div>}

                <div className="row" style={{ marginTop: 16 }}>
                  <button onClick={() => setStep(manual ? "brief" : "qa")}>← Back</button>
                  <button className="primary" onClick={goToBuilder}>
                    Confirm &amp; Create Client ({selected.size}) →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Screen 5 — client builder (page 4) */}
        {step === "builder" && (
          <div className="panel">
            <div className="steps">Step 4 of 6 · Client Details</div>
            <h2>Client Details</h2>

            <div style={{ marginTop: 8 }}>
              <label className="small muted">Legal Entity Name *</label>
              <input style={inp} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Acme Corp" autoFocus />
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="small muted">DBA (if any)</label>
              <input style={inp} value={dba} onChange={(e) => setDba(e.target.value)} />
            </div>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label className="small muted">FEIN #</label>
                <input style={inp} value={fein} disabled={feinLater} onChange={(e) => setFein(e.target.value)} />
                <label className="small muted" style={{ display: "block", marginTop: 4 }}>
                  <input type="checkbox" checked={feinLater} onChange={(e) => setFeinLater(e.target.checked)} /> Will provide later
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <label className="small muted">DUNS #</label>
                <input style={inp} value={duns} disabled={dunsLater} onChange={(e) => setDuns(e.target.value)} />
                <label className="small muted" style={{ display: "block", marginTop: 4 }}>
                  <input type="checkbox" checked={dunsLater} onChange={(e) => setDunsLater(e.target.checked)} /> Will provide later
                </label>
              </div>
            </div>

            <h3 style={{ marginTop: 20 }}>Profile</h3>
            <div>
              <label className="small muted">Website</label>
              <input style={inp} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
            <div style={{ marginTop: 8 }}>
              <label className="small muted">Default Currency</label>
              <input style={inp} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="e.g. USD" />
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="spread">
                <label className="small muted">Brief Description</label>
                <button onClick={autofillDescription} disabled={autofilling || (!website.trim() && !legalName.trim())} title="Auto-fill from website (best-effort)">
                  {autofilling ? "Generating…" : "Auto-fill from website"}
                </button>
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 70, marginTop: 4 }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="small muted">Logo</label>
              <div className="row" style={{ marginTop: 4 }}>
                <input type="file" accept="image/*" onChange={onLogo} />
                {logoUrl && <img src={logoUrl} alt="logo preview" style={{ height: 40, borderRadius: 6, border: "1px solid var(--line)" }} />}
              </div>
            </div>

            <h3 style={{ marginTop: 20 }}>Signatory Point of Contact</h3>
            {contactFields(spoc, setSpoc)}

            <h3 style={{ marginTop: 20 }}>Primary Point of Contact</h3>
            <label className="small muted" style={{ display: "block", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={ppocSame}
                onChange={(e) => {
                  setPpocSame(e.target.checked);
                  if (e.target.checked) setPpoc(spoc);
                }}
              />{" "}
              Same as Signatory
            </label>
            {contactFields(ppocSame ? spoc : ppoc, setPpoc, ppocSame)}

            {error && <div className="err">{error}</div>}

            <div className="row" style={{ marginTop: 20 }}>
              <button onClick={() => setStep("recs")}>← Back</button>
              <button className="primary" disabled={confirming} onClick={confirm}>
                {confirming ? "Creating…" : "Create & continue →"}
              </button>
            </div>
          </div>
        )}

        {/* Screen 6 — operating scope & org structure (page 5) */}
        {step === "scope" && (
          <div className="panel">
            <div className="steps">Step 5 of 6 · Operating Scope &amp; Org Structure</div>
            <h2>Operating Scope &amp; Org Structure</h2>

            {/* Section A — core physical locations */}
            <h3 style={{ marginTop: 16 }}>Core Physical Locations</h3>
            <p className="muted small">
              Please list or upload all office locations/worksites. You can simply provide name, city, state,
              country for now and add address detail later. At least one location is required, and one must be
              marked primary.
            </p>
            {locations.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {locations.map((l, i) => (
                  <div key={i} className="spread" style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                    <span>{locLabel(l)}</span>
                    <span className="small">
                      {l.is_primary ? (
                        <span className="pill on">primary</span>
                      ) : (
                        <button onClick={() => setPrimary(i)}>Set primary</button>
                      )}{" "}
                      <button onClick={() => setLocations((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="small muted">Name (optional — blank → &quot;Street – City, State, Country&quot;)</label>
              <input style={inp} value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} />
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ flex: 2 }}>
                <label className="small muted">Street (optional)</label>
                <input style={inp} value={locForm.street} onChange={(e) => setLocForm({ ...locForm, street: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="small muted">City</label>
                <input style={inp} value={locForm.city} onChange={(e) => setLocForm({ ...locForm, city: e.target.value })} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="small muted">State</label>
                <input style={inp} value={locForm.state} onChange={(e) => setLocForm({ ...locForm, state: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="small muted">Country</label>
                <select style={inp} value={locForm.country} onChange={(e) => setLocForm({ ...locForm, country: e.target.value })}>
                  <option value="">Select…</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="small muted">Postal (optional)</label>
                <input style={inp} value={locForm.postal} onChange={(e) => setLocForm({ ...locForm, postal: e.target.value })} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="small muted">Internal ID (optional)</label>
                <input style={inp} value={locForm.internal_id} onChange={(e) => setLocForm({ ...locForm, internal_id: e.target.value })} />
              </div>
              <label className="small muted" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 22 }}>
                <input type="checkbox" checked={locForm.is_primary} onChange={(e) => setLocForm({ ...locForm, is_primary: e.target.checked })} /> Primary
              </label>
            </div>
            <button style={{ marginTop: 8 }} onClick={addLocation}>+ Add location</button>
            {scopeNotes.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {scopeNotes.map((n, i) => (
                  <div key={i} className="small" style={{ color: "var(--accent)" }}>↪ {n}</div>
                ))}
              </div>
            )}

            {/* Section B — additional scope locations (geography) */}
            <h3 style={{ marginTop: 24 }}>Additional Scoped Locations</h3>
            <p className="muted small">
              Countries (and US states / CA provinces) the client operates in, beyond the physical locations above.
              Click to select as many as you need.
            </p>
            <div>
              {COUNTRIES.map((c) => (
                <span
                  key={c.code}
                  className={`pill ${scopeCountries.includes(c.code) ? "on" : ""}`}
                  style={{ cursor: "pointer", padding: "4px 10px", display: "inline-block" }}
                  onClick={() => toggleCountry(c.code)}
                >
                  {c.name}
                </span>
              ))}
            </div>

            {scopeCountries.map((cc) => {
              const list = subdivisionsFor(cc);
              const sel = subs[cc] ?? [];
              return (
                <div key={cc} className="rec" style={{ marginTop: 10 }}>
                  <div className="spread">
                    <strong>{countryName(cc)}</strong>
                    <button onClick={() => removeCountry(cc)}>Remove</button>
                  </div>
                  {list ? (
                    <div style={{ marginTop: 6 }}>
                      <div className="spread">
                        <label className="small muted">
                          {cc === "US" ? "States" : "Provinces (optional)"} — {sel.length} selected
                        </label>
                        <span className="small">
                          <button onClick={() => selectAllSubs(cc, list)}>Select all</button>{" "}
                          <button onClick={() => clearSubs(cc)} disabled={sel.length === 0}>Clear</button>
                        </span>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        {list.map((s) => (
                          <span
                            key={s.code}
                            className={`pill ${sel.includes(s.code) ? "on" : ""}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => toggleSub(cc, s.code)}
                            title={s.name}
                          >
                            {s.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="muted small" style={{ marginTop: 6 }}>→ generates a {countryName(cc)} addendum</div>
                  )}
                </div>
              );
            })}

            {hasNonUS && !complianceOn && (
              <div className="panel mock" style={{ marginTop: 12 }}>
                <p className="small" style={{ marginTop: 0 }}>
                  A non-US country is in scope, but Globalized Compliance is off — international placements require it.
                </p>
                <button className="primary" disabled={enabling} onClick={enableCompliance}>
                  {enabling ? "Enabling…" : "Enable Globalized Compliance"}
                </button>
              </div>
            )}
            {hasNonUS && complianceOn && (
              <p className="small" style={{ marginTop: 8, color: "var(--accent)" }}>✓ Globalized Compliance enabled.</p>
            )}

            {/* Section C — departments */}
            <h3 style={{ marginTop: 20 }}>Departments</h3>
            {departments.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {departments.map((d, i) => (
                  <div key={i} className="spread" style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                    <span>
                      {d.name}
                      {d.internal_id && <span className="muted small"> · {d.internal_id}</span>}
                    </span>
                    <button onClick={() => setDepartments((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="row">
              <div style={{ flex: 2 }}>
                <label className="small muted">Name</label>
                <input style={inp} value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="small muted">Internal ID</label>
                <input style={inp} value={deptForm.internal_id} onChange={(e) => setDeptForm({ ...deptForm, internal_id: e.target.value })} />
              </div>
            </div>
            <button style={{ marginTop: 8 }} disabled={!deptForm.name.trim()} onClick={addDept}>+ Add department</button>

            {error && <div className="err">{error}</div>}

            <div className="row" style={{ marginTop: 20 }}>
              <button className="primary" disabled={finishing} onClick={finishScope}>
                {finishing ? "Saving…" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* Screen 7 — job types & bill cards (page 6) */}
        {step === "jobtitles" && (
          <div className="panel">
            <div className="steps">Step 6 of 6 · Job Types &amp; Bill Cards</div>
            <h2>Job types &amp; bill cards</h2>

            {/* Section A — titles */}
            <h3 style={{ marginTop: 16 }}>A. Job titles</h3>
            <p className="muted small">
              Add the titles you&apos;ll staff (one per line), then let AI suggest a risk tier for each. You confirm
              every title before it&apos;s saved.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Paste titles, one per line…\nWarehouse Associate\nForklift Operator\nOffice Manager"}
              style={{ minHeight: 70 }}
            />
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={addPastedTitles} disabled={!pasteText.trim()}>+ Add titles</button>
              {titleRows.length > 0 && (
                <>
                  <button className="primary" onClick={categorizeAll}>Categorize all with AI</button>
                  <button onClick={() => setTitleRows((prev) => prev.map((r) => ({ ...r, confirmed: r.tier !== null || r.needs_review })))}>
                    Confirm all reviewed
                  </button>
                </>
              )}
            </div>

            {titleRows.map((r, i) => {
              const tierName = r.tier ? RISK_TIERS.find((t) => t.code === r.tier)?.name : null;
              const categorized = r.tier !== null || r.needs_review || r.why !== "";
              return (
                <div key={i} className={`rec ${r.confirmed ? "checked" : ""}`} style={{ marginTop: 10 }}>
                  <div className="row">
                    <div style={{ flex: 2 }}>
                      <label className="small muted">Title</label>
                      <input style={inp} value={r.title} onChange={(e) => patchRow(i, { title: e.target.value })} />
                    </div>
                    <div style={{ flex: 3 }}>
                      <label className="small muted">Blurb (optional)</label>
                      <input style={inp} value={r.blurb} onChange={(e) => patchRow(i, { blurb: e.target.value })} />
                    </div>
                    <button style={{ marginTop: 20 }} onClick={() => categorizeRow(i)} disabled={r.busy || !r.title.trim()}>
                      {r.busy ? "…" : "Categorize"}
                    </button>
                    <button style={{ marginTop: 20 }} onClick={() => setTitleRows((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                  </div>

                  {r.question && (
                    <div className="panel mock" style={{ marginTop: 8 }}>
                      <p className="small" style={{ marginTop: 0 }}>{r.question}</p>
                      <div className="row">
                        <input style={inp} value={r.answerDraft} onChange={(e) => patchRow(i, { answerDraft: e.target.value })} placeholder="Your answer…" />
                        <button className="primary" disabled={!r.answerDraft.trim()} onClick={() => submitClarify(i)}>Answer</button>
                      </div>
                    </div>
                  )}

                  {categorized && !r.question && (
                    <div style={{ marginTop: 8 }}>
                      <div className="row">
                        <div style={{ flex: 1 }}>
                          <label className="small muted">Risk tier</label>
                          <select style={inp} value={r.tier ?? ""} onChange={(e) => setRowTier(i, e.target.value)}>
                            <option value="">— needs review / no tier —</option>
                            {RISK_TIERS.map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.name} ({t.default_markup_pct}%)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ marginTop: 20 }}>
                          {r.tier ? (
                            <span className="pill on">{tierName}</span>
                          ) : (
                            <span className="pill">needs review / possible addendum</span>
                          )}
                        </div>
                      </div>
                      {r.why && <div className="muted small" style={{ marginTop: 4 }}>{r.why}</div>}
                      <label className="small" style={{ display: "block", marginTop: 6 }}>
                        <input type="checkbox" checked={r.confirmed} onChange={(e) => patchRow(i, { confirmed: e.target.checked })} /> Confirmed
                      </label>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Section B — bill cards */}
            <h3 style={{ marginTop: 24 }}>B. Bill cards</h3>
            <p className="muted small">
              One draft card per risk tier present in your confirmed titles, seeded with the tier&apos;s default markup.
              Bill rate = pay × (1 + markup) for EoR.
            </p>
            <button className="primary" disabled={generating} onClick={generateCards}>
              {generating ? "Generating…" : "Generate bill cards"}
            </button>

            {cards.map((c, i) => (
              <div key={c.id} className="rec" style={{ marginTop: 10 }}>
                <div className="row">
                  <strong style={{ flex: 1, marginTop: 20 }}>{tierById[c.risk_tier_id]?.name ?? "Tier"}</strong>
                  <div style={{ flex: 1 }}>
                    <label className="small muted">Markup %</label>
                    <input
                      style={inp}
                      type="number"
                      value={c.markup_pct ?? ""}
                      onChange={(e) => patchCard(i, { markup_pct: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="small muted">States (comma, or ALL)</label>
                    <input style={inp} value={c.states} onChange={(e) => patchCard(i, { states: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="small muted">Status</label>
                    <select style={inp} value={c.status} onChange={(e) => patchCard(i, { status: e.target.value as "draft" | "active" })}>
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {error && <div className="err">{error}</div>}

            <div className="row" style={{ marginTop: 20 }}>
              <button onClick={() => setStep("scope")}>← Back</button>
              <button className="primary" disabled={savingFinal} onClick={finishJobTitles}>
                {savingFinal ? "Saving…" : "Finish →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
