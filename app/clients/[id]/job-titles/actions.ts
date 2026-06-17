"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { categorizeJobTitle as categorize, type CategorizeResult } from "@/lib/llm";
import { RISK_TIER_CODES } from "@/lib/catalog";
import type { Database, Json } from "@/lib/database.types";

export type BillCardServiceType = Database["public"]["Enums"]["bill_card_service_type"];
const SERVICE_TYPES = ["eor", "staffing", "vms"] as const;

// Page 6 — job types / risk tiering / bill cards.

const clarificationSchema = z.object({ question: z.string(), answer: z.string() });

// --- LLM: categorize one job title into a risk tier (or ask a follow-up) ---
const categorizeSchema = z.object({
  title: z.string().trim().min(1, "A title is required."),
  blurb: z.string().optional(),
  clarifications: z.array(clarificationSchema).default([]),
});

export async function categorizeJobTitle(input: unknown): Promise<CategorizeResult> {
  const v = categorizeSchema.parse(input);
  return categorize({ title: v.title, blurb: v.blurb, clarifications: v.clarifications });
}

// --- Upsert confirmed job titles (atomic via save_job_titles RPC) ---
const titleSchema = z.object({
  title: z.string().trim().min(1),
  blurb: z.string().optional(),
  risk_tier_code: z.enum(RISK_TIER_CODES).nullable().optional(),
  ai_rationale: z.string().optional(),
  needs_review: z.boolean().optional(),
  clarifications: z.array(clarificationSchema).optional(),
});

export type SavedTitle = {
  id: string;
  title: string;
  risk_tier_id: string | null;
  status: string;
  needs_review: boolean;
};
export type SaveTitlesResult = { ok: true; titles: SavedTitle[] } | { ok: false; error: string };

export async function saveJobTitles(entityId: string, titles: unknown): Promise<SaveTitlesResult> {
  const id = z.string().uuid().safeParse(entityId);
  if (!id.success) return { ok: false, error: "Invalid client id." };
  const parsed = z.array(titleSchema).min(1, "Add at least one job title.").safeParse(titles);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("save_job_titles", {
      p_entity_id: id.data,
      p_titles: parsed.data as unknown as Json,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, titles: (data ?? []) as unknown as SavedTitle[] };
  } catch (e) {
    console.error("saveJobTitles failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

// --- Risk-tier catalog (id -> code/name, for display) ---
export type RiskTierRow = { id: string; code: string; name: string; default_markup_pct: number | null };

export async function listRiskTiers(): Promise<RiskTierRow[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("risk_tier")
      .select("id, code, name, default_markup_pct")
      .order("sort_order");
    if (error) return [];
    return (data ?? []) as unknown as RiskTierRow[];
  } catch (e) {
    console.error("listRiskTiers failed:", e);
    return [];
  }
}

// --- Persist bill-card edits (markup / states / status) ---
const cardEditSchema = z.object({
  id: z.string().uuid(),
  markup_pct: z.number().nullable(),
  states: z.array(z.string()).min(1).default(["ALL"]),
  status: z.enum(["draft", "active"]).default("draft"),
});

export async function saveBillCards(cards: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.array(cardEditSchema).safeParse(cards);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    const supabase = supabaseAdmin();
    for (const c of parsed.data) {
      const { error } = await supabase
        .from("bill_card")
        .update({ markup_pct: c.markup_pct, states: c.states as unknown as Json, status: c.status })
        .eq("id", c.id);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("saveBillCards failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

// --- Derive draft bill cards (one per distinct confirmed tier, per service) ---
export type BillCard = {
  id: string;
  risk_tier_id: string | null;
  service_type: BillCardServiceType;
  states: Json;
  markup_pct: number | null;
  status: string;
};
export type DeriveResult = { ok: true; cards: BillCard[] } | { ok: false; error: string };

export async function deriveBillCards(entityId: string, serviceType: BillCardServiceType): Promise<DeriveResult> {
  const id = z.string().uuid().safeParse(entityId);
  if (!id.success) return { ok: false, error: "Invalid client id." };
  const st = z.enum(SERVICE_TYPES).safeParse(serviceType);
  if (!st.success) return { ok: false, error: "Invalid service type." };
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("derive_bill_cards", {
      p_entity_id: id.data,
      p_service_type: st.data,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, cards: (data ?? []) as unknown as BillCard[] };
  } catch (e) {
    console.error("deriveBillCards failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Derive failed." };
  }
}

// --- List existing bill cards for a client + service (for resuming a page) ---
export async function listBillCards(entityId: string, serviceType: BillCardServiceType): Promise<BillCard[]> {
  const id = z.string().uuid().safeParse(entityId);
  const st = z.enum(SERVICE_TYPES).safeParse(serviceType);
  if (!id.success || !st.success) return [];
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("bill_card")
      .select("id, risk_tier_id, service_type, states, markup_pct, status")
      .eq("entity_id", id.data)
      .eq("service_type", st.data)
      .order("markup_pct");
    if (error) return [];
    return (data ?? []) as unknown as BillCard[];
  } catch (e) {
    console.error("listBillCards failed:", e);
    return [];
  }
}
