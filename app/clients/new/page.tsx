"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  SERVICES,
  COUNTRIES,
  currencyForCountry,
  type Persona,
  type Recommendation,
  type TranscriptTurn,
} from "@/lib/catalog";
import { interviewAction, synthesizeAction, confirmIntakeAction, describeAction } from "./actions";

type Step = "persona" | "brief" | "qa" | "recs" | "builder";

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
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
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

  function pickCountry(code: string) {
    setCountry(code);
    setCurrency(currencyForCountry(code)); // auto-select; still editable
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
    if (!spoc.first_name.trim() || !spoc.last_name.trim() || !spoc.email.trim()) {
      return setError("Signatory contact needs first name, last name, and email.");
    }
    setConfirming(true);
    const primary = ppocSame ? spoc : ppoc;
    const selections = [...selected].map((code) => ({
      service_code: code as Recommendation["service_code"],
      source: (recommendedReasons.has(code) ? "ai" : "manual") as "ai" | "manual",
    }));
    const res = await confirmIntakeAction({
      legalName,
      dba,
      address: { street, city, state: stateRegion, zip, country },
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
      router.push(`/clients/${res.entityId}`);
    } else {
      setConfirming(false);
      setError(res.error);
    }
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
        <h1>Create new client</h1>

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
            <div className="steps">Step 1 of 4</div>
            <h2>What do you want from an HR solution engine / service provider?</h2>
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
            <div className="steps">Step 2 of 4 · A few questions</div>
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
            <div className="steps">Step 3 of 4 · Services</div>
            {thinking && !recs && <p className="muted">Analyzing the conversation…</p>}
            {recs && (
              <>
                <h2>{manual ? "Select services" : "Recommended services"}</h2>
                <p className="muted small">
                  {manual
                    ? "AI interview skipped — choose the services to provision. A human always confirms before anything is provisioned."
                    : "Pre-checked from the conversation. Check / uncheck freely — a human always confirms before anything is provisioned."}
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
            <div className="steps">Step 4 of 4 · Client details</div>
            <h2>Client details</h2>

            <div style={{ marginTop: 8 }}>
              <label className="small muted">Legal entity name *</label>
              <input style={inp} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Acme Corp" autoFocus />
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="small muted">DBA (if any)</label>
              <input style={inp} value={dba} onChange={(e) => setDba(e.target.value)} />
            </div>

            <h3 style={{ marginTop: 20 }}>Primary office address</h3>
            <div>
              <label className="small muted">Street</label>
              <input style={inp} value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ flex: 2 }}>
                <label className="small muted">City</label>
                <input style={inp} value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="small muted">State / region</label>
                <input style={inp} value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="small muted">ZIP / postal</label>
                <input style={inp} value={zip} onChange={(e) => setZip(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label className="small muted">Country</label>
              <select style={inp} value={country} onChange={(e) => pickCountry(e.target.value)}>
                <option value="">Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <h3 style={{ marginTop: 20 }}>Identifiers</h3>
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
              <label className="small muted">Default currency (auto-selected from country)</label>
              <input style={inp} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="e.g. USD" />
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="spread">
                <label className="small muted">Brief description</label>
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

            <h3 style={{ marginTop: 20 }}>Signatory point of contact *</h3>
            {contactFields(spoc, setSpoc)}

            <h3 style={{ marginTop: 20 }}>Primary point of contact</h3>
            <label className="small muted" style={{ display: "block", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={ppocSame}
                onChange={(e) => {
                  setPpocSame(e.target.checked);
                  if (e.target.checked) setPpoc(spoc);
                }}
              />{" "}
              Same as signatory
            </label>
            {contactFields(ppocSame ? spoc : ppoc, setPpoc, ppocSame)}

            {error && <div className="err">{error}</div>}

            <div className="row" style={{ marginTop: 20 }}>
              <button onClick={() => setStep("recs")}>← Back</button>
              <button className="primary" disabled={confirming} onClick={confirm}>
                {confirming ? "Creating…" : "Create client"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
