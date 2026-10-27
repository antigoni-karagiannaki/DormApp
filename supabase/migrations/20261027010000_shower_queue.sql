create table if not exists public.house_shower_queue (
  house_id uuid not null references public.houses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (house_id, profile_id)
);

create index if not exists house_shower_queue_order_idx
  on public.house_shower_queue (house_id, created_at);

alter table public.house_shower_queue enable row level security;

grant select, insert, delete on public.house_shower_queue to authenticated;

drop policy if exists house_shower_queue_select_for_house_members
  on public.house_shower_queue;
create policy house_shower_queue_select_for_house_members
  on public.house_shower_queue
  for select
  to authenticated
  using (public.is_house_member(house_id));

drop policy if exists house_shower_queue_insert_for_house_members
  on public.house_shower_queue;
create policy house_shower_queue_insert_for_house_members
  on public.house_shower_queue
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.is_house_member(house_id)
  );

drop policy if exists house_shower_queue_delete_for_house_members
  on public.house_shower_queue;
create policy house_shower_queue_delete_for_house_members
  on public.house_shower_queue
  for delete
  to authenticated
  using (
    profile_id = (select auth.uid())
    and public.is_house_member(house_id)
  );
