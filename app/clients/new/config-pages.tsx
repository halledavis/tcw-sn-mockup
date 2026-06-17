"use client";

import type { ServiceCode } from "@/lib/catalog";

// Module-gated config-page registry.
//
// Each entry declares a config page that the wizard renders AFTER the base
// flow, but only when its `gateService` is among the client's selected
// services. Pages render in ascending `order`, are skippable, and write
// entity_config_status as they're completed/skipped (handled by the wizard).
//
// Adding a future module's config page = one entry here + its component.
// Real components arrive in later prompts; for now each is an empty
// placeholder so the sequencing/registry wiring can be exercised end-to-end.

export type ConfigPageProps = {
  entityId: string;
  busy: boolean;
  onComplete: () => void;
  onSkip: () => void;
};

export type ConfigPageDef = {
  key: string;
  label: string;
  gateService: ServiceCode;
  order: number;
  component: React.ComponentType<ConfigPageProps>;
};

// Shared placeholder body — swapped for real config UI per page later.
function Placeholder({ label }: { label: string }) {
  return (
    <>
      <h2>{label}</h2>
      <div className="panel mock" style={{ marginTop: 8 }}>
        <p className="small" style={{ marginTop: 0 }}>
          Placeholder — the {label.toLowerCase()} step isn&apos;t built yet. The wizard reaches it because the
          gating service is enabled; the real configuration UI lands in a later prompt.
        </p>
      </div>
    </>
  );
}

const EorConfig = (_: ConfigPageProps) => <Placeholder label="EoR configuration" />;
const StaffingConfig = (_: ConfigPageProps) => <Placeholder label="Staffing configuration" />;
const InternationalConfig = (_: ConfigPageProps) => <Placeholder label="International configuration" />;
const VmsConfig = (_: ConfigPageProps) => <Placeholder label="VMS / MSP configuration" />;

export const CONFIG_PAGES: ConfigPageDef[] = [
  { key: "eor", label: "EoR configuration", gateService: "eor", order: 10, component: EorConfig },
  { key: "staffing", label: "Staffing configuration", gateService: "staffing", order: 20, component: StaffingConfig },
  { key: "international", label: "International configuration", gateService: "globalized_compliance", order: 30, component: InternationalConfig },
  { key: "vms", label: "VMS / MSP configuration", gateService: "vms", order: 40, component: VmsConfig },
];

// The ordered config pages whose gating service is enabled for this client.
export function enabledConfigPages(selectedServices: Iterable<string>): ConfigPageDef[] {
  const set = selectedServices instanceof Set ? selectedServices : new Set(selectedServices);
  return CONFIG_PAGES.filter((p) => set.has(p.gateService)).sort((a, b) => a.order - b.order);
}
