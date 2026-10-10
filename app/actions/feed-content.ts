"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isTwentyFourHourTime, romanianDateToIso } from "@/lib/romanian-date";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { error: string };
const optionalImageUrl = z.string().url("Adresa imaginii nu este validă.").nullable().optional();
const postSchema = z.object({ content: z.string().trim().min(1, "Scrie mesajul pe care vrei să îl publici.").max(3_000), imageUrl: optionalImageUrl });
const eventSchema = z.object({
  title: z.string().trim().min(3, "Titlul evenimentului trebuie să aibă cel puțin 3 caractere.").max(180),
  description: z.string().trim().max(5_000),
  location: z.string().trim().max(240),
  startDate: z.string().refine((value) => romanianDateToIso(value) !== null, "Folosește data în formatul dd/mm/yyyy."),
  startTime: z.string().refine((value) => value === "" || isTwentyFourHourTime(value), "Folosește ora în formatul 24h HH:MM."),
  mode: z.enum(["fizic", "virtual"]),
  frequency: z.enum(["niciodata", "zilnic", "saptamanal"]),
  eventType: z.enum(["academic_lecture", "workshop_training", "hackathon_contest", "student_project", "career_fair", "networking_meetup", "volunteer_charity", "webinar_online", "sports_recreation", "other"]),
  imageUrl: optionalImageUrl,
});

async function currentPublisher() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  const { data: profile } = await supabase.from("profiles").select("role,onboarding_completed").eq("id", user.id).maybeSingle();
  const allowed = profile?.onboarding_completed && ["student", "company", "institution"].includes(profile.role);
  return { supabase, user: allowed ? user : null };
}

function refreshFeed() {
  revalidatePath("/feed");
  revalidatePath("/dashboard/student/profile");
  revalidatePath("/dashboard/company");
  revalidatePath("/dashboard/institution");
}

export async function createPost(input: z.infer<typeof postSchema>): Promise<ActionResult> {
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifică postarea." };
  const { supabase, user } = await currentPublisher();
  if (!user) return { error: "Sesiunea a expirat sau contul nu poate publica." };
  const { error } = await supabase.from("posts").insert({ creator_id: user.id, content: parsed.data.content, image_url: parsed.data.imageUrl ?? null });
  if (error) return { error: "Postarea nu a putut fi publicată acum. Încearcă din nou." };
  refreshFeed();
  return { success: true };
}

export async function createStudentPost(input: z.infer<typeof postSchema>): Promise<ActionResult> {
  return createPost(input);
}

export async function createEvent(input: z.infer<typeof eventSchema>): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifică datele evenimentului." };
  const { supabase, user } = await currentPublisher();
  if (!user) return { error: "Sesiunea a expirat sau contul nu poate publica." };
  const startDate = romanianDateToIso(parsed.data.startDate);
  if (!startDate) return { error: "Folosește data în formatul dd/mm/yyyy." };
  const { error } = await supabase.from("events").insert({
    creator_id: user.id,
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
  if (error) return { error: "Evenimentul nu a putut fi publicat acum. Încearcă din nou." };
  refreshFeed();
  return { success: true };
}

export async function createStudentEvent(input: z.infer<typeof eventSchema>): Promise<ActionResult> {
  return createEvent(input);
}