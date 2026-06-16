"use server";

import { z } from "zod";
import { runInterviewer, runSynthesizer, type InterviewStep } from "@/lib/anthropic";
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

// --- PART C: confirm (human-gated) ---------------------------------------
// Nothing is provisioned until this runs. Validates, then calls the atomic
// create_prospect_from_intake RPC (one transaction).
const confirmSchema = z.object({
  legalName: z.string().trim().min(1, "A client name is required."),
  persona: personaSchema,
  brief: z.string().default(""),
  transcript: transcriptSchema.default([]),
  inferredSignals: z.record(z.unknown()).default({}),
  selections: z
    .array(
      z.object({
        service_code: z.enum(SERVICE_CODES),
        source: z.enum(["ai", "manual"]),
      }),
    )
    .min(1, "Select at least one service to provision."),
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

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("create_prospect_from_intake", {
      p_legal_name: v.legalName,
      p_persona: v.persona,
      p_brief: v.brief,
      p_transcript: v.transcript as unknown as Json,
      p_inferred_signals: v.inferredSignals as unknown as Json,
      p_service_codes: codes,
      p_sources: sources as unknown as Json,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, entityId: data as unknown as string };
  } catch (e) {
    console.error("confirmIntakeAction failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Confirm failed." };
  }
}
