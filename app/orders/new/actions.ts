"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseServer";
import type { Database } from "@/lib/database.types";

type FlowType = Database["public"]["Enums"]["flow_type"];
type SourceType = Database["public"]["Enums"]["source_type"];

// --- Client selector: seeded billable-entity clients an order can attach to ---
export type OrderClient = { id: string; legal_name: string };

export async function listOrderClients(): Promise<OrderClient[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("entity")
      .select("id, legal_name")
      .eq("kind", "client")
      .eq("is_billable_entity", true)
      .order("legal_name");
    if (error) return [];
    return (data ?? []) as OrderClient[];
  } catch (e) {
    console.error("listOrderClients failed:", e);
    return [];
  }
}

// --- Mappings: wizard selections -> the existing flow_type/source_type pair ---
// flow_type: agent is a placeholder ('worker') until agent modeling exists.
function toFlowType(fulfillment: "agent" | "worker" | "project"): FlowType {
  return fulfillment === "project" ? "supplier" : "worker";
}
// source_type when a fill source was chosen (worker requisitions); for
// agent/project there's no fill-source step, so we fall back: project rows are
// supplier-sourced, agent rows are a self_sourced placeholder (noted).
function toSourceType(
  fulfillment: "agent" | "worker" | "project",
  fillSource: "self_pending" | "self_known" | "staffing_outside" | "staffing_kickoff" | null,
): SourceType {
  if (fillSource === "staffing_outside") return "outside_sn";
  if (fillSource === "staffing_kickoff") return "externally_sourced";
  if (fillSource === "self_pending" || fillSource === "self_known") return "self_sourced";
  return fulfillment === "project" ? "externally_sourced" : "self_sourced";
}
function toCandidateKnown(
  fillSource: "self_pending" | "self_known" | "staffing_outside" | "staffing_kickoff" | null,
): boolean | null {
  if (fillSource === "self_known") return true;
  if (fillSource === "self_pending") return false;
  return null;
}

// Resolve a default submitter for the client (first seeded user), or null.
async function defaultSubmitter(supabase: ReturnType<typeof supabaseAdmin>, entityId: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_user")
    .select("id")
    .eq("entity_id", entityId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

const payloadSchema = z.object({
  entityId: z.string().uuid(),
  fulfillment: z.enum(["agent", "worker", "project"]),
  fillSource: z.enum(["self_pending", "self_known", "staffing_outside", "staffing_kickoff"]).nullable().default(null),
  numWorkers: z.number().int().positive().default(1),
});
export type OrderPayload = z.input<typeof payloadSchema>;

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

// Insert a DRAFT job_order from the order-intake flow. Stores the finer-grained
// fulfillment/fill_source/candidate_known AND the mapped flow_type/source_type.
export async function createDraftOrder(input: unknown): Promise<CreateResult> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const p = parsed.data;
  try {
    const supabase = supabaseAdmin();
    const submitted_by = await defaultSubmitter(supabase, p.entityId);
    const { data, error } = await supabase
      .from("job_order")
      .insert({
        entity_id: p.entityId,
        submitted_by,
        fulfillment_type: p.fulfillment,
        fill_source: p.fillSource,
        candidate_known: toCandidateKnown(p.fillSource),
        flow_type: toFlowType(p.fulfillment),
        source_type: toSourceType(p.fulfillment, p.fillSource),
        num_workers: p.numWorkers,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("createDraftOrder failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Create failed." };
  }
}

// Stub update path so later flow steps edit the SAME row (CRUD, not insert-only).
// Signature is ready; body intentionally minimal for now.
export async function updateDraftOrder(id: string, input: Partial<OrderPayload>): Promise<{ ok: boolean; error?: string }> {
  const idCheck = z.string().uuid().safeParse(id);
  if (!idCheck.success) return { ok: false, error: "Invalid order id." };
  try {
    const supabase = supabaseAdmin();
    const patch: Database["public"]["Tables"]["job_order"]["Update"] = {};
    if (input.fulfillment) {
      patch.fulfillment_type = input.fulfillment;
      patch.flow_type = toFlowType(input.fulfillment);
    }
    if (input.fillSource !== undefined) {
      patch.fill_source = input.fillSource;
      patch.candidate_known = toCandidateKnown(input.fillSource ?? null);
      if (input.fulfillment) patch.source_type = toSourceType(input.fulfillment, input.fillSource ?? null);
    }
    if (input.numWorkers !== undefined) patch.num_workers = input.numWorkers;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("job_order").update(patch).eq("id", idCheck.data);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    console.error("updateDraftOrder failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}
