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

-- A student may apply to an event with one CV. The organizer can read the
-- application, while the student can create or update only their own record.
create table if not exists public.event_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  cv_url text not null,
  message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, profile_id)
);
alter table public.event_applications enable row level security;
drop policy if exists "students_manage_own_event_applications" on public.event_applications;
create policy "students_manage_own_event_applications" on public.event_applications for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "event_creators_read_applications" on public.event_applications;
create policy "event_creators_read_applications" on public.event_applications for select to authenticated using (exists (select 1 from public.events event where event.id = event_applications.event_id and event.creator_id = auth.uid()));

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
 
-- Reactions are kept separate from posts so the feed can preload counts without
-- mutating publication rows and each authenticated member can toggle one reaction.
create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'like' check (reaction_type in ('like', 'celebrate', 'support', 'love')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (post_id, profile_id)
);
alter table public.post_reactions enable row level security;
drop policy if exists "post reactions are public" on public.post_reactions;
create policy "post reactions are public" on public.post_reactions for select using (true);
drop policy if exists "members manage own post reactions" on public.post_reactions;
create policy "members manage own post reactions" on public.post_reactions
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Job applications belong to the student and the company profile that owns the job.
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  cv_url text not null,
  message text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'accepted', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (job_id, student_id)
);
alter table public.job_applications enable row level security;
drop policy if exists "students manage own job applications" on public.job_applications;
create policy "students manage own job applications" on public.job_applications
  for all to authenticated
  using (
    student_id = auth.uid()
    and exists (select 1 from public.profiles profile where profile.id = auth.uid() and profile.role = 'student' and profile.onboarding_completed)
  )
  with check (
    student_id = auth.uid()
    and exists (select 1 from public.profiles profile where profile.id = auth.uid() and profile.role = 'student' and profile.onboarding_completed)
  );
drop policy if exists "companies read applications for their jobs" on public.job_applications;
create policy "companies read applications for their jobs" on public.job_applications
  for select to authenticated
  using (exists (select 1 from public.jobs job where job.id = job_applications.job_id and job.company_id = auth.uid()));

-- Keep the counter used on public student profiles in sync with user follows.
create or replace function public.sync_profile_followers_count()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.target_type = 'user' then
      update public.profiles
      set followers_count = (select count(*) from public.follows where target_type = 'user' and target_id = new.target_id)
      where id = new.target_id;
    end if;
    return new;
  end if;
  if old.target_type = 'user' then
    update public.profiles
    set followers_count = (select count(*) from public.follows where target_type = 'user' and target_id = old.target_id)
    where id = old.target_id;
  end if;
  return old;
end;
$$;
drop trigger if exists follows_sync_profile_followers_count on public.follows;
create trigger follows_sync_profile_followers_count
  after insert or delete on public.follows
  for each row execute function public.sync_profile_followers_count();

-- Only onboarding-complete students can apply to events.
drop policy if exists "students_manage_own_event_applications" on public.event_applications;
create policy "students_manage_own_event_applications" on public.event_applications
  for all to authenticated
  using (
    profile_id = auth.uid()
    and exists (select 1 from public.profiles profile where profile.id = auth.uid() and profile.role = 'student' and profile.onboarding_completed)
  )
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.profiles profile where profile.id = auth.uid() and profile.role = 'student' and profile.onboarding_completed)
  );

-- The jobs table intentionally stores the owning company account profile id.
drop policy if exists "only company admins can create jobs" on public.jobs;
create policy "only company admins can create jobs" on public.jobs
  for insert to authenticated
  with check (
    company_id = auth.uid()
    and exists (select 1 from public.profiles profile where profile.id = auth.uid() and profile.role = 'company' and profile.onboarding_completed)
  );

create index if not exists post_reactions_post_idx on public.post_reactions (post_id);
create index if not exists job_applications_job_idx on public.job_applications (job_id, created_at desc);
create index if not exists job_applications_student_idx on public.job_applications (student_id, created_at desc);
