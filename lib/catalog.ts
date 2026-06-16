// Canonical catalog used to GROUND the AI (mirrors the seeded module/service
// tables) and shared types. Service codes here are the ONLY values the
// synthesizer may emit. Safe to import on client or server.

export const SERVICE_CODES = [
  "eor",
  "staffing",
  "vms",
  "ic_1099_compliance",
  "globalized_compliance",
  "nation_recruiting",
] as const;

export type ServiceCode = (typeof SERVICE_CODES)[number];

export const SERVICES: { code: ServiceCode; name: string; blurb: string }[] = [
  { code: "eor", name: "Employer of Record", blurb: "We legally employ your workers and handle timekeeping/payroll." },
  { code: "staffing", name: "Staffing", blurb: "Onboard and pay workers you have already sourced yourself." },
  { code: "vms", name: "VMS / MSP", blurb: "Manage a network of staffing suppliers through a VMS + MSP." },
  { code: "ic_1099_compliance", name: "IC / 1099 Compliance", blurb: "Evaluate and compliantly engage independent contractors." },
  { code: "globalized_compliance", name: "Globalized Compliance", blurb: "Employ and stay compliant with workers outside your home country." },
  { code: "nation_recruiting", name: "Nation Recruiting", blurb: "Source new candidates through the StaffingNation marketplace." },
];

// Thin two-level map (service -> modules), mirrors service_module seed.
export const SERVICE_MODULES: Record<ServiceCode, string[]> = {
  eor: ["eor", "timekeeping"],
  staffing: ["self_sourced"],
  vms: ["vms", "msp"],
  ic_1099_compliance: ["ic_1099_eval"],
  globalized_compliance: ["intl_compliance"],
  nation_recruiting: ["marketplace"],
};

export const serviceName = (code: string) =>
  SERVICES.find((s) => s.code === code)?.code === code
    ? SERVICES.find((s) => s.code === code)!.name
    : code;

// Countries offered in the builder; default currency auto-selects from country.
export const COUNTRIES: { code: string; name: string; currency: string }[] = [
  { code: "US", name: "United States", currency: "USD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "PH", name: "Philippines", currency: "PHP" },
];

export function currencyForCountry(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.currency ?? "";
}

export type Persona = "cra" | "prospect";

export type TranscriptTurn = { role: "ai" | "user"; content: string };

export type Recommendation = { service_code: ServiceCode; reason: string };

export type SynthesisResult = {
  inferred_signals: Record<string, unknown>;
  recommendations: Recommendation[];
};

// The signal areas the interviewer must cover and the synthesizer extracts.
// Embedded in both system prompts so output is grounded, not hallucinated.
export const SIGNAL_DEFINITIONS = `
SIGNAL AREAS to uncover (enough to map to services — not every detail):
- sourcing_model: do they bring their own workers, want us to source, or use multiple staffing agencies/suppliers? roughly how many agencies?
- worker_type: W-2 employees vs 1099 independent contractors (or unsure / mixed).
- geography: which country/countries the workers are in; any need to employ outside the home country.
- needs_employer: do they need someone to legally employ the workers (Employer of Record), or do they already employ them?
- project_vs_staff: ongoing staffing vs project/SOW-based work (informational).
`.trim();

export function catalogContext(): string {
  const lines = SERVICES.map(
    (s) => `- ${s.code}: ${s.name} — ${s.blurb} (turns on modules: ${SERVICE_MODULES[s.code].join(", ")})`,
  );
  return [
    "SERVICE CATALOG (the only services you may recommend; use these exact codes):",
    ...lines,
  ].join("\n");
}
