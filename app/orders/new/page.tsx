"use client";

import Link from "next/link";
import { useState } from "react";

type OrderPersona = "eor" | "vms" | "staffing";
type Step = "persona" | "flow";

const PERSONAS: { code: OrderPersona; label: string; blurb: string }[] = [
  { code: "eor", label: "Client with EOR Service Only", blurb: "Places orders for workers TargetCW will legally employ as Employer of Record." },
  { code: "vms", label: "Client with VMS", blurb: "Releases orders to a vendor network managed through the VMS / MSP." },
  { code: "staffing", label: "Client with Staffing", blurb: "Places orders for workers they've sourced themselves for us to onboard and pay." },
];

export default function NewOrder() {
  const [step, setStep] = useState<Step>("persona");
  const [persona, setPersona] = useState<OrderPersona | null>(null);

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
            <button className="primary" disabled={!persona} onClick={() => setStep("flow")}>
              Continue →
            </button>
          </div>
        )}

        {/* Screen 2 — order flow */}
        {step === "flow" && (
          <div className="panel">
            <h2>Order Intake flow</h2>
            <p className="muted small">Coming soon.</p>
            <div className="row" style={{ marginTop: 16 }}>
              <button onClick={() => setStep("persona")}>← Back</button>
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
