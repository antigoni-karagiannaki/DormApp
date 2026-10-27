create table if not exists public.washing_machine_queue (
  house_id uuid not null references public.houses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (house_id, profile_id)
);

create index if not exists washing_machine_queue_order_idx
  on public.washing_machine_queue (house_id, created_at);

alter table public.washing_machine_queue enable row level security;

grant select, insert, delete on public.washing_machine_queue to authenticated;

drop policy if exists washing_machine_queue_select_for_house_members
  on public.washing_machine_queue;
create policy washing_machine_queue_select_for_house_members
  on public.washing_machine_queue
  for select
  to authenticated
  using (public.is_house_member(house_id));

drop policy if exists washing_machine_queue_insert_for_house_members
  on public.washing_machine_queue;
create policy washing_machine_queue_insert_for_house_members
  on public.washing_machine_queue
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.is_house_member(house_id)
  );

drop policy if exists washing_machine_queue_delete_for_house_members
  on public.washing_machine_queue;
create policy washing_machine_queue_delete_for_house_members
  on public.washing_machine_queue
  for delete
  to authenticated
  using (
    profile_id = (select auth.uid())
    and public.is_house_member(house_id)
  );
