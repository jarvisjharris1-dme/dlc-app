create extension if not exists pgcrypto;

create table if not exists public.connect_team_inventory (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text,
  quantity integer not null default 0 check (quantity >= 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connect_team_inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.connect_team_inventory(id) on delete cascade,
  transaction_type text not null,
  quantity integer not null default 0,
  previous_quantity integer,
  new_quantity integer,
  notes text,
  transaction_date timestamptz not null default now()
);

alter table public.connect_team_inventory enable row level security;
alter table public.connect_team_inventory_transactions enable row level security;

drop policy if exists "Connect Team anon select inventory" on public.connect_team_inventory;
drop policy if exists "Connect Team anon insert inventory" on public.connect_team_inventory;
drop policy if exists "Connect Team anon update inventory" on public.connect_team_inventory;
drop policy if exists "Connect Team anon delete inventory" on public.connect_team_inventory;
drop policy if exists "Connect Team anon select inventory transactions" on public.connect_team_inventory_transactions;
drop policy if exists "Connect Team anon insert inventory transactions" on public.connect_team_inventory_transactions;

create policy "Connect Team anon select inventory" on public.connect_team_inventory for select to anon using (true);
create policy "Connect Team anon insert inventory" on public.connect_team_inventory for insert to anon with check (true);
create policy "Connect Team anon update inventory" on public.connect_team_inventory for update to anon using (true) with check (true);
create policy "Connect Team anon delete inventory" on public.connect_team_inventory for delete to anon using (true);
create policy "Connect Team anon select inventory transactions" on public.connect_team_inventory_transactions for select to anon using (true);
create policy "Connect Team anon insert inventory transactions" on public.connect_team_inventory_transactions for insert to anon with check (true);

insert into public.connect_team_inventory (item_name, category, quantity, minimum_quantity)
select * from (values
  ('New Member Folders','New Member Materials',25,10),
  ('Class Handouts','Class Materials',40,20),
  ('Completion Certificates','Completion Materials',25,10)
) as seed(item_name, category, quantity, minimum_quantity)
where not exists (select 1 from public.connect_team_inventory);
