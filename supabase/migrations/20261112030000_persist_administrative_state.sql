-- Durable server-only state for platform configuration and operator-managed records.
create table if not exists public.platform_app_state (
  state_key text primary key check (length(state_key) between 1 and 80),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_app_state enable row level security;
revoke all on public.platform_app_state from anon, authenticated;
grant select, insert, update, delete on public.platform_app_state to service_role;

comment on table public.platform_app_state is
  'Server-only durable configuration state. Contains admin settings, simulated projects, outcome policies, and staff/agent records.';
