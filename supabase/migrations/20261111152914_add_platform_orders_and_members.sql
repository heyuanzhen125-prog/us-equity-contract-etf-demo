create table if not exists public.platform_members (
  personal_id text primary key check (personal_id ~ '^NST-[A-Z0-9]{8}$'),
  email text not null unique,
  inviter_id text,
  agent_id text,
  created_at timestamptz not null default now(),
  kyc_status text not null default 'unverified'
    check (kyc_status in ('unverified', 'pending', 'verified', 'rejected'))
);

create table if not exists public.platform_orders (
  id uuid primary key,
  kind text not null check (kind in ('contracts', 'forecasts', 'etfOrders')),
  personal_id text not null,
  symbol text not null,
  status text not null,
  result text,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  order_data jsonb not null
);

create index if not exists platform_orders_created_at_idx
  on public.platform_orders (created_at desc);
create index if not exists platform_orders_personal_id_idx
  on public.platform_orders (personal_id, created_at desc);

alter table public.platform_members enable row level security;
alter table public.platform_orders enable row level security;

revoke all on public.platform_members from anon, authenticated;
revoke all on public.platform_orders from anon, authenticated;
grant select, insert, update, delete on public.platform_members to service_role;
grant select, insert, update, delete on public.platform_orders to service_role;
