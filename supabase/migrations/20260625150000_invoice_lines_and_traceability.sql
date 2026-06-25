-- ============================================================================
-- halle — invoice line items + entitlement (decision) traceability
-- ============================================================================
-- The invoice table held only aggregate totals — no line items and no path to
-- the resolution that authorized billing — so the product's headline promise
-- ("every invoice line traces to an active entitlement, or it's blocked/flagged")
-- was not representable.
--
-- This adds `invoice_line`, where each line points at the `txn` it bills. The
-- authorization trace is NOT a column on the line: the `decision` table already
-- links out to the records it resolved via (object_type, object_id) — invoice,
-- timecard, order, engagement — so a line traces to its authorizing decision
-- THROUGH the decision table rather than via a redundant FK.
--
-- The `invoice_line_status` view derives that: it finds the latest decision
-- logged against the line's invoice and classifies the line as authorized /
-- unauthorized (no decision for the invoice) / blocked (decision had unsatisfied
-- gates). The deeper "validate against an active entitlement *version*" logic
-- belongs with the billing-authorization engine (the larger context/apply work).
-- ============================================================================

create table if not exists halle.invoice_line (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references halle.invoice(id) on delete cascade,
  txn_id      uuid references halle.txn(id),          -- the work being billed
  description text,
  quantity    numeric(12,2),
  unit_rate   numeric(12,4),
  amount      numeric(12,2) not null,
  created_at  timestamptz not null default now()
);

-- Self-heal any earlier shape that carried a decision_id column.
alter table halle.invoice_line drop column if exists decision_id;

create index if not exists invoice_line_invoice on halle.invoice_line (invoice_id);
create index if not exists invoice_line_txn      on halle.invoice_line (txn_id);

alter table halle.invoice_line enable row level security;

-- Authorization status per line, traced through the decision table (no FK on the
-- line). The line's invoice is matched to decisions via decision.object_type =
-- 'invoice' and decision.object_id = invoice_id; the most recent one governs.
--   unauthorized — no decision logged for this invoice
--   blocked      — that decision had unsatisfied gates
--   authorized   — that decision had no failed gates
drop view if exists halle.invoice_line_status;
create view halle.invoice_line_status as
select
  il.id          as invoice_line_id,
  il.invoice_id,
  il.txn_id,
  il.amount,
  d.id           as authorizing_decision_id,
  case
    when d.id is null then 'unauthorized'
    when coalesce(jsonb_array_length(d.result->'gates_failed'), 0) > 0 then 'blocked'
    else 'authorized'
  end as authorization_status
from halle.invoice_line il
left join lateral (
  select dd.id, dd.result
  from halle.decision dd
  where dd.object_type = 'invoice' and dd.object_id = il.invoice_id
  order by dd.occurred_at desc
  limit 1
) d on true;
