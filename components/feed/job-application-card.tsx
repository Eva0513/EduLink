"use client";

import { BriefcaseBusiness, FileUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { applyToJob } from "@/app/actions/job-applications";

type JobSummary = { id: string; title: string; description: string; requirements: string | null; location: string | null; job_type: string | null; work_mode: string | null; application_deadline: string | null; application_link: string | null; company_name?: string | null };

export function JobApplicationCard({ job, canApply = true }: { job: JobSummary; canApply?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData): Promise<void> {
    setPending(true);
    const result = await applyToJob(formData);
    setPending(false);
    if ("error" in result) { toast.error(result.error); return; }
    toast.success("CV-ul a fost trimis companiei.");
    setOpen(false);
  }
  return <article className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
    <div className="p-5"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e5f4f6] text-[#0e5e6f]"><BriefcaseBusiness className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-[#0e5e6f]">{job.company_name || "Oportunitate EduLink"}</p><h3 className="mt-1 text-lg font-extrabold text-slate-950">{job.title}</h3><p className="mt-1 text-sm text-slate-600">{job.work_mode || "Program flexibil"}{job.job_type ? " · " + job.job_type : ""}{job.location ? " · " + job.location : ""}</p></div></div><p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-700">{job.description}</p>{job.requirements ? <p className="mt-3 text-sm leading-6 text-slate-600"><strong>Cerințe:</strong> {job.requirements}</p> : null}</div>
    {canApply ? <><div className="flex flex-wrap gap-2 border-t border-slate-100 p-4"><button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[#026a81] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#003747]"><FileUp className="h-4 w-4" />Aplică cu CV</button>{job.application_link ? <a href={job.application_link} target="_blank" rel="noreferrer" className="rounded-xl border border-[#0e5e6f] px-4 py-2.5 text-sm font-bold text-[#0e5e6f]">Aplică pe site</a> : null}</div>{open ? <form action={submit} className="space-y-3 border-t border-slate-100 bg-slate-50 p-4"><input type="hidden" name="jobId" value={job.id} /><label className="block text-sm font-bold text-slate-800">CV în format PDF *<input required name="cv" type="file" accept="application/pdf" className="mt-1.5 block w-full text-sm font-normal" /></label><label className="block text-sm font-bold text-slate-800">Mesaj (opțional)<textarea name="message" maxLength={1500} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal" /></label><button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-[#0e5e6f] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{pending ? "Se trimite…" : "Trimite candidatura"}</button></form> : null}</> : <p className="border-t border-slate-100 p-4 text-sm text-slate-500">Aplicarea cu CV este disponibilă conturilor de student.</p>}
  </article>;
}