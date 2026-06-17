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

// --- Engagement-step dropdowns: the selected client's departments + titles ---
export type DepartmentRow = { id: string; name: string };
export type ClientTitleRow = { id: string; title: string };

export async function listClientDepartments(entityId: string): Promise<DepartmentRow[]> {
  if (!z.string().uuid().safeParse(entityId).success) return [];
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("department")
      .select("id, name")
      .eq("entity_id", entityId)
      .order("name");
    if (error) return [];
    return (data ?? []) as DepartmentRow[];
  } catch (e) {
    console.error("listClientDepartments failed:", e);
    return [];
  }
}

export async function listClientJobTitles(entityId: string): Promise<ClientTitleRow[]> {
  if (!z.string().uuid().safeParse(entityId).success) return [];
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("client_job_title")
      .select("id, title")
      .eq("entity_id", entityId)
      .order("title");
    if (error) return [];
    return (data ?? []) as ClientTitleRow[];
  } catch (e) {
    console.error("listClientJobTitles failed:", e);
    return [];
  }
}

// --- Location step: client's definite offices + in-scope countries (map) ---
export type OrderLocation = {
  id: string;
  name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  is_primary: boolean;
};

export async function listClientLocations(entityId: string): Promise<OrderLocation[]> {
  if (!z.string().uuid().safeParse(entityId).success) return [];
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("location")
      .select("id, name, city, state, country, is_primary")
      .eq("entity_id", entityId)
      .order("is_primary", { ascending: false });
    if (error) return [];
    return (data ?? []) as OrderLocation[];
  } catch (e) {
    console.error("listClientLocations failed:", e);
    return [];
  }
}

export async function listClientScopeCountries(entityId: string): Promise<string[]> {
  if (!z.string().uuid().safeParse(entityId).success) return [];
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("client_country_scope")
      .select("country_code")
      .eq("entity_id", entityId);
    if (error) return [];
    return (data ?? []).map((r) => r.country_code);
  } catch (e) {
    console.error("listClientScopeCountries failed:", e);
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

// Update path so later flow steps edit the SAME draft row (CRUD, not
// insert-only). Every field is optional: undefined = leave as-is, null = clear.
// The Engagement-details step uses this to write its fields onto the draft.
const updateSchema = z.object({
  // earlier-step edits
  fulfillment: z.enum(["agent", "worker", "project"]).optional(),
  fillSource: z.enum(["self_pending", "self_known", "staffing_outside", "staffing_kickoff"]).nullable().optional(),
  numWorkers: z.number().int().positive().optional(),
  // engagement details
  clientJobTitleId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  weeklyHours: z.number().nonnegative().nullable().optional(),
  hoursType: z.enum(["fixed", "variable"]).nullable().optional(),
  durationValue: z.number().int().positive().nullable().optional(),
  durationUnit: z.enum(["days", "weeks", "months", "years"]).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  // location details
  workArrangement: z.enum(["onsite", "remote", "hybrid", "open"]).nullable().optional(),
  reportingLocationId: z.string().uuid().nullable().optional(),
});
export type UpdateOrderPayload = z.input<typeof updateSchema>;

export async function updateDraftOrder(id: string, input: UpdateOrderPayload): Promise<{ ok: boolean; error?: string }> {
  const idCheck = z.string().uuid().safeParse(id);
  if (!idCheck.success) return { ok: false, error: "Invalid order id." };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const p = parsed.data;
  try {
    const supabase = supabaseAdmin();
    const patch: Database["public"]["Tables"]["job_order"]["Update"] = {};
    if (p.fulfillment !== undefined) {
      patch.fulfillment_type = p.fulfillment;
      patch.flow_type = toFlowType(p.fulfillment);
    }
    if (p.fillSource !== undefined) {
      patch.fill_source = p.fillSource;
      patch.candidate_known = toCandidateKnown(p.fillSource);
      if (p.fulfillment) patch.source_type = toSourceType(p.fulfillment, p.fillSource);
    }
    if (p.numWorkers !== undefined) patch.num_workers = p.numWorkers;
    if (p.clientJobTitleId !== undefined) patch.client_job_title_id = p.clientJobTitleId;
    if (p.departmentId !== undefined) patch.department_id = p.departmentId;
    if (p.weeklyHours !== undefined) patch.weekly_hours = p.weeklyHours;
    if (p.hoursType !== undefined) patch.hours_type = p.hoursType;
    if (p.durationValue !== undefined) patch.duration_value = p.durationValue;
    if (p.durationUnit !== undefined) patch.duration_unit = p.durationUnit;
    if (p.startDate !== undefined) patch.start_date = p.startDate;
    if (p.endDate !== undefined) patch.end_date = p.endDate;
    if (p.workArrangement !== undefined) patch.work_arrangement = p.workArrangement;
    if (p.reportingLocationId !== undefined) patch.reporting_location_id = p.reportingLocationId;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("job_order").update(patch).eq("id", idCheck.data);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    console.error("updateDraftOrder failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}
