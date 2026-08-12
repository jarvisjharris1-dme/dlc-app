-- Guest Reception + Connect Inventory
-- Divine Life Church internal operations app

create extension if not exists pgcrypto;

create table if not exists public.guest_reception (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  visit_date date not null default current_date,
  service text,
  first_time_guest boolean not null default true,
  invited_by text,
  prayer_request text,
  notes text,
  decision text not null default 'guest' check (decision in ('guest','salvation','rededication','join_church','other')),
  decision_date date,
  connect_ready boolean not null default false,
  transferred_to_connect boolean not null default false,
  transferred_member_id bigint,
  source text not null default 'manual' check (source in ('manual','card','csv')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_reception_visit_date_idx on public.guest_reception (visit_date desc);
create index if not exists guest_reception_name_idx on public.guest_reception (last_name, first_name);
create index if not exists guest_reception_connect_ready_idx on public.guest_reception (connect_ready, transferred_to_connect);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  sku text,
  description text,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  unit text not null default 'each',
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, sku)
);

create index if not exists inventory_items_category_idx on public.inventory_items (category);
create index if not exists inventory_items_active_idx on public.inventory_items (active);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('add','issue','adjustment','return')),
  quantity integer not null check (quantity > 0),
  member_id bigint,
  guest_id uuid references public.guest_reception(id) on delete set null,
  issued_to text,
  notes text,
  transaction_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists inventory_transactions_item_idx on public.inventory_transactions (item_id, transaction_date desc);
create index if not exists inventory_transactions_member_idx on public.inventory_transactions (member_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_guest_reception_updated_at on public.guest_reception;
create trigger trg_guest_reception_updated_at
before update on public.guest_reception
for each row execute function public.touch_updated_at();

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.touch_updated_at();

-- This app intentionally has no additional staff login layer. Match the current
-- anon-key deployment model used by the existing Connect app.
alter table public.guest_reception enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

create policy "guest reception internal app access"
on public.guest_reception for all to anon
using (true) with check (true);

create policy "inventory items internal app access"
on public.inventory_items for all to anon
using (true) with check (true);

create policy "inventory transactions internal app access"
on public.inventory_transactions for all to anon
using (true) with check (true);
