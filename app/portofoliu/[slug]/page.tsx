import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Award, BriefcaseBusiness, Code2, ExternalLink, GraduationCap, Mail, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { createClient } from "@/lib/supabase/server";

interface PortfolioPageProps {
  params: Promise<{ slug: string }>;
}

type PublicProfile = {
  id: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  background_url: string | null;
  location: string | null;
  email: string | null;
  role: "student" | "company" | "institution" | "admin";
};
type PublicEducation = { id: string; institution_name: string; degree: string; field_of_study: string; start_date: string; end_date: string | null; is_current: boolean | null };
type PublicExperience = { id: string; company_name: string | null; position_title: string; location: string | null; start_date: string; end_date: string | null; is_current: boolean | null; description: string | null };
type PublicProject = { id: string; title: string; description: string | null; technologies: string[] | null; image_url: string | null; github_url: string | null; live_demo_url: string | null };
type PublicSkill = { id: string; name: string; level: string | null };
type PublicCertificate = { id: string; title: string; issuing_organization: string; issue_date: string | null; credential_url: string | null };

export default async function PortfolioPage({ params }: PortfolioPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,headline,bio,avatar_url,background_url,location,email,role")
    .eq("qr_code_slug", slug)
    .single<PublicProfile>();
  if (!profile) notFound();
  if (profile.role === "company" || profile.role === "institution") {
    const table = profile.role === "company" ? "companies" : "institutions";
    const { data: organization } = await supabase.from(table).select("id").eq("created_by", profile.id).maybeSingle();
    if (organization?.id) redirect("/organizations/" + profile.role + "/" + organization.id);
  }

  const [{ data: educationData }, { data: experienceData }, { data: projectData }, { data: skillData }, { data: certificateData }] = await Promise.all([
    supabase.from("educations").select("id,institution_name,degree,field_of_study,start_date,end_date,is_current").eq("profile_id", profile.id).order("start_date", { ascending: false }),
    supabase.from("experiences").select("id,company_name,position_title,location,start_date,end_date,is_current,description").eq("profile_id", profile.id).order("start_date", { ascending: false }),
    supabase.from("projects").select("id,title,description,technologies,image_url,github_url,live_demo_url").eq("profile_id", profile.id).order("title"),
    supabase.from("skills").select("id,name,level").eq("profile_id", profile.id).order("name"),
    supabase.from("certificates").select("id,title,issuing_organization,issue_date,credential_url").eq("profile_id", profile.id).order("issue_date", { ascending: false }),
  ]);

  const educations = (educationData ?? []) as PublicEducation[];
  const experiences = (experienceData ?? []) as PublicExperience[];
  const projects = (projectData ?? []) as PublicProject[];
  const skills = (skillData ?? []) as PublicSkill[];
  const certificates = (certificateData ?? []) as PublicCertificate[];
  const contentColumns = projects.length ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)_300px]" : "lg:grid-cols-[minmax(0,1fr)_300px]";

  return (
    <main className="min-h-screen bg-[#e9f1f5] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-[#e9f1f5]/95 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-[#003747]" aria-label="Înapoi la pagina principală EduLink">
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
              <Image src="/edulink-logo-icon.png" alt="EduLink" width={64} height={64} className="h-8 w-8 object-contain" />
            </span>
            EduLink
          </Link>
          <div className="hidden items-center gap-4 text-sm font-semibold text-slate-600 sm:flex">
            <a href="#studii" className="hover:text-[#026a81]">Studii</a>
            <a href="#experienta" className="hover:text-[#026a81]">Experiență</a>
            {projects.length ? <a href="#proiecte" className="hover:text-[#026a81]">Proiecte</a> : null}
            <a href="#aptitudini" className="hover:text-[#026a81]">Aptitudini</a>
            <a href="#certificate" className="hover:text-[#026a81]">Atestări</a>
          </div>
        </nav>
      </header>

      <div id="acasa" className={`mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 ${contentColumns}`}>
        <section className="space-y-5">
          <article className="overflow-hidden rounded-2xl border border-white bg-[linear-gradient(145deg,#d0e2ea,#adc9da)] p-6 shadow-[0_16px_35px_rgba(32,73,96,.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[.16em] text-[#026a81]">Profil profesional</p>
                <h1 className="mt-3 text-3xl font-extrabold leading-tight text-[#003747]">Salut, sunt {profile.full_name}</h1>
                <p className="mt-2 text-lg font-semibold text-slate-700">{profile.headline || "Student EduLink"}</p>
              </div>
              <ProfileAvatar src={profile.avatar_url} name={profile.full_name} className="h-24 w-24 border-4 border-white text-2xl shadow-lg" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {profile.location ? <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-3 py-1.5 text-sm font-semibold text-slate-700"><MapPin className="h-3.5 w-3.5 text-[#026a81]" />{profile.location}</span> : null}
              {profile.email ? <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1 rounded-full bg-[#026a81] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#003747]"><Mail className="h-3.5 w-3.5" />Contact</a> : null}
            </div>
          </article>

          <PortfolioSection title="Despre mine">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{profile.bio || "Acest profil este în curs de completare."}</p>
          </PortfolioSection>

          <PortfolioSection id="studii" icon={<GraduationCap className="h-5 w-5" />} title="Studii">
            {educations.length ? <div className="space-y-4">{educations.map((education) => <div key={education.id} className="border-l-2 border-[#168a9b] pl-4"><h3 className="font-bold text-slate-900">{education.institution_name}</h3><p className="mt-1 text-sm text-slate-600">{degreeLabel(education.degree)} · {education.field_of_study}</p><p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(education.start_date)} – {education.is_current ? "În curs" : formatDate(education.end_date)}</p></div>)}</div> : <EmptyCopy text="Nu a adăugat încă studii publice." />}
          </PortfolioSection>

          <PortfolioSection id="experienta" icon={<BriefcaseBusiness className="h-5 w-5" />} title="Experiență">
            {experiences.length ? <div className="space-y-5">{experiences.map((experience) => <div key={experience.id} className="border-l-2 border-[#168a9b] pl-4"><h3 className="font-bold text-slate-900">{experience.position_title}</h3><p className="text-sm font-semibold text-[#0e5e6f]">{experience.company_name || "Organizație neprecizată"}</p><p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(experience.start_date)} – {experience.is_current ? "Prezent" : formatDate(experience.end_date)}</p>{experience.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{experience.description}</p> : null}</div>)}</div> : <EmptyCopy text="Nu a adăugat încă experiență publică." />}
          </PortfolioSection>
        </section>

        {projects.length ? <PortfolioSection id="proiecte" icon={<Code2 className="h-5 w-5" />} title="Proiecte" className="h-fit shadow-[0_16px_35px_rgba(32,73,96,.08)]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{projects.map((project) => <article key={project.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="grid h-36 place-items-center bg-[linear-gradient(135deg,#d7eced,#a5c8d5)] text-[#0e5e6f]">{isImageUrl(project.image_url) ? <img src={project.image_url ?? undefined} alt={`Imagine proiect ${project.title}`} className="h-full w-full object-cover" /> : <Code2 className="h-10 w-10" />}</div><div className="p-4"><h3 className="font-extrabold text-slate-900">{project.title}</h3>{project.description ? <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-700">{project.description}</p> : null}{project.technologies?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{project.technologies.slice(0, 5).map((technology) => <span key={technology} className="rounded-full bg-[#e5f4f6] px-2 py-1 text-xs font-bold text-[#003747]">{technology}</span>)}</div> : null}<div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-[#026a81]">{safeUrl(project.live_demo_url) ? <a href={project.live_demo_url ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Vezi proiectul <ExternalLink className="h-3.5 w-3.5" /></a> : null}{safeUrl(project.github_url) ? <a href={project.github_url ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Cod sursă <ExternalLink className="h-3.5 w-3.5" /></a> : null}</div></div></article>)}</div>
        </PortfolioSection> : null}

        <aside className="space-y-5">
          <PortfolioSection id="certificate" icon={<Award className="h-5 w-5" />} title="Licențe și atestări">
            {certificates.length ? <div className="space-y-3">{certificates.map((certificate) => <article key={certificate.id} className="flex gap-3 rounded-xl border border-slate-200 p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#fff6df] text-[#9b6a00]"><Award className="h-5 w-5" /></span><div className="min-w-0"><h3 className="font-bold text-slate-900">{certificate.title}</h3><p className="text-sm text-slate-600">{certificate.issuing_organization}</p><p className="text-xs text-slate-500">{formatDate(certificate.issue_date)}</p>{safeUrl(certificate.credential_url) ? <a href={certificate.credential_url ?? undefined} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#026a81] hover:underline">Deschide documentul <ExternalLink className="h-3 w-3" /></a> : null}</div></article>)}</div> : <EmptyCopy text="Nu a adăugat încă atestări publice." />}
          </PortfolioSection>
          <PortfolioSection id="aptitudini" icon={<CheckCircleIcon />} title="Aptitudini">
            {skills.length ? <div className="flex flex-wrap gap-2">{skills.map((skill) => <span key={skill.id} className="rounded-full border border-[#168a9b]/30 bg-[#e5f4f6] px-3 py-1.5 text-sm font-bold text-[#003747]">{skill.name}{skill.level ? <span className="ml-1 font-medium text-slate-500">· {skillLevelLabel(skill.level)}</span> : null}</span>)}</div> : <EmptyCopy text="Nu a adăugat încă aptitudini publice." />}
          </PortfolioSection>
          <section className="rounded-2xl bg-[linear-gradient(145deg,#003747,#0e5e6f)] p-6 text-white shadow-lg"><p className="text-sm font-bold uppercase tracking-[.14em] text-cyan-200">Contact</p><h2 className="mt-2 text-2xl font-extrabold">Hai să discutăm.</h2><p className="mt-3 text-sm leading-6 text-slate-100">Pentru oportunități academice, proiecte sau internship-uri, poți lua legătura direct cu {profile.full_name}.</p>{profile.email ? <a href={`mailto:${profile.email}`} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#003747] hover:bg-cyan-50"><Mail className="h-4 w-4" />Trimite un e-mail</a> : null}</section>
        </aside>
      </div>
      <footer className="border-t border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Portofoliu digital generat în siguranță cu EduLink.</footer>
    </main>
  );
}

function PortfolioSection({ id, icon, title, children, className = "" }: { id?: string; icon?: ReactNode; title?: string; children: ReactNode; className?: string }) {
  return <section id={id} className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{title ? <h2 className="flex items-center gap-2 text-xl font-extrabold text-[#003747]"><span className="text-[#026a81]">{icon}</span>{title}</h2> : null}<div className={title ? "mt-4" : ""}>{children}</div></section>;
}

function CheckCircleIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>; }
function EmptyCopy({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{text}</p>; }
function formatDate(value: string | null) { if (!value) return "—"; const [year, month, day] = value.split("-"); return year && month && day ? `${day}.${month}.${year}` : value; }
function degreeLabel(value: string) { return { bacalaureat: "Bacalaureat", licenta: "Licență", master: "Master", doctorat: "Doctorat", bacalaureat_licenta: "Bacalaureat + Licență" }[value] ?? value; }
function skillLevelLabel(value: string) { return { incepator: "Începător", intermediar: "Intermediar", avansat: "Avansat" }[value] ?? value; }
function safeUrl(value: string | null) { return Boolean(value && /^https?:\/\//i.test(value)); }
function isImageUrl(value: string | null) { return Boolean(value && /\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(value)); }

export async function generateMetadata({ params }: PortfolioPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name,headline").eq("qr_code_slug", slug).single();
  return { title: profile ? `${profile.full_name} | EduLink Portofoliu` : "Portofoliu EduLink", description: profile?.headline ?? "Portofoliu digital EduLink" };
}
