-- Tie a member record to Supabase Auth without changing existing member IDs.
-- Existing demo-only rows remain unlinked until their email owner signs in.
alter table public.platform_members
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists platform_members_auth_user_id_uidx
  on public.platform_members (auth_user_id)
  where auth_user_id is not null;

create table if not exists public.platform_wallet_accounts (
  personal_id text not null references public.platform_members(personal_id) on delete restrict,
  currency text not null check (currency = 'USDT'),
  balance numeric(24, 8) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (personal_id, currency)
);

create table if not exists public.platform_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  personal_id text not null references public.platform_members(personal_id) on delete restrict,
  type text not null check (type in ('deposit', 'withdrawal')),
  currency text not null default 'USDT' check (currency = 'USDT'),
  amount numeric(24, 8) not null check (amount > 0),
  fee numeric(24, 8) not null default 0 check (fee >= 0),
  network text not null,
  address text not null default '',
  status text not null check (status in ('completed', 'pending', 'approved', 'rejected')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists platform_wallet_transactions_member_idx
  on public.platform_wallet_transactions (personal_id, created_at desc);
create index if not exists platform_wallet_transactions_status_idx
  on public.platform_wallet_transactions (status, created_at desc);

alter table public.platform_wallet_accounts enable row level security;
alter table public.platform_wallet_transactions enable row level security;
revoke all on public.platform_wallet_accounts, public.platform_wallet_transactions from anon, authenticated;
grant select, insert, update, delete on public.platform_wallet_accounts, public.platform_wallet_transactions to service_role;

create or replace function public.apply_wallet_transaction(
  p_personal_id text,
  p_type text,
  p_amount numeric,
  p_fee numeric,
  p_network text,
  p_address text default ''
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_balance numeric(24, 8);
  v_status text;
  v_transaction public.platform_wallet_transactions;
begin
  if p_personal_id is null or p_type not in ('deposit', 'withdrawal') or p_amount is null or p_amount <= 0
     or p_fee is null or p_fee < 0 or p_network is null or p_network = '' then
    raise exception 'Invalid wallet transaction';
  end if;

  insert into public.platform_wallet_accounts (personal_id, currency)
  values (p_personal_id, 'USDT')
  on conflict (personal_id, currency) do nothing;

  select balance into v_balance
  from public.platform_wallet_accounts
  where personal_id = p_personal_id and currency = 'USDT'
  for update;

  if p_type = 'withdrawal' and v_balance < p_amount + p_fee then
    raise exception 'Insufficient USDT balance';
  end if;

  v_status := case when p_type = 'deposit' then 'completed' else 'pending' end;
  update public.platform_wallet_accounts
  set balance = case when p_type = 'deposit' then balance + p_amount else balance - p_amount - p_fee end,
      updated_at = pg_catalog.now()
  where personal_id = p_personal_id and currency = 'USDT'
  returning balance into v_balance;

  insert into public.platform_wallet_transactions
    (personal_id, type, currency, amount, fee, network, address, status)
  values
    (p_personal_id, p_type, 'USDT', p_amount, p_fee, p_network, coalesce(p_address, ''), v_status)
  returning * into v_transaction;

  return pg_catalog.jsonb_build_object(
    'transaction', pg_catalog.to_jsonb(v_transaction),
    'balance', v_balance
  );
end;
$$;

create or replace function public.review_wallet_withdrawal(
  p_transaction_id uuid,
  p_status text,
  p_reason text default ''
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_transaction public.platform_wallet_transactions;
  v_balance numeric(24, 8);
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid review status';
  end if;

  select * into v_transaction
  from public.platform_wallet_transactions
  where id = p_transaction_id and type = 'withdrawal'
  for update;
  if not found or v_transaction.status <> 'pending' then
    raise exception 'Withdrawal is not pending';
  end if;

  update public.platform_wallet_transactions
  set status = p_status,
      reason = case when p_status = 'rejected' then coalesce(p_reason, '') else '' end,
      reviewed_at = pg_catalog.now()
  where id = p_transaction_id
  returning * into v_transaction;

  if p_status = 'rejected' then
    update public.platform_wallet_accounts
    set balance = balance + v_transaction.amount + v_transaction.fee,
        updated_at = pg_catalog.now()
    where personal_id = v_transaction.personal_id and currency = 'USDT'
    returning balance into v_balance;
  else
    select balance into v_balance
    from public.platform_wallet_accounts
    where personal_id = v_transaction.personal_id and currency = 'USDT';
  end if;

  return pg_catalog.jsonb_build_object(
    'transaction', pg_catalog.to_jsonb(v_transaction),
    'balance', v_balance
  );
end;
$$;

revoke all on function public.apply_wallet_transaction(text, text, numeric, numeric, text, text) from public, anon, authenticated;
revoke all on function public.review_wallet_withdrawal(uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_wallet_transaction(text, text, numeric, numeric, text, text) to service_role;
grant execute on function public.review_wallet_withdrawal(uuid, text, text) to service_role;
