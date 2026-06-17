"use client";

import Link from "next/link";
import { useState } from "react";

type OrderPersona = "eor" | "vms" | "staffing" | "agent" | "1099s";
type Fulfillment = "agent" | "worker" | "project";
type Source = "self_pending" | "self_known" | "staffing_outside" | "staffing_kickoff";
type Step = "persona" | "fulfillment" | "source" | "flow";

const PERSONAS: { code: OrderPersona; label: string; blurb: string }[] = [
  { code: "eor", label: "Client with EOR Service Only", blurb: "Places orders for workers TargetCW will legally employ as Employer of Record." },
  { code: "vms", label: "Client with VMS", blurb: "Releases orders to a vendor network managed through the VMS / MSP." },
  { code: "staffing", label: "Client with Staffing", blurb: "Places orders for workers they've sourced themselves for us to onboard and pay." },
  { code: "agent", label: "Client with Agent", blurb: "Can deploy autonomous AI agents to complete work." },
  { code: "1099s", label: "Client with 1099s", blurb: "Engages independent contractors / third-party agencies for project work." },
];

const FULFILLMENTS: { code: Fulfillment; label: string; blurb: string }[] = [
  { code: "agent", label: "Agent Requisition", blurb: "Deploy an autonomous AI agent to complete the job." },
  { code: "worker", label: "Worker Requisition", blurb: "Use a human to complete the job." },
  { code: "project", label: "Project Requisition", blurb: "Use an independent contractor/third party agency to complete the work." },
];

const SOURCES: { code: Source; label: string; blurb: string }[] = [
  { code: "self_pending", label: "Self Sourced, candidate pending", blurb: "You'll find the candidate using internal recruiters/means, but you don't have them identified yet." },
  { code: "self_known", label: "Self Sourced, candidate known", blurb: "A specific individual has been identified and you're ready to send them an offer." },
  { code: "staffing_outside", label: "Staffing Sourced, outside system", blurb: "You leveraged a staffing agency outside the system and found a candidate." },
  { code: "staffing_kickoff", label: "Staffing Sourced, system kickoff", blurb: "Alert my staffing agency or vendor network about this order so they can find a candidate." },
];

// Worker is always available; Agent only for "Client with Agent", Project only
// for "Client with 1099s".
function fulfillmentsFor(persona: OrderPersona) {
  return FULFILLMENTS.filter(
    (f) => f.code === "worker" || (f.code === "agent" && persona === "agent") || (f.code === "project" && persona === "1099s"),
  );
}

// Self-sourced options are always available; staffing-sourced options only when
// the client has Staffing or VMS.
function sourcesFor(persona: OrderPersona) {
  const hasStaffing = persona === "staffing" || persona === "vms";
  return SOURCES.filter((s) => s.code.startsWith("self_") || hasStaffing);
}

export default function NewOrder() {
  const [step, setStep] = useState<Step>("persona");
  const [persona, setPersona] = useState<OrderPersona | null>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [source, setSource] = useState<Source | null>(null);

  const options = persona ? fulfillmentsFor(persona) : [];
  const sourceOptions = persona ? sourcesFor(persona) : [];
  const hasFulfillmentStep = options.length > 1;

  function continueFromPersona() {
    if (!persona) return;
    setSource(null);
    if (hasFulfillmentStep) {
      setFulfillment(null);
      setStep("fulfillment");
    } else {
      // Only worker available → skip the fulfillment page, go to source.
      setFulfillment("worker");
      setStep("source");
    }
  }

  function continueFromFulfillment() {
    if (!fulfillment) return;
    // Worker requisitions choose a fill source next; agent/project skip ahead.
    setStep(fulfillment === "worker" ? "source" : "flow");
  }

  return (
    <>
      <div className="mock-banner">Internal · Mockup only</div>
      <div className="wrap">
        <h1>Order Intake</h1>

        {/* Screen 1 — persona / roleplay (greyed pre-flow config) */}
        {step === "persona" && (
          <div className="panel mock">
            <div className="steps">PRE-ORDER CONFIG</div>
            <h2>INTERNAL MOCKUP PAGE ONLY: What are you roleplaying as?</h2>
            {PERSONAS.map((p) => (
              <button
                key={p.code}
                className={`choice ${persona === p.code ? "selected" : ""}`}
                onClick={() => setPersona(p.code)}
              >
                <strong>{p.label}</strong>
                <div className="muted small">{p.blurb}</div>
              </button>
            ))}
            <button className="primary" disabled={!persona} onClick={continueFromPersona}>
              Continue →
            </button>
          </div>
        )}

        {/* Screen 2 (step 1) — work fulfillment strategy */}
        {step === "fulfillment" && (
          <div className="panel">
            <div className="steps">Step 1</div>
            <h2>Work Fulfillment Strategy</h2>
            <p className="muted small">How do you want to complete the work you need done?</p>
            {options.map((f) => (
              <button
                key={f.code}
                className={`choice ${fulfillment === f.code ? "selected" : ""}`}
                onClick={() => setFulfillment(f.code)}
              >
                <strong>{f.label}</strong>
                <div className="muted small">{f.blurb}</div>
              </button>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={() => setStep("persona")}>← Back</button>
              <button className="primary" disabled={!fulfillment} onClick={continueFromFulfillment}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Screen 3 — fill source strategy (worker requisitions only) */}
        {step === "source" && (
          <div className="panel">
            <div className="steps">Step {hasFulfillmentStep ? 2 : 1}</div>
            <h2>Fill Source Strategy</h2>
            <p className="muted small">
              Select how this worker vacancy will be fulfilled and routed through the StaffingNation procurement engine.
            </p>
            {sourceOptions.map((s) => (
              <button
                key={s.code}
                className={`choice ${source === s.code ? "selected" : ""}`}
                onClick={() => setSource(s.code)}
              >
                <strong>{s.label}</strong>
                <div className="muted small">{s.blurb}</div>
              </button>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={() => setStep(hasFulfillmentStep ? "fulfillment" : "persona")}>← Back</button>
              <button className="primary" disabled={!source} onClick={() => setStep("flow")}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Screen 4 — order flow */}
        {step === "flow" && (
          <div className="panel">
            <h2>Order Intake flow</h2>
            <p className="muted small">Coming soon.</p>
            <div className="row" style={{ marginTop: 16 }}>
              <button
                onClick={() => setStep(fulfillment === "worker" ? "source" : hasFulfillmentStep ? "fulfillment" : "persona")}
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {step === "persona" && (
          <div className="row" style={{ marginTop: 16 }}>
            <Link href="/">
              <button>← Home</button>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
