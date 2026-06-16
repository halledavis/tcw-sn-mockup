"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { categorizeJobTitle as categorize, type CategorizeResult } from "@/lib/llm";
import { RISK_TIER_CODES } from "@/lib/catalog";
import type { Json } from "@/lib/database.types";

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

// --- Derive draft bill cards (one per distinct confirmed tier) ---
export type BillCard = {
  id: string;
  risk_tier_id: string;
  states: Json;
  markup_pct: number | null;
  status: string;
};
export type DeriveResult = { ok: true; cards: BillCard[] } | { ok: false; error: string };

export async function deriveBillCards(entityId: string): Promise<DeriveResult> {
  const id = z.string().uuid().safeParse(entityId);
  if (!id.success) return { ok: false, error: "Invalid client id." };
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("derive_bill_cards", { p_entity_id: id.data });
    if (error) return { ok: false, error: error.message };
    return { ok: true, cards: (data ?? []) as unknown as BillCard[] };
  } catch (e) {
    console.error("deriveBillCards failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Derive failed." };
  }
}
