-- Preserve a server-side audit trail for administrator-set simulated outcomes.
create table if not exists public.platform_settlement_audit (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.platform_orders(id) on delete restrict,
  kind text not null check (kind in ('contracts', 'forecasts', 'etfOrders')),
  previous_status text not null check (previous_status = 'pending'),
  result text not null check (result in ('won', 'lost')),
  actor text not null,
  rationale text not null check (length(rationale) between 10 and 500),
  created_at timestamptz not null default now()
);

create index if not exists platform_settlement_audit_order_idx
  on public.platform_settlement_audit (order_id, created_at desc);

alter table public.platform_settlement_audit enable row level security;
revoke all on public.platform_settlement_audit from anon, authenticated;
grant select, insert on public.platform_settlement_audit to service_role;

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
begin
  if p_kind not in ('contracts', 'forecasts', 'etfOrders')
     or p_order_data->>'id' is distinct from p_order_id::text
     or p_order_data->>'status' not in ('won', 'lost')
     or p_order_data->>'result' is distinct from p_order_data->>'status'
     or p_actor is null or length(p_actor) < 1 or length(p_actor) > 80
     or p_rationale is null or length(p_rationale) < 10 or length(p_rationale) > 500 then
    raise exception 'Invalid audited settlement';
  end if;

  select * into v_order
  from public.platform_orders
  where id = p_order_id and kind = p_kind
  for update;
  if not found or v_order.status <> 'pending' then
    raise exception 'Order is not pending';
  end if;
  if v_order.order_data->>'personalId' is distinct from p_order_data->>'personalId' then
    raise exception 'Order member cannot change during settlement';
  end if;

  update public.platform_orders
  set status = p_order_data->>'status',
      order_data = p_order_data,
      updated_at = pg_catalog.now()
  where id = p_order_id and kind = p_kind;

  insert into public.platform_settlement_audit (order_id, kind, previous_status, result, actor, rationale)
  values (p_order_id, p_kind, v_order.status, p_order_data->>'status', p_actor, p_rationale);

  return pg_catalog.jsonb_build_object('order', p_order_data);
end;
$$;

revoke all on function public.settle_platform_order_with_audit(uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.settle_platform_order_with_audit(uuid, text, jsonb, text, text) to service_role;
