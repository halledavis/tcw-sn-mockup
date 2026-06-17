// Director's commentary — Halle's per-step notes for the internal mockup flows.
// UI only, no schema. Every step in both flows has an entry; an empty string
// means the bubble shows a neutral "no note yet" state and the avatar doesn't
// pulse. Halle fills these in.
export const COMMENTARY: Record<string, string> = {
  // --- Client intake / builder ---
  "client.persona": "",
  "client.brief": "",
  "client.qa": "",
  "client.recs": "",
  "client.profile": "",
  "client.scope": "",
  "client.jds": "",
  "client.config.eor": "",
  "client.config.staffing": "",
  "client.config.international": "",
  "client.config.vms": "",
  "client.summary": "",

  // --- Order intake ---
  "order.persona": "",
  "order.fulfillment": "",
  "order.source": "",
  "order.engagement": "",
  "order.location": "",
  "order.pay": "",
  "order.review": "",
};
