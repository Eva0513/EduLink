import { redirect } from "next/navigation";
import { OrganizationDashboardClient } from "@/components/dashboard/organization-dashboard-client";
import { createClient } from "@/lib/supabase/server";

export default async function CompanyDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, onboarding_completed").eq("id", user.id).maybeSingle();
  if (profile?.role !== "company" || !profile.onboarding_completed) redirect("/onboarding");

  const { data: membership } = await supabase.from("company_members").select("company_id").eq("user_id", user.id).maybeSingle();
  const companyQuery = membership?.company_id
    ? supabase.from("companies").select("id, name, website, location, sector, invite_code, avatar_url, background_url, description, founded_on, specializations").eq("id", membership.company_id).maybeSingle()
    : supabase.from("companies").select("id, name, website, location, sector, invite_code, avatar_url, background_url, description, founded_on, specializations").eq("created_by", user.id).maybeSingle();
  const { data: company } = await companyQuery;
  // Do not redirect a completed company back into onboarding. A temporary RLS
  // or migration mismatch would otherwise create an infinite redirect loop.
  if (!company) {
    return <main className="min-h-screen bg-[#f3f6f7] px-5 py-16"><section className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-7 shadow-sm"><p className="text-sm font-bold text-amber-700">Configurarea companiei este în curs</p><h1 className="mt-2 text-2xl font-extrabold text-slate-950">Contul tău a fost creat.</h1><p className="mt-3 text-sm leading-6 text-slate-600">Dashboardul nu poate încă citi organizația. Reîncarcă pagina după aplicarea migrației de acces.</p><a href="/dashboard/company" className="mt-5 inline-flex rounded-lg bg-[#026a81] px-4 py-2.5 text-sm font-bold text-white">Reîncarcă dashboardul</a></section></main>;
  }

  const [{ count: followerCount }, { data: posts }, { data: events }] = await Promise.all([
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("target_type", "company").eq("target_id", company.id),
    supabase.from("posts").select("id, content, image_url, created_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("events").select("id, title, description, location, start_date, start_time, event_type, image_url, created_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(12),
  ]);

  return <OrganizationDashboardClient kind="company" organization={{ id: company.id, name: company.name, website: company.website, location: company.location, sector: company.sector, inviteCode: company.invite_code, avatarUrl: company.avatar_url, backgroundUrl: company.background_url, description: company.description, foundedOn: company.founded_on, specializations: company.specializations ?? [] }} followerCount={followerCount ?? 0} posts={posts ?? []} events={events ?? []} />;
}
