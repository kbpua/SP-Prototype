import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BotOff, ChevronRight, ShieldCheck, Star, UserRound, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageHeader, StageFooter } from "@/components/PageHeader";
import {
  appraisalItemCount,
  useReview,
  usesAmstar,
  type AmstarAnswer,
  type DomainAssessment,
  type RobJudgement,
} from "@/state/ReviewContext";
import { AMSTAR2_ITEMS, ROB2_DOMAINS, type CandidateStudy } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { robOverall as baseRobOverall, type RobOverall } from "@/lib/review";

const ROB_OPTS: { value: RobJudgement; label: string; cls: string; dot: string }[] = [
  { value: "low", label: "Low risk", cls: "bg-brand-600 border-brand-600 text-white", dot: "bg-brand-500" },
  { value: "some", label: "Some concerns", cls: "bg-[#b45309] border-[#b45309] text-white", dot: "bg-[#b45309]" },
  { value: "high", label: "High risk", cls: "bg-coral border-coral text-white", dot: "bg-coral" },
];

const AMSTAR_OPTS: { value: AmstarAnswer; label: string; cls: string; dot: string }[] = [
  { value: "yes", label: "Yes", cls: "bg-brand-600 border-brand-600 text-white", dot: "bg-brand-500" },
  { value: "partial", label: "Partial yes", cls: "bg-[#b45309] border-[#b45309] text-white", dot: "bg-[#b45309]" },
  { value: "no", label: "No", cls: "bg-coral border-coral text-white", dot: "bg-coral" },
];

type Overall = RobOverall;

function robOverall(a: Record<string, DomainAssessment> | undefined): Overall {
  const o = baseRobOverall(a);
  return o.label === "Not assessed" ? { label: "In progress", tone: "neutral" } : o;
}

function amstarOverall(a: Record<string, DomainAssessment> | undefined): Overall {
  if (AMSTAR2_ITEMS.some((i) => !a?.[i.id]?.judgement)) return { label: "In progress", tone: "neutral" };
  const flaws = AMSTAR2_ITEMS.filter((i) => a?.[i.id]?.judgement === "no");
  const critical = flaws.filter((i) => i.critical).length;
  const weak = flaws.length - critical;
  if (critical > 1) return { label: "Critically low confidence", tone: "coral" };
  if (critical === 1) return { label: "Low confidence", tone: "coral" };
  if (weak > 1) return { label: "Moderate confidence", tone: "amber" };
  return { label: "High confidence", tone: "default" };
}

export default function Appraisal() {
  const navigate = useNavigate();
  const { included, appraisal, setDomain, loadSampleAppraisal, stageProgress } = useReview();
  const [selectedId, setSelectedId] = useState<string | undefined>(included[0]?.id);

  useEffect(() => {
    if (!included.some((s) => s.id === selectedId)) setSelectedId(included[0]?.id);
  }, [included, selectedId]);

  const selected = included.find((s) => s.id === selectedId);

  if (included.length === 0) {
    return (
      <div className="mx-auto max-w-[1120px] px-8 py-8">
        <PageHeader step="Stage 3 of 6" title="Critical appraisal" />
        <Card className="py-16 text-center">
          <ShieldCheck className="mx-auto size-10 text-brand-300" />
          <div className="mt-3 text-[15px] font-medium text-ink">No studies included yet</div>
          <p className="mt-1 text-[13px] text-ink-muted">Include studies during screening to appraise them here.</p>
          <Button className="mt-5" variant="outline" onClick={() => navigate("/review/screening")}>
            <ArrowLeft /> Back to screening
          </Button>
        </Card>
      </div>
    );
  }

  const selectedIndex = included.findIndex((s) => s.id === selectedId);
  const next = included[selectedIndex + 1];

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <PageHeader
        step="Stage 3 of 6"
        title="Critical appraisal"
        badges={
          <Badge variant="amber" className="py-1 text-[12px]">
            <UserRound /> Human review required
          </Badge>
        }
        description="Risk of bias is assessed by the analyst using Cochrane RoB 2 for randomised trials and AMSTAR 2 for systematic reviews, as recommended by the Philippine HTA Methods Guide."
      />

      <div className="mb-6 flex items-start gap-4 rounded-xl border border-flag/35 bg-flag-soft/70 px-5 py-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#854408] shadow-sm">
          <BotOff className="size-5" />
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[#7a430d]">Automation is intentionally disabled at this stage</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[#854408]">
            Risk-of-bias judgements depend on expert interpretation of trial conduct. The system provides no AI
            suggestions here — every judgement and justification is recorded as the analyst's own, forming an auditable
            human checkpoint between screening and extraction.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSampleAppraisal}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 self-center rounded-md border border-dashed border-flag/40 px-2.5 py-1.5 text-[11.5px] font-medium text-[#854408] hover:bg-white/60"
          title="Loads pre-written sample judgements for demonstration purposes"
        >
          <Wand2 className="size-3.5" /> Demo: load sample judgements
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-2">
          <div className="mb-1 flex items-center justify-between px-1 text-[12px] text-ink-muted">
            <span>Included studies ({included.length})</span>
            <span className="tabular">{stageProgress.appraisal}% appraised</span>
          </div>
          {included.map((s) => {
            const a = appraisal[s.id];
            const done = Object.values(a ?? {}).filter((d) => d.judgement).length;
            const totalItems = appraisalItemCount(s);
            const overall = usesAmstar(s) ? amstarOverall(a) : robOverall(a);
            const active = s.id === selectedId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "w-full cursor-pointer rounded-xl border p-3.5 text-left transition-all",
                  active ? "border-brand-400 bg-white shadow-sm ring-2 ring-brand-500/10" : "border-line bg-white/60 hover:bg-white",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-ink">
                    {s.trial?.acronym ?? s.authors.split(",")[0]}
                    <span className="ml-1.5 font-normal text-ink-muted">{s.year}</span>
                  </span>
                  <Badge variant={overall.tone}>{overall.label}</Badge>
                </div>
                <div className="mt-1 line-clamp-1 text-[12px] text-ink-muted">{s.title}</div>
                <div className="mt-2.5 flex items-center gap-2">
                  <Progress value={(done / totalItems) * 100} className="h-1" />
                  <span className="shrink-0 text-[11px] tabular text-ink-muted">
                    {done}/{totalItems}
                  </span>
                  <ChevronRight className={cn("size-3.5 shrink-0", active ? "text-brand-600" : "text-ink-muted/40")} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="col-span-8">
          {selected && (
            <Card key={selected.id} className="animate-fade-in">
              <CardHeader className="border-b border-line pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{usesAmstar(selected) ? "AMSTAR 2" : "Cochrane RoB 2"}</Badge>
                      <span className="text-[12px] text-ink-muted">
                        {usesAmstar(selected) ? "Systematic review" : "Outcome: primary composite endpoint"}
                      </span>
                    </div>
                    <CardTitle className="mt-2 text-[16px]">{selected.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {selected.authors} · {selected.journal} · {selected.year}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {usesAmstar(selected) ? renderAmstar(selected) : renderRob2(selected)}
                <div className="mt-4 flex items-center justify-between rounded-lg bg-cream px-4 py-3">
                  <div className="text-[13px] text-ink-soft">
                    Overall judgement:{" "}
                    <OverallBadge
                      overall={usesAmstar(selected) ? amstarOverall(appraisal[selected.id]) : robOverall(appraisal[selected.id])}
                    />
                  </div>
                  {next && (
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(next.id)}>
                      Next study <ArrowRight />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <RobSummaryTable
        studies={included.filter((s) => !usesAmstar(s))}
        appraisal={appraisal}
        onSelect={setSelectedId}
      />

      <StageFooter
        note={
          stageProgress.appraisal < 100
            ? "You can proceed now and return to finish appraisal later."
            : "All included studies have been appraised."
        }
      >
        <Button size="lg" onClick={() => navigate("/review/extraction")}>
          Proceed to extraction
          <ArrowRight />
        </Button>
      </StageFooter>
    </div>
  );

  function renderRob2(study: CandidateStudy) {
    const a = appraisal[study.id] ?? {};
    return (
      <Accordion type="multiple" defaultValue={["d1"]}>
        {ROB2_DOMAINS.map((d) => {
          const cur = a[d.id];
          const opt = ROB_OPTS.find((o) => o.value === cur?.judgement);
          return (
            <AccordionItem key={d.id} value={d.id}>
              <AccordionTrigger>
                <span className={cn("size-2.5 shrink-0 rounded-full", opt ? opt.dot : "border border-line bg-white")} />
                <span className="flex-1">{d.title}</span>
                <span className={cn("text-[12px] font-normal", opt ? "text-ink-soft" : "text-ink-muted")}>
                  {opt?.label ?? "Not assessed"}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pl-5.5">
                <p className="mb-3 text-[12.5px] leading-relaxed text-ink-muted">{d.hint}</p>
                <JudgementPicker
                  options={ROB_OPTS}
                  value={cur?.judgement}
                  onChange={(v) => setDomain(study.id, d.id, { judgement: v })}
                />
                <Textarea
                  className="mt-3 text-[13px]"
                  placeholder="Justification — cite the supporting text from the trial report…"
                  value={cur?.note ?? ""}
                  onChange={(e) => setDomain(study.id, d.id, { note: e.target.value })}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  }

  function renderAmstar(study: CandidateStudy) {
    const a = appraisal[study.id] ?? {};
    return (
      <div className="divide-y divide-line">
        {AMSTAR2_ITEMS.map((item, i) => (
          <div key={item.id} className="flex items-center gap-4 py-2.5">
            <span className="w-6 text-[12px] tabular text-ink-muted">{i + 1}</span>
            <span className="flex-1 text-[13px] text-ink">
              {item.title}
              {item.critical && (
                <Badge variant="coral" className="ml-2">
                  <Star /> Critical
                </Badge>
              )}
            </span>
            <JudgementPicker
              size="sm"
              options={AMSTAR_OPTS}
              value={a[item.id]?.judgement}
              onChange={(v) => setDomain(study.id, item.id, { judgement: v })}
            />
          </div>
        ))}
      </div>
    );
  }
}

function JudgementPicker<T extends string>({
  options,
  value,
  onChange,
  size = "default",
}: {
  options: { value: T; label: string; cls: string }[];
  value?: string;
  onChange: (v: T) => void;
  size?: "default" | "sm";
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "cursor-pointer rounded-md border font-medium transition-all active:scale-95",
            size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[12.5px]",
            value === o.value ? o.cls : "border-line bg-white text-ink-soft hover:bg-cream",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function OverallBadge({ overall }: { overall: Overall }) {
  return (
    <Badge variant={overall.tone} className="ml-1 text-[12px]">
      {overall.label}
    </Badge>
  );
}

function RobSummaryTable({
  studies,
  appraisal,
  onSelect,
}: {
  studies: CandidateStudy[];
  appraisal: Record<string, Record<string, DomainAssessment>>;
  onSelect: (id: string) => void;
}) {
  if (studies.length === 0) return null;
  const cell = (j?: string) => {
    const opt = ROB_OPTS.find((o) => o.value === j);
    return (
      <span
        className={cn(
          "mx-auto grid size-6 place-items-center rounded-full text-[11px] font-bold transition-colors duration-300",
          opt ? cn(opt.dot, "text-white") : "border border-dashed border-line text-ink-muted/50",
        )}
      >
        {j === "low" ? "+" : j === "some" ? "−" : j === "high" ? "×" : "?"}
      </span>
    );
  };
  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Risk-of-bias summary</CardTitle>
          <CardDescription>Traffic-light plot across RoB 2 domains for included trials</CardDescription>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-ink-muted">
          {ROB_OPTS.map((o) => (
            <span key={o.value} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", o.dot)} /> {o.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-[12px] text-ink-muted">
              <th className="py-2 text-left font-medium">Study</th>
              {ROB2_DOMAINS.map((d) => (
                <th key={d.id} className="w-20 py-2 font-medium" title={d.title}>
                  {d.id.toUpperCase()}
                </th>
              ))}
              <th className="w-36 py-2 font-medium">Overall</th>
            </tr>
          </thead>
          <tbody>
            {studies.map((s) => {
              const a = appraisal[s.id];
              const overall = robOverall(a);
              return (
                <tr
                  key={s.id}
                  className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-cream/60"
                  onClick={() => onSelect(s.id)}
                >
                  <td className="py-2.5 font-medium text-ink">
                    {s.trial?.acronym ?? s.authors.split(",")[0]} <span className="font-normal text-ink-muted">{s.year}</span>
                  </td>
                  {ROB2_DOMAINS.map((d) => (
                    <td key={d.id} className="py-2.5 text-center">
                      {cell(a?.[d.id]?.judgement)}
                    </td>
                  ))}
                  <td className="py-2.5 text-center">
                    <Badge variant={overall.tone}>{overall.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
