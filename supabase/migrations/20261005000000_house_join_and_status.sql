alter table public.houses
  add column if not exists washing_machine_available boolean not null default true,
  add column if not exists shower_available boolean not null default true;

create or replace function public.is_house_member(target_house_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.house_members as member
    where member.house_id = target_house_id
      and member.profile_id = (select auth.uid())
  );
$$;

revoke all on function public.is_house_member(uuid) from public;
grant execute on function public.is_house_member(uuid) to authenticated;

create or replace function public.join_house_by_code(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  matched_house_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be logged in to join a house.';
  end if;

  if nullif(trim(p_join_code), '') is null then
    raise exception 'Enter a house join ID.';
  end if;

  select house.id
  into matched_house_id
  from public.houses as house
  where lower(trim(house.join_code)) = lower(trim(p_join_code))
  limit 1;

  if matched_house_id is null then
    raise exception 'No house was found for that join ID.';
  end if;

  if exists (
    select 1
    from public.houses as house
    where lower(trim(house.join_code)) = lower(trim(p_join_code))
      and house.id <> matched_house_id
  ) then
    raise exception 'That join ID matches more than one house. Ask a house administrator to fix it.';
  end if;

  insert into public.profiles (id, name)
  values (
    current_user_id,
    coalesce(
      nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
      nullif(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), ''),
      'Resident'
    )
  )
  on conflict (id) do nothing;

  if exists (
    select 1
    from public.house_members as member
    where member.profile_id = current_user_id
      and member.house_id <> matched_house_id
  ) then
    raise exception 'Your account is already linked to another house.';
  end if;

  if not exists (
    select 1
    from public.house_members as member
    where member.profile_id = current_user_id
      and member.house_id = matched_house_id
  ) then
    insert into public.house_members (house_id, profile_id, floor, room)
    values (matched_house_id, current_user_id, '', '');
  end if;

  return matched_house_id;
end;
$$;

revoke all on function public.join_house_by_code(text) from public;
grant execute on function public.join_house_by_code(text) to authenticated;

drop policy if exists houses_select_for_house_members on public.houses;
create policy houses_select_for_house_members
  on public.houses
  for select
  to authenticated
  using (public.is_house_member(id));

drop policy if exists house_members_select_for_house_members on public.house_members;
create policy house_members_select_for_house_members
  on public.house_members
  for select
  to authenticated
  using (public.is_house_member(house_id));

drop policy if exists profiles_select_for_house_members on public.profiles;
create policy profiles_select_for_house_members
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.house_members as member
      where member.profile_id = profiles.id
        and public.is_house_member(member.house_id)
    )
  );