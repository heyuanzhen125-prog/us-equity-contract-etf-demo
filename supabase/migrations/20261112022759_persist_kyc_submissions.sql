-- Durable, server-only queue for the platform's simulated KYC review workflow.
-- The app accepts filenames only; document files are never uploaded by this schema.
create table if not exists public.platform_kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  personal_id text not null references public.platform_members(personal_id) on delete restrict,
  email text not null,
  legal_name text not null,
  country text not null,
  birth_date date not null,
  document_type text not null,
  document_last4 text not null,
  documents jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text not null default '',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists platform_kyc_submissions_member_idx
  on public.platform_kyc_submissions (personal_id, submitted_at desc);
create index if not exists platform_kyc_submissions_status_idx
  on public.platform_kyc_submissions (status, submitted_at desc);

alter table public.platform_kyc_submissions enable row level security;
revoke all on public.platform_kyc_submissions from anon, authenticated;
grant select, insert, update, delete on public.platform_kyc_submissions to service_role;
