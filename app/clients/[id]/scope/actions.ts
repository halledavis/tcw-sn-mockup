"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseServer";
import type { Json } from "@/lib/database.types";

// Page 5 — operating scope + org structure write logic.

const scopeSchema = z.object({
  countries: z.array(z.object({ country_code: z.string().trim().min(1) })).default([]),
  subdivisions: z
    .array(
      z.object({
        country_code: z.string().trim().min(1),
        subdivision_code: z.string().trim().min(1),
        subdivision_type: z.enum(["state", "province"]).optional(),
      }),
    )
    .default([]),
  locations: z
    .array(
      z.object({
        name: z.string().trim().default(""),
        street: z.string().trim().default(""),
        city: z.string().trim().default(""),
        state: z.string().trim().default(""),
        country: z.string().trim().default(""),
        postal: z.string().trim().default(""),
        internal_id: z.string().trim().default(""),
        is_primary: z.boolean().default(false),
      }),
    )
    .default([]),
  departments: z
    .array(z.object({ name: z.string().trim().min(1), internal_id: z.string().trim().default("") }))
    .default([]),
});

export type ScopeResult = { ok: boolean; warnings: string[]; notes: string[] };

// One transaction (via the save_scope_and_org RPC): upsert countries +
// subdivisions, insert locations + departments, auto-add scope for any
// location whose country/state isn't scoped, and warn if a non-US country is
// scoped without the intl_compliance module.
export async function saveScopeAndOrg(entityId: string, payload: unknown): Promise<ScopeResult> {
  const id = z.string().uuid().safeParse(entityId);
  if (!id.success) return { ok: false, warnings: ["Invalid client id."], notes: [] };
  const parsed = scopeSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, warnings: [parsed.error.issues[0]?.message ?? "Invalid input."], notes: [] };
  }
  const v = parsed.data;

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("save_scope_and_org", {
      p_entity_id: id.data,
      p_countries: v.countries as unknown as Json,
      p_subdivisions: v.subdivisions as unknown as Json,
      p_locations: v.locations as unknown as Json,
      p_departments: v.departments as unknown as Json,
    });
    if (error) return { ok: false, warnings: [error.message], notes: [] };
    const r = (data ?? {}) as { ok?: boolean; warnings?: string[]; notes?: string[] };
    return { ok: r.ok ?? true, warnings: r.warnings ?? [], notes: r.notes ?? [] };
  } catch (e) {
    console.error("saveScopeAndOrg failed:", e);
    return { ok: false, warnings: [e instanceof Error ? e.message : "Save failed."], notes: [] };
  }
}

// Enable the intl_compliance module (re-enabling if disabled) and add the
// globalized_compliance service if missing — the action a saveScopeAndOrg
// warning prompts.
export async function enableGlobalizedCompliance(entityId: string): Promise<{ ok: boolean; error?: string }> {
  const id = z.string().uuid().safeParse(entityId);
  if (!id.success) return { ok: false, error: "Invalid client id." };
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase.rpc("enable_globalized_compliance", { p_entity_id: id.data });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    console.error("enableGlobalizedCompliance failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
