import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/feed/follow-button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { createClient } from "@/lib/supabase/server";
import { formatTimeAgo } from "@/lib/utils";

type Params = { kind: "company" | "institution"; id: string };

type PageOrganization = {
  id: string;
  name: string;
  website: string | null;
  location: string | null;
  sector: string | null;
  createdBy: string | null;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  description: string | null;
};

export default async function OrganizationPublicPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { kind, id } = await params;
  if (kind !== "company" && kind !== "institution") notFound();

  const supabase = await createClient();
  let organization: PageOrganization;

  if (kind === "company") {
    const { data } = await supabase
      .from("companies")
      .select("id, name, website, location, sector, created_by, avatar_url, background_url, description")
      .eq("id", id)
      .maybeSingle();
    if (!data) notFound();

    organization = {
      id: data.id,
      name: data.name,
      website: data.website,
      location: data.location,
      sector: data.sector,
      createdBy: data.created_by,
      avatarUrl: data.avatar_url,
      backgroundUrl: data.background_url,
      description: data.description,
    };
  } else {
    const { data } = await supabase
      .from("institutions")
      .select("id, name, website, city, type, created_by, avatar_url, background_url, description")
      .eq("id", id)
      .maybeSingle();
    if (!data) notFound();

    organization = {
      id: data.id,
      name: data.name,
      website: data.website,
      location: data.city,
      sector: data.type,
      createdBy: data.created_by,
      avatarUrl: data.avatar_url,
      backgroundUrl: data.background_url,
      description: data.description,
    };
  }

  // Content belongs to the profile that administers this page. Do not expose
  // platform-wide posts/events on an unrelated organization page.
  const ownerId = organization.createdBy ?? "00000000-0000-0000-0000-000000000000";
  const { data: { user: viewer } } = await supabase.auth.getUser();
  const { data: ownFollow } = viewer ? await supabase.from("follows").select("id").eq("follower_id", viewer.id).eq("target_type", kind).eq("target_id", id).maybeSingle() : { data: null };
  const [{ count: followerCount }, { data: posts }, { data: events }] = await Promise.all([
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("target_type", kind)
      .eq("target_id", id),
    supabase
      .from("posts")
      .select("id, content, image_url, created_at")
      .eq("creator_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("events")
      .select("id, title, description, image_url, start_date, location, created_at")
      .eq("creator_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const typeLabel = organization.sector || (kind === "company" ? "Companie" : "Instituție de învățământ");

  return (
    <main className="min-h-screen bg-[#f3f6f7] pb-10">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <Link href="/feed" className="inline-flex items-center gap-2 text-sm font-bold text-[#0e5e6f]">
            <ArrowLeft className="h-4 w-4" /> Înapoi în feed
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <section className="min-w-0">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div
              className="h-28 bg-[linear-gradient(115deg,#003747,#0e5e6f_52%,#168a9b)] sm:h-40"
              style={organization.backgroundUrl ? {
                backgroundImage: `linear-gradient(rgba(0,55,71,.32),rgba(0,55,71,.32)), url(${organization.backgroundUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              } : undefined}
            />
            <div className="px-5 pb-6">
              <ProfileAvatar src={organization.avatarUrl} name={organization.name} className="-mt-12 h-24 w-24 border-4 border-white bg-white shadow-md" imageClassName="bg-white" />
              <h1 className="mt-3 text-2xl font-extrabold text-slate-950">{organization.name}</h1>
              <p className="mt-1 text-sm text-slate-600">{typeLabel}{organization.location ? ` · ${organization.location}` : ""}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1"><UsersRound className="h-4 w-4 text-[#168a9b]" />{followerCount ?? 0} urmăritori</span>
                {organization.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-[#168a9b]" />{organization.location}</span> : null}
              </div>
              {organization.website ? <a href={organization.website} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#026a81] px-4 py-2 text-sm font-bold text-white hover:bg-[#003747]"><ExternalLink className="h-4 w-4" /> Vizitează site-ul</a> : null}<div className="mt-4"><FollowButton targetType={kind} targetId={id} initialIsFollowing={Boolean(ownFollow)} initialFollowerCount={followerCount ?? 0} /></div>
            </div>
          </article>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-950">Privire de ansamblu</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{organization.description || "Această organizație nu a publicat încă o descriere."}</p>
          </section>

          <section className="mt-5 space-y-4">
            <h2 className="text-lg font-extrabold text-slate-950">Anunțuri și evenimente</h2>
            {(posts ?? []).map((post) => <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><ProfileAvatar src={organization.avatarUrl} name={organization.name} className="h-10 w-10 rounded-lg" /><div><p className="font-bold text-slate-950">{organization.name}</p><p className="text-xs text-slate-500">{formatTimeAgo(post.created_at)}</p></div></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.content}</p>{post.image_url ? <img src={post.image_url} alt="Imaginea anunțului" className="mt-4 max-h-[440px] w-full rounded-xl object-cover" /> : null}</article>)}
            {(events ?? []).map((event) => <article key={event.id} className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm"><h3 className="font-extrabold text-slate-950">{event.title || "Eveniment EduLink"}</h3><p className="mt-1 text-sm text-slate-600">{event.start_date ?? "Data urmează a fi anunțată"}{event.location ? ` · ${event.location}` : ""}</p>{event.description ? <p className="mt-3 text-sm leading-6 text-slate-700">{event.description}</p> : null}{event.image_url ? <img src={event.image_url} alt={`Imagine pentru ${event.title || "eveniment"}`} className="mt-4 max-h-[440px] w-full rounded-xl object-cover" /> : null}</article>)}
            {!(posts?.length || events?.length) ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">Nu există încă anunțuri publice.</p> : null}
          </section>
        </section>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-slate-950">EduLink</h2><p className="mt-2 text-sm leading-6 text-slate-600">Urmărește organizațiile relevante pentru oportunități și noutăți în feed.</p><Link href="/feed" className="mt-4 inline-flex text-sm font-bold text-[#0e5e6f] hover:underline">Vezi feed-ul →</Link></aside>
      </div>
    </main>
  );
}
