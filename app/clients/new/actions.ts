"use server";

import { z } from "zod";
import { runInterviewer, runSynthesizer, describeFromWebsite, type InterviewStep } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { SERVICE_CODES, type SynthesisResult } from "@/lib/catalog";
import type { Json } from "@/lib/database.types";

const personaSchema = z.enum(["cra", "prospect"]);
const transcriptSchema = z.array(
  z.object({ role: z.enum(["ai", "user"]), content: z.string() }),
);

// --- PART B (1): interviewer ---------------------------------------------
const interviewSchema = z.object({
  persona: personaSchema,
  brief: z.string().default(""),
  transcript: transcriptSchema.default([]),
});

export async function interviewAction(input: unknown): Promise<InterviewStep> {
  const { persona, brief, transcript } = interviewSchema.parse(input);
  try {
    return await runInterviewer(persona, brief, transcript);
  } catch (e) {
    console.error("interviewAction failed:", e);
    return { done: true }; // fail safe — end the interview rather than hang
  }
}

// --- PART B (2): synthesizer ---------------------------------------------
const synthSchema = z.object({
  persona: personaSchema,
  brief: z.string().default(""),
  transcript: transcriptSchema.default([]),
});

export async function synthesizeAction(input: unknown): Promise<SynthesisResult> {
  const { persona, brief, transcript } = synthSchema.parse(input);
  try {
    return await runSynthesizer(persona, brief, transcript);
  } catch (e) {
    console.error("synthesizeAction failed:", e);
    return { inferred_signals: {}, recommendations: [] };
  }
}

// --- Page 4 helper: best-effort company description from the website --------
const describeSchema = z.object({
  website: z.string().default(""),
  legalName: z.string().default(""),
});

export async function describeAction(input: unknown): Promise<{ description: string }> {
  const { website, legalName } = describeSchema.parse(input);
  return { description: await describeFromWebsite(website, legalName) };
}

// --- Page 4: confirm + create the client (human-gated) ----------------------
// Nothing is provisioned until this runs. Validates the full builder payload,
// then calls the atomic create_client_from_intake RPC (one transaction).
const contactSchema = z.object({
  kind: z.enum(["signatory", "primary"]),
  first_name: z.string().trim().default(""),
  last_name: z.string().trim().default(""),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
});

const confirmSchema = z.object({
  legalName: z.string().trim().min(1, "A legal entity name is required."),
  dba: z.string().trim().default(""),
  address: z
    .object({
      street: z.string().trim().default(""),
      city: z.string().trim().default(""),
      state: z.string().trim().default(""),
      zip: z.string().trim().default(""),
      country: z.string().trim().default(""),
    })
    .default({ street: "", city: "", state: "", zip: "", country: "" }),
  fein: z.string().trim().default(""),
  duns: z.string().trim().default(""),
  website: z.string().trim().default(""),
  currency: z.string().trim().default(""),
  description: z.string().trim().default(""),
  logoUrl: z.string().default(""),
  persona: personaSchema,
  brief: z.string().default(""),
  transcript: transcriptSchema.default([]),
  inferredSignals: z.record(z.unknown()).default({}),
  selections: z
    .array(z.object({ service_code: z.enum(SERVICE_CODES), source: z.enum(["ai", "manual"]) }))
    .min(1, "Select at least one service to provision."),
  contacts: z.array(contactSchema).default([]),
});

export type ConfirmResult =
  | { ok: true; entityId: string }
  | { ok: false; error: string };

export async function confirmIntakeAction(input: unknown): Promise<ConfirmResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  // A signatory contact (name + email) is required.
  const sig = v.contacts.find((c) => c.kind === "signatory");
  if (!sig || !sig.first_name || !sig.last_name || !sig.email) {
    return { ok: false, error: "A signatory contact (first name, last name, email) is required." };
  }

  // De-dupe service codes; build the sources map for the RPC.
  const seen = new Set<string>();
  const codes: string[] = [];
  const sources: Record<string, string> = {};
  for (const s of v.selections) {
    if (seen.has(s.service_code)) continue;
    seen.add(s.service_code);
    codes.push(s.service_code);
    sources[s.service_code] = s.source;
  }

  // Only keep contacts that have a name.
  const contacts = v.contacts.filter((c) => c.first_name && c.last_name && c.email);

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("create_client_from_intake", {
      p_legal_name: v.legalName,
      p_dba: v.dba,
      p_address: v.address as unknown as Json,
      p_fein: v.fein,
      p_duns: v.duns,
      p_website: v.website,
      p_currency: v.currency,
      p_description: v.description,
      p_logo_url: v.logoUrl,
      p_persona: v.persona,
      p_brief: v.brief,
      p_transcript: v.transcript as unknown as Json,
      p_inferred_signals: v.inferredSignals as unknown as Json,
      p_service_codes: codes,
      p_sources: sources as unknown as Json,
      p_contacts: contacts as unknown as Json,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, entityId: data as unknown as string };
  } catch (e) {
    console.error("confirmIntakeAction failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Confirm failed." };
  }
}
