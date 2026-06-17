"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseServer";

// Per-client config-page progress. Each gated config page the wizard renders
// upserts a row here as it's completed or skipped, so progress is resumable
// and visible on the summary.

const schema = z.object({
  entityId: z.string().uuid(),
  configKey: z.string().trim().min(1),
  status: z.enum(["not_started", "completed", "skipped"]),
});

export async function setConfigStatus(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from("entity_config_status")
      .upsert(
        {
          entity_id: parsed.data.entityId,
          config_key: parsed.data.configKey,
          status: parsed.data.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "entity_id,config_key" },
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    console.error("setConfigStatus failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

// EoR "TargetCW exclusive for payroll?" flag. When exclusive, point the client's
// default EoR at the seeded master (TargetCW), which bars other EoRs. When not
// exclusive we leave the existing pointer untouched (mockup — no separate
// multi-EoR model yet).
const exclusiveSchema = z.object({ entityId: z.string().uuid(), exclusive: z.boolean() });

export async function setEorExclusive(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = exclusiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (!parsed.data.exclusive) return { ok: true };
  try {
    const supabase = supabaseAdmin();
    const { data: master, error: mErr } = await supabase
      .from("entity")
      .select("id")
      .eq("kind", "tcw")
      .eq("is_default_eor", true)
      .limit(1)
      .maybeSingle();
    if (mErr) return { ok: false, error: mErr.message };
    if (!master) return { ok: false, error: "Master EoR (TargetCW) not found." };
    const { error } = await supabase
      .from("entity")
      .update({ default_eor_id: master.id })
      .eq("id", parsed.data.entityId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    console.error("setEorExclusive failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
