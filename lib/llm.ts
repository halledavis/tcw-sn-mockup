import "server-only";
import OpenAI from "openai";
import {
  catalogContext,
  SIGNAL_DEFINITIONS,
  SERVICE_CODES,
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

const QUESTION_CAP = 6;

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

export type InterviewStep = { next_question: string } | { done: true };

// 1) Interviewer — picks the next best question, or signals done.
export async function runInterviewer(
  persona: Persona,
  brief: string,
  transcript: TranscriptTurn[],
): Promise<InterviewStep> {
  const answered = transcript.filter((t) => t.role === "user").length;
  if (answered >= QUESTION_CAP) return { done: true };

  const system = [
    "You are an intake interviewer for StaffingNation, an HR/staffing solution engine.",
    "Your job: ask the FEWEST questions needed to map this client to the right services, then stop.",
    personaStance(persona),
    catalogContext(),
    SIGNAL_DEFINITIONS,
    `Ask ONE open, adaptive question at a time — pick the single most valuable next question given what you already know. Do not re-ask what's already answered. Stop as soon as you can confidently map them to one or more services. Soft cap: about ${QUESTION_CAP} questions total; you have asked ${answered} so far.`,
    'Respond with RAW JSON only — no prose, no markdown. Either {"next_question": "..."} to ask, or {"done": true} when you have enough to recommend services.',
  ].join("\n\n");

  try {
    const raw = await jsonChat(system, transcriptToText(brief, transcript), 600, INTERVIEW_SCHEMA);
    const parsed = safeJson<{ done?: boolean; next_question?: string | null }>(raw);
    if (!parsed) return { done: true };
    if (parsed.done) return { done: true };
    if (typeof parsed.next_question === "string" && parsed.next_question.trim()) {
      return { next_question: parsed.next_question };
    }
    return { done: true };
  } catch (e) {
    console.error("runInterviewer failed:", e);
    return { done: true };
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
