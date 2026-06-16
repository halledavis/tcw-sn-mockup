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

// US states + DC and Canadian provinces/territories, for the subdivision picker.
export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

export const CA_PROVINCES: { code: string; name: string }[] = [
  { code: "AB", name: "Alberta" }, { code: "BC", name: "British Columbia" }, { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" }, { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" }, { code: "NT", name: "Northwest Territories" }, { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" }, { code: "PE", name: "Prince Edward Island" }, { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" }, { code: "YT", name: "Yukon" },
];

// Country codes that have a selectable subdivision list (others are country-level).
export function subdivisionsFor(country: string): { code: string; name: string }[] | null {
  if (country === "US") return US_STATES;
  if (country === "CA") return CA_PROVINCES;
  return null;
}

// Risk-tier catalog (mirrors the seeded risk_tier table) — used to ground the
// job-title categorizer. The categorizer may only return one of these codes.
export const RISK_TIER_CODES = ["tier_0", "tier_1", "tier_2", "tier_3", "tier_4"] as const;
export type RiskTierCode = (typeof RISK_TIER_CODES)[number];

export const RISK_TIERS: { code: RiskTierCode; name: string; definition: string; default_markup_pct: number }[] = [
  { code: "tier_0", name: "General Office / Clerical / IT", definition: "Desk/office, clerical, administrative, software/IT — no physical or safety risk.", default_markup_pct: 18 },
  { code: "tier_1", name: "Skilled / Light Industrial", definition: "Skilled trades or light industrial — light assembly, technicians, light warehouse.", default_markup_pct: 28 },
  { code: "tier_2", name: "Manual / Physical Labor", definition: "Sustained manual/physical labor — general labor, heavy warehouse, movers.", default_markup_pct: 38 },
  { code: "tier_3", name: "Hazardous / High-Risk", definition: "Driving as a core duty, working at heights, heavy/dangerous equipment, hazardous materials.", default_markup_pct: 50 },
  { code: "tier_4", name: "Regulated / Sensitive", definition: "Regulated or sensitive contexts — cash handling, working with minors, security, controlled substances.", default_markup_pct: 45 },
];

export function riskTierContext(): string {
  return [
    "RISK TIER CATALOG (return one of these exact codes, single risk/liability axis):",
    ...RISK_TIERS.map((t) => `- ${t.code}: ${t.name} — ${t.definition}`),
  ].join("\n");
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
