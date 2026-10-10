"use client";

import { MessageCircle, Repeat2, ThumbsUp } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { togglePostReaction, type ReactionType } from "@/app/actions/post-reactions";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { formatTimeAgo } from "@/lib/utils";

type Post = { id: string; content: string; image_url: string | null; created_at: string; creator_id: string };
type Author = { full_name: string; headline: string | null; avatar_url: string | null; role: string };
type Props = { post: Post; author?: Author; reactionCount?: number; initialReacted?: boolean };

export function PostCard({ post, author, reactionCount = 0, initialReacted = false }: Props) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useOptimistic({ reacted: initialReacted, count: reactionCount });
  const name = author?.full_name ?? "Membru EduLink";
  function react() {
    startTransition(async () => {
      const next = !state.reacted;
      setState({ reacted: next, count: Math.max(0, state.count + (next ? 1 : -1)) });
      const result = await togglePostReaction(post.id, "like" as ReactionType);
      if ("error" in result) {
        setState({ reacted: state.reacted, count: state.count });
        toast.error(result.error);
      }
    });
  }
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start gap-3 p-5"><ProfileAvatar src={author?.avatar_url ?? null} name={name} className="h-11 w-11 shrink-0 text-sm" /><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-900">{name}</h2><span className="rounded-full bg-[#e5f4f6] px-2 py-0.5 text-[11px] font-bold text-[#0e5e6f]">{author?.role === "company" ? "Companie" : author?.role === "institution" ? "Instituție" : "Student"}</span></div><p className="text-xs text-slate-500">{author?.headline ?? "Comunitatea EduLink"} · {formatTimeAgo(post.created_at)}</p></div></div>
    <p className="whitespace-pre-wrap px-5 pb-5 leading-7 text-slate-700">{post.content}</p>{post.image_url ? <img src={post.image_url} alt="Imaginea postării" className="max-h-[34rem] w-full object-cover" /> : null}
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2 text-xs text-slate-500"><span>{state.count ? state.count + " reacții" : "Fii primul care reacționează"}</span><span>{pending ? "Se salvează…" : ""}</span></div>
    <div className="grid grid-cols-3 border-t border-slate-100 px-3 py-2"><button type="button" onClick={react} disabled={pending} className={state.reacted ? "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition disabled:opacity-60 text-[#0e5e6f] bg-[#e5f4f6]" : "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"}><ThumbsUp className="h-4 w-4" />Apreciază</button><Action icon={<MessageCircle />} label="Comentează" /><Action icon={<Repeat2 />} label="Distribuie" /></div>
  </article>;
}
function Action({ icon, label }: { icon: React.ReactNode; label: string }) { return <button type="button" className="flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">{icon}{label}</button>; }