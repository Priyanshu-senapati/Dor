-- Dor schema. Dates a person picks (start/end/prescribed) are plain YYYY-MM-DD text; instants are timestamptz.
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  elder_name text not null,
  passcode_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('elder', 'caretaker', 'family')),
  chain_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, email)
);

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  brand text not null,
  salts text[] not null default '{}',
  dose text not null default '',
  times text[] not null,
  start_date text not null,
  end_date text,
  instructions text not null default '',
  pills_left int,
  pills_per_dose int not null default 1,
  prescribed_by text not null default '',
  prescribed_on text,
  status text not null default 'active' check (status in ('active', 'pending', 'declined', 'stopped')),
  created_by uuid references members(id) on delete set null,
  replaces_id uuid references medications(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists dose_logs (
  med_id uuid not null references medications(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  at timestamptz not null,
  status text not null check (status in ('taken', 'skipped', 'missed')),
  reason text not null default '',
  marked_by uuid references members(id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (med_id, at)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  doctor text not null,
  specialty text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  purpose text not null default '',
  questions text not null default '',
  escort_id uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('dose', 'refill', 'escort')),
  ref_key text not null,
  title text not null,
  body text not null default '',
  status text not null default 'open' check (status in ('open', 'acked', 'resolved')),
  level int not null default 0,
  owner_id uuid references members(id) on delete set null,
  last_notified_at timestamptz not null default now(),
  acked_by uuid references members(id) on delete set null,
  acked_at timestamptz,
  resolution text not null default '',
  created_at timestamptz not null default now(),
  unique (profile_id, ref_key)
);

-- Daily email counter per recipient and overall ('*'), so the app can't be turned into a spam cannon.
create table if not exists mail_quota (
  day text not null,
  rcpt text not null,
  n int not null,
  primary key (day, rcpt)
);

create table if not exists sent_keys (
  key text primary key,
  sent_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  kind text not null,
  label text not null,
  at timestamptz not null default now()
);

-- Every step of an alert's life (raised, passed on, claimed, outcome, resolved) is an event pointing at it.
alter table events add column if not exists alert_id uuid references alerts(id) on delete cascade;

-- Handoff: a member away for some dates, and who covers for them.
create table if not exists away (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  cover_id uuid references members(id) on delete set null,
  starts_on text not null,
  ends_on text not null,
  created_at timestamptz not null default now()
);

-- The briefing the cover received at handoff, and whether Gemini wrote it.
alter table away add column if not exists briefing text not null default '';
alter table away add column if not exists briefing_ai boolean not null default false;

-- Indexes for the queries every page and every 5-minute check run (all are scoped by profile).
create index if not exists members_profile_idx on members (profile_id);
create index if not exists medications_profile_status_idx on medications (profile_id, status);
create index if not exists dose_logs_profile_at_idx on dose_logs (profile_id, at);
create index if not exists appointments_profile_starts_idx on appointments (profile_id, starts_at);
create index if not exists alerts_profile_status_idx on alerts (profile_id, status);
create index if not exists events_profile_at_idx on events (profile_id, at desc);
create index if not exists events_alert_idx on events (alert_id) where alert_id is not null;
create index if not exists away_profile_ends_idx on away (profile_id, ends_on);
create index if not exists sent_keys_sent_at_idx on sent_keys (sent_at);

create table if not exists symptoms (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  name text not null,
  note text not null default '',
  at timestamptz not null default now()
);

create index if not exists symptoms_profile_at_idx on symptoms (profile_id, at desc);
