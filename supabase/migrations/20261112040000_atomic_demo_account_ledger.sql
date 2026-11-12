-- Separate demo balances from order history and make reservations/settlement atomic.
create table if not exists public.platform_demo_accounts (
  personal_id text not null references public.platform_members(personal_id) on delete restrict,
  currency text not null check (currency in ('PTS', 'USD')),
  balance numeric(24, 8) not null check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (personal_id, currency)
);

create table if not exists public.platform_demo_ledger (
  id uuid primary key default gen_random_uuid(),
  personal_id text not null references public.platform_members(personal_id) on delete restrict,
  currency text not null check (currency in ('PTS', 'USD')),
  event_type text not null check (event_type in ('migration_snapshot', 'order_debit', 'settlement_credit')),
  amount numeric(24, 8) not null check (amount <> 0),
  order_id uuid references public.platform_orders(id) on delete restrict,
  note text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists platform_demo_ledger_order_event_uidx
  on public.platform_demo_ledger (order_id, event_type) where order_id is not null;
create unique index if not exists platform_demo_ledger_account_snapshot_uidx
  on public.platform_demo_ledger (personal_id, currency, event_type) where order_id is null;
create index if not exists platform_demo_ledger_member_idx
  on public.platform_demo_ledger (personal_id, currency, created_at desc);

alter table public.platform_demo_accounts enable row level security;
alter table public.platform_demo_ledger enable row level security;
revoke all on public.platform_demo_accounts, public.platform_demo_ledger from anon, authenticated;
grant select, insert, update on public.platform_demo_accounts to service_role;
grant select, insert on public.platform_demo_ledger to service_role;

-- Preserve each account's existing computed demo balance as a cutover snapshot.
with order_balances as (
  select o.personal_id,
         case when kind = 'etfOrders' then 'USD' else 'PTS' end as currency,
         max(case when kind = 'etfOrders' then 25000::numeric else 10000::numeric end)
           + sum(-coalesce(nullif(order_data->>'stake', '')::numeric, nullif(order_data->>'amount', '')::numeric, 0)
                 + coalesce(nullif(order_data->>'payout', '')::numeric, 0)) as calculated_balance
  from public.platform_orders o
  join public.platform_members m on m.personal_id = o.personal_id
  group by o.personal_id, case when kind = 'etfOrders' then 'USD' else 'PTS' end
), inserted_accounts as (
  insert into public.platform_demo_accounts (personal_id, currency, balance)
  select personal_id, currency, greatest(0, calculated_balance)
  from order_balances
  on conflict (personal_id, currency) do nothing
  returning personal_id, currency, balance
)
insert into public.platform_demo_ledger (personal_id, currency, event_type, amount, note)
select personal_id, currency, 'migration_snapshot', balance,
       'Balance carried forward from existing simulated order history.'
from inserted_accounts
where balance > 0;

create or replace function public.place_platform_demo_order(
  p_order_id uuid,
  p_kind text,
  p_order_data jsonb,
  p_amount numeric
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_currency text;
  v_personal_id text;
  v_expected_amount numeric;
  v_balance numeric(24, 8);
  v_initial_balance numeric(24, 8);
  v_existing jsonb;
  v_created_at timestamptz;
begin
  if p_kind not in ('contracts', 'forecasts', 'etfOrders')
     or p_order_data->>'id' is distinct from p_order_id::text
     or p_order_data->>'status' is distinct from 'pending'
     or p_order_data->>'result' is not null
     or p_amount is null or p_amount <= 0 then
    raise exception 'Invalid demo order';
  end if;

  v_personal_id := p_order_data->>'personalId';
  v_currency := case when p_kind = 'etfOrders' then 'USD' else 'PTS' end;
  v_expected_amount := case when p_kind = 'etfOrders'
    then nullif(p_order_data->>'amount', '')::numeric
    else nullif(p_order_data->>'stake', '')::numeric end;
  if v_personal_id is null or length(v_personal_id) > 32 or v_expected_amount is distinct from p_amount then
    raise exception 'Demo order amount or member mismatch';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text, 0));
  select order_data into v_existing from public.platform_orders where id = p_order_id for update;
  if found then
    if v_existing = p_order_data then
      select balance into v_balance from public.platform_demo_accounts
      where personal_id = v_personal_id and currency = v_currency;
      return pg_catalog.jsonb_build_object('order', v_existing, 'balance', v_balance, 'currency', v_currency, 'replayed', true);
    end if;
    raise exception 'Order id already exists with different data';
  end if;

  v_initial_balance := case when v_currency = 'PTS' then 10000 else 25000 end;
  insert into public.platform_demo_accounts (personal_id, currency, balance)
  values (v_personal_id, v_currency, v_initial_balance)
  on conflict (personal_id, currency) do nothing;
  if found then
    insert into public.platform_demo_ledger (personal_id, currency, event_type, amount, note)
    values (v_personal_id, v_currency, 'migration_snapshot', v_initial_balance,
            'Initial simulated demo balance.');
  end if;
  select balance into v_balance from public.platform_demo_accounts
  where personal_id = v_personal_id and currency = v_currency for update;
  if v_balance < p_amount then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_DEMO_BALANCE';
  end if;

  update public.platform_demo_accounts
  set balance = balance - p_amount, updated_at = pg_catalog.now()
  where personal_id = v_personal_id and currency = v_currency
  returning balance into v_balance;

  v_created_at := coalesce(nullif(p_order_data->>'createdAt', '')::timestamptz,
                            nullif(p_order_data->>'updatedAt', '')::timestamptz,
                            pg_catalog.now());
  insert into public.platform_orders
    (id, kind, personal_id, symbol, status, result, created_at, updated_at, order_data)
  values
    (p_order_id, p_kind, v_personal_id,
     coalesce(p_order_data->>'projectSymbol', p_order_data->>'eventId', p_order_data->>'symbol', 'SIM'),
     'pending', null, v_created_at, pg_catalog.now(), p_order_data);
  insert into public.platform_demo_ledger (personal_id, currency, event_type, amount, order_id, note)
  values (v_personal_id, v_currency, 'order_debit', -p_amount, p_order_id, 'Simulated order stake reserved.');

  return pg_catalog.jsonb_build_object('order', p_order_data, 'balance', v_balance, 'currency', v_currency, 'replayed', false);
end;
$$;

create or replace function public.settle_platform_order_with_audit(
  p_order_id uuid,
  p_kind text,
  p_order_data jsonb,
  p_actor text,
  p_rationale text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_order public.platform_orders;
  v_currency text;
  v_credit numeric(24, 8);
  v_balance numeric(24, 8);
begin
  if p_kind not in ('contracts', 'forecasts', 'etfOrders')
     or p_order_data->>'id' is distinct from p_order_id::text
     or p_order_data->>'status' not in ('won', 'lost', 'draw')
     or p_order_data->>'result' is distinct from p_order_data->>'status'
     or p_actor is null or length(p_actor) < 1 or length(p_actor) > 80
     or p_rationale is null or length(p_rationale) < 10 or length(p_rationale) > 500 then
    raise exception 'Invalid audited settlement';
  end if;

  select * into v_order from public.platform_orders
  where id = p_order_id and kind = p_kind for update;
  if not found or v_order.status <> 'pending' then
    raise exception 'Order is not pending';
  end if;
  if v_order.order_data->>'personalId' is distinct from p_order_data->>'personalId' then
    raise exception 'Order member cannot change during settlement';
  end if;

  v_currency := case when p_kind = 'etfOrders' then 'USD' else 'PTS' end;
  v_credit := coalesce(nullif(p_order_data->>'payout', '')::numeric, 0);
  if v_credit < 0 then raise exception 'Invalid settlement credit'; end if;
  if v_credit > 0 then
    update public.platform_demo_accounts
    set balance = balance + v_credit, updated_at = pg_catalog.now()
    where personal_id = v_order.personal_id and currency = v_currency
    returning balance into v_balance;
    if not found then raise exception 'Demo account not found'; end if;
    insert into public.platform_demo_ledger (personal_id, currency, event_type, amount, order_id, note)
    values (v_order.personal_id, v_currency, 'settlement_credit', v_credit, p_order_id, p_rationale);
  else
    select balance into v_balance from public.platform_demo_accounts
    where personal_id = v_order.personal_id and currency = v_currency for update;
  end if;

  update public.platform_orders
  set status = p_order_data->>'status', order_data = p_order_data, updated_at = pg_catalog.now()
  where id = p_order_id and kind = p_kind;
  insert into public.platform_settlement_audit (order_id, kind, previous_status, result, actor, rationale)
  values (p_order_id, p_kind, v_order.status, p_order_data->>'status', p_actor, p_rationale);

  return pg_catalog.jsonb_build_object('order', p_order_data, 'balance', v_balance, 'currency', v_currency);
end;
$$;

alter table public.platform_settlement_audit
  drop constraint if exists platform_settlement_audit_result_check;
alter table public.platform_settlement_audit
  add constraint platform_settlement_audit_result_check check (result in ('won', 'lost', 'draw'));

revoke all on function public.place_platform_demo_order(uuid, text, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.place_platform_demo_order(uuid, text, jsonb, numeric) to service_role;
revoke all on function public.settle_platform_order_with_audit(uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.settle_platform_order_with_audit(uuid, text, jsonb, text, text) to service_role;
