// Director's commentary — Halle's per-step notes for the internal mockup flows.
// UI only, no schema. Every step in both flows has an entry; an empty string
// means the bubble shows a neutral "no note yet" state and the avatar doesn't
// pulse. Halle fills these in.
export const COMMENTARY: Record<string, string> = {
  // --- Client intake / builder ---
  "client.persona": "If we want people to both enter SN through TCWGlobal and through staffingnation.com direct, the flows may be different.",
  "client.brief": "I was thinking that this is how we can start the client intake. Gather general information about what they are looking for, why are they coming to us. This is not information we solidly have right now and it really poorly affects our ability to market ourselves and fight for our services.",
  "client.qa": "The AI will ask further questions about the clients HR needs, including where their workers are and how they staff. This will fuel it's service/module recommendations.",
  "client.recs": "On this page, people will pick what services/modules they want.",
  "client.profile": "Provide basic information about the client. I want to provide everything important while also making it flexible for people to skip steps and do them later.",
  "client.scope": "We need to know where work is being done to help start the rates. We not only need to know where they have office locations, but also where they might do work outside those office locations (globally and around the states).",
  "client.jds": "On this page, clients will begin to tell us what kind of jobs they may want to fill/have managed. We need to know the kinds of roles the client may want so we know what kinds of rate cards to build.",
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
