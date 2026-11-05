import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ROB2_DOMAINS, type CandidateStudy } from "@/data/mockData";
import type { DomainAssessment, RobJudgement } from "@/state/ReviewContext";
import { robOverall } from "@/lib/review";
import { cn } from "@/lib/utils";

export const ROB_OPTS: { value: RobJudgement; label: string; cls: string; dot: string }[] = [
  { value: "low", label: "Low risk", cls: "bg-brand-600 border-brand-600 text-white", dot: "bg-emerald-500" },
  { value: "some", label: "Some concerns", cls: "bg-[#b45309] border-[#b45309] text-white", dot: "bg-amber-400" },
  { value: "high", label: "High risk", cls: "bg-coral border-coral text-white", dot: "bg-red-500" },
];

const JUDGEMENT_LABEL: Record<RobJudgement, string> = {
  low: "Low risk",
  some: "Some concerns",
  high: "High risk",
};

const DOMAIN_COLUMNS = [
  ...ROB2_DOMAINS.map((d) => ({
    id: d.id,
    short: d.id.toUpperCase(),
    title: d.title.replace(/^D\d\s*·\s*/, ""),
  })),
  { id: "overall", short: "Overall", title: "Overall Bias" },
] as const;

type ViewMode = "traffic" | "summary";

function overallJudgement(a: Record<string, DomainAssessment> | undefined): RobJudgement | undefined {
  const o = robOverall(a);
  if (o.label === "High risk") return "high";
  if (o.label === "Some concerns") return "some";
  if (o.label === "Low risk") return "low";
  return undefined;
}

function cellTooltip(j: RobJudgement | undefined, note?: string, domainTitle?: string) {
  if (!j) return "Not assessed";
  const head = JUDGEMENT_LABEL[j];
  const body = note?.trim();
  if (body) return `${head}: ${body}`;
  if (domainTitle) return `${head} · ${domainTitle}`;
  return head;
}

function RobCell({
  j,
  size = "md",
  tip,
}: {
  j?: RobJudgement;
  size?: "sm" | "md";
  tip?: string;
}) {
  const opt = ROB_OPTS.find((o) => o.value === j);
  const circle = (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full",
        size === "sm" ? "size-3.5" : "size-5",
        opt ? opt.dot : "border border-dashed border-slate-300 bg-transparent",
      )}
      aria-label={opt?.label ?? "Not assessed"}
    />
  );

  if (!tip) return circle;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="grid size-full place-items-center cursor-help rounded-md border-0 bg-transparent p-0"
          aria-label={tip}
        >
          {circle}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

/** Mini D1–D5 dot row for compact tables. */
export function RobDots({ assessment }: { assessment?: Record<string, DomainAssessment> }) {
  return (
    <span className="inline-flex items-center gap-1">
      {ROB2_DOMAINS.map((d) => (
        <span key={d.id} title={`${d.title}${assessment?.[d.id]?.note ? `: ${assessment[d.id].note}` : ""}`}>
          <RobCell j={assessment?.[d.id]?.judgement as RobJudgement | undefined} size="sm" />
        </span>
      ))}
    </span>
  );
}

function RobLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600", className)}>
      {ROB_OPTS.map((o) => (
        <span key={o.value} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", o.dot)} />
          {o.label}
        </span>
      ))}
    </div>
  );
}

function TrafficLightPlot({
  studies,
  appraisal,
  onSelect,
}: {
  studies: CandidateStudy[];
  appraisal: Record<string, Record<string, DomainAssessment>>;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="max-h-[min(420px,55vh)] overflow-auto rounded-lg border border-slate-200 scrollbar-thin">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e2e8f0]">
          <tr className="text-slate-600">
            <th className="sticky left-0 z-[11] bg-white px-3 py-2.5 text-left text-xs font-medium">Study</th>
            {DOMAIN_COLUMNS.map((col) => (
              <th
                key={col.id}
                className="min-w-[72px] px-2 py-2.5 text-center text-xs font-medium"
                title={col.id === "overall" ? "Overall Bias" : `D${col.short.slice(1)}: ${col.title}`}
              >
                <div className="leading-tight">{col.short}</div>
                <div className="mt-0.5 hidden max-w-[88px] truncate text-[10px] font-normal text-slate-400 xl:block">
                  {col.title}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {studies.map((s) => {
            const a = appraisal[s.id];
            const name = s.trial?.acronym ?? s.authors.split(",")[0];
            return (
              <tr
                key={s.id}
                className={cn(
                  "border-t border-slate-100",
                  onSelect && "cursor-pointer hover:bg-slate-50/80",
                )}
                onClick={() => onSelect?.(s.id)}
              >
                <td className="sticky left-0 z-[1] bg-white px-3 py-2.5 font-semibold text-slate-800">
                  {name}
                  <span className="ml-1.5 font-normal text-slate-500">{s.year}</span>
                </td>
                {ROB2_DOMAINS.map((d) => {
                  const cell = a?.[d.id];
                  const j = cell?.judgement as RobJudgement | undefined;
                  return (
                    <td key={d.id} className="border-l border-slate-100 px-2 py-2.5 text-center align-middle">
                      <div className="mx-auto grid h-9 w-9 place-items-center rounded-md border border-slate-200/80 bg-slate-50/50">
                        <RobCell j={j} tip={cellTooltip(j, cell?.note, d.title)} />
                      </div>
                    </td>
                  );
                })}
                <td className="border-l border-slate-100 px-2 py-2.5 text-center align-middle">
                  <div className="mx-auto grid h-9 w-9 place-items-center rounded-md border border-slate-200/80 bg-slate-50/50">
                    <RobCell
                      j={overallJudgement(a)}
                      tip={cellTooltip(overallJudgement(a), undefined, "Overall Bias (derived from D1–D5)")}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type DomainShare = { low: number; some: number; high: number; assessed: number };

function pct(n: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

function SummaryBarChart({
  studies,
  appraisal,
}: {
  studies: CandidateStudy[];
  appraisal: Record<string, Record<string, DomainAssessment>>;
}) {
  const rows = useMemo(() => {
    const total = studies.length;
    const tallies: { id: string; label: string; share: DomainShare }[] = DOMAIN_COLUMNS.map((col) => {
      const share: DomainShare = { low: 0, some: 0, high: 0, assessed: 0 };
      for (const s of studies) {
        const a = appraisal[s.id];
        const j =
          col.id === "overall"
            ? overallJudgement(a)
            : (a?.[col.id]?.judgement as RobJudgement | undefined);
        if (!j) continue;
        share.assessed += 1;
        share[j] += 1;
      }
      return {
        id: col.id,
        label: col.id === "overall" ? "Overall Bias" : `${col.short}: ${col.title}`,
        share,
      };
    });
    return { total, tallies };
  }, [studies, appraisal]);

  const total = rows.total || 1;

  return (
    <div className="space-y-4">
      {rows.tallies.map(({ id, label, share }) => {
        const segments: { key: RobJudgement; n: number; p: number; cls: string }[] = [
          { key: "low", n: share.low, p: pct(share.low, total), cls: "bg-emerald-500" },
          { key: "some", n: share.some, p: pct(share.some, total), cls: "bg-amber-400" },
          { key: "high", n: share.high, p: pct(share.high, total), cls: "bg-red-500" },
        ];
        const unassessed = rows.total - share.assessed;
        const unPct = pct(unassessed, total);

        return (
          <div key={id} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center sm:gap-4">
            <div className="text-sm font-medium text-slate-700">{label}</div>
            <div className="min-w-0">
              <div className="flex h-8 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                {share.assessed === 0 ? (
                  <div className="flex w-full items-center justify-center text-xs text-slate-500">Not assessed</div>
                ) : (
                  <>
                    {segments.map((seg) =>
                      seg.p <= 0 ? null : (
                        <div
                          key={seg.key}
                          className={cn(
                            "relative flex h-full items-center justify-center text-[11px] font-semibold text-white transition-[width]",
                            seg.cls,
                            seg.p < 12 && "text-[10px]",
                          )}
                          style={{ width: `${seg.p}%` }}
                          title={`${JUDGEMENT_LABEL[seg.key]}: ${seg.n} (${seg.p}%)`}
                        >
                          {seg.p >= 8 ? `${seg.p}%` : null}
                        </div>
                      ),
                    )}
                    {unassessed > 0 && (
                      <div
                        className="flex h-full items-center justify-center bg-slate-200 text-[10px] font-medium text-slate-500"
                        style={{ width: `${unPct}%` }}
                        title={`Not assessed: ${unassessed}`}
                      >
                        {unPct >= 10 ? `${unPct}%` : null}
                      </div>
                    )}
                  </>
                )}
              </div>
              {share.assessed > 0 && (
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-slate-500">
                  {segments.map((seg) => (
                    <span key={seg.key}>
                      {JUDGEMENT_LABEL[seg.key]} {seg.p}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RobTrafficLight({
  studies,
  appraisal,
  onSelect,
  title = "Risk-of-bias summary",
  description = "Traffic-light plot across RoB 2 domains for included trials",
  footer,
  className,
}: {
  studies: CandidateStudy[];
  appraisal: Record<string, Record<string, DomainAssessment>>;
  onSelect?: (id: string) => void;
  title?: string;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<ViewMode>("traffic");

  if (studies.length === 0) return null;

  return (
    <Card className={cn("mt-6", className)}>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Segmented<ViewMode>
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "traffic", label: "Traffic Light" },
              { value: "summary", label: "Summary" },
            ]}
          />
          <RobLegend className="justify-end text-xs" />
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={150}>
          {view === "traffic" ? (
            <TrafficLightPlot studies={studies} appraisal={appraisal} onSelect={onSelect} />
          ) : (
            <SummaryBarChart studies={studies} appraisal={appraisal} />
          )}
        </TooltipProvider>
        {footer}
      </CardContent>
    </Card>
  );
}
