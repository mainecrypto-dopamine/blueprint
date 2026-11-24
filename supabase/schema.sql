-- Blueprint HQ database. Paste this whole file into Supabase → SQL Editor → Run (once).

-- Who can sign in. Only these emails get in. Owners (Jack, Isaac) can add and remove people in the app (☰ → Team).
create table if not exists public.members (
  email text primary key,
  role  text not null default 'team' check (role in ('owner','team')),
  name  text
);

-- Everything the app stores (rooms, batches, stock, boards, feed posts…) as small JSON documents.
create table if not exists public.docs (
  path       text primary key,          -- e.g. rooms/room1, meta/settings
  coll       text not null,             -- e.g. rooms, meta
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists docs_coll_idx on public.docs (coll);

alter table public.members enable row level security;
alter table public.docs    enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(auth.jwt() ->> 'email') and role = 'owner');
$$;

drop policy if exists "members: see the team" on public.members;
drop policy if exists "members: owner adds"    on public.members;
drop policy if exists "members: owner edits"   on public.members;
drop policy if exists "members: owner removes" on public.members;
create policy "members: see the team"  on public.members for select using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_member());
create policy "members: owner adds"    on public.members for insert with check (public.is_owner());
create policy "members: owner edits"   on public.members for update using (public.is_owner()) with check (public.is_owner());
create policy "members: owner removes" on public.members for delete using (public.is_owner());

drop policy if exists "docs: read"   on public.docs;
drop policy if exists "docs: insert" on public.docs;
drop policy if exists "docs: update" on public.docs;
drop policy if exists "docs: delete" on public.docs;
create policy "docs: read"   on public.docs for select using (public.is_member());
create policy "docs: insert" on public.docs for insert with check (public.is_member());
create policy "docs: update" on public.docs for update using (public.is_member()) with check (public.is_member());
create policy "docs: delete" on public.docs for delete using (public.is_member());

-- Live updates to every phone and computer.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Photos and documents. File names are long random ids that only team members ever see.
insert into storage.buckets (id, name, public, file_size_limit)
values ('assets', 'assets', true, 52428800)
on conflict (id) do update set public = true;

drop policy if exists "assets: members upload" on storage.objects;
drop policy if exists "assets: members replace" on storage.objects;
create policy "assets: members upload"  on storage.objects for insert to authenticated with check (bucket_id = 'assets' and public.is_member());
create policy "assets: members replace" on storage.objects for update to authenticated using (bucket_id = 'assets' and public.is_member()) with check (bucket_id = 'assets' and public.is_member());

-- The team is added from the private starting file (not in this repo).
