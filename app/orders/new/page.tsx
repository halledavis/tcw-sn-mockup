"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createDraftOrder,
  updateDraftOrder,
  listOrderClients,
  listClientDepartments,
  listClientJobTitles,
  type OrderClient,
  type DepartmentRow,
  type ClientTitleRow,
} from "./actions";

type OrderPersona = "eor" | "vms" | "staffing" | "agent" | "1099s";
type Fulfillment = "agent" | "worker" | "project";
type Source = "self_pending" | "self_known" | "staffing_outside" | "staffing_kickoff";
type DurationUnit = "days" | "weeks" | "months" | "years";

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

type FlowState = { persona: OrderPersona | null; fulfillment: Fulfillment | null };

// The effective fulfillment: a persona that yields only Worker has it implied
// (the fulfillment step is skipped), otherwise it's whatever the user picked.
function effectiveFulfillment(s: FlowState): Fulfillment | null {
  if (!s.persona) return null;
  return fulfillmentsFor(s.persona).length === 1 ? "worker" : s.fulfillment;
}

// Ordered flow descriptors. isActive decides whether a step shows given the
// current selections; the visible flow is these filtered against state, and
// navigation walks an index through that list. Add a step = add a descriptor.
const STEPS: { key: string; label: string; isActive: (s: FlowState) => boolean }[] = [
  { key: "persona", label: "Roleplay", isActive: () => true },
  { key: "fulfillment", label: "Work Fulfillment Strategy", isActive: (s) => !!s.persona && fulfillmentsFor(s.persona).length > 1 },
  { key: "source", label: "Fill Source Strategy", isActive: (s) => effectiveFulfillment(s) === "worker" },
  { key: "engagement", label: "Engagement details", isActive: (s) => effectiveFulfillment(s) === "worker" },
  { key: "flow", label: "Order Intake flow", isActive: () => true },
];

// start_date + duration -> end_date (YYYY-MM-DD), for the "by duration" mode.
function addDuration(start: string, value: number, unit: DurationUnit): string {
  if (!start || !value) return "";
  const d = new Date(start + "T00:00:00");
  if (unit === "days") d.setDate(d.getDate() + value);
  else if (unit === "weeks") d.setDate(d.getDate() + value * 7);
  else if (unit === "months") d.setMonth(d.getMonth() + value);
  else if (unit === "years") d.setFullYear(d.getFullYear() + value);
  return d.toISOString().slice(0, 10);
}

const inp: React.CSSProperties = {
  width: "100%",
  padding: 10,
  marginTop: 4,
  border: "1px solid var(--line)",
  borderRadius: 8,
  font: "inherit",
};

export default function NewOrder() {
  const [stepIndex, setStepIndex] = useState(0);
  const [persona, setPersona] = useState<OrderPersona | null>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [source, setSource] = useState<Source | null>(null);

  // Client to attach the order to (supplies entity_id).
  const [clients, setClients] = useState<OrderClient[]>([]);
  const [clientId, setClientId] = useState("");

  // Persisted draft.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Engagement-details step.
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [titles, setTitles] = useState<ClientTitleRow[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [jobTitleId, setJobTitleId] = useState("");
  const [hoursMode, setHoursMode] = useState<"fixed" | "variable">("fixed");
  const [fixedHours, setFixedHours] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endMode, setEndMode] = useState<"duration" | "date">("duration");
  const [durationValue, setDurationValue] = useState("");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("weeks");
  const [endDateInput, setEndDateInput] = useState("");
  const [savingEngagement, setSavingEngagement] = useState(false);
  const [engagementError, setEngagementError] = useState("");

  const state: FlowState = { persona, fulfillment };
  const visible = STEPS.filter((s) => s.isActive(state));
  const idx = Math.min(stepIndex, visible.length - 1);
  const current = visible[idx];

  useEffect(() => {
    listOrderClients().then(setClients);
  }, []);

  // Load the selected client's departments + job titles for the engagement step.
  useEffect(() => {
    if (!clientId) {
      setDepartments([]);
      setTitles([]);
      return;
    }
    listClientDepartments(clientId).then(setDepartments);
    listClientJobTitles(clientId).then(setTitles);
  }, [clientId]);

  // Persist a draft order once, as soon as the flow reaches the first post-
  // selection screen: the engagement step (worker) or, for agent/project
  // requisitions which skip it, the flow screen.
  useEffect(() => {
    if ((current.key !== "engagement" && current.key !== "flow") || draftId || creating || !clientId || !persona) return;
    const eff = effectiveFulfillment(state);
    if (!eff) return;
    setCreating(true);
    setCreateError("");
    createDraftOrder({ entityId: clientId, fulfillment: eff, fillSource: source }).then((res) => {
      setCreating(false);
      if (res.ok) setDraftId(res.id);
      else setCreateError(res.error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.key]);

  const options = persona ? fulfillmentsFor(persona) : [];
  const sourceOptions = persona ? sourcesFor(persona) : [];

  // Computed end date for the "by duration" mode.
  const computedEndDate =
    endMode === "duration" && startDate && durationValue
      ? addDuration(startDate, Number(durationValue), durationUnit)
      : "";
  const engagementValid =
    !!jobTitleId &&
    !!startDate &&
    (hoursMode === "variable" || Number(fixedHours) > 0) &&
    (endMode === "duration" ? Number(durationValue) > 0 : !!endDateInput);

  async function saveEngagement() {
    if (!draftId) return;
    setEngagementError("");
    setSavingEngagement(true);
    const res = await updateDraftOrder(draftId, {
      clientJobTitleId: jobTitleId,
      departmentId: departmentId || null,
      hoursType: hoursMode,
      weeklyHours: hoursMode === "fixed" ? Number(fixedHours) : null,
      startDate,
      durationValue: endMode === "duration" ? Number(durationValue) : null,
      durationUnit: endMode === "duration" ? durationUnit : null,
      endDate: endMode === "duration" ? computedEndDate : endDateInput,
    });
    setSavingEngagement(false);
    if (!res.ok) return setEngagementError(res.error ?? "Save failed.");
    goNext();
  }

  const goNext = () => setStepIndex(idx + 1);
  const goBack = () => setStepIndex(Math.max(0, idx - 1));

  // Changing an earlier selection clears downstream picks so they can't go stale.
  function pickPersona(code: OrderPersona) {
    setPersona(code);
    setFulfillment(null);
    setSource(null);
  }
  function pickFulfillment(code: Fulfillment) {
    setFulfillment(code);
    setSource(null);
  }

  return (
    <>
      <div className="mock-banner">Internal · Mockup only</div>
      <div className="wrap">
        <h1>Order Intake</h1>

        {/* Screen 1 — persona / roleplay (greyed pre-flow config) */}
        {current.key === "persona" && (
          <div className="panel mock">
            <div className="steps">PRE-ORDER CONFIG</div>
            <h2>INTERNAL MOCKUP PAGE ONLY: What are you roleplaying as?</h2>
            {PERSONAS.map((p) => (
              <button
                key={p.code}
                className={`choice ${persona === p.code ? "selected" : ""}`}
                onClick={() => pickPersona(p.code)}
              >
                <strong>{p.label}</strong>
                <div className="muted small">{p.blurb}</div>
              </button>
            ))}

            <div style={{ marginTop: 16 }}>
              <label className="small muted">Attach order to client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, border: "1px solid var(--line)", borderRadius: 8, font: "inherit" }}
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legal_name}
                  </option>
                ))}
              </select>
            </div>

            <button className="primary" disabled={!persona || !clientId} onClick={goNext} style={{ marginTop: 16 }}>
              Continue →
            </button>
          </div>
        )}

        {/* Screen 2 — work fulfillment strategy */}
        {current.key === "fulfillment" && (
          <div className="panel">
            <div className="steps">Step {idx}</div>
            <h2>Work Fulfillment Strategy</h2>
            <p className="muted small">How do you want to complete the work you need done?</p>
            {options.map((f) => (
              <button
                key={f.code}
                className={`choice ${fulfillment === f.code ? "selected" : ""}`}
                onClick={() => pickFulfillment(f.code)}
              >
                <strong>{f.label}</strong>
                <div className="muted small">{f.blurb}</div>
              </button>
            ))}
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={goBack}>← Back</button>
              <button className="primary" disabled={!fulfillment} onClick={goNext}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Screen 3 — fill source strategy (worker requisitions only) */}
        {current.key === "source" && (
          <div className="panel">
            <div className="steps">Step {idx}</div>
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
              <button onClick={goBack}>← Back</button>
              <button className="primary" disabled={!source} onClick={goNext}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Screen 4 — engagement details (worker requisitions only) */}
        {current.key === "engagement" && (
          <div className="panel">
            <div className="steps">Step {idx}</div>
            <h2>Engagement details</h2>

            <div style={{ marginTop: 12 }}>
              <label className="small muted">Department (optional)</label>
              <select style={inp} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">{departments.length ? "None" : "No departments for this client"}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="small muted">Job title *</label>
              <select style={inp} value={jobTitleId} onChange={(e) => setJobTitleId(e.target.value)}>
                <option value="">Select a job title…</option>
                {titles.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              {titles.length === 0 && (
                <div className="muted small" style={{ marginTop: 4 }}>
                  This client has no job titles yet — add them in the client builder first.
                </div>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="small muted">Estimated weekly hours</label>
              <div className="row" style={{ marginTop: 4 }}>
                <label className="small"><input type="radio" name="hoursMode" checked={hoursMode === "fixed"} onChange={() => setHoursMode("fixed")} /> Fixed</label>
                <label className="small"><input type="radio" name="hoursMode" checked={hoursMode === "variable"} onChange={() => setHoursMode("variable")} /> Variable</label>
              </div>
              {hoursMode === "fixed" && (
                <div style={{ marginTop: 4 }}>
                  <input style={inp} type="number" min={0} value={fixedHours} onChange={(e) => setFixedHours(e.target.value)} placeholder="e.g. 40" />
                  {Number(fixedHours) > 0 && (
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {Number(fixedHours) >= 40 ? "Typically full-time in most jurisdictions" : "Typically part-time"}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="small muted">Anticipated start date *</label>
              <input style={inp} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="small muted">Engagement end</label>
              <div className="row" style={{ marginTop: 4 }}>
                <label className="small"><input type="radio" name="endMode" checked={endMode === "duration"} onChange={() => setEndMode("duration")} /> By duration</label>
                <label className="small"><input type="radio" name="endMode" checked={endMode === "date"} onChange={() => setEndMode("date")} /> By end date</label>
              </div>
              {endMode === "duration" ? (
                <>
                  <div className="row" style={{ marginTop: 4 }}>
                    <div style={{ flex: 1 }}>
                      <input style={inp} type="number" min={1} value={durationValue} onChange={(e) => setDurationValue(e.target.value)} placeholder="e.g. 12" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <select style={inp} value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}>
                        <option value="days">days</option>
                        <option value="weeks">weeks</option>
                        <option value="months">months</option>
                        <option value="years">years</option>
                      </select>
                    </div>
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Computed end date: {computedEndDate || "—"}
                  </div>
                </>
              ) : (
                <input style={inp} type="date" value={endDateInput} onChange={(e) => setEndDateInput(e.target.value)} />
              )}
            </div>

            {engagementError && <div className="err">{engagementError}</div>}
            <div className="row" style={{ marginTop: 16 }}>
              <button onClick={goBack}>← Back</button>
              <button className="primary" disabled={!engagementValid || savingEngagement || !draftId} onClick={saveEngagement}>
                {savingEngagement ? "Saving…" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* Screen 5 — order flow */}
        {current.key === "flow" && (
          <div className="panel">
            <h2>Order Intake flow</h2>
            {creating && <p className="muted small">Creating draft order…</p>}
            {draftId && <p className="small" style={{ color: "var(--accent)" }}>✓ Draft order {draftId} created</p>}
            {createError && <div className="err">{createError}</div>}
            <p className="muted small">Coming soon.</p>
            <div className="row" style={{ marginTop: 16 }}>
              <button onClick={goBack}>← Back</button>
            </div>
          </div>
        )}

        {current.key === "persona" && (
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
