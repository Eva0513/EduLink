"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function applyToEvent(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim().slice(0, 1500);
  const cv = formData.get("cv");
  if (!eventId) return { error: "Evenimentul nu a putut fi identificat." };
  if (!(cv instanceof File) || cv.size === 0) return { error: "Atașează CV-ul în format PDF." };
  if (cv.type !== "application/pdf" || cv.size > 10 * 1024 * 1024) return { error: "CV-ul trebuie să fie PDF și să aibă cel mult 10 MB." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesiunea a expirat. Autentifică-te din nou." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "student") return { error: "Doar conturile de student pot aplica la evenimente." };
  const path = `${user.id}/event-applications/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage.from("profile-media").upload(path, cv, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { error: "CV-ul nu a putut fi încărcat acum. Încearcă din nou." };
  const { data: { publicUrl } } = supabase.storage.from("profile-media").getPublicUrl(path);
  const { error } = await supabase.from("event_applications").upsert({ event_id: eventId, profile_id: user.id, cv_url: publicUrl, message: message || null, updated_at: new Date().toISOString() }, { onConflict: "event_id,profile_id" });
  if (error) return { error: "Aplicarea nu a putut fi salvată acum. Încearcă din nou." };
  revalidatePath("/feed");
  return { success: true };
}
