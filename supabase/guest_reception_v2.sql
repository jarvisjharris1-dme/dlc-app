-- Divine Life Connect — Guest Reception V2 migration
-- Run this AFTER the original guest_reception_schema.sql and the anon RLS policies already added.

create table if not exists public.guest_reception_outreach_people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.guest_reception_outreach_people enable row level security;

-- Safe to re-run: drop policies first if they already exist.
drop policy if exists "Guest Reception anon select outreach people" on public.guest_reception_outreach_people;
drop policy if exists "Guest Reception anon insert outreach people" on public.guest_reception_outreach_people;
drop policy if exists "Guest Reception anon delete outreach people" on public.guest_reception_outreach_people;

create policy "Guest Reception anon select outreach people"
on public.guest_reception_outreach_people
for select to anon
using (true);

create policy "Guest Reception anon insert outreach people"
on public.guest_reception_outreach_people
for insert to anon
with check (true);

create policy "Guest Reception anon delete outreach people"
on public.guest_reception_outreach_people
for delete to anon
using (true);

-- V2 adds controlled delete buttons for guests and inventory items.
drop policy if exists "Guest Reception anon delete guests" on public.guest_reception_guests;
create policy "Guest Reception anon delete guests"
on public.guest_reception_guests
for delete to anon
using (true);

drop policy if exists "Guest Reception anon delete inventory" on public.guest_reception_inventory;
create policy "Guest Reception anon delete inventory"
on public.guest_reception_inventory
for delete to anon
using (true);

-- Existing FK ON DELETE CASCADE removes associated guest visits/outreach and
-- inventory transaction history when the parent record is deleted.
