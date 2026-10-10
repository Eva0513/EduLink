"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { toggleFollow, type FollowTargetType } from "@/lib/actions/follow";
import { cn } from "@/lib/utils";

export function FollowButton({ targetType, targetId, initialIsFollowing, initialFollowerCount, className }: { targetType: FollowTargetType; targetId: string; initialIsFollowing: boolean; initialFollowerCount?: number; className?: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useOptimistic({ following: initialIsFollowing, count: initialFollowerCount ?? 0 });
  return <button type="button" disabled={pending} onClick={() => startTransition(async () => { const next = !state.following; setState({ following: next, count: Math.max(0, state.count + (next ? 1 : -1)) }); const result = await toggleFollow(targetType, targetId); if ("error" in result) { setState(state); toast.error(result.error); } })} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:opacity-60", state.following ? "border-[#168a9b] bg-[#e5f4f6] text-[#0e5e6f]" : "border-[#0e5e6f] text-[#0e5e6f] hover:bg-[#e5f4f6]", className)}>{state.following ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{state.following ? "Urmărești" : "Urmărește"}{initialFollowerCount !== undefined ? <span className="ml-1 opacity-75">· {state.count}</span> : null}</button>;
}