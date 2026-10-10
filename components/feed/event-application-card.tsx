"use client";

import { CalendarDays, FileUp, Loader2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { applyToEvent } from "@/app/actions/event-applications";
import { isoToRomanianDate } from "@/lib/romanian-date";

type EventSummary = { id: string; title: string | null; description: string | null; location: string | null; start_date: string | null; start_time: string | null; event_type: string; image_url: string | null };

export function EventApplicationCard({ event, canApply = true }: { event: EventSummary; canApply?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData): Promise<void> {
    setPending(true);
    const result = await applyToEvent(formData);
    setPending(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Aplicarea a fost trimisă organizatorului împreună cu CV-ul tău.");
    setOpen(false);
  }

  return <article className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm"><div className="p-5"><div className="flex gap-3"><CalendarDays className="mt-0.5 h-6 w-6 shrink-0 text-[#168a9b]" /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-[#168a9b]">{event.event_type.replaceAll("_", " ")}</p><h3 className="mt-1 text-lg font-extrabold text-slate-950">{event.title || "Eveniment EduLink"}</h3><p className="mt-1 text-sm text-slate-600">{isoToRomanianDate(event.start_date)}{event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}</p>{event.location ? <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-4 w-4" />{event.location}</p> : null}</div></div>{event.description ? <p className="mt-4 text-sm leading-6 text-slate-700">{event.description}</p> : null}</div>{event.image_url ? <img src={event.image_url} alt={`Imagine pentru ${event.title || "eveniment"}`} className="max-h-[420px] w-full object-cover" /> : null}<div className="border-t border-slate-100 p-4">{canApply ? <><button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#026a81] px-4 py-3 text-sm font-bold text-white hover:bg-[#003747]"><FileUp className="h-4 w-4" />Aplică cu CV</button>{open ? <form action={submit} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4"><input type="hidden" name="eventId" value={event.id} /><label className="block text-sm font-bold text-slate-800">CV în format PDF *<input required name="cv" type="file" accept="application/pdf" className="mt-1.5 block w-full text-sm font-normal" /></label><label className="block text-sm font-bold text-slate-800">Mesaj pentru organizator (opțional)<textarea name="message" maxLength={1500} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal" placeholder="Spune pe scurt de ce dorești să participi." /></label><button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-[#0e5e6f] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{pending ? "Se trimite..." : "Trimite aplicarea"}</button></form> : null}</> : <p className="text-sm text-slate-500">Aplicarea cu CV este disponibilă conturilor de student.</p>}</div></article>;
}
