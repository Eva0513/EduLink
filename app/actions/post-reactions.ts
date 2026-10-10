"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReactionType = "like" | "celebrate" | "support" | "love";

export async function togglePostReaction(postId: string, reactionType: ReactionType = "like") {
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return { error: "Postarea nu este validă." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Autentifică-te pentru a reacționa." };
  const { data: current, error: lookupError } = await supabase.from("post_reactions").select("id,reaction_type").eq("post_id", postId).eq("profile_id", user.id).maybeSingle();
  if (lookupError) return { error: "Nu am putut verifica reacția. Încearcă din nou." };
  if (current?.reaction_type === reactionType) {
    const { error } = await supabase.from("post_reactions").delete().eq("id", current.id);
    if (error) return { error: "Reacția nu a putut fi retrasă." };
    revalidatePath("/feed");
    return { reacted: false, countDelta: -1 };
  }
  const mutation = current
    ? supabase.from("post_reactions").update({ reaction_type: reactionType }).eq("id", current.id)
    : supabase.from("post_reactions").insert({ post_id: postId, profile_id: user.id, reaction_type: reactionType });
  const { error } = await mutation;
  if (error) return { error: "Reacția nu a putut fi salvată." };
  revalidatePath("/feed");
  return { reacted: true, countDelta: current ? 0 : 1 };
}