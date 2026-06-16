"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SERVICES, type Persona, type Recommendation, type TranscriptTurn } from "@/lib/catalog";
import { interviewAction, synthesizeAction, confirmIntakeAction } from "./actions";

type Step = "persona" | "brief" | "qa" | "recs";

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
  const [legalName, setLegalName] = useState("");
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

  function toggle(code: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(code) ? n.delete(code) : n.add(code);
      return n;
    });
  }

  async function confirm() {
    setError("");
    if (!persona) return;
    if (!legalName.trim()) return setError("Enter a client name.");
    if (selected.size === 0) return setError("Select at least one service.");
    setConfirming(true);
    const selections = [...selected].map((code) => ({
      service_code: code as Recommendation["service_code"],
      source: (recommendedReasons.has(code) ? "ai" : "manual") as "ai" | "manual",
    }));
    const res = await confirmIntakeAction({
      legalName,
      persona,
      brief,
      transcript,
      inferredSignals: signals,
      selections,
    });
    if (res.ok) {
      router.push(`/clients/${res.entityId}`);
    } else {
      setConfirming(false);
      setError(res.error);
    }
  }

  return (
    <>
      <div className="mock-banner">Internal · Mockup only — no real data</div>
      <div className="wrap">
        <h1>Create new client</h1>

        {/* Screen 1 — persona */}
        {step === "persona" && (
          <div className="panel">
            <div className="steps">Step 1 of 4</div>
            <h2>Who are we talking to?</h2>
            <button
              className={`choice ${persona === "cra" ? "selected" : ""}`}
              onClick={() => setPersona("cra")}
            >
              <strong>Client / CRA</strong>
              <div className="muted small">Internal associate — knows the domain. Terse questions.</div>
            </button>
            <button
              className={`choice ${persona === "prospect" ? "selected" : ""}`}
              onClick={() => setPersona("prospect")}
            >
              <strong>Prospect off the street</strong>
              <div className="muted small">New to staffing — we educate and probe more.</div>
            </button>
            <button className="primary" disabled={!persona} onClick={() => setStep("brief")}>
              Continue →
            </button>
          </div>
        )}

        {/* Screen 2 — brief */}
        {step === "brief" && (
          <div className="panel">
            <div className="steps">Step 2 of 4</div>
            <h2>What do you want from an HR solution engine / service provider?</h2>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="In your own words…"
              autoFocus
            />
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={() => setStep("persona")}>← Back</button>
              <button className="primary" disabled={!brief.trim()} onClick={startInterview}>
                Start →
              </button>
            </div>
          </div>
        )}

        {/* Screen 3 — adaptive Q&A */}
        {step === "qa" && (
          <div className="panel">
            <div className="steps">Step 3 of 4 · A few questions</div>
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
                    I'm done — recommend
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Screen 4 — recommendations + human confirm */}
        {step === "recs" && (
          <div className="panel">
            <div className="steps">Step 4 of 4 · Review & confirm</div>
            {thinking && !recs && <p className="muted">Analyzing the conversation…</p>}
            {recs && (
              <>
                <h2>Recommended services</h2>
                <p className="muted small">
                  Pre-checked from the conversation. Check / uncheck freely — a human always confirms
                  before anything is provisioned.
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
                            ) : (
                              <span className="pill">not recommended</span>
                            )}
                          </h3>
                          <div className="muted small">{reason ?? s.blurb}</div>
                        </span>
                      </label>
                    </div>
                  );
                })}

                <div style={{ marginTop: 16 }}>
                  <label className="small muted">Client name</label>
                  <input
                    style={{ width: "100%", padding: 10, marginTop: 4, border: "1px solid var(--line)", borderRadius: 8, font: "inherit" }}
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                  />
                </div>

                {error && <div className="err">{error}</div>}

                <div className="row" style={{ marginTop: 16 }}>
                  <button onClick={() => setStep("qa")}>← Back</button>
                  <button className="primary" disabled={confirming} onClick={confirm}>
                    {confirming ? "Provisioning…" : `Confirm & create prospect (${selected.size})`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
