-- EduLink additive migration – organization profiles, publication media and jobs.
-- Run this script after the existing onboarding/membership migration.
-- It is intentionally additive: legacy rows remain valid and no user data is replaced.

begin;

-- Public organization profile data. These fields are nullable so an existing page can
-- be completed gradually by an authorized organization administrator.
alter table public.companies
  add column if not exists avatar_url text,
  add column if not exists background_url text,
  add column if not exists description text,
  add column if not exists founded_on date,
  add column if not exists specializations text[] not null default '{}';

alter table public.institutions
  add column if not exists avatar_url text,
  add column if not exists background_url text,
  add column if not exists description text,
  add column if not exists sector text,
  add column if not exists founded_on date,
  add column if not exists specializations text[] not null default '{}';

-- Job application policy details. The column names intentionally remain flexible
-- enough for future application providers and screening features.
alter table public.jobs
  add column if not exists degree_required degree_type,
  add column if not exists rejection_message text,
  add column if not exists cv_upload_url text,
  add column if not exists application_link text;

-- Images enrich a publication but must remain optional. A student or organization
-- must be able to publish a text announcement or an event without a media file.
-- Dropping these constraints is idempotent and leaves every existing record intact.
alter table public.posts drop constraint if exists posts_image_required;
alter table public.events drop constraint if exists events_image_required;

create index if not exists companies_sector_idx on public.companies (sector);
create index if not exists institutions_sector_idx on public.institutions (sector);
create index if not exists companies_founded_on_idx on public.companies (founded_on);
create index if not exists institutions_founded_on_idx on public.institutions (founded_on);
create index if not exists jobs_degree_required_idx on public.jobs (degree_required);
create index if not exists events_start_date_idx on public.events (start_date);

-- A company creator/member must be able to read its own row immediately after
-- onboarding. Without this policy the dashboard cannot resolve the company and
-- redirects back to /onboarding/company, causing a redirect loop.
drop policy if exists "company_members_read_own_company" on public.companies;
create policy "company_members_read_own_company"
on public.companies
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.company_members member
    where member.company_id = companies.id
      and member.user_id = auth.uid()
  )
);

-- Same recovery path for institution creators and members.
drop policy if exists "institution_members_read_own_institution" on public.institutions;
create policy "institution_members_read_own_institution"
on public.institutions
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.institution_members member
    where member.institution_id = institutions.id
      and member.user_id = auth.uid()
  )
);

-- Organization administrators may edit only their organization profile. Existing
-- policies are retained; these named policies are idempotently recreated.
drop policy if exists "company_admins_update_own_profile" on public.companies;
create policy "company_admins_update_own_profile"
on public.companies
for update
to authenticated
using (
  exists (
    select 1
    from public.company_members member
    where member.company_id = companies.id
      and member.user_id = auth.uid()
      and member.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.company_members member
    where member.company_id = companies.id
      and member.user_id = auth.uid()
      and member.role = 'admin'
  )
);

drop policy if exists "institution_admins_update_own_profile" on public.institutions;
create policy "institution_admins_update_own_profile"
on public.institutions
for update
to authenticated
using (
  exists (
    select 1
    from public.institution_members member
    where member.institution_id = institutions.id
      and member.user_id = auth.uid()
      and member.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.institution_members member
    where member.institution_id = institutions.id
      and member.user_id = auth.uid()
      and member.role = 'admin'
  )
);

-- Secure, user-scoped invite-code rotation. The functions locate the organization
-- only through an administrator membership and never accept a caller-supplied ID.
create or replace function public.regenerate_company_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company_id uuid;
  new_code text;
begin
  select company_id into target_company_id
  from public.company_members
  where user_id = auth.uid() and role = 'admin'
  order by created_at asc
  limit 1;

  if target_company_id is null then
    raise exception 'Only a company administrator can regenerate an invite code';
  end if;

  loop
    new_code := public.generate_16_char_code();
    begin
      update public.companies
      set invite_code = new_code, updated_at = timezone('utc', now())
      where id = target_company_id;
      exit;
    exception when unique_violation then
      -- Generate again if the unique invite-code index detects a collision.
    end;
  end loop;

  return new_code;
end;
$$;

create or replace function public.regenerate_institution_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_institution_id uuid;
  new_code text;
begin
  select institution_id into target_institution_id
  from public.institution_members
  where user_id = auth.uid() and role = 'admin'
  order by created_at asc
  limit 1;

  if target_institution_id is null then
    raise exception 'Only an institution administrator can regenerate an invite code';
  end if;

  loop
    new_code := public.generate_16_char_code();
    begin
      update public.institutions
      set invite_code = new_code, updated_at = timezone('utc', now())
      where id = target_institution_id;
      exit;
    exception when unique_violation then
      -- Generate again if the unique invite-code index detects a collision.
    end;
  end loop;

  return new_code;
end;
$$;

revoke all on function public.regenerate_company_invite_code() from public;
revoke all on function public.regenerate_institution_invite_code() from public;
grant execute on function public.regenerate_company_invite_code() to authenticated;
grant execute on function public.regenerate_institution_invite_code() to authenticated;

commit;
