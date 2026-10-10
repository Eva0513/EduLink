"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isTwentyFourHourTime, romanianDateToIso } from "@/lib/romanian-date";
import { createClient } from "@/lib/supabase/server";

export type OrganizationKind = "company" | "institution";

type ActionResult = { success: true } | { error: string };
type InviteCodeResult = { success: true; code: string } | { error: string };
type UploadResult = { success: true; url: string } | { error: string };

const eventTypes = ["academic_lecture", "workshop_training", "hackathon_contest", "student_project", "career_fair", "networking_meetup", "volunteer_charity", "webinar_online", "sports_recreation", "other"] as const;
const degreeTypes = ["bacalaureat", "licenta", "master", "doctorat"] as const;
const imageUrlSchema = z.string().url("Adresa imaginii nu este validă.").nullable().optional();

const postSchema = z.object({ content: z.string().trim().min(1, "Scrie un mesaj pentru anunț.").max(3_000), imageUrl: imageUrlSchema });
const optionalPostSchema = z.object({
  content: z.string().trim().min(1).max(3_000),
  imageUrl: z.string().url().nullable().optional(),
});

const eventSchema = z.object({
  title: z.string().trim().min(3, "Titlul evenimentului este prea scurt.").max(180),
  description: z.string().trim().max(5_000),
  location: z.string().trim().max(240),
  startDate: z.string().refine((value) => romanianDateToIso(value) !== null, "Folosește data în formatul dd/mm/yyyy."),
  startTime: z.string().refine((value) => value === "" || isTwentyFourHourTime(value), "Folosește ora în formatul 24h HH:MM."),
  mode: z.enum(["fizic", "virtual"]),
  frequency: z.enum(["niciodata", "zilnic", "saptamanal"]),
  eventType: z.enum(eventTypes),
  imageUrl: z.string().url().nullable().optional(),
});
const jobSchema = z.object({
  title: z.string().trim().min(3, "Alege un titlu de job.").max(180),
  description: z.string().trim().min(30, "Descrierea jobului trebuie să conțină cel puțin 30 de caractere.").max(10_000),
  requirements: z.string().trim().max(5_000),
  location: z.string().trim().max(240),
  workMode: z.enum(["onsite", "hybrid", "remote"]),
  jobType: z.enum(["fulltime", "parttime", "contract", "volunteer", "temporary", "internship", "other"]),
  degreeRequired: z.enum(degreeTypes).optional().or(z.literal("")),
  rejectionMessage: z.string().trim().max(3_000),
  cvUploadUrl: z.string().url().optional().or(z.literal("")),
  applicationLink: z.string().url().optional().or(z.literal("")),
  deadline: z.string().refine((value) => value === "" || romanianDateToIso(value) !== null, "Folosește data în formatul dd/mm/yyyy."),
});
const organizationProfileSchema = z.object({
  description: z.string().trim().max(5_000),
  website: z.string().trim().max(500),
  location: z.string().trim().max(240),
  sector: z.string().trim().max(180),
  foundedOn: z.string().refine((value) => value === "" || romanianDateToIso(value) !== null, "Folosește data în formatul dd/mm/yyyy."),
  specializations: z.array(z.string().trim().min(1).max(120)).max(30),
  avatarUrl: z.string().url().nullable(),
  backgroundUrl: z.string().url().nullable(),
});

function safeError() {
  return "Acțiunea nu a putut fi finalizată acum. Încearcă din nou.";
}

async function currentOrganization(kind: OrganizationKind) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, organizationId: null };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== kind) return { supabase, user: null, organizationId: null };

  if (kind === "company") {
    const { data: member } = await supabase.from("company_members").select("company_id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (member?.company_id) return { supabase, user, organizationId: member.company_id };
    const { data: organization } = await supabase.from("companies").select("id").eq("created_by", user.id).maybeSingle();
    return { supabase, user, organizationId: organization?.id ?? null };
  }

  const { data: member } = await supabase.from("institution_members").select("institution_id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (member?.institution_id) return { supabase, user, organizationId: member.institution_id };
  const { data: organization } = await supabase.from("institutions").select("id").eq("created_by", user.id).maybeSingle();
  return { supabase, user, organizationId: organization?.id ?? null };
}

async function currentAuthorizedOrganization() {
  const company = await currentOrganization("company");
  return company.user ? company : currentOrganization("institution");
}

function refreshOrganization(kind: OrganizationKind) {
  revalidatePath(kind === "company" ? "/dashboard/company" : "/dashboard/institution");
  revalidatePath("/feed");
}

export async function createOrganizationPost(input: z.infer<typeof postSchema>): Promise<ActionResult> {
  const parsed = optionalPostSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifică anunțul." };
  const active = await currentAuthorizedOrganization();
  if (!active.user) return { error: "Sesiunea a expirat sau nu ai drepturi de publicare." };

  const { error } = await active.supabase.from("posts").insert({ creator_id: active.user.id, content: parsed.data.content, image_url: parsed.data.imageUrl ?? null });
  if (error) return { error: safeError() };
  refreshOrganization("company");
  refreshOrganization("institution");
  return { success: true };
}

export async function createOrganizationEvent(input: z.infer<typeof eventSchema>): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifică evenimentul." };
  const active = await currentAuthorizedOrganization();
  if (!active.user) return { error: "Sesiunea a expirat sau nu ai drepturi de publicare." };
  const startDate = romanianDateToIso(parsed.data.startDate);
  if (!startDate) return { error: "Folosește data în formatul dd/mm/yyyy." };

  const { error } = await active.supabase.from("events").insert({
    creator_id: active.user.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    location: parsed.data.location || null,
    start_date: startDate,
    start_time: parsed.data.startTime || null,
    mode: parsed.data.mode,
    frequency: parsed.data.frequency,
    event_type: parsed.data.eventType,
    image_url: parsed.data.imageUrl ?? null,
  });
  if (error) return { error: safeError() };
  refreshOrganization("company");
  refreshOrganization("institution");
  return { success: true };
}

export async function createCompanyJob(input: z.infer<typeof jobSchema>): Promise<ActionResult> {
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifică detaliile jobului." };
  const { supabase, user, organizationId } = await currentOrganization("company");
  if (!user || !organizationId) return { error: "Doar administratorii companiei pot publica joburi." };
  const deadline = parsed.data.deadline ? romanianDateToIso(parsed.data.deadline) : null;

  const { error } = await supabase.from("jobs").insert({
    company_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    requirements: parsed.data.requirements || null,
    location: parsed.data.location || null,
    work_mode: parsed.data.workMode,
    job_type: parsed.data.jobType,
    degree_required: parsed.data.degreeRequired || null,
    rejection_message: parsed.data.rejectionMessage || null,
    cv_upload_url: parsed.data.cvUploadUrl || null,
    application_link: parsed.data.applicationLink || null,
    application_deadline: deadline,
  });
  if (error) return { error: safeError() };
  revalidatePath("/dashboard/company");
  revalidatePath("/marketplace");
  return { success: true };
}

export async function updateOrganizationProfile(kind: OrganizationKind, input: z.infer<typeof organizationProfileSchema>): Promise<ActionResult> {
  const parsed = organizationProfileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifică detaliile paginii." };
  const { supabase, user, organizationId } = await currentOrganization(kind);
  if (!user || !organizationId) return { error: "Doar administratorii pot actualiza pagina organizației." };
  const value = parsed.data;
  const common = {
    avatar_url: value.avatarUrl,
    background_url: value.backgroundUrl,
    description: value.description || null,
    website: value.website || null,
    founded_on: value.foundedOn ? romanianDateToIso(value.foundedOn) : null,
    specializations: value.specializations,
    updated_at: new Date().toISOString(),
  };

  const result = kind === "company"
    ? await supabase.from("companies").update({ ...common, location: value.location || null, sector: value.sector || null }).eq("id", organizationId)
    : await supabase.from("institutions").update({ ...common, city: value.location || null, sector: value.sector || null }).eq("id", organizationId);
  if (result.error) return { error: safeError() };
  refreshOrganization(kind);
  return { success: true };
}

export async function uploadOrganizationImage(formData: FormData): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesiunea a expirat. Autentifică-te din nou." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Alege o imagine înainte de încărcare." };
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 7 * 1024 * 1024) return { error: "Alege o imagine JPG, PNG sau WebP mai mică de 7 MB." };
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = `${user.id}/organization/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: false, contentType: file.type });
  if (error) return { error: "Imaginea nu a putut fi încărcată acum. Încearcă din nou." };
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { success: true, url: data.publicUrl };
}

export async function regenerateOrganizationInviteCode(kind: OrganizationKind): Promise<InviteCodeResult> {
  const { supabase, user } = await currentOrganization(kind);
  if (!user) return { error: "Nu ai permisiunea să regenerezi codul." };
  const functionName = kind === "company" ? "regenerate_company_invite_code" : "regenerate_institution_invite_code";
  const { data, error } = await supabase.rpc(functionName);
  if (error || typeof data !== "string") return { error: safeError() };
  revalidatePath(kind === "company" ? "/dashboard/company" : "/dashboard/institution");
  revalidatePath(kind === "company" ? "/dashboard/company/settings" : "/dashboard/institution/settings");
  return { success: true, code: data };
}
