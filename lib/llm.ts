import "server-only";
import OpenAI from "openai";
import {
  catalogContext,
  SIGNAL_DEFINITIONS,
  SERVICE_CODES,
  riskTierContext,
  RISK_TIER_CODES,
  type RiskTierCode,
  type Persona,
  type TranscriptTurn,
  type SynthesisResult,
  type Recommendation,
} from "./catalog";

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY (server-only).");
  return new OpenAI({ apiKey });
}

const MODEL = () => process.env.OPENAI_MODEL || "gpt-4o-mini";

// Ask at least MIN_QUESTIONS (so the synthesizer has real signal to work with)
// and at most QUESTION_CAP (so the flow always terminates).
const MIN_QUESTIONS = 4;
const QUESTION_CAP = 7;

// Safety net: if the model tries to finish before the minimum, fall back to the
// next uncovered signal-area question so the conversation keeps going.
const FALLBACK_QUESTIONS = [
  "Are you bringing your own workers, do you want us to source candidates, or are you managing multiple staffing agencies? If agencies, roughly how many?",
  "Will these be W-2 employees, 1099 independent contractors, or a mix?",
  "Where are the workers located — which country or countries?",
  "Do you need someone to legally employ the workers (act as the Employer of Record), or do you already employ them yourselves?",
  "Is this ongoing staffing, or project / statement-of-work based?",
  "Roughly how many workers and over what timeframe?",
];

function fallbackQuestion(transcript: TranscriptTurn[]): string {
  const asked = new Set(transcript.filter((t) => t.role === "ai").map((t) => t.content));
  for (const q of FALLBACK_QUESTIONS) if (!asked.has(q)) return q;
  return FALLBACK_QUESTIONS[FALLBACK_QUESTIONS.length - 1];
}

// Models are told to return raw JSON (and we use JSON mode). Parse safely: try
// the whole string, then salvage the first {...} object if needed.
function safeJson<T>(raw: string): T | null {
  const attempts = [raw.trim()];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) attempts.push(raw.slice(start, end + 1));
  for (const a of attempts) {
    try {
      return JSON.parse(a) as T;
    } catch {
      /* try next */
    }
  }
  return null;
}

// Use OpenAI Structured Outputs (json_schema + strict) so required fields are
// always present — json_object mode alone does not enforce shape, and smaller
// models will happily drop "recommendations".
type SchemaSpec = { name: string; schema: Record<string, unknown> };

async function jsonChat(
  system: string,
  user: string,
  maxTokens: number,
  schema: SchemaSpec,
): Promise<string> {
  const resp = await client().chat.completions.create({
    model: MODEL(),
    max_tokens: maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: { name: schema.name, strict: true, schema: schema.schema },
    },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return resp.choices[0]?.message?.content ?? "";
}

// Either ask a question or finish. Both fields required (strict mode); done
// wins, and a null next_question also ends the interview.
const INTERVIEW_SCHEMA: SchemaSpec = {
  name: "interview_step",
  schema: {
    type: "object",
    properties: {
      done: { type: "boolean" },
      next_question: { type: ["string", "null"] },
    },
    required: ["done", "next_question"],
    additionalProperties: false,
  },
};

const SYNTH_SCHEMA: SchemaSpec = {
  name: "synthesis",
  schema: {
    type: "object",
    properties: {
      inferred_signals: {
        type: "object",
        properties: {
          sourcing_model: { type: ["string", "null"] },
          worker_type: { type: ["string", "null"] },
          geography: { type: ["string", "null"] },
          needs_employer: { type: ["string", "null"] },
          project_vs_staff: { type: ["string", "null"] },
        },
        required: ["sourcing_model", "worker_type", "geography", "needs_employer", "project_vs_staff"],
        additionalProperties: false,
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            service_code: { type: "string", enum: [...SERVICE_CODES] },
            reason: { type: "string" },
          },
          required: ["service_code", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["inferred_signals", "recommendations"],
    additionalProperties: false,
  },
};

function personaStance(persona: Persona): string {
  return persona === "cra"
    ? "The respondent is an internal Client Relationship Associate (CRA). Be terse and assume competence — they know the staffing domain and our terminology. Ask sharp, efficient questions."
    : "The respondent is a prospect off the street who may not know staffing jargon. Educate briefly where helpful, avoid internal acronyms, and probe a little more to draw out what they actually need.";
}

function transcriptToText(brief: string, transcript: TranscriptTurn[]): string {
  const lines = [`INITIAL BRIEF: ${brief || "(none provided)"}`];
  for (const t of transcript) lines.push(`${t.role === "ai" ? "Q (you)" : "A (them)"}: ${t.content}`);
  return lines.join("\n");
}

// Best-effort company description for the builder. Note: no live web fetch
// available here, so this infers from the name/domain — fine for a mockup.
export async function describeFromWebsite(website: string, legalName: string): Promise<string> {
  if (!website.trim() && !legalName.trim()) return "";
  try {
    const resp = await client().chat.completions.create({
      model: MODEL(),
      max_tokens: 160,
      messages: [
        {
          role: "system",
          content:
            "Write a concise 1-2 sentence company description for a staffing/HR client profile. Plain text only, no preamble or quotes. If unsure what the company does, infer reasonably from its name and domain and keep it generic.",
        },
        { role: "user", content: `Company: ${legalName || "(unknown)"}\nWebsite: ${website || "(none)"}` },
      ],
    });
    return (resp.choices[0]?.message?.content ?? "").trim();
  } catch (e) {
    console.error("describeFromWebsite failed:", e);
    return "";
  }
}

export type InterviewStep = { next_question: string } | { done: true };

// 1) Interviewer — picks the next best question, or signals done.
export async function runInterviewer(
  persona: Persona,
  brief: string,
  transcript: TranscriptTurn[],
): Promise<InterviewStep> {
  const answered = transcript.filter((t) => t.role === "user").length;
  if (answered >= QUESTION_CAP) return { done: true };
  const needMore = answered < MIN_QUESTIONS; // still below the minimum

  const system = [
    "You are an intake interviewer for StaffingNation, an HR/staffing solution engine.",
    "Interview the client conversationally to understand their situation BEFORE recommending anything. Ask thorough, probing questions — one at a time — and build on their answers.",
    personaStance(persona),
    catalogContext(),
    SIGNAL_DEFINITIONS,
    `Ask ONE open question at a time. Across the conversation, cover EACH signal area above: sourcing model (and how many agencies), worker type (W-2 vs 1099), geography/countries, whether they need someone to employ the workers, and ongoing-vs-project. Build on what they said — go a level deeper when an answer is vague. Do NOT re-ask what's already answered. Ask at least ${MIN_QUESTIONS} questions and do not finish early; you have asked ${answered} so far (hard cap ${QUESTION_CAP}). Only set done=true once you've genuinely covered the key areas.`,
    'Respond as JSON. To ask, set {"done": false, "next_question": "..."}. Only when you have thoroughly covered the areas, set {"done": true, "next_question": null}.',
  ].join("\n\n");

  try {
    const raw = await jsonChat(system, transcriptToText(brief, transcript), 600, INTERVIEW_SCHEMA);
    const parsed = safeJson<{ done?: boolean; next_question?: string | null }>(raw);

    const modelQuestion =
      parsed && typeof parsed.next_question === "string" && parsed.next_question.trim()
        ? parsed.next_question.trim()
        : null;

    // Below the minimum: keep going no matter what the model says.
    if (needMore) return { next_question: modelQuestion ?? fallbackQuestion(transcript) };

    // At/above the minimum: respect the model.
    if (!parsed || parsed.done) return { done: true };
    if (modelQuestion) return { next_question: modelQuestion };
    return { done: true };
  } catch (e) {
    console.error("runInterviewer failed:", e);
    // Don't strand the user below the minimum on a transient error.
    return needMore ? { next_question: fallbackQuestion(transcript) } : { done: true };
  }
}

// 2) Synthesizer — full transcript -> signals + recommendations with reasons.
export async function runSynthesizer(
  persona: Persona,
  brief: string,
  transcript: TranscriptTurn[],
): Promise<SynthesisResult> {
  const system = [
    "You are the synthesizer for StaffingNation client intake.",
    "Read the full intake transcript and recommend which commercial services fit.",
    catalogContext(),
    SIGNAL_DEFINITIONS,
    `Rules:
- Only recommend services using these exact codes: ${SERVICE_CODES.join(", ")}. Never invent a service.
- Recommend the smallest set that genuinely fits what they said. Multiple is fine; zero is fine if nothing fits.
- Each recommendation includes a plain-language "reason" tied to what THEY said. Explain WHY. No confidence scores.
- Also return "inferred_signals": an object capturing the signal areas (sourcing_model, worker_type, geography, needs_employer, project_vs_staff) with short values; use null when unknown.`,
    'Respond with RAW JSON only — no prose, no markdown — shaped as: {"inferred_signals": { ... }, "recommendations": [ {"service_code": "...", "reason": "..."} ]}',
  ].join("\n\n");

  let parsed: SynthesisResult | null = null;
  try {
    parsed = safeJson<SynthesisResult>(await jsonChat(system, transcriptToText(brief, transcript), 1500, SYNTH_SCHEMA));
  } catch (e) {
    console.error("runSynthesizer failed:", e);
  }

  const valid = new Set<string>(SERVICE_CODES);
  const recommendations: Recommendation[] = (parsed?.recommendations ?? [])
    .filter((r) => r && valid.has(r.service_code))
    .map((r) => ({ service_code: r.service_code, reason: String(r.reason ?? "") }));
  return {
    inferred_signals: parsed?.inferred_signals ?? {},
    recommendations,
  };
}

// --- Page 6: job-title risk categorization ---------------------------------
export type Clarification = { question: string; answer: string };
export type CategorizeResult =
  | { clarifying_question: string }
  | { risk_tier_code: RiskTierCode | null; why: string; needs_review: boolean };

const CATEGORIZE_SCHEMA: SchemaSpec = {
  name: "job_title_risk",
  schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["answer", "ask"] },
      clarifying_question: { type: ["string", "null"] },
      risk_tier_code: { type: ["string", "null"], enum: [...RISK_TIER_CODES, null] },
      why: { type: ["string", "null"] },
      needs_review: { type: "boolean" },
    },
    required: ["action", "clarifying_question", "risk_tier_code", "why", "needs_review"],
    additionalProperties: false,
  },
};

const MAX_CLARIFICATIONS = 2;

export async function categorizeJobTitle(input: {
  title: string;
  blurb?: string;
  clarifications?: Clarification[];
}): Promise<CategorizeResult> {
  const clarifications = input.clarifications ?? [];
  const askedCount = clarifications.length;
  const mayAsk = askedCount < MAX_CLARIFICATIONS;

  const system = [
    "You assign a single risk/liability tier to a staffing job title for StaffingNation.",
    riskTierContext(),
    `The risk axis turns on a few questions: does the worker DRIVE as a core duty, work at HEIGHTS or operate heavy/dangerous EQUIPMENT, handle HAZARDOUS materials, handle CASH, or work with MINORS or in other regulated/sensitive contexts?`,
    `If the title (plus any blurb and prior answers) clearly maps to one tier, set action="answer" with risk_tier_code, a one-sentence "why", and needs_review=false.`,
    `If it is genuinely AMBIGUOUS on one of those risk-relevant axes, and you ${mayAsk ? "MAY still ask" : "may NOT ask any more questions"} (asked ${askedCount} of ${MAX_CLARIFICATIONS}), set action="ask" with a single targeted clarifying_question. Otherwise you must answer.`,
    `If no tier fits even after clarification, set action="answer", risk_tier_code=null, needs_review=true (a possible addendum case).`,
    'Respond as JSON matching the schema. When answering, clarifying_question must be null; when asking, risk_tier_code/why may be null and needs_review=false.',
  ].join("\n\n");

  const userLines = [`TITLE: ${input.title}`];
  if (input.blurb) userLines.push(`BLURB: ${input.blurb}`);
  for (const c of clarifications) userLines.push(`Q: ${c.question}\nA: ${c.answer}`);

  let parsed: {
    action?: string;
    clarifying_question?: string | null;
    risk_tier_code?: string | null;
    why?: string | null;
    needs_review?: boolean;
  } | null = null;
  try {
    parsed = safeJson(await jsonChat(system, userLines.join("\n"), 400, CATEGORIZE_SCHEMA));
  } catch (e) {
    console.error("categorizeJobTitle failed:", e);
  }

  if (!parsed) return { risk_tier_code: null, why: "Could not categorize.", needs_review: true };

  if (parsed.action === "ask" && mayAsk && parsed.clarifying_question?.trim()) {
    return { clarifying_question: parsed.clarifying_question.trim() };
  }

  const valid = new Set<string>(RISK_TIER_CODES);
  const code = parsed.risk_tier_code && valid.has(parsed.risk_tier_code) ? (parsed.risk_tier_code as RiskTierCode) : null;
  return {
    risk_tier_code: code,
    why: parsed.why ?? "",
    needs_review: parsed.needs_review === true || code === null,
  };
}
